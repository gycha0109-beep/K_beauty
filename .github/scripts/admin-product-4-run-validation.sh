#!/usr/bin/env bash
set -Eeuo pipefail

BASE_SHA="${BASE_SHA:-e174f80f79fa9ce5d62c742f440c9e18e602929a}"
TARGET_BRANCH="${TARGET_BRANCH:-feature/admin-product-review-import-ui}"
SUPABASE_CLI_VERSION="${SUPABASE_CLI_VERSION:-2.109.1}"
TARGET_SHA=""
CURRENT_STAGE="bootstrap"
RESULT="failure"
ROOT="$(pwd)"
RUNTIME_DIR="${RUNNER_TEMP}/admin-product-review-import-runtime-${GITHUB_RUN_ID}"
BATCH_DIR="tmp/admin-product-review-import-ci-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"

post_comment() {
  local body="$1"
  gh pr comment 163 --repo "$GITHUB_REPOSITORY" --body "$body" >/dev/null
}

set_status() {
  local state="$1"
  local description="$2"
  [[ -n "$TARGET_SHA" ]] || return 0
  gh api \
    --method POST \
    "repos/${GITHUB_REPOSITORY}/statuses/${TARGET_SHA}" \
    -f state="$state" \
    -f target_url="${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}" \
    -f description="$description" \
    -f context="ADMIN-PRODUCT-4/exact-head" >/dev/null
}

cleanup_runtime() {
  set +e
  if [[ -d "${RUNTIME_DIR}/supabase" ]]; then
    npx --yes "supabase@${SUPABASE_CLI_VERSION}" stop \
      --workdir "${RUNTIME_DIR}" \
      --no-backup >/dev/null 2>&1
  fi
  rm -rf -- "$RUNTIME_DIR" "$ROOT/$BATCH_DIR" "$ROOT/crawler/$BATCH_DIR"
}

finalize() {
  local exit_code=$?
  cleanup_runtime
  if [[ $exit_code -ne 0 ]]; then
    set +e
    set_status failure "ADMIN-PRODUCT-4 validation failed"
    post_comment "ADMIN-PRODUCT-4 exact-head CI failed.

- Target SHA: \`${TARGET_SHA:-unresolved}\`
- Run: \`${GITHUB_RUN_ID}\`
- Failed stage: \`${CURRENT_STAGE}\`
- Verdict: \`NOT_READY_FIX_REQUIRED\`"
  fi
  exit "$exit_code"
}
trap finalize EXIT

CURRENT_STAGE="resolve_target_sha"
TARGET_SHA="$(git ls-remote origin "refs/heads/${TARGET_BRANCH}" | awk '{print $1}')"
test "${#TARGET_SHA}" = "40"
post_comment "ADMIN-PRODUCT-4 exact-head CI started.

- Target SHA: \`${TARGET_SHA}\`
- Run: \`${GITHUB_RUN_ID}\`
- Source workflow: registered non-main inspection runner"
set_status pending "ADMIN-PRODUCT-4 validation running"

CURRENT_STAGE="checkout_exact_target"
git fetch origin \
  "+refs/heads/${TARGET_BRANCH}:refs/remotes/origin/${TARGET_BRANCH}" \
  "+refs/heads/feature/admin-product-review-import-confirm:refs/remotes/origin/feature/admin-product-review-import-confirm" \
  --no-tags
git checkout --detach "$TARGET_SHA"
test "$(git rev-parse HEAD)" = "$TARGET_SHA"
test -z "$(git status --short)"
test -f app/admin/products/reviews/import/ProductReviewImportWorkbench.js
test -f app/api/admin/product-reviews/import/dry-run/route.js
test -f app/api/admin/product-reviews/import/confirm/route.js

CURRENT_STAGE="install_root_dependencies"
npm ci --no-audit --no-fund

CURRENT_STAGE="install_crawler_dependencies"
(
  cd crawler
  npm ci --no-audit --no-fund
)

CURRENT_STAGE="verify_admin_import_contracts"
npm run verify:admin-product-review-import-ui
npm run verify:admin-product-review-import-routes
npm run verify:admin-product-review-import-confirm
npm run verify:admin-access-foundation
npm run verify:admin-product-candidate-reviews

CURRENT_STAGE="verify_crawler_contracts"
(
  cd crawler
  npm run typecheck
  npm run verify:product-review-export
  npm run verify:product-review-intake-dry-run
  npm run verify:product-review-intake-bytes
  npm run verify:product-review-intake-confirm
)

CURRENT_STAGE="verify_architecture"
npm run architecture:guard

CURRENT_STAGE="build_production"
npm run build

CURRENT_STAGE="verify_diff_hygiene"
git diff --check "${BASE_SHA}..${TARGET_SHA}"

CURRENT_STAGE="prepare_isolated_supabase"
npx --yes "supabase@${SUPABASE_CLI_VERSION}" init \
  --workdir "$RUNTIME_DIR" \
  --force
mkdir -p "$RUNTIME_DIR/supabase/migrations"
cp tests/fixtures/admin-product-reviews/20260730140000_product_review_foundation.sql \
  "$RUNTIME_DIR/supabase/migrations/"
cp supabase/migrations/*_admin_access_foundation.sql \
  "$RUNTIME_DIR/supabase/migrations/"
cp supabase/migrations/*_admin_product_candidate_reviews*.sql \
  "$RUNTIME_DIR/supabase/migrations/"
cp tests/fixtures/product-review-export-intake/20260731170000_product_review_export_intake_fixture.sql \
  "$RUNTIME_DIR/supabase/migrations/"
cp supabase/migrations/20260731183428_admin_product_review_import_confirm.sql \
  "$RUNTIME_DIR/supabase/migrations/"
cp tests/fixtures/admin-product-review-import/20260731190000_review_import_runtime_seed.sql \
  "$RUNTIME_DIR/supabase/migrations/"

CURRENT_STAGE="start_isolated_supabase"
raw_log="$(mktemp)"
sanitize_log() {
  sed -E \
    -e '/(anon key|service[_ -]?role key|jwt secret|publishable key|secret key|database url|db url|ANON_KEY|SERVICE_ROLE_KEY|JWT_SECRET|DATABASE_URL|DB_URL)/Id' \
    -e 's#(postgres(ql)?://[^:/[:space:]]+:)[^@[:space:]]+@#\1[REDACTED]@#g' \
    -e 's#(Bearer )[A-Za-z0-9._-]+#\1[REDACTED]#g' \
    -e 's#eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}#[REDACTED_JWT]#g'
}
if ! npx --yes "supabase@${SUPABASE_CLI_VERSION}" start \
  --workdir "$RUNTIME_DIR" \
  --exclude realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor \
  >"$raw_log" 2>&1; then
  sanitize_log <"$raw_log" | tail -n 180 >&2
  rm -f "$raw_log"
  exit 1
fi
if ! npx --yes "supabase@${SUPABASE_CLI_VERSION}" db reset \
  --workdir "$RUNTIME_DIR" \
  >"$raw_log" 2>&1; then
  sanitize_log <"$raw_log" | tail -n 220 >&2
  rm -f "$raw_log"
  exit 1
fi
rm -f "$raw_log"

CURRENT_STAGE="run_isolated_confirm_runtime"
env_file="${RUNNER_TEMP}/review-import-supabase-${GITHUB_RUN_ID}.env"
npx --yes "supabase@${SUPABASE_CLI_VERSION}" status \
  --workdir "$RUNTIME_DIR" \
  -o env >"$env_file"
set -a
source "$env_file"
set +a
export NEXT_PUBLIC_SUPABASE_URL="$API_URL"
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
rm -f "$env_file"

rm -rf -- "$ROOT/$BATCH_DIR" "$ROOT/crawler/$BATCH_DIR"
(
  cd crawler
  npm run reviews:export -- \
    --status queued \
    --out-dir "$BATCH_DIR" \
    --limit 5
  npx tsx tests/prepare-reviewed-intake-local-fixture.ts "$BATCH_DIR"
  npm run reviews:import-reviewed -- \
    --file "$BATCH_DIR/reviewed.csv" \
    --dry-run
  npm run verify:product-review-intake-confirm:local-runtime -- \
    "$BATCH_DIR/reviewed.csv" \
    "30000000-0000-4000-8000-000000000001" \
    "30000000-0000-4000-8000-000000000003" \
    "ap4-ci-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"
)

CURRENT_STAGE="verify_target_stability"
remote_target="$(git ls-remote origin "refs/heads/${TARGET_BRANCH}" | awk '{print $1}')"
test "$remote_target" = "$TARGET_SHA"

CURRENT_STAGE="publish_success"
set_status success "ADMIN-PRODUCT-4 validation passed"
post_comment "ADMIN-PRODUCT-4 exact-head CI passed.

- Target SHA: \`${TARGET_SHA}\`
- Run: \`${GITHUB_RUN_ID}\`
- Focused contracts: PASS
- Crawler typecheck/regressions: PASS
- Architecture guard: PASS
- Production build: PASS
- Diff hygiene: PASS
- Isolated Supabase confirm runtime: PASS
- Helper cleanup: starting"

CURRENT_STAGE="close_helper_pull_requests"
for pr in 142 146 165; do
  gh api --method PATCH "repos/${GITHUB_REPOSITORY}/pulls/${pr}" -f state=closed >/dev/null
done

CURRENT_STAGE="delete_helper_branches"
delete_branch() {
  local branch="$1"
  if gh api "repos/${GITHUB_REPOSITORY}/git/ref/heads/${branch}" >/dev/null 2>&1; then
    gh api --method DELETE "repos/${GITHUB_REPOSITORY}/git/refs/heads/${branch}" >/dev/null
  fi
}

delete_branch automation/admin-product-4-implement
delete_branch automation/admin-product-4-recovered-core
delete_branch automation/admin-product-4-ci-base
delete_branch automation/admin-product-4-ci-gate
delete_branch automation/admin-product-4-status
delete_branch automation/admin-product-4-inspect

RESULT="success"
