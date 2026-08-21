import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { register } from "node:module";
import path from "node:path";

register("./node-next-alias-loader.mjs", import.meta.url);

globalThis.fetch = async () => {
  throw new Error("EVAL_P8_NETWORK_CALL_FORBIDDEN");
};

const [
  { buildRecommendationProductFromSource },
  { buildSkinMatchDecisionBundle },
  { buildFallbackPhotoAnalysis }
] = await Promise.all([
  import("../lib/product-source.js"),
  import("../lib/skin-match-decision-engine.js"),
  import("../lib/photo-evidence.js")
]);

const contractPath = path.resolve(process.env.EVAL_P8_CONTRACT_PATH || "fixtures/persona-evaluation/eval-p8-llm-judge-contract-v1.json");
const cohortPath = path.resolve(process.env.EVAL_P8_COHORT_PATH || "fixtures/persona-evaluation/eval-p6-locked-regression-cohort-v1.json");
const p3ReferenceRoot = path.resolve(process.env.EVAL_P8_P3_REFERENCE_ROOT || "_reference/persona-p3");
const recommendationReferenceRoot = path.resolve(process.env.EVAL_P8_RECOMMENDATION_REFERENCE_ROOT || "_reference/recommendation");
const artifactRoot = path.resolve(process.env.EVAL_P8_ARTIFACT_ROOT || "artifacts/eval-p8/input");
const implementationSha = process.env.EVAL_P8_IMPLEMENTATION_SHA || "UNSPECIFIED_IMPLEMENTATION_SHA";

const [contract, cohort, productsFixture] = await Promise.all([
  readFile(contractPath, "utf8").then(JSON.parse),
  readFile(cohortPath, "utf8").then(JSON.parse),
  readFile(path.join(recommendationReferenceRoot, "fixtures/recommendation-metadata/products-v1.json"), "utf8").then(JSON.parse)
]);

const p3ModuleUrl = pathToFileURL(path.join(p3ReferenceRoot, "scripts/persona-evaluation/eval-p3-contracts.mjs")).href;
const p3 = await import(p3ModuleUrl);

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

function sourceFaithfulProjection(raw) {
  const metadata = raw?.metadata && typeof raw.metadata === "object" ? raw.metadata : {};
  return {
    ...raw,
    ...metadata,
    id: raw.id,
    name: raw.name,
    brand: raw.brand,
    category: raw.category
  };
}

function pickSample(personas, memberIds) {
  const allowed = new Set(memberIds);
  const locked = personas.filter((persona) => allowed.has(persona.persona_id));
  const adversarial = locked.filter((persona) => persona.cohort_type === "ADVERSARIAL_COHORT");
  const coverage = locked.filter((persona) => persona.cohort_type === "COVERAGE_COHORT");
  const coverageByConcern = new Map();
  for (const persona of coverage) {
    if (!coverageByConcern.has(persona.domain.primaryConcern)) coverageByConcern.set(persona.domain.primaryConcern, persona);
  }
  const concernOrder = ["oiliness", "dehydration", "acne", "pores", "redness", "barrier", "uneven_tone", "uv"];
  const selectedCoverage = concernOrder.map((concern) => coverageByConcern.get(concern));
  assert(selectedCoverage.every(Boolean), "P8 coverage sample must represent every primary concern exactly once");
  assert.equal(adversarial.length, 8, "P8 includes all eight P6 adversarial personas");
  return [...selectedCoverage, ...adversarial];
}

function maskedProduct(product) {
  if (!product) return null;
  return {
    category: product.category || null,
    reason: product.reason || ""
  };
}

function projectEvidence(items) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    axis: item?.axis || null,
    label: item?.label || "",
    detail: item?.detail || ""
  }));
}

function projectJudgeCase(persona, bundle) {
  const domain = persona.domain;
  return {
    case_id: `EVAL-P8-${persona.persona_id}`,
    persona: {
      persona_id: persona.persona_id,
      source_cohort: persona.cohort_type,
      primaryConcern: domain.primaryConcern,
      secondaryConcern: domain.secondaryConcern,
      skinType: domain.skinType,
      sensitivity: domain.sensitivity,
      postWashFeeling: domain.postWashFeeling,
      afternoonSkinChange: domain.afternoonSkinChange,
      environmentExposure: domain.environmentExposure,
      preferredTexture: domain.preferredTexture,
      mostDislikedFeel: domain.mostDislikedFeel,
      sunscreen: domain.sunscreen,
      genderPreference: domain.profile.genderPreference,
      verySensitivePeriod: domain.routeExtensions.verySensitivePeriod,
      applicable_rule_refs: persona.applicable_rule_refs
    },
    recommendation_explanation: {
      priority_axis: bundle?.priority?.axis || null,
      priority_top_category: bundle?.priority?.topCategory || null,
      summary: bundle?.summary || "",
      top_pick: maskedProduct(bundle?.topPick),
      premium_top_pick_detailed_reason: bundle?.premiumReport?.topPickDetailedReason || "",
      warnings: Array.isArray(bundle?.warnings) ? bundle.warnings : [],
      alternative: bundle?.alternative ? {
        category: bundle.alternative.category || null,
        reason: bundle.alternative.reason || ""
      } : null,
      survey_evidence: projectEvidence(bundle?.surveyEvidence),
      photo_evidence: projectEvidence(bundle?.photoEvidence)
    },
    judge_limits: {
      product_name_exposed: false,
      brand_identity_exposed: false,
      comparison_identity_text_exposed: false,
      numeric_recommendation_score_exposed: false,
      recommendation_rank_is_truth: false,
      product_correctness_is_in_scope: false,
      release_decision_is_in_scope: false
    }
  };
}

function assertIdentityRedaction(cases, rawProducts) {
  const serialized = JSON.stringify(cases).toLowerCase();
  for (const product of rawProducts) {
    const name = String(product?.name || "").trim().toLowerCase();
    const brand = String(product?.brand || "").trim().toLowerCase();
    if (name.length >= 4) assert.equal(serialized.includes(name), false, `P8 judge input leaks product name: ${product.id}`);
    if (brand.length >= 5) assert.equal(serialized.includes(brand), false, `P8 judge input leaks brand identity: ${product.id}`);
  }
}

assert.equal(contract.stage, "EVAL-P8");
assert.equal(contract.authority.judge_authority, "DIAGNOSTIC_ONLY");
assert.equal(contract.authority.release_blocker_authority, false);
assert.equal(contract.sample_contract.sample_count, 16);
assert.equal(contract.judge_input_policy.product_name_exposed, false);
assert.equal(contract.judge_input_policy.brand_identity_exposed, false);
assert.equal(contract.judge_input_policy.comparison_identity_text_exposed, false);
assert.equal(cohort.cohort.lifecycle, "LOCKED");
assert.equal(cohort.cohort.persona_count, 37);
assert.equal(productsFixture.productCount, 164);
assert.equal(productsFixture.categoryCounts?.sunscreen, 11);

const materialized = p3.materializeP3Personas();
const sample = pickSample(materialized.personas, cohort.cohort.member_ids);
assert.equal(sample.length, 16);
assert.equal(sample.filter((item) => item.cohort_type === "COVERAGE_COHORT").length, 8);
assert.equal(sample.filter((item) => item.cohort_type === "ADVERSARIAL_COHORT").length, 8);

const products = productsFixture.products
  .map(sourceFaithfulProjection)
  .map(buildRecommendationProductFromSource);
assert.equal(products.length, 164);

const cases = [];
for (const persona of sample) {
  const bundle = await buildSkinMatchDecisionBundle(p3.toRecommendationAnswers(persona.domain), {
    products,
    photoAnalysis: buildFallbackPhotoAnalysis("ko"),
    currentProducts: [],
    currentProductSnapshots: [],
    locale: "ko"
  });
  cases.push(projectJudgeCase(persona, bundle));
}
assertIdentityRedaction(cases, productsFixture.products);

const promptMaterial = {
  prompt_version: contract.prompt.prompt_version,
  system_text: contract.prompt.system_text,
  user_template: contract.prompt.user_template,
  response_schema: contract.prompt.response_schema,
  rubric: contract.rubric
};
const promptSemanticHash = semanticHash(promptMaterial);
const caseSetHash = semanticHash(cases);
const output = {
  schema_version: "eval-p8-bounded-llm-judge-input-set-v1",
  stage: "EVAL-P8",
  implementation_sha: implementationSha,
  source: {
    p6_cohort_id: cohort.cohort.cohort_id,
    p6_cohort_hash: cohort.cohort.cohort_hash,
    recommendation_fixture_sha: productsFixture.canonicalFixtureSha256,
    persona_materialization_sha: process.env.EVAL_P8_P3_SOURCE_SHA || "4265450ddcf40bdb4359a3d5c82d22b00a1024dd"
  },
  sampling: contract.sample_contract,
  prompt: {
    prompt_version: contract.prompt.prompt_version,
    prompt_semantic_hash: promptSemanticHash,
    system_text: contract.prompt.system_text,
    user_template: contract.prompt.user_template,
    response_schema: contract.prompt.response_schema
  },
  authority: contract.authority,
  case_count: cases.length,
  case_set_semantic_hash: caseSetHash,
  cases
};

await mkdir(artifactRoot, { recursive: true });
await writeFile(path.join(artifactRoot, "bounded-llm-judge-inputs-v1.json"), `${JSON.stringify(output, null, 2)}\n`, "utf8");

console.log("EVAL-P8 bounded LLM judge input materialization: PASS");
console.log(`case_count=${cases.length}`);
console.log(`prompt_semantic_hash=${promptSemanticHash}`);
console.log(`case_set_semantic_hash=${caseSetHash}`);
