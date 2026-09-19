import { createHash } from "node:crypto";

export const TRUST_SUBJECT_PROPOSAL_VERSION =
  "trust-phase5-subject-identity-proposal-v2";
export const TRUST_SUBJECT_IDENTITY_RESOLUTION_VERSION =
  "trust-phase5-admin-subject-review-v1";
export const PRODUCT_FACT_SUBJECT_SERIALIZER_VERSION =
  "product-fact-subject-identity-v1";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const REVIEWED_IDENTITY_KEYS = Object.freeze([
  "variantKey",
  "formulationRevisionKey",
  "formulationLabel",
  "marketApplicability",
  "regionApplicability",
  "validFrom",
  "validTo"
]);

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
  return normalized && UUID_PATTERN.test(normalized)
    ? normalized.toLowerCase()
    : null;
}

function boundedText(value, maxLength, { required = false } = {}) {
  const normalized = text(value);
  if ((!normalized && required) || (normalized && normalized.length > maxLength)) {
    throw new TrustSubjectIdentityError(
      "trust_subject_identity_reviewed_input_invalid"
    );
  }
  return normalized;
}

function normalizeDate(value) {
  const normalized = text(value);
  if (!normalized) {
    return null;
  }
  if (!DATE_PATTERN.test(normalized)) {
    throw new TrustSubjectIdentityError(
      "trust_subject_identity_reviewed_input_invalid"
    );
  }
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== normalized
  ) {
    throw new TrustSubjectIdentityError(
      "trust_subject_identity_reviewed_input_invalid"
    );
  }
  return normalized;
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

export function normalizeReviewedSubjectIdentity(value) {
  if (!isRecord(value)) {
    throw new TrustSubjectIdentityError(
      "trust_subject_identity_reviewed_input_invalid"
    );
  }

  const keys = Object.keys(value).sort();
  const expected = [...REVIEWED_IDENTITY_KEYS].sort();
  if (
    keys.length !== expected.length ||
    keys.some((key, index) => key !== expected[index])
  ) {
    throw new TrustSubjectIdentityError(
      "trust_subject_identity_reviewed_input_invalid"
    );
  }

  const variantKey = boundedText(value.variantKey, 160);
  const formulationRevisionKey = boundedText(
    value.formulationRevisionKey,
    160,
    { required: true }
  );
  const formulationLabel = boundedText(value.formulationLabel, 240);
  const marketApplicability = boundedText(
    value.marketApplicability,
    32,
    { required: true }
  )?.toUpperCase();
  const regionApplicability = boundedText(value.regionApplicability, 64);
  const validFrom = normalizeDate(value.validFrom);
  const validTo = normalizeDate(value.validTo);

  if (validFrom && validTo && validFrom >= validTo) {
    throw new TrustSubjectIdentityError(
      "trust_subject_identity_reviewed_input_invalid"
    );
  }

  return {
    variantKey,
    formulationRevisionKey,
    formulationLabel,
    marketApplicability,
    regionApplicability,
    validFrom,
    validTo
  };
}

function assertLineage(snapshot) {
  const { task, intake, product, candidate } = snapshot;

  if (![task, intake, product, candidate].every(isRecord)) {
    throw new TrustSubjectIdentityError(
      "trust_subject_registration_snapshot_invalid"
    );
  }

  const taskId = uuid(task.id);
  const intakeId = uuid(task.intake_id);
  const productId = uuid(product.id);
  const sourceCandidateId = uuid(intake.source_candidate_id);

  if (
    !taskId ||
    !intakeId ||
    !productId ||
    uuid(intake.id) !== intakeId ||
    uuid(task.product_id) !== productId ||
    uuid(intake.product_id) !== productId ||
    uuid(candidate.id) !== sourceCandidateId
  ) {
    throw new TrustSubjectIdentityError(
      "trust_subject_registration_lineage_mismatch"
    );
  }

  return { taskId, intakeId, productId, sourceCandidateId };
}

function assertCatalogContext(snapshot) {
  const { candidate } = snapshot;
  const evidence = isRecord(candidate.identity_resolution_evidence)
    ? candidate.identity_resolution_evidence
    : null;

  if (
    candidate.identity_resolution_state !== "resolved" ||
    !text(candidate.identity_resolution_version) ||
    !evidence ||
    !isRecord(evidence.authority_boundary) ||
    evidence.authority_boundary.product_fact_write_allowed !== false
  ) {
    throw new TrustSubjectIdentityError(
      "trust_subject_identity_catalog_authority_boundary_invalid"
    );
  }

  return evidence;
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
  reviewedIdentityInput,
  { requireInitialReviewState = true } = {}
) {
  if (!isRecord(snapshot)) {
    throw new TrustSubjectIdentityError(
      "trust_subject_registration_snapshot_invalid"
    );
  }

  const lineage = assertLineage(snapshot);
  const catalogEvidence = assertCatalogContext(snapshot);
  if (requireInitialReviewState) {
    assertInitialReviewState(snapshot);
  }

  const reviewedIdentity = normalizeReviewedSubjectIdentity(
    reviewedIdentityInput
  );
  const intakeMarket = text(snapshot.intake.market)?.toUpperCase() ?? null;

  if (
    !intakeMarket ||
    reviewedIdentity.marketApplicability !== intakeMarket
  ) {
    throw new TrustSubjectIdentityError(
      "trust_subject_identity_market_mismatch"
    );
  }

  const semanticIdentity = {
    product_id: lineage.productId,
    variant_key: reviewedIdentity.variantKey,
    formulation_revision_key: reviewedIdentity.formulationRevisionKey,
    market_applicability: reviewedIdentity.marketApplicability,
    region_applicability: reviewedIdentity.regionApplicability,
    valid_from: reviewedIdentity.validFrom,
    valid_to: reviewedIdentity.validTo
  };

  const payload = {
    product_id: lineage.productId,
    subject_semantic_key: digestTrustSubjectValue(semanticIdentity),
    subject_identity_serializer_version:
      PRODUCT_FACT_SUBJECT_SERIALIZER_VERSION,
    variant_key: reviewedIdentity.variantKey,
    formulation_revision_key: reviewedIdentity.formulationRevisionKey,
    formulation_label: reviewedIdentity.formulationLabel,
    identity_status: "resolved",
    identity_resolution_version:
      TRUST_SUBJECT_IDENTITY_RESOLUTION_VERSION,
    current_state: "current",
    market_applicability: reviewedIdentity.marketApplicability,
    region_applicability: reviewedIdentity.regionApplicability,
    valid_from: reviewedIdentity.validFrom,
    valid_to: reviewedIdentity.validTo,
    predecessor_subject_id: null,
    supersession_kind: null
  };

  const catalogContextDigest = digestTrustSubjectValue({
    source_candidate_id: lineage.sourceCandidateId,
    identity_resolution_state: text(candidateValue(snapshot, "identity_resolution_state")),
    identity_resolution_version: text(candidateValue(snapshot, "identity_resolution_version")),
    identity_resolution_evidence: catalogEvidence,
    promotion_payload: isRecord(snapshot.candidate.promotion_payload)
      ? snapshot.candidate.promotion_payload
      : {}
  });

  const taskStates = Array.isArray(snapshot.tasks)
    ? snapshot.tasks
        .map((task) => ({
          id: uuid(task.id),
          fact_key: text(task.fact_key),
          state: text(task.state),
          blocker_code: text(task.blocker_code),
          subject_id: uuid(task.subject_id),
          updated_at: text(task.updated_at)
        }))
        .sort((left, right) => String(left.id).localeCompare(String(right.id)))
    : [];

  const stateDigest = digestTrustSubjectValue({
    task_id: lineage.taskId,
    task_state: text(snapshot.task.state),
    task_blocker_code: text(snapshot.task.blocker_code),
    task_subject_id: uuid(snapshot.task.subject_id),
    task_updated_at: text(snapshot.task.updated_at),
    intake_id: lineage.intakeId,
    intake_identity_state: text(snapshot.intake.identity_state),
    intake_trust_state: text(snapshot.intake.trust_state),
    intake_subject_id: uuid(snapshot.intake.subject_id),
    intake_updated_at: text(snapshot.intake.updated_at),
    source_candidate_id: lineage.sourceCandidateId,
    source_candidate_updated_at: text(snapshot.candidate.updated_at),
    catalog_context_digest: catalogContextDigest,
    sibling_tasks: taskStates
  });

  const proposalDigest = digestTrustSubjectValue({
    version: TRUST_SUBJECT_PROPOSAL_VERSION,
    reviewed_identity: reviewedIdentity,
    payload
  });

  return {
    version: TRUST_SUBJECT_PROPOSAL_VERSION,
    taskId: lineage.taskId,
    intakeId: lineage.intakeId,
    productId: lineage.productId,
    sourceCandidateId: lineage.sourceCandidateId,
    reviewedIdentity,
    semanticIdentity,
    payload,
    proposalDigest,
    stateDigest,
    catalogContextDigest,
    preflightHash: digestTrustSubjectValue({
      proposal_digest: proposalDigest,
      state_digest: stateDigest
    }),
    catalogIdentityIsProductFactAuthority: false,
    requiresExplicitConfirmation: true,
    automaticRegistration: false
  };
}

function candidateValue(snapshot, key) {
  return snapshot?.candidate?.[key] ?? null;
}
