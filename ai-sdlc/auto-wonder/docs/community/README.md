# Community Runtime Guide

## Supported Runtime

The supported deployment target is Linux x86_64 with Java 21. The server image
contains the AutoWonder service only; agent CLIs run in separately deployed
client runtimes. SIGAR metrics are enabled on Linux x86_64 and degrade to an
empty optional capability when unavailable. Set `AUTOWONDER_SIGAR_ENABLED=false`
to disable them explicitly.

Required services are MySQL 8, Redis, and an OSS-compatible Alibaba Cloud OSS
bucket. OSS does not fall back to local memory. SLS is a supported public cloud
integration and is enabled with configuration rather than replaced by an
emulator. Aone is optional and disabled by default.

## Configuration

Use [application.env.example](application.env.example) as the environment
variable inventory. Generate independent production secrets:

```bash
openssl rand -base64 32 # AUTOWONDER_SECRET_MASTER_KEY: exactly 32 decoded bytes
openssl rand -base64 48 # AUTOWONDER_JWT_SECRET
```

The master key encrypts persisted business credentials with AES-256-GCM. Keep it
stable across restarts and back it up outside the database. Losing or changing
it makes existing `enc:v1:` ciphertext unreadable. Never commit either secret.

`OSS_ENDPOINT`, `OSS_PUBLIC_ENDPOINT`, `OSS_BUCKET`, `OSS_ACCESS_KEY_ID`, and
`OSS_ACCESS_KEY_SECRET` are mandatory. Set `OSS_ENDPOINT` to the regional
intranet endpoint used by the server for object I/O. Set `OSS_PUBLIC_ENDPOINT`
to the matching regional public HTTPS endpoint used to create links consumed by
browsers and executor runtimes. Never replace the host after a URL is signed.
`OSS_TASK_PKG_BUCKET`,
`OSS_ARTIFACT_BUCKET`, and `OSS_SKILL_BUCKET` may select separate buckets and
otherwise inherit `OSS_BUCKET`.

To enable SLS, set `AUTOWONDER_SLS_ENABLED=true` and configure its endpoint,
project, three logstores, and access key pair. Keep it false when SLS delivery is
not required. Configure `ANTHROPIC_*` only when the server-side AI provider is
used.

## Database

Import `docs/autowonder-schema.sql` into a new database. This community fork does
not migrate internal KeyCenter ciphertext or legacy plaintext credential rows.
The dependency compose file performs the import only when its MySQL volume is
first created.

For an existing installation, follow the deployment Skill upgrade runbook and
apply only new immutable scripts from `docs/migration/`. Never re-import the full
schema during an upgrade. Database changes require a reviewed backup,
compatibility assessment, and explicit confirmation before execution.

Start disposable local dependencies:

```bash
docker compose -f docs/community/docker-compose.dependencies.yml up -d --wait
```

The compose file intentionally provides only MySQL and Redis. Use real OSS and,
when enabled, SLS services. Host ports are `33060` and `63790`; containers on
the `autowonder-community` network use `mysql:3306` and `redis:6379`.

## Build And Run

```bash
mvn -DskipGitCommitId=true clean verify
docker build --platform linux/amd64 \
  -f APP-META/docker-config/Dockerfile \
  -t autowonder-community:local .
docker run --rm --platform linux/amd64 \
  --name autowonder-community \
  --network autowonder-community \
  --env-file docs/community/application.env.example \
  -p 7001:7001 \
  autowonder-community:local
```

Fill all secret and OSS values before starting the server. Then check:

```bash
curl --fail http://localhost:7001/checkpreload.htm
curl --fail http://localhost:7001/api/integrations/capabilities
```

The capability response reports `aoneEnabled: false` unless explicitly enabled.
Open `http://localhost:7001/register` to create the first user. After signing in,
create an organization from the organization selection page; the creator becomes
its owner and administrator.

## Release Checks

For a local release-image startup gate, target the exact pending-merge worktree:

```bash
./e2e-tests/verify.sh --start --project-root "$(pwd -P)" --mode image --keep-on-failure
# Perform any release-specific browser/API checks, then:
./e2e-tests/verify.sh --check --project-root "$(pwd -P)"
./e2e-tests/verify.sh --clean-up --project-root "$(pwd -P)"
```

The lifecycle automatically compiles and tests the code, builds the final image,
initializes a fresh schema, starts isolated MySQL/Redis/MinIO and Spring Boot,
resolves host-port conflicts, and publishes log paths and a non-secret runtime
manifest before returning control to the Agent. Credentials are available only
in the printed mode-`0600` `runtime.env`. See
[the Agent lifecycle guide](../../e2e-tests/AGENT_GUIDE.md).

The release gate supports macOS and CentOS verification hosts. It automatically
probes and installs Git, curl, Python 3, OpenSSL, JDK 21, Maven, Docker,
Compose v2, and Buildx, then starts Docker Desktop or Docker Engine when needed.
CentOS requires root or non-interactive sudo. Pass `--no-install` only for a
detection-only run. MySQL, Redis, MinIO and its client are repository-declared
image references pulled by Docker; the application image is built from the
exact pending-merge worktree. Every run publishes `BOOTSTRAP_LOG` before work
begins and ends with an explicit `LIFECYCLE|END|PASS` or `FAIL` record.

Run the complete matrix in [verification.md](verification.md). A release requires
the automated test and internal-reference gates, a Linux amd64 image build, an
OSS upload/read/presign test, a persisted-secret round trip, and SLS delivery
when SLS is enabled.

The community fork is periodically synchronized from `origin/master`. Follow the
[upstream sync guide](upstream-sync-guide.md) for constraints and procedure, and
use the [upstream sync log](upstream-sync-log.md) for the exact current master
baseline, merge history, decisions, and verification evidence.

The published `docs/` tree follows the
[community documentation policy](docs-policy.md); detailed Alibaba Cloud
deployment and operations guidance is maintained inside the deployment Skill.

## Community-Specific Defaults

Four defaults differ from the internal upstream product, which sets all four to
`false`. `AUTOWONDER_COMMUNITY_EDITION` defaults to `true` and is reported as
`communityEdition` by `GET /api/platform/branding/public`. When it is `true` the
frontend hides the 「更多客户端接入」 panel of the new-MCP-token dialog, which
lists integration snippets for client runtimes the community edition does not
ship. Set it to `false` only to restore that panel; nothing else depends on it.

`AUTOWONDER_SCHEDULED_TASK_ENABLED`,
`AUTOWONDER_SCHEDULED_TASK_SCANNER_ENABLED` and
`AUTOWONDER_SCHEDULED_TASK_CLUSTER_READY` also default to `true`. A fresh install
is ready immediately, but an upgrade of a deployment already serving traffic must
set all three to `false` until every node runs the new schema. Follow
[scheduled-task-operations.md](../scheduled-task-operations.md).
