import assert from "node:assert/strict";
import test from "node:test";
import { runFullRehearsal } from "../../rehearsal/run-full-rehearsal.mjs";
import { verifyRehearsalReport } from "../../rehearsal/report.mjs";

test("T10 composed rehearsal exercises 20 slots, failure matrix, cleanup, and zero external authority", async () => {
  const report = await runFullRehearsal({ sourceHeadSha: "test-source-head" });
  assert.equal(verifyRehearsalReport(report), true);
  assert.equal(report.slotsTotal, 20);
  assert.deepEqual(report.conditionCounts, { A: 5, B: 5, C: 5, D: 5 });
  assert.deepEqual(report.waveSchedule, [4, 8, 8]);
  assert.equal(report.moduleResults.every((item) => item.status === "passed"), true);
  assert.equal(report.failureInjectionResults.length >= 10, true);
  assert.equal(report.failureInjectionResults.every((item) => item.status === "passed"), true);
  assert.equal(report.providerCalls, 0);
  assert.equal(report.networkAttempts, 0);
  assert.equal(report.productionWrites, 0);
  assert.equal(report.authoritativeHumanReviews, 0);
  assert.equal(report.persistentAuthoritativeG4Created, 0);
  assert.equal(report.persistentAuthoritativeG5Created, 0);
  assert.equal(report.temporaryRootsCreated, report.temporaryRootsDeleted);
  assert.equal(report.cleanupVerified, true);
  assert.equal(report.localDataBoundaryUnchanged, true);
  assert.equal(report.singleArtifactLineageEndToEnd, false);
});
