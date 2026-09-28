import assert from "node:assert/strict";
import fs from "node:fs";

function argValue(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.slice(2).find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

const resultPath = argValue("result");
if (!resultPath) throw new Error("--result=<path> is required");

const result = JSON.parse(fs.readFileSync(resultPath, "utf8"));
assert.equal(result.contract, "trust-phase8i3-transport-drift-handoff-result-v1");
assert.equal(result.record, true);
assert.equal(
  result.registry_contract,
  "trust-phase8i3-transport-drift-evaluation-policy-registry-v1",
);
assert.equal(result.registry_version, "v1");
assert.equal(result.case_count, 2);
assert.equal(result.evaluated_count, 2);
assert.equal(result.skipped_count, 0);
assert.equal(result.network_evaluation_count, 2);
assert.equal(result.recorded_count, 2);
assert.equal(result.authority, "NO_AUTOMATIC_RELOCATION_OR_PRODUCT_FACT_MUTATION");

const allowed = new Set(["READY_FOR_8I4", "HOLD", "RETRYABLE"]);
const rows = Array.isArray(result.rows) ? result.rows : [];
assert.equal(rows.length, 2);

for (const row of rows) {
  assert.equal(row.status, "EVALUATED");
  assert.ok(row.policy_key);
  assert.ok(!row.policy_key.startsWith("unconfigured:"));
  assert.equal(row.policy_version, "v1");
  assert.ok(["REDIRECT_DIRECT", "REDISCOVERY"].includes(row.evaluation_mode));
  assert.ok(allowed.has(row.result_kind));
  assert.match(row.input_digest, /^[0-9a-f]{64}$/);
  assert.match(row.result_digest, /^[0-9a-f]{64}$/);
  assert.equal(row.network_used, true);
  assert.equal(row.recorder_result?.status, "recorded");
  assert.equal(row.recorder_result?.authority_mutation, false);

  if (row.result_kind === "READY_FOR_8I4") {
    assert.match(row.candidate_locator, /^https:\/\//);
    assert.match(row.qualification_digest, /^[0-9a-f]{64}$/);
    assert.equal(
      row.result_payload?.authority,
      "CANDIDATE_ONLY_REQUIRES_8I4_GOVERNED_RELOCATION",
    );
  } else {
    assert.equal(row.result_payload?.authority, "NO_RELOCATION_OR_SEMANTIC_AUTHORITY");
  }
}

assert.equal(result.result_counts.POLICY_REQUIRED ?? 0, 0);
assert.equal(
  Object.entries(result.result_counts).reduce(
    (sum, [kind, count]) => sum + (allowed.has(kind) ? Number(count) : 0),
    0,
  ),
  2,
);

const summary = {
  contract: "trust-phase8i3d-live-result-verification-v1",
  run_id: result.run_id,
  case_count: result.case_count,
  evaluated_count: result.evaluated_count,
  recorded_count: result.recorded_count,
  network_evaluation_count: result.network_evaluation_count,
  result_counts: result.result_counts,
  result: "PASS",
};

process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
