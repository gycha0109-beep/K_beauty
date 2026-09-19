import { createHash } from "node:crypto";

export const TRUST_SUBJECT_PROPOSAL_VERSION =
  "trust-phase5-subject-identity-proposal-v1";
export const TRUST_SUBJECT_IDENTITY_RESOLUTION_VERSION =
  "trust-phase5-admin-reviewed-catalog-identity-v1";
export const PRODUCT_FACT_SUBJECT_SERIALIZER_VERSION =
  "product-fact-subject-identity-v1";
export const TRUST_SUBJECT_FORMULATION_PREFIX = "trust-phase5-review-";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH_PATTERN = /^[0-9a-f]{64}$/;

export class TrustSubjectIdentityError extends Error {
  constructor(code) {
    super(code);
    this.name = "TrustSubjectIdentityError";
    this.code = code;
  }
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function uuid(value) {
  const normalized = text(value);
  return normalized && UUID_PATTERN.test(normalized) ? normalized.toLowerCase() : null;
}

export function canonicalizeTrustSubjectValue(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalizeTrustSubjectValue);
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalizeTrustSubjectValue(value[key])])
    );
  }

  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  throw new TrustSubjectIdentityError("trust_subject_identity_non_json_value");
}

export function canonicalTrustSubjectJson(value) {
  return JSON.stringify(canonicalizeTrustSubjectValue(value));
}

export function digestTrustSubjectValue(value) {
  return createHash("sha256")
    .update(canonicalTrustSubjectJson(value), "utf8")
    .digest("hex");
}

function normalizeProvider(provider) {
  if (!isRecord(provider)) {
    throw new TrustSubjectIdentityError("trust_subject_identity_provider_invalid");
  }

  return {
    provider: text(provider.provider),
    locator: text(provider.locator),
    external_id: text(provider.external_id),
    external_type: text(provider.external_type),
    presentation: text(provider.presentation),
    canonical_name: text(provider.canonical_name),
    canonical_brand: text(provider.canonical_brand),
    product_name_en: text(provider.product_name_en)
  };
}

function normalizeProviders(value) {
  if (!Array.isArray(value) || value.length < 2) {
    throw new TrustSubjectIdentityError(
      "trust_subject_identity_converged_providers_required"
    );
  }

  const providers = value.map(normalizeProvider);

  if (
    providers.some((provider) => !provider.provider || !provider.locator) ||
    !providers.some((provider) => /official/i.test(provider.provider))
  ) {
    throw new TrustSubjectIdentityError(
      "trust_subject_identity_official_provider_required"
    );
  }

  return providers.sort((left, right) => {
    const leftKey = canonicalTrustSubjectJson(left);
    const rightKey = canonicalTrustSubjectJson(right);
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  });
}

function normalizeDimensions(value) {
  if (!Array.isArray(value)) {
    throw new TrustSubjectIdentityError(
      "trust_subject_identity_convergence_dimensions_required"
    );
  }

  const dimensions = [...new Set(value.map(text).filter(Boolean))].sort();
  for (const required of ["brand", "product_name", "presentation"]) {
    if (!dimensions.includes(required)) {
      throw new TrustSubjectIdentityError(
        "trust_subject_identity_convergence_dimensions_incomplete"
      );
    }
  }
  return dimensions;
}

function assertInitialReviewState(snapshot) {
  const { task, intake } = snapshot;

  if (
    task.state !== "REVIEW_REQUIRED" ||
    task.blocker_code !== "SUBJECT_CREATION_REQUIRED" ||
    task.subject_id !== null ||
    intake.identity_state !== "SUBJECT_CREATION_REQUIRED" ||
    intake.trust_state !== "REVIEW_REQUIRED" ||
    intake.subject_id !== null
  ) {
    throw new TrustSubjectIdentityError(
      "trust_subject_registration_state_not_reviewable"
    );
  }
}

export function buildTrustSubjectIdentityProposal(
  snapshot,
  { requireInitialReviewState = true } = {}
) {
  if (!isRecord(snapshot)) {
    throw new TrustSubjectIdentityError("trust_subject_registration_snapshot_invalid");
  }

  const { task, intake, product, candidate } = snapshot;

  if (![task, intake, product, candidate].every(isRecord)) {
    throw new TrustSubjectIdentityError("trust_subject_registration_snapshot_invalid");
  }

  const taskId = uuid(task.id);
  const intakeId = uuid(task.intake_id);
  const taskProductId = uuid(task.product_id);
  const intakeProductId = uuid(intake.product_id);
  const productId = uuid(product.id);
  const sourceCandidateId = uuid(intake.source_candidate_id);
  const candidateId = uuid(candidate.id);
  const matchedProductId = uuid(candidate.matched_product_id);
  const market = text(intake.market)?.toUpperCase() ?? null;

  if (
    !taskId ||
    !intakeId ||
    !productId ||
    uuid(task.intake_id) !== uuid(intake.id) ||
    taskProductId !== productId ||
    intakeProductId !== productId ||
    !sourceCandidateId ||
    candidateId !== sourceCandidateId ||
    matchedProductId !== productId ||
    !market ||
    market.length > 32
  ) {
    throw new TrustSubjectIdentityError(
      "trust_subject_registration_lineage_mismatch"
    );
  }

  if (requireInitialReviewState) {
    assertInitialReviewState(snapshot);
  }

  if (
    candidate.review_status !== "promoted" ||
    candidate.identity_resolution_state !== "resolved" ||
    !text(candidate.identity_resolution_version)
  ) {
    throw new TrustSubjectIdentityError(
      "trust_subject_identity_catalog_review_not_resolved"
    );
  }

  const evidence = candidate.identity_resolution_evidence;
  const promotion = candidate.promotion_payload;

  if (!isRecord(evidence) || !isRecord(promotion)) {
    throw new TrustSubjectIdentityError(
      "trust_subject_identity_catalog_evidence_missing"
    );
  }

  if (
    text(evidence.contract_version) !==
      "catalog-only-candidate-identity-evidence-v1" ||
    text(evidence.approval_contract) !== "catalog-only-candidate-approval-v1" ||
    !isRecord(evidence.authority_boundary) ||
    evidence.authority_boundary.product_fact_write_allowed !== false
  ) {
    throw new TrustSubjectIdentityError(
      "trust_subject_identity_catalog_authority_boundary_invalid"
    );
  }

  const adoption = isRecord(promotion.catalog_only_adoption)
    ? promotion.catalog_only_adoption
    : null;
  const catalogReview = isRecord(promotion.catalog_only_review)
    ? promotion.catalog_only_review
    : null;
  const reviewedAt = text(evidence.reviewed_at) ?? text(candidate.reviewed_at);
  const reviewedBy = uuid(candidate.reviewed_by);

  if (
    !adoption ||
    uuid(adoption.product_id) !== productId ||
    text(adoption.contract_version) !==
      "catalog-only-product-transactional-adoption-v1" ||
    adoption.recommendation_admission_allowed !== false ||
    !catalogReview ||
    text(catalogReview.contract_version) !==
      "catalog-only-candidate-approval-v1" ||
    catalogReview.product_write_allowed !== false ||
    catalogReview.recommendation_admission_allowed !== false ||
    text(catalogReview.source_rule_key) !== text(adoption.source_rule_key) ||
    text(catalogReview.taxonomy_version) !== text(adoption.taxonomy_version) ||
    !reviewedAt ||
    !reviewedBy
  ) {
    throw new TrustSubjectIdentityError(
      "trust_subject_identity_catalog_promotion_lineage_invalid"
    );
  }

  if (
    evidence.semantic_variant_key !== undefined &&
    evidence.semantic_variant_key !== null
  ) {
    throw new TrustSubjectIdentityError(
      "trust_subject_identity_semantic_variant_requires_separate_review"
    );
  }

  const providers = normalizeProviders(evidence.providers);
  const convergenceDimensions = normalizeDimensions(
    evidence.convergence_dimensions
  );

  const evidenceBasis = {
    version: TRUST_SUBJECT_PROPOSAL_VERSION,
    product_id: productId,
    source_candidate_id: candidateId,
    catalog_identity_resolution_version: text(
      candidate.identity_resolution_version
    ),
    evidence_contract_version: text(evidence.contract_version),
    approval_contract: text(evidence.approval_contract),
    reviewed_at: reviewedAt,
    reviewed_by: reviewedBy,
    providers,
    convergence_dimensions: convergenceDimensions,
    market_applicability: market,
    variant_key: null
  };

  const formulationIdentityBasis = {
    version: TRUST_SUBJECT_PROPOSAL_VERSION,
    product_id: productId,
    catalog_identity_resolution_version: text(
      candidate.identity_resolution_version
    ),
    evidence_contract_version: text(evidence.contract_version),
    approval_contract: text(evidence.approval_contract),
    providers,
    convergence_dimensions: convergenceDimensions,
    market_applicability: market,
    variant_key: null
  };
  const evidenceDigest = digestTrustSubjectValue(formulationIdentityBasis);
  const formulationRevisionKey =
    TRUST_SUBJECT_FORMULATION_PREFIX + evidenceDigest.slice(0, 32);

  const semanticIdentity = {
    product_id: productId,
    variant_key: null,
    formulation_revision_key: formulationRevisionKey,
    market_applicability: market,
    region_applicability: null,
    valid_from: null,
    valid_to: null
  };

  const subjectSemanticKey = digestTrustSubjectValue(semanticIdentity);
  const formulationLabel =
    `TRUST reviewed identity ${evidenceDigest.slice(0, 12)}`;

  const payload = {
    product_id: productId,
    subject_semantic_key: subjectSemanticKey,
    subject_identity_serializer_version:
      PRODUCT_FACT_SUBJECT_SERIALIZER_VERSION,
    variant_key: null,
    formulation_revision_key: formulationRevisionKey,
    formulation_label: formulationLabel,
    identity_status: "resolved",
    identity_resolution_version: TRUST_SUBJECT_IDENTITY_RESOLUTION_VERSION,
    current_state: "current",
    market_applicability: market,
    region_applicability: null,
    valid_from: null,
    valid_to: null,
    predecessor_subject_id: null,
    supersession_kind: null
  };

  if (!HASH_PATTERN.test(payload.subject_semantic_key)) {
    throw new TrustSubjectIdentityError(
      "trust_subject_identity_semantic_key_invalid"
    );
  }

  const proposalDigest = digestTrustSubjectValue({
    version: TRUST_SUBJECT_PROPOSAL_VERSION,
    evidence_basis: evidenceBasis,
    payload
  });

  const stateDigest = digestTrustSubjectValue({
    task_id: taskId,
    task_state: text(task.state),
    task_blocker_code: text(task.blocker_code),
    task_subject_id: uuid(task.subject_id),
    task_updated_at: text(task.updated_at),
    intake_id: intakeId,
    intake_identity_state: text(intake.identity_state),
    intake_trust_state: text(intake.trust_state),
    intake_subject_id: uuid(intake.subject_id),
    intake_updated_at: text(intake.updated_at),
    source_candidate_id: candidateId,
    source_candidate_updated_at: text(candidate.updated_at),
    source_candidate_review_status: text(candidate.review_status),
    source_candidate_identity_state: text(candidate.identity_resolution_state),
    source_candidate_identity_version: text(candidate.identity_resolution_version)
  });

  return {
    version: TRUST_SUBJECT_PROPOSAL_VERSION,
    taskId,
    intakeId,
    productId,
    sourceCandidateId: candidateId,
    evidenceBasis,
    formulationIdentityBasis,
    evidenceDigest,
    semanticIdentity,
    payload,
    proposalDigest,
    stateDigest,
    preflightHash: digestTrustSubjectValue({
      proposal_digest: proposalDigest,
      state_digest: stateDigest
    }),
    requiresExplicitConfirmation: true,
    automaticRegistration: false
  };
}
