import crypto from "node:crypto";

export const POC_VERSION = "product-evidence-cleanser-poc-v1";
export const ARCHITECTURE_VERSION = "product-evidence-decision-axis-v1";
export const BASELINE_SHA = "559b3c7a8d078c438f9ba6e067051f0372808cca";
export const CORPUS_VERSION = "cleanser-catalog-field-review-v1";
export const CORPUS_SHA256 = "9c2472cecc720e420467d2bef0808dc47cdbcff31dad118c2d28933ca7bbde9f";
export const MAPPER_VERSION = "cleanser-axis-mapper-poc-v1";

export const FACT_KEYS = Object.freeze(["low_ph", "deep_cleansing"]);
export const AXIS_KEYS = Object.freeze([
  "cleansing_burden",
  "hydration_preservation",
  "irritation_burden",
  "sebum_pore_control",
]);
export const FACT_STATUSES = Object.freeze([
  "supported",
  "reviewed_not_established",
  "not_reviewed",
  "evidence_insufficient",
  "evidence_conflict",
]);

const SUPPORTED_VALUE_TO_FACT = Object.freeze({
  low_ph: "low_ph",
  deep_clean: "deep_cleansing",
});

const SOURCE_AUTHORITY = Object.freeze({
  official_product_page: "product_specific_primary",
  manufacturer_documentation: "product_specific_primary",
  official_brand_site_listing: "limited_non_product_specific",
  retailer_product_page: "limited_non_product_specific",
  marketplace_product_page: "limited_non_product_specific",
  price_comparison_product_page: "limited_non_product_specific",
  ingredient_list: "ingredient_basis",
  review_corpus: "review_observation",
  manual_conflict_record: "adjudication_only",
});

const AUTHORITY_RANK = Object.freeze({
  none: 0,
  adjudication_only: 1,
  review_observation: 2,
  ingredient_basis: 2,
  limited_non_product_specific: 3,
  product_specific_primary: 4,
  unresolved: -1,
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function digestWithoutSelf(corpus) {
  const copy = structuredClone(corpus);
  delete copy.canonical_sha256;
  return crypto.createHash("sha256").update(stableJson(copy), "utf8").digest("hex");
}

export function canonicalJson(value) {
  const normalize = (input) => {
    if (Array.isArray(input)) return input.map(normalize);
    if (input && typeof input === "object") {
      return Object.fromEntries(Object.keys(input).sort().map((key) => [key, normalize(input[key])]));
    }
    return input;
  };
  return `${JSON.stringify(normalize(value))}\n`;
}

function inferNonEstablishingProposition(evidence) {
  if (evidence.supported_value !== null && evidence.supported_value !== undefined) return null;
  const summary = String(evidence.evidence_summary ?? "");
  if (/\bpH\b|low_ph|mildly acidic/i.test(summary)) return "low_ph";
  if (/deep[ -]?clean|pore[ -]?clean|sebum[ -]?clean/i.test(summary)) return "deep_cleansing";
  return null;
}

export function normalizeEvidence(product, evidence) {
  const mappedFact = SUPPORTED_VALUE_TO_FACT[evidence.supported_value] ?? inferNonEstablishingProposition(evidence);
  const isManual = evidence.source_class === "manual_conflict_record";
  const supportDirection = isManual
    ? "context_only"
    : SUPPORTED_VALUE_TO_FACT[evidence.supported_value]
      ? "supports"
      : mappedFact
        ? "does_not_establish"
        : "context_only";

  return {
    catalog_evidence_id: evidence.catalog_evidence_id,
    source_reference: evidence.source_reference,
    source_class: evidence.source_class,
    supported_value: evidence.supported_value ?? null,
    evidence_summary: evidence.evidence_summary,
    accessed_at: evidence.accessed_at,
    admin_v2_evidence_type_candidate: evidence.admin_v2_evidence_type_candidate ?? null,
    admin_v2_ingestion_eligible: evidence.admin_v2_ingestion_eligible === true,
    support_direction: supportDirection,
    fact_proposition: mappedFact,
    authority_class: SOURCE_AUTHORITY[evidence.source_class] ?? "none",
    normalization_reason_codes: isManual
      ? ["manual_adjudication_context_only"]
      : supportDirection === "supports"
        ? ["frozen_supported_value_maps_to_registered_fact"]
        : supportDirection === "does_not_establish"
          ? ["frozen_evidence_addresses_registered_fact_without_establishing_it"]
          : ["no_registered_fact_proposition_derived"],
    catalog_product_confidence: product.confidence ?? "unknown",
  };
}

export function buildProductIdentityState(product, normalizedEvidence) {
  return {
    status: "resolved",
    canonical_product_id: product.product_id,
    confidence: null,
    identity_evidence: normalizedEvidence
      .filter((item) => item.source_class !== "manual_conflict_record")
      .map((item) => item.catalog_evidence_id),
    reason_codes: ["frozen_corpus_product_binding"],
  };
}

function highestAuthority(evidence) {
  let best = "none";
  for (const item of evidence) {
    const candidate = item.authority_class ?? "none";
    if ((AUTHORITY_RANK[candidate] ?? 0) > (AUTHORITY_RANK[best] ?? 0)) best = candidate;
  }
  return best;
}

function confidenceFromSupport(supportingEvidence) {
  const authority = highestAuthority(supportingEvidence);
  if (authority === "product_specific_primary") return "high";
  if (authority === "limited_non_product_specific") return "medium";
  if (authority === "review_observation" || authority === "ingredient_basis") return "low";
  return "unknown";
}

export function fuseFact({ normalizedEvidence, factKey, reviewCoverageContext = {} }) {
  assert(FACT_KEYS.includes(factKey), `unknown fact_key: ${factKey}`);
  const relevant = normalizedEvidence.filter((item) => item.fact_proposition === factKey);
  const supporting = relevant.filter((item) => item.support_direction === "supports" && item.source_class !== "manual_conflict_record");
  const opposing = relevant.filter((item) => item.support_direction === "opposes" && item.source_class !== "manual_conflict_record");
  const nonEstablishing = relevant.filter((item) => item.support_direction === "does_not_establish");

  if (supporting.length > 0 && opposing.length > 0) {
    return {
      fact_key: factKey,
      value: null,
      status: "evidence_conflict",
      authority_ceiling: "unresolved",
      confidence: "conflicted",
      supporting_evidence: supporting.map((item) => item.catalog_evidence_id),
      opposing_evidence: opposing.map((item) => item.catalog_evidence_id),
      reason_codes: ["same_fact_support_and_opposition"],
    };
  }

  if (supporting.length > 0) {
    return {
      fact_key: factKey,
      value: true,
      status: "supported",
      authority_ceiling: highestAuthority(supporting),
      confidence: confidenceFromSupport(supporting),
      supporting_evidence: supporting.map((item) => item.catalog_evidence_id),
      opposing_evidence: [],
      reason_codes: ["credible_frozen_evidence_supports_fact"],
    };
  }

  if (opposing.length > 0) {
    return {
      fact_key: factKey,
      value: null,
      status: "evidence_insufficient",
      authority_ceiling: highestAuthority(opposing),
      confidence: "limited",
      supporting_evidence: [],
      opposing_evidence: opposing.map((item) => item.catalog_evidence_id),
      reason_codes: ["negative_evidence_present_without_boolean_false_contract"],
    };
  }

  if (nonEstablishing.length > 0) {
    return {
      fact_key: factKey,
      value: null,
      status: "evidence_insufficient",
      authority_ceiling: highestAuthority(nonEstablishing),
      confidence: "limited",
      supporting_evidence: [],
      opposing_evidence: [],
      reason_codes: ["relevant_evidence_does_not_establish_fact"],
    };
  }

  if (reviewCoverageContext.review_state === "reviewed_unknown") {
    return {
      fact_key: factKey,
      value: null,
      status: "reviewed_not_established",
      authority_ceiling: "none",
      confidence: "unknown",
      supporting_evidence: [],
      opposing_evidence: [],
      reason_codes: ["product_review_completed_without_establishing_registered_fact"],
    };
  }

  return {
    fact_key: factKey,
    value: null,
    status: "not_reviewed",
    authority_ceiling: "none",
    confidence: "unknown",
    supporting_evidence: [],
    opposing_evidence: [],
    reason_codes: ["no_evidence_review_for_registered_fact"],
  };
}

function emptyAxis(coverage = "no_relevant_evidence", evidenceReasons = []) {
  return {
    estimate: null,
    uncertainty: "high",
    coverage,
    evidence_reasons: evidenceReasons,
    mapper_version: MAPPER_VERSION,
  };
}

function qualitativeCoverageForDeepFact(fact) {
  if (fact.authority_ceiling === "product_specific_primary") return "claim_only";
  if (fact.authority_ceiling === "limited_non_product_specific") return "authority_limited";
  if (fact.authority_ceiling === "review_observation") return "qualitative_observation_no_denominator";
  return "no_relevant_evidence";
}

function measurementForAxis(normalizedEvidence, axisKey) {
  const metricHints = axisKey === "cleansing_burden"
    ? new Set(["cleansing_burden", "cleansing_intensity", "cleansing_test_score"])
    : axisKey === "sebum_pore_control"
      ? new Set(["sebum_pore_control", "sebum_removal", "pore_cleansing_test_score"])
      : axisKey === "hydration_preservation"
        ? new Set(["hydration_preservation", "hydration_change"])
        : new Set(["irritation_burden", "irritation_test_score"]);

  return normalizedEvidence.find((item) =>
    item.evidence_type === "official_measurement"
      && metricHints.has(item.metric)
      && typeof item.numeric_value === "number"
      && typeof item.unit === "string" && item.unit.length > 0
      && typeof item.method_context === "string" && item.method_context.length > 0
  ) ?? null;
}

export function mapDecisionAxes({ facts, normalizedEvidence = [] }) {
  const factByKey = new Map(facts.map((item) => [item.fact_key, item]));
  const lowPh = factByKey.get("low_ph");
  const deep = factByKey.get("deep_cleansing");
  const axes = {};

  for (const axisKey of AXIS_KEYS) {
    const measurement = measurementForAxis(normalizedEvidence, axisKey);
    if (measurement) {
      axes[axisKey] = {
        estimate: measurement.numeric_value,
        uncertainty: "fixture_only_unscaled",
        coverage: "measurement_supported",
        evidence_reasons: [measurement.catalog_evidence_id ?? "synthetic_measurement"],
        mapper_version: MAPPER_VERSION,
      };
      continue;
    }

    if (axisKey === "hydration_preservation" && lowPh?.status === "supported") {
      axes[axisKey] = emptyAxis("indirect_fact_only", ["low_ph_supported_but_no_hydration_magnitude"]);
      continue;
    }

    if ((axisKey === "cleansing_burden" || axisKey === "sebum_pore_control") && deep?.status === "supported") {
      axes[axisKey] = emptyAxis(qualitativeCoverageForDeepFact(deep), ["deep_cleansing_supported_without_standardized_numeric_magnitude"]);
      continue;
    }

    axes[axisKey] = emptyAxis();
  }

  return axes;
}

export function deriveProduct(product) {
  const normalizedEvidence = product.evidence.map((evidence) => normalizeEvidence(product, evidence));
  const identityState = buildProductIdentityState(product, normalizedEvidence);
  const facts = FACT_KEYS.map((factKey) => fuseFact({
    normalizedEvidence,
    factKey,
    reviewCoverageContext: { review_state: product.review_state },
  }));
  const decisionAxes = mapDecisionAxes({ facts, normalizedEvidence });

  return {
    product_id: product.product_id,
    brand: product.brand,
    name: product.name,
    identity_state: identityState,
    normalized_evidence_refs: normalizedEvidence.map((item) => item.catalog_evidence_id),
    facts,
    decision_axes: decisionAxes,
  };
}

export function buildArtifactFromCorpus(corpus) {
  assert(corpus.version === CORPUS_VERSION, `unexpected corpus version: ${corpus.version}`);
  assert(Array.isArray(corpus.products) && corpus.products.length === 26, "frozen cleanser corpus must contain 26 products");
  const products = corpus.products.map(deriveProduct);
  return {
    version: POC_VERSION,
    architecture_version: ARCHITECTURE_VERSION,
    baseline_sha: BASELINE_SHA,
    corpus_version: CORPUS_VERSION,
    corpus_sha256: CORPUS_SHA256,
    mapper_version: MAPPER_VERSION,
    products,
  };
}

function betaVariance(alpha, beta) {
  return (alpha * beta) / (((alpha + beta) ** 2) * (alpha + beta + 1));
}

export function evaluateReviewReliability(input) {
  const raw = input.raw_source_sample_size ?? null;
  const analyzed = input.analyzed_sample_size ?? null;
  const effective = input.effective_sample_size ?? null;

  for (const [key, value] of [["raw_source_sample_size", raw], ["analyzed_sample_size", analyzed], ["effective_sample_size", effective]]) {
    if (value !== null) {
      assert(Number.isFinite(value) && value >= 0, `${key} must be a non-negative number when present`);
    }
  }
  if (effective !== null && analyzed !== null) assert(effective <= analyzed, "effective_sample_size must be <= analyzed_sample_size");
  if (analyzed !== null && raw !== null) assert(analyzed <= raw, "analyzed_sample_size must be <= raw_source_sample_size");

  if (analyzed === null) {
    return {
      prevalence_estimate_allowed: false,
      prevalence_estimate: null,
      confidence_cap: "limited",
      uncertainty: null,
      reason_codes: ["analyzed_denominator_missing", "review_count_not_substituted"],
    };
  }

  const positive = input.observed_positive;
  assert(Number.isFinite(positive) && positive >= 0 && positive <= analyzed, "observed_positive must be within analyzed sample");
  const priorAlpha = input.prior?.alpha ?? 1;
  const priorBeta = input.prior?.beta ?? 1;
  assert(priorAlpha > 0 && priorBeta > 0, "Beta prior parameters must be positive");
  const observedRatio = analyzed === 0 ? 0 : positive / analyzed;
  const uncertaintyN = effective ?? analyzed;
  const effectivePositive = observedRatio * uncertaintyN;
  const effectiveNegative = uncertaintyN - effectivePositive;
  const alpha = priorAlpha + effectivePositive;
  const beta = priorBeta + effectiveNegative;

  return {
    prevalence_estimate_allowed: true,
    prevalence_estimate: alpha / (alpha + beta),
    confidence_cap: effective === null ? "limited" : "poc_only",
    uncertainty: betaVariance(alpha, beta),
    posterior: { alpha, beta },
    reason_codes: effective === null ? ["effective_sample_size_unmodeled"] : ["effective_sample_size_applied_for_uncertainty"],
  };
}
