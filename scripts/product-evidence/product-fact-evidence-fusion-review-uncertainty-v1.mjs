import crypto from "node:crypto";

export const VERSION = "product-fact-evidence-fusion-review-uncertainty-v1";
export const ARCHITECTURE_VERSION = "product-evidence-decision-axis-v1";
export const FUSION_POLICY_VERSION = "product-fact-evidence-fusion-v1";
export const REVIEW_MODEL_VERSION = "beta-binomial-poc-explicit-effective-n-v1";
export const CORPUS_VERSION = "cleanser-catalog-field-review-v1";
export const CORPUS_SHA256 = "9c2472cecc720e420467d2bef0808dc47cdbcff31dad118c2d28933ca7bbde9f";
export const BASE_MAIN_SHA = "a38df682ebc686cb076dfc40b432ae714fdfd6da";
export const HISTORICAL_POC_HEAD = "e371d5bc037fb80d1edd3876f0c7d1d94a2c1461";
export const HISTORICAL_POC_ARTIFACT_BLOB = "be3724b513a11a6521585950e79e21296550ecdc";

export const FACT_KEYS = Object.freeze(["low_ph", "deep_cleansing"]);
export const SEMANTIC_STATUSES = Object.freeze([
  "supported",
  "reviewed_not_established",
  "not_reviewed",
  "evidence_insufficient",
  "evidence_conflict",
]);
export const PF_AUTHORITIES = Object.freeze([
  "none",
  "legacy_unreviewed",
  "ingredient_basis",
  "review_observation",
  "limited_non_product_specific",
  "product_specific_primary",
]);
export const PF_CONFIDENCE = Object.freeze(["high", "medium", "low", "unknown"]);

const AUTHORITY_RANK = Object.freeze(Object.fromEntries(PF_AUTHORITIES.map((value, index) => [value, index])));
const SUPPORTED_VALUE_TO_FACT = Object.freeze({ low_ph: "low_ph", deep_clean: "deep_cleansing" });
const SOURCE_POLICY = Object.freeze({
  official_product_page: { authority: "product_specific_primary", evidence_class: "product_claim", fact_admissible: true },
  manufacturer_documentation: { authority: "product_specific_primary", evidence_class: "product_claim", fact_admissible: true },
  official_brand_site_listing: { authority: "limited_non_product_specific", evidence_class: "product_claim", fact_admissible: true },
  retailer_product_page: { authority: "limited_non_product_specific", evidence_class: "product_claim", fact_admissible: true },
  marketplace_product_page: { authority: "limited_non_product_specific", evidence_class: "product_claim", fact_admissible: true },
  price_comparison_product_page: { authority: "limited_non_product_specific", evidence_class: "product_claim", fact_admissible: true },
  ingredient_list: { authority: "ingredient_basis", evidence_class: "composition_identity", fact_admissible: false },
  review_corpus: { authority: "review_observation", evidence_class: "observation", fact_admissible: false },
  manual_conflict_record: { authority: "none", evidence_class: "manual_adjudication_context", fact_admissible: false },
});

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

export function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

export function canonicalJson(value) {
  return `${JSON.stringify(stable(value))}\n`;
}

export function sha256Json(value) {
  return crypto.createHash("sha256").update(JSON.stringify(stable(value)), "utf8").digest("hex");
}

function inferFact(evidence) {
  if (SUPPORTED_VALUE_TO_FACT[evidence.supported_value]) return SUPPORTED_VALUE_TO_FACT[evidence.supported_value];
  const summary = String(evidence.evidence_summary ?? "");
  if (/\bpH\b|low_ph|mildly acidic/i.test(summary)) return "low_ph";
  if (/deep[ -]?clean|pore[ -]?clean|sebum[ -]?clean/i.test(summary)) return "deep_cleansing";
  return null;
}

export function normalizeCleanserEvidence(product, evidence) {
  const policy = SOURCE_POLICY[evidence.source_class] ?? { authority: "none", evidence_class: "unknown", fact_admissible: false };
  const factKey = inferFact(evidence);
  const explicitSupport = Boolean(SUPPORTED_VALUE_TO_FACT[evidence.supported_value]);
  const manual = evidence.source_class === "manual_conflict_record";
  const supportDirection = manual ? "context_only" : explicitSupport ? "supports" : factKey ? "context_only" : "context_only";
  const admissibleForFact = Boolean(factKey && explicitSupport && policy.fact_admissible);

  return {
    catalog_evidence_id: evidence.catalog_evidence_id,
    source_reference: evidence.source_reference,
    source_class: evidence.source_class,
    source: evidence.source_reference,
    evidence_class: policy.evidence_class,
    evidence_authority: policy.authority,
    confidence: product.confidence === "high" || product.confidence === "medium" || product.confidence === "low" ? product.confidence : "unknown",
    supported_value: evidence.supported_value ?? null,
    fact_key: factKey,
    support_direction: supportDirection,
    negative_admissibility: supportDirection === "supports" ? "not_applicable" : "context_only",
    admissible_for_fact: admissibleForFact,
    evidence_summary: evidence.evidence_summary,
    accessed_at: evidence.accessed_at,
    reason_codes: manual
      ? ["manual_conflict_record_context_only"]
      : explicitSupport && !policy.fact_admissible
        ? ["source_class_not_permitted_for_cleanser_fact"]
        : explicitSupport
          ? ["registered_fact_supported_by_admissible_claim_evidence"]
          : factKey
            ? ["relevant_evidence_does_not_establish_fact"]
            : ["no_registered_fact_proposition"],
  };
}

function highestAuthority(evidence) {
  let best = "none";
  for (const item of evidence) {
    const authority = PF_AUTHORITIES.includes(item.evidence_authority) ? item.evidence_authority : "none";
    if (AUTHORITY_RANK[authority] > AUTHORITY_RANK[best]) best = authority;
  }
  return best;
}

function fusedConfidence(authority) {
  if (authority === "product_specific_primary") return "high";
  if (authority === "limited_non_product_specific") return "medium";
  if (authority === "review_observation" || authority === "ingredient_basis" || authority === "legacy_unreviewed") return "low";
  return "unknown";
}

function factResult({ factKey, value, semanticStatus, authorityCeiling, fusedConfidenceValue, supporting, opposing, context, reasonCodes }) {
  invariant(SEMANTIC_STATUSES.includes(semanticStatus), `invalid semantic status ${semanticStatus}`);
  invariant(PF_AUTHORITIES.includes(authorityCeiling), `invalid PF authority ${authorityCeiling}`);
  invariant(PF_CONFIDENCE.includes(fusedConfidenceValue), `invalid PF confidence ${fusedConfidenceValue}`);
  return {
    fact_key: factKey,
    value,
    semantic_status: semanticStatus,
    authority_ceiling: authorityCeiling,
    fused_confidence: fusedConfidenceValue,
    supporting_evidence: supporting.map((item) => item.catalog_evidence_id),
    opposing_evidence: opposing.map((item) => item.catalog_evidence_id),
    context_evidence: context.map((item) => item.catalog_evidence_id),
    fusion_policy_version: FUSION_POLICY_VERSION,
    fusion_input_digest: sha256Json({
      fact_key: factKey,
      supporting: supporting.map((item) => [item.catalog_evidence_id, item.evidence_authority, item.confidence]).sort(),
      opposing: opposing.map((item) => [item.catalog_evidence_id, item.evidence_authority, item.confidence, item.negative_admissibility]).sort(),
      context: context.map((item) => [item.catalog_evidence_id, item.evidence_authority, item.reason_codes]).sort(),
      semantic_status: semanticStatus,
      value,
    }),
    reason_codes: reasonCodes,
  };
}

export function fuseProductFact({ factKey, normalizedEvidence, reviewState = null }) {
  invariant(FACT_KEYS.includes(factKey), `unknown fact_key ${factKey}`);
  const relevant = normalizedEvidence.filter((item) => item.fact_key === factKey);
  const supporting = relevant.filter((item) => item.admissible_for_fact && item.support_direction === "supports");
  const opposing = relevant.filter((item) => item.admissible_for_fact && item.support_direction === "opposes" && ["explicit_negative", "conflict_opposition"].includes(item.negative_admissibility));
  const explicitNegative = opposing.filter((item) => item.negative_admissibility === "explicit_negative");
  const context = relevant.filter((item) => !supporting.includes(item) && !opposing.includes(item));

  if (supporting.length && opposing.length) {
    const authority = highestAuthority([...supporting, ...opposing]);
    return factResult({ factKey, value: null, semanticStatus: "evidence_conflict", authorityCeiling: authority, fusedConfidenceValue: "unknown", supporting, opposing, context, reasonCodes: ["admissible_support_and_opposition_conflict"] });
  }
  if (supporting.length) {
    const authority = highestAuthority(supporting);
    return factResult({ factKey, value: true, semanticStatus: "supported", authorityCeiling: authority, fusedConfidenceValue: fusedConfidence(authority), supporting, opposing: [], context, reasonCodes: ["admissible_evidence_supports_fact"] });
  }
  if (explicitNegative.length) {
    const authority = highestAuthority(explicitNegative);
    return factResult({ factKey, value: false, semanticStatus: "supported", authorityCeiling: authority, fusedConfidenceValue: fusedConfidence(authority), supporting: [], opposing: explicitNegative, context, reasonCodes: ["explicit_negative_supports_boolean_false"] });
  }
  if (relevant.length) {
    return factResult({ factKey, value: null, semanticStatus: "evidence_insufficient", authorityCeiling: highestAuthority(relevant), fusedConfidenceValue: "unknown", supporting: [], opposing, context, reasonCodes: ["relevant_evidence_present_but_fact_not_established"] });
  }
  if (reviewState === "reviewed_unknown") {
    return factResult({ factKey, value: null, semanticStatus: "reviewed_not_established", authorityCeiling: "none", fusedConfidenceValue: "unknown", supporting: [], opposing: [], context: [], reasonCodes: ["review_completed_without_establishing_fact"] });
  }
  return factResult({ factKey, value: null, semanticStatus: "not_reviewed", authorityCeiling: "none", fusedConfidenceValue: "unknown", supporting: [], opposing: [], context: [], reasonCodes: ["no_fact_specific_review_evidence"] });
}

function betaVariance(alpha, beta) {
  return (alpha * beta) / (((alpha + beta) ** 2) * (alpha + beta + 1));
}

export function evaluateReviewUncertainty(input) {
  const raw = input.raw_source_review_count ?? null;
  const analyzed = input.analyzed_review_count ?? null;
  const effective = input.effective_sample_size ?? null;
  const positive = input.signal_positive_count ?? null;
  const negative = input.signal_negative_count ?? null;
  const source = input.source ?? null;
  const extractionPolicyVersion = input.extraction_policy_version ?? null;

  for (const [name, value] of [["raw_source_review_count", raw], ["analyzed_review_count", analyzed], ["effective_sample_size", effective], ["signal_positive_count", positive], ["signal_negative_count", negative]]) {
    if (value !== null) invariant(Number.isFinite(value) && value >= 0, `${name} must be non-negative when present`);
  }
  if (raw !== null && analyzed !== null) invariant(analyzed <= raw, "analyzed_review_count must be <= raw_source_review_count");
  if (effective !== null) {
    invariant(analyzed !== null, "effective_sample_size requires analyzed_review_count");
    invariant(effective <= analyzed, "effective_sample_size must be <= analyzed_review_count");
  }

  if (analyzed === null) {
    return {
      source,
      extraction_policy_version: extractionPolicyVersion,
      raw_source_review_count: raw,
      analyzed_review_count: null,
      signal_positive_count: positive,
      signal_negative_count: negative,
      estimate: null,
      prevalence_estimate_allowed: false,
      uncertainty: null,
      coverage: positive !== null || negative !== null ? "observed_signal_no_denominator" : "denominator_missing",
      confidence_cap: "limited",
      review_model_version: REVIEW_MODEL_VERSION,
      production_calibrated: false,
      reason_codes: ["analyzed_denominator_missing", "raw_review_count_not_substituted"],
    };
  }

  invariant(analyzed > 0, "analyzed_review_count must be > 0 when estimating prevalence");
  invariant(positive !== null, "signal_positive_count required when analyzed_review_count is known");
  invariant(positive <= analyzed, "signal_positive_count must be <= analyzed_review_count");
  if (negative !== null) invariant(positive + negative <= analyzed, "signal counts must fit analyzed_review_count");
  const estimate = positive / analyzed;

  if (effective === null) {
    return {
      source,
      extraction_policy_version: extractionPolicyVersion,
      raw_source_review_count: raw,
      analyzed_review_count: analyzed,
      signal_positive_count: positive,
      signal_negative_count: negative,
      estimate,
      prevalence_estimate_allowed: true,
      uncertainty: null,
      coverage: "analyzed_denominator_known_effective_n_missing",
      confidence_cap: "limited",
      review_model_version: REVIEW_MODEL_VERSION,
      production_calibrated: false,
      reason_codes: ["prevalence_uses_analyzed_denominator", "effective_n_not_inferred"],
    };
  }

  const prior = input.prior;
  invariant(prior && Number.isFinite(prior.alpha) && prior.alpha > 0 && Number.isFinite(prior.beta) && prior.beta > 0, "explicit positive Beta prior required for POC uncertainty");
  const effectivePositive = estimate * effective;
  const alpha = prior.alpha + effectivePositive;
  const beta = prior.beta + (effective - effectivePositive);
  return {
    source,
    extraction_policy_version: extractionPolicyVersion,
    raw_source_review_count: raw,
    analyzed_review_count: analyzed,
    effective_sample_size: effective,
    signal_positive_count: positive,
    signal_negative_count: negative,
    estimate,
    prevalence_estimate_allowed: true,
    uncertainty: { kind: "beta_posterior_variance_poc", value: betaVariance(alpha, beta) },
    posterior_poc: { alpha, beta },
    coverage: "explicit_effective_n_poc",
    confidence_cap: "poc_only",
    review_model_version: REVIEW_MODEL_VERSION,
    production_calibrated: false,
    reason_codes: ["prevalence_uses_analyzed_denominator", "explicit_effective_n_used_for_uncertainty_only", "production_effective_n_formula_absent"],
  };
}

export function deriveCleanserProduct(product) {
  const normalizedEvidence = (product.evidence ?? []).map((item) => normalizeCleanserEvidence(product, item));
  return {
    product_id: product.product_id,
    brand: product.brand,
    name: product.name,
    identity_state: { status: "resolved", canonical_product_id: product.product_id, reason_codes: ["frozen_cleanser_corpus_product_binding"] },
    normalized_evidence: normalizedEvidence,
    facts: FACT_KEYS.map((factKey) => fuseProductFact({ factKey, normalizedEvidence, reviewState: product.review_state })),
  };
}

export function buildFusionArtifact(corpus) {
  invariant(corpus.version === CORPUS_VERSION, `unexpected corpus version ${corpus.version}`);
  invariant(Array.isArray(corpus.products) && corpus.products.length === 26, "frozen cleanser corpus must contain 26 products");
  const products = corpus.products.map(deriveCleanserProduct);
  const reviewEvidence = products.flatMap((product) => product.normalized_evidence).filter((item) => item.source_class === "review_corpus");
  const facts = products.flatMap((product) => product.facts);

  const small = evaluateReviewUncertainty({ source: "synthetic_fixture", extraction_policy_version: "fixture-v1", raw_source_review_count: 5, analyzed_review_count: 5, effective_sample_size: 5, signal_positive_count: 3, signal_negative_count: 2, prior: { alpha: 1, beta: 1 } });
  const large = evaluateReviewUncertainty({ source: "synthetic_fixture", extraction_policy_version: "fixture-v1", raw_source_review_count: 5000, analyzed_review_count: 5000, effective_sample_size: 5000, signal_positive_count: 3000, signal_negative_count: 2000, prior: { alpha: 1, beta: 1 } });
  const effectiveReduced = evaluateReviewUncertainty({ source: "synthetic_fixture", extraction_policy_version: "fixture-v1", raw_source_review_count: 5000, analyzed_review_count: 5000, effective_sample_size: 100, signal_positive_count: 3000, signal_negative_count: 2000, prior: { alpha: 1, beta: 1 } });
  const missingDenominator = evaluateReviewUncertainty({ source: "synthetic_fixture", extraction_policy_version: "fixture-v1", raw_source_review_count: 10000, analyzed_review_count: null, signal_positive_count: 27, signal_negative_count: null });

  return {
    version: VERSION,
    architecture_version: ARCHITECTURE_VERSION,
    authority: { main_sha: BASE_MAIN_SHA, frozen_corpus_version: CORPUS_VERSION, frozen_corpus_sha256: CORPUS_SHA256, historical_cleanser_poc_head: HISTORICAL_POC_HEAD, historical_poc_artifact_blob: HISTORICAL_POC_ARTIFACT_BLOB },
    fusion_policy_version: FUSION_POLICY_VERSION,
    review_uncertainty_contract: {
      review_model_version: REVIEW_MODEL_VERSION,
      beta_binomial_status: "poc_candidate_only",
      empirical_bayes_status: "not_selected",
      production_effective_n_formula: null,
      production_calibrated: false,
      denominator_rule: "analyzed_review_count_only",
      raw_review_count_substitution: "forbidden",
      multi_source_rule: "source_provenance_first_fusion_later",
    },
    summary: {
      products: products.length,
      fact_propositions: facts.length,
      supported: facts.filter((item) => item.semantic_status === "supported").length,
      reviewed_not_established: facts.filter((item) => item.semantic_status === "reviewed_not_established").length,
      evidence_insufficient: facts.filter((item) => item.semantic_status === "evidence_insufficient").length,
      evidence_conflict: facts.filter((item) => item.semantic_status === "evidence_conflict").length,
      not_reviewed: facts.filter((item) => item.semantic_status === "not_reviewed").length,
      review_corpus_evidence: reviewEvidence.length,
      real_review_prevalence_estimates_emitted: 0,
    },
    review_uncertainty_acceptance: { same_ratio_n5: small, same_ratio_n5000: large, same_analyzed_n5000_effective_n100: effectiveReduced, missing_denominator: missingDenominator },
    products,
    lifecycle: {
      EVIDENCE_FUSION_V1_OFFLINE_VERIFIED: true,
      EVIDENCE_FUSION_PRODUCTION_CALIBRATED: false,
      REVIEW_BAYESIAN_MODEL_CALIBRATED: false,
      EFFECTIVE_SAMPLE_MODEL_CALIBRATED: false,
      PRODUCT_FACT_CATALOG_ADOPTED: false,
      DECISION_AXIS_CONSUMPTION: false,
      RECOMMENDATION_ACTIVATED: false,
    },
  };
}
