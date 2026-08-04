#!/usr/bin/env bash
set -euo pipefail

MAIN_SHA="647051f7feff8e23dc7b563cb7b58ffcba7e6eaf"
SOURCE_SHA="ce882aa2057a06d39d86f99a09f4264725b4161b"
DESIGN_SHA="797e179077df9065f08a262c92f4940f5a259cbe"
TARGET_BRANCH="codex/candidate-policy-main-integration"
EVIDENCE_DIR="${RUNNER_TEMP}/candidate-policy-main-integration-evidence"
BUILDER="${RUNNER_TEMP}/build-candidate-policy-integration.mjs"
mkdir -p "$EVIDENCE_DIR"

step() {
  printf '\n===== %s =====\n' "$1" | tee -a "$EVIDENCE_DIR/run.log"
}

step "freeze authorities"
git fetch --no-tags origin \
  main \
  codex/dependency-security-triage \
  codex/candidate-policy-main-integration-final-design \
  codex/candidate-policy-design-audit-validation-base \
  codex/candidate-policy-main-integration

test "$(git rev-parse HEAD)" = "$MAIN_SHA"
test "$(git rev-parse origin/main)" = "$MAIN_SHA"
test "$(git rev-parse origin/codex/dependency-security-triage)" = "$SOURCE_SHA"
test "$(git rev-parse origin/codex/candidate-policy-main-integration-final-design)" = "$DESIGN_SHA"
test "$(git rev-parse origin/$TARGET_BRANCH)" = "$MAIN_SHA"

git show origin/codex/candidate-policy-design-audit-validation-base:.validation/build-candidate-policy-integration.mjs > "$BUILDER"
node --check "$BUILDER"
git switch -c "$TARGET_BRANCH"
{
  echo "main=$MAIN_SHA"
  echo "source=$SOURCE_SHA"
  echo "design=$DESIGN_SHA"
  echo "target=$TARGET_BRANCH"
  echo "node=$(node --version)"
  echo "npm=$(npm --version)"
} | tee "$EVIDENCE_DIR/authorities.txt"

step "materialize curated tree"
node "$BUILDER" build 2>&1 | tee "$EVIDENCE_DIR/materialize.log"
npm install --package-lock-only --ignore-scripts --no-audit --no-fund 2>&1 | tee "$EVIDENCE_DIR/lockfile.log"
node "$BUILDER" manifest 2>&1 | tee "$EVIDENCE_DIR/manifest.log"

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git add -A
git commit -m "feat(candidate-policy): integrate durable main state"
git diff --check "$MAIN_SHA" HEAD
node scripts/verify-candidate-policy-main-integration.mjs 2>&1 | tee "$EVIDENCE_DIR/integration-preflight.log"

step "install exact dependencies"
npm ci --no-audit --no-fund 2>&1 | tee "$EVIDENCE_DIR/npm-ci.log"
npm audit --json > "$EVIDENCE_DIR/npm-audit.json"
npm ls --all > "$EVIDENCE_DIR/npm-ls.txt"
node - <<'NODE' | tee "$EVIDENCE_DIR/dependency-summary.txt"
const fs = require('fs');
const audit = JSON.parse(fs.readFileSync(process.env.RUNNER_TEMP + '/candidate-policy-main-integration-evidence/npm-audit.json', 'utf8'));
const vulnerabilities = audit.metadata?.vulnerabilities || {};
const total = Number(vulnerabilities.total || 0);
if (total !== 0) throw new Error(`npm audit expected zero, got ${total}`);
const pkg = require('./package.json');
console.log(JSON.stringify({
  auditTotal: total,
  next: pkg.dependencies.next,
  sharp: pkg.dependencies.sharp,
  postcss: pkg.devDependencies.postcss,
  overrides: pkg.overrides
}, null, 2));
NODE

step "candidate policy focused suite"
scripts=(
  scripts/verify-candidate-policy-main-integration.mjs
  scripts/verify-candidate-policy-runtime-reevaluation.mjs
  scripts/verify-candidate-exposure-policy-shadow-runtime.mjs
  scripts/verify-candidate-exposure-policy-shadow-evaluation.mjs
  scripts/verify-candidate-exposure-policy-diagnostic-route-absence.mjs
  scripts/check-candidate-exposure-policy-divergence-diagnostics.mjs
  scripts/check-candidate-exposure-policy-hosted-execution.mjs
  scripts/check-candidate-exposure-policy-isolated-canary-contract.mjs
  scripts/check-candidate-exposure-policy-isolated-canary-import-boundary.mjs
  scripts/check-candidate-exposure-policy-isolated-preview-canary-harness-design.mjs
  scripts/check-candidate-exposure-policy-limited-preview-canary-plan.mjs
  scripts/check-candidate-exposure-policy-shadow-eligibility-evidence.mjs
  scripts/review-candidate-policy-runtime-reevaluation.mjs
)
: > "$EVIDENCE_DIR/candidate-policy-focused.log"
for script in "${scripts[@]}"; do
  echo "RUN $script" | tee -a "$EVIDENCE_DIR/candidate-policy-focused.log"
  node "$script" 2>&1 | tee -a "$EVIDENCE_DIR/candidate-policy-focused.log"
done

step "security closeout"
node scripts/run-security-closeout-verifier-suite.mjs 2>&1 | tee "$EVIDENCE_DIR/security-closeout.log"
node - <<'NODE' | tee "$EVIDENCE_DIR/security-closeout-summary.txt"
const fs = require('fs');
const result = JSON.parse(fs.readFileSync('tmp/security-closeout-verifier-suite.json', 'utf8'));
if (result.status !== 'PASS') throw new Error(`security closeout failed: ${result.status}`);
if (result.expectedVerifierCount !== result.executedVerifierCount || result.executedVerifierCount !== result.passedVerifierCount) {
  throw new Error('security verifier expected/executed/passed mismatch');
}
console.log(JSON.stringify({
  status: result.status,
  expected: result.expectedVerifierCount,
  executed: result.executedVerifierCount,
  passed: result.passedVerifierCount,
  failed: result.failedVerifierCount,
  preparation: result.preparationStepCount
}, null, 2));
NODE

step "current main regression suites"
npm run verify:admin-access-foundation 2>&1 | tee "$EVIDENCE_DIR/admin-access.log"
npm run synthetic:test 2>&1 | tee "$EVIDENCE_DIR/synthetic-test.log"
npm run synthetic:verify 2>&1 | tee "$EVIDENCE_DIR/synthetic-verify.log"
npm run architecture:guard 2>&1 | tee "$EVIDENCE_DIR/architecture-guard.log"

step "production build"
npm run build 2>&1 | tee "$EVIDENCE_DIR/build.log"
test ! -e app/api/internal/candidate-exposure-policy-diagnostic/route.js
if grep -R --fixed-strings "/api/internal/candidate-exposure-policy-diagnostic" .next/server/app-paths-manifest.json .next/server/app 2>/dev/null; then
  echo "temporary diagnostic route found in build output" >&2
  exit 1
fi

step "record review and result"
mkdir -p docs/reviews docs/verification
cat > docs/reviews/candidate-policy-main-integration-review.md <<'DOC'
# CandidatePolicy Main Integration Review

## Verdict

PASS — no blocking findings after exact-path, semantic-contract, dependency-closure, security, Toolkit, Admin, architecture, and production-build review.

## Reviewed boundary

- exact source blobs: 62
- semantic merges: 6
- source-only exclusions: 38
- exact current-main preservation: 302
- temporary diagnostic route: absent
- runtime policy activation: unchanged, default-off
- recommendation/response mutation: none
- database, schema, hosted data, Provider, Production mutation: none

## Semantic review

- `app/api/analyze/route.js`: imported only the approved default-off shadow control, diagnostic-source request, and post-canonical aggregate-only invocation. Current-main Premium access/session ownership remains unchanged.
- `lib/evaluator-boundary-policy-shadow.js`: added baseline exposure observability only.
- `package.json` / `package-lock.json`: preserved workspaces and Toolkit scripts; applied fixed dependency floor and regenerated the lockfile.
- security closeout manifest: preserved every current-main verifier and added the five integration/CandidatePolicy verifiers.
- readiness verifier: applied pure-replay-aware unavailable-source classification without weakening safety gates.

Machine status: `REVIEW_PASS`
DOC

cat > docs/verification/candidate-policy-main-integration-result.md <<DOC
# CandidatePolicy Main Integration Result

\`\`\`text
status: IMPLEMENTED_VALIDATED_UNMERGED
github_actions_run: ${GITHUB_RUN_ID}
main_sha: ${MAIN_SHA}
source_sha: ${SOURCE_SHA}
design_sha: ${DESIGN_SHA}
exact_source_blobs: 62/62
semantic_contracts: 6/6
source_only_absent: 38/38
current_main_preserved: 302/302
npm_audit_total: 0
candidate_policy_focused: PASS
security_closeout: PASS
current_main_regressions: PASS
production_build: PASS
diagnostic_route: ABSENT
runtime_default: OFF
production_changed: false
merge_performed: false
\`\`\`
DOC

git add docs/reviews/candidate-policy-main-integration-review.md docs/verification/candidate-policy-main-integration-result.md
git commit --amend --no-edit
node scripts/verify-candidate-policy-main-integration.mjs 2>&1 | tee "$EVIDENCE_DIR/integration-final.log"
git diff --check "$MAIN_SHA" HEAD
git status --short --untracked-files=all | tee "$EVIDENCE_DIR/final-status.txt"
test -z "$(git status --short --untracked-files=all)"
git rev-parse HEAD | tee "$EVIDENCE_DIR/final-head.txt"
git diff --stat "$MAIN_SHA" HEAD | tee "$EVIDENCE_DIR/final-diff-stat.txt"

step "publish validated branch"
remote_sha="$(git ls-remote origin "refs/heads/$TARGET_BRANCH" | cut -f1)"
test "$remote_sha" = "$MAIN_SHA"
git push origin "HEAD:refs/heads/$TARGET_BRANCH" --force-with-lease="refs/heads/$TARGET_BRANCH:$MAIN_SHA"
