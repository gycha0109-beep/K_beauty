import {
  PRODUCT_EVIDENCE_KNOWLEDGE_STATES,
  buildProductEvidencePresentationProjection
} from "./product-evidence-presentation-contract.js";

export const PRODUCT_EVIDENCE_AUTHORITY_READ_CONTRACT_VERSION =
  "product-evidence-presentation-authority-read-v1";
export const PRODUCT_EVIDENCE_PRESENTATION_PROVIDER_VERSION =
  "product-evidence-presentation-provider-v1.1";
export const PRODUCT_EVIDENCE_PRESENTATION_FEATURE_KEYS = Object.freeze([
  "eye_sting",
  "white_cast",
  "pilling_risk",
  "finish"
]);
export const PRODUCT_EVIDENCE_PRESENTATION_CANONICAL_FACT_KEYS = Object.freeze({
  eye_sting: "eye_sting_observed",
  white_cast: "white_cast_observed",
  pilling_risk: null,
  finish: null
});

const KNOWLEDGE_STATE_SET = new Set(PRODUCT_EVIDENCE_KNOWLEDGE_STATES);
const USABLE_FACT_AUTHORITIES = new Set([
  "product_specific_primary",
  "limited_non_product_specific",
  "review_observation",
  "ingredient_basis"
]);
const USABLE_EVIDENCE_AUTHORITIES = new Set([
  "product_specific_primary",
  "limited_non_product_specific",
  "review_observation",
  "ingredient_basis"
]);

function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function missingProjection(featureKey) {
  return buildProductEvidencePresentationProjection({
    featureKey,
    factRef: null,
    axisRef: null,
    knowledgeState: null,
    dominantFamily: "none",
    independentSupport: "unresolved",
    recency: "unknown",
    agreement: "unknown",
    evidenceRefs: []
  });
}

function evidenceFamily(row) {
  if (row?.evidence_authority === "review_observation" || row?.evidence_class === "observation") {
    return "review_experience";
  }
  if (row?.evidence_authority === "ingredient_basis") return "ingredient_basis";
  if (row?.evidence_class === "measurement") return "measurement";
  if (row?.evidence_authority === "product_specific_primary") return "official";
  return "none";
}

function dominantFamily(rows) {
  const families = new Set(rows.map(evidenceFamily).filter((value) => value !== "none"));
  if (families.size === 0) return "none";
  if (families.size === 1) return [...families][0];
  return "mixed";
}

function agreement(rows) {
  const roles = new Set(
    rows
      .map((row) => row?.link_role)
      .filter((value) => value === "supporting" || value === "opposing")
  );
  return roles.has("supporting") && roles.has("opposing") ? "mixed" : "unknown";
}

function eligibleEvidence(row) {
  return Boolean(
    text(row?.evidence_id) &&
      USABLE_EVIDENCE_AUTHORITIES.has(row?.evidence_authority) &&
      (row?.link_role === "supporting" || row?.link_role === "opposing")
  );
}

function projectionFromFact(featureKey, canonicalFactKey, fact) {
  if (!canonicalFactKey || !fact || fact.fact_key !== canonicalFactKey) {
    return missingProjection(featureKey);
  }

  const factInstanceId = text(fact.fact_instance_id);
  const semanticStatus = text(fact.semantic_status);
  if (!factInstanceId || !KNOWLEDGE_STATE_SET.has(semanticStatus)) {
    return missingProjection(featureKey);
  }

  const factAuthorityUsable = USABLE_FACT_AUTHORITIES.has(fact.authority_ceiling);
  const evidenceRows = Array.isArray(fact.evidence) ? fact.evidence.filter(eligibleEvidence) : [];
  const evidenceRefs = evidenceRows.map(
    (row) => `product_evidence_record:${text(row.evidence_id)}`
  );

  return buildProductEvidencePresentationProjection({
    featureKey,
    factRef: factAuthorityUsable ? `product_fact_instance:${factInstanceId}` : null,
    axisRef: null,
    knowledgeState: semanticStatus,
    dominantFamily: dominantFamily(evidenceRows),
    independentSupport: "unresolved",
    recency: "unknown",
    agreement: agreement(evidenceRows),
    evidenceRefs: factAuthorityUsable ? evidenceRefs : []
  });
}

export function buildProductEvidencePresentationFromAuthorityRead(payload) {
  const contractMatches =
    payload?.read_contract_version === PRODUCT_EVIDENCE_AUTHORITY_READ_CONTRACT_VERSION;
  const authorityResolved = contractMatches && payload?.status === "AUTHORITY_RESOLVED";
  const currentFacts = authorityResolved && Array.isArray(payload?.current_facts) ? payload.current_facts : [];

  const projections = PRODUCT_EVIDENCE_PRESENTATION_FEATURE_KEYS.map((featureKey) => {
    const canonicalFactKey = PRODUCT_EVIDENCE_PRESENTATION_CANONICAL_FACT_KEYS[featureKey];
    if (!canonicalFactKey) return missingProjection(featureKey);

    const facts = currentFacts.filter((fact) => fact?.fact_key === canonicalFactKey);
    return facts.length === 1
      ? projectionFromFact(featureKey, canonicalFactKey, facts[0])
      : missingProjection(featureKey);
  });

  return Object.freeze({
    providerVersion: PRODUCT_EVIDENCE_PRESENTATION_PROVIDER_VERSION,
    readContractVersion: contractMatches ? payload.read_contract_version : null,
    authorityResolved,
    productId: authorityResolved ? text(payload?.product_id) : null,
    subjectId: authorityResolved ? text(payload?.subject?.subject_id) : null,
    projections: Object.freeze(projections)
  });
}
