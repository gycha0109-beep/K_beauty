import assert from "node:assert/strict";
import {
  HOSTED_FAILURE_CATEGORIES,
  REQUIRED_HOSTED_LANES,
  compareLocaleSemantics,
  evaluateHostedVerdict,
  sanitizeEvidence
} from "./premium-hosted-preview-core.mjs";

const parity = compareLocaleSemantics(
  { functionalStatus: "start", routineStatus: "safe", conditionStatus: "maintain", consistencyVerdict: "pass", topPickId: "p1", snapshotFingerprint: "f1" },
  { functionalStatus: "start", routineStatus: "safe", conditionStatus: "maintain", consistencyVerdict: "pass", topPickId: "p1", snapshotFingerprint: "f1" }
);
assert.equal(parity.passed, true);
assert.equal(compareLocaleSemantics({ topPickId: "p1" }, { topPickId: "p2" }).passed, false);

assert.throws(() => sanitizeEvidence({ accessToken: "secret" }), (error) => error.category === HOSTED_FAILURE_CATEGORIES.HARNESS);
assert.deepEqual(sanitizeEvidence({ status: "passed", nested: { savedReportIdHash: "sha256:x" } }), { status: "passed", nested: { savedReportIdHash: "sha256:x" } });

const allPassed = REQUIRED_HOSTED_LANES.map((name) => ({ name, status: "passed", severity: "important" }));
assert.equal(evaluateHostedVerdict(allPassed).status, "passed");
assert.equal(evaluateHostedVerdict(allPassed.filter((lane) => lane.name !== "safe-5xx")).status, "failed");
const failed = structuredClone(allPassed);
failed[0].status = "failed";
failed[0].severity = "critical";
assert.equal(evaluateHostedVerdict(failed).criticalCount, 1);

console.log("premium hosted preview contract verification passed");
