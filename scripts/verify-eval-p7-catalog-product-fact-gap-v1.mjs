import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const contractPath = process.env.EVAL_P7_CONTRACT_PATH || "fixtures/persona-evaluation/eval-p7-catalog-product-fact-gap-contract-v1.json";
const recommendationRoot = path.resolve(process.env.EVAL_P7_RECOMMENDATION_REFERENCE_ROOT || "_reference/recommendation");
const p5ArtifactRoot = path.resolve(process.env.EVAL_P7_P5_ARTIFACT_ROOT || "artifacts/eval-p5-replay");
const artifactRoot = path.resolve(process.env.EVAL_P7_ARTIFACT_ROOT || "artifacts/eval-p7");
const implementationSha = process.env.EVAL_P7_IMPLEMENTATION_SHA || "UNKNOWN";

function invariant(condition, message, details = null) {
  if (!condition) {
    const suffix = details === null ? "" : `\n${JSON.stringify(details, null, 2)}`;
    throw new Error(`${message}${suffix}`);
  }
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function semanticHash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}

function sourceFaithfulView(product) {
  const metadata = product?.metadata && typeof product.metadata === "object" && !Array.isArray(product.metadata)
    ? product.metadata
    : {};
  return { ...product, ...metadata };
}

function isSunscreen(product) {
  return String(product?.category || "").trim().toLowerCase() === "sunscreen";
}

function hasObservedField(product, field) {
  return Object.prototype.hasOwnProperty.call(product, field)
    && product[field] !== null
    && product[field] !== undefined
    && product[field] !== "";
}

function valueKey(value) {
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function countValues(products, field) {
  const counts = new Map();
  for (const product of products) {
    if (!hasObservedField(product, field)) continue;
    const key = valueKey(product[field]);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function matchesTarget(value, target) {
  return value === target;
}

const contract = JSON.parse(await readFile(contractPath, "utf8"));
invariant(contract.schema_version === "eval-p7-catalog-product-fact-gap-contract-v1", "Unexpected P7 contract schema");
invariant(contract.independent_catalog_reference.status === "NONE_AUTHORIZED", "P7 v1 must not silently introduce an independent catalog reference");
invariant(contract.product_fact_authority.status === "NOT_ESTABLISHED_FOR_FROZEN_RECOMMENDATION_FIXTURE", "P7 v1 Product Fact authority ceiling changed");
invariant(contract.engine_gap_authority.status === "ENGINE_GAP_NOT_ESTABLISHED", "P7 v1 Engine gap authority ceiling changed");

const fixturePath = path.join(recommendationRoot, "fixtures/recommendation-metadata/products-v1.json");
invariant(fs.existsSync(fixturePath), "Frozen Recommendation fixture missing", { fixturePath });
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
const rawProducts = Array.isArray(fixture.products) ? fixture.products : [];
invariant(rawProducts.length === 164, "Frozen Recommendation fixture product count changed", { actual: rawProducts.length });
const products = rawProducts.map(sourceFaithfulView);
const sunscreens = products.filter(isSunscreen);
invariant(sunscreens.length === 11, "Frozen Recommendation fixture sunscreen count changed", { actual: sunscreens.length });

const p5SummaryPath = path.join(p5ArtifactRoot, "counterfactual-metamorphic-summary-v1.json");
invariant(fs.existsSync(p5SummaryPath), "P5 replay summary missing", { p5SummaryPath });
const p5 = JSON.parse(await readFile(p5SummaryPath, "utf8"));
invariant(Array.isArray(p5.fixture_projection?.legacy_projection_gap_relations), "P5 legacy projection classification missing");
invariant(p5.fixture_projection.legacy_projection_gap_relations.length === 0, "P5 projection gap must be resolved before P7", p5.fixture_projection.legacy_projection_gap_relations);
const p5Absent = [...(p5.fixture_projection?.source_predicate_absent_relations || [])].sort();
const expectedRelations = contract.predicates.map((item) => item.relation_id).sort();
invariant(JSON.stringify(p5Absent) === JSON.stringify(expectedRelations), "P5 source-predicate gap set changed", { p5Absent, expectedRelations });

const predicateResults = contract.predicates.map((predicate) => {
  const scopeProducts = predicate.scope === "ALL_PRODUCTS" ? products : predicate.scope === "SUNSCREEN_ONLY" ? sunscreens : null;
  invariant(scopeProducts, "Unsupported predicate scope", predicate);
  invariant(scopeProducts.length === predicate.expected_scope_count, "Predicate scope count changed", {
    relation_id: predicate.relation_id,
    actual: scopeProducts.length,
    expected: predicate.expected_scope_count
  });

  const observed = scopeProducts.filter((product) => hasObservedField(product, predicate.field));
  const missing = scopeProducts.filter((product) => !hasObservedField(product, predicate.field));
  const matching = observed.filter((product) => matchesTarget(product[predicate.field], predicate.target_value));
  const nonmatching = observed.filter((product) => !matchesTarget(product[predicate.field], predicate.target_value));
  invariant(matching.length === predicate.expected_match_count, "Frozen fixture target-match count changed", {
    relation_id: predicate.relation_id,
    actual: matching.length,
    expected: predicate.expected_match_count
  });
  invariant(missing.length === 0, "Relevant frozen-fixture field is incomplete for predicate scope", {
    relation_id: predicate.relation_id,
    field: predicate.field,
    missing_product_ids: missing.map((item) => String(item.id)).sort()
  });

  return {
    relation_id: predicate.relation_id,
    scope: predicate.scope,
    field: predicate.field,
    target_value: predicate.target_value,
    scope_product_count: scopeProducts.length,
    field_observed_count: observed.length,
    field_missing_count: missing.length,
    target_match_count: matching.length,
    target_nonmatch_count: nonmatching.length,
    value_distribution: countValues(scopeProducts, predicate.field),
    target_match_product_ids: matching.map((item) => String(item.id)).sort(),
    classifications: [
      "FROZEN_FIXTURE_PRODUCT_PREDICATE_COVERAGE_GAP",
      "FROZEN_FIXTURE_RELEVANT_FIELD_COMPLETE_FOR_SCOPE",
      "FROZEN_FIXTURE_TARGET_VALUE_ABSENT"
    ]
  };
});

const observedFieldComplete = predicateResults.every((item) => item.field_missing_count === 0);
const allTargetsAbsent = predicateResults.every((item) => item.target_match_count === 0);
invariant(observedFieldComplete, "P7 expected complete relevant fields in frozen fixture scopes");
invariant(allTargetsAbsent, "P7 expected target-value absence in frozen fixture scopes");

const semanticEvidence = {
  schema_version: "eval-p7-catalog-product-fact-gap-evidence-v1",
  stage: "EVAL-P7",
  evidence_class: "SYNTHETIC_SIMULATION_EVIDENCE",
  reference_authority: {
    p5_authority_sha: contract.p5_authority_sha,
    p6_authority_sha: contract.p6_authority_sha,
    frozen_recommendation_reference_sha: contract.frozen_recommendation_reference_sha
  },
  synthetic_expression_linkage: {
    source: "EVAL-P5_FROZEN_METAMORPHIC_RELATIONS",
    relation_ids: expectedRelations,
    interpretation: "SYNTHETIC_PERSONA_SCENARIO_EXPRESSION_ONLY",
    real_user_or_market_demand_authority: false
  },
  frozen_fixture: {
    role: "FROZEN_RECOMMENDATION_METADATA_FIXTURE_NOT_INDEPENDENT_CATALOG_TRUTH",
    total_products: products.length,
    sunscreen_products: sunscreens.length,
    source_faithful_projection: "TOP_LEVEL_PLUS_EXISTING_METADATA_OVERLAY_NO_INVENTED_VALUES",
    predicate_results: predicateResults
  },
  taxonomy: {
    frozen_fixture_gap: "FROZEN_FIXTURE_PRODUCT_PREDICATE_COVERAGE_GAP",
    frozen_fixture_relevant_field_state: "FROZEN_FIXTURE_RELEVANT_FIELD_COMPLETE_FOR_SCOPE",
    frozen_fixture_target_value_state: "FROZEN_FIXTURE_TARGET_VALUE_ABSENT",
    product_fact_authority: "PRODUCT_FACT_AUTHORITY_NOT_ESTABLISHED_FOR_FROZEN_FIXTURE",
    catalog_coverage: "CATALOG_COVERAGE_NOT_ESTABLISHED",
    engine_gap: "ENGINE_GAP_NOT_ESTABLISHED"
  },
  authority_ceiling: {
    independent_catalog_reference: "NONE_AUTHORIZED",
    current_production_catalog_absence_claimed: false,
    governed_current_product_fact_completeness_claimed: false,
    engine_failure_claimed: false,
    market_prevalence_claimed: false,
    real_user_demand_claimed: false,
    satisfaction_or_conversion_claimed: false,
    enforce_authorization_changed: false
  },
  production_boundary: {
    production_network_calls: 0,
    hosted_writes: 0,
    product_fact_writes: 0,
    organic_evidence_writes: 0,
    controlled_production_probes: 0,
    production_recommendation_mutations: 0,
    shadow_mode_changed: false,
    enforce_authorized: false,
    enforce_activated: false
  },
  acceptance: {
    p5_five_source_predicate_gaps_reproduced: true,
    p5_projection_gap_absent: true,
    relevant_field_presence_measured_separately_from_target_value: true,
    relevant_fields_complete_in_frozen_fixture_scopes: observedFieldComplete,
    target_values_absent_in_frozen_fixture_scopes: allTargetsAbsent,
    frozen_fixture_not_promoted_to_independent_catalog_truth: true,
    frozen_fixture_not_promoted_to_governed_current_product_fact: true,
    catalog_coverage_not_established_without_independent_reference: true,
    engine_gap_not_established_without_product_and_fact_support: true,
    recommendation_top_k_not_used_as_truth: true,
    synthetic_expression_not_interpreted_as_market_or_real_user_demand: true
  },
  terminal_outcome: "CATALOG_PRODUCT_FACT_GAP_TAXONOMY_ESTABLISHED_WITH_CATALOG_COVERAGE_NOT_ESTABLISHED"
};

const evidenceSemanticHash = semanticHash(semanticEvidence);
const contractSemanticHash = semanticHash(contract);
const summary = {
  schema_version: "eval-p7-catalog-product-fact-gap-summary-v1",
  implementation_sha: implementationSha,
  ...semanticEvidence,
  hashes: {
    evidence_semantic_hash: evidenceSemanticHash,
    contract_semantic_hash: contractSemanticHash
  }
};

await mkdir(artifactRoot, { recursive: true });
await writeFile(path.join(artifactRoot, "catalog-product-fact-gap-summary-v1.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
await writeFile(path.join(artifactRoot, "catalog-product-fact-predicate-matrix-v1.json"), `${JSON.stringify({
  schema_version: "eval-p7-catalog-product-fact-predicate-matrix-v1",
  predicate_results: predicateResults,
  evidence_semantic_hash: evidenceSemanticHash
}, null, 2)}\n`, "utf8");

console.log("EVAL-P7 Catalog/Product Fact gap evaluator: PASS");
console.log(`terminal_outcome=${semanticEvidence.terminal_outcome}`);
console.log(`predicates=${predicateResults.length}`);
console.log(`frozen_fixture_products=${products.length}`);
console.log(`frozen_fixture_sunscreens=${sunscreens.length}`);
console.log(`catalog_coverage=${semanticEvidence.taxonomy.catalog_coverage}`);
console.log(`product_fact_authority=${semanticEvidence.taxonomy.product_fact_authority}`);
console.log(`engine_gap=${semanticEvidence.taxonomy.engine_gap}`);
console.log(`evidence_semantic_hash=${evidenceSemanticHash}`);
