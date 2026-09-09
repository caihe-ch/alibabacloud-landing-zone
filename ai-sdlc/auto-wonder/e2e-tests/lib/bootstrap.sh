#!/usr/bin/env bash

# Host prerequisite discovery and installation for verify.sh. This library is
# sourced after lifecycle.sh and intentionally returns failures instead of
# exiting so the caller can always write a structured lifecycle end event.

AW_BOOTSTRAP_INSTALL="${AW_BOOTSTRAP_INSTALL:-1}"
AW_BOOTSTRAP_DOCKER_TIMEOUT="${AW_BOOTSTRAP_DOCKER_TIMEOUT:-180}"
AW_BOOTSTRAP_LOG="${AW_BOOTSTRAP_LOG:-${TMPDIR:-/tmp}/aw-e2e-bootstrap.log}"
AW_BOOTSTRAP_STATE="${AW_BOOTSTRAP_STATE:-${TMPDIR:-/tmp}/aw-e2e-bootstrap-state.tsv}"
AW_BOOTSTRAP_LAST_FAILURE_KIND=""
AW_BOOTSTRAP_LAST_FAILURE_SUMMARY=""
AW_BOOTSTRAP_NEXT_COMMAND=""
AW_BOOTSTRAP_DETECTED_VERSION=""
AW_BOOTSTRAP_PRIVILEGE=()
AW_BOOTSTRAP_PRIVILEGE_READY="${AW_BOOTSTRAP_PRIVILEGE_READY:-}"
AW_BOOTSTRAP_USE_SUDO="${AW_BOOTSTRAP_USE_SUDO:-0}"

aw_bootstrap_prepare() {
  mkdir -p "$(dirname "$AW_BOOTSTRAP_LOG")" "$(dirname "$AW_BOOTSTRAP_STATE")"
  touch "$AW_BOOTSTRAP_LOG" "$AW_BOOTSTRAP_STATE"
}

aw_bootstrap_fail() {
  local kind="$1" summary="$2" next_command="${3:-}"
  AW_BOOTSTRAP_LAST_FAILURE_KIND="$kind"
  AW_BOOTSTRAP_LAST_FAILURE_SUMMARY="$summary"
  AW_BOOTSTRAP_NEXT_COMMAND="$next_command"
  export AW_BOOTSTRAP_LAST_FAILURE_KIND AW_BOOTSTRAP_LAST_FAILURE_SUMMARY
  export AW_BOOTSTRAP_NEXT_COMMAND
  return 1
}

aw_bootstrap_record() {
  local capability="$1" action="$2" version="$3"
  aw_bootstrap_prepare
  printf '%s\t%s\t%s\n' "$capability" "$action" "$version" >>"$AW_BOOTSTRAP_STATE"
}

aw_bootstrap_detect_host() {
  local kernel os_release id=""
  kernel="${AW_BOOTSTRAP_OS_OVERRIDE:-$(uname -s)}"
  AW_BOOTSTRAP_ARCH="${AW_BOOTSTRAP_ARCH_OVERRIDE:-$(uname -m)}"
  case "$kernel" in
    Darwin) AW_BOOTSTRAP_OS=macos ;;
    Linux)
      os_release="${AW_BOOTSTRAP_OS_RELEASE:-/etc/os-release}"
      if [[ -r "$os_release" ]]; then
        id="$(sed -n 's/^ID=//p' "$os_release" | head -1 | tr -d '\"')"
      fi
      case "$id" in
        centos) AW_BOOTSTRAP_OS=centos ;;
        *) aw_bootstrap_fail UNSUPPORTED_HOST "Unsupported Linux distribution: ${id:-unknown}" "Use macOS or CentOS"; return 1 ;;
      esac
      ;;
    *) aw_bootstrap_fail UNSUPPORTED_HOST "Unsupported operating system: $kernel" "Use macOS or CentOS"; return 1 ;;
  esac
  export AW_BOOTSTRAP_OS AW_BOOTSTRAP_ARCH
}

aw_bootstrap_command_version() {
  local capability="$1" command_name="$2"
  shift 2
  command -v "$command_name" >/dev/null 2>&1 || return 1
  AW_BOOTSTRAP_DETECTED_VERSION="$("$command_name" "$@" 2>&1 | head -1)" || return 1
  [[ -n "$AW_BOOTSTRAP_DETECTED_VERSION" ]] || return 1
  export AW_BOOTSTRAP_DETECTED_VERSION
  return 0
}

aw_bootstrap_probe_git() {
  aw_bootstrap_command_version GIT git --version
}

aw_bootstrap_probe_curl() {
  aw_bootstrap_command_version CURL curl --version
}

aw_bootstrap_probe_python3() {
  aw_bootstrap_command_version PYTHON3 python3 --version
}

aw_bootstrap_probe_openssl() {
  aw_bootstrap_command_version OPENSSL openssl version
}

aw_bootstrap_probe_maven() {
  aw_bootstrap_command_version MAVEN mvn --version
}

aw_bootstrap_probe_java21() {
  local java_output java_major
  command -v java >/dev/null 2>&1 || return 1
  java_output="$(java -version 2>&1 | head -1)" || return 1
  java_major="$(printf '%s\n' "$java_output" | sed -n 's/.*version "\([0-9][0-9]*\)\..*/\1/p')"
  [[ "$java_major" == "21" ]] || return 1
  AW_BOOTSTRAP_DETECTED_VERSION="$java_output"
  export AW_BOOTSTRAP_DETECTED_VERSION
}

aw_bootstrap_resolve_docker() {
  local candidate
  if [[ -n "${AW_E2E_DOCKER:-}" && -x "$AW_E2E_DOCKER" ]]; then
    AW_BOOTSTRAP_DOCKER="$AW_E2E_DOCKER"
  else
    AW_BOOTSTRAP_DOCKER="$(command -v docker 2>/dev/null)" || AW_BOOTSTRAP_DOCKER=""
    if [[ -z "$AW_BOOTSTRAP_DOCKER" ]]; then
      for candidate in "$HOME/.docker/bin/docker" /usr/local/bin/docker \
        /Applications/Docker.app/Contents/Resources/bin/docker; do
        [[ -x "$candidate" ]] && { AW_BOOTSTRAP_DOCKER="$candidate"; break; }
      done
    fi
    [[ -n "$AW_BOOTSTRAP_DOCKER" ]] || return 1
  fi
  export AW_BOOTSTRAP_DOCKER
}

aw_bootstrap_probe_docker_cli() {
  aw_bootstrap_resolve_docker || return 1
  AW_BOOTSTRAP_DETECTED_VERSION="$("$AW_BOOTSTRAP_DOCKER" --version 2>&1 | head -1)" || return 1
  [[ -n "$AW_BOOTSTRAP_DETECTED_VERSION" ]] || return 1
  export AW_BOOTSTRAP_DETECTED_VERSION
}

aw_bootstrap_probe_compose_v2() {
  aw_bootstrap_resolve_docker || return 1
  AW_BOOTSTRAP_DETECTED_VERSION="$("$AW_BOOTSTRAP_DOCKER" compose version 2>&1 | head -1)" || return 1
  [[ "$AW_BOOTSTRAP_DETECTED_VERSION" == *"Docker Compose"* ]] || return 1
  export AW_BOOTSTRAP_DETECTED_VERSION
}

aw_bootstrap_probe_buildx() {
  aw_bootstrap_resolve_docker || return 1
  AW_BOOTSTRAP_DETECTED_VERSION="$("$AW_BOOTSTRAP_DOCKER" buildx version 2>&1 | head -1)" || return 1
  [[ -n "$AW_BOOTSTRAP_DETECTED_VERSION" ]] || return 1
  export AW_BOOTSTRAP_DETECTED_VERSION
}

aw_bootstrap_macos_find_brew() {
  local candidate
  if [[ -n "${AW_BOOTSTRAP_BREW:-}" && -x "$AW_BOOTSTRAP_BREW" ]]; then
    return 0
  fi
  candidate="$(command -v brew 2>/dev/null)" || candidate=""
  if [[ -z "$candidate" ]]; then
    for candidate in /opt/homebrew/bin/brew /usr/local/bin/brew; do
      [[ -x "$candidate" ]] && break
      candidate=""
    done
  fi
  [[ -n "$candidate" ]] || return 1
  AW_BOOTSTRAP_BREW="$candidate"
  export AW_BOOTSTRAP_BREW
}

aw_bootstrap_macos_ensure_brew() {
  local installer_file
  aw_bootstrap_macos_find_brew && return 0
  if [[ "$AW_BOOTSTRAP_INSTALL" != "1" ]]; then
    aw_bootstrap_fail INSTALL_DISABLED "Homebrew is missing and automatic installation is disabled" \
      'Install Homebrew from https://brew.sh'
    return 1
  fi
  aw_step_event HOMEBREW INSTALLING "log=$AW_BOOTSTRAP_LOG"
  if [[ -n "${AW_BOOTSTRAP_BREW_INSTALLER:-}" ]]; then
    "$AW_BOOTSTRAP_BREW_INSTALLER" >>"$AW_BOOTSTRAP_LOG" 2>&1 || {
      aw_bootstrap_fail INSTALL_FAILED "Homebrew installation failed" 'Install Homebrew from https://brew.sh'
      return 1
    }
  else
    command -v curl >/dev/null 2>&1 || {
      aw_bootstrap_fail INSTALL_FAILED "curl is required to install Homebrew" 'Install curl and retry'
      return 1
    }
    installer_file="$(mktemp "${TMPDIR:-/tmp}/aw-homebrew-install.XXXXXX")" || return 1
    if ! curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh \
      -o "$installer_file" >>"$AW_BOOTSTRAP_LOG" 2>&1; then
      rm -f "$installer_file"
      aw_bootstrap_fail INSTALL_FAILED "Unable to download the official Homebrew installer" 'Install Homebrew from https://brew.sh'
      return 1
    fi
    if ! NONINTERACTIVE=1 /bin/bash "$installer_file" >>"$AW_BOOTSTRAP_LOG" 2>&1; then
      rm -f "$installer_file"
      aw_bootstrap_fail INSTALL_FAILED "Homebrew installation failed" 'Install Homebrew from https://brew.sh'
      return 1
    fi
    rm -f "$installer_file"
  fi
  aw_bootstrap_macos_find_brew || {
    aw_bootstrap_fail INSTALL_VERIFICATION_FAILED "Homebrew installed but cannot be discovered" 'Ensure brew is on PATH'
    return 1
  }
  aw_bootstrap_record HOMEBREW INSTALLED "$("$AW_BOOTSTRAP_BREW" --version 2>&1 | head -1)"
  aw_step_event HOMEBREW PASS "action=INSTALLED"
}

aw_bootstrap_macos_install() {
  local capability="$1" package="" java_prefix=""
  aw_bootstrap_macos_ensure_brew || return 1
  case "$capability" in
    git) package=git ;;
    curl) package=curl ;;
    python3) package=python ;;
    openssl) package=openssl@3 ;;
    java21) package=openjdk@21 ;;
    maven) package=maven ;;
    docker|compose_v2|buildx)
      "$AW_BOOTSTRAP_BREW" install --cask docker
      return $?
      ;;
    *) aw_bootstrap_fail INSTALL_FAILED "Unknown macOS capability: $capability" 'Update the E2E bootstrap provider'; return 1 ;;
  esac
  "$AW_BOOTSTRAP_BREW" install "$package" || return 1
  if [[ "$capability" == java21 ]]; then
    java_prefix="$("$AW_BOOTSTRAP_BREW" --prefix openjdk@21 2>/dev/null)" || return 1
    PATH="$java_prefix/bin:$PATH"
    export PATH
  fi
}

aw_bootstrap_docker_server_ready() {
  aw_bootstrap_resolve_docker || return 1
  "$AW_BOOTSTRAP_DOCKER" version >>"$AW_BOOTSTRAP_LOG" 2>&1
}

aw_bootstrap_macos_ensure_docker_daemon() {
  local elapsed=0 docker_app sleep_command
  aw_bootstrap_prepare
  if aw_bootstrap_docker_server_ready; then
    aw_bootstrap_record DOCKER_DAEMON REUSED ready
    aw_step_event DOCKER_DAEMON PASS "action=REUSED"
    return 0
  fi
  if [[ "$AW_BOOTSTRAP_INSTALL" != "1" ]]; then
    aw_bootstrap_fail INSTALL_DISABLED "Docker Desktop is not running and automatic host changes are disabled" 'open -a Docker' || true
    aw_step_event DOCKER_DAEMON FAIL "failureKind=INSTALL_DISABLED|log=$AW_BOOTSTRAP_LOG"
    return 1
  fi
  docker_app="${AW_BOOTSTRAP_DOCKER_APP:-/Applications/Docker.app}"
  if [[ ! -d "$docker_app" ]]; then
    aw_step_event DOCKER_DESKTOP INSTALLING "log=$AW_BOOTSTRAP_LOG"
    if ! aw_bootstrap_macos_install docker >>"$AW_BOOTSTRAP_LOG" 2>&1; then
      aw_step_event DOCKER_DAEMON FAIL \
        "failureKind=${AW_BOOTSTRAP_LAST_FAILURE_KIND:-INSTALL_FAILED}|log=$AW_BOOTSTRAP_LOG"
      return 1
    fi
  fi
  aw_step_event DOCKER_DAEMON STARTING "command=open -a Docker|timeout=${AW_BOOTSTRAP_DOCKER_TIMEOUT}s|log=$AW_BOOTSTRAP_LOG"
  if ! open -a Docker >>"$AW_BOOTSTRAP_LOG" 2>&1; then
    aw_bootstrap_fail DOCKER_START_FAILED "Docker Desktop could not be opened" 'open -a Docker' || true
    aw_step_event DOCKER_DAEMON FAIL "failureKind=DOCKER_START_FAILED|log=$AW_BOOTSTRAP_LOG"
    return 1
  fi
  sleep_command="${AW_BOOTSTRAP_SLEEP:-sleep}"
  while [[ "$elapsed" -lt "$AW_BOOTSTRAP_DOCKER_TIMEOUT" ]]; do
    if aw_bootstrap_docker_server_ready; then
      aw_bootstrap_record DOCKER_DAEMON STARTED ready
      aw_step_event DOCKER_DAEMON PASS "action=STARTED|elapsed=${elapsed}s"
      return 0
    fi
    "$sleep_command" 1
    elapsed=$((elapsed + 1))
    if [[ "$elapsed" -gt 0 && $((elapsed % 10)) -eq 0 ]]; then
      aw_step_event DOCKER_DAEMON WAITING "elapsed=${elapsed}s|timeout=${AW_BOOTSTRAP_DOCKER_TIMEOUT}s|log=$AW_BOOTSTRAP_LOG"
    fi
  done
  aw_bootstrap_fail DOCKER_START_TIMEOUT \
    "Docker Desktop did not become ready within ${AW_BOOTSTRAP_DOCKER_TIMEOUT}s" 'open -a Docker' || true
  aw_step_event DOCKER_DAEMON FAIL "failureKind=DOCKER_START_TIMEOUT|log=$AW_BOOTSTRAP_LOG"
  return 1
}

aw_bootstrap_centos_resolve_privilege() {
  local uid
  [[ "$AW_BOOTSTRAP_PRIVILEGE_READY" == 1 ]] && return 0
  uid="${AW_BOOTSTRAP_UID_OVERRIDE:-$(id -u)}"
  if [[ "$uid" == 0 ]]; then
    AW_BOOTSTRAP_PRIVILEGE=()
    AW_BOOTSTRAP_USE_SUDO=0
  elif command -v sudo >/dev/null 2>&1 && sudo -n -v >>"$AW_BOOTSTRAP_LOG" 2>&1; then
    AW_BOOTSTRAP_PRIVILEGE=(sudo)
    AW_BOOTSTRAP_USE_SUDO=1
  else
    aw_bootstrap_fail SUDO_UNAVAILABLE "CentOS prerequisite installation requires root or working sudo" \
      'Run as root or configure non-interactive sudo, then retry'
    return 1
  fi
  AW_BOOTSTRAP_PRIVILEGE_READY=1
  export AW_BOOTSTRAP_PRIVILEGE_READY AW_BOOTSTRAP_USE_SUDO
}

aw_bootstrap_centos_privileged() {
  if [[ "$AW_BOOTSTRAP_USE_SUDO" == 1 ]]; then
    sudo "$@"
  else
    "$@"
  fi
}

aw_bootstrap_centos_find_package_manager() {
  if [[ -n "${AW_BOOTSTRAP_PACKAGE_MANAGER:-}" && -x "$AW_BOOTSTRAP_PACKAGE_MANAGER" ]]; then
    return 0
  fi
  AW_BOOTSTRAP_PACKAGE_MANAGER="$(command -v dnf 2>/dev/null)" || AW_BOOTSTRAP_PACKAGE_MANAGER=""
  if [[ -z "$AW_BOOTSTRAP_PACKAGE_MANAGER" ]]; then
    AW_BOOTSTRAP_PACKAGE_MANAGER="$(command -v yum 2>/dev/null)" || AW_BOOTSTRAP_PACKAGE_MANAGER=""
  fi
  [[ -n "$AW_BOOTSTRAP_PACKAGE_MANAGER" ]] || {
    aw_bootstrap_fail PACKAGE_MANAGER_UNAVAILABLE "Neither dnf nor yum is available" 'Install dnf or yum and retry'
    return 1
  }
  export AW_BOOTSTRAP_PACKAGE_MANAGER
}

aw_bootstrap_centos_install_docker() {
  local manager_name
  aw_bootstrap_centos_find_package_manager || return 1
  aw_bootstrap_centos_resolve_privilege || return 1
  manager_name="$(basename "$AW_BOOTSTRAP_PACKAGE_MANAGER")"
  if [[ "$manager_name" == dnf ]]; then
    aw_bootstrap_centos_privileged "$AW_BOOTSTRAP_PACKAGE_MANAGER" install -y dnf-plugins-core || return 1
    aw_bootstrap_centos_privileged "$AW_BOOTSTRAP_PACKAGE_MANAGER" config-manager --add-repo \
      https://download.docker.com/linux/centos/docker-ce.repo || return 1
  else
    aw_bootstrap_centos_privileged "$AW_BOOTSTRAP_PACKAGE_MANAGER" install -y yum-utils || return 1
    aw_bootstrap_centos_privileged yum-config-manager --add-repo \
      https://download.docker.com/linux/centos/docker-ce.repo || return 1
  fi
  aw_bootstrap_centos_privileged "$AW_BOOTSTRAP_PACKAGE_MANAGER" install -y \
    docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin || return 1
  aw_bootstrap_centos_privileged systemctl enable --now docker
}

aw_bootstrap_centos_install_temurin21() {
  {
    printf '%s\n' '[Adoptium]'
    printf '%s\n' 'name=Adoptium'
    printf '%s\n' 'baseurl=https://packages.adoptium.net/artifactory/rpm/centos/$releasever/$basearch'
    printf '%s\n' 'enabled=1'
    printf '%s\n' 'gpgcheck=1'
    printf '%s\n' 'gpgkey=https://packages.adoptium.net/artifactory/api/gpg/key/public'
  } | aw_bootstrap_centos_privileged tee /etc/yum.repos.d/adoptium.repo >/dev/null || return 1
  aw_bootstrap_centos_privileged "$AW_BOOTSTRAP_PACKAGE_MANAGER" install -y temurin-21-jdk
}

aw_bootstrap_centos_install() {
  local capability="$1" package="" java_candidate
  case "$capability" in
    git) package=git ;;
    curl) package=curl ;;
    python3) package=python3 ;;
    openssl) package=openssl ;;
    java21) package=java-21-openjdk-devel ;;
    maven) package=maven ;;
    docker|compose_v2|buildx) aw_bootstrap_centos_install_docker; return $? ;;
    *) aw_bootstrap_fail INSTALL_FAILED "Unknown CentOS capability: $capability" 'Update the E2E bootstrap provider'; return 1 ;;
  esac
  aw_bootstrap_centos_find_package_manager || return 1
  aw_bootstrap_centos_resolve_privilege || return 1
  if ! aw_bootstrap_centos_privileged "$AW_BOOTSTRAP_PACKAGE_MANAGER" install -y "$package"; then
    if [[ "$capability" != java21 ]]; then
      return 1
    fi
    aw_bootstrap_centos_install_temurin21 || return 1
  fi
  if [[ "$capability" == java21 ]]; then
    for java_candidate in /usr/lib/jvm/java-21-openjdk*/bin/java \
      /usr/lib/jvm/temurin-21-jdk*/bin/java; do
      if [[ -x "$java_candidate" ]]; then
        PATH="$(dirname "$java_candidate"):$PATH"
        export PATH
        break
      fi
    done
  fi
}

aw_bootstrap_centos_select_docker_adapter() {
  local docker_path adapter
  docker_path="$(command -v docker 2>/dev/null)" || {
    aw_bootstrap_fail DOCKER_UNAVAILABLE "Docker CLI is not installed" 'Install Docker CE and retry'
    return 1
  }
  if "$docker_path" version >>"$AW_BOOTSTRAP_LOG" 2>&1; then
    AW_E2E_DOCKER="$docker_path"
    export AW_E2E_DOCKER
    aw_bootstrap_record DOCKER_ACCESS DIRECT "$docker_path"
    return 0
  fi
  aw_bootstrap_centos_resolve_privilege || return 1
  if [[ "$AW_BOOTSTRAP_USE_SUDO" != 1 ]]; then
    aw_bootstrap_fail DOCKER_UNAVAILABLE "Docker daemon is not reachable as root" 'systemctl enable --now docker'
    return 1
  fi
  if ! sudo -n "$docker_path" version >>"$AW_BOOTSTRAP_LOG" 2>&1; then
    aw_bootstrap_fail DOCKER_PERMISSION_DENIED "Docker daemon is not reachable directly or through sudo" \
      'sudo systemctl enable --now docker'
    return 1
  fi
  [[ "$docker_path" != *'"'* ]] || {
    aw_bootstrap_fail DOCKER_UNAVAILABLE "Docker executable path contains an unsupported quote" 'Set AW_E2E_DOCKER to a safe executable path'
    return 1
  }
  adapter="${AW_RUN_DIR:-$(dirname "$AW_BOOTSTRAP_STATE")}/docker-sudo"
  {
    printf '%s\n' '#!/usr/bin/env bash'
    printf 'exec sudo -n "%s" "$@"\n' "$docker_path"
  } >"$adapter"
  chmod 700 "$adapter"
  AW_E2E_DOCKER="$adapter"
  export AW_E2E_DOCKER
  aw_bootstrap_record DOCKER_ACCESS SUDO_ADAPTER "$adapter"
}

aw_bootstrap_centos_ensure_docker_daemon() {
  if aw_bootstrap_centos_select_docker_adapter; then
    aw_step_event DOCKER_DAEMON PASS "action=REUSED|docker=$AW_E2E_DOCKER"
    return 0
  fi
  if [[ "$AW_BOOTSTRAP_INSTALL" != 1 ]]; then
    aw_bootstrap_fail INSTALL_DISABLED "Docker daemon is unavailable and automatic host changes are disabled" \
      'sudo systemctl enable --now docker' || true
    aw_step_event DOCKER_DAEMON FAIL "failureKind=INSTALL_DISABLED|log=$AW_BOOTSTRAP_LOG"
    return 1
  fi
  if ! aw_bootstrap_centos_resolve_privilege; then
    aw_step_event DOCKER_DAEMON FAIL \
      "failureKind=${AW_BOOTSTRAP_LAST_FAILURE_KIND:-SUDO_UNAVAILABLE}|log=$AW_BOOTSTRAP_LOG"
    return 1
  fi
  aw_step_event DOCKER_DAEMON STARTING "command=systemctl enable --now docker|log=$AW_BOOTSTRAP_LOG"
  aw_bootstrap_centos_privileged systemctl enable --now docker >>"$AW_BOOTSTRAP_LOG" 2>&1 || {
    aw_bootstrap_fail DOCKER_START_FAILED "Docker Engine could not be started" 'sudo systemctl enable --now docker' || true
    aw_step_event DOCKER_DAEMON FAIL "failureKind=DOCKER_START_FAILED|log=$AW_BOOTSTRAP_LOG"
    return 1
  }
  unset AW_E2E_DOCKER AW_BOOTSTRAP_DOCKER
  if ! aw_bootstrap_centos_select_docker_adapter; then
    aw_step_event DOCKER_DAEMON FAIL \
      "failureKind=${AW_BOOTSTRAP_LAST_FAILURE_KIND:-DOCKER_UNAVAILABLE}|log=$AW_BOOTSTRAP_LOG"
    return 1
  fi
  aw_step_event DOCKER_DAEMON PASS "action=STARTED|docker=$AW_E2E_DOCKER"
}

aw_bootstrap_require() {
  local capability="$1" probe_fn="$2" install_fn="$3" manual_command="$4"
  aw_bootstrap_prepare
  aw_step_event "$capability" START "Checking prerequisite"
  if "$probe_fn"; then
    aw_bootstrap_record "$capability" REUSED "$AW_BOOTSTRAP_DETECTED_VERSION"
    aw_step_event "$capability" PASS "action=REUSED|version=$AW_BOOTSTRAP_DETECTED_VERSION"
    return 0
  fi
  if [[ "$AW_BOOTSTRAP_INSTALL" != "1" ]]; then
    aw_step_event "$capability" FAIL "failureKind=INSTALL_DISABLED|log=$AW_BOOTSTRAP_LOG"
    aw_bootstrap_fail INSTALL_DISABLED "$capability is missing and automatic installation is disabled" "$manual_command"
    return 1
  fi
  aw_step_event "$capability" INSTALLING "log=$AW_BOOTSTRAP_LOG"
  AW_BOOTSTRAP_LAST_FAILURE_KIND=""
  AW_BOOTSTRAP_LAST_FAILURE_SUMMARY=""
  AW_BOOTSTRAP_NEXT_COMMAND=""
  if ! "$install_fn" >>"$AW_BOOTSTRAP_LOG" 2>&1; then
    if [[ -n "$AW_BOOTSTRAP_LAST_FAILURE_KIND" ]]; then
      aw_step_event "$capability" FAIL "failureKind=$AW_BOOTSTRAP_LAST_FAILURE_KIND|log=$AW_BOOTSTRAP_LOG"
    else
      aw_step_event "$capability" FAIL "failureKind=INSTALL_FAILED|log=$AW_BOOTSTRAP_LOG"
      aw_bootstrap_fail INSTALL_FAILED "Installation failed for $capability" "$manual_command" || true
    fi
    return 1
  fi
  if ! "$probe_fn"; then
    aw_step_event "$capability" FAIL "failureKind=INSTALL_VERIFICATION_FAILED|log=$AW_BOOTSTRAP_LOG"
    aw_bootstrap_fail INSTALL_VERIFICATION_FAILED "Installed $capability but verification still fails" "$manual_command"
    return 1
  fi
  aw_bootstrap_record "$capability" INSTALLED "$AW_BOOTSTRAP_DETECTED_VERSION"
  aw_step_event "$capability" PASS "action=INSTALLED|version=$AW_BOOTSTRAP_DETECTED_VERSION"
}

aw_bootstrap_install_capability() {
  local capability="$1"
  case "$AW_BOOTSTRAP_OS" in
    macos) aw_bootstrap_macos_install "$capability" ;;
    centos) aw_bootstrap_centos_install "$capability" ;;
    *) aw_bootstrap_fail UNSUPPORTED_HOST "No installer for ${AW_BOOTSTRAP_OS:-unknown}" "Use macOS or CentOS" ;;
  esac
}

aw_bootstrap_install_git() { aw_bootstrap_install_capability git; }
aw_bootstrap_install_curl() { aw_bootstrap_install_capability curl; }
aw_bootstrap_install_python3() { aw_bootstrap_install_capability python3; }
aw_bootstrap_install_openssl() { aw_bootstrap_install_capability openssl; }
aw_bootstrap_install_java21() { aw_bootstrap_install_capability java21; }
aw_bootstrap_install_maven() { aw_bootstrap_install_capability maven; }
aw_bootstrap_install_docker() { aw_bootstrap_install_capability docker; }
aw_bootstrap_install_compose_v2() { aw_bootstrap_install_capability compose_v2; }
aw_bootstrap_install_buildx() { aw_bootstrap_install_capability buildx; }

aw_bootstrap_all() {
  aw_step_event HOST_DETECTION START "Detecting supported host"
  if ! aw_bootstrap_detect_host; then
    aw_step_event HOST_DETECTION FAIL \
      "failureKind=${AW_BOOTSTRAP_LAST_FAILURE_KIND:-UNSUPPORTED_HOST}|log=$AW_BOOTSTRAP_LOG"
    return 1
  fi
  aw_step_event HOST_DETECTION PASS "os=$AW_BOOTSTRAP_OS|arch=$AW_BOOTSTRAP_ARCH"
  aw_bootstrap_require GIT aw_bootstrap_probe_git aw_bootstrap_install_git 'Install Git' || return 1
  aw_bootstrap_require CURL aw_bootstrap_probe_curl aw_bootstrap_install_curl 'Install curl' || return 1
  aw_bootstrap_require PYTHON3 aw_bootstrap_probe_python3 aw_bootstrap_install_python3 'Install Python 3' || return 1
  aw_bootstrap_require OPENSSL aw_bootstrap_probe_openssl aw_bootstrap_install_openssl 'Install OpenSSL' || return 1
  aw_bootstrap_require JAVA21 aw_bootstrap_probe_java21 aw_bootstrap_install_java21 'Install JDK 21' || return 1
  aw_bootstrap_require MAVEN aw_bootstrap_probe_maven aw_bootstrap_install_maven 'Install Maven' || return 1
  aw_bootstrap_require DOCKER_CLI aw_bootstrap_probe_docker_cli aw_bootstrap_install_docker 'Install Docker' || return 1
  aw_bootstrap_require COMPOSE_V2 aw_bootstrap_probe_compose_v2 aw_bootstrap_install_compose_v2 'Install Docker Compose v2' || return 1
  aw_bootstrap_require BUILDX aw_bootstrap_probe_buildx aw_bootstrap_install_buildx 'Install Docker Buildx' || return 1
  if [[ "$AW_BOOTSTRAP_OS" == macos ]]; then
    aw_bootstrap_macos_ensure_docker_daemon || return 1
  else
    aw_bootstrap_centos_ensure_docker_daemon || return 1
  fi
}
