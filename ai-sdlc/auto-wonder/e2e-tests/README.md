# Community end-to-end startup harness

Proves that a **brand-new** community install actually works: the schema imports
into an empty volume, the service starts from the build artefact, the
community-specific defaults are live in real responses, and a real user can walk
register → login → workspace → this release's new endpoints.

Unit tests being green does not mean the application starts. This directory
exists because that gap can only be closed by running the thing.

```
e2e-tests/up.sh         # dependencies + fresh-volume schema verification
e2e-tests/smoke.sh      # start the service, probe public endpoints, scan logs
e2e-tests/authchain.sh  # walk a real authenticated chain
e2e-tests/logscan.sh    # attribute every ERROR / WARN to the request that caused it
e2e-tests/down.sh       # tear everything down and assert nothing is left
```

Run them in that order. Each one refuses to start if its predecessor has not run.

## Requirements

Only these, and nothing is installed on the host:

- `docker` with a reachable daemon, and `docker compose` v2
- `bash`, `curl`, `python3`, `openssl`

The harness never touches a host MySQL, Redis or object store. Every dependency
runs in a container on its own network with its own volumes, so it can run beside
anything else on the machine and can be run repeatedly.

## Quick start

```sh
mvn -B -DskipGitCommitId=true clean verify      # produces target/auto-wonder.jar
export AW_E2E_PROJECT=aw-e2e-$(date +%s)        # a unique name = genuinely fresh volumes
e2e-tests/up.sh
e2e-tests/smoke.sh
e2e-tests/authchain.sh
e2e-tests/logscan.sh
e2e-tests/down.sh
```

`AW_E2E_PROJECT` decides the volume names. `up.sh` asserts before starting that
no volume or container for that project already exists, because the community
compose file mounts the schema into `/docker-entrypoint-initdb.d` and MySQL only
executes that directory when the data directory is **empty** — a reused volume
silently skips the import and every later result would describe a stale database.

## Knobs

Every value below is an environment variable with a working default. Override by
exporting it before running a script.

| Variable | Default | Meaning |
| --- | --- | --- |
| `AW_E2E_PROJECT` | `aw-e2e` | compose project; also names volumes, network and state dir |
| `AW_E2E_NETWORK` | `<project>-net` | compose network name |
| `AW_E2E_STATE_DIR` | `$TMPDIR/aw-e2e-<project>` | run state, secrets, reports |
| `AW_E2E_MYSQL_PORT` | `33060` | host port, moved automatically if busy |
| `AW_E2E_REDIS_PORT` | `63790` | host port, moved automatically if busy |
| `AW_E2E_MINIO_PORT` | `9000` | S3 API port |
| `AW_E2E_MINIO_CONSOLE_PORT` | `9001` | MinIO console |
| `AW_E2E_APP_PORT` | `7001` | the service's own port |
| `AW_E2E_MYSQL_IMAGE` | `mysql:8.0` | |
| `AW_E2E_REDIS_IMAGE` | `redis:7-alpine` | |
| `AW_E2E_MINIO_IMAGE` | `quay.io/minio/minio:latest` | |
| `AW_E2E_OFFICIAL_IMAGE_MIRROR` | `public.ecr.aws/docker/library` | fallback for Docker Official Images |
| `AW_E2E_BUCKET` | `aw-e2e-autowonder` | object storage bucket |
| `AW_E2E_JAR` | `target/auto-wonder.jar` | artefact under test |
| `AW_E2E_SMOKE_STOP` | unset | set to `1` to stop the service when `smoke.sh` ends |

## What is deliberately not modified

`docs/community/docker-compose.dependencies.yml` is the artefact under test and
is used **byte-identically**. Port changes, the MinIO service and the per-run
network name all come from an additional compose layer, `compose.e2e.yml`, passed
as a second `-f`. `up.sh` prints `compose base mode: verbatim` when it managed to
use the community file unmodified, which is the normal case.

## Machine-independence notes

These are the things that break when the harness is moved to another machine, and
how each is handled.

**Registry egress.** `registry-1.docker.io` is unreachable on some networks. Each
Docker Official Image is therefore pulled from `public.ecr.aws/docker/library/...`
as a fallback and retagged locally. That is a public AWS endpoint, not an internal
one. MinIO comes from `quay.io`, which is reachable where Docker Hub is not.

**Architecture pins.** The community compose file pins `platform: linux/amd64` for
MySQL and Redis. On arm64 hosts compose honours that pin strictly and
re-consults the registry for a locally present image whose tag reports the wrong
architecture — which then fails when Docker Hub is unreachable. So `up.sh`
materialises each pinned platform and *proves* it runs (`docker run --platform …
uname -m`) before telling compose `pull_policy: never` for the rest of the run.
Under the containerd image store `docker image inspect` reports the manifest
index, so its `Architecture` field is not decisive; only actually running the
image is.

**Credential helper.** Docker Desktop sets `credsStore: desktop` in
`~/.docker/config.json`, and `docker-credential-desktop` is often absent from a
non-interactive `PATH`. Every pull then fails with "error getting credentials".
`aw_e2e_fix_credential_helper` reads that key and re-adds the helper directory.

**Port collisions.** If `33060` or `63790` is already taken, the harness picks
the next free port and records the choice in `resolved.env`. `smoke.sh` and
`down.sh` replay that file rather than re-deriving ports, so all three scripts
always agree.

**Exported variables.** Compose reads the process *environment*, not the shell's
variable table. Every knob `compose.e2e.yml` interpolates is therefore exported in
`lib/common.sh`; an unexported one makes compose fall back to its own default
while the scripts keep using the real value, and the two then disagree about the
network name.

## Object storage

The service cannot start without a bucket: `taskPackager(...)` is wired
unconditionally. There is no OSS locally, so MinIO stands in for it through the
`S3ObjectStorage` backend, which the product supports first-class (`s3.endpoint`,
`s3.force-path-style: true`, and the configuration comments name MinIO
explicitly). `oss.enabled` and `s3.enabled` are mutually exclusive and the service
refuses to start if both are true.

`S3ObjectStorage` never creates buckets, so `up.sh` pre-creates one with `mc mb
-p`. `docs/community/application.env.example` documents only the OSS keys; the S3
keys `smoke.sh` sets are listed in that script.

## Environment variable quoting

`docs/community/application.env.example` contains a JDBC URL with four unquoted
`&` characters:

```
SPRING_DATASOURCE_URL=jdbc:mysql://mysql:3306/autowonder?useUnicode=true&characterEncoding=utf-8&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Shanghai
```

`smoke.sh` demonstrates what actually happens, because it is worse than
truncation and is easily misdiagnosed as a product defect: **sourcing** that line
does not set a truncated variable, it leaves `SPRING_DATASOURCE_URL` *entirely
unset*. Each `&` turns the assignment before it into a background subshell, and
only the trailing `serverTimezone=Asia/Shanghai` survives — as its own unrelated
variable. The harness therefore loads the run environment line by line with
`export`, and asserts the resulting value matches the intended one exactly.

When the service fails to start, suspect the launch script before the product.

## Credentials

Nothing secret is ever placed in a command argument, because argv is readable
through `ps`. Concretely:

- generated passwords and MinIO credentials live in `secrets.env`, mode 600, under
  `$AW_E2E_STATE_DIR`, which `down.sh` deletes;
- bearer tokens go into mode-600 curl config files used with `curl -K`, never
  into `-H` on the command line;
- request bodies go to a mode-600 temp file used with `--data @file`;
- SQL reaches MySQL as an environment variable, not interpolated into a
  double-quoted `sh -c` string — interpolating would let bash command-substitute
  any backtick in the query;
- response bodies are only ever printed after redaction, with credential-shaped
  keys replaced by `<REDACTED len=N>`;
- `redacted-*.json` copies are the only bodies that may be archived as evidence.

## Reading the results

`authchain.sh` writes `CHECK|<PASS|FAIL>|<name>|http=…|success=…|<note>` lines and
ends with `PASS_COUNT`, `FAIL_COUNT` and `VERDICT`. Three of its checks are
**expected failures** of the product's own guards, asserted as such:

- `ws_dup_restore_a` expects `11007` — restoring a soft-deleted workspace is
  refused once an active row holds that name again;
- `ws_dup3` expects `11003` — an active row blocks creating another with the same
  name;
- `conv_turn` expects refusal when no runtime is connected, which on a fresh
  install is always the case.

Those two workspace checks are the decisive test of migration `V051`, which swaps
the unique key `uk_name` for `uk_active_name`, a `STORED` generated column that is
`NULL` once a row is soft-deleted. Both directions are asserted against the live
database, not against SQL text.

`logscan.sh` joins the `request_id` in every diagnostic log line to the
`request_id` in every response body the harness saved, so each `ERROR` or `WARN`
is answered with "which call of mine caused this". `ERROR_UNATTRIBUTED` and
`WARN_UNATTRIBUTED` must be `0`: an attributed diagnostic is explained by
construction, an unattributed one means the application complained about something
nobody asked it to do.

`down.sh` ends with a teardown report whose residue counters must all be `0` /
`no`, including `PORT_<n>_LISTENERS` for all five ports and
`CREDENTIAL_FILES_DELETED`.
