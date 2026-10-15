// Skin S1 evaluation-only: blind reviewer disagreement on metadata labels.
// Never adjudicates labels, recognizes a person, or verifies clinical truth.
export const SKIN_ANNOTATION_AGREEMENT_VERSION = "skin-annotation-agreement-v1";
const AXES = new Set(["oiliness", "dehydration", "acne", "uneven_tone", "pores", "redness", "barrier"]);
const ASSESSABILITY = new Set(["assessable", "not_assessable", "ambiguous"]);
const CUES = new Set(["present", "absent"]);
const KEYS = new Set(["schemaVersion", "datasetId", "cases"]);
const CASE_KEYS = new Set(["caseId", "axis", "reviewerA", "reviewerB"]);
const REVIEW_KEYS = new Set(["assessability", "cue"]);
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const LABELS = ["present", "absent", "not_assessable", "ambiguous"];
function record(x) { return Boolean(x) && typeof x === "object" && !Array.isArray(x); }
function rejectExtra(value, allowed, where) {
  if (!record(value) || Object.keys(value).some(key => !allowed.has(key))) {
    throw new Error(where + "_unexpected_content");
  }
}
function decodeReviewer(data, where) {
  rejectExtra(data, REVIEW_KEYS, where);
  if (!ASSESSABILITY.has(data.assessability)) throw new Error(where + "_invalid_assessability");
  if (data.assessability === "assessable" ? !CUES.has(data.cue) : data.cue !== null) {
    throw new Error(where + "_cue_and_assessability_conflict");
  }
  return data.assessability === "assessable" ? data.cue : data.assessability;
}
function ratio(a, b) { return b ? Number((a / b).toFixed(6)) : null; }
function bucket() { return { rows: 0, exactMatches: 0, assessabilityDisagreements: 0,
  comparableCuePairs: 0, cueMatches: 0, cueDisagreements: 0, reviewedLabels: {} }; }
function runBucket(b, left, right) {
  b.rows++;
  if (left === right) b.exactMatches++;
  const leftAss = CUES.has(left), rightAss = CUES.has(right);
  if (leftAss !== rightAss) b.assessabilityDisagreements++;
  if (leftAss && rightAss) {
    b.comparableCuePairs++;
    if (left === right) b.cueMatches++;
    else b.cueDisagreements++;
  }
  for (const [side, label] of [["a", left], ["b", right]]) {
    const key = side + ":" + label;
    b.reviewedLabels[key] = (b.reviewedLabels[key] || 0) + 1;
  }
}
function summarize(b) {
  const a = Object.fromEntries(LABELS.map(label => [label, b.reviewedLabels["a:" + label] || 0]));
  const c = Object.fromEntries(LABELS.map(label => [label, b.reviewedLabels["b:" + label] || 0]));
  const pa = ratio(b.exactMatches, b.rows);
  const pe = b.rows
    ? LABELS.reduce((sum, label) => sum + (a[label] / b.rows) * (c[label] / b.rows), 0)
    : null;
  return {
    rows: b.rows, exactMatches: b.exactMatches,
    disagreements: b.rows - b.exactMatches,
    assessabilityDisagreements: b.assessabilityDisagreements,
    cueDisagreements: b.cueDisagreements,
    exactAgreement: pa,
    cueAgreementWhenBothAssessable: ratio(b.cueMatches, b.comparableCuePairs),
    kappa: pe === null || pa === null || 1 - pe < 1e-12
      ? null : Number(((pa - pe) / (1 - pe)).toFixed(6)),
    reviewerACounts: a, reviewerBCounts: c
  };
}
export function evaluateSkinAnnotationAgreement(manifest) {
  rejectExtra(manifest, KEYS, "manifest");
  if (manifest.schemaVersion !== SKIN_ANNOTATION_AGREEMENT_VERSION) {
    throw new Error("annotation_schema_version_invalid");
  }
  if (typeof manifest.datasetId !== "string" || !ID.test(manifest.datasetId)) {
    throw new Error("dataset_id_invalid");
  }
  if (!Array.isArray(manifest.cases) || manifest.cases.length < 1 || manifest.cases.length > 10000) {
    throw new Error("cases_count_invalid");
  }
  const seen = new Set(), perAxis = new Map(), overall = bucket(), disagreements = [];
  for (const row of manifest.cases) {
    rejectExtra(row, CASE_KEYS, "case");
    if (!ID.test(row.caseId || "") || !AXES.has(row.axis)) {
      throw new Error("case_identifier_or_axis_invalid");
    }
    const key = row.caseId + ":" + row.axis;
    if (seen.has(key)) throw new Error("duplicate_case_axis");
    seen.add(key);
    const a = decodeReviewer(row.reviewerA, "reviewerA");
    const b = decodeReviewer(row.reviewerB, "reviewerB");
    if (!perAxis.has(row.axis)) perAxis.set(row.axis, bucket());
    runBucket(perAxis.get(row.axis), a, b);
    runBucket(overall, a, b);
    if (a !== b) disagreements.push({ caseId: row.caseId, axis: row.axis, reason:
      CUES.has(a) !== CUES.has(b) ? "assessability_disagreement" :
      CUES.has(a) && CUES.has(b) ? "visual_cue_disagreement" : "unassessable_type_disagreement" });
  }
  disagreements.sort((a, b) => a.caseId.localeCompare(b.caseId) || a.axis.localeCompare(b.axis));
  return {
    version: SKIN_ANNOTATION_AGREEMENT_VERSION,
    status: disagreements.length ? "INDEPENDENT_ADJUDICATION_REQUIRED" : "AGREEMENT_OBSERVED_ONLY",
    datasetId: manifest.datasetId,
    overall: summarize(overall),
    byAxis: Object.fromEntries([...perAxis].sort(([a], [b]) => a.localeCompare(b))
      .map(([axis, counts]) => [axis, summarize(counts)])),
    disagreements,
    authority: {
      missingReviewerTruthCannotBeInferred: true,
      annotationAgreementIsNotAccuracy: true,
      independentBlindingVerified: false,
      humanAdjudicationCompleted: false,
      clinicalValidityCertified: false,
      productionActivationAuthorized: false
    }
  };
}
