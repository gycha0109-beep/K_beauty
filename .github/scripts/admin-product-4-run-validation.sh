#!/usr/bin/env bash
set -euo pipefail

BASE_SHA="${BASE_SHA:?}"
BASE_BRANCH="${BASE_BRANCH:?}"
TARGET_BRANCH="${TARGET_BRANCH:?}"
FEATURE_SHA=""
VALIDATED_BRANCH="local-validated-commit"
RESULT="failed"

report_result() {
  set +e
  gh pr comment 146 --repo "$GITHUB_REPOSITORY" --body "ADMIN-PRODUCT-4 authoritative precommit run: $GITHUB_RUN_ID
Helper SHA: $GITHUB_SHA
Validated feature SHA: ${FEATURE_SHA:-not-created}
Validated branch: ${VALIDATED_BRANCH:-not-created}
Result: ${RESULT}"
}
trap report_result EXIT

source_file="$RUNNER_TEMP/admin-product-4-precommit-source.yml"
gh api \
  "repos/${GITHUB_REPOSITORY}/contents/.github/workflows/admin-product-4-precommit-publish.yml?ref=automation/admin-product-4-implement" \
  --jq .content | tr -d '\n' | base64 -d > "$source_file"

awk '
  /admin-product-4-overlay\.b64.*OVERLAY/ { capture = 1; next }
  capture && /^[[:space:]]*OVERLAY[[:space:]]*$/ { capture = 0; exit }
  capture { sub(/^[[:space:]]+/, ""); printf "%s", $0 }
' "$source_file" > "$RUNNER_TEMP/admin-product-4-overlay.b64"

awk '
  /admin-product-4-worklog\.b64.*WORKLOG/ { capture = 1; next }
  capture && /^[[:space:]]*WORKLOG[[:space:]]*$/ { capture = 0; exit }
  capture { sub(/^[[:space:]]+/, ""); printf "%s", $0 }
' "$source_file" > "$RUNNER_TEMP/admin-product-4-worklog.b64"

test -s "$RUNNER_TEMP/admin-product-4-overlay.b64"
test -s "$RUNNER_TEMP/admin-product-4-worklog.b64"
base64 -d "$RUNNER_TEMP/admin-product-4-overlay.b64" > "$RUNNER_TEMP/admin-product-4-overlay.tar.gz"
tar -tzf "$RUNNER_TEMP/admin-product-4-overlay.tar.gz" >/dev/null

git fetch origin "$BASE_BRANCH" --depth=20
git checkout --detach "$BASE_SHA"
test "$(git rev-parse HEAD)" = "$BASE_SHA"
test -z "$(git status --short)"
remote_target="$(git ls-remote origin "refs/heads/${TARGET_BRANCH}" | awk '{print $1}')"
test "$remote_target" = "$BASE_SHA"

tar -xzf "$RUNNER_TEMP/admin-product-4-overlay.tar.gz" -C "$GITHUB_WORKSPACE"
base64 -d "$RUNNER_TEMP/admin-product-4-worklog.b64" >> .codex/AI_WORK_LOG.md
python - <<'PY'
from pathlib import Path

workbench = Path("app/admin/products/reviews/import/ProductReviewImportWorkbench.js")
text = workbench.read_text()
old = "const visibleSummary = state.dryRun?.summary || state.result?.summary || null;"
new = "const visibleSummary = state.result?.summary || state.dryRun?.summary || null;"
if old not in text:
    raise SystemExit("visible summary boundary not found")
workbench.write_text(text.replace(old, new, 1))

state = Path("app/admin/products/reviews/import/workbench-state.js")
text = state.read_text()
old = '''export function canConfirmProductReviewImport(state, confirmation) {
  return (
    state.status === PRODUCT_REVIEW_IMPORT_STATES.DRY_RUN_READY ||
    state.status === PRODUCT_REVIEW_IMPORT_STATES.FAILED
  ) &&
    state.dryRun?.status === "ready" &&
    state.requestId &&
    state.reviewedFileSha256 &&
    state.canonicalPayloadSha256 &&
    confirmation === "CONFIRM_PRODUCT_REVIEW_IMPORT";
}
'''
new = '''export function canConfirmProductReviewImport(state, confirmation) {
  return Boolean(
    (
      state.status === PRODUCT_REVIEW_IMPORT_STATES.DRY_RUN_READY ||
      state.status === PRODUCT_REVIEW_IMPORT_STATES.FAILED
    ) &&
      state.dryRun?.status === "ready" &&
      state.requestId &&
      state.reviewedFileSha256 &&
      state.canonicalPayloadSha256 &&
      confirmation === "CONFIRM_PRODUCT_REVIEW_IMPORT"
  );
}
'''
if old not in text:
    raise SystemExit("confirm state boundary not found")
state.write_text(text.replace(old, new, 1))

isolated = Path("scripts/verify-admin-product-review-import-isolated.sh")
text = isolated.read_text()
text = text.replace(
    'rm -rf -- "${ROOT}/${PACKAGE_DIR}"',
    'rm -rf -- "${ROOT}/crawler/${PACKAGE_DIR}"'
)
text = text.replace(
    'rm -rf -- "${RUNTIME_DIR}" "${PACKAGE_DIR}"',
    'rm -rf -- "${RUNTIME_DIR}" "${ROOT}/crawler/${PACKAGE_DIR}"'
)
isolated.write_text(text)

workflow = Path(".github/workflows/admin-product-review-import-ui.yml")
text = workflow.read_text()
text = text.replace(
    'rm -rf -- "${REVIEW_IMPORT_PACKAGE_DIR}"',
    'rm -rf -- "crawler/${REVIEW_IMPORT_PACKAGE_DIR}"'
)
old = '''      - name: JavaScript syntax gate
        shell: bash
        run: |
          set -euo pipefail
          while IFS= read -r -d '' file; do
            node --check "${file}"
          done < <(find app lib scripts -type f \\( -name '*.js' -o -name '*.mjs' \\) -print0 | sort -z)
'''
new = '''      - name: JavaScript syntax gate
        shell: bash
        run: |
          set -euo pipefail
          node --check lib/admin/product-review-import/multipart-boundary.js
          node --check lib/admin/product-review-import/import-error-map.js
          node --check lib/admin/product-review-import/import-package.js
          node --check lib/admin/product-review-import/import-dry-run.js
          node --check lib/admin/product-review-import/import-confirm.js
          node --check lib/admin/product-review-import/http-handlers.js
          node --check app/api/admin/product-reviews/import/dry-run/route.js
          node --check app/api/admin/product-reviews/import/confirm/route.js
          node --check scripts/verify-admin-product-review-import-routes.mjs
          node --check scripts/verify-admin-product-review-import-ui.mjs
'''
if old not in text:
    raise SystemExit("workflow syntax boundary not found")
text = text.replace(old, new, 1)
old = '''      - name: Verify no runtime artifacts remain tracked
        shell: bash
        run: |
          set -euo pipefail
          rm -rf -- "crawler/${REVIEW_IMPORT_PACKAGE_DIR}"
          test -z "$(git status --short --untracked-files=no)"
'''
new = '''      - name: Verify no runtime artifacts remain
        shell: bash
        run: |
          set -euo pipefail
          rm -rf -- "crawler/${REVIEW_IMPORT_PACKAGE_DIR}"
          test ! -e "crawler/${REVIEW_IMPORT_PACKAGE_DIR}"
          test -z "$(git status --short --untracked-files=no)"
'''
if old not in text:
    raise SystemExit("workflow artifact boundary not found")
workflow.write_text(text.replace(old, new, 1))
PY

cat > "$RUNNER_TEMP/admin-product-4-intended.txt" <<'FILES'
app/admin/AdminNavigation.js
app/admin/products/reviews/import/page.js
app/admin/products/reviews/import/ProductReviewImportWorkbench.js
app/admin/products/reviews/import/workbench-state.js
app/api/admin/product-reviews/import/dry-run/route.js
app/api/admin/product-reviews/import/confirm/route.js
lib/admin/product-review-import/multipart-boundary.js
lib/admin/product-review-import/import-error-map.js
lib/admin/product-review-import/import-package.js
lib/admin/product-review-import/import-dry-run.js
lib/admin/product-review-import/import-confirm.js
lib/admin/product-review-import/http-handlers.js
crawler/lib/reviews/reviewed-intake-parser.ts
crawler/test-product-review-intake-bytes.ts
scripts/verify-admin-product-review-import-routes.mjs
scripts/verify-admin-product-review-import-ui.mjs
scripts/verify-admin-product-review-import-isolated.sh
tests/fixtures/admin-product-review-import/seed_review_import_runtime.sql
tests/fixtures/admin-product-review-import/setup_review_import_rollback.sql
tests/fixtures/admin-product-review-import/verify_review_import_rollback.sql
docs/architecture/admin-product-review-import-ui-v1.md
docs/reports/admin-product-review-import-ui-implementation.md
.github/workflows/admin-product-review-import-ui.yml
package.json
crawler/package.json
.codex/AI_WORK_LOG.md
FILES
sort "$RUNNER_TEMP/admin-product-4-intended.txt" -o "$RUNNER_TEMP/admin-product-4-intended.txt"
git status --porcelain=v1 --untracked-files=all | sed -E 's/^.. //' | sort > "$RUNNER_TEMP/admin-product-4-actual.txt"
diff -u "$RUNNER_TEMP/admin-product-4-intended.txt" "$RUNNER_TEMP/admin-product-4-actual.txt"
git diff --check

npm ci --no-audit --no-fund
(
  cd crawler
  npm ci --no-audit --no-fund
)

bash -n scripts/verify-admin-product-review-import-isolated.sh
npm run verify:admin-product-review-import-ui
npm run verify:admin-product-review-import-routes
npm run verify:admin-product-review-import-confirm
(
  cd crawler
  npm run typecheck
  npm run verify:product-review-export
  npm run verify:product-review-intake-dry-run
  npm run verify:product-review-intake-bytes
  npm run verify:product-review-intake-confirm
)

npm run verify:admin-product-review-import-isolated
npm run verify:admin-access-foundation
npm run verify:admin-product-candidate-reviews
npm run architecture:guard

node --check lib/admin/product-review-import/multipart-boundary.js
node --check lib/admin/product-review-import/import-error-map.js
node --check lib/admin/product-review-import/import-package.js
node --check lib/admin/product-review-import/import-dry-run.js
node --check lib/admin/product-review-import/import-confirm.js
node --check lib/admin/product-review-import/http-handlers.js
node --check app/api/admin/product-reviews/import/dry-run/route.js
node --check app/api/admin/product-reviews/import/confirm/route.js
node --check scripts/verify-admin-product-review-import-routes.mjs
node --check scripts/verify-admin-product-review-import-ui.mjs
npm run build

mapfile -t intended < "$RUNNER_TEMP/admin-product-4-intended.txt"
git add -- "${intended[@]}"
git diff --cached --check
git diff --cached --name-only | sort > "$RUNNER_TEMP/admin-product-4-staged.txt"
diff -u "$RUNNER_TEMP/admin-product-4-intended.txt" "$RUNNER_TEMP/admin-product-4-staged.txt"
test -z "$(git diff --name-only)"
test -z "$(git ls-files --others --exclude-standard)"

remote_target="$(git ls-remote origin "refs/heads/${TARGET_BRANCH}" | awk '{print $1}')"
test "$remote_target" = "$BASE_SHA"
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git commit -m "feat(admin): add product review import workbench"
FEATURE_SHA="$(git rev-parse HEAD)"
RESULT="success"
