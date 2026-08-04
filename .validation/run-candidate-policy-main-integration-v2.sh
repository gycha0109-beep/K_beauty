#!/usr/bin/env bash
set -euo pipefail

TARGET_BRANCH="codex/candidate-policy-main-integration"
BASE_REF="origin/codex/candidate-policy-design-audit-validation-base"
CORE_RUNNER="${RUNNER_TEMP}/run-candidate-policy-main-integration-core.sh"

# Durable historical verifiers use canonical local branch names for their
# comparison boundary. Materialize read-only local aliases without changing
# any branch content or weakening their assertions.
while read -r remote_ref; do
  local_ref="${remote_ref#refs/remotes/origin/}"
  if [[ "$local_ref" == "$TARGET_BRANCH" ]]; then
    continue
  fi
  git branch -f "$local_ref" "$remote_ref" >/dev/null 2>&1 || true
done < <(git for-each-ref --format="%(refname)" refs/remotes/origin/codex/)

git show "$BASE_REF:.validation/run-candidate-policy-main-integration.sh" > "$CORE_RUNNER"
bash -n "$CORE_RUNNER"
chmod +x "$CORE_RUNNER"
exec "$CORE_RUNNER"
