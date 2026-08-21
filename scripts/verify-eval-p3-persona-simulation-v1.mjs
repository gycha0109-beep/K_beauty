import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { register } from "node:module";
import path from "node:path";
import {
  EVAL_P3_CONTRACTS,
  buildContractGapObservations,
  buildP3NegativeFixtures,
  buildRouteLikePayload,
  materializeP3Personas,
  materializeRouteRecommendationInput,
  semanticHash,
  toRecommendationAnswers,
  validateDomainPersona,
  validateMaterializedPersona
} from "./persona-evaluation/eval-p3-contracts.mjs";

register("./node-next-alias-loader.mjs", import.meta.url);

globalThis.fetch = async () => {
  throw new Error("EVAL_P3_NETWORK_CALL_FORBIDDEN");
};

const [
  { buildRecommendationProductFromSource },
  { buildSkinMatchDecisionBundle },
  { buildFallbackPhotoAnalysis },
  { buildSurveyInputContract },
  {
    filterSunscreenCandidates,
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

const referenceRoot = path.resolve(process.env.EVAL_P3_REFERENCE_ROOT || "_reference/recommendation");
const artifactRoot = path.resolve(process.env.EVAL_P3_ARTIFACT_ROOT || "artifacts/eval-p3");
const implementationSha = process.env.EVAL_P3_IMPLEMENTATION_SHA || "UNSPECIFIED_IMPLEMENTATION_SHA";
const fixedGeneratedAt = "2000-01-01T00:00:00.000Z";

const productsFixture = JSON.parse(await readFile(
  path.join(referenceRoot, "fixtures/recommendation-metadata/products-v1.json"),
  "utf8"
));

assert.equal(productsFixture.productCount, 164, "frozen catalog product count");
assert.equal(productsFixture.categoryCounts?.sunscreen, 11, "frozen sunscreen count");
assert.equal(productsFixture.canonicalFixtureSha256, EVAL_P3_CONTRACTS.catalogDeclaredSha256, "catalog declared hash");

const orderedProducts = [...productsFixture.products].sort((left, right) =>
  String(left.category).localeCompare(String(right.category), "en") ||
  String(left.brand).localeCompare(String(right.brand), "en") ||
  String(left.name).localeCompare(String(right.name), "en") ||
  String(left.id).localeCompare(String(right.id), "en")
);
const recommendationProducts = orderedProducts.map(buildRecommendationProductFromSource);
const sunscreenProducts = recommendationProducts.filter((product) => getProductCategorySlot(product) === "sunscreen");
assert.equal(recommendationProducts.length, 164, "converted catalog product count");
assert.equal(sunscreenProducts.length, 11, "converted sunscreen count");

const materialized = materializeP3Personas();
const personas = materialized.personas;
const coveragePersonas = personas.filter((persona) => persona.cohort_type === "COVERAGE_COHORT");
const adversarialPersonas = personas.filter((persona) => persona.cohort_type === "ADVERSARIAL_COHORT");
assert.equal(personas.length, 40, "P3 persona count");
assert.equal(coveragePersonas.length, 32, "P3 coverage persona count");
assert.equal(adversarialPersonas.length, 8, "P3 adversarial persona count");
assert.equal(materialized.lineage.persona_count, 40, "materialization lineage persona count");
assert.match(materialized.lineage.cohort_hash, /^[a-f0-9]{64}$/u, "cohort hash format");

for (const persona of personas) {
  assert.deepEqual(validateMaterializedPersona(persona), [], `${persona.persona_id}: valid materialized persona`);
  assert.equal(persona.population, null, `${persona.persona_id}: population prior remains unavailable`);
}

const negativeFixtures = buildP3NegativeFixtures();
assert.equal(negativeFixtures.length, 8, "contract-negative fixture count");
const negativeResults = negativeFixtures.map((fixture) => {
  const errors = validateDomainPersona(fixture.domain);
  assert(errors.length > 0, `${fixture.fixture_id}: negative fixture must fail validation`);
  assert(
    errors.some((error) => error.code === fixture.expected_code),
    `${fixture.fixture_id}: expected ${fixture.expected_code}`
  );
  return {
    fixture_id: fixture.fixture_id,
    expected_code: fixture.expected_code,
    observed_codes: [...new Set(errors.map((error) => error.code))].sort((left, right) => left.localeCompare(right, "en"))
  };
});

function getProductId(value) {
  if (!value || typeof value !== "object") return null;
  const direct = value.id || value.productId || value.product_id;
  if (direct) return String(direct);
  if (value.product && typeof value.product === "object") return getProductId(value.product);
  return null;
}

function projectCategoryPicks(value) {
  if (Array.isArray(value)) {
    return value.map((item) => getProductId(item)).filter(Boolean);
  }
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.keys(value)
      .sort((left, right) => left.localeCompare(right, "en"))
      .map((key) => [key, getProductId(value[key])])
  );
}

const productIdByName = new Map(recommendationProducts.map((product) => [String(product.name || "").trim(), String(product.id)]));

function stepProductId(step) {
  const direct = getProductId(step);
  if (direct) return direct;
  const product = step?.product;
  if (typeof product === "string") return productIdByName.get(product.trim()) || null;
  const name = step?.productName || step?.name;
  if (typeof name === "string") return productIdByName.get(name.trim()) || null;
  return null;
}

function projectRoutineProductIds(bundle, phase) {
  const candidates = [
    bundle?.premiumReport?.fullRoutine?.[`${phase}Steps`],
    bundle?.fullRoutine?.[`${phase}Steps`],
    bundle?.[`${phase}Steps`],
    bundle?.[phase]
  ].filter(Array.isArray);
  const output = [];
  for (const list of candidates) {
    for (const item of list) {
      const id = stepProductId(item);
      if (id && !output.includes(id)) output.push(id);
    }
  }
  return output;
}

function priorityIdentity(priority) {
  if (typeof priority === "string") return priority;
  if (!priority || typeof priority !== "object") return null;
  return priority.axis || priority.key || priority.id || null;
}

function semanticProjection(bundle, normalizedAnswers) {
  const eligibleProductIds = recommendationProducts
    .filter((product) => isProductEligibleForGenderPreference(product, normalizedAnswers))
    .map((product) => String(product.id))
    .sort((left, right) => left.localeCompare(right, "en"));
  const topPickId = getProductId(bundle?.topPick);
  const alternativeId = getProductId(bundle?.alternative) || getProductId(bundle?.altPicks?.[0]);
  const noResultClassification = topPickId
    ? null
    : eligibleProductIds.length === 0
      ? "EXPECTED_ABSTENTION"
      : "UNEXPECTED_NO_RESULT";

  return {
    normalizedAnswers,
    eligibleProductIds,
    priority: priorityIdentity(bundle?.priority),
    topPickId,
    alternativeId,
    categoryPickIds: projectCategoryPicks(bundle?.categoryPicks),
    morningRoutineProductIds: projectRoutineProductIds(bundle, "morning"),
    nightRoutineProductIds: projectRoutineProductIds(bundle, "night"),
    noResultPresence: topPickId === null,
    noResultClassification,
    noResultClassificationInput: {
      eligibleProductCount: eligibleProductIds.length,
      priority: priorityIdentity(bundle?.priority)
    }
  };
}

async function runDomainCoreHarness(persona) {
  const answers = toRecommendationAnswers(persona.domain);
  const normalizedAnswers = normalizeRecommendationAnswers(answers);
  const surveyContract = buildSurveyInputContract(answers, {
    source: "eval_p3_domain_core",
    generatedAt: fixedGeneratedAt
  });
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
    semanticHash: semanticHash(projection),
    surveyDerived: {
      sensitivityRisk: surveyContract.safety.sensitivityRisk,
      drynessRisk: surveyContract.safety.drynessRisk,
      rednessRisk: surveyContract.safety.rednessRisk,
      sunscreenSourceCompleteness: surveyContract.sunscreen.sourceCompleteness,
      warnings: [...surveyContract.metadata.warnings].sort((left, right) => left.localeCompare(right, "en"))
    }
  };
}

async function runContractIntegrationHarness(persona, index) {
  const payload = buildRouteLikePayload(persona.domain, {
    explicitOutdoorExposure: index % 2 === 0
  });
  const routeInput = materializeRouteRecommendationInput(payload);
  const normalizedAnswers = normalizeRecommendationAnswers(routeInput);
  const surveyContract = buildSurveyInputContract(routeInput, {
    source: "eval_p3_contract_integration",
    generatedAt: fixedGeneratedAt
  });
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
    semanticHash: semanticHash(projection),
    surveyDerived: {
      sensitivityRisk: surveyContract.safety.sensitivityRisk,
      drynessRisk: surveyContract.safety.drynessRisk,
      rednessRisk: surveyContract.safety.rednessRisk,
      sunscreenSourceCompleteness: surveyContract.sunscreen.sourceCompleteness,
      warnings: [...surveyContract.metadata.warnings].sort((left, right) => left.localeCompare(right, "en"))
    },
    routeAdapterMode: index % 2 === 0 ? "EXPLICIT_OUTDOOR_BOOLEAN" : "ENVIRONMENT_FALLBACK"
  };
}

async function executeHarnessPass() {
  const results = [];
  for (let index = 0; index < personas.length; index += 1) {
    const persona = personas[index];
    const domainCore = await runDomainCoreHarness(persona);
    const contractIntegration = await runContractIntegrationHarness(persona, index);
    assert.equal(
      domainCore.semanticHash,
      contractIntegration.semanticHash,
      `${persona.persona_id}: harness semantic equivalence`
    );
    results.push({
      persona_id: persona.persona_id,
      cohort_type: persona.cohort_type,
      applicable_rule_refs: persona.applicable_rule_refs,
      domain_core_hash: domainCore.semanticHash,
      contract_integration_hash: contractIntegration.semanticHash,
      harness_equivalent: true,
      route_adapter_mode: contractIntegration.routeAdapterMode,
      projection: domainCore.projection,
      survey_derived: domainCore.surveyDerived
    });
  }
  return results;
}

const firstPass = await executeHarnessPass();
const secondPass = await executeHarnessPass();
const firstPassHash = semanticHash(firstPass);
const secondPassHash = semanticHash(secondPass);
assert.equal(firstPassHash, secondPassHash, "same input + engine/catalog/contracts must replay to same semantic hash");
assert.deepEqual(
  firstPass.map((item) => item.domain_core_hash),
  secondPass.map((item) => item.domain_core_hash),
  "DOMAIN_CORE deterministic replay"
);
assert.deepEqual(
  firstPass.map((item) => item.contract_integration_hash),
  secondPass.map((item) => item.contract_integration_hash),
  "CONTRACT_INTEGRATION deterministic replay"
);

function makeSunscreenProbe(overrides = {}) {
  return {
    id: "eval-p3-sunscreen-rule-probe",
    name: "EVAL P3 Sunscreen Rule Probe",
    brand: "EVAL_ONLY",
    category: "sunscreen",
    is_mens: false,
    skin_types: ["oily", "dry", "combination", "sensitive"],
    concerns: ["uv", "redness", "barrier"],
    texture: "lotion",
    finish: "natural",
    irritation_risk: "low",
    sensitivity_safe: true,
    uv_filter_type: "organic",
    tone_up: false,
    white_cast: "none",
    eye_sting: "low",
    pilling_risk: "low",
    recommendation_tier: "Tier1",
    ...overrides
  };
}

function baseProbeAnswers(overrides = {}) {
  return {
    skinType: "combination",
    sensitivity: "low",
    genderPreference: "unspecified",
    mainConcern: "uv",
    mainConcerns: ["uv", "uneven_tone"],
    preferredTexture: "lotion",
    postWashFeeling: "comfortable",
    afternoonSkinChange: "mostly_same",
    mostDislikedFeel: "sticky",
    environmentExposure: ["outdoor"],
    cleansingFrequency: "twice",
    whiteCastHate: false,
    toneUpWanted: false,
    makeupUse: false,
    eyeSensitive: false,
    verySensitivePeriod: false,
    ...overrides
  };
}

function containsId(items, id) {
  return items.some((item) => String(item.id) === id);
}

const evaluatorRuleProbeAuthority = "EVALUATOR_RULE_FIXTURE_NOT_CATALOG_TRUTH";
const genderProbe = { is_mens: true };
const genderBefore = isProductEligibleForGenderPreference(genderProbe, { genderPreference: "unspecified" });
const genderAfter = isProductEligibleForGenderPreference(genderProbe, { genderPreference: "female" });
assert.equal(genderBefore, true, "MR-GENDER-001 before eligibility");
assert.equal(genderAfter, false, "MR-GENDER-001 after eligibility");

const highIrritationProbe = makeSunscreenProbe({ irritation_risk: "high" });
const sensitivityBefore = filterSunscreenCandidates([highIrritationProbe], baseProbeAnswers({ sensitivity: "medium" }));
const sensitivityAfter = filterSunscreenCandidates([highIrritationProbe], baseProbeAnswers({ sensitivity: "high" }));
assert.equal(containsId(sensitivityBefore.rejected, highIrritationProbe.id), false, "MR-SUN-SENSITIVITY-001 before");
assert.equal(containsId(sensitivityAfter.rejected, highIrritationProbe.id), true, "MR-SUN-SENSITIVITY-001 after");

const eyeProbe = makeSunscreenProbe({ eye_sting: "high" });
const eyeBefore = filterSunscreenCandidates([eyeProbe], baseProbeAnswers({ eyeSensitive: false }));
const eyeAfter = filterSunscreenCandidates([eyeProbe], baseProbeAnswers({ eyeSensitive: true }));
assert.equal(containsId(eyeBefore.rejected, eyeProbe.id), false, "MR-SUN-EYE-001 before");
assert.equal(containsId(eyeAfter.rejected, eyeProbe.id), true, "MR-SUN-EYE-001 after");

const whiteCastProbe = makeSunscreenProbe({ white_cast: "high" });
const whiteCastBefore = filterSunscreenCandidates([whiteCastProbe], baseProbeAnswers({ whiteCastHate: false, toneUpWanted: false }));
const whiteCastAfter = filterSunscreenCandidates([whiteCastProbe], baseProbeAnswers({ whiteCastHate: true, toneUpWanted: false }));
assert.equal(containsId(whiteCastBefore.strictCandidates, whiteCastProbe.id), true, "MR-SUN-WHITECAST-001 before");
assert.equal(containsId(whiteCastAfter.strictCandidates, whiteCastProbe.id), false, "MR-SUN-WHITECAST-001 strict after");
assert.equal(containsId(whiteCastAfter.penaltyOnlyCandidates, whiteCastProbe.id), true, "white-cast fallback remains possible");

const pillingProbe = makeSunscreenProbe({ pilling_risk: "high" });
const pillingBefore = filterSunscreenCandidates([pillingProbe], baseProbeAnswers({ makeupUse: false }));
const pillingAfter = filterSunscreenCandidates([pillingProbe], baseProbeAnswers({ makeupUse: true }));
assert.equal(containsId(pillingBefore.strictCandidates, pillingProbe.id), true, "MR-SUN-MAKEUP-001 before");
assert.equal(containsId(pillingAfter.strictCandidates, pillingProbe.id), false, "MR-SUN-MAKEUP-001 strict after");
assert.equal(containsId(pillingAfter.penaltyOnlyCandidates, pillingProbe.id), true, "pilling fallback remains possible");

const drySoftMatteProbe = makeSunscreenProbe({ finish: "soft_matte" });
const drySoftMatte = filterSunscreenCandidates(
  [drySoftMatteProbe],
  baseProbeAnswers({ skinType: "dry", mainConcern: "barrier", mainConcerns: ["barrier", "dehydration"] })
);
assert.equal(containsId(drySoftMatte.strictCandidates, drySoftMatteProbe.id), false, "POL-SUN-005 strict eligibility");
assert.equal(containsId(drySoftMatte.penaltyOnlyCandidates, drySoftMatteProbe.id), true, "POL-SUN-005 fallback remains possible");

const drynessBefore = buildSurveyInputContract(
  baseProbeAnswers({ postWashFeeling: "comfortable", afternoonSkinChange: "mostly_same" }),
  { source: "eval_p3_mr_dryness_before", generatedAt: fixedGeneratedAt }
);
const drynessAfter = buildSurveyInputContract(
  baseProbeAnswers({ postWashFeeling: "tight", afternoonSkinChange: "mostly_same" }),
  { source: "eval_p3_mr_dryness_after", generatedAt: fixedGeneratedAt }
);
assert.notEqual(drynessBefore.safety.drynessRisk, "high", "MR-DERIVED-DRYNESS-001 precondition");
assert.equal(drynessAfter.safety.drynessRisk, "high", "MR-DERIVED-DRYNESS-001 after");

const rednessBefore = buildSurveyInputContract(
  baseProbeAnswers({ mainConcern: "uv", mainConcerns: ["uv"], sensitivity: "low", afternoonSkinChange: "mostly_same" }),
  { source: "eval_p3_mr_redness_before", generatedAt: fixedGeneratedAt }
);
const rednessAfter = buildSurveyInputContract(
  baseProbeAnswers({ mainConcern: "uv", mainConcerns: ["uv"], sensitivity: "low", afternoonSkinChange: "red_or_irritated" }),
  { source: "eval_p3_mr_redness_after", generatedAt: fixedGeneratedAt }
);
assert.notEqual(rednessBefore.safety.rednessRisk, "high", "MR-DERIVED-REDNESS-001 precondition");
assert.equal(rednessAfter.safety.rednessRisk, "high", "MR-DERIVED-REDNESS-001 after");

const e1Results = [
  { rule_id: "POL-GENDER-001", passed: genderBefore && !genderAfter, probe_authority: evaluatorRuleProbeAuthority },
  { rule_id: "POL-SUN-001", passed: containsId(sensitivityAfter.rejected, highIrritationProbe.id), probe_authority: evaluatorRuleProbeAuthority },
  { rule_id: "POL-SUN-002", passed: containsId(eyeAfter.rejected, eyeProbe.id), probe_authority: evaluatorRuleProbeAuthority },
  { rule_id: "POL-SUN-003", passed: !containsId(whiteCastAfter.strictCandidates, whiteCastProbe.id), probe_authority: evaluatorRuleProbeAuthority },
  { rule_id: "POL-SUN-004", passed: !containsId(pillingAfter.strictCandidates, pillingProbe.id), probe_authority: evaluatorRuleProbeAuthority },
  { rule_id: "POL-SUN-005", passed: !containsId(drySoftMatte.strictCandidates, drySoftMatteProbe.id), probe_authority: evaluatorRuleProbeAuthority }
];
assert(e1Results.every((result) => result.passed), "all frozen E1 policy constraints executable");

const metamorphicResults = [
  { relation_id: "MR-GENDER-001", passed: genderBefore && !genderAfter },
  { relation_id: "MR-SUN-EYE-001", passed: !containsId(eyeBefore.rejected, eyeProbe.id) && containsId(eyeAfter.rejected, eyeProbe.id) },
  { relation_id: "MR-SUN-WHITECAST-001", passed: containsId(whiteCastBefore.strictCandidates, whiteCastProbe.id) && !containsId(whiteCastAfter.strictCandidates, whiteCastProbe.id) },
  { relation_id: "MR-SUN-MAKEUP-001", passed: containsId(pillingBefore.strictCandidates, pillingProbe.id) && !containsId(pillingAfter.strictCandidates, pillingProbe.id) },
  { relation_id: "MR-SUN-SENSITIVITY-001", passed: !containsId(sensitivityBefore.rejected, highIrritationProbe.id) && containsId(sensitivityAfter.rejected, highIrritationProbe.id) },
  { relation_id: "MR-DERIVED-DRYNESS-001", passed: drynessBefore.safety.drynessRisk !== "high" && drynessAfter.safety.drynessRisk === "high" },
  { relation_id: "MR-DERIVED-REDNESS-001", passed: rednessBefore.safety.rednessRisk !== "high" && rednessAfter.safety.rednessRisk === "high" }
];
assert(metamorphicResults.every((result) => result.passed), "all frozen metamorphic relations executable");

const contractGapObservations = buildContractGapObservations(personas, negativeFixtures);
assert.equal(contractGapObservations.length, 4, "all four P2 domain contract gaps typed");
assert(contractGapObservations.every((item) => item.authority === "DIAGNOSTIC_ONLY"), "contract gaps remain diagnostic only");

const unexpectedNoResultCount = firstPass.filter((item) => item.projection.noResultClassification === "UNEXPECTED_NO_RESULT").length;
const semanticEvidence = {
  materialized_cohort_hash: materialized.lineage.cohort_hash,
  first_pass_hash: firstPassHash,
  second_pass_hash: secondPassHash,
  harness_equivalence: firstPass.every((item) => item.harness_equivalent),
  e1_results: e1Results,
  metamorphic_results: metamorphicResults,
  negative_results: negativeResults,
  contract_gap_observations: contractGapObservations
};
const semanticEvidenceHash = semanticHash(semanticEvidence);

const summary = {
  schema_version: "eval-p3-persona-simulation-summary-v1",
  stage: "EVAL-P3",
  terminal_outcome: "SUCCESS",
  evidence_class: "SYNTHETIC_SIMULATION_EVIDENCE",
  authority: {
    engine_sha: EVAL_P3_CONTRACTS.p2BaseMainSha,
    evaluation_implementation_sha: implementationSha,
    recommendation_reference_sha: EVAL_P3_CONTRACTS.recommendationReferenceSha,
    route_blob_sha: EVAL_P3_CONTRACTS.routeBlobSha,
    survey_contract_blob_sha: EVAL_P3_CONTRACTS.surveyContractBlobSha,
    recommendation_scorer_blob_sha: EVAL_P3_CONTRACTS.recommendationScorerBlobSha,
    skin_decision_engine_blob_sha: EVAL_P3_CONTRACTS.skinDecisionEngineBlobSha,
    catalog_declared_sha256: EVAL_P3_CONTRACTS.catalogDeclaredSha256,
    authorized_population_dataset: null
  },
  contracts: EVAL_P3_CONTRACTS,
  counts: {
    products: recommendationProducts.length,
    sunscreens: sunscreenProducts.length,
    personas: personas.length,
    coverage_personas: coveragePersonas.length,
    adversarial_personas: adversarialPersonas.length,
    population_prior_personas: 0,
    contract_negative_fixtures: negativeFixtures.length,
    llm_judge_calls: 0,
    unexpected_no_result_observations: unexpectedNoResultCount
  },
  acceptance: {
    deterministic_semantic_hash_replay: firstPassHash === secondPassHash,
    domain_core_harness_offline_executable: true,
    contract_integration_harness_offline_executable: true,
    harness_equivalence_asserted: firstPass.every((item) => item.harness_equivalent),
    e1_hard_constraints_executable: e1Results.every((result) => result.passed),
    frozen_metamorphic_relations_executable: metamorphicResults.every((result) => result.passed),
    contract_gap_observations_typed: contractGapObservations.length === 4,
    negative_contract_fixtures_typed: negativeResults.length === 8,
    historical_replay_required_by_ci: true,
    synthetic_evidence_evaluation_only: true
  },
  hashes: {
    cohort_hash: materialized.lineage.cohort_hash,
    first_pass_semantic_hash: firstPassHash,
    second_pass_semantic_hash: secondPassHash,
    semantic_evidence_hash: semanticEvidenceHash
  },
  evaluator_authority: {
    catalog_coverage: "CATALOG_COVERAGE_NOT_ESTABLISHED",
    population_prior_realism: "NOT_ESTABLISHED",
    real_user_preference_oracle: "NOT_ESTABLISHED",
    llm_judge_release_authority: "NOT_ESTABLISHED"
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
await Promise.all([
  writeFile(path.join(artifactRoot, "persona-simulation-summary-v1.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8"),
  writeFile(path.join(artifactRoot, "persona-run-results-v1.json"), `${JSON.stringify({
    schema_version: "eval-p3-persona-run-results-v1",
    materialization: materialized,
    results: firstPass,
    deterministic_replay_hash: secondPassHash
  }, null, 2)}\n`, "utf8"),
  writeFile(path.join(artifactRoot, "contract-gap-observations-v1.json"), `${JSON.stringify({
    schema_version: "eval-p3-contract-gap-observations-v1",
    observations: contractGapObservations,
    negative_results: negativeResults
  }, null, 2)}\n`, "utf8"),
  writeFile(path.join(artifactRoot, "metamorphic-results-v1.json"), `${JSON.stringify({
    schema_version: "eval-p3-metamorphic-results-v1",
    e1_results: e1Results,
    metamorphic_results: metamorphicResults,
    probe_authority: evaluatorRuleProbeAuthority
  }, null, 2)}\n`, "utf8")
]);

console.log(
  `verify-eval-p3-persona-simulation-v1: PASS personas=${personas.length} ` +
  `coverage=${coveragePersonas.length} adversarial=${adversarialPersonas.length} ` +
  `sunscreens=${sunscreenProducts.length} hash=${semanticEvidenceHash}`
);
