// Evaluation-only, input-data agnostic. No provider, image IO, storage, or production imports.
export const SKIN_CUE_EVAL_VERSION = "skin-cue-evaluation-v1";
export const SKIN_CUE_AXES = Object.freeze([
  "oiliness", "dehydration", "acne", "uneven_tone", "pores", "redness", "barrier"
]);
export const SKIN_CAPTURE_TAGS = Object.freeze([
  "baseline", "low_light", "strong_glare", "white_balance_shift", "angle_change",
  "makeup_present", "filter_suspected", "skin_occluded", "low_resolution",
  "different_device", "controlled_repeat"
]);

const AXES = new Set(SKIN_CUE_AXES);
const TAGS = new Set(SKIN_CAPTURE_TAGS);
const IDENTIFIER = /^[A-Za-z0-9_-]{1,64}$/;
const ASSESSABILITY = new Set(["assessable", "not_assessable", "ambiguous"]);
const REFERENCE = new Set(["present", "absent"]);
const PREDICTION = new Set(["present", "absent", "abstain"]);
const CONFIDENCE = new Set(["low", "medium", "high", "unknown"]);
const FAMILIES = new Set(["synthetic", "human_review"]);
const CASE_KEYS = new Set(["caseId", "subjectGroupId", "captureTags", "signals"]);
const RECORD_KEYS = new Set(["reference", "prediction"]);
const REFERENCE_KEYS = new Set(["assessability", "cue"]);
const PREDICTION_KEYS = new Set(["cue", "confidence", "rawScore"]);

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function requireKeys(value, keys, where) {
  if (!isRecord(value)) throw new Error(where + "_not_object");
  const unexpected = Object.keys(value).filter((key) => !keys.has(key));
  if (unexpected.length) throw new Error(where + "_unknown_keys:" + unexpected.join(","));
}
function identifier(value, where) {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) throw new Error(where + "_invalid_identifier");
  return value;
}
function finiteMetric(numerator, denominator) {
  return denominator > 0 ? Number((numerator / denominator).toFixed(6)) : null;
}
function blankCounts() {
  return {
    rows: 0, referenceAssessable: 0, referenceNotAssessable: 0, referenceAmbiguous: 0,
    tp: 0, tn: 0, fp: 0, fn: 0, abstainedAssessable: 0, nonAbstainedWithoutReference: 0,
    highConfidenceWithoutReference: 0
  };
}
function addObservation(counts, signal) {
  counts.rows++;
  const ref = signal.reference;
  const pred = signal.prediction;
  if (ref.assessability !== "assessable") {
    if (ref.assessability === "ambiguous") counts.referenceAmbiguous++;
    else counts.referenceNotAssessable++;
    if (pred.cue !== "abstain") {
      counts.nonAbstainedWithoutReference++;
      if (pred.confidence === "high") counts.highConfidenceWithoutReference++;
    }
    return;
  }
  counts.referenceAssessable++;
  if (pred.cue === "abstain") {
    counts.abstainedAssessable++;
    return;
  }
  if (ref.cue === "present" && pred.cue === "present") counts.tp++;
  else if (ref.cue === "absent" && pred.cue === "absent") counts.tn++;
  else if (ref.cue === "absent" && pred.cue === "present") counts.fp++;
  else counts.fn++;
}
function summary(counts) {
  const decided = counts.tp + counts.tn + counts.fp + counts.fn;
  return {
    ...counts,
    assessableCoverage: finiteMetric(decided, counts.referenceAssessable),
    assessableAbstainRate: finiteMetric(counts.abstainedAssessable, counts.referenceAssessable),
    precision: finiteMetric(counts.tp, counts.tp + counts.fp),
    recall: finiteMetric(counts.tp, counts.tp + counts.fn),
    falsePositiveRate: finiteMetric(counts.fp, counts.fp + counts.tn),
    falseNegativeRate: finiteMetric(counts.fn, counts.fn + counts.tp),
    referenceUnknownRate: finiteMetric(
      counts.referenceNotAssessable + counts.referenceAmbiguous,
      counts.rows
    ),
    unsupportedAssertionRate: finiteMetric(
      counts.nonAbstainedWithoutReference,
      counts.referenceNotAssessable + counts.referenceAmbiguous
    )
  };
}

export function validateSkinCueEvaluationManifest(manifest) {
  requireKeys(manifest,
    new Set(["schemaVersion", "datasetId", "evidenceFamily", "cases"]),
    "manifest");
  if (manifest.schemaVersion !== SKIN_CUE_EVAL_VERSION) throw new Error("manifest_schema_version");
  identifier(manifest.datasetId, "datasetId");
  if (!FAMILIES.has(manifest.evidenceFamily)) throw new Error("evidence_family_invalid");
  if (!Array.isArray(manifest.cases) || manifest.cases.length === 0 || manifest.cases.length > 10000) {
    throw new Error("cases_count_invalid");
  }
  const caseIds = new Set();
  return {
    schemaVersion: SKIN_CUE_EVAL_VERSION,
    datasetId: manifest.datasetId,
    evidenceFamily: manifest.evidenceFamily,
    cases: manifest.cases.map((item, index) => {
      requireKeys(item, CASE_KEYS, "case_" + index);
      const caseId = identifier(item.caseId, "caseId");
      if (caseIds.has(caseId)) throw new Error("case_duplicate:" + caseId);
      caseIds.add(caseId);
      identifier(item.subjectGroupId, "subjectGroupId");
      if (!Array.isArray(item.captureTags) || item.captureTags.length === 0 ||
          item.captureTags.length > SKIN_CAPTURE_TAGS.length ||
          new Set(item.captureTags).size !== item.captureTags.length ||
          !item.captureTags.every((tag) => TAGS.has(tag))) {
        throw new Error("capture_tags_invalid:" + caseId);
      }
      if (!isRecord(item.signals) || !Object.keys(item.signals).length ||
          !Object.keys(item.signals).every((axis) => AXES.has(axis))) {
        throw new Error("signals_invalid:" + caseId);
      }
      const signals = {};
      for (const [axis, signal] of Object.entries(item.signals)) {
        requireKeys(signal, RECORD_KEYS, "signal_" + axis);
        requireKeys(signal.reference, REFERENCE_KEYS, "reference_" + axis);
        requireKeys(signal.prediction, PREDICTION_KEYS, "prediction_" + axis);
        const r = signal.reference, p = signal.prediction;
        if (!ASSESSABILITY.has(r.assessability)) throw new Error("assessability_invalid:" + axis);
        if (r.assessability === "assessable" ? !REFERENCE.has(r.cue) : r.cue !== null) {
          throw new Error("reference_cue_invalid:" + axis);
        }
        if (!PREDICTION.has(p.cue) || !CONFIDENCE.has(p.confidence)) {
          throw new Error("prediction_invalid:" + axis);
        }
        if (p.rawScore !== null && !(Number.isInteger(p.rawScore) && p.rawScore >= 0 && p.rawScore <= 5)) {
          throw new Error("raw_score_invalid:" + axis);
        }
        signals[axis] = { reference: { ...r }, prediction: { ...p } };
      }
      return {
        caseId,
        subjectGroupId: item.subjectGroupId,
        captureTags: [...item.captureTags],
        signals
      };
    })
  };
}

export function evaluateSkinCues(input) {
  const manifest = validateSkinCueEvaluationManifest(input);
  const axisBuckets = Object.fromEntries(SKIN_CUE_AXES.map((axis) => [axis, blankCounts()]));
  const strata = {};
  let observations = 0;
  for (const item of manifest.cases) {
    for (const [axis, signal] of Object.entries(item.signals)) {
      observations++;
      addObservation(axisBuckets[axis], signal);
      for (const tag of item.captureTags) {
        if (!strata[tag]) strata[tag] = {};
        if (!strata[tag][axis]) strata[tag][axis] = blankCounts();
        addObservation(strata[tag][axis], signal);
      }
    }
  }
  return {
    version: SKIN_CUE_EVAL_VERSION,
    status: "DIAGNOSTIC_ONLY",
    datasetId: manifest.datasetId,
    evidenceFamily: manifest.evidenceFamily,
    count: { cases: manifest.cases.length, observations },
    axes: Object.fromEntries(Object.entries(axisBuckets).map(([k, v]) => [k, summary(v)])),
    strata: Object.fromEntries(Object.entries(strata).sort(([a], [b]) => a.localeCompare(b)).map(
      ([tag, counts]) => [tag, Object.fromEntries(Object.entries(counts).map(([axis, value]) => [axis, summary(value)]))]
    )),
    meaning: {
      referenceNotAssessableExcludedFromAccuracy: true,
      absentNotInferredFromZeroScore: true,
      noClinicalDiagnosis: true,
      productionActivationAuthorized: false,
      realPhotoAccuracyCertified: false
    }
  };
}
