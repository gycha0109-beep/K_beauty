import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  assertValidSyntheticCanaryRunId,
  resolveSyntheticCanaryEvidencePath,
  writeSyntheticCanaryEvidenceExclusive
} from "./lib/evaluator-boundary-policy-synthetic-canary-evidence.mjs";

assert.equal(assertValidSyntheticCanaryRunId("phase46-3b-20260714-01"), "phase46-3b-20260714-01");
for (const invalid of ["", "../escape", "nested/run", "has space", " leading", "/absolute", "C:\\absolute", "control\nchar", "."] ) {
  assert.throws(() => assertValidSyntheticCanaryRunId(invalid), /invalid_synthetic_canary_run_id/);
}

const sandbox = await mkdtemp(path.join(tmpdir(), "synthetic-canary-collision-"));
try {
  const runId = "collision-negative-control";
  const evidence = { evidenceType: "synthetic_canary_collision_negative_control" };
  const evidencePath = await writeSyntheticCanaryEvidenceExclusive({ runId, evidence, outputRoot: sandbox });
  assert.equal(evidencePath, resolveSyntheticCanaryEvidencePath(runId, sandbox));
  assert.deepEqual(JSON.parse(await readFile(evidencePath, "utf8")), evidence);

  await assert.rejects(
    writeSyntheticCanaryEvidenceExclusive({ runId, evidence, outputRoot: sandbox }),
    (error) => error?.code === "EEXIST"
  );
} finally {
  await rm(sandbox, { recursive: true, force: true });
}

console.log("verify-evaluator-boundary-policy-synthetic-canary-run-scope passed");
