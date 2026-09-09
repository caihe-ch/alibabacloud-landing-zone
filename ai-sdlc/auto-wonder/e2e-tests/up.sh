#!/usr/bin/env bash
# Bring up a fresh, isolated set of community end-to-end dependencies and prove
# that a brand-new volume really does import the complete schema.
#
#   e2e-tests/up.sh
#
# What "fresh" means here, and why each part is asserted rather than assumed:
#   * an independent compose project name, so the volume is named
#     <project>_mysql-data and cannot be a leftover from another run;
#   * a pre-flight assertion that no volume for this project already exists,
#     because the community compose file mounts the schema into
#     /docker-entrypoint-initdb.d and MySQL only executes that directory when
#     the data directory is empty - a reused volume silently skips the import
#     and every later result would be about a stale database;
#   * a distinct network name, so a run cannot attach to a leftover network.
#
# Requires: docker with a reachable daemon, docker compose v2, openssl.
# Nothing else. No host packages are installed and no host services are used.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
# shellcheck source=lib/common.sh
source e2e-tests/lib/common.sh

aw_e2e_init_runtime
aw_e2e_prepare_state_dir

log "project=$AW_E2E_PROJECT network=$AW_E2E_NETWORK state=$AW_E2E_STATE_DIR"

# --- 1. freshness pre-flight -------------------------------------------------
existing_volumes="$("$DOCKER" volume ls --format '{{.Name}}' | grep -c "^${AW_E2E_PROJECT}_" || true)"
existing_containers="$("$DOCKER" ps -aq --filter "label=com.docker.compose.project=${AW_E2E_PROJECT}" | wc -l | tr -d ' ')"
log "pre-flight: volumes for project=$existing_volumes containers=$existing_containers"
if [[ "$existing_volumes" != "0" || "$existing_containers" != "0" ]]; then
  die "project $AW_E2E_PROJECT is not fresh (run e2e-tests/down.sh first, or set a new AW_E2E_PROJECT)"
fi

# --- 2. images, with a public mirror fallback --------------------------------
# The community compose file pins platform: linux/amd64 for mysql and redis. A
# tag that reports the host architecture is rejected by compose even when the
# amd64 content is already materialised locally, and compose then re-consults
# the registry - which on a machine with no route to Docker Hub fails the whole
# stack. So: materialise and *prove* each pinned platform runs, then tell compose
# never to pull again for this run.
mysql_mirror="$(aw_e2e_official_mirror "$AW_E2E_MYSQL_IMAGE" || true)"
redis_mirror="$(aw_e2e_official_mirror "$AW_E2E_REDIS_IMAGE" || true)"
aw_e2e_ensure_image "$AW_E2E_MYSQL_IMAGE" linux/amd64 ${mysql_mirror:+"$mysql_mirror"}
aw_e2e_ensure_image "$AW_E2E_REDIS_IMAGE" linux/amd64 ${redis_mirror:+"$redis_mirror"}
aw_e2e_ensure_image "$AW_E2E_MINIO_IMAGE" -
aw_e2e_ensure_image "$AW_E2E_MC_IMAGE" -
export AW_E2E_PULL_POLICY=never
log "pull policy for compose: $AW_E2E_PULL_POLICY"

# --- 3. secrets --------------------------------------------------------------
aw_e2e_generate_secrets

# The MinIO alias is handed to mc through an env file so that no credential
# ever appears in a command argument (visible in ps and in captured output).
mc_env="$AW_E2E_STATE_DIR/mc.env"
umask 077
printf 'MC_HOST_m=http://%s:%s@minio:%s\n' \
  "$AW_E2E_MINIO_ROOT_USER" "$(aw_e2e_secret AW_E2E_MINIO_ROOT_PASSWORD)" "$(aw_e2e_minio_internal_port)" \
  >"$mc_env"
chmod 600 "$mc_env"
umask 022

# --- 4. up -------------------------------------------------------------------
aw_e2e_resolve_compose
log "compose base mode: $COMPOSE_BASE_MODE"
log "compose files:"
printf '  %s\n' "${AW_E2E_COMPOSE_ARGS[@]}"
log "resolved host ports: mysql=$RESOLVED_MYSQL_PORT redis=$RESOLVED_REDIS_PORT minio=$AW_E2E_MINIO_PORT app=$AW_E2E_APP_PORT"

set +e
# Start dependencies only. The application is deliberately started by
# smoke.sh after the schema and MinIO bucket have been verified and runtime.env
# has been written.
aw_e2e_compose up -d --wait mysql redis minio >"$AW_E2E_STATE_DIR/compose-up.log" 2>&1
COMPOSE_UP_EXIT=$?
set -e
tail -20 "$AW_E2E_STATE_DIR/compose-up.log"
log "COMPOSE_UP_EXIT=$COMPOSE_UP_EXIT"
[[ "$COMPOSE_UP_EXIT" == "0" ]] || die "compose up failed; see $AW_E2E_STATE_DIR/compose-up.log"

aw_e2e_compose ps --format '{{.Service}} {{.State}} {{.Status}}' | tee "$AW_E2E_STATE_DIR/compose-ps.txt"

# --- 5. object storage bucket ------------------------------------------------
log "creating bucket $AW_E2E_BUCKET in MinIO"
"$DOCKER" run --rm --network "$AW_E2E_NETWORK" --env-file "$mc_env" \
  --entrypoint mc "$AW_E2E_MC_IMAGE" mb -p "m/$AW_E2E_BUCKET" \
  >"$AW_E2E_STATE_DIR/mc-mb.log" 2>&1 || {
    cat "$AW_E2E_STATE_DIR/mc-mb.log"
    die "bucket creation failed"
  }
"$DOCKER" run --rm --network "$AW_E2E_NETWORK" --env-file "$mc_env" \
  --entrypoint mc "$AW_E2E_MC_IMAGE" ls m 2>&1 | tee "$AW_E2E_STATE_DIR/mc-ls.txt"

# --- 6. schema import --------------------------------------------------------
# The query reaches the container as an environment variable. Interpolating it
# into a double-quoted sh -c string would make bash command-substitute any
# backtick in the query, which is both wrong and an injection hole. MySQL's own
# password is likewise referenced through the container's environment, so no
# credential appears in a command argument.
mysql_q() {
  AW_E2E_Q="$1" aw_e2e_compose exec -T -e AW_E2E_Q mysql sh -c \
    'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -B -e "$AW_E2E_Q"' \
    2>>"$AW_E2E_STATE_DIR/mysql-q.err"
}

schema_report="$AW_E2E_STATE_DIR/schema-verification.txt"
{
  echo "# schema verification on a brand-new volume"
  echo "PROJECT=$AW_E2E_PROJECT"
  echo "VOLUME=$("$DOCKER" volume ls --format '{{.Name}}' | grep "^${AW_E2E_PROJECT}_" | tr '\n' ' ')"
  echo "MYSQL_VERSION=$(mysql_q 'SELECT VERSION()')"
  echo "TABLE_COUNT=$(mysql_q "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='autowonder'")"
  echo "NEW_TABLES_FOUND=$(mysql_q "SELECT table_name FROM information_schema.tables WHERE table_schema='autowonder' AND table_name IN ('workspace_access_request','agent_conversation_elicitation') ORDER BY table_name" | tr '\n' ' ')"
  echo "STORED_GENERATED_COLUMNS=$(mysql_q "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='autowonder' AND extra LIKE '%STORED GENERATED%'")"
  echo "UNIQUE_INDEX_COUNT=$(mysql_q "SELECT COUNT(DISTINCT table_name, index_name) FROM information_schema.statistics WHERE table_schema='autowonder' AND non_unique=0 AND index_name<>'PRIMARY'")"
  for key in uk_active_name uk_conv_request uk_dispatch_normalized_idempotency uk_workspace_access_request_pending; do
    echo "UNIQUE_KEY_${key}=$(mysql_q "SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema='autowonder' AND index_name='$key'")"
  done
  echo "LEGACY_uk_name_ON_org=$(mysql_q "SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema='autowonder' AND table_name='org' AND index_name='uk_name'")"
  echo "IDX_org_recycle_bin=$(mysql_q "SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema='autowonder' AND index_name='idx_org_recycle_bin'")"
  for col in "user:is_admin" "org:active_name_key" "org:deleted_at" "org:deleted_by"; do
    t="${col%%:*}"; c="${col##*:}"
    echo "COLUMN_${t}_${c}=$(mysql_q "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='autowonder' AND table_name='$t' AND column_name='$c'")"
  done
  echo "INDEX_ROWS=$(mysql_q "SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema='autowonder'")"
  echo "ROW_COUNT_user=$(mysql_q 'SELECT COUNT(*) FROM autowonder.user')"
  echo "ROW_COUNT_org=$(mysql_q 'SELECT COUNT(*) FROM autowonder.org')"
} | tee "$schema_report"

aw_require_int_ge schema.table_count 65 "$(aw_report_value "$schema_report" TABLE_COUNT)"
aw_require_equal schema.new_tables \
  "agent_conversation_elicitation workspace_access_request " \
  "$(aw_report_value "$schema_report" NEW_TABLES_FOUND)"
aw_require_int_ge schema.stored_generated_columns 2 "$(aw_report_value "$schema_report" STORED_GENERATED_COLUMNS)"
aw_require_equal schema.uk_active_name 1 "$(aw_report_value "$schema_report" UNIQUE_KEY_uk_active_name)"
aw_require_equal schema.uk_conv_request 3 "$(aw_report_value "$schema_report" UNIQUE_KEY_uk_conv_request)"
aw_require_equal schema.uk_dispatch_normalized_idempotency 2 "$(aw_report_value "$schema_report" UNIQUE_KEY_uk_dispatch_normalized_idempotency)"
aw_require_equal schema.uk_workspace_access_request_pending 3 "$(aw_report_value "$schema_report" UNIQUE_KEY_uk_workspace_access_request_pending)"
aw_require_equal schema.legacy_org_uk_name 0 "$(aw_report_value "$schema_report" LEGACY_uk_name_ON_org)"
aw_require_equal schema.idx_org_recycle_bin 3 "$(aw_report_value "$schema_report" IDX_org_recycle_bin)"
for required_column in user_is_admin org_active_name_key org_deleted_at org_deleted_by; do
  aw_require_equal "schema.column_$required_column" 1 \
    "$(aw_report_value "$schema_report" "COLUMN_$required_column")"
done

log "up.sh done"
