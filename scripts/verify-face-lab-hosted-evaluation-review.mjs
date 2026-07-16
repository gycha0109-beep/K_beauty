import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  hardenHostedEvaluationRecord,
  hardenHostedEvaluationReport,
  hardenHostedEvaluationSummary
} from "../lib/face-lab-hosted-evaluation-review.js";

const validAnalysis = {
  schemaVersion: "face-lab-observation-v1",
  status: "available",
  quality: {},
  observations: {},
  coverage: {},
  privacy: { sourceImagePersisted: false }
};
const baseRecord = {
  expectedEligibility: "eligible",
  httpStatus: 200,
  requestError: null,
  eligibility: { faceLabEligible: true },
  analysis: { sourceImagePersisted: false },
  privacyAudit: {}
};
const validRecord = hardenHostedEvaluationRecord(baseRecord, {
  data: { analysis: validAnalysis }
});
assert.equal(validRecord.privacyAudit.canonicalContractInvalid, false);

const invalidRecord = hardenHostedEvaluationRecord(baseRecord, {
  data: { analysis: { ...validAnalysis, schemaVersion: "wrong-version" } }
});
assert.equal(invalidRecord.privacyAudit.canonicalContractInvalid, true);

const hardened = hardenHostedEvaluationSummary(
  [
    validRecord,
    {
      ...invalidRecord,
      expectedEligibility: "ineligible",
      httpStatus: 429,
      eligibility: { faceLabEligible: true }
    }
  ],
  {
    requestFailures: 0,
    hardInvariantFailures: 0,
    issues: [],
    baseline: { total: 1, usable: 1, usableRate: 1 },
    repeatAgreement: {},
    localeAgreement: {},
    latency: {}
  }
);
assert.equal(hardened.requestFailures, 1);
assert.equal(hardened.canonicalContractFailures, 1);
assert.equal(hardened.eligibilityMismatches, 1);
assert.equal(hardened.hardInvariantFailures, 2);
assert.equal(hardened.issues.some((issue) => issue.code === "hard_invariant_failure"), true);
assert.equal(hardened.issues.some((issue) => issue.code === "eligibility_mismatch"), true);

const report = hardenHostedEvaluationReport(
  "# Report\n\n- Total hard invariant failures: 2\n",
  hardened
);
assert.equal(report.includes("Canonical contract failures: 1"), true);
assert.equal(report.includes("Eligibility mismatches: 1"), true);

const runnerSource = readFileSync("scripts/run-face-lab-hosted-evaluation.mjs", "utf8");
const reporterSource = readFileSync("scripts/report-face-lab-hosted-evaluation.mjs", "utf8");
assert.equal(runnerSource.includes("--base-url must use HTTP on localhost"), true);
assert.equal(runnerSource.includes("tmp/face-lab-hosted-evaluation/"), true);
assert.equal(runnerSource.includes("parsed.username || parsed.password"), true);
assert.equal(reporterSource.includes("--run-dir must stay inside tmp/face-lab-hosted-evaluation/"), true);

console.log("Face Lab hosted evaluation review metrics checks passed.");
