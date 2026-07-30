import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TMP_DIR = path.join(ROOT, "tmp");
const OUTPUT_PATH = path.join(TMP_DIR, "security-closeout-verifier-suite.json");
const KEYWORDS = /(security|analysis|premium|image|face|result|saved|candidate|shadow|release|credential|environment|production|deployment|rls|grant|rate|idempot)/i;
const STEP_TIMEOUT_MS = 180_000;

const EXPECTED_VERIFIERS = [
  "verify-admin-product-candidate-reviews.mjs",
  "verify-analysis-request-guard.mjs",
  "verify-analysis-result-response-boundary.mjs",
  "verify-analysis-rls-contract.mjs",
  "verify-anonymous-write-grant-v2.mjs",
  "verify-candidate-policy-hint-receiver-design.mjs",
  "verify-evaluator-boundary-policy-production-observability.mjs",
  "verify-existing-recommendation-candidate-source.mjs",
  "verify-face-lab-keyword-summary.mjs",
  "verify-first-disabled-shadow-dry-run-minimal-patch.mjs",
  "verify-first-disabled-shadow-dry-run-patch-plan.mjs",
  "verify-first-disabled-shadow-dry-run-plan.mjs",
  "verify-first-isolated-shadow-route-check.mjs",
  "verify-functional-candidate-audit.mjs",
  "verify-functional-candidate-exposure-audit.mjs",
  "verify-functional-candidate-policy.mjs",
  "verify-functional-shadow-capture.mjs",
  "verify-functional-shadow-comparison.mjs",
  "verify-isolated-shadow-route-comparison.mjs",
  "verify-isolated-shadow-route-readiness.mjs",
  "verify-local-shadow-runtime-readiness.mjs",
  "verify-premium-browser-journey-contract.mjs",
  "verify-premium-decision-state.mjs",
  "verify-premium-identical-retry.mjs",
  "verify-premium-image-sanitizer-capacity.mjs",
  "verify-premium-integrated-evaluation.mjs",
  "verify-premium-release-mode.mjs",
  "verify-premium-report-reentry-contract.mjs",
  "verify-premium-route-storage-reentry.mjs",
  "verify-premium-session-payload-boundary.mjs",
  "verify-premium-session-runtime-diagnostics.mjs",
  "verify-premium-snapshot-diff.mjs",
  "verify-premium-snapshot-replay-diagnostics.mjs",
  "verify-production-env-preview-readiness-probe.mjs",
  "verify-sec06-saved-report-boundary.mjs",
  "verify-sec08-image-upload-boundary.mjs",
  "verify-sec09-public-result-read-boundary.mjs",
  "verify-sec10-image-origin-contract.mjs",
  "verify-sec10-security-headers.mjs",
  "verify-shadow-boundary-dry-run-helper.mjs",
  "verify-shadow-dry-run-implementation-plan.mjs",
  "verify-shadow-dry-run-route-static-guard.mjs",
  "verify-shadow-dry-run-snapshot-contract.mjs",
  "verify-shadow-flag-invariance-preflight.mjs",
  "verify-shadow-no-db-write-skeleton.mjs",
  "verify-shadow-no-recommendation-change-skeleton.mjs",
  "verify-shadow-no-response-change-skeleton.mjs",
  "verify-shadow-route-insertion-static-guard.mjs",
  "verify-shadow-runtime-dry-run-artifact-schema.mjs",
  "verify-shadow-runtime-dry-run-plan.mjs",
  "verify-shadow-safety-verifier-skeletons.mjs",
  "verify-shadow-verifier-integrity.mjs"
];

const PREPARATION_STEPS = [
  "verify-evaluator-boundary-actual-coverage.mjs",
  "verify-pure-engine-target-scenario-replay.mjs",
  "verify-evaluator-boundary-readiness-review.mjs",
  "verify-evaluator-boundary-integration-design.mjs",
  "verify-candidate-policy-hint-receiver-design.mjs",
  "verify-runtime-integration-acceptance-criteria.mjs",
  "verify-shadow-runtime-dry-run-plan.mjs",
  "verify-evaluator-boundary-required-contract-tests.mjs",
  "verify-shadow-safety-verifier-skeletons.mjs",
  "verify-shadow-dry-run-implementation-plan.mjs",
  "verify-shadow-route-insertion-static-guard.mjs",
  "review-shadow-boundary-dry-run-helper-skeleton.mjs",
  "verify-final-pre-runtime-integration-checklist.mjs",
  "verify-first-disabled-shadow-dry-run-plan.mjs",
  "verify-first-disabled-shadow-dry-run-patch-plan.mjs",
  "verify-isolated-shadow-route-comparison.mjs"
];

function sameOrdered(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function runScript(name, phase) {
  const startedAt = Date.now();
  const result = spawnSync(process.execPath, [path.join("scripts", name)], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: STEP_TIMEOUT_MS,
    env: {
      ...process.env,
      CI: "1",
      NODE_ENV: "test"
    },
    maxBuffer: 16 * 1024 * 1024
  });

  return {
    phase,
    name,
    status: result.status,
    signal: result.signal,
    timedOut: result.error?.code === "ETIMEDOUT",
    error: result.error ? String(result.error.message || result.error) : null,
    durationMs: Date.now() - startedAt,
    stdoutTail: (result.stdout || "").slice(-4_000),
    stderrTail: (result.stderr || "").slice(-4_000)
  };
}

const discovered = readdirSync(path.join(ROOT, "scripts"))
  .filter((name) => /^verify-.*\.mjs$/.test(name))
  .filter((name) => KEYWORDS.test(name))
  .sort();

if (!sameOrdered(discovered, EXPECTED_VERIFIERS)) {
  mkdirSync(TMP_DIR, { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify({
    suiteVersion: "security-closeout-verifier-suite-v1",
    status: "FAIL",
    reasonCode: "verifier_manifest_drift",
    expected: EXPECTED_VERIFIERS,
    discovered
  }, null, 2));
  throw new Error("security closeout verifier manifest drift detected");
}

rmSync(TMP_DIR, { recursive: true, force: true });
mkdirSync(TMP_DIR, { recursive: true });

const results = [];
for (const name of PREPARATION_STEPS) {
  const result = runScript(name, "preparation");
  results.push(result);
  console.log(`${result.status === 0 && !result.signal && !result.error ? "PASS" : "FAIL"} prep ${name}`);
  if (result.status !== 0 || result.signal || result.error) break;
}

if (results.every((result) => result.status === 0 && !result.signal && !result.error)) {
  for (const name of EXPECTED_VERIFIERS) {
    const result = runScript(name, "verification");
    results.push(result);
    console.log(`${result.status === 0 && !result.signal && !result.error ? "PASS" : "FAIL"} ${name}`);
  }
}

const verificationResults = results.filter((result) => result.phase === "verification");
const failures = results.filter((result) => result.status !== 0 || result.signal || result.error);
const status = failures.length === 0 && verificationResults.length === EXPECTED_VERIFIERS.length
  ? "PASS"
  : "FAIL";

const output = {
  suiteVersion: "security-closeout-verifier-suite-v1",
  status,
  expectedVerifierCount: EXPECTED_VERIFIERS.length,
  executedVerifierCount: verificationResults.length,
  passedVerifierCount: verificationResults.filter((result) => result.status === 0 && !result.signal && !result.error).length,
  failedVerifierCount: verificationResults.filter((result) => result.status !== 0 || result.signal || result.error).length,
  preparationStepCount: PREPARATION_STEPS.length,
  manifest: EXPECTED_VERIFIERS,
  results
};

writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`SECURITY_CLOSEOUT_VERIFIERS=${status} ${output.passedVerifierCount}/${output.expectedVerifierCount}`);

if (status !== "PASS") {
  process.exitCode = 1;
}
