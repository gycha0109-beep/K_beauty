import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildCandidatePolicyRuntimeReevaluation } from "./review-candidate-policy-runtime-reevaluation.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ARCHITECTURE =
  "docs/architecture/candidate-policy-runtime-reevaluation-v1.md";
const REVIEW = "docs/reviews/candidate-policy-runtime-reevaluation-review.md";
const ALLOWED_CHANGED_FILES = new Set([
  ".codex/AI_WORK_LOG.md",
  ARCHITECTURE,
  REVIEW,
  "app/api/analyze/route.js",
  "docs/architecture/candidate-exposure-policy-shadow-runtime-v1.md",
  "docs/verification/candidate-exposure-policy-shadow-runtime-result.md",
  "lib/candidate-exposure-policy-contract.js",
  "lib/candidate-exposure-policy-evaluator-adapter.js",
  "lib/candidate-exposure-policy-observability.js",
  "lib/candidate-exposure-policy-shadow.js",
  "lib/candidate-exposure-policy.js",
  "lib/evaluator-boundary-policy-shadow.js",
  "package.json",
  "scripts/review-candidate-policy-runtime-reevaluation.mjs",
  "scripts/run-security-closeout-verifier-suite.mjs",
  "scripts/verify-candidate-exposure-policy-shadow-runtime.mjs",
  "scripts/verify-candidate-policy-runtime-reevaluation.mjs",
  "scripts/verify-evaluator-boundary-readiness-review.mjs"
]);

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

let assertions = 0;
function check(condition, message) {
  assertions += 1;
  assert.ok(condition, message);
}

const first = buildCandidatePolicyRuntimeReevaluation();
const second = buildCandidatePolicyRuntimeReevaluation();
assertions += 1;
assert.deepEqual(second, first, "review output must be deterministic");

check(first.decision === "C", "option C must be the recorded decision");
check(first.runtime.isProductionGraph, "evaluator runtime must be classified as production graph");
check(first.runtime.filtersCandidateArray, "runtime must be proven to filter the candidate array");
check(
  first.runtime.canonicalStateBuiltAfterLegacyBundle,
  "canonical Premium decision state must be proven to build after the legacy bundle"
);
check(
  first.runtime.receivesCurrentProductFindingsAtCaller === false,
  "runtime caller must record the current findings gap"
);
check(
  first.shadow.receivesCurrentProductFindingsAtCaller === false,
  "shadow caller must record the current findings gap"
);
check(
  first.functionalCandidatePolicy.classification === "verifier_only",
  "functional-candidate-policy must remain verifier-only"
);
check(
  first.functionalCandidatePolicy.productionImporters.length === 0,
  "functional-candidate-policy must have no production importer"
);
check(first.control.enableFlag, "runtime enable flag must be audited");
check(first.control.killSwitch, "runtime kill switch must be audited");
check(first.control.productionCanaryScope, "production canary guard must be audited");
check(first.constraints.designOnly, "artifact must remain design-only");
check(!first.constraints.runtimeActivationAllowed, "runtime activation must be prohibited");
check(
  !first.constraints.candidateVisibilityChangeAllowed,
  "candidate visibility changes must be prohibited"
);
check(
  !first.constraints.recommendationOutputChangeAllowed,
  "recommendation output changes must be prohibited"
);

const architecture = read(ARCHITECTURE);
const review = read(REVIEW);
for (const heading of [
  "## 1. 현재 상태",
  "## 2. 실제 call graph",
  "## 3. 분류와 입출력 schema",
  "## 4. canonical 책임 모델",
  "## 5. current product semantics",
  "## 6. goal·safety authority",
  "## 7. downstream enforcement와 bypass",
  "## 8. flag·kill switch·canary",
  "## 9. observability",
  "## 10. 옵션 A/B/C/D 비교",
  "## 11. 최종 권장안",
  "## 12. 구현 단계 계획",
  "## 13. 회귀 검증 매트릭스",
  "## 14. rollback",
  "## 15. Production activation 전제조건"
]) {
  check(architecture.includes(heading), `architecture heading is required: ${heading}`);
}

for (const option of ["### A.", "### B.", "### C.", "### D."]) {
  check(architecture.includes(option), `option analysis is required: ${option}`);
}

for (const exposure of [
  "primary",
  "contextual",
  "collapsed",
  "hidden",
  "insufficient_evidence"
]) {
  check(architecture.includes(exposure), `exposure state is required: ${exposure}`);
}

for (const marker of [
  "DESIGN_ONLY",
  "RUNTIME_NOT_ACTIVATED",
  "CANDIDATE_VISIBILITY_NOT_CHANGED",
  "RECOMMENDATION_OUTPUT_NOT_CHANGED",
  "CI_NOT_USED",
  "GITHUB_ACTIONS_NOT_USED",
  "LOCAL_SELF_VERIFICATION_COMPLETED",
  "PRODUCTION_NOT_CHANGED"
]) {
  check(architecture.includes(marker), `safety marker is required: ${marker}`);
}

for (const section of [
  "## Critical",
  "## Important",
  "## Minor",
  "## Dead path",
  "## 중복 정책",
  "## Stale adapter",
  "## Unguarded bypass",
  "## Missing evidence",
  "## 최종 판정"
]) {
  check(review.includes(section), `review section is required: ${section}`);
}

const changedFiles = execFileSync(
  "git",
  ["diff", "--name-only", "codex/stage10-hosted-preview-user-flow...HEAD"],
  { cwd: ROOT, encoding: "utf8" }
)
  .split(/\r?\n/)
  .filter(Boolean);
for (const file of changedFiles) {
  check(ALLOWED_CHANGED_FILES.has(file), `runtime or unrelated file changed: ${file}`);
}

const workingFiles = execFileSync("git", ["status", "--short"], {
  cwd: ROOT,
  encoding: "utf8"
})
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => line.slice(3).replaceAll("\\", "/"));
for (const file of workingFiles) {
  check(ALLOWED_CHANGED_FILES.has(file), `working tree contains unrelated file: ${file}`);
}

console.log(
  `verify-candidate-policy-runtime-reevaluation: ok (${assertions} assertions)`
);
