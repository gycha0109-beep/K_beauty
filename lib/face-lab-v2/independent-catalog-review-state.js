export const FACE_LAB_CATALOG_REVIEW_STATE_VERSION =
  "face-lab-independent-catalog-review-state-v1";

export const FACE_LAB_CATALOG_REVIEW_SCOPES = Object.freeze([
  "item", "variant", "shade", "capability", "asset"
]);

const SCOPES = new Set(FACE_LAB_CATALOG_REVIEW_SCOPES);
const STATES = new Set([
  "draft", "in_review", "approved", "published",
  "rejected", "suspended", "revoked"
]);
const ROLES = Object.freeze({
  submit: "editor",
  revise: "editor",
  approve: "reviewer",
  reject: "reviewer",
  publish: "publisher",
  suspend: "publisher",
  revoke: "publisher",
  reopen: "publisher"
});
const VALID_ACTIONS = Object.freeze({
  draft: new Set(["submit", "revise"]),
  in_review: new Set(["approve", "reject"]),
  rejected: new Set(["revise"]),
  approved: new Set(["publish", "revise", "revoke"]),
  published: new Set(["revise", "suspend", "revoke"]),
  suspended: new Set(["reopen", "revoke"]),
  revoked: new Set(["reopen"])
});
const TARGET = /^[a-z0-9][a-z0-9._-]*:[a-z0-9][a-z0-9._:-]*$/;
const EVIDENCE = /^[a-z0-9][a-z0-9._-]*:[^\s]+$/i;
const MAX_HISTORY = 256;

function object(value) {
  return value !== null && typeof value === "object" &&
    !Array.isArray(value);
}
function id(value) {
  return typeof value === "string" &&
    value.length > 0 && value.length <= 300 &&
    TARGET.test(value);
}
function actor(value) {
  return typeof value === "string" &&
    /^[a-z0-9][a-z0-9._-]{0,119}$/i.test(value);
}
function refs(value) {
  return Array.isArray(value) && value.length >= 1 &&
    value.length <= 32 &&
    value.every(x => typeof x === "string" && x.length <= 300 &&
      EVIDENCE.test(x)) &&
    new Set(value).size === value.length;
}
function issue(reason) {
  return {
    status: "blocked", reason, record: null,
    governedSourceVerified: false, renderReady: false,
    providerRequest: null, imageModelInvoked: false
  };
}

export function createFaceLabCatalogReviewRecord({
  scope, targetRef, contentRevision = 1
} = {}) {
  if (!SCOPES.has(scope) || !id(targetRef) ||
      !Number.isSafeInteger(contentRevision) || contentRevision < 1) {
    return issue("review_identity_invalid");
  }
  return {
    reviewVersion: FACE_LAB_CATALOG_REVIEW_STATE_VERSION,
    scope,
    targetRef,
    status: "draft",
    revision: 0,
    contentRevision,
    approvedContentRevision: null,
    publishedContentRevision: null,
    revocationEpoch: 0,
    submittedBy: null,
    approvedBy: null,
    reviewedEvidenceRefs: [],
    history: []
  };
}

/**
 * Structural check only. An untrusted caller can forge the entire record,
 * audit history and actorRole. Never use this as live authorization.
 */
export function inspectFaceLabCatalogReviewRecord(record) {
  if (!object(record) ||
      record.reviewVersion !== FACE_LAB_CATALOG_REVIEW_STATE_VERSION ||
      !SCOPES.has(record.scope) || !id(record.targetRef) ||
      !STATES.has(record.status) ||
      !Number.isSafeInteger(record.revision) || record.revision < 0 ||
      !Number.isSafeInteger(record.contentRevision) ||
      record.contentRevision < 1 ||
      !Number.isSafeInteger(record.revocationEpoch) ||
      record.revocationEpoch < 0 ||
      !Array.isArray(record.history) ||
      record.history.length !== record.revision ||
      record.history.length > MAX_HISTORY ||
      !Array.isArray(record.reviewedEvidenceRefs)) {
    return { valid: false, reason: "review_record_invalid" };
  }
  if (!record.history.every((entry, index) =>
    object(entry) && entry.revision === index + 1 &&
    typeof entry.action === "string" && Object.hasOwn(ROLES, entry.action) &&
    STATES.has(entry.nextState) &&
    actor(entry.actorId) &&
    entry.actorRole === ROLES[entry.action] &&
    Number.isSafeInteger(entry.contentRevision) &&
    entry.contentRevision >= 1)) {
    return { valid: false, reason: "review_history_invalid" };
  }
  if (
    record.history.length &&
    (record.history.at(-1).nextState !== record.status ||
      record.history.at(-1).contentRevision !== record.contentRevision)
  ) {
    return { valid: false, reason: "review_history_mismatch" };
  }
  const published = record.status === "published";
  const approved = record.status === "approved" || published;
  if (approved &&
      (record.approvedContentRevision !== record.contentRevision ||
        (published && record.publishedContentRevision !== record.contentRevision) ||
        !actor(record.approvedBy) || !refs(record.reviewedEvidenceRefs))) {
    return { valid: false, reason: "review_publication_snapshot_invalid" };
  }
  if (!approved &&
      (record.approvedContentRevision !== null ||
        record.publishedContentRevision !== null ||
        record.approvedBy !== null ||
        record.reviewedEvidenceRefs.length !== 0)) {
    return { valid: false, reason: "review_stale_approval_detected" };
  }
  if (record.revision === 0 && record.status !== "draft") {
    return { valid: false, reason: "review_history_missing" };
  }
  return { valid: true, reason: null };
}

export function transitionFaceLabCatalogReview({
  record, expectedRevision, action
} = {}) {
  const inspected = inspectFaceLabCatalogReviewRecord(record);
  if (!inspected.valid) return issue(inspected.reason);
  if (!Number.isSafeInteger(expectedRevision) ||
      expectedRevision !== record.revision) {
    return issue("review_revision_conflict");
  }
  if (!object(action) || !Object.hasOwn(ROLES, action.type) ||
      !actor(action.actorId) ||
      action.actorRole !== ROLES[action.type]) {
    return issue("review_actor_or_action_invalid");
  }
  if (!VALID_ACTIONS[record.status].has(action.type)) {
    return issue("review_transition_forbidden");
  }
  if (record.revision >= MAX_HISTORY) {
    return issue("review_history_limit");
  }
  if ((action.type === "approve") && !refs(action.evidenceRefs)) {
    return issue("review_evidence_missing");
  }
  if (["reject", "suspend", "revoke", "reopen"].includes(action.type) &&
      (typeof action.reason !== "string" ||
        action.reason.trim().length < 4 || action.reason.length > 240)) {
    return issue("review_reason_required");
  }
  if (action.type === "publish" &&
      (record.approvedContentRevision !== record.contentRevision ||
        !refs(record.reviewedEvidenceRefs))) {
    return issue("review_approval_stale");
  }
  const next = structuredClone(record);
  const { type } = action;
  if (type === "submit") {
    next.status = "in_review";
    next.submittedBy = action.actorId;
  } else if (type === "approve") {
    next.status = "approved";
    next.approvedBy = action.actorId;
    next.approvedContentRevision = next.contentRevision;
    next.reviewedEvidenceRefs = [...action.evidenceRefs];
  } else if (type === "publish") {
    next.status = "published";
    next.publishedContentRevision = next.contentRevision;
  } else if (type === "revoke" || type === "suspend") {
    next.status = type === "revoke" ? "revoked" : "suspended";
    next.revocationEpoch += 1;
    next.approvedContentRevision = null;
    next.publishedContentRevision = null;
    next.approvedBy = null;
    next.reviewedEvidenceRefs = [];
  } else if (type === "revise" || type === "reopen" || type === "reject") {
    next.status = type === "reject" ? "rejected" : "draft";
    if (type === "revise") next.contentRevision += 1;
    if (type === "revise" && record.status === "published") {
      next.revocationEpoch += 1;
    }
    next.approvedContentRevision = null;
    next.publishedContentRevision = null;
    next.approvedBy = null;
    next.reviewedEvidenceRefs = [];
    next.submittedBy = null;
  }
  next.revision++;
  next.history.push({
    revision: next.revision,
    action: type,
    actorId: action.actorId,
    actorRole: action.actorRole,
    contentRevision: next.contentRevision,
    nextState: next.status,
    ...(typeof action.reason === "string" ? { reason: action.reason } : {})
  });
  const verdict = inspectFaceLabCatalogReviewRecord(next);
  if (!verdict.valid) return issue(verdict.reason);
  return {
    status: "accepted", reason: "review_transition_recorded", record: next,
    governedSourceVerified: false, renderReady: false,
    providerRequest: null, imageModelInvoked: false
  };
}
