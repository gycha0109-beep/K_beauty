#!/usr/bin/env bash
# Isolated D8K13 CURRENT-STATE recovery drill: SYNTHETIC PG17 only.
# NEVER a production dump; this uses only two exact local ephemeral test databases.
set -euo pipefail
if [[ "${1:-}" != "--isolated-pg17" || "$#" -ne 1 ]]; then
  echo D8K13_RECOVERY_EXPLICIT_ISOLATED_OPT_IN_REQUIRED >&2; exit 2
fi
if [[ "${PGHOST:-}" != "127.0.0.1" || "${PGPORT:-}" != "5432" ||
      "${PGDATABASE:-}" != "d8k13_current_restore_disposable" ||
      "${PGUSER:-}" != "d8k13_fixture" || -z "${PGPASSWORD:-}" ]]; then
  echo D8K13_RECOVERY_EXACT_LOCAL_DISPOSABLE_DB_REQUIRED >&2; exit 2
fi
if [[ -n "${DATABASE_URL:-}" || -n "${DIRECT_URL:-}" || -n "${SUPABASE_URL:-}" ||
      -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo D8K13_RECOVERY_HOSTED_ENV_FORBIDDEN >&2; exit 2
fi
container="${D8K13_PG17_SERVICE_CONTAINER:-}"
if ! [[ "$container" =~ ^[0-9a-f]{12,64}$ ]]; then
  echo D8K13_RECOVERY_PINNED_LOCAL_PG17_CONTAINER_REQUIRED >&2; exit 2
fi
umask 077
workdir="$(mktemp -d /tmp/d8k13-current-recovery.XXXXXXXX)"
trap 'rm -rf -- "$workdir"' EXIT
source_db=d8k13_preledger_synthetic
target_db=d8k13_current_restore_disposable
client() {
 docker exec -i -e "PGPASSWORD=$PGPASSWORD" "$container" "$@"
}
major="$(client psql -X -Atqc "select current_setting('server_version_num')::int / 10000" \
  -h 127.0.0.1 -p 5432 -U d8k13_fixture -d "$source_db")"
test "$major" = 17
target_initial="$(client psql -X -Atqc "select to_regclass('public.products') is null" \
  -h 127.0.0.1 -p 5432 -U d8k13_fixture -d "$target_db")"
test "$target_initial" = t
# Only container-local fixture -> temporary runner filesystem. No hosted connections.
client pg_dump -h 127.0.0.1 -p 5432 -U d8k13_fixture -d "$source_db" \
  --schema=public --schema-only --no-owner --no-privileges \
  --no-subscriptions --file /dev/stdout > "$workdir/schema.sql"
client pg_dump -h 127.0.0.1 -p 5432 -U d8k13_fixture -d "$source_db" \
  --schema=public --data-only --no-owner --no-privileges \
  --no-subscriptions --file /dev/stdout > "$workdir/data.sql"
test -s "$workdir/schema.sql" && test -s "$workdir/data.sql"
# Refuse silent/empty dumps before attempting any restoration.
grep -Eq '^CREATE TABLE public\\.products[[:space:]]*\\(' "$workdir/schema.sql"
grep -Eq '^CREATE TABLE public\\.product_candidates[[:space:]]*\\(' "$workdir/schema.sql"
grep -Eq '^CREATE TABLE public\\.source_rankings[[:space:]]*\\(' "$workdir/schema.sql"
client psql -X -q -v ON_ERROR_STOP=1 --single-transaction \
  -h 127.0.0.1 -p 5432 -U d8k13_fixture -d "$target_db" < "$workdir/schema.sql" >/dev/null
# Ensure PostgreSQL parsed input instead of quietly accepting empty stdin.
restored_schema="$(client psql -X -Atqc "select to_regclass('public.products') is not null and to_regclass('public.product_candidates') is not null and to_regclass('public.source_rankings') is not null" \\
  -h 127.0.0.1 -p 5432 -U d8k13_fixture -d "$target_db")"
test "$restored_schema" = t
client psql -X -q -v ON_ERROR_STOP=1 --single-transaction \
  -h 127.0.0.1 -p 5432 -U d8k13_fixture -d "$target_db" < "$workdir/data.sql" >/dev/null
# Compare current structure and synthetic user-data facts, never disclose raw SQL/data.
probe="select jsonb_build_object(
 'products',(select count(*) from public.products),
 'candidates',(select count(*) from public.product_candidates),
 'rankings',(select count(*) from public.source_rankings),
 'evidence',(select count(*) from public.product_candidate_evidence_summary),
 'evidence_count',(select source_evidence_count from public.product_candidate_evidence_summary limit 1),
 'rank_best',(select best_rank_position from public.product_candidate_evidence_summary limit 1),
 'normalize',(select normalized_name from public.products limit 1),
 'enum_types',(select count(*) from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typtype='e'),
 'tables',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'),
 'views',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='v'),
 'routines',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'),
 'foreign_keys',(select count(*) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public' and c.contype='f'),
 'rls_enabled',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relrowsecurity),
 'policy_count',(select count(*) from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public')
)"
before="$(client psql -X -Atqc "$probe" -h 127.0.0.1 -p 5432 -U d8k13_fixture -d "$source_db")"
after="$(client psql -X -Atqc "$probe" -h 127.0.0.1 -p 5432 -U d8k13_fixture -d "$target_db")"
if [[ -z "$before" || "$before" != "$after" ]]; then
 echo D8K13_RECOVERY_SYNTHETIC_RESTORE_PARITY_FAILED >&2; exit 3
fi
expected="$(client psql -X -Atqc "select
 (select count(*) from public.products)=1 and
 (select count(*) from public.product_candidates)=1 and
 (select count(*) from public.source_rankings)=1 and
 (select count(*) from public.product_candidate_evidence_summary)=1 and
 (select source_evidence_count from public.product_candidate_evidence_summary limit 1)=1" \
 -h 127.0.0.1 -p 5432 -U d8k13_fixture -d "$target_db")"
test "$expected" = t
echo '{"status":"SYNTHETIC_SCHEMA_AND_DATA_RESTORE_PASS","pg_major":17,"private_temporary_files_cleaned_on_exit":true,"database":"isolated-only","current_real_production_dump_captured":false,"current_real_production_restore_passed":false,"roles_and_acl_parity_verified":false,"managed_auth_storage_restored":false,"full178_historical_replay_verified":false,"release_authorized":false}'
echo D8K13_CURRENT_RECOVERY_SYNTHETIC_SCHEMA_DATA_RESTORE_PASS
