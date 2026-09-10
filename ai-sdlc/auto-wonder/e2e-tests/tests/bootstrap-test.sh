#!/usr/bin/env bash

set -euo pipefail

TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
E2E_DIR="$(cd "$TEST_DIR/.." && pwd)"

fail() { printf 'FAIL %s\n' "$*" >&2; exit 1; }
assert_equal() { [[ "$1" == "$2" ]] || fail "expected '$1' to equal '$2'"; }
assert_file() { [[ -f "$1" ]] || fail "expected file: $1"; }
assert_not_file() { [[ ! -e "$1" ]] || fail "expected absent path: $1"; }
assert_contains() { grep -Fq -- "$2" "$1" || fail "expected $1 to contain: $2"; }

load_bootstrap() {
  [[ -f "$E2E_DIR/lib/bootstrap.sh" ]] || fail "bootstrap library missing: $E2E_DIR/lib/bootstrap.sh"
  # shellcheck source=../lib/lifecycle.sh
  source "$E2E_DIR/lib/lifecycle.sh"
  # shellcheck source=../lib/bootstrap.sh
  source "$E2E_DIR/lib/bootstrap.sh"
}

test_core() {
  local sandbox fake_bin old_path
  sandbox="$(mktemp -d "${TMPDIR:-/tmp}/aw-bootstrap-core.XXXXXX")"
  AW_TEST_SANDBOX="$sandbox"
  trap '[[ -z "${AW_TEST_SANDBOX:-}" ]] || rm -rf "$AW_TEST_SANDBOX"' EXIT
  fake_bin="$sandbox/bin"
  mkdir -p "$fake_bin"
  old_path="$PATH"
  load_bootstrap

  AW_BOOTSTRAP_OS_OVERRIDE=Darwin
  AW_BOOTSTRAP_ARCH_OVERRIDE=arm64
  AW_BOOTSTRAP_LOG="$sandbox/bootstrap.log"
  AW_BOOTSTRAP_STATE="$sandbox/bootstrap-state.tsv"
  AW_BOOTSTRAP_INSTALL=1
  export AW_BOOTSTRAP_OS_OVERRIDE AW_BOOTSTRAP_ARCH_OVERRIDE
  export AW_BOOTSTRAP_LOG AW_BOOTSTRAP_STATE AW_BOOTSTRAP_INSTALL
  aw_bootstrap_detect_host
  assert_equal macos "$AW_BOOTSTRAP_OS"
  assert_equal arm64 "$AW_BOOTSTRAP_ARCH"

  printf '#!/usr/bin/env bash\nprintf "tool version 1.2.3\\n"\n' >"$fake_bin/aw-tool"
  chmod +x "$fake_bin/aw-tool"
  PATH="$fake_bin:$old_path"
  export PATH
  probe_tool() { aw_bootstrap_command_version TEST_TOOL aw-tool --version; }
  install_tool() { : >"$sandbox/installer-called"; }
  aw_bootstrap_require TEST_TOOL probe_tool install_tool 'install aw-tool'
  assert_not_file "$sandbox/installer-called"
  assert_contains "$AW_BOOTSTRAP_STATE" $'TEST_TOOL\tREUSED\ttool version 1.2.3'

  probe_missing() { aw_bootstrap_command_version MISSING_TOOL missing-tool --version; }
  install_missing() { : >"$sandbox/missing-installer-called"; }
  AW_BOOTSTRAP_INSTALL=0
  if aw_bootstrap_require MISSING_TOOL probe_missing install_missing 'install missing-tool' >/dev/null 2>&1; then
    fail "--no-install accepted a missing capability"
  fi
  assert_equal INSTALL_DISABLED "$AW_BOOTSTRAP_LAST_FAILURE_KIND"
  assert_equal 'install missing-tool' "$AW_BOOTSTRAP_NEXT_COMMAND"
  assert_not_file "$sandbox/missing-installer-called"

  AW_BOOTSTRAP_INSTALL=1
  install_new_tool() {
    printf '#!/usr/bin/env bash\nprintf "new tool 9.0\\n"\n' >"$fake_bin/new-tool"
    chmod +x "$fake_bin/new-tool"
  }
  probe_new_tool() { aw_bootstrap_command_version NEW_TOOL new-tool --version; }
  aw_bootstrap_require NEW_TOOL probe_new_tool install_new_tool 'install new-tool'
  assert_contains "$AW_BOOTSTRAP_STATE" $'NEW_TOOL\tINSTALLED\tnew tool 9.0'

  printf '#!/usr/bin/env bash\nprintf "openjdk version \\"21.0.4\\" 2026-07-16\\n" >&2\n' >"$fake_bin/java"
  chmod +x "$fake_bin/java"
  aw_bootstrap_probe_java21 || fail "Java 21 probe rejected Java 21"
  assert_equal 'openjdk version "21.0.4" 2026-07-16' "$AW_BOOTSTRAP_DETECTED_VERSION"

  printf '#!/usr/bin/env bash\nprintf "openjdk version \\"17.0.12\\" 2026-07-16\\n" >&2\n' >"$fake_bin/java"
  chmod +x "$fake_bin/java"
  if aw_bootstrap_probe_java21; then
    fail "Java 21 probe accepted Java 17"
  fi

  printf '%s\n' '#!/usr/bin/env bash' \
    'case "${1:-}" in' \
    '  --version) printf "Docker version 28.0.1\\n" ;;' \
    '  compose) [[ "${2:-}" == version ]] && printf "Docker Compose version v2.35.0\\n" ;;' \
    '  buildx) [[ "${2:-}" == version ]] && printf "github.com/docker/buildx v0.23.0\\n" ;;' \
    '  *) exit 2 ;;' \
    'esac' >"$fake_bin/docker"
  chmod +x "$fake_bin/docker"
  aw_bootstrap_probe_docker_cli || fail "Docker CLI probe failed"
  aw_bootstrap_probe_compose_v2 || fail "Compose v2 probe failed"
  aw_bootstrap_probe_buildx || fail "Buildx probe failed"

  for probe in aw_bootstrap_probe_git aw_bootstrap_probe_curl \
    aw_bootstrap_probe_python3 aw_bootstrap_probe_openssl aw_bootstrap_probe_maven; do
    declare -F "$probe" >/dev/null || fail "missing capability probe: $probe"
  done
  declare -F aw_bootstrap_all >/dev/null || fail "missing bootstrap coordinator"

  AW_BOOTSTRAP_OS_OVERRIDE=Plan9
  if aw_bootstrap_detect_host >/dev/null 2>&1; then
    fail "unsupported host was accepted"
  fi
  assert_equal UNSUPPORTED_HOST "$AW_BOOTSTRAP_LAST_FAILURE_KIND"
  printf 'PASS bootstrap core\n'
}

test_macos() {
  local sandbox fake_bin old_path
  sandbox="$(mktemp -d "${TMPDIR:-/tmp}/aw-bootstrap-macos.XXXXXX")"
  AW_TEST_SANDBOX="$sandbox"
  trap '[[ -z "${AW_TEST_SANDBOX:-}" ]] || rm -rf "$AW_TEST_SANDBOX"' EXIT
  fake_bin="$sandbox/bin"
  mkdir -p "$fake_bin"
  old_path="$PATH"
  load_bootstrap

  AW_BOOTSTRAP_OS=macos
  AW_BOOTSTRAP_LOG="$sandbox/bootstrap.log"
  AW_BOOTSTRAP_STATE="$sandbox/bootstrap-state.tsv"
  AW_BOOTSTRAP_INSTALL=1
  AW_BOOTSTRAP_BREW="$fake_bin/brew"
  export AW_BOOTSTRAP_OS AW_BOOTSTRAP_LOG AW_BOOTSTRAP_STATE AW_BOOTSTRAP_INSTALL AW_BOOTSTRAP_BREW
  printf '#!/usr/bin/env bash\nprintf "%%s\\n" "$*" >>"$AW_TEST_BREW_CALLS"\n[[ "${1:-}" != "--prefix" ]] || printf "%%s\\n" "$AW_TEST_BREW_PREFIX"\n' >"$fake_bin/brew"
  chmod +x "$fake_bin/brew"
  AW_TEST_BREW_CALLS="$sandbox/brew.calls"
  AW_TEST_BREW_PREFIX="$sandbox/openjdk"
  export AW_TEST_BREW_CALLS AW_TEST_BREW_PREFIX

  aw_bootstrap_macos_install git
  aw_bootstrap_macos_install python3
  aw_bootstrap_macos_install java21
  aw_bootstrap_macos_install docker
  assert_contains "$AW_TEST_BREW_CALLS" 'install git'
  assert_contains "$AW_TEST_BREW_CALLS" 'install python'
  assert_contains "$AW_TEST_BREW_CALLS" 'install openjdk@21'
  assert_contains "$AW_TEST_BREW_CALLS" 'install --cask docker'
  [[ "$PATH" == "$AW_TEST_BREW_PREFIX/bin:"* ]] || fail "OpenJDK 21 bin was not prepended to PATH"

  rm -f "$fake_bin/brew"
  AW_BOOTSTRAP_BREW=""
  AW_TEST_BREW_TARGET="$fake_bin/brew"
  AW_BOOTSTRAP_BREW_INSTALLER="$fake_bin/install-brew"
  PATH="$fake_bin:$old_path"
  export AW_BOOTSTRAP_BREW AW_TEST_BREW_TARGET AW_BOOTSTRAP_BREW_INSTALLER PATH
  printf '#!/usr/bin/env bash\nprintf "#!/usr/bin/env bash\\nprintf \\\"Homebrew 4.6.0\\\\n\\\"\\n" >"$AW_TEST_BREW_TARGET"\nchmod +x "$AW_TEST_BREW_TARGET"\n' >"$fake_bin/install-brew"
  chmod +x "$fake_bin/install-brew"
  aw_bootstrap_macos_ensure_brew
  [[ -x "$AW_BOOTSTRAP_BREW" ]] || fail "Homebrew installer result was not discovered"

  printf '%s\n' '#!/usr/bin/env bash' \
    'if [[ "${1:-}" == version ]]; then' \
    '  count=0; [[ ! -f "$AW_TEST_DOCKER_COUNT" ]] || count="$(cat "$AW_TEST_DOCKER_COUNT")"' \
    '  count=$((count + 1)); printf "%s" "$count" >"$AW_TEST_DOCKER_COUNT"' \
    '  [[ "$count" -ge "${AW_TEST_DOCKER_READY_AT:-3}" ]] && { printf "server ready\\n"; exit 0; }' \
    '  exit 1' \
    'fi' \
    '[[ "${1:-}" == --version ]] && printf "Docker version 28.0.1\\n"' >"$fake_bin/docker"
  printf '#!/usr/bin/env bash\nprintf "%%s\\n" "$*" >>"$AW_TEST_OPEN_CALLS"\n' >"$fake_bin/open"
  printf '#!/usr/bin/env bash\nexit 0\n' >"$fake_bin/sleep"
  chmod +x "$fake_bin/docker" "$fake_bin/open" "$fake_bin/sleep"
  AW_TEST_DOCKER_COUNT="$sandbox/docker.count"
  AW_TEST_OPEN_CALLS="$sandbox/open.calls"
  AW_BOOTSTRAP_SLEEP="$fake_bin/sleep"
  AW_BOOTSTRAP_DOCKER_APP="$sandbox/Docker.app"
  AW_BOOTSTRAP_DOCKER_TIMEOUT=5
  mkdir -p "$AW_BOOTSTRAP_DOCKER_APP"
  export PATH AW_TEST_DOCKER_COUNT AW_TEST_OPEN_CALLS AW_BOOTSTRAP_SLEEP AW_BOOTSTRAP_DOCKER_APP AW_BOOTSTRAP_DOCKER_TIMEOUT
  unset AW_E2E_DOCKER AW_BOOTSTRAP_DOCKER
  aw_bootstrap_macos_ensure_docker_daemon
  assert_contains "$AW_TEST_OPEN_CALLS" '-a Docker'
  assert_equal 3 "$(cat "$AW_TEST_DOCKER_COUNT")"

  rm -f "$AW_TEST_DOCKER_COUNT" "$AW_TEST_OPEN_CALLS"
  AW_BOOTSTRAP_DOCKER_TIMEOUT=2
  AW_TEST_DOCKER_READY_AT=999
  export AW_TEST_DOCKER_READY_AT
  if aw_bootstrap_macos_ensure_docker_daemon >"$sandbox/docker-timeout.out" 2>&1; then
    fail "Docker daemon timeout unexpectedly passed"
  fi
  assert_equal DOCKER_START_TIMEOUT "$AW_BOOTSTRAP_LAST_FAILURE_KIND"
  assert_contains "$sandbox/docker-timeout.out" 'STEP|DOCKER_DAEMON|FAIL|failureKind=DOCKER_START_TIMEOUT'
  assert_contains "$AW_TEST_OPEN_CALLS" '-a Docker'

  rm -f "$AW_TEST_DOCKER_COUNT" "$AW_TEST_OPEN_CALLS"
  AW_BOOTSTRAP_INSTALL=0
  if aw_bootstrap_macos_ensure_docker_daemon >/dev/null 2>&1; then
    fail "stopped Docker daemon passed with installation disabled"
  fi
  assert_equal INSTALL_DISABLED "$AW_BOOTSTRAP_LAST_FAILURE_KIND"
  assert_not_file "$AW_TEST_OPEN_CALLS"
  printf 'PASS bootstrap macos\n'
}

test_centos() {
  local sandbox fake_bin old_path
  sandbox="$(mktemp -d "${TMPDIR:-/tmp}/aw-bootstrap-centos.XXXXXX")"
  AW_TEST_SANDBOX="$sandbox"
  trap '[[ -z "${AW_TEST_SANDBOX:-}" ]] || rm -rf "$AW_TEST_SANDBOX"' EXIT
  fake_bin="$sandbox/bin"
  mkdir -p "$fake_bin"
  old_path="$PATH"
  load_bootstrap

  AW_BOOTSTRAP_OS=centos
  AW_BOOTSTRAP_LOG="$sandbox/bootstrap.log"
  AW_BOOTSTRAP_STATE="$sandbox/bootstrap-state.tsv"
  AW_RUN_DIR="$sandbox/run"
  AW_TEST_CENTOS_CALLS="$sandbox/centos.calls"
  AW_BOOTSTRAP_UID_OVERRIDE=0
  mkdir -p "$AW_RUN_DIR"
  export AW_BOOTSTRAP_OS AW_BOOTSTRAP_LOG AW_BOOTSTRAP_STATE AW_RUN_DIR
  export AW_TEST_CENTOS_CALLS AW_BOOTSTRAP_UID_OVERRIDE
  printf '%s\n' '#!/usr/bin/env bash' \
    'printf "dnf %s\\n" "$*" >>"$AW_TEST_CENTOS_CALLS"' \
    '[[ "${AW_TEST_FAIL_OPENJDK:-}" == 1 && "$*" == *java-21-openjdk-devel* ]] && exit 1' \
    'exit 0' >"$fake_bin/dnf"
  printf '#!/usr/bin/env bash\nprintf "yum %%s\\n" "$*" >>"$AW_TEST_CENTOS_CALLS"\n' >"$fake_bin/yum"
  printf '#!/usr/bin/env bash\nprintf "systemctl %%s\\n" "$*" >>"$AW_TEST_CENTOS_CALLS"\n' >"$fake_bin/systemctl"
  printf '#!/usr/bin/env bash\nprintf "tee %%s\\n" "$*" >>"$AW_TEST_CENTOS_CALLS"\ncat >/dev/null\n' >"$fake_bin/tee"
  chmod +x "$fake_bin/dnf" "$fake_bin/yum" "$fake_bin/systemctl" "$fake_bin/tee"
  PATH="$fake_bin:$old_path"
  export PATH

  aw_bootstrap_centos_install git
  assert_contains "$AW_TEST_CENTOS_CALLS" 'dnf install -y git'
  if grep -Fq 'yum install' "$AW_TEST_CENTOS_CALLS"; then fail "yum used when dnf exists"; fi

  : >"$AW_TEST_CENTOS_CALLS"
  aw_bootstrap_centos_install docker
  assert_contains "$AW_TEST_CENTOS_CALLS" 'dnf install -y dnf-plugins-core'
  assert_contains "$AW_TEST_CENTOS_CALLS" 'dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo'
  assert_contains "$AW_TEST_CENTOS_CALLS" 'dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin'
  assert_contains "$AW_TEST_CENTOS_CALLS" 'systemctl enable --now docker'

  : >"$AW_TEST_CENTOS_CALLS"
  AW_TEST_FAIL_OPENJDK=1
  export AW_TEST_FAIL_OPENJDK
  aw_bootstrap_centos_install java21
  assert_contains "$AW_TEST_CENTOS_CALLS" 'dnf install -y java-21-openjdk-devel'
  assert_contains "$AW_TEST_CENTOS_CALLS" 'tee /etc/yum.repos.d/adoptium.repo'
  assert_contains "$AW_TEST_CENTOS_CALLS" 'dnf install -y temurin-21-jdk'
  unset AW_TEST_FAIL_OPENJDK

  rm -f "$fake_bin/dnf"
  unset AW_BOOTSTRAP_PACKAGE_MANAGER
  : >"$AW_TEST_CENTOS_CALLS"
  aw_bootstrap_centos_install curl
  assert_contains "$AW_TEST_CENTOS_CALLS" 'yum install -y curl'

  printf '%s\n' '#!/usr/bin/env bash' \
    'if [[ "${1:-}" == --version ]]; then printf "Docker version 28.0.1\\n"; exit 0; fi' \
    'if [[ "${1:-}" == version && "${AW_TEST_DIRECT_DOCKER:-}" == 1 ]]; then printf "server ready\\n"; exit 0; fi' \
    'if [[ "${1:-}" == version && "${AW_TEST_UNDER_SUDO:-}" == 1 ]]; then printf "server ready\\n"; exit 0; fi' \
    'exit 1' >"$fake_bin/docker"
  printf '%s\n' '#!/usr/bin/env bash' \
    'printf "sudo %s\\n" "$*" >>"$AW_TEST_CENTOS_CALLS"' \
    '[[ "${AW_TEST_SUDO_OK:-1}" == 1 ]] || exit 1' \
    '[[ "${1:-}" != -n ]] || shift' \
    '[[ "${1:-}" == -v ]] && exit 0' \
    'AW_TEST_UNDER_SUDO=1 exec "$@"' >"$fake_bin/sudo"
  chmod +x "$fake_bin/docker" "$fake_bin/sudo"
  AW_BOOTSTRAP_UID_OVERRIDE=1000
  AW_BOOTSTRAP_PRIVILEGE_READY=""
  AW_BOOTSTRAP_USE_SUDO=0
  AW_TEST_SUDO_OK=1
  export AW_BOOTSTRAP_UID_OVERRIDE AW_BOOTSTRAP_PRIVILEGE_READY AW_BOOTSTRAP_USE_SUDO AW_TEST_SUDO_OK
  unset AW_E2E_DOCKER AW_BOOTSTRAP_DOCKER
  aw_bootstrap_centos_select_docker_adapter
  [[ -x "$AW_E2E_DOCKER" ]] || fail "sudo Docker adapter was not created"
  assert_equal 700 "$(stat -f '%Lp' "$AW_E2E_DOCKER" 2>/dev/null || stat -c '%a' "$AW_E2E_DOCKER")"
  "$AW_E2E_DOCKER" version >/dev/null || fail "sudo Docker adapter does not reach daemon"
  assert_contains "$AW_TEST_CENTOS_CALLS" 'sudo -n -v'

  unset AW_E2E_DOCKER AW_BOOTSTRAP_DOCKER
  AW_TEST_DIRECT_DOCKER=1
  export AW_TEST_DIRECT_DOCKER
  aw_bootstrap_centos_select_docker_adapter
  assert_equal "$fake_bin/docker" "$AW_E2E_DOCKER"

  AW_TEST_SUDO_OK=0
  unset AW_TEST_DIRECT_DOCKER AW_E2E_DOCKER AW_BOOTSTRAP_DOCKER
  AW_BOOTSTRAP_PRIVILEGE_READY=""
  export AW_TEST_SUDO_OK AW_BOOTSTRAP_PRIVILEGE_READY
  if aw_bootstrap_centos_resolve_privilege >/dev/null 2>&1; then
    fail "CentOS provider accepted missing root/sudo"
  fi
  assert_equal SUDO_UNAVAILABLE "$AW_BOOTSTRAP_LAST_FAILURE_KIND"
  printf 'PASS bootstrap centos\n'
}

case "${1:-all}" in
  core) test_core ;;
  macos) test_macos ;;
  centos) test_centos ;;
  all) test_core; test_macos; test_centos ;;
  *) fail "unknown test group: $1" ;;
esac
