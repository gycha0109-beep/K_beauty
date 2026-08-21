import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const baselineContractPath = path.resolve(process.env.EVAL_P6_BASELINE_CONTRACT_PATH || "fixtures/persona-evaluation/eval-p6-regression-baseline-v1.json");
const baselineArtifactRoot = path.resolve(process.env.EVAL_P6_BASELINE_ARTIFACT_ROOT || "artifacts/eval-p6/baseline");

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort((a, b) => a.localeCompare(b, "en")).map((key) => [key, stable(value[key])]));
  return value;
}
function hash(value) { return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex"); }
const readJson = (filePath) => readFile(filePath, "utf8").then(JSON.parse);

const [contract, summary, snapshots] = await Promise.all([
  readJson(baselineContractPath),
  readJson(path.join(baselineArtifactRoot, "eval-p6-run-summary-v1.json")),
  readJson(path.join(baselineArtifactRoot, "eval-p6-persona-snapshots-v1.json"))
]);

assert.equal(contract.schema_version, "eval-p6-regression-baseline-v1");
assert.equal(contract.stage, "EVAL-P6");
assert.equal(contract.baseline.lifecycle, "LOCKED");
assert.equal(contract.baseline.mutation_policy, "NEW_VERSION_REQUIRED");
assert.equal(summary.run_role, "BASELINE");
assert.equal(summary.engine_sha, contract.baseline.baseline_engine_sha);
assert.equal(summary.persona_count, contract.baseline.persona_count);
assert.equal(summary.harness_equivalence_count, contract.baseline.persona_count);
assert.equal(snapshots.cohort_id, contract.baseline.cohort_id);
assert.equal(snapshots.cohort_hash, contract.baseline.cohort_hash);
assert.deepEqual(summary.deterministic_context, contract.baseline.deterministic_context, "baseline deterministic context");
assert.equal(summary.deterministic_context_hash, contract.baseline.deterministic_context_hash);
assert.deepEqual(summary.engine_file_hashes, contract.baseline.engine_file_hashes);
assert.equal(summary.output_semantic_hash, contract.baseline.output_semantic_hash);

const actualById = new Map(snapshots.persona_snapshots.map((item) => [item.persona_id, item]));
assert.equal(actualById.size, contract.baseline.persona_count);
assert.equal(Object.keys(contract.baseline.persona_regression_hashes).length, contract.baseline.persona_count);
for (const [personaId, expectedHash] of Object.entries(contract.baseline.persona_regression_hashes)) {
  const actual = actualById.get(personaId);
  assert(actual, `${personaId}: baseline snapshot`);
  assert.equal(actual.persona_regression_hash, expectedHash, `${personaId}: regression hash`);
}

const { baseline_contract_hash: declaredHash, ...withoutHash } = contract;
assert.equal(hash(withoutHash), declaredHash, "baseline contract canonical hash");
assert.equal(contract.authority_ceiling.evidence_class, "SYNTHETIC_SIMULATION_EVIDENCE");
assert.equal(contract.authority_ceiling.enforce_authority, false);

console.log(`EVAL-P6 frozen baseline PASS engine=${summary.engine_sha} cohort=${summary.deterministic_context.cohort_hash} output=${summary.output_semantic_hash} baseline=${declaredHash}`);
