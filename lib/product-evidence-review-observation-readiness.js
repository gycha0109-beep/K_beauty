export const REVIEW_OBSERVATION_READINESS_VERSION =
  "product-evidence-review-observation-readiness-v1";

export const REVIEW_OBSERVATION_TARGETS = Object.freeze({
  eye_sting_observed: Object.freeze({
    occurrenceLabels: Object.freeze(["눈통증있는"]),
    explicitAbsenceLabels: Object.freeze(["눈통증없는"])
  }),
  white_cast_observed: Object.freeze({
    occurrenceLabels: Object.freeze(["백탁있는"]),
    explicitAbsenceLabels: Object.freeze(["백탁없는"])
  })
});

const TARGET_FACT_KEYS = Object.freeze(Object.keys(REVIEW_OBSERVATION_TARGETS));
const SHA256_RE = /^[0-9a-f]{64}$/i;

function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function number(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

function reviewRaw(item) {
  return item?.raw?.review_raw ?? item?.review_raw ?? null;
}

function reviewEntries(item) {
  const raw = reviewRaw(item);
  if (!raw || typeof raw !== "object") return [];

  return ["positive", "negative"].flatMap((bucket) => {
    const entries = Array.isArray(raw[bucket]) ? raw[bucket] : [];
    return entries.flatMap((entry) => {
      if (!Array.isArray(entry) || entry.length < 2) return [];
      const label = text(entry[0]);
      if (!label) return [];
      return [{ bucket, label, count: number(entry[1]) }];
    });
  });
}

function sumLabels(entries, labels) {
  const allowed = new Set(labels);
  return entries.reduce((sum, entry) => sum + (allowed.has(entry.label) ? entry.count : 0), 0);
}

function matchingLabels(entries, labels) {
  const allowed = new Set(labels);
  return entries
    .filter((entry) => allowed.has(entry.label) && entry.count > 0)
    .map((entry) => Object.freeze({ label: entry.label, count: entry.count }));
}

function sourceObject(item) {
  const candidates = [item?.capture_source, item?.captureSource, item?.source_provenance, item?.sourceProvenance];
  return candidates.find((candidate) => candidate && typeof candidate === "object" && !Array.isArray(candidate)) ?? null;
}

export function extractReviewCaptureProvenance(item) {
  const source = sourceObject(item);
  const canonicalLocator = text(source?.canonical_locator ?? source?.canonicalLocator);
  const publisher = text(source?.publisher);
  const sourceKind = text(source?.source_kind ?? source?.sourceKind);
  const contentDigest = text(source?.content_digest ?? source?.contentDigest)?.toLowerCase() ?? null;
  const observedAt = text(
    source?.observed_at ?? source?.observedAt ?? source?.accessed_at ?? source?.accessedAt
  );

  return Object.freeze({
    canonicalLocator,
    publisher,
    sourceKind,
    contentDigest: contentDigest && SHA256_RE.test(contentDigest) ? contentDigest : null,
    observedAt
  });
}

function subjectUsable(subject) {
  return Boolean(
    text(subject?.subject_id ?? subject?.subjectId) &&
      subject?.identity_status === "resolved" &&
      subject?.current_state === "current"
  );
}

function buildTargetReadiness(item, factKey, subject) {
  const target = REVIEW_OBSERVATION_TARGETS[factKey];
  const entries = reviewEntries(item);
  const occurrenceCount = sumLabels(entries, target.occurrenceLabels);
  const explicitAbsenceCount = sumLabels(entries, target.explicitAbsenceLabels);
  const occurrenceMatches = matchingLabels(entries, target.occurrenceLabels);
  const explicitAbsenceMatches = matchingLabels(entries, target.explicitAbsenceLabels);
  const directObservationPresent = occurrenceCount > 0 || explicitAbsenceCount > 0;
  const directObservationConflict = occurrenceCount > 0 && explicitAbsenceCount > 0;
  const candidateValue = directObservationConflict
    ? null
    : occurrenceCount > 0
      ? true
      : explicitAbsenceCount > 0
        ? false
        : null;
  const provenance = extractReviewCaptureProvenance(item);
  const blockers = [];

  if (!directObservationPresent) blockers.push("blocked_missing_direct_observation_label");
  if (directObservationConflict) blockers.push("blocked_conflicting_direct_observation_labels");
  if (!provenance.canonicalLocator) blockers.push("blocked_missing_capture_locator");
  if (!provenance.publisher) blockers.push("blocked_missing_capture_publisher");
  if (!provenance.sourceKind) blockers.push("blocked_missing_capture_source_kind");
  if (!provenance.contentDigest) blockers.push("blocked_missing_capture_digest");
  if (!provenance.observedAt) blockers.push("blocked_missing_capture_timestamp");
  if (!subjectUsable(subject)) blockers.push("blocked_unresolved_current_subject");

  const eligibleForGovernedEvidenceReview = blockers.length === 0;

  return Object.freeze({
    factKey,
    candidateValue,
    directObservationPresent,
    directObservationConflict,
    occurrenceMatches: Object.freeze(occurrenceMatches),
    explicitAbsenceMatches: Object.freeze(explicitAbsenceMatches),
    keywordCountSemantics: "directional_aggregate_only",
    prevalenceAuthorized: false,
    prevalenceDenominator: null,
    independentSupport: "unresolved",
    evidenceAuthorityCeiling: "review_observation",
    provenance,
    subjectId: subjectUsable(subject) ? text(subject?.subject_id ?? subject?.subjectId) : null,
    eligibleForGovernedEvidenceReview,
    disposition: eligibleForGovernedEvidenceReview
      ? "eligible_for_governed_evidence_review"
      : "blocked",
    blockers: Object.freeze(blockers)
  });
}

export function buildReviewObservationReadiness(item, { subject = null } = {}) {
  const productId = text(item?.productId ?? item?.product_id);
  const targets = TARGET_FACT_KEYS.map((factKey) => buildTargetReadiness(item, factKey, subject));

  return Object.freeze({
    readinessVersion: REVIEW_OBSERVATION_READINESS_VERSION,
    productId,
    productName: text(item?.productName ?? item?.product_name),
    category: text(item?.category),
    targets: Object.freeze(targets)
  });
}

export function summarizeReviewObservationReadiness(rows) {
  const summary = {
    products: rows.length,
    targets: 0,
    directObservationTargets: 0,
    eligibleTargets: 0,
    blockedTargets: 0,
    blockerCounts: {},
    byFactKey: {}
  };

  for (const row of rows) {
    for (const target of row.targets ?? []) {
      summary.targets += 1;
      if (target.directObservationPresent) summary.directObservationTargets += 1;
      if (target.eligibleForGovernedEvidenceReview) summary.eligibleTargets += 1;
      else summary.blockedTargets += 1;

      if (!summary.byFactKey[target.factKey]) {
        summary.byFactKey[target.factKey] = {
          directObservationTargets: 0,
          eligibleTargets: 0,
          blockedTargets: 0
        };
      }

      const bucket = summary.byFactKey[target.factKey];
      if (target.directObservationPresent) bucket.directObservationTargets += 1;
      if (target.eligibleForGovernedEvidenceReview) bucket.eligibleTargets += 1;
      else bucket.blockedTargets += 1;

      for (const blocker of target.blockers) {
        summary.blockerCounts[blocker] = (summary.blockerCounts[blocker] ?? 0) + 1;
      }
    }
  }

  return Object.freeze(summary);
}
