import assert from "node:assert/strict";
import fs from "node:fs";

function argValue(name) {
  const prefix = "--" + name + "=";
  const arg = process.argv.slice(2).find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

const resultPath = argValue("result");
const mode = argValue("mode");
const expectedCaseCountRaw = argValue("expected-case-count");

if (!resultPath || !["shadow", "record"].includes(mode)) {
  throw new Error(
    "Usage: node scripts/verify-trust-phase8i3d-live-result.mjs --result=<json> --mode=shadow|record [--expected-case-count=N]",
  );
}

const expectedCaseCount =
  expectedCaseCountRaw === null ? null : Number(expectedCaseCountRaw);
if (
  expectedCaseCount !== null &&
  (!Number.isInteger(expectedCaseCount) || expectedCaseCount < 0)
) {
  throw new Error("expected-case-count must be a non-negative integer");
}

const result = JSON.parse(fs.readFileSync(resultPath, "utf8"));
assert.equal(result.contract, "trust-phase8i3-transport-drift-handoff-result-v1");
assert.equal(
  result.authority,
  "NO_AUTOMATIC_RELOCATION_OR_PRODUCT_FACT_MUTATION",
);
assert.equal(result.registry_version, "v1");
assert.equal(typeof result.case_count, "number");
assert.equal(Array.isArray(result.rows), true);
assert.equal(result.rows.length, result.case_count);

if (expectedCaseCount !== null) {
  assert.equal(result.case_count, expectedCaseCount);
}

const evaluatedRows = result.rows.filter((row) => row.status === "EVALUATED");
const skippedRows = result.rows.filter((row) => row.status === "SKIPPED");
assert.equal(result.evaluated_count, evaluatedRows.length);
assert.equal(result.skipped_count, skippedRows.length);
assert.equal(result.case_count, result.evaluated_count + result.skipped_count);
assert.ok(result.network_evaluation_count <= result.evaluated_count);

const allowedKinds = new Set([
  "READY_FOR_8I4",
  "HOLD",
  "RETRYABLE",
  "POLICY_REQUIRED",
]);

for (const row of evaluatedRows) {
  assert.ok(allowedKinds.has(row.result_kind));
  assert.equal(typeof row.case_id, "string");
  assert.equal(typeof row.case_key, "string");
  assert.equal(typeof row.result_digest, "string");
  assert.equal(typeof row.input_digest, "string");
}
for (const row of skippedRows) {
  assert.equal(typeof row.case_id, "string");
  assert.equal(typeof row.skip_reason, "string");
}

if (mode === "shadow") {
  assert.equal(result.record, false);
  assert.equal(result.recorded_count, 0);
  for (const row of evaluatedRows) {
    assert.equal(row.recorder_result, null);
  }
} else {
  assert.equal(result.record, true);
  assert.equal(result.recorded_count, result.evaluated_count);
  for (const row of evaluatedRows) {
    assert.ok(row.recorder_result);
  }
}

const summary = {
  contract: "trust-phase8i3d-live-result-verification-v1",
  result: "PASS",
  mode,
  case_count: result.case_count,
  evaluated_count: result.evaluated_count,
  skipped_count: result.skipped_count,
  network_evaluation_count: result.network_evaluation_count,
  recorded_count: result.recorded_count,
  result_counts: result.result_counts,
  authority: result.authority,
};
process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
