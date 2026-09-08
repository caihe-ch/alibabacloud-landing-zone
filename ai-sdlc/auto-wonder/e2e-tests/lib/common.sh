#!/usr/bin/env bash
# Shared helpers for the community end-to-end harness.
#
# Machine independence is a hard requirement: nothing here may assume a
# particular host, a particular docker install path, an unrestricted registry,
# or a pre-existing container runtime state. Every host-specific fact is
# discovered at run time or supplied through an AW_E2E_* variable.

set -euo pipefail

E2E_DIR="${E2E_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
REPO_ROOT="${REPO_ROOT:-$(cd "$E2E_DIR/.." && pwd)}"

# ---------------------------------------------------------------------------
# Knobs. Defaults are the values the community compose file already uses, so
# an unset environment means "run the documented thing".
# ---------------------------------------------------------------------------
AW_E2E_PROJECT="${AW_E2E_PROJECT:-aw-e2e}"
AW_E2E_NETWORK="${AW_E2E_NETWORK:-${AW_E2E_PROJECT}-net}"
AW_E2E_STATE_DIR="${AW_E2E_STATE_DIR:-${TMPDIR:-/tmp}/aw-e2e-${AW_E2E_PROJECT}}"

AW_E2E_MYSQL_PORT="${AW_E2E_MYSQL_PORT:-33060}"
AW_E2E_REDIS_PORT="${AW_E2E_REDIS_PORT:-63790}"
AW_E2E_MINIO_PORT="${AW_E2E_MINIO_PORT:-9000}"
AW_E2E_MINIO_CONSOLE_PORT="${AW_E2E_MINIO_CONSOLE_PORT:-9001}"
AW_E2E_APP_PORT="${AW_E2E_APP_PORT:-7001}"

AW_E2E_MYSQL_IMAGE="${AW_E2E_MYSQL_IMAGE:-mysql:8.0}"
AW_E2E_REDIS_IMAGE="${AW_E2E_REDIS_IMAGE:-redis:7-alpine}"
AW_E2E_MINIO_IMAGE="${AW_E2E_MINIO_IMAGE:-quay.io/minio/minio:latest}"
AW_E2E_MC_IMAGE="${AW_E2E_MC_IMAGE:-quay.io/minio/mc:latest}"

# Public mirror of the Docker Official Images, used only when the primary
# registry is unreachable. This is a public AWS endpoint, not an internal one.
AW_E2E_OFFICIAL_IMAGE_MIRROR="${AW_E2E_OFFICIAL_IMAGE_MIRROR:-public.ecr.aws/docker/library}"

AW_E2E_BUCKET="${AW_E2E_BUCKET:-aw-e2e-autowonder}"
AW_E2E_MINIO_ROOT_USER="${AW_E2E_MINIO_ROOT_USER:-aw-e2e-minio}"

# Compose file defaults are the community file plus the end-to-end layer.
AW_E2E_BASE_COMPOSE="${AW_E2E_BASE_COMPOSE:-$REPO_ROOT/docs/community/docker-compose.dependencies.yml}"
AW_E2E_LAYER_COMPOSE="${AW_E2E_LAYER_COMPOSE:-$E2E_DIR/compose.e2e.yml}"

# Every variable compose.e2e.yml interpolates has to be *exported*. Compose reads
# the process environment, not the shell's variable table, so an unexported knob
# makes compose fall back to its own default while the scripts keep using the real
# value - the two then disagree about the network name and `docker run --network`
# fails with "network not found" after a perfectly healthy `up`.
export AW_E2E_PROJECT AW_E2E_NETWORK AW_E2E_STATE_DIR
export AW_E2E_MYSQL_PORT AW_E2E_REDIS_PORT
export AW_E2E_MINIO_PORT AW_E2E_MINIO_CONSOLE_PORT AW_E2E_APP_PORT
export AW_E2E_MYSQL_IMAGE AW_E2E_REDIS_IMAGE AW_E2E_MINIO_IMAGE AW_E2E_MC_IMAGE
export AW_E2E_BUCKET AW_E2E_MINIO_ROOT_USER

log() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*"; }
die() { printf 'FATAL: %s\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Runtime discovery
# ---------------------------------------------------------------------------

# Prints the docker binary to use. Prefers $AW_E2E_DOCKER, then PATH, then the
# well-known per-user install location that Docker Desktop creates on macOS.
aw_e2e_find_docker() {
  if [[ -n "${AW_E2E_DOCKER:-}" ]]; then
    [[ -x "$AW_E2E_DOCKER" ]] || die "AW_E2E_DOCKER=$AW_E2E_DOCKER is not executable"
    printf '%s' "$AW_E2E_DOCKER"
    return
  fi
  if command -v docker >/dev/null 2>&1; then
    command -v docker
    return
  fi
  local candidate
  for candidate in \
    "$HOME/.docker/bin/docker" \
    /usr/local/bin/docker \
    /Applications/Docker.app/Contents/Resources/bin/docker; do
    if [[ -x "$candidate" ]]; then printf '%s' "$candidate"; return; fi
  done
  die "no docker binary found; set AW_E2E_DOCKER=/path/to/docker"
}

# Docker reads credsStore from ~/.docker/config.json and execs
# docker-credential-<store>. Docker Desktop puts that helper in its own
# resource directory, which is frequently absent from PATH in non-interactive
# shells; every pull then fails with "error getting credentials". Put it back.
aw_e2e_fix_credential_helper() {
  local cfg="$HOME/.docker/config.json" store helper dir
  [[ -f "$cfg" ]] || return 0
  store="$(python3 - "$cfg" <<'PY' 2>/dev/null || true
import json,sys
try:
    print(json.load(open(sys.argv[1])).get("credsStore") or "")
except Exception:
    print("")
PY
)"
  [[ -n "$store" ]] || return 0
  helper="docker-credential-$store"
  command -v "$helper" >/dev/null 2>&1 && return 0
  for dir in \
    /Applications/Docker.app/Contents/Resources/bin \
    "$HOME/.docker/bin" \
    /usr/local/bin; do
    if [[ -x "$dir/$helper" ]]; then
      export PATH="$dir:$PATH"
      log "credential helper $helper was missing from PATH; added $dir"
      return 0
    fi
  done
  log "WARNING: credsStore=$store but $helper not found; pulls may fail"
}

# Exports DOCKER_HOST when the daemon is not reachable on the default socket.
aw_e2e_export_docker_host() {
  if [[ -n "${DOCKER_HOST:-}" ]]; then
    "$DOCKER" version >/dev/null 2>&1 && return 0
    log "DOCKER_HOST=$DOCKER_HOST does not answer; probing alternatives"
  fi
  "$DOCKER" version >/dev/null 2>&1 && return 0
  local sock
  for sock in \
    "$HOME/.docker/run/docker.sock" \
    /var/run/docker.sock \
    "$HOME/.colima/default/docker.sock" \
    "$HOME/.rd/docker.sock"; do
    if [[ -S "$sock" ]]; then
      export DOCKER_HOST="unix://$sock"
      if "$DOCKER" version >/dev/null 2>&1; then
        log "DOCKER_HOST set to unix://$sock"
        return 0
      fi
    fi
  done
  die "no answering docker daemon; start one or set DOCKER_HOST"
}

aw_e2e_init_runtime() {
  DOCKER="$(aw_e2e_find_docker)"
  export DOCKER
  aw_e2e_fix_credential_helper
  aw_e2e_export_docker_host
  DOCKER_SERVER_VERSION="$("$DOCKER" version --format '{{.Server.Version}}' 2>/dev/null || echo unknown)"
  DOCKER_MIN_API="$("$DOCKER" version --format '{{.Server.MinAPIVersion}}' 2>/dev/null || echo unknown)"
  log "docker binary=$DOCKER server=$DOCKER_SERVER_VERSION minAPI=$DOCKER_MIN_API"
}

# ---------------------------------------------------------------------------
# Images
# ---------------------------------------------------------------------------

# Proves that a tag really runs under a pinned platform, instead of trusting
# `docker image inspect`. Under the containerd image store a tag resolves to a
# manifest index whose Architecture field is empty or shows the host
# architecture, even when the pinned platform is materialised and runnable -
# and compose, which does check the pin, will then go to the registry for an
# image that is already here. Running it is the only decisive test.
aw_e2e_platform_uname() {
  local image="$1" platform="$2"
  "$DOCKER" image inspect "$image" >/dev/null 2>&1 || return 1
  if [[ -n "$platform" ]]; then
    "$DOCKER" run --rm --platform "$platform" --entrypoint /bin/sh "$image" -c 'uname -m' 2>/dev/null
  else
    "$DOCKER" run --rm --entrypoint /bin/sh "$image" -c 'uname -m' 2>/dev/null
  fi
}

aw_e2e_expected_uname() {
  case "$1" in
    linux/amd64) printf 'x86_64' ;;
    linux/arm64) printf 'aarch64' ;;
    *) printf '' ;;
  esac
}

# aw_e2e_ensure_image <wanted-ref> <platform|-> [mirror-ref...]
# Leaves <wanted-ref> present locally AND runnable as <platform>, pulling from a
# mirror and retagging when the primary registry is unreachable. Never rewrites
# the community compose file: the compose file keeps naming the image it always
# named, so the mirror fallback stays invisible to the thing under test.
aw_e2e_ensure_image() {
  local wanted="$1" platform="$2"; shift 2
  if [[ "$platform" == "-" ]]; then platform=""; fi
  local slug expected got pull_rc
  slug="$(printf '%s' "$wanted" | tr '/:' '__')"
  expected="$(aw_e2e_expected_uname "$platform")"

  got="$(aw_e2e_platform_uname "$wanted" "$platform" || true)"
  if [[ -n "$got" && ( -z "$expected" || "$got" == "$expected" ) ]]; then
    log "image ready: $wanted (runs as ${platform:-host}, uname -m=$got)"
    return 0
  fi
  if "$DOCKER" image inspect "$wanted" >/dev/null 2>&1; then
    log "image $wanted is present but not runnable as ${platform:-host} (uname='${got:-none}'); pulling"
  fi

  local ref
  for ref in "$wanted" "$@"; do
    log "pulling $ref${platform:+ for $platform}"
    # The status has to be captured inline: a bare failing pull inside this
    # if-body would trip the caller's `set -e` and end the script before the
    # mirror fallback below ever ran.
    pull_rc=0
    if [[ -n "$platform" ]]; then
      "$DOCKER" pull --platform "$platform" "$ref" >"$AW_E2E_STATE_DIR/pull-$slug.log" 2>&1 || pull_rc=$?
    else
      "$DOCKER" pull "$ref" >"$AW_E2E_STATE_DIR/pull-$slug.log" 2>&1 || pull_rc=$?
    fi
    if [[ "$pull_rc" == "0" ]]; then
      if [[ "$ref" != "$wanted" ]]; then
        "$DOCKER" tag "$ref" "$wanted"
        log "retagged $ref -> $wanted (primary registry unreachable)"
      fi
      got="$(aw_e2e_platform_uname "$wanted" "$platform" || true)"
      if [[ -n "$got" && ( -z "$expected" || "$got" == "$expected" ) ]]; then
        log "image ready: $wanted (runs as ${platform:-host}, uname -m=$got)"
        return 0
      fi
      log "pulled $ref but it still does not run as ${platform:-host} (uname='${got:-none}'); trying next source"
      continue
    fi
    log "pull failed for $ref (exit $pull_rc); trying next source"
  done
  die "could not obtain image $wanted from any of: $wanted $*"
}

# Prints a mirror candidate for a Docker Official Image such as mysql:8.0.
aw_e2e_official_mirror() {
  case "$1" in
    */*) return 1 ;;                       # not an official image
    *) printf '%s/%s' "$AW_E2E_OFFICIAL_IMAGE_MIRROR" "$1" ;;
  esac
}

# ---------------------------------------------------------------------------
# Ports and state
# ---------------------------------------------------------------------------

aw_e2e_port_listeners() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null | tail -n +2 | wc -l | tr -d ' '
  else
    (ss -ltn "sport = :$port" 2>/dev/null | tail -n +2 | wc -l | tr -d ' ') \
      || printf '0'
  fi
}

aw_e2e_first_free_port() {
  local start="${1:-39000}" p
  for ((p = start; p < start + 400; p++)); do
    [[ "$(aw_e2e_port_listeners "$p")" == "0" ]] && { printf '%s' "$p"; return; }
  done
  die "no free port found from $start"
}

aw_e2e_prepare_state_dir() {
  mkdir -p "$AW_E2E_STATE_DIR"
  chmod 700 "$AW_E2E_STATE_DIR"
}

# ---------------------------------------------------------------------------
# Secrets. Generated per run, 0600, never printed, deleted by down.sh.
# ---------------------------------------------------------------------------
aw_e2e_generate_secrets() {
  local f="$AW_E2E_STATE_DIR/secrets.env"
  if [[ -f "$f" ]]; then log "reusing existing secrets.env"; return 0; fi
  command -v openssl >/dev/null 2>&1 || die "openssl is required to generate secrets"
  {
    printf 'AUTOWONDER_SECRET_MASTER_KEY=%s\n' "$(openssl rand -base64 32)"
    printf 'AUTOWONDER_JWT_SECRET=%s\n' "$(openssl rand -base64 48)"
    printf 'AW_E2E_MINIO_ROOT_PASSWORD=%s\n' "$(openssl rand -base64 24)"
  } >"$f"
  chmod 600 "$f"
  log "generated 3 secrets into $f (mode 600)"
}

# Reads one key out of secrets.env without echoing it.
aw_e2e_secret() {
  local key="$1"
  sed -n "s|^${key}=||p" "$AW_E2E_STATE_DIR/secrets.env" | head -1
}

# ---------------------------------------------------------------------------
# Compose
# ---------------------------------------------------------------------------

# Resolves the compose file arguments into the global AW_E2E_COMPOSE_ARGS array.
# The community file is used byte-for-byte unless a host port it hardcodes is
# already taken, or the caller explicitly asked for different ports; in that
# case a derived copy with only the host port numbers substituted is placed in
# the state directory. The substitution is reported so the evidence states
# which file actually ran.
#
# This is a resolver that sets globals, not a printer: a caller that captured
# its output with $(...) would run it in a subshell and silently lose
# RESOLVED_MYSQL_PORT, RESOLVED_REDIS_PORT and COMPOSE_BASE_MODE.
AW_E2E_COMPOSE_ARGS=()
aw_e2e_resolve_compose() {
  [[ "${#AW_E2E_COMPOSE_ARGS[@]}" -gt 0 ]] && return 0
  local base="$AW_E2E_BASE_COMPOSE" derived="$AW_E2E_STATE_DIR/dependencies.derived.yml"
  local need_derive=0 mysql_port="$AW_E2E_MYSQL_PORT" redis_port="$AW_E2E_REDIS_PORT"

  grep -q "\"$mysql_port:3306\"" "$base" || need_derive=1
  grep -q "\"$redis_port:6379\"" "$base" || need_derive=1
  if [[ "$(aw_e2e_port_listeners "$mysql_port")" != "0" ]]; then
    mysql_port="$(aw_e2e_first_free_port 39060)"; need_derive=1
    log "host port $AW_E2E_MYSQL_PORT busy; remapping mysql to $mysql_port"
  fi
  if [[ "$(aw_e2e_port_listeners "$redis_port")" != "0" ]]; then
    redis_port="$(aw_e2e_first_free_port 39160)"; need_derive=1
    log "host port $AW_E2E_REDIS_PORT busy; remapping redis to $redis_port"
  fi

  if [[ "$need_derive" == "1" ]]; then
    sed -e "s|\"[0-9]*:3306\"|\"$mysql_port:3306\"|" \
        -e "s|\"[0-9]*:6379\"|\"$redis_port:6379\"|" \
        "$base" >"$derived"
    AW_E2E_COMPOSE_ARGS=(-f "$derived" -f "$AW_E2E_LAYER_COMPOSE")
    COMPOSE_BASE_MODE="derived (host ports substituted; community file unchanged on disk)"
  else
    AW_E2E_COMPOSE_ARGS=(-f "$base" -f "$AW_E2E_LAYER_COMPOSE")
    COMPOSE_BASE_MODE="verbatim"
  fi
  RESOLVED_MYSQL_PORT="$mysql_port"
  RESOLVED_REDIS_PORT="$redis_port"
  export RESOLVED_MYSQL_PORT RESOLVED_REDIS_PORT COMPOSE_BASE_MODE

  # Persist the resolution so smoke.sh and down.sh replay exactly what up.sh
  # used instead of re-deriving it and possibly landing on different ports.
  {
    printf 'RESOLVED_MYSQL_PORT=%s\n' "$RESOLVED_MYSQL_PORT"
    printf 'RESOLVED_REDIS_PORT=%s\n' "$RESOLVED_REDIS_PORT"
    printf 'AW_E2E_COMPOSE_ARGS=(%s)\n' "$(printf '%q ' "${AW_E2E_COMPOSE_ARGS[@]}")"
  } >"$AW_E2E_STATE_DIR/resolved.env"
}

# Loads a previous resolution written by aw_e2e_resolve_compose.
aw_e2e_load_resolved() {
  [[ -f "$AW_E2E_STATE_DIR/resolved.env" ]] || return 1
  # shellcheck disable=SC1091
  source "$AW_E2E_STATE_DIR/resolved.env"
  return 0
}

aw_e2e_compose() {
  aw_e2e_resolve_compose
  # compose.e2e.yml declares MINIO_ROOT_PASSWORD as a required interpolation,
  # and compose re-parses every file for every subcommand - including exec and
  # ps - so the value has to be present for all of them, not just up.
  if [[ -z "${AW_E2E_MINIO_ROOT_PASSWORD:-}" && -f "$AW_E2E_STATE_DIR/secrets.env" ]]; then
    AW_E2E_MINIO_ROOT_PASSWORD="$(aw_e2e_secret AW_E2E_MINIO_ROOT_PASSWORD)"
    export AW_E2E_MINIO_ROOT_PASSWORD
  fi
  "$DOCKER" compose -p "$AW_E2E_PROJECT" "${AW_E2E_COMPOSE_ARGS[@]}" "$@"
}
