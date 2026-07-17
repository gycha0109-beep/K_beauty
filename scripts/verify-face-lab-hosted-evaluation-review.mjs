import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function loadCore() {
  const source = readFileSync("lib/face-lab-hosted-evaluation.js", "utf8")
    .replace(/export const /g, "const ")
    .replace(/export function /g, "function ");
  return Function(`${source}\nreturn { adaptLegacyHostedEvaluationRecord, summarizeHostedEvaluation, renderHostedEvaluationReport, parseHostedEvaluationJsonLines };`)();
}

const core = loadCore();
const legacySuccess = {
  schemaVersion: "face-lab-hosted-eval-record-v1",
  runId: "face-lab-legacy-smoke",
  caseId: "subject-a-frontal-clear:ko:1",
  fixtureId: "subject-a-frontal-clear",
  subjectId: "subject-a",
  comparisonGroup: "subject-a",
  variantRole: "baseline",
  conditionTags: ["clear"],
  expectedEligibility: "eligible",
  expectedDegradation: "none",
  locale: "ko",
  repetition: 1,
  httpStatus: 200,
  durationMs: 100,
  requestError: null,
  eligibility: { faceLabEligible: true },
  analysis: { schemaVersion: "face-lab-observation-v1", status: "available", sourceImagePersisted: false, observations: {}, coverage: {}, quality: {} },
  privacyAudit: { rawObservationKeyFound: false, imagePayloadFound: false, unknownProviderKeyFound: false, canonicalContractInvalid: false }
};
const legacy429 = (index) => ({
  schemaVersion: "face-lab-hosted-eval-record-v1",
  runId: "face-lab-legacy-smoke",
  caseId: `limited-${index}:ko:1`,
  fixtureId: `limited-${index}`,
  subjectId: "subject-a",
  comparisonGroup: "limited",
  variantRole: "variant",
  conditionTags: ["limited"],
  expectedEligibility: index % 2 ? "eligible" : "ineligible",
  expectedDegradation: "none",
  locale: "ko",
  repetition: 1,
  httpStatus: 429,
  durationMs: 10,
  requestError: null,
  eligibility: null,
  analysis: null,
  privacyAudit: { rawObservationKeyFound: false, imagePayloadFound: false, unknownProviderKeyFound: true, canonicalContractInvalid: false }
});

const rows = [legacySuccess, { ...legacySuccess, caseId: "subject-a-frontal-clear:en:1", locale: "en" }, ...Array.from({ length: 6 }, (_, index) => legacy429(index + 1))];
const parsed = core.parseHostedEvaluationJsonLines(`${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
const summary = core.summarizeHostedEvaluation(parsed.records, {
  runId: "face-lab-legacy-smoke",
  datasetId: "local-smoke-001",
  plan: "smoke",
  plannedCalls: 8
}, parsed.integrity);

assert.equal(summary.gateStatus, "INCONCLUSIVE");
assert.equal(summary.evaluationComplete, false);
assert.equal(summary.contractFailures.privacyViolations, 0);
assert.equal(summary.contractFailures.canonicalContractFailures, 0);
assert.equal(summary.contractFailures.ineligibleCanonicalViolations, 0);
assert.equal(summary.expectationFailures.eligibilityMismatches, 0);
assert.equal(summary.operationalFailures.rateLimitedCases, 6);
assert.equal(summary.evaluationCounts.evaluableCases, 2);
assert.equal(summary.evaluationCounts.notEvaluableCases, 6);
assert.equal(summary.legacyClassification, true);
assert.equal(summary.classificationConfidence, "partial");

const report = core.renderHostedEvaluationReport(summary);
assert.match(report, /Gate status: INCONCLUSIVE/);
assert.match(report, /Privacy violations: 0/);
assert.match(report, /Eligibility mismatches: 0/);
assert.match(report, /Rate-limited cases: 6/);
assert.match(report, /Not evaluable cases: 6/);

const runnerSource = readFileSync("scripts/run-face-lab-hosted-evaluation.mjs", "utf8");
const reporterSource = readFileSync("scripts/report-face-lab-hosted-evaluation.mjs", "utf8");
const transportSource = readFileSync("lib/face-lab-hosted-evaluation-transport.mjs", "utf8");
assert.match(runnerSource, /rate_limit_circuit_open/);
assert.match(runnerSource, /max-attempts/);
assert.match(runnerSource, /max-response-bytes/);
assert.match(runnerSource, /max-image-bytes/);
assert.match(runnerSource, /recover-stale-lock/);
assert.match(transportSource, /redirect: "error"/);
assert.match(reporterSource, /records_changed_during_summary/);
assert.equal(transportSource.includes("console.log"), false);
assert.equal(runnerSource.includes("console.log(image"), false);
assert.equal(runnerSource.includes("console.log(bytes"), false);

console.log("Face Lab hosted evaluation v2 review and legacy classification checks passed.");
