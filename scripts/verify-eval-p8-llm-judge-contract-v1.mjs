import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const contractPath = path.resolve(process.env.EVAL_P8_CONTRACT_PATH || "fixtures/persona-evaluation/eval-p8-llm-judge-contract-v1.json");
const inputPath = path.resolve(process.env.EVAL_P8_INPUT_PATH || "artifacts/eval-p8/input/bounded-llm-judge-inputs-v1.json");
const contract = JSON.parse(await readFile(contractPath, "utf8"));
const input = JSON.parse(await readFile(inputPath, "utf8"));

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function hash(value) {
  return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}

const promptMaterial = {
  prompt_version: contract.prompt.prompt_version,
  system_text: contract.prompt.system_text,
  user_template: contract.prompt.user_template,
  response_schema: contract.prompt.response_schema,
  rubric: contract.rubric
};

assert.equal(contract.authority.judge_authority, "DIAGNOSTIC_ONLY");
assert.equal(contract.authority.release_blocker_authority, false);
assert.equal(contract.validation_policy.judge_semantic_labels_are_ci_blocking, false);
assert.equal(contract.validation_policy.judge_overall_signal_is_ci_blocking, false);
assert.equal(contract.validation_policy.judge_contract_release_blocker_promotion_in_p8, "FORBIDDEN");
assert.equal(contract.validation_policy.repeatability_authority, "NOT_ESTABLISHED");
assert.equal(contract.rubric.numeric_score_forbidden, true);
assert.equal(contract.rubric.release_decision_forbidden, true);
assert.equal(input.case_count, 16);
assert.equal(input.cases.length, 16);
assert.equal(input.prompt.prompt_semantic_hash, hash(promptMaterial));
assert.equal(input.case_set_semantic_hash, hash(input.cases));
assert.equal(new Set(input.cases.map((item) => item.case_id)).size, 16);
assert.equal(input.cases.filter((item) => item.persona.source_cohort === "COVERAGE_COHORT").length, 8);
assert.equal(input.cases.filter((item) => item.persona.source_cohort === "ADVERSARIAL_COHORT").length, 8);
assert.deepEqual(
  [...new Set(input.cases.filter((item) => item.persona.source_cohort === "COVERAGE_COHORT").map((item) => item.persona.primaryConcern))].sort(),
  ["acne", "barrier", "dehydration", "oiliness", "pores", "redness", "uneven_tone", "uv"].sort()
);
for (const item of input.cases) {
  assert.equal(item.judge_limits.product_name_exposed, false);
  assert.equal(item.judge_limits.brand_identity_exposed, false);
  assert.equal(item.judge_limits.numeric_recommendation_score_exposed, false);
  assert.equal(item.judge_limits.recommendation_rank_is_truth, false);
  assert.equal(item.judge_limits.product_correctness_is_in_scope, false);
  assert.equal(item.judge_limits.release_decision_is_in_scope, false);
}

console.log("EVAL-P8 LLM judge contract verifier: PASS");
console.log(`prompt_semantic_hash=${input.prompt.prompt_semantic_hash}`);
console.log(`case_set_semantic_hash=${input.case_set_semantic_hash}`);
