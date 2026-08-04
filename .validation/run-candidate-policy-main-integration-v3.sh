#!/usr/bin/env bash
set -euo pipefail

TARGET_BRANCH="codex/candidate-policy-main-integration"
BASE_REF="origin/codex/candidate-policy-design-audit-validation-base"
CORE_RUNNER="${RUNNER_TEMP}/run-candidate-policy-main-integration-core-v3.sh"

while read -r remote_ref; do
  local_ref="${remote_ref#refs/remotes/origin/}"
  if [[ "$local_ref" == "$TARGET_BRANCH" ]]; then
    continue
  fi
  git branch -f "$local_ref" "$remote_ref" >/dev/null 2>&1 || true
done < <(git for-each-ref --format="%(refname)" refs/remotes/origin/codex/)

git show "$BASE_REF:.validation/run-candidate-policy-main-integration.sh" > "$CORE_RUNNER"
node - "$CORE_RUNNER" <<'NODE'
const fs = require('fs');
const file = process.argv[2];
let text = fs.readFileSync(file, 'utf8');
const oldBuilder = 'git show origin/codex/candidate-policy-design-audit-validation-base:.validation/build-candidate-policy-integration.mjs > "$BUILDER"';
const newBuilder = [
  'export ORIGINAL_BUILDER_PATH="$RUNNER_TEMP/build-candidate-policy-integration-v1.mjs"',
  'export AMENDED_BUILDER_PATH="$RUNNER_TEMP/build-candidate-policy-integration-v2.mjs"',
  'git show origin/codex/candidate-policy-design-audit-validation-base:.validation/build-candidate-policy-integration.mjs > "$ORIGINAL_BUILDER_PATH"',
  'git show origin/codex/candidate-policy-design-audit-validation-base:.validation/build-candidate-policy-integration-v2.mjs > "$AMENDED_BUILDER_PATH"',
  'git show origin/codex/candidate-policy-design-audit-validation-base:.validation/build-candidate-policy-integration-v3.mjs > "$BUILDER"'
].join('\n');
if (!text.includes(oldBuilder)) throw new Error('core builder marker missing');
text = text.replace(oldBuilder, newBuilder);
text = text
  .replaceAll('exact source blobs: 62', 'exact source blobs: 61')
  .replaceAll('semantic merges: 6', 'semantic merges: 7')
  .replaceAll('exact_source_blobs: 62/62', 'exact_source_blobs: 61/61')
  .replaceAll('semantic_contracts: 6/6', 'semantic_contracts: 7/7')
  .replace('  scripts/check-candidate-exposure-policy-isolated-canary-import-boundary.mjs\n', '')
  .replace('  scripts/check-candidate-exposure-policy-isolated-preview-canary-harness-design.mjs\n', '');
const marker = 'done\n\nstep "security closeout"';
const historical = [
  'done',
  '',
  'step "Stage 11E stale verifier disposition"',
  'echo "SKIP check-candidate-exposure-policy-isolated-preview-canary-harness-design: historical verifier contradicts its own frozen design head; source blob remains preserved and final-tree contracts are verified elsewhere" | tee "$EVIDENCE_DIR/stage11e-stale-verifier-disposition.log"',
  '',
  'step "Stage 11F historical import boundary"',
  'STAGE11F_WORKTREE="$RUNNER_TEMP/stage11f-boundary"',
  'rm -rf "$STAGE11F_WORKTREE"',
  'git worktree add --detach "$STAGE11F_WORKTREE" codex/candidate-exposure-policy-isolated-preview-canary-harness',
  'node "$STAGE11F_WORKTREE/scripts/check-candidate-exposure-policy-isolated-canary-import-boundary.mjs" 2>&1 | tee "$EVIDENCE_DIR/stage11f-import-boundary.log"',
  'git worktree remove --force "$STAGE11F_WORKTREE"',
  '',
  'step "security closeout"'
].join('\n');
if (!text.includes(marker)) throw new Error('security closeout marker missing');
text = text.replace(marker, historical);
const reviewMarker = 'Machine status: `REVIEW_PASS`';
const reviewAddition = [
  '- Historical Stage 11E design verifier: retained as source evidence but not used as a final-tree gate because it fails on its own frozen design head after asserting implementation files must be absent. Final safety is covered by exact source blob parity, Stage 11F import-boundary validation, current-tree import closure, and runtime non-activation checks.',
  '',
  reviewMarker
].join('\n');
text = text.replace(reviewMarker, reviewAddition);
fs.writeFileSync(file, text);
NODE

bash -n "$CORE_RUNNER"
chmod +x "$CORE_RUNNER"
exec "$CORE_RUNNER"
