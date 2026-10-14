// S2 evaluator only. Observe an existing canonical decision bundle; never create recommendations.
export const SKIN_PROVENANCE_AUDIT_VERSION = "skin-decision-provenance-audit-v1";
const AXES = Object.freeze(["barrier", "redness", "dehydration", "oiliness", "acne", "pores", "uneven_tone", "uv"]);
const BAD_PHOTO = new Set(["unavailable", "ineligible", "insufficient_evidence", "not_provided"]);
const KNOWN_CONF = new Set(["medium", "high"]);
function record(x) { return Boolean(x) && typeof x === "object" && !Array.isArray(x); }
function text(x) { return typeof x === "string" ? x.trim() : ""; }
function getPhotoScore(scores, axis) {
  const raw = scores?.[axis];
  if (!record(raw)) return null;
  const n = raw.photo;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : null;
}
function signalsFor(photoObservations = {}) {
  const rows = Array.isArray(photoObservations?.signals) ? photoObservations.signals : [];
  return rows.filter(x => record(x) && text(x.key));
}
function add(findings, code, severity, evidencePaths) {
  findings.push({ code, severity, evidencePaths });
}
export function inspectSkinDecisionProvenance(report = {}) {
  if (!record(report)) throw new Error("report_invalid");
  const ctx = report?.decisionBundle?.context || {};
  const photo = ctx.photo || {};
  const explicit = report.photoEvidenceState || report.freeResult?.photoEvidenceState || {};
  const explicitStatus = text(explicit.status);
  const canonicalStatus = text(photo.status);
  const photoObservations = report.photoObservations || report.freeResult?.photoObservations || null;
  const align = text(photoObservations?.surveyAlignment?.status).toLowerCase();
  const canonicalAlignment = text(ctx.concernState?.surveyPhotoAlignment).toLowerCase();
  const rawScores = report.scoring?.concernScores || report.freeResult?.scoring?.concernScores || {};
  const findings = [];
  if (BAD_PHOTO.has(explicitStatus) && canonicalStatus === "available") {
    add(findings, "PHOTO_FAILURE_PROMOTED_AVAILABLE", "P0",
      ["photoEvidenceState.status", "decisionBundle.context.photo.status"]);
  }
  if (BAD_PHOTO.has(explicitStatus) && photo.evidenceAvailable === true) {
    add(findings, "FALLBACK_COUNTS_AS_PHOTO_EVIDENCE", "P0",
      ["photoEvidenceState.status", "decisionBundle.context.photo.evidenceAvailable"]);
  }
  if (align === "mixed" && canonicalAlignment !== "partial") {
    add(findings, "MIXED_ALIGNMENT_LOST", "P1",
      ["photoObservations.surveyAlignment.status", "decisionBundle.context.concernState.surveyPhotoAlignment"]);
  }
  if (align === "conflict" && canonicalAlignment === "unknown" && explicitStatus === "available") {
    add(findings, "PHOTO_SURVEY_CONFLICT_LOST", "P1",
      ["photoObservations.surveyAlignment.status", "decisionBundle.context.concernState.surveyPhotoAlignment"]);
  }
  const observations = signalsFor(photoObservations);
  for (const axis of AXES) {
    const photoScore = getPhotoScore(rawScores, axis);
    if (photoScore === null || photoScore === 0) continue;
    const evidence = observations.filter(row => row.key === axis);
    if (!evidence.length) {
      add(findings, "PHOTO_SCORE_WITHOUT_AXIS_CUE:" + axis, "P0",
        ["freeResult.scoring.concernScores." + axis + ".photo", "photoObservations.signals"]);
    } else if (!evidence.some(row => KNOWN_CONF.has(text(row.confidence)))) {
      add(findings, "PHOTO_SCORE_LOW_AXIS_CONFIDENCE:" + axis, "P0",
        ["freeResult.scoring.concernScores." + axis + ".photo", "photoObservations.signals." + axis]);
    }
    if (BAD_PHOTO.has(explicitStatus)) {
      add(findings, "PHOTO_SCORE_WHEN_UNAVAILABLE:" + axis, "P0",
        ["photoEvidenceState.status", "freeResult.scoring.concernScores." + axis + ".photo"]);
    }
  }
  const consistency = report.consistency || report.decisionBundle?.consistency || {};
  const critical = (consistency.violations || []).some(v => v?.severity === "critical");
  const policySource = text(report.effectivePolicySource || report.decisionBundle?.effectivePolicySource);
  if (critical && policySource === "raw") {
    add(findings, "CRITICAL_CONSISTENCY_RAW_POLICY", "P0",
      ["decisionBundle.consistency", "decisionBundle.effectivePolicySource"]);
  }
  const exposure = ctx.productExposureState || {};
  const unknownIds = new Set((exposure.rows || []).filter(r =>
    ["not_in_db", "unanswered"].includes(r?.sourceState) || (r?.sourceState === "selected" && r?.evaluable === false)
  ).map(r => String(r.productId || "")));
  const actions = report.routineProductActions || report.decisionBundle?.routineProductActions || [];
  for (const item of actions) {
    if (unknownIds.has(String(item?.productId || "")) && ["stop", "replace", "remove"].includes(item?.action)) {
      add(findings, "UNKNOWN_PRODUCT_FORCED_STOP", "P0",
        ["decisionBundle.context.productExposureState.rows", "decisionBundle.routineProductActions"]);
      break;
    }
  }
  findings.sort((a, b) => a.code.localeCompare(b.code));
  return {
    version: SKIN_PROVENANCE_AUDIT_VERSION,
    status: findings.length ? "REVIEW_REQUIRED" : "NO_FLAGGED_INVARIANT",
    findingCount: findings.length,
    findings,
    disclosure: {
      noFindingDoesNotProveSkinAccuracy: true,
      sourceOnlyDiagnostics: true,
      evidenceNotTruth: true,
      existingPolicyUnchanged: true,
      releaseAuthorized: false
    }
  };
}
