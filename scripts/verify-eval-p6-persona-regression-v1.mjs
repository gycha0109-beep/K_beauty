import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { register } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

register("./node-next-alias-loader.mjs", import.meta.url);

globalThis.fetch = async () => {
  throw new Error("EVAL_P6_NETWORK_CALL_FORBIDDEN");
};

const engineRoot = path.resolve(process.env.EVAL_P6_ENGINE_ROOT || process.cwd());
const p3ReferenceRoot = path.resolve(process.env.EVAL_P6_P3_REFERENCE_ROOT || "_reference/persona-p3");
const recommendationReferenceRoot = path.resolve(process.env.EVAL_P6_RECOMMENDATION_REFERENCE_ROOT || "_reference/recommendation");
const p4ManifestPath = path.resolve(process.env.EVAL_P6_P4_MANIFEST_PATH || "fixtures/persona-evaluation/eval-p4-cohort-freeze-manifest-v1.json");
const p6CohortPath = path.resolve(process.env.EVAL_P6_COHORT_PATH || "fixtures/persona-evaluation/eval-p6-locked-regression-cohort-v1.json");
const artifactRoot = path.resolve(process.env.EVAL_P6_ARTIFACT_ROOT || "artifacts/eval-p6/current");
const engineSha = process.env.EVAL_P6_ENGINE_SHA || "UNSPECIFIED_ENGINE_SHA";
const runRole = process.env.EVAL_P6_RUN_ROLE || "UNSPECIFIED";
const fixedGeneratedAt = "2000-01-01T00:00:00.000Z";

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort((a, b) => a.localeCompare(b, "en")).map((key) => [key, stable(value[key])]));
  }
  return value;
}
function hash(value) { return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex"); }
function hashBytes(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
async function fileSha256(filePath) { return hashBytes(await readFile(filePath)); }

const p3Contracts = await import(pathToFileURL(path.join(p3ReferenceRoot, "scripts/persona-evaluation/eval-p3-contracts.mjs")).href);
const { EVAL_P3_CONTRACTS, buildRouteLikePayload, materializeP3Personas, materializeRouteRecommendationInput, semanticHash, toRecommendationAnswers, validateMaterializedPersona } = p3Contracts;
const importEngine = (relativePath) => import(pathToFileURL(path.join(engineRoot, relativePath)).href);
const [
  { buildRecommendationProductFromSource },
  { buildSkinMatchDecisionBundle },
  { buildFallbackPhotoAnalysis },
  { buildSurveyInputContract },
  { isProductEligibleForGenderPreference, normalizeRecommendationAnswers },
  { fingerprintCandidateExposureShadowValue }
] = await Promise.all([
  importEngine("lib/product-source.js"),
  importEngine("lib/skin-match-decision-engine.js"),
  importEngine("lib/photo-evidence.js"),
  importEngine("lib/survey-input-contract.js"),
  importEngine("lib/recommendation-scoring.ts"),
  importEngine("lib/candidate-exposure-policy-shadow.js")
]);

const [p4Manifest, p6Manifest, productsFixture] = await Promise.all([
  readFile(p4ManifestPath, "utf8").then(JSON.parse),
  readFile(p6CohortPath, "utf8").then(JSON.parse),
  readFile(path.join(recommendationReferenceRoot, "fixtures/recommendation-metadata/products-v1.json"), "utf8").then(JSON.parse)
]);

assert.equal(p4Manifest.schema_version, "eval-p4-cohort-freeze-manifest-v1");
assert.equal(p6Manifest.schema_version, "eval-p6-locked-regression-cohort-manifest-v1");
assert.equal(p6Manifest.cohort.cohort_type, "LOCKED_REGRESSION_COHORT");
assert.equal(p6Manifest.cohort.lifecycle, "LOCKED");
assert.equal(p6Manifest.cohort.persona_count, 37);
assert.equal(p6Manifest.cohort.prng_algorithm, "NONE");
assert.equal(p6Manifest.cohort.seed, 0);
assert.equal(productsFixture.productCount, 164);
assert.equal(productsFixture.categoryCounts?.sunscreen, 11);
assert.equal(productsFixture.canonicalFixtureSha256, EVAL_P3_CONTRACTS.catalogDeclaredSha256);

const cohortHashPayload = {
  cohort_definition_version: p6Manifest.cohort.cohort_definition_version,
  sampler_version: p6Manifest.cohort.sampler_version,
  prng_algorithm: p6Manifest.cohort.prng_algorithm,
  seed: p6Manifest.cohort.seed,
  generation_manifest: p6Manifest.cohort.generation_manifest,
  member_ids: p6Manifest.cohort.member_ids
};
assert.equal(hash(cohortHashPayload), p6Manifest.cohort.cohort_hash, "locked regression cohort hash");

const p4Coverage = p4Manifest.locked_cohorts.find((cohort) => cohort.cohort_type === "COVERAGE_COHORT");
const p4Adversarial = p4Manifest.locked_cohorts.find((cohort) => cohort.cohort_type === "ADVERSARIAL_COHORT");
assert(p4Coverage); assert(p4Adversarial);
assert.equal(p4Coverage.lifecycle, "LOCKED");
assert.equal(p4Adversarial.lifecycle, "LOCKED");
const sourceCohorts = p6Manifest.cohort.generation_manifest.source_cohorts;
assert.deepEqual(sourceCohorts[0].member_ids, p4Coverage.member_ids);
assert.deepEqual(sourceCohorts[1].member_ids, p4Adversarial.member_ids);
assert.equal(sourceCohorts[0].cohort_hash, p4Coverage.cohort_hash);
assert.equal(sourceCohorts[1].cohort_hash, p4Adversarial.cohort_hash);
assert.deepEqual(p6Manifest.cohort.member_ids, [...p4Coverage.member_ids, ...p4Adversarial.member_ids]);
assert.equal(new Set(p6Manifest.cohort.member_ids).size, p6Manifest.cohort.persona_count);
assert.equal(p4Manifest.regression_cohort.lifecycle, "NOT_CREATED", "P4 must remain historically NOT_CREATED");

const materialized = materializeP3Personas();
const personaById = new Map(materialized.personas.map((persona) => [persona.persona_id, persona]));
const personas = p6Manifest.cohort.member_ids.map((personaId) => {
  const persona = personaById.get(personaId);
  assert(persona, `${personaId}: immutable P3 source persona`);
  assert.deepEqual(validateMaterializedPersona(persona), [], `${personaId}: valid materialized persona`);
  return persona;
});
assert.equal(personas.length, 37);

const orderedProducts = [...productsFixture.products].sort((left, right) => String(left.category).localeCompare(String(right.category), "en") || String(left.brand).localeCompare(String(right.brand), "en") || String(left.name).localeCompare(String(right.name), "en") || String(left.id).localeCompare(String(right.id), "en"));
const recommendationProducts = orderedProducts.map(buildRecommendationProductFromSource);
assert.equal(recommendationProducts.length, 164);
const productIdByName = new Map(recommendationProducts.map((product) => [String(product.name || "").trim(), String(product.id)]));

function getProductId(value) {
  if (!value || typeof value !== "object") return null;
  const direct = value.id || value.productId || value.product_id;
  if (direct) return String(direct);
  if (value.product && typeof value.product === "object") return getProductId(value.product);
  return null;
}
function projectCategoryPicks(value) {
  if (Array.isArray(value)) return value.map((item) => getProductId(item)).filter(Boolean);
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(Object.keys(value).sort((a, b) => a.localeCompare(b, "en")).map((key) => [key, getProductId(value[key])]));
}
function stepProductId(step) {
  const direct = getProductId(step); if (direct) return direct;
  const product = step?.product;
  if (typeof product === "string") return productIdByName.get(product.trim()) || null;
  const name = step?.productName || step?.name;
  if (typeof name === "string") return productIdByName.get(name.trim()) || null;
  return null;
}
function projectRoutineProductIds(bundle, phase) {
  const candidates = [bundle?.premiumReport?.fullRoutine?.[`${phase}Steps`], bundle?.fullRoutine?.[`${phase}Steps`], bundle?.[`${phase}Steps`], bundle?.[phase]].filter(Array.isArray);
  const output = [];
  for (const list of candidates) for (const item of list) { const id = stepProductId(item); if (id && !output.includes(id)) output.push(id); }
  return output;
}
function priorityIdentity(priority) {
  if (typeof priority === "string") return priority;
  if (!priority || typeof priority !== "object") return null;
  return priority.axis || priority.key || priority.id || null;
}
function semanticProjection(bundle, normalizedAnswers) {
  const eligibleProductIds = recommendationProducts.filter((product) => isProductEligibleForGenderPreference(product, normalizedAnswers)).map((product) => String(product.id)).sort((a, b) => a.localeCompare(b, "en"));
  const topPickId = getProductId(bundle?.topPick);
  const alternativeId = getProductId(bundle?.alternative) || getProductId(bundle?.altPicks?.[0]);
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
    noResultClassification: topPickId ? null : eligibleProductIds.length === 0 ? "EXPECTED_ABSTENTION" : "UNEXPECTED_NO_RESULT"
  };
}
function publicSnapshot(bundle, scoredProducts) {
  return {
    summary: bundle.summary, priority: bundle.priority, topPick: bundle.topPick, altPicks: bundle.altPicks, categoryPicks: bundle.categoryPicks, products: bundle.products,
    supportingConcerns: bundle.supportingConcerns, morning: bundle.morning, night: bundle.night, avoid: bundle.avoid, scoring: bundle.scoring, premiumReport: bundle.premiumReport,
    ranked: scoredProducts.map((product) => ({ id: product.id, engine_score: product.engine_score, score: product.score, reason: product.reason, comparison_reason: product.comparison_reason, decision_meta: product.decision_meta, score_breakdown: product.score_breakdown }))
  };
}
function surveyDerived(contract) {
  return {
    sensitivityRisk: contract.safety.sensitivityRisk,
    drynessRisk: contract.safety.drynessRisk,
    rednessRisk: contract.safety.rednessRisk,
    sunscreenSourceCompleteness: contract.sunscreen.sourceCompleteness,
    warnings: [...contract.metadata.warnings].sort((a, b) => a.localeCompare(b, "en"))
  };
}
async function runHarness(input, source) {
  const normalizedAnswers = normalizeRecommendationAnswers(input);
  const surveyContract = buildSurveyInputContract(input, { source, generatedAt: fixedGeneratedAt });
  const bundle = await buildSkinMatchDecisionBundle(input, { products: recommendationProducts, photoAnalysis: buildFallbackPhotoAnalysis("ko"), currentProducts: [], currentProductSnapshots: [], includeCandidateSourceDiagnostics: true, locale: "ko" });
  const scoredProducts = bundle?.diagnostics?.candidateSource?.products || [];
  assert.equal(scoredProducts.length, 164, `${source}: scored product count`);
  const projection = semanticProjection(bundle, normalizedAnswers);
  const snapshot = publicSnapshot(bundle, scoredProducts);
  const derived = surveyDerived(surveyContract);
  return {
    projection,
    projection_hash: hash(projection), response_hash: hash(snapshot),
    ranking_hash: hash(snapshot.ranked.map((item) => [item.id, item.engine_score, item.score])),
    score_hash: hash(snapshot.ranked.map((item) => [item.id, item.score_breakdown])),
    explanation_hash: hash(snapshot.ranked.map((item) => [item.id, item.reason, item.comparison_reason])),
    candidate_policy_fingerprint: fingerprintCandidateExposureShadowValue(snapshot),
    survey_derived: derived, survey_derived_hash: hash(derived),
    top_ranked_ids: snapshot.ranked.slice(0, 10).map((item) => String(item.id))
  };
}

const personaSnapshots = [];
for (let index = 0; index < personas.length; index += 1) {
  const persona = personas[index];
  const directInput = toRecommendationAnswers(persona.domain);
  const routePayload = buildRouteLikePayload(persona.domain, { explicitOutdoorExposure: index % 2 === 0 });
  const routeInput = materializeRouteRecommendationInput(routePayload);
  const domainCore = await runHarness(directInput, "eval_p6_domain_core");
  const contractIntegration = await runHarness(routeInput, "eval_p6_contract_integration");
  assert.deepEqual(domainCore.projection, contractIntegration.projection, `${persona.persona_id}: harness semantic projection equivalence`);
  assert.deepEqual(domainCore.survey_derived, contractIntegration.survey_derived, `${persona.persona_id}: survey derived equivalence`);
  const snapshot = {
    persona_id: persona.persona_id,
    source_cohort_type: persona.cohort_type,
    source_persona_hash: semanticHash(persona),
    domain_hash: semanticHash(persona.domain),
    domain_core: {
      projection_hash: domainCore.projection_hash, response_hash: domainCore.response_hash, ranking_hash: domainCore.ranking_hash, score_hash: domainCore.score_hash,
      explanation_hash: domainCore.explanation_hash, candidate_policy_fingerprint: domainCore.candidate_policy_fingerprint, survey_derived_hash: domainCore.survey_derived_hash, top_ranked_ids: domainCore.top_ranked_ids
    },
    contract_integration: {
      projection_hash: contractIntegration.projection_hash, response_hash: contractIntegration.response_hash, ranking_hash: contractIntegration.ranking_hash, score_hash: contractIntegration.score_hash,
      explanation_hash: contractIntegration.explanation_hash, candidate_policy_fingerprint: contractIntegration.candidate_policy_fingerprint, survey_derived_hash: contractIntegration.survey_derived_hash, top_ranked_ids: contractIntegration.top_ranked_ids
    },
    harness_equivalence: true
  };
  snapshot.persona_regression_hash = hash(snapshot);
  personaSnapshots.push(snapshot);
}

const keyEngineFiles = { survey_contract: "lib/survey-input-contract.js", recommendation_scorer: "lib/recommendation-scoring.ts", skin_decision_engine: "lib/skin-match-decision-engine.js", analyze_route: "app/api/analyze/route.js" };
const engineFileHashes = {};
for (const [key, relativePath] of Object.entries(keyEngineFiles)) engineFileHashes[key] = await fileSha256(path.join(engineRoot, relativePath));
const dependencyLockHash = await fileSha256(path.join(engineRoot, "package-lock.json"));
const catalogFilePath = path.join(recommendationReferenceRoot, "fixtures/recommendation-metadata/products-v1.json");
const catalogFileHash = await fileSha256(catalogFilePath);
const productFactNotConsumedHash = hash("P6_OFFLINE_REGRESSION_DOES_NOT_CONSUME_PRODUCT_FACT_AUTHORITY");
const featureFlagSnapshot = {
  DEV_ONLY_CANDIDATE_EXPOSURE_POLICY_SHADOW: process.env.DEV_ONLY_CANDIDATE_EXPOSURE_POLICY_SHADOW || "ABSENT",
  DISABLE_CANDIDATE_EXPOSURE_POLICY_SHADOW: process.env.DISABLE_CANDIDATE_EXPOSURE_POLICY_SHADOW || "ABSENT",
  VERCEL_ENV: process.env.VERCEL_ENV || "ABSENT",
  NODE_ENV: process.env.NODE_ENV || "ABSENT"
};
const deterministicContext = {
  population_dataset_id: "NONE", population_dataset_version: "NONE", population_dataset_hash: "NONE",
  cohort_type: p6Manifest.cohort.cohort_type, cohort_definition_version: p6Manifest.cohort.cohort_definition_version, sampler_version: p6Manifest.cohort.sampler_version,
  prng_algorithm: p6Manifest.cohort.prng_algorithm, cohort_seed: p6Manifest.cohort.seed, cohort_hash: p6Manifest.cohort.cohort_hash, persona_count: p6Manifest.cohort.persona_count,
  domain_adapter_version: "kbeauty-domain-persona-v1", decision_model_version: "persona-decision-model-v1", interaction_model_version: "NONE_NOT_IN_EVAL_P6",
  scenario_generator_version: "eval-p6-locked-regression-exact-replay-v1", survey_adapter_version: EVAL_P3_CONTRACTS.routeAdapterVersion,
  recommendation_contract_version: "UNVERSIONED_PINNED_BY_CONTRACT_AND_ENGINE_FILE_HASHES", runtime_version: process.version, dependency_lock_hash: dependencyLockHash,
  relevant_feature_flag_snapshot: featureFlagSnapshot, catalog_snapshot_reference: EVAL_P3_CONTRACTS.recommendationReferenceSha,
  catalog_snapshot_declared_hash: productsFixture.canonicalFixtureSha256, catalog_snapshot_file_hash: catalogFileHash,
  product_fact_authority_snapshot: "NOT_CONSUMED_BY_P6_OFFLINE_REGRESSION_HARNESS", product_fact_snapshot_hash: productFactNotConsumedHash,
  deterministic_evaluator_version: p6Manifest.regression_contract.deterministic_evaluator_version,
  llm_judge_model: "NONE", llm_judge_prompt_version: "NONE", llm_judge_config: "NONE"
};
const outputSemanticPayload = { cohort_id: p6Manifest.cohort.cohort_id, cohort_hash: p6Manifest.cohort.cohort_hash, persona_snapshots: personaSnapshots };
const summary = {
  schema_version: "eval-p6-persona-regression-run-summary-v1", stage: "EVAL-P6", run_role: runRole, engine_sha: engineSha, engine_root: engineRoot,
  deterministic_context: deterministicContext, deterministic_context_hash: hash(deterministicContext), engine_file_hashes: engineFileHashes,
  output_semantic_hash: hash(outputSemanticPayload), persona_count: personaSnapshots.length,
  harness_equivalence_count: personaSnapshots.filter((item) => item.harness_equivalence).length,
  authority_ceiling: p6Manifest.authority_ceiling,
  operational_metadata: { simulation_run_id: process.env.EVAL_P6_SIMULATION_RUN_ID || "UNSPECIFIED", created_at: process.env.EVAL_P6_CREATED_AT || "OPERATIONAL_METADATA_NOT_CANONICALIZED" }
};

await mkdir(artifactRoot, { recursive: true });
await Promise.all([
  writeFile(path.join(artifactRoot, "eval-p6-run-summary-v1.json"), `${JSON.stringify(summary, null, 2)}\n`),
  writeFile(path.join(artifactRoot, "eval-p6-persona-snapshots-v1.json"), `${JSON.stringify({ schema_version: "eval-p6-persona-regression-snapshots-v1", stage: "EVAL-P6", cohort_id: p6Manifest.cohort.cohort_id, cohort_hash: p6Manifest.cohort.cohort_hash, persona_snapshots: personaSnapshots }, null, 2)}\n`)
]);
console.log(`EVAL-P6 regression run PASS role=${runRole} personas=${personaSnapshots.length} cohort=${p6Manifest.cohort.cohort_hash} output=${summary.output_semantic_hash}`);
