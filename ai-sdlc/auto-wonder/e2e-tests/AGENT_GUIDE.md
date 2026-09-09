# Agent Guide: Community E2E Lifecycle

This is the required workflow for building and starting a community worktree.
The script owns compilation, the release image, isolated MySQL/Redis/MinIO,
fresh-schema checks, dynamic ports, Spring Boot startup, standard probes, logs,
host prerequisite installation, and cleanup. The Agent owns any task-specific
browser or API exploration after startup.

## Start the exact worktree

From that worktree, run:

```bash
./e2e-tests/verify.sh --start --project-root "$(pwd -P)" --mode image --keep-on-failure
```

`--project-root` is a filesystem path, not a branch name. The script records the
existing branch, commit, and dirty state, but never fetches, checks out, merges,
or edits Git state.

On macOS and CentOS, prerequisite bootstrap is automatic. Let the script reuse
installed tools, install missing Git/curl/Python/OpenSSL/JDK 21/Maven and Docker
components, and start Docker Desktop or Docker Engine. Do not independently
invent installation commands. On CentOS the Agent must already run as root or
have non-interactive sudo; otherwise report `SUDO_UNAVAILABLE` and its printed
recovery command. Use `--no-install` only when the governing request explicitly
requires a detection-only run.

Record the paths printed before the build begins. In particular:

- `BUILD_LOG` contains Maven output.
- `BOOTSTRAP_LOG` contains prerequisite installation and Docker-daemon details.
- `COMPOSE_LOG` contains dependency and application orchestration output.
- `SPRING_BOOT_CONSOLE_LOG` points to `spring-boot-console.log` and exists before
  Spring Boot starts.
- `STARTUP_DIAGNOSTIC_LOG` contains container inspection and a best-effort Java
  thread dump when startup exits or times out.
- `FAILURE_REPORT` and `RESULT_JSON` give the concise machine-readable verdict.

The command prints progress heartbeats during long phases. Do not replace a
failed phase by manually launching another database, Redis, MinIO, or JVM.
Treat `LIFECYCLE|END|PASS` as startup completion and
`LIFECYCLE|END|FAIL` as failure; a path announcement alone is not completion.

## Read runtime information safely

After `VERDICT=STARTED`, read `runtime.json` first. It contains the platform URL,
resolved host ports, image identity, tested Git identity, and log paths; it does
not contain secrets.

Database, Redis, MinIO, and platform connection values are in `runtime.env` with
permission `0600`. The Agent may directly read individual keys when a test needs
them. Never print, paste, or copy credential values into chat, reports, ordinary
logs, screenshots, shell tracing, or command-line arguments. Do not `source`
`runtime.env`; extract only the needed key without echoing its value. Application
startup secrets live separately in `app.env`, also mode `0600`.

## Explore, observe, and decide

Use the platform URL from `runtime.json` for browser automation or curl checks.
While exercising the UI or API, inspect or follow the already-published Spring
Boot logs:

```bash
./e2e-tests/verify.sh --logs --follow --project-root "$(pwd -P)"
```

When task-specific exploration is complete, always run the standard gate:

```bash
./e2e-tests/verify.sh --check --project-root "$(pwd -P)"
```

`--check` rechecks health, runs the authenticated request chain, and rejects
unexpected `ERROR` or `WARN` records. A nonzero exit, `VERDICT=FAIL`, or failing
`result.json` must never be reported as a successful release validation.

## Diagnose a failure

The first screen identifies `FAILED_PHASE`, `FAILURE_KIND`, root-cause summary,
and exact evidence paths. Start with `failure-report.txt`, then use the phase:

- `BUILD`: inspect `build.log`.
- `BOOTSTRAP`: inspect `bootstrap.log`; use its stable failure kind and
  `NEXT_COMMAND`. `INSTALL_DISABLED` means rerun without `--no-install`,
  `SUDO_UNAVAILABLE` means root/non-interactive sudo is required, and
  `DOCKER_START_TIMEOUT` means Docker Desktop was opened but did not become
  reachable before the bounded timeout.
- `IMAGE_BUILD`: inspect `image-build.log`.
- `DEPENDENCIES`: inspect `compose.log` plus `mysql.log`, `redis.log`, or
  `minio.log`.
- `APPLICATION_START`: inspect `spring-boot-console.log`, then
  `startup-diagnostic.log` and `compose.log`.
- post-start functional or log failure: inspect `result.json`, the authenticated
  check report under the run directory, and `auto-wonder.log`.

Use this read-only summary at any time:

```bash
./e2e-tests/verify.sh --status --project-root "$(pwd -P)"
```

With `--keep-on-failure`, the exact containers, volumes, credentials, and logs
remain available for diagnosis.

## Stop and clean up

Stop preserves evidence and data for later inspection:

```bash
./e2e-tests/verify.sh --stop --project-root "$(pwd -P)"
```

Cleanup archives non-secret evidence under `target/e2e-results/<run-id>/`, then
removes only this run's Compose resources and deletes its credential files:

```bash
./e2e-tests/verify.sh --clean-up --project-root "$(pwd -P)"
```

If startup failed before Compose was attempted, cleanup runs in `STATE_ONLY`
mode and does not require Docker. This is the correct way to clear a preserved
bootstrap/build failure.

Never use broad process matching or global Docker cleanup. Concurrent worktrees
may be undergoing independent verification.
