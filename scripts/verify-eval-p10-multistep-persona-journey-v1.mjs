import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { register } from "node:module";
import path from "node:path";
import {
  buildRouteLikePayload,
  materializeP3Personas,
  materializeRouteRecommendationInput,
  toRecommendationAnswers,
  validateDomainPersona
} from "./persona-evaluation/eval-p3-contracts.mjs";

register("./node-next-alias-loader.mjs", import.meta.url);

globalThis.fetch = async () => {
  throw new Error("EVAL_P10_NETWORK_CALL_FORBIDDEN");
};

const [
  { buildRecommendationProductFromSource },
  { buildSkinMatchDecisionBundle },
  { buildFallbackPhotoAnalysis },
  { buildSurveyInputContract },
  {
    getProductCategorySlot,
    isProductEligibleForGenderPreference,
    normalizeRecommendationAnswers
  }
] = await Promise.all([
  import("../lib/product-source.js"),
  import("../lib/skin-match-decision-engine.js"),
  import("../lib/photo-evidence.js"),
  import("../lib/survey-input-contract.js"),
  import("../lib/recommendation-scoring.ts")
]);

const contractPath = path.resolve(process.env.EVAL_P10_CONTRACT_PATH || "fixtures/persona-evaluation/eval-p10-multistep-persona-journey-contract-v1.json");
const interactionPath = path.resolve(process.env.EVAL_P10_INTERACTION_PATH || "fixtures/persona-evaluation/eval-p10-interaction-personas-v1.json");
const scenarioPath = path.resolve(process.env.EVAL_P10_SCENARIO_PATH || "fixtures/persona-evaluation/eval-p10-journey-scenario-manifest-v1.json");
const p6Path = path.resolve(process.env.EVAL_P10_P6_COHORT_PATH || "fixtures/persona-evaluation/eval-p6-locked-regression-cohort-v1.json");
const p9Path = path.resolve(process.env.EVAL_P10_P9_CONTRACT_PATH || "fixtures/persona-evaluation/eval-p9-real-aggregate-calibration-contract-v1.json");
const referenceRoot = path.resolve(process.env.EVAL_P10_RECOMMENDATION_REFERENCE_ROOT || "_reference/recommendation");
const artifactRoot = path.resolve(process.env.EVAL_P10_ARTIFACT_ROOT || "artifacts/eval-p10/journey");
const implementationSha = process.env.EVAL_P10_IMPLEMENTATION_SHA || "UNSPECIFIED_IMPLEMENTATION_SHA";
const fixedGeneratedAt = "2000-01-01T00:00:00.000Z";

const [contract, interactionSet, scenarioManifest, p6, p9, productsFixture] = await Promise.all([
  readFile(contractPath, "utf8").then(JSON.parse),
  readFile(interactionPath, "utf8").then(JSON.parse),
  readFile(scenarioPath, "utf8").then(JSON.parse),
  readFile(p6Path, "utf8").then(JSON.parse),
  readFile(p9Path, "utf8").then(JSON.parse),
  readFile(path.join(referenceRoot, "fixtures/recommendation-metadata/products-v1.json"), "utf8").then(JSON.parse)
]);

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

function semanticHash(value) {
  return createHash("sha256").update(JSON.stringify(stableValue(value))).digest("hex");
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getProductId(value) {
  if (!value || typeof value !== "object") return null;
  const direct = value.id || value.productId || value.product_id;
  if (direct) return String(direct);
  if (value.product && typeof value.product === "object") return getProductId(value.product);
  return null;
}

const orderedProducts = [...productsFixture.products].sort((left, right) =>
  String(left.category).localeCompare(String(right.category), "en") ||
  String(left.brand).localeCompare(String(right.brand), "en") ||
  String(left.name).localeCompare(String(right.name), "en") ||
  String(left.id).localeCompare(String(right.id), "en")
);
const recommendationProducts = orderedProducts.map(buildRecommendationProductFromSource);
assert.equal(productsFixture.productCount, 164, "frozen Recommendation fixture product count");
assert.equal(productsFixture.categoryCounts?.sunscreen, 11, "frozen Recommendation fixture sunscreen count");
assert.equal(recommendationProducts.length, 164, "converted Recommendation product count");
assert.equal(recommendationProducts.filter((product) => getProductCategorySlot(product) === "sunscreen").length, 11, "converted sunscreen count");

assert.equal(contract.stage, "EVAL-P10");
assert.equal(contract.stage_name, "Multi-step Persona Journey Simulation");
assert.equal(contract.determinism.free_form_llm_reaction_generation_allowed, false);
assert.equal(contract.determinism.transition_must_be_rule_driven, true);
assert.equal(contract.reaction_authority.recommendation_score_may_drive_reaction, false);
assert.equal(contract.reaction_authority.recommendation_rank_may_drive_reaction, false);
assert.equal(contract.reaction_authority.why_picked_may_drive_reaction, false);
assert.equal(contract.reaction_authority.score_breakdown_may_drive_reaction, false);
assert.equal(contract.comparison_authority.descriptive_only, true);
assert.equal(contract.comparison_authority.automatic_improvement_inference_allowed, false);
assert.equal(contract.comparison_authority.synthetic_satisfaction_score_allowed, false);
assert.equal(contract.cohort_rules.source_cohort_mutation_allowed, false);
assert.equal(contract.cohort_rules.source_weighting_mutation_allowed, false);
assert.equal(contract.harness_rules.production_api_route_invocation_allowed, false);
assert.equal(contract.harness_rules.production_network_calls_allowed, false);
assert.equal(contract.authority_ceiling.real_user_behavior_truth, false);
assert.equal(contract.authority_ceiling.enforce_authority, false);

assert.equal(interactionSet.stage, "EVAL-P10");
assert.equal(interactionSet.layer, "INTERACTION_PERSONA");
assert.equal(interactionSet.lifecycle, "LOCKED");
assert.equal(interactionSet.profiles.length, 4);
assert.equal(interactionSet.mutation_policy, "NEW_VERSION_REQUIRED");
assert.equal(interactionSet.authority_ceiling.real_user_behavior_truth, false);

assert.equal(p6.cohort.lifecycle, "LOCKED");
assert.equal(p6.cohort.persona_count, 37);
assert.equal(p6.cohort.cohort_hash, "c774fc52ae1494c5a4fc39d11d2e7564a196460db391bb94f41d0510b7ae59f8");
assert.equal(p6.cohort.mutation_policy, "NEW_VERSION_REQUIRED");
assert.equal(scenarioManifest.source_regression_cohort_hash, p6.cohort.cohort_hash);
assert.equal(scenarioManifest.source_persona_count, 37);
assert.equal(scenarioManifest.journey_count, 37);
assert.equal(scenarioManifest.market_prevalence_claim_allowed, false);

assert.equal(p9.stage, "EVAL-P9");
assert.equal(p9.execution_policy.missing_authorized_aggregate_source_disposition, "HOLD");
assert.equal(p9.reweighting_governance.p6_locked_regression_cohort_mutation_in_place, "FORBIDDEN");
assert.equal(contract.cohort_rules.p9_calibration_hold_blocks_technical_journey_simulation, false);
assert.equal(contract.cohort_rules.population_representativeness_claim_allowed, false);

const p3Materialized = materializeP3Personas();
const personaById = new Map(p3Materialized.personas.map((persona) => [persona.persona_id, persona]));
assert.equal(new Set(p6.cohort.member_ids).size, 37, "P6 member ids unique");
for (const memberId of p6.cohort.member_ids) assert(personaById.has(memberId), `${memberId}: P3 materialization source exists`);

const profileById = new Map(interactionSet.profiles.map((profile) => [profile.interaction_persona_id, profile]));
assert.equal(profileById.size, 4, "interaction profile ids unique");
const profileOrder = interactionSet.profiles.map((profile) => profile.interaction_persona_id);
const scenarios = p6.cohort.member_ids.map((basePersonaId, index) => ({
  journey_id: `P10-J${String(index + 1).padStart(3, "0")}`,
  base_persona_id: basePersonaId,
  interaction_persona_id: profileOrder[index % profileOrder.length],
  assignment_index: index + 1
}));
assert.equal(scenarios.length, scenarioManifest.journey_count);
const observedAssignmentCounts = Object.fromEntries(profileOrder.map((id) => [id, scenarios.filter((item) => item.interaction_persona_id === id).length]));
assert.deepEqual(observedAssignmentCounts, scenarioManifest.interaction_profile_assignment_counts, "interaction assignment counts");

const TEXTURE_CYCLE = Object.freeze({ gel: "watery", watery: "lotion", lotion: "cream", cream: "gel" });
const FEEL_CYCLE = Object.freeze({ sticky: "greasy", greasy: "heavy", heavy: "sticky" });
const allowedMutablePaths = new Set(contract.preference_refinement.allowed_mutable_paths);
const forbiddenStatePaths = contract.preference_refinement.forbidden_state_like_paths;

function readPath(root, dottedPath) {
  return dottedPath.split(".").reduce((value, key) => value?.[key], root);
}

function assertStateLikeFieldsPreserved(before, after, journeyId) {
  for (const dottedPath of forbiddenStatePaths) {
    assert.deepEqual(readPath(after, dottedPath), readPath(before, dottedPath), `${journeyId}: forbidden state-like path changed: ${dottedPath}`);
  }
}

function deriveReaction(profile, projection) {
  if (projection.topPickId === null) {
    if (profile.response_to_no_result === "REFINE" && profile.willingness_to_refine_answer === "HIGH") {
      return "REQUEST_REFINEMENT_AFTER_NO_RESULT";
    }
    return "EXPECTED_STOP_AFTER_NO_RESULT";
  }
  if (profile.survey_abandonment_tendency === "HIGH") return "EXPECTED_STOP_AFTER_RECOMMENDATION_1";
  if (profile.willingness_to_refine_answer === "HIGH") return "REQUEST_REFINEMENT";
  return "KEEP_INITIAL_RECOMMENDATION";
}

function applyTransition(domain, profile, journeyId) {
  const next = deepClone(domain);
  const changedPaths = [];
  switch (profile.transition_policy_id) {
    case "P10-TP-TEXTURE-NEXT": {
      const before = next.preferredTexture;
      const after = TEXTURE_CYCLE[before];
      assert(after, `${journeyId}: unsupported preferredTexture ${before}`);
      next.preferredTexture = after;
      changedPaths.push("preferredTexture");
      break;
    }
    case "P10-TP-SUNSCREEN-CLARIFY": {
      const stateBefore = next.sunscreen.preferenceState;
      const eyeBefore = next.sunscreen.eyeSensitive;
      next.sunscreen.preferenceState = "answered";
      next.sunscreen.eyeSensitive = !Boolean(eyeBefore);
      if (stateBefore !== "answered") changedPaths.push("sunscreen.preferenceState");
      changedPaths.push("sunscreen.eyeSensitive");
      break;
    }
    case "P10-TP-DISLIKED-FEEL-NEXT": {
      const before = next.mostDislikedFeel;
      const after = FEEL_CYCLE[before];
      assert(after, `${journeyId}: unsupported mostDislikedFeel ${before}`);
      next.mostDislikedFeel = after;
      changedPaths.push("mostDislikedFeel");
      break;
    }
    case "P10-TP-EXPECTED-STOP":
      return { refinedDomain: null, changedPaths: [] };
    default:
      throw new Error(`${journeyId}: unknown transition policy ${profile.transition_policy_id}`);
  }
  for (const changedPath of changedPaths) assert(allowedMutablePaths.has(changedPath), `${journeyId}: transition mutated non-allowed path ${changedPath}`);
  assertStateLikeFieldsPreserved(domain, next, journeyId);
  assert.equal(validateDomainPersona(next).length, 0, `${journeyId}: refined domain remains valid`);
  assert.notDeepEqual(next, domain, `${journeyId}: refinement must change domain preference input`);
  return { refinedDomain: next, changedPaths };
}

function priorityIdentity(priority) {
  if (typeof priority === "string") return priority;
  if (!priority || typeof priority !== "object") return null;
  return priority.axis || priority.key || priority.id || null;
}

function projectCategoryPicks(value) {
  if (Array.isArray(value)) return value.map((item) => getProductId(item)).filter(Boolean);
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, getProductId(value[key])]));
}

function semanticProjection(bundle, normalizedAnswers) {
  const eligibleProductIds = recommendationProducts
    .filter((product) => isProductEligibleForGenderPreference(product, normalizedAnswers))
    .map((product) => String(product.id))
    .sort((left, right) => left.localeCompare(right, "en"));
  const topPickId = getProductId(bundle?.topPick);
  const alternativeId = getProductId(bundle?.alternative) || getProductId(bundle?.altPicks?.[0]);
  return {
    normalizedAnswers,
    eligibleProductIds,
    priority: priorityIdentity(bundle?.priority),
    topPickId,
    alternativeId,
    categoryPickIds: projectCategoryPicks(bundle?.categoryPicks),
    noResultPresence: topPickId === null,
    noResultClassification: topPickId ? null : eligibleProductIds.length === 0 ? "EXPECTED_ABSTENTION" : "UNEXPECTED_NO_RESULT"
  };
}

async function runDomainCoreHarness(domain) {
  const answers = toRecommendationAnswers(domain);
  const normalizedAnswers = normalizeRecommendationAnswers(answers);
  const surveyContract = buildSurveyInputContract(answers, { source: "eval_p10_domain_core", generatedAt: fixedGeneratedAt });
  const bundle = await buildSkinMatchDecisionBundle(answers, {
    products: recommendationProducts,
    photoAnalysis: buildFallbackPhotoAnalysis("ko"),
    currentProducts: [],
    currentProductSnapshots: [],
    locale: "ko"
  });
  const projection = semanticProjection(bundle, normalizedAnswers);
  return {
    projection,
    hash: semanticHash(projection),
    surveyDerived: {
      sensitivityRisk: surveyContract.safety.sensitivityRisk,
      drynessRisk: surveyContract.safety.drynessRisk,
      rednessRisk: surveyContract.safety.rednessRisk,
      sunscreenSourceCompleteness: surveyContract.sunscreen.sourceCompleteness,
      warnings: [...surveyContract.metadata.warnings].sort()
    }
  };
}

async function runContractIntegrationHarness(domain, index) {
  const payload = buildRouteLikePayload(domain, { explicitOutdoorExposure: index % 2 === 0 });
  const routeInput = materializeRouteRecommendationInput(payload);
  const normalizedAnswers = normalizeRecommendationAnswers(routeInput);
  const surveyContract = buildSurveyInputContract(routeInput, { source: "eval_p10_contract_integration", generatedAt: fixedGeneratedAt });
  const bundle = await buildSkinMatchDecisionBundle(routeInput, {
    products: recommendationProducts,
    photoAnalysis: buildFallbackPhotoAnalysis("ko"),
    currentProducts: [],
    currentProductSnapshots: [],
    locale: "ko"
  });
  const projection = semanticProjection(bundle, normalizedAnswers);
  return {
    projection,
    hash: semanticHash(projection),
    surveyDerived: {
      sensitivityRisk: surveyContract.safety.sensitivityRisk,
      drynessRisk: surveyContract.safety.drynessRisk,
      rednessRisk: surveyContract.safety.rednessRisk,
      sunscreenSourceCompleteness: surveyContract.sunscreen.sourceCompleteness,
      warnings: [...surveyContract.metadata.warnings].sort()
    },
    routeAdapterMode: index % 2 === 0 ? "EXPLICIT_OUTDOOR_BOOLEAN" : "ENVIRONMENT_FALLBACK"
  };
}

async function runStep(domain, index, label, journeyId) {
  const [core, integration] = await Promise.all([
    runDomainCoreHarness(domain),
    runContractIntegrationHarness(domain, index)
  ]);
  assert.equal(core.hash, integration.hash, `${journeyId} ${label}: harness semantic equivalence`);
  assert.deepEqual(core.surveyDerived, integration.surveyDerived, `${journeyId} ${label}: survey-derived equivalence`);
  return {
    projection: core.projection,
    semantic_hash: core.hash,
    survey_derived: core.surveyDerived,
    harness_equivalent: true,
    route_adapter_mode: integration.routeAdapterMode
  };
}

function symmetricDifferenceCount(left, right) {
  const l = new Set(left);
  const r = new Set(right);
  let count = 0;
  for (const item of l) if (!r.has(item)) count += 1;
  for (const item of r) if (!l.has(item)) count += 1;
  return count;
}

function compareRecommendationSteps(initial, refined) {
  if (!refined) return { status: "NOT_APPLICABLE_EXPECTED_STOP", quality_direction: "NOT_INFERRED" };
  return {
    status: "DESCRIPTIVE_COMPARISON_ONLY",
    quality_direction: "NOT_INFERRED",
    top_pick_changed: initial.projection.topPickId !== refined.projection.topPickId,
    alternative_changed: initial.projection.alternativeId !== refined.projection.alternativeId,
    priority_changed: initial.projection.priority !== refined.projection.priority,
    eligible_product_set_symmetric_difference_count: symmetricDifferenceCount(initial.projection.eligibleProductIds, refined.projection.eligibleProductIds),
    initial_no_result: initial.projection.noResultPresence,
    refined_no_result: refined.projection.noResultPresence
  };
}

async function executeJourneyPass() {
  const results = [];
  for (let index = 0; index < scenarios.length; index += 1) {
    const scenario = scenarios[index];
    const basePersona = personaById.get(scenario.base_persona_id);
    const profile = profileById.get(scenario.interaction_persona_id);
    assert(basePersona, `${scenario.journey_id}: base persona exists`);
    assert(profile, `${scenario.journey_id}: interaction persona exists`);
    assert.equal(validateDomainPersona(basePersona.domain).length, 0, `${scenario.journey_id}: base domain valid`);

    const initialStep = await runStep(basePersona.domain, index, "Recommendation 1", scenario.journey_id);
    const reaction = deriveReaction(profile, initialStep.projection);
    const shouldRefine = reaction === "REQUEST_REFINEMENT" || reaction === "REQUEST_REFINEMENT_AFTER_NO_RESULT";
    let transition = { refinedDomain: null, changedPaths: [] };
    let refinedStep = null;
    if (shouldRefine) {
      transition = applyTransition(basePersona.domain, profile, scenario.journey_id);
      assert(transition.refinedDomain, `${scenario.journey_id}: refinement reaction requires refined domain`);
      refinedStep = await runStep(transition.refinedDomain, index, "Recommendation 2", scenario.journey_id);
    } else {
      assert.equal(profile.transition_policy_id, "P10-TP-EXPECTED-STOP", `${scenario.journey_id}: non-refinement path must be explicit expected-stop policy`);
    }

    results.push({
      journey_id: scenario.journey_id,
      base_persona_id: basePersona.persona_id,
      base_cohort_type: basePersona.cohort_type,
      interaction_persona_id: profile.interaction_persona_id,
      transition_policy_id: profile.transition_policy_id,
      reaction,
      changed_preference_paths: transition.changedPaths,
      initial_step: initialStep,
      refined_step: refinedStep,
      comparison: compareRecommendationSteps(initialStep, refinedStep),
      authority: {
        evidence_class: "SYNTHETIC_SIMULATION_EVIDENCE",
        real_user_behavior_truth: false,
        satisfaction_or_conversion_truth: false,
        market_prevalence_truth: false,
        quality_direction_inferred: false
      }
    });
  }
  return results;
}

const firstPass = await executeJourneyPass();
const secondPass = await executeJourneyPass();
assert.deepEqual(secondPass, firstPass, "P10 same inputs must replay exactly");

const refinedJourneys = firstPass.filter((item) => item.refined_step !== null);
const stoppedJourneys = firstPass.filter((item) => item.refined_step === null);
assert.equal(firstPass.length, 37, "journey count");
assert.equal(refinedJourneys.length, 28, "refined journey count");
assert.equal(stoppedJourneys.length, 9, "expected-stop journey count");
assert.equal(refinedJourneys.filter((item) => item.changed_preference_paths.length > 0).length, 28, "all continued journeys mutate an allowed preference input");
assert.equal(firstPass.every((item) => item.initial_step.harness_equivalent), true, "all initial harnesses equivalent");
assert.equal(refinedJourneys.every((item) => item.refined_step.harness_equivalent), true, "all refined harnesses equivalent");
assert.equal(firstPass.every((item) => item.comparison.quality_direction === "NOT_INFERRED"), true, "comparison never infers quality direction");

const summary = {
  journey_count: firstPass.length,
  refined_journey_count: refinedJourneys.length,
  expected_stop_count: stoppedJourneys.length,
  initial_no_result_count: firstPass.filter((item) => item.initial_step.projection.noResultPresence).length,
  refined_no_result_count: refinedJourneys.filter((item) => item.refined_step.projection.noResultPresence).length,
  top_pick_changed_count: refinedJourneys.filter((item) => item.comparison.top_pick_changed).length,
  alternative_changed_count: refinedJourneys.filter((item) => item.comparison.alternative_changed).length,
  priority_changed_count: refinedJourneys.filter((item) => item.comparison.priority_changed).length,
  harness_equivalence_failures: 0,
  forbidden_state_mutations: 0,
  quality_direction_inferences: 0,
  llm_judge_calls: 0,
  production_api_calls: 0,
  product_fact_writes: 0,
  hosted_writes: 0
};

const interactionSetHash = semanticHash(interactionSet);
const journeyContractHash = semanticHash(contract);
const scenarioManifestHash = semanticHash(scenarioManifest);
const journeyResultsHash = semanticHash(firstPass);
const semanticEvidence = {
  stage: "EVAL-P10",
  interaction_persona_semantic_hash: interactionSetHash,
  journey_contract_semantic_hash: journeyContractHash,
  scenario_manifest_semantic_hash: scenarioManifestHash,
  journey_results_semantic_hash: journeyResultsHash,
  p6_locked_regression_cohort_hash: p6.cohort.cohort_hash,
  p6_persona_count: p6.cohort.persona_count,
  p9_real_aggregate_calibration_dependency: "NOT_REQUIRED_FOR_TECHNICAL_JOURNEY_SIMULATION",
  summary,
  terminal_outcome: "DETERMINISTIC_MULTISTEP_PERSONA_JOURNEY_SIMULATION_ESTABLISHED"
};
const semanticEvidenceHash = semanticHash(semanticEvidence);

await mkdir(artifactRoot, { recursive: true });
await writeFile(path.join(artifactRoot, "multistep-persona-journey-results-v1.json"), `${JSON.stringify(firstPass, null, 2)}\n`, "utf8");
await writeFile(path.join(artifactRoot, "multistep-persona-journey-evidence-v1.json"), `${JSON.stringify({
  schema_version: "eval-p10-multistep-persona-journey-evidence-v1",
  implementation_sha: implementationSha,
  semantic_evidence_hash: semanticEvidenceHash,
  ...semanticEvidence,
  authority_ceiling: contract.authority_ceiling
}, null, 2)}\n`, "utf8");

console.log("EVAL-P10 Multi-step Persona Journey verifier: PASS");
console.log(`interaction_persona_semantic_hash=${interactionSetHash}`);
console.log(`journey_contract_semantic_hash=${journeyContractHash}`);
console.log(`scenario_manifest_semantic_hash=${scenarioManifestHash}`);
console.log(`journey_results_semantic_hash=${journeyResultsHash}`);
console.log(`semantic_evidence_hash=${semanticEvidenceHash}`);
console.log(`journey_count=${summary.journey_count}`);
console.log(`refined_journey_count=${summary.refined_journey_count}`);
console.log(`expected_stop_count=${summary.expected_stop_count}`);
console.log(`top_pick_changed_count=${summary.top_pick_changed_count}`);
console.log(`terminal_outcome=${semanticEvidence.terminal_outcome}`);
