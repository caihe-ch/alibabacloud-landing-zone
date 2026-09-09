#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)

usage() {
  printf 'Usage: bootstrap-control-host.sh [--manifest FILE] [--region REGION] [--expected-account-id ID]\n'
}

manifest= region=cn-beijing expected_account_id=
while (($#)); do
  case "$1" in
    --manifest) manifest=${2:-}; shift 2;;
    --region) region=${2:-}; shift 2;;
    --expected-account-id) expected_account_id=${2:-}; shift 2;;
    --help|-h) usage; exit 0;;
    *) printf 'unknown argument\n' >&2; exit 2;;
  esac
done

install_macos_dependency() {
  local command_name=$1 package_name=$2
  command -v "$command_name" >/dev/null || brew install "$package_name"
}
if [[ $(uname -s) == Darwin ]]; then
  install_macos_dependency git git
  install_macos_dependency jq jq
  install_macos_dependency terraform terraform
  install_macos_dependency aliyun aliyun-cli
  install_macos_dependency ossutil ossutil
  install_macos_dependency openssl openssl@3
  install_macos_dependency curl curl
  install_macos_dependency python3 python@3.13
  install_macos_dependency gtar gnu-tar
  install_macos_dependency java openjdk@21
  install_macos_dependency mvn maven
fi
for tool in bash git jq terraform aliyun ossutil openssl curl python3 java mvn; do
  command -v "$tool" >/dev/null || { printf 'missing dependency: %s\n' "$tool" >&2; exit 1; }
done

source "$SCRIPT_DIR/lib.sh"
if [[ -n "$manifest" ]]; then
  require_file "$manifest"
  json_validate "$manifest"
  configure_cloud_profile "$manifest"
  region=$(json_string "$manifest" '.region')
  expected_account_id=${expected_account_id:-$(jq -r '.accountUid // empty' "$manifest")}
else
  bind_auto_wonder_cloud_profile
fi
ensure_alicloud_profile_identity "$region"
account_id=$(jq -er '.AccountId' <<<"$AUTOWONDER_IDENTITY_JSON") || die "Alibaba Cloud identity response has no account ID"
[[ -z "$expected_account_id" || "$account_id" == "$expected_account_id" ]] ||
  die "Alibaba Cloud account identity mismatch"
jq -cn --arg profile "$AUTOWONDER_CLOUD_PROFILE" --arg region "$region" --arg accountId "$account_id" \
  '{platform:"posix",profile:$profile,region:$region,accountId:$accountId,validated:true}'
