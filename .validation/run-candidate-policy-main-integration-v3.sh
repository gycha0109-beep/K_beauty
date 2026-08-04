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
  'git show origin/codex/candidate-policy-design-audit-validation-base:.validation/build-candidate-policy-integration.mjs > "$ORIGINAL_BUILDER_PATH"',
  'git show origin/codex/candidate-policy-design-audit-validation-base:.validation/build-candidate-policy-integration-v2.mjs > "$BUILDER"'
].join('\n');
if (!text.includes(oldBuilder)) throw new Error('core builder marker missing');
text = text.replace(oldBuilder, newBuilder);
text = text
  .replaceAll('exact source blobs: 62', 'exact source blobs: 61')
  .replaceAll('semantic merges: 6', 'semantic merges: 7')
  .replaceAll('exact_source_blobs: 62/62', 'exact_source_blobs: 61/61')
  .replaceAll('semantic_contracts: 6/6', 'semantic_contracts: 7/7');
fs.writeFileSync(file, text);
NODE

bash -n "$CORE_RUNNER"
chmod +x "$CORE_RUNNER"
exec "$CORE_RUNNER"
