#!/usr/bin/env bash

# State and reporting helpers for e2e-tests/verify.sh. This file is sourced by
# commands and tests; it intentionally does not enable shell options itself.

aw_realpath() {
  [[ -d "$1" ]] || return 1
  (cd "$1" && pwd -P)
}

aw_project_hash() {
  if command -v shasum >/dev/null 2>&1; then
    printf '%s' "$1" | LC_ALL=C LANG=C shasum -a 256 | awk '{print substr($1, 1, 12)}'
  elif command -v sha256sum >/dev/null 2>&1; then
    printf '%s' "$1" | LC_ALL=C LANG=C sha256sum | awk '{print substr($1, 1, 12)}'
  else
    printf '%s' "$1" | LC_ALL=C LANG=C cksum | awk '{printf "%012x", $1}'
  fi
}

aw_run_nonce() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 4
  else
    printf '%04x%04x' "$RANDOM" "$RANDOM"
  fi
}

aw_phase() {
  local phase="$1" status="$2" detail="${3:-}"
  if [[ -n "$detail" ]]; then
    printf 'PHASE|%s|%s|%s\n' "$phase" "$status" "$detail"
  else
    printf 'PHASE|%s|%s\n' "$phase" "$status"
  fi
}

aw_lifecycle_event() {
  local boundary="$1" detail="${2:-}"
  printf 'LIFECYCLE|%s%s\n' "$boundary" "${detail:+|$detail}"
}

aw_step_event() {
  local step="$1" state="$2" detail="${3:-}"
  printf 'STEP|%s|%s%s\n' "$step" "$state" "${detail:+|$detail}"
}

aw_lifecycle_init() {
  local requested_root="$1" short_commit state_base log_name
  AW_PROJECT_ROOT="$(aw_realpath "$requested_root")" || {
    printf 'FATAL: project root is not a directory: %s\n' "$requested_root" >&2
    return 1
  }
  short_commit="$(git -C "$AW_PROJECT_ROOT" rev-parse --short=10 HEAD 2>/dev/null || printf 'no-commit')"
  state_base="${AW_E2E_TEST_STATE_BASE:-${TMPDIR:-/tmp}/autowonder-e2e}"
  AW_PROJECT_STATE_ROOT="$state_base/$(aw_project_hash "$AW_PROJECT_ROOT")"
  AW_RUN_ID="aw-e2e-$short_commit-$(aw_run_nonce)"
  AW_RUN_DIR="$AW_PROJECT_STATE_ROOT/$AW_RUN_ID"
  AW_LOG_DIR="$AW_RUN_DIR/logs"
  AW_RUNTIME_ENV="$AW_RUN_DIR/runtime.env"
  AW_APP_ENV="$AW_RUN_DIR/app.env"
  AW_RUNTIME_JSON="$AW_RUN_DIR/runtime.json"
  AW_RESULT_JSON="$AW_RUN_DIR/result.json"
  AW_CURRENT_RUN_FILE="$AW_PROJECT_STATE_ROOT/current"

  mkdir -p "$AW_LOG_DIR"
  chmod 700 "$AW_RUN_DIR"
  for log_name in bootstrap build image-build compose mysql redis minio spring-boot-console auto-wonder startup-diagnostic; do
    : >"$AW_LOG_DIR/$log_name.log"
    chmod 666 "$AW_LOG_DIR/$log_name.log"
  done
  chmod 777 "$AW_LOG_DIR"
  : >"$AW_RUNTIME_ENV"
  chmod 600 "$AW_RUNTIME_ENV"
  : >"$AW_APP_ENV"
  chmod 600 "$AW_APP_ENV"
  : >"$AW_RUN_DIR/failure-report.txt"
  printf '%s\n' "$AW_RUN_ID" >"$AW_CURRENT_RUN_FILE"

  export AW_PROJECT_ROOT AW_PROJECT_STATE_ROOT AW_RUN_ID AW_RUN_DIR AW_LOG_DIR
  export AW_RUNTIME_ENV AW_APP_ENV AW_RUNTIME_JSON AW_RESULT_JSON AW_CURRENT_RUN_FILE
}

aw_lifecycle_refuse_active() {
  local requested_root="$1" canonical state_base project_state current_run
  canonical="$(aw_realpath "$requested_root")" || return 1
  state_base="${AW_E2E_TEST_STATE_BASE:-${TMPDIR:-/tmp}/autowonder-e2e}"
  project_state="$state_base/$(aw_project_hash "$canonical")"
  [[ ! -f "$project_state/current" ]] && return 0
  current_run="$(sed -n '1p' "$project_state/current")"
  printf 'FATAL: current E2E run already exists: %s\n' "$current_run" >&2
  printf 'Run --status, --stop, or --clean-up for this project root before --start.\n' >&2
  return 1
}

aw_lifecycle_load() {
  local requested_root="$1" state_base run_id
  AW_PROJECT_ROOT="$(aw_realpath "$requested_root")" || {
    printf 'FATAL: project root is not a directory: %s\n' "$requested_root" >&2
    return 1
  }
  state_base="${AW_E2E_TEST_STATE_BASE:-${TMPDIR:-/tmp}/autowonder-e2e}"
  AW_PROJECT_STATE_ROOT="$state_base/$(aw_project_hash "$AW_PROJECT_ROOT")"
  AW_CURRENT_RUN_FILE="$AW_PROJECT_STATE_ROOT/current"
  [[ -f "$AW_CURRENT_RUN_FILE" ]] || {
    printf 'FATAL: no current E2E run for project root: %s\n' "$AW_PROJECT_ROOT" >&2
    return 1
  }
  run_id="$(sed -n '1p' "$AW_CURRENT_RUN_FILE")"
  [[ -n "$run_id" && -d "$AW_PROJECT_STATE_ROOT/$run_id" ]] || {
    printf 'FATAL: current E2E run state is missing: %s\n' "$run_id" >&2
    return 1
  }
  AW_RUN_ID="$run_id"
  AW_RUN_DIR="$AW_PROJECT_STATE_ROOT/$AW_RUN_ID"
  AW_LOG_DIR="$AW_RUN_DIR/logs"
  AW_RUNTIME_ENV="$AW_RUN_DIR/runtime.env"
  AW_APP_ENV="$AW_RUN_DIR/app.env"
  AW_RUNTIME_JSON="$AW_RUN_DIR/runtime.json"
  AW_RESULT_JSON="$AW_RUN_DIR/result.json"
  export AW_PROJECT_ROOT AW_PROJECT_STATE_ROOT AW_RUN_ID AW_RUN_DIR AW_LOG_DIR
  export AW_RUNTIME_ENV AW_APP_ENV AW_RUNTIME_JSON AW_RESULT_JSON AW_CURRENT_RUN_FILE
}

aw_publish_paths() {
  printf 'RUN_ID=%s\n' "$AW_RUN_ID"
  printf 'RUN_STATE_DIR=%s\n' "$AW_RUN_DIR"
  printf 'BOOTSTRAP_LOG=%s/bootstrap.log\n' "$AW_LOG_DIR"
  printf 'BUILD_LOG=%s/build.log\n' "$AW_LOG_DIR"
  printf 'IMAGE_BUILD_LOG=%s/image-build.log\n' "$AW_LOG_DIR"
  printf 'COMPOSE_LOG=%s/compose.log\n' "$AW_LOG_DIR"
  printf 'MYSQL_LOG=%s/mysql.log\n' "$AW_LOG_DIR"
  printf 'REDIS_LOG=%s/redis.log\n' "$AW_LOG_DIR"
  printf 'MINIO_LOG=%s/minio.log\n' "$AW_LOG_DIR"
  printf 'SPRING_BOOT_CONSOLE_LOG=%s/spring-boot-console.log\n' "$AW_LOG_DIR"
  printf 'SPRING_BOOT_FILE_LOG=%s/auto-wonder.log\n' "$AW_LOG_DIR"
  printf 'STARTUP_DIAGNOSTIC_LOG=%s/startup-diagnostic.log\n' "$AW_LOG_DIR"
  printf 'FAILURE_REPORT=%s/failure-report.txt\n' "$AW_RUN_DIR"
  printf 'RESULT_JSON=%s\n' "$AW_RESULT_JSON"
  printf 'RUNTIME_ENV=%s\n' "$AW_RUNTIME_ENV"
  printf 'AGENT_GUIDE=%s/e2e-tests/AGENT_GUIDE.md\n' "$AW_PROJECT_ROOT"
  printf 'AGENT_WATCH_SPRING_LOG=tail -F %s/spring-boot-console.log\n' "$AW_LOG_DIR"
}

aw_require_equal() {
  local name="$1" expected="$2" actual="$3"
  if [[ "$actual" != "$expected" ]]; then
    printf 'ASSERTION_FAILED|%s|expected=%s|actual=%s\n' "$name" "$expected" "$actual" >&2
    return 1
  fi
}

aw_require_int_ge() {
  local name="$1" minimum="$2" actual="$3"
  if ! [[ "$actual" =~ ^[0-9]+$ ]] || (( actual < minimum )); then
    printf 'ASSERTION_FAILED|%s|minimum=%s|actual=%s\n' "$name" "$minimum" "$actual" >&2
    return 1
  fi
}

aw_json_require() {
  local path="$1" dotted_key="$2" expected="$3"
  python3 - "$path" "$dotted_key" "$expected" <<'PY'
import json
import sys

path, dotted_key, expected = sys.argv[1:]
with open(path, encoding="utf-8") as stream:
    current = json.load(stream)
for part in dotted_key.split("."):
    current = current[int(part)] if isinstance(current, list) else current[part]
if isinstance(current, bool):
    actual = "true" if current else "false"
elif current is None:
    actual = "null"
else:
    actual = str(current)
if actual != expected:
    print(
        f"ASSERTION_FAILED|json.{dotted_key}|expected={expected}|actual={actual}",
        file=sys.stderr,
    )
    sys.exit(1)
PY
}

aw_report_value() {
  local path="$1" key="$2"
  sed -n "s/^${key}=//p" "$path" | tail -n 1
}

aw_report_require_zero() {
  local path="$1" key="$2" actual
  actual="$(aw_report_value "$path" "$key")"
  aw_require_equal "report.$key" 0 "${actual:-missing}"
}
