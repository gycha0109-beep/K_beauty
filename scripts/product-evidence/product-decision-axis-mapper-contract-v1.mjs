#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const VERSION = "product-decision-axis-mapper-contract-v1";
export const STAGE = "V2.1-8J";
export const SNAPSHOT_PATH = "evidence/product-decision-axis-readiness-v1/product-decision-axis-input-snapshot-v1.json";
export const CONTRACT_PATH = "evidence/product-decision-axis-contract-v1/product-decision-axis-mapper-contract-v1.json";
export const REPLAY_PATH = "evidence/product-decision-axis-contract-v1/product-decision-axis-contract-replay-v1.json";
export const DOC_PATH = "docs/evidence/product-decision-axis-mapper-contract-v1.md";

const EXFOLIATING_V1 = Object.freeze(["lactic_acid","mandelic_acid","salicylic_acid"]);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}
export function canonicalJson(value) { return JSON.stringify(stable(value)) + "\n"; }
export function sha256Text(text) { return crypto.createHash("sha256").update(text).digest("hex"); }
export function sha256Json(value) { return sha256Text(canonicalJson(value)); }

const AUTHORITY = Object.freeze({
  repository: "gycha0109-beep/K_beauty",
  execution_main_sha: "6f573b632824be13dfe208f29c796aa3306b4984",
  hosted_project: "bygrczggxfuisupcevaz",
  registry_version: "product-fact-registry-cross-category-v1",
  registry_checksum: "79d41ac13de8080df5199543e31ad7bbc1c1763836ef776313613b7547b79575",
  registry_definition_count: 20,
  subject_serializer: "product-fact-subject-identity-v1",
  proposition_serializer_lineage: "product-fact-proposition-pilot-v1",
  v21_8i_audit_sha256: "589dafe9ab4db7849676aef69d26e5122b4c64aea7bd548a497e60b6a21d5057",
  v21_8i_snapshot_sha256: "fde7b6fd9902ff965424be43d3c5e5bc1845f5e0a2fa97d3860376859636f05b",
});

export const CONTRACT_VOCABULARY = Object.freeze({
  mapper_signal_eligibility: "Whether governed Product Fact Current may legitimately contribute semantic signal or context to one Product Decision Axis. It does not authorize magnitude.",
  calibration_cohort_eligibility: "Whether one resolved product has the minimum governed signal state, semantic status, authority, identity, and scope needed to enter a bounded offline/shadow calibration cohort.",
  axis_cohort_readiness: "Whether individually eligible distinct products satisfy the v1 structural floor and mapper-topology coverage needed to start a bounded offline/shadow calibration experiment.",
  numeric_calibration: "A separate future policy that may define numeric estimates, weights, priors, scales, or uncertainty. V2.1-8J does none of these.",
  production_consumption: "A separately authorized future runtime path from Product Decision Axis output into production Recommendation. V2.1-8J leaves it disabled.",
});

export const REPRESENTATIVE_COVERAGE_POLICY = Object.freeze({
  prior_proposal: {
    source: "evidence/product-fact-catalog-expansion-v1/coverage-expansion-wave-1-selection-v1.json",
    version: "catalog-expansion-selection-policy-v1",
    rule: "category_floor_target = 3 adopted distinct products per catalog category",
    original_purpose: "catalog expansion selection pressure, not calibration readiness",
  },
  disposition: "REFINED",
  authoritative_structural_gate: {
    representative_unit: "distinct catalog product_id",
    minimum_eligible_product_rule: "at least 3 calibration-cohort-eligible distinct products per axis",
    signal_family_coverage_rule: "every CALIBRATION_REQUIRED signal family must be satisfied by each eligible product; SIGNAL_OPTIONAL and context-only inputs never substitute",
    category_rule: "every mapper-distinct category topology group declared by the axis contract must contain at least 1 calibration-cohort-eligible product",
    partial_coverage_rule: "partial/context-only products are recorded but never count toward the minimum eligible-product floor",
    authority_distribution_rule: "every CALIBRATION_REQUIRED Product Fact used for cohort admission must be semantic_status=supported and authority_ceiling=product_specific_primary",
    identity_block_rule: "unresolved Product Fact Subject identity is ineligible",
    source_block_rule: "source-blocked or absent Current remains missing and is ineligible",
    registry_gap_rule: "an axis with no governed compatible signal family cannot become cohort-ready through product-count coverage",
  },
  structural_only: true,
  statistical_power_claimed: false,
  rationale: "V2.1-8F's count of 3 is retained only as a smoke/structural floor, but 'adopted' is replaced by 'calibration-cohort eligible' and mapper-topology coverage is added. This prevents raw adoption from masquerading as usable axis input and makes no statistical-power or efficacy-validity claim.",
});

const BASE_ELIGIBILITY = Object.freeze({
  semantic_status_allowlist: ["supported"],
  authority_floor_or_rule: "CALIBRATION_REQUIRED facts must have authority_ceiling=product_specific_primary; mapper output authority never exceeds weakest consumed Product Fact authority",
  identity_rule: "resolved Product Fact Subject with canonical Current only",
  scope_rule: "Fact domain/category scope must match the product and mutually required scoped facts must be compatible. The V2.1-8I snapshot is a product-level Current projection, so its replay proves structural coexistence only and does not claim market-specific numeric calibration.",
  explicit_negative_handling: "supported boolean false is usable only when it is an explicit negative under the Registry Fact contract; it remains a directional fact, not a favorable magnitude",
  missing_handling: "missing_current, not_reviewed, reviewed_not_established, evidence_insufficient, evidence_conflict, source_blocked, and registry_gap never coerce to false or zero",
});

export const AXES = Object.freeze([
  {
    axis_key: "cleansing_burden", mapper_family: "cleanser", mapper_version: "product-decision-axis-cleanser-v1", applicable_categories: ["cleanser"], mapper_input_universe: ["deep_cleansing","low_ph"],
    signal_contract: { SIGNAL_REQUIRED: ["deep_cleansing"], SIGNAL_OPTIONAL: [], CONTEXT_ONLY: [], NOT_CONSUMED: ["low_ph"] },
    calibration_eligibility_contract: { ...BASE_ELIGIBILITY, CALIBRATION_REQUIRED: ["deep_cleansing"], CALIBRATION_OPTIONAL: [], NON_CALIBRATING_CONTEXT: [], required_signal_state: "supported explicit deep_cleansing=true or explicit deep_cleansing=false", optional_signal_state: "none", numeric_anchor_available: false },
    cohort_readiness_contract: { ...REPRESENTATIVE_COVERAGE_POLICY.authoritative_structural_gate, category_topology_groups: [{topology_key:"cleanser",categories:["cleanser"]}] },
    null_contract: "missing/non-supported deep_cleansing remains null; claim absence is not false",
    semantic_status_contract: "only supported enters calibration cohort; all unknown/insufficient/conflict states fail closed",
    authority_contract: "deep_cleansing claim/measurement authority is preserved; claim does not become measured cleansing burden magnitude",
    multi_value_contract: "deep_cleansing is scalar/cardinality-one; duplicate scalar Current fails closed in resolver authority",
    numeric_calibration: false, production_consumed: false,
    reason_codes: ["DEEP_CLEANSING_DIRECTIONAL_SIGNAL_NOT_BURDEN_MAGNITUDE","STRUCTURAL_ONLY_NO_STATISTICAL_POWER"],
  },
  {
    axis_key: "hydration_preservation", mapper_family: "cleanser", mapper_version: "product-decision-axis-cleanser-v1", applicable_categories: ["cleanser"], mapper_input_universe: ["deep_cleansing","low_ph"],
    signal_contract: { SIGNAL_REQUIRED: ["low_ph"], SIGNAL_OPTIONAL: [], CONTEXT_ONLY: [], NOT_CONSUMED: ["deep_cleansing"] },
    calibration_eligibility_contract: { ...BASE_ELIGIBILITY, CALIBRATION_REQUIRED: ["low_ph"], CALIBRATION_OPTIONAL: [], NON_CALIBRATING_CONTEXT: [], required_signal_state: "supported explicit low_ph=true or explicit low_ph=false", optional_signal_state: "none", numeric_anchor_available: false },
    cohort_readiness_contract: { ...REPRESENTATIVE_COVERAGE_POLICY.authoritative_structural_gate, category_topology_groups: [{topology_key:"cleanser",categories:["cleanser"]}] },
    null_contract: "missing/non-supported low_ph remains null; low_ph absence is not false",
    semantic_status_contract: "only supported enters calibration cohort; all unknown/insufficient/conflict states fail closed",
    authority_contract: "low_ph authority is preserved; low_ph is indirect relevance and never hydration-preservation magnitude",
    multi_value_contract: "low_ph is scalar/cardinality-one; duplicate scalar Current fails closed in resolver authority",
    numeric_calibration: false, production_consumed: false,
    reason_codes: ["LOW_PH_INDIRECT_SIGNAL_NOT_HYDRATION_MAGNITUDE","STRUCTURAL_ONLY_NO_STATISTICAL_POWER"],
  },
  {
    axis_key: "irritation_burden", mapper_family: "cleanser", mapper_version: "product-decision-axis-cleanser-v1", applicable_categories: ["cleanser"], mapper_input_universe: ["deep_cleansing","low_ph","eye_sting_observed","fragrance_declared"],
    signal_contract: { SIGNAL_REQUIRED: [], SIGNAL_OPTIONAL: [], CONTEXT_ONLY: [], NOT_CONSUMED: ["deep_cleansing","low_ph","eye_sting_observed","fragrance_declared"] },
    calibration_eligibility_contract: { ...BASE_ELIGIBILITY, CALIBRATION_REQUIRED: [], CALIBRATION_OPTIONAL: [], NON_CALIBRATING_CONTEXT: [], required_signal_state: "no governed cleanser-compatible irritation signal family exists in the current Registry/mapper contract; no product is calibration-cohort eligible", optional_signal_state: "none", numeric_anchor_available: false },
    cohort_readiness_contract: { ...REPRESENTATIVE_COVERAGE_POLICY.authoritative_structural_gate, category_topology_groups: [{topology_key:"cleanser",categories:["cleanser"]}], registry_gap_rule: "hard block: compatible governed irritation signal family is absent" },
    null_contract: "mapper remains no_relevant_fact with estimate=null and authority=none",
    semantic_status_contract: "no current Fact semantic status can substitute for the absent compatible irritation signal contract",
    authority_contract: "authority remains none until a compatible governed cleanser irritation signal is explicitly authorized",
    multi_value_contract: "not applicable until a governed compatible irritation signal family exists",
    numeric_calibration: false, production_consumed: false,
    reason_codes: ["EYE_STING_OBSERVED_SUNSCREEN_SCOPE_NOT_GENERAL_CLEANSER_IRRITATION","IRRITATION_SIGNAL_FAMILY_EXTENSION_REQUIRED","STRUCTURAL_ONLY_NO_STATISTICAL_POWER"],
  },
  {
    axis_key: "sebum_pore_control", mapper_family: "cleanser", mapper_version: "product-decision-axis-cleanser-v1", applicable_categories: ["cleanser"], mapper_input_universe: ["deep_cleansing","low_ph"],
    signal_contract: { SIGNAL_REQUIRED: ["deep_cleansing"], SIGNAL_OPTIONAL: [], CONTEXT_ONLY: [], NOT_CONSUMED: ["low_ph"] },
    calibration_eligibility_contract: { ...BASE_ELIGIBILITY, CALIBRATION_REQUIRED: ["deep_cleansing"], CALIBRATION_OPTIONAL: [], NON_CALIBRATING_CONTEXT: [], required_signal_state: "supported explicit deep_cleansing=true or explicit deep_cleansing=false", optional_signal_state: "none", numeric_anchor_available: false },
    cohort_readiness_contract: { ...REPRESENTATIVE_COVERAGE_POLICY.authoritative_structural_gate, category_topology_groups: [{topology_key:"cleanser",categories:["cleanser"]}] },
    null_contract: "missing/non-supported deep_cleansing remains null; claim absence is not false",
    semantic_status_contract: "only supported enters calibration cohort; all unknown/insufficient/conflict states fail closed",
    authority_contract: "deep_cleansing authority is preserved; deep-cleansing claim does not become measured sebum/pore outcome",
    multi_value_contract: "deep_cleansing is scalar/cardinality-one; duplicate scalar Current fails closed in resolver authority",
    numeric_calibration: false, production_consumed: false,
    reason_codes: ["DEEP_CLEANSING_DIRECTIONAL_SIGNAL_NOT_SEBUM_PORE_MAGNITUDE","STRUCTURAL_ONLY_NO_STATISTICAL_POWER"],
  },
  {
    axis_key: "photo_protection", mapper_family: "cross_category", mapper_version: "product-decision-axis-cross-category-v1", applicable_categories: ["sunscreen"], mapper_input_universe: ["spf_value","uva_label","uv_filter_type","water_resistance_duration"],
    signal_contract: { SIGNAL_REQUIRED: [], SIGNAL_OPTIONAL: ["spf_value","uva_label","uv_filter_type","water_resistance_duration"], CONTEXT_ONLY: [], NOT_CONSUMED: [] },
    calibration_eligibility_contract: { ...BASE_ELIGIBILITY, CALIBRATION_REQUIRED: ["spf_value","uva_label"], CALIBRATION_OPTIONAL: ["uv_filter_type","water_resistance_duration"], NON_CALIBRATING_CONTEXT: ["uv_filter_type","water_resistance_duration"], required_signal_state: "supported SPF label and supported UVA label coexist for the resolved sunscreen Subject under compatible scope", optional_signal_state: "filter-system class and water-resistance duration may add protection context but never substitute for SPF+UVA core coverage", numeric_anchor_available: false },
    cohort_readiness_contract: { ...REPRESENTATIVE_COVERAGE_POLICY.authoritative_structural_gate, category_topology_groups: [{topology_key:"sunscreen",categories:["sunscreen"]}], signal_family_coverage_rule: "each eligible product must contain both core label families: spf_value and uva_label" },
    null_contract: "no protection Current stays missing; SPF-only or UVA-only remains partial and does not imply the missing dimension",
    semantic_status_contract: "only supported core labels enter calibration cohort; unknown/insufficient/conflict states fail closed",
    authority_contract: "weakest core Product Fact authority is preserved; labels are not converted into arbitrary effect scores",
    multi_value_contract: "scope/proposition lineage remains preserved; no cross-market arbitrary label pairing",
    numeric_calibration: false, production_consumed: false,
    reason_codes: ["SPF_AND_UVA_CORE_STRUCTURAL_PAIR","FILTER_TYPE_CONTEXT_DOES_NOT_REPLACE_LABEL_CORE","WATER_RESISTANCE_CONTEXT_DOES_NOT_REPLACE_BASE_UV_CORE","LABELS_NOT_ARBITRARY_NORMALIZED_SCORE"],
  },
  {
    axis_key: "barrier_support", mapper_family: "cross_category", mapper_version: "product-decision-axis-cross-category-v1", applicable_categories: ["moisturizer_balm","moisturizer_cream","moisturizer_gel","moisturizer_lotion_emulsion"], mapper_input_universe: ["barrier_support_claim","primary_use_role","contains_active","active_concentration"],
    signal_contract: { SIGNAL_REQUIRED: ["barrier_support_claim"], SIGNAL_OPTIONAL: [], CONTEXT_ONLY: ["primary_use_role"], NOT_CONSUMED: ["contains_active","active_concentration"] },
    calibration_eligibility_contract: { ...BASE_ELIGIBILITY, CALIBRATION_REQUIRED: ["barrier_support_claim"], CALIBRATION_OPTIONAL: [], NON_CALIBRATING_CONTEXT: ["primary_use_role"], required_signal_state: "supported explicit barrier_support_claim=true or explicit barrier_support_claim=false", optional_signal_state: "primary_use_role may accompany the signal as context only", numeric_anchor_available: false, claim_only_policy: "claim-only products may enter bounded structural/offline calibration cohort; claim-only never establishes numeric barrier-effect magnitude", future_numeric_anchor_note: "measurement-shaped tewl_change and/or hydration_change could support a future numeric-method contract only after an explicit mapper/calibration extension; they are not consumed here" },
    cohort_readiness_contract: { ...REPRESENTATIVE_COVERAGE_POLICY.authoritative_structural_gate, category_topology_groups: [{ topology_key:"shared_moisturizer_barrier_claim_topology", categories:["moisturizer_balm","moisturizer_cream","moisturizer_gel","moisturizer_lotion_emulsion"] }], category_rule: "all four current moisturizer subcategories share the same v1 barrier-claim signal topology; v1 therefore requires the 3-product eligible floor across the shared topology, not 3 per subcategory" },
    null_contract: "missing barrier_support_claim remains missing; primary_use_role never substitutes for efficacy claim",
    semantic_status_contract: "only supported barrier_support_claim enters calibration cohort",
    authority_contract: "claim authority is preserved; Product Fact claim authority never becomes measured effect authority",
    multi_value_contract: "barrier_support_claim is scalar; ingredient identities and concentrations remain separate facts and are not folded into the claim",
    numeric_calibration: false, production_consumed: false,
    reason_codes: ["BARRIER_CLAIM_SIGNAL_NOT_MEASURED_EFFECT","USAGE_ROLE_CONTEXT_ONLY","INGREDIENT_IDENTITY_NOT_BARRIER_EFFICACY"],
  },
  {
    axis_key: "exfoliation_load", mapper_family: "cross_category", mapper_version: "product-decision-axis-cross-category-v1", applicable_categories: ["treatment","toner_pad","toner_essence"], mapper_input_universe: ["contains_active","active_concentration","recommended_use_frequency","product_format","wipe_off_use","pad_surface_texture"],
    signal_contract: { SIGNAL_REQUIRED: [{fact_key:"contains_active", value_set:EXFOLIATING_V1, value_set_version:"exfoliating-active-identity-set-v1"}], SIGNAL_OPTIONAL: [], CONTEXT_ONLY: ["active_concentration","recommended_use_frequency","product_format","wipe_off_use","pad_surface_texture"], NOT_CONSUMED: ["contains_active values outside exfoliating-active-identity-set-v1 as exfoliation signal; values remain preserved in Product Fact lineage"] },
    calibration_eligibility_contract: { ...BASE_ELIGIBILITY, CALIBRATION_REQUIRED: [{fact_key:"contains_active", value_set:EXFOLIATING_V1, value_set_version:"exfoliating-active-identity-set-v1"}], CALIBRATION_OPTIONAL: [], NON_CALIBRATING_CONTEXT: ["active_concentration","recommended_use_frequency","product_format","wipe_off_use","pad_surface_texture"], required_signal_state: "at least one supported contains_active proposition whose identity is in exfoliating-active-identity-set-v1", optional_signal_state: "all context is retained when present but none is required for structural cohort admission", numeric_anchor_available: false, active_identity_set_is_exhaustive_forever: false, active_identity_set_scope: "v1 only; extension requires a versioned contract decision" },
    cohort_readiness_contract: { ...REPRESENTATIVE_COVERAGE_POLICY.authoritative_structural_gate, category_topology_groups: [{topology_key:"treatment",categories:["treatment"]},{topology_key:"toner_essence",categories:["toner_essence"]},{topology_key:"toner_pad",categories:["toner_pad"]}], category_rule: "because the v1 context surface differs across treatment, toner_essence, and toner_pad, structural readiness requires at least one eligible product from each of those three topology groups" },
    null_contract: "no relevant supported active identity remains no_relevant_fact/missing; missing concentration is never zero",
    semantic_status_contract: "only supported relevant active identity admits cohort entry; context cannot rescue missing signal",
    authority_contract: "weakest relevant active Product Fact authority is preserved; concentration/use/format context cannot raise efficacy authority",
    multi_value_contract: "preserve all contains_active propositions and proposition lineage; select every relevant v1 identity, never arbitrary first; dedupe contribution only by governed signal-family lineage; active_concentration may attach only to its matching parent contains_active lineage",
    numeric_calibration: false, production_consumed: false,
    reason_codes: ["ACTIVE_IDENTITY_SIGNAL_NOT_EXFOLIATION_INTENSITY","MULTI_ACTIVE_PRESERVED","CONCENTRATION_PARENT_LINEAGE_REQUIRED","USE_AND_FORMAT_CONTEXT_NOT_EFFICACY"],
  },
]);

function factsFor(product, key) { return (product.facts || []).filter((f) => f.fact_key === key); }
function supportedPrimary(product, key) { return factsFor(product, key).filter((f) => f.semantic_status === "supported" && f.authority_ceiling === "product_specific_primary"); }
function anySupported(product, key) { return factsFor(product, key).filter((f) => f.semantic_status === "supported"); }
function categoryTotal(snapshot, categories) { return snapshot.category_coverage.filter((r) => categories.includes(r.category)).reduce((sum, r) => sum + r.total_distinct_products, 0); }
function categoryAdopted(snapshot, categories) { return snapshot.category_coverage.filter((r) => categories.includes(r.category)).reduce((sum, r) => sum + r.adopted_distinct_products, 0); }
function relevantExfoliating(product) { const set = new Set(EXFOLIATING_V1); return anySupported(product, "contains_active").filter((f) => set.has(f.value)); }

function classifyProduct(product, axis) {
  let signal = false, eligible = false, partial = false, blocker = null, signalFacts = [];
  const contextFacts = [];
  if (axis.axis_key === "irritation_burden") return {signal,eligible,partial,blocker:"REGISTRY_OR_MAPPER_EXTENSION_REQUIRED",signal_facts:[],context_facts:[]};
  if (axis.axis_key === "cleansing_burden" || axis.axis_key === "sebum_pore_control") {
    signalFacts = anySupported(product, "deep_cleansing"); signal = signalFacts.length > 0; eligible = supportedPrimary(product, "deep_cleansing").length > 0;
    blocker = eligible ? null : signal ? "AUTHORITY_QUALITY_COVERAGE_REQUIRED" : "CALIBRATION_REQUIRED_SIGNAL_MISSING";
  } else if (axis.axis_key === "hydration_preservation") {
    signalFacts = anySupported(product, "low_ph"); signal = signalFacts.length > 0; eligible = supportedPrimary(product, "low_ph").length > 0;
    blocker = eligible ? null : signal ? "AUTHORITY_QUALITY_COVERAGE_REQUIRED" : "CALIBRATION_REQUIRED_SIGNAL_MISSING";
  } else if (axis.axis_key === "photo_protection") {
    const optionalKeys = ["spf_value","uva_label","uv_filter_type","water_resistance_duration"];
    signalFacts = optionalKeys.flatMap((k) => anySupported(product,k)); signal = signalFacts.length > 0;
    eligible = supportedPrimary(product,"spf_value").length > 0 && supportedPrimary(product,"uva_label").length > 0;
    partial = signal && !eligible; blocker = eligible ? null : signal ? "CORE_SPF_UVA_PAIR_INCOMPLETE" : "NO_PHOTO_PROTECTION_SIGNAL";
  } else if (axis.axis_key === "barrier_support") {
    signalFacts = anySupported(product,"barrier_support_claim"); contextFacts.push(...anySupported(product,"primary_use_role")); signal = signalFacts.length > 0;
    eligible = supportedPrimary(product,"barrier_support_claim").length > 0; partial = !eligible && contextFacts.length > 0;
    blocker = eligible ? null : signal ? "AUTHORITY_QUALITY_COVERAGE_REQUIRED" : "BARRIER_SUPPORT_CLAIM_MISSING";
  } else if (axis.axis_key === "exfoliation_load") {
    signalFacts = relevantExfoliating(product);
    const contextKeys = ["active_concentration","recommended_use_frequency","product_format","wipe_off_use","pad_surface_texture"];
    contextFacts.push(...contextKeys.flatMap((k) => anySupported(product,k)));
    const allActives = anySupported(product,"contains_active"); signal = signalFacts.length > 0;
    eligible = signalFacts.some((f) => f.authority_ceiling === "product_specific_primary"); partial = !eligible && (allActives.length > 0 || contextFacts.length > 0);
    blocker = eligible ? null : signal ? "AUTHORITY_QUALITY_COVERAGE_REQUIRED" : "RELEVANT_EXFOLIATING_ACTIVE_MISSING";
  }
  return {
    signal, eligible, partial, blocker,
    signal_facts: signalFacts.map((f)=>({fact_key:f.fact_key,value:f.value,semantic_status:f.semantic_status,authority_ceiling:f.authority_ceiling})),
    context_facts: contextFacts.map((f)=>({fact_key:f.fact_key,value:f.value,semantic_status:f.semantic_status,authority_ceiling:f.authority_ceiling})),
  };
}
function topologyCoverage(axis, eligibleRows) {
  return axis.cohort_readiness_contract.category_topology_groups.map((group) => ({ topology_key: group.topology_key, categories: group.categories, eligible_distinct_products: new Set(eligibleRows.filter((r)=>group.categories.includes(r.category)).map((r)=>r.product_id)).size, met: eligibleRows.some((r)=>group.categories.includes(r.category)) }));
}

export function buildReplay(snapshot) {
  const axes = [], ledger = [];
  for (const axis of AXES) {
    const adoptedRows = snapshot.adopted_products.filter((p)=>axis.applicable_categories.includes(p.category));
    const productRows = adoptedRows.map((product) => {
      const result = classifyProduct(product, axis);
      const row = { axis_key: axis.axis_key, product_id: product.product_id, brand: product.brand, name: product.name, category: product.category, subject_id: product.subject_id, mapper_signal_eligible: result.signal, calibration_cohort_eligible: result.eligible, partial_structural_coverage: result.partial, blocker: result.blocker, signal_facts: result.signal_facts, context_facts: result.context_facts };
      ledger.push(row); return row;
    });
    const eligibleRows = productRows.filter((r)=>r.calibration_cohort_eligible), signalRows = productRows.filter((r)=>r.mapper_signal_eligible), partialRows = productRows.filter((r)=>r.partial_structural_coverage);
    const topology = topologyCoverage(axis, eligibleRows), floorMet = eligibleRows.length >= 3, topologyMet = topology.every((g)=>g.met);
    const authorityProblems = productRows.filter((r)=>r.blocker==="AUTHORITY_QUALITY_COVERAGE_REQUIRED").length;
    let primary, primaryBlocker;
    if (axis.axis_key === "irritation_burden") { primary = "REGISTRY_OR_MAPPER_EXTENSION_REQUIRED"; primaryBlocker = "NO_GOVERNED_CLEANSER_COMPATIBLE_IRRITATION_SIGNAL_FAMILY"; }
    else if (floorMet && topologyMet) { primary = "STRUCTURALLY_READY_FOR_BOUNDED_OFFLINE_CALIBRATION"; primaryBlocker = null; }
    else if (authorityProblems > 0 && signalRows.length >= 3) { primary = "AUTHORITY_QUALITY_COVERAGE_REQUIRED"; primaryBlocker = "INSUFFICIENT_PRIMARY_AUTHORITY_ELIGIBLE_SIGNAL_COVERAGE"; }
    else { primary = "TARGETED_PRODUCT_FACT_COVERAGE_REQUIRED"; const need = Math.max(0, 3 - eligibleRows.length); primaryBlocker = !floorMet ? `STRUCTURAL_ELIGIBLE_PRODUCT_FLOOR_GAP_${need}` : "MAPPER_TOPOLOGY_CATEGORY_COVERAGE_GAP"; }
    const catalogTotal = categoryTotal(snapshot, axis.applicable_categories);
    axes.push({
      axis_key: axis.axis_key, applicable_catalog_distinct_products: catalogTotal, adopted_distinct_products: categoryAdopted(snapshot, axis.applicable_categories), mapper_signal_eligible_distinct_products: signalRows.length, calibration_cohort_eligible_distinct_products: eligibleRows.length, partial_structural_coverage_distinct_products: partialRows.length, ineligible_distinct_products: catalogTotal - eligibleRows.length, adopted_ineligible_distinct_products: productRows.length - eligibleRows.length, unadopted_distinct_products: catalogTotal - productRows.length,
      blocker_distribution: Object.fromEntries(Object.entries(productRows.filter((r)=>r.blocker).reduce((m,r)=>{m[r.blocker]=(m[r.blocker]||0)+1;return m;},{})).sort()),
      category_topology_coverage: topology, structural_floor_met: floorMet, mapper_topology_coverage_met: topologyMet, post_contract_readiness: primary, primary_blocker: primaryBlocker, secondary_states: ["NO_NUMERIC_ANCHOR_AVAILABLE"], numeric_anchor_available: false,
    });
  }
  axes.sort((a,b)=>a.axis_key.localeCompare(b.axis_key));
  ledger.sort((a,b)=>a.axis_key.localeCompare(b.axis_key)||a.category.localeCompare(b.category)||a.product_id.localeCompare(b.product_id));
  return {
    version:"product-decision-axis-contract-replay-v1", stage:STAGE,
    authority:{ source_snapshot:SNAPSHOT_PATH, source_snapshot_sha256:AUTHORITY.v21_8i_snapshot_sha256, source_audit_sha256:AUTHORITY.v21_8i_audit_sha256, execution_main_sha:AUTHORITY.execution_main_sha },
    representative_coverage_policy_version:VERSION,
    replay_boundary:{ corpus:"exact V2.1-8I frozen product-level Current snapshot", live_hosted_reclassification:false, scope_projection_note:"8I snapshot omits market/variant fields; replay proves structural coexistence/category compatibility only. Contract still requires compatible scope at future cohort assembly." },
    axes, product_axis_ledger:ledger,
    summary:{ axes:axes.length, structurally_ready_axes:axes.filter((a)=>a.post_contract_readiness==="STRUCTURALLY_READY_FOR_BOUNDED_OFFLINE_CALIBRATION").map((a)=>a.axis_key), targeted_coverage_axes:axes.filter((a)=>a.post_contract_readiness==="TARGETED_PRODUCT_FACT_COVERAGE_REQUIRED").map((a)=>a.axis_key), registry_or_mapper_extension_axes:axes.filter((a)=>a.post_contract_readiness==="REGISTRY_OR_MAPPER_EXTENSION_REQUIRED").map((a)=>a.axis_key), authority_quality_axes:axes.filter((a)=>a.post_contract_readiness==="AUTHORITY_QUALITY_COVERAGE_REQUIRED").map((a)=>a.axis_key), numeric_anchor_available_axes:[], all_estimates_remain_null:true },
  };
}

export function buildContract(snapshot, replay) {
  const base = {
    version:VERSION, stage:STAGE, authority:AUTHORITY,
    architecture_invariants:["Product != Product Fact Subject","Evidence != Fact","Fact Instance != Current","Product Fact != Product Decision Axis","Product Decision Axis != User Concern axis","missing/reviewed_not_established/evidence_insufficient/not_reviewed/conflict/source_blocked/registry_gap != false","official claim or ingredient identity != proven effect magnitude","coverage pressure never lowers evidence authority","mapper authority never exceeds Product Fact authority","Product Fact Current != numeric calibration","shadow computation != production consumption != Recommendation activation"],
    contract_vocabulary:CONTRACT_VOCABULARY, representative_coverage_policy:REPRESENTATIVE_COVERAGE_POLICY, axes:AXES,
    irritation_contract_decision:{ decision:"KEEP_NOT_CONSUMED_REQUIRE_GOVERNED_CLEANSER_IRRITATION_SIGNAL_EXTENSION", eye_sting_observed_role:"NOT_CONSUMED for cleanser irritation_burden v1", registry_observation:{ fact_key:"eye_sting_observed", value_type:"boolean", cardinality:"one", domain_scope:["sunscreen"], evidence_class:["observation"], semantic_definition:"Observed eye-sting occurrence without implying prevalence when denominator is unavailable.", negative_evidence_requirement:"explicit_negative_only" }, rationale:"Registry scope is sunscreen and semantic meaning is narrow observed eye sting, so it cannot be silently generalized to cleanser irritation burden.", remaining_limitation:"current Registry/mapper authority has no cleanser-compatible governed irritation observation/measurement signal family" },
    photo_protection_contract_decision:{ core_input_set:["spf_value","uva_label"], partial_input_set:["spf_value only","uva_label only","uv_filter_type without full core","water_resistance_duration without full core"], context_only_for_calibration_core:["uv_filter_type","water_resistance_duration"], calibration_eligibility:"supported product-specific-primary SPF + UVA pair under compatible scope", full_structural_coverage:"SPF + UVA core pair", partial_structural_coverage:"any supported photo-protection signal without complete core pair", rationale:"SPF and UVA labels represent separate base UV-protection dimensions; filter class and water resistance add context but do not replace either label dimension. No label is normalized into a generic score." },
    null_semantics:{ missing_current:"UNKNOWN_NOT_FALSE", not_reviewed:"UNKNOWN_NOT_FALSE", reviewed_not_established:"UNKNOWN_NOT_FALSE", evidence_insufficient:"UNKNOWN_NOT_FALSE", evidence_conflict:"BLOCKED_NOT_FALSE", supported_true:"EXPLICIT_POSITIVE_FACT_WITHIN_FACT_SEMANTICS", supported_false:"EXPLICIT_NEGATIVE_ONLY_WHEN_REGISTRY_CONTRACT_PERMITS", identity_blocked:"BLOCKED", source_blocked:"UNKNOWN_NOT_FALSE", registry_gap:"BLOCKED_CONTRACT_GAP_NOT_FALSE" },
    multi_value_semantics:{ preserve_all_relevant_values:true, preserve_proposition_lineage:true, arbitrary_first_selection:false, dedupe_by_product_only:false, signal_family_dedupe:"only by governed lineage/family rule", parent_child_concentration_lineage:"required; active_concentration cannot attach to arbitrary contains_active proposition" },
    authority_semantics:{ calibration_required_semantic_status:["supported"], calibration_required_authority:"product_specific_primary", mapper_authority_rule:"never above weakest consumed Product Fact authority", claim_only:"signal may be structurally eligible where axis contract says so; never numeric effect proof", review_observation:"usable only within Registry domain/semantic scope", ingredient_basis:"identity signal only unless a versioned mapper contract explicitly says otherwise" },
    deferred_numeric_calibration_policy:{ numeric_calibration:false, estimate_must_remain_null:true, weights_selected:false, priors_selected:false, numeric_uncertainty_selected:false, statistical_power_claimed:false, production_consumption:false, recommendation_activation:false },
    invariants:{ hosted_product_fact_writes_v21_8j:0, external_product_evidence_research_v21_8j:0, registry_definition_delta_v21_8j:0, migration_delta_v21_8j:0, pda_numeric_calibration_v21_8j:0, pda_production_consumption_v21_8j:0, recommendation_behavior_delta_v21_8j:0 },
    replay_result:replay.summary,
    next_stage_recommendation:{ stage:"Product Decision Axis Offline/Shadow Calibration Wave 1", axis:"exfoliation_load", reason:"exfoliation_load is the only axis structurally ready under the refined v1 gate: 3 eligible distinct products span treatment, toner_essence, and toner_pad; numeric anchor remains unavailable and must not be fabricated", execute_now:false },
  };
  const digest = sha256Json(base);
  return {...base, contract_digest:digest, contract_digest_semantics:"SHA256 of canonical contract object excluding contract_digest fields"};
}

function mdList(values) { return (values || []).map((x)=>typeof x==="string" ? `\`${x}\`` : `\`${x.fact_key}{${(x.value_set||[]).join("|")}}\``).join(", ") || "—"; }
function renderDoc(contract,replay) {
  const lines = ["# Product Decision Axis Mapper Contract v1","","> V2.1-8J authoritative contract completion. Structural/offline eligibility only; no numeric calibration or production Recommendation consumption.","","## FACT — Authority",""];
  lines.push(`- execution main: \`${contract.authority.execution_main_sha}\``,`- Hosted: \`${contract.authority.hosted_project}\` (read-only)`,`- Registry: \`${contract.authority.registry_version}\` / \`${contract.authority.registry_checksum}\``,`- V2.1-8I audit SHA256: \`${contract.authority.v21_8i_audit_sha256}\``,`- V2.1-8I snapshot SHA256: \`${contract.authority.v21_8i_snapshot_sha256}\``,"");
  lines.push("## EXISTING CONTRACT — Pipeline invariants",""); for (const x of contract.architecture_invariants) lines.push(`- ${x}`);
  lines.push("","## NEW 8J CONTRACT DECISION — Vocabulary",""); for (const [k,v] of Object.entries(contract.contract_vocabulary)) lines.push(`- **${k}**: ${v}`);
  lines.push("","## NEW 8J CONTRACT DECISION — Representative coverage","",`- prior proposal: \`${contract.representative_coverage_policy.prior_proposal.version}\`, category adopted floor = 3`,`- disposition: **${contract.representative_coverage_policy.disposition}**`,`- authoritative structural floor: >= 3 calibration-cohort-eligible distinct products per axis`,`- topology rule: every declared mapper-distinct category topology group has >= 1 eligible product`,`- partial/context-only rows do not count toward the floor`,`- statistical power claimed: **NO**`,`- rationale: ${contract.representative_coverage_policy.rationale}`,"");
  lines.push("## NEW 8J CONTRACT DECISION — Seven axes","","| axis | SIGNAL_REQUIRED | SIGNAL_OPTIONAL | CONTEXT_ONLY | CALIBRATION_REQUIRED | topology groups | numeric | production |","|---|---|---|---|---|---|---|---|");
  for (const a of contract.axes) lines.push(`| ${a.axis_key} | ${mdList(a.signal_contract.SIGNAL_REQUIRED)} | ${mdList(a.signal_contract.SIGNAL_OPTIONAL)} | ${mdList(a.signal_contract.CONTEXT_ONLY)} | ${mdList(a.calibration_eligibility_contract.CALIBRATION_REQUIRED)} | ${a.cohort_readiness_contract.category_topology_groups.map(g=>g.topology_key).join(", ")} | NO | NO |`);
  lines.push("","## NEW 8J CONTRACT DECISION — irritation_burden","",`- decision: \`${contract.irritation_contract_decision.decision}\``,`- \`eye_sting_observed\`: **NOT_CONSUMED** for cleanser \`irritation_burden\` v1`,`- rationale: ${contract.irritation_contract_decision.rationale}`,`- remaining limitation: ${contract.irritation_contract_decision.remaining_limitation}`,"","## NEW 8J CONTRACT DECISION — photo_protection","","- core structural pair: `spf_value` + `uva_label`","- `uv_filter_type` and `water_resistance_duration`: mapper signal/context, but not substitutes for the core calibration pair","- SPF-only or UVA-only: partial structural coverage, not cohort-eligible","- no SPF/PA normalization or arbitrary generic score","");
  lines.push("## FACT — V2.1-8I snapshot replay under 8J","","| axis | catalog | adopted | signal eligible | cohort eligible | partial | blocked | readiness |","|---|---:|---:|---:|---:|---:|---:|---|");
  for (const a of replay.axes) lines.push(`| ${a.axis_key} | ${a.applicable_catalog_distinct_products} | ${a.adopted_distinct_products} | ${a.mapper_signal_eligible_distinct_products} | ${a.calibration_cohort_eligible_distinct_products} | ${a.partial_structural_coverage_distinct_products} | ${a.ineligible_distinct_products} | ${a.post_contract_readiness} |`);
  lines.push("",`Structurally ready axes: ${replay.summary.structurally_ready_axes.map(x=>`\`${x}\``).join(", ") || "none"}.`,`All axes retain \`NO_NUMERIC_ANCHOR_AVAILABLE\` as a separate secondary state; structural readiness is not numeric/clinical validity.`,"","## DEFERRED CALIBRATION POLICY","","- numeric estimates remain `null`","- no weights, priors, scale, or numeric uncertainty are selected","- no statistical-power claim is made","- production Decision Axis consumption remains disabled","- Recommendation activation remains disabled","","## ROADMAP RECOMMENDATION — Exactly one, not executed","","**Product Decision Axis Offline/Shadow Calibration Wave 1 — `exfoliation_load` only**","","Reason: it is the sole axis that satisfies the v1 structural floor and all three mapper-distinct category topology groups in the frozen 8I corpus. The next stage must not fabricate a numeric anchor or activate production consumption.","");
  return lines.join("\n");
}

export function buildAll(snapshot) { const replay = buildReplay(snapshot); const contract = buildContract(snapshot,replay); return {contract,replay,doc:renderDoc(contract,replay)}; }
function write(root, rel, text) { const target = path.join(root,rel); fs.mkdirSync(path.dirname(target),{recursive:true}); fs.writeFileSync(target,text); }
export function main() {
  const root = process.env.V21_8J_OUTPUT_ROOT || ".";
  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH,"utf8"));
  const {contract,replay,doc} = buildAll(snapshot), contractText = canonicalJson(contract), replayText = canonicalJson(replay);
  write(root,CONTRACT_PATH,contractText); write(root,REPLAY_PATH,replayText); write(root,DOC_PATH,doc);
  console.log(JSON.stringify({version:VERSION,status:"built",contract_sha256:sha256Text(contractText),replay_sha256:sha256Text(replayText),docs_sha256:sha256Text(doc),structurally_ready_axes:replay.summary.structurally_ready_axes}));
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) main();
