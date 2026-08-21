import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const contractPath = path.resolve(process.env.EVAL_P8_CONTRACT_PATH || "fixtures/persona-evaluation/eval-p8-llm-judge-contract-v1.json");
const inputPath = path.resolve(process.env.EVAL_P8_INPUT_PATH || "artifacts/eval-p8/input-a/bounded-llm-judge-inputs-v1.json");
const observationPath = path.resolve(process.env.EVAL_P8_OBSERVATION_PATH || "fixtures/persona-evaluation/eval-p8-llm-judge-observations-v1.json");
const artifactRoot = path.resolve(process.env.EVAL_P8_ARTIFACT_ROOT || "artifacts/eval-p8/final");

const [contract, input, observation] = await Promise.all([
  readFile(contractPath, "utf8").then(JSON.parse),
  readFile(inputPath, "utf8").then(JSON.parse),
  readFile(observationPath, "utf8").then(JSON.parse)
]);

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function semanticHash(value) {
  return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}

function countLabels(responses, criterionId) {
  const counts = {};
  for (const response of responses) {
    const label = response.criteria[criterionId].label;
    counts[label] = (counts[label] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b, "en")));
}

function countOverall(responses) {
  const counts = {};
  for (const response of responses) {
    counts[response.overall_signal] = (counts[response.overall_signal] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b, "en")));
}

function assertNoNumericValues(value, pathKey = "responses") {
  if (typeof value === "number") throw new Error(`EVAL_P8_NUMERIC_JUDGE_OUTPUT_FORBIDDEN:${pathKey}`);
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoNumericValues(item, `${pathKey}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) assertNoNumericValues(item, `${pathKey}.${key}`);
  }
}

assert.equal(contract.stage, "EVAL-P8");
assert.equal(contract.authority.judge_authority, "DIAGNOSTIC_ONLY");
assert.equal(contract.authority.release_blocker_authority, false);
assert.equal(contract.validation_policy.judge_semantic_labels_are_ci_blocking, false);
assert.equal(contract.validation_policy.judge_overall_signal_is_ci_blocking, false);
assert.equal(contract.validation_policy.judge_contract_release_blocker_promotion_in_p8, "FORBIDDEN");
assert.equal(observation.schema_version, "eval-p8-llm-judge-observations-v1");
assert.equal(observation.stage, "EVAL-P8");
assert.equal(observation.authority.judge_authority, "DIAGNOSTIC_ONLY");
assert.equal(observation.authority.release_blocker_authority, false);
assert.equal(observation.input_lineage.prompt_version, input.prompt.prompt_version);
assert.equal(observation.input_lineage.prompt_semantic_hash, input.prompt.prompt_semantic_hash);
assert.equal(observation.input_lineage.case_set_semantic_hash, input.case_set_semantic_hash);
assert.equal(observation.input_lineage.case_count, input.case_count);
assert.equal(observation.execution_lineage.prompt_version, input.prompt.prompt_version);
assert.equal(observation.execution_lineage.prompt_semantic_hash, input.prompt.prompt_semantic_hash);
assert.equal(observation.execution_lineage.response_schema_version, "eval-p8-llm-judge-response-v1");

for (const field of contract.execution_lineage_required) {
  assert(Object.hasOwn(observation.execution_lineage, field), `missing execution lineage: ${field}`);
  assert.notEqual(observation.execution_lineage[field], null, `null execution lineage: ${field}`);
}

const expectedCaseIds = input.cases.map((item) => item.case_id);
const observedCaseIds = observation.responses.map((item) => item.case_id);
assert.equal(observation.responses.length, input.case_count);
assert.equal(new Set(observedCaseIds).size, input.case_count);
assert.deepEqual([...observedCaseIds].sort(), [...expectedCaseIds].sort());
assertNoNumericValues(observation.responses);

const criterionContracts = Object.fromEntries(contract.rubric.criteria.map((criterion) => [criterion.id, criterion]));
for (const response of observation.responses) {
  assert.equal(response.schema_version, "eval-p8-llm-judge-response-v1");
  assert(expectedCaseIds.includes(response.case_id));
  assert.deepEqual(Object.keys(response.criteria).sort(), Object.keys(criterionContracts).sort());
  for (const [criterionId, criterion] of Object.entries(criterionContracts)) {
    const result = response.criteria[criterionId];
    assert(criterion.labels.includes(result.label), `${response.case_id}:${criterionId}:invalid label`);
    assert.equal(typeof result.reason, "string");
    assert(result.reason.trim().length > 0, `${response.case_id}:${criterionId}:empty reason`);
  }
  assert(Array.isArray(response.unsupported_claims));
  assert(response.unsupported_claims.every((item) => typeof item === "string" && item.trim().length > 0));
  assert(contract.rubric.overall_labels.includes(response.overall_signal));
}

const criterionLabelCounts = Object.fromEntries(
  contract.rubric.criteria.map((criterion) => [criterion.id, countLabels(observation.responses, criterion.id)])
);
const overallLabelCounts = countOverall(observation.responses);
const concernCaseIds = observation.responses.filter((item) => item.overall_signal === "CONCERN").map((item) => item.case_id);
const mixedCaseIds = observation.responses.filter((item) => item.overall_signal === "MIXED").map((item) => item.case_id);
const unsupportedClaimCaseIds = observation.responses.filter((item) => item.unsupported_claims.length > 0).map((item) => item.case_id);
const observationSemanticHash = semanticHash(observation);
const terminalOutcome = observation.execution_lineage.blindness_integrity === "PARTIAL"
  ? "BOUNDED_LLM_JUDGE_DIAGNOSTIC_CHANNEL_ESTABLISHED_WITH_PARTIAL_BLINDNESS_AND_RELEASE_BLOCKER_AUTHORITY_NOT_GRANTED"
  : "BOUNDED_LLM_JUDGE_DIAGNOSTIC_CHANNEL_ESTABLISHED_WITH_RELEASE_BLOCKER_AUTHORITY_NOT_GRANTED";

const summary = {
  schema_version: "eval-p8-bounded-llm-judge-summary-v1",
  stage: "EVAL-P8",
  semantic_result: "SUCCESS",
  terminal_outcome: terminalOutcome,
  evidence_class: "SYNTHETIC_SIMULATION_EVIDENCE",
  judge_authority: "DIAGNOSTIC_ONLY",
  release_blocker_authority: false,
  repeatability_status: "NOT_ESTABLISHED",
  case_count: input.case_count,
  sample: {
    coverage_cases: input.cases.filter((item) => item.persona.source_cohort === "COVERAGE_COHORT").length,
    adversarial_cases: input.cases.filter((item) => item.persona.source_cohort === "ADVERSARIAL_COHORT").length,
    population_representative: false,
    weighting_strategy: "NONE"
  },
  lineage: {
    prompt_version: input.prompt.prompt_version,
    prompt_semantic_hash: input.prompt.prompt_semantic_hash,
    case_set_semantic_hash: input.case_set_semantic_hash,
    observation_semantic_hash: observationSemanticHash,
    provider: observation.execution_lineage.provider,
    execution_surface: observation.execution_lineage.execution_surface,
    model_identifier: observation.execution_lineage.model_identifier,
    temperature_or_unavailable: observation.execution_lineage.temperature_or_unavailable,
    seed_or_unavailable: observation.execution_lineage.seed_or_unavailable,
    sampling_configuration: observation.execution_lineage.sampling_configuration,
    execution_timestamp: observation.execution_lineage.execution_timestamp,
    blindness_integrity: observation.execution_lineage.blindness_integrity,
    pre_observation_identity_exposure: observation.execution_lineage.pre_observation_identity_exposure,
    brand_blindness_claim_allowed: observation.execution_lineage.brand_blindness_claim_allowed
  },
  diagnostic_observations: {
    criterion_label_counts: criterionLabelCounts,
    overall_label_counts: overallLabelCounts,
    concern_case_ids: concernCaseIds,
    mixed_case_ids: mixedCaseIds,
    unsupported_claim_case_ids: unsupportedClaimCaseIds,
    cases_with_unsupported_claims: unsupportedClaimCaseIds.length
  },
  governance: {
    semantic_labels_ci_blocking: false,
    overall_signal_ci_blocking: false,
    product_correctness_oracle: false,
    recommendation_rank_truth: false,
    real_user_truth: false,
    satisfaction_or_conversion_truth: false,
    market_prevalence_truth: false,
    enforce_authority: false,
    full_blindness_claim_allowed: false,
    release_blocker_promotion_in_p8: "FORBIDDEN"
  },
  production_boundary: {
    production_network_calls: 0,
    hosted_writes: 0,
    product_fact_writes: 0,
    organic_evidence_writes: 0,
    controlled_production_probe: 0,
    shadow_mode_changed: false,
    enforce_authorized_by_persona: false,
    enforce_activated_by_persona: false,
    production_config_change: 0
  }
};

await mkdir(artifactRoot, { recursive: true });
await writeFile(path.join(artifactRoot, "bounded-llm-judge-summary-v1.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
await writeFile(path.join(artifactRoot, "bounded-llm-judge-responses-v1.json"), `${JSON.stringify({
  schema_version: "eval-p8-bounded-llm-judge-responses-v1",
  judge_authority: "DIAGNOSTIC_ONLY",
  observation_semantic_hash: observationSemanticHash,
  responses: observation.responses
}, null, 2)}\n`, "utf8");

console.log("EVAL-P8 bounded LLM judge finalizer: PASS");
console.log(`terminal_outcome=${terminalOutcome}`);
console.log(`prompt_semantic_hash=${input.prompt.prompt_semantic_hash}`);
console.log(`case_set_semantic_hash=${input.case_set_semantic_hash}`);
console.log(`observation_semantic_hash=${observationSemanticHash}`);
console.log(`concern_cases=${concernCaseIds.length}`);
console.log(`mixed_cases=${mixedCaseIds.length}`);
console.log(`unsupported_claim_cases=${unsupportedClaimCaseIds.length}`);
