// S1-B evaluation-only candidate. NOT used by the active Provider, Analyze route,
// recommendation scoring, persistence or Style Track. No network or image calls.
import {
  createImageAnalysisEligibilityPromptContract,
  createImageAnalysisEligibilityRules,
  normalizeImageAnalysisEligibility
} from "../../../lib/image-analysis-eligibility.js";
import {
  createFaceLabObservationPromptContract,
  createFaceLabObservationPromptRules,
  buildFaceLabObservationAnalysis
} from "../../../lib/face-lab-observation-contract.js";
import {
  createVisionObservationPrompt,
  VISION_OBSERVATION_SCHEMA_VERSION
} from "../../../lib/vision-observation-contract.js";
import { normalizeVisionObservationBundle } from "../../../lib/vision-observation-normalizer.js";
import {
  SKIN_VISIBLE_AXES,
  SKIN_AXIS_EVIDENCE_VERSION,
  assessSkinAxisEvidence
} from "./skin-axis-evidence-contract-core.mjs";

export const SKIN_VISION_V2_CANDIDATE_VERSION = "vision-observation-v2";
const CUES = Object.freeze({
  oiliness: "surface_shine", dehydration: "dry_texture | visible_flaking",
  acne: "active_spots", uneven_tone: "tone_variation",
  pores: "pore_visibility", redness: "red_appearance",
  barrier: "surface_stress | dry_texture | visible_flaking"
});
const AREAS = "full_face | t_zone | forehead | nose | cheeks | chin | jawline | eye_area";
const TOP_KEYS = new Set(["schemaVersion", "eligibility", "skin", "face"]);
const SKIN_KEYS = new Set(["axisEvidence"]);
function record(x) { return x !== null && typeof x === "object" && !Array.isArray(x); }
function unexpectedKeys(obj, allowed) {
  return record(obj) && Object.keys(obj).some(key => !allowed.has(key));
}
function candidateSkinPrompt() {
  return {
    axisEvidence: SKIN_VISIBLE_AXES.map(axis => ({
      axis,
      state: "present | not_seen | unassessable | unknown",
      value: "integer 1-5 present; 0 not_seen; null otherwise",
      confidence: "low | medium | high present; medium | high not_seen; unknown otherwise",
      cue: CUES[axis] + " (null otherwise)",
      area: AREAS + " (null otherwise)",
      reason: "none present/not_seen; blur | occlusion | lighting | makeup | filter | low_resolution | unsupported unassessable; missing | unsupported unknown"
    }))
  };
}

/** Candidate prompt is built offline; the production v1 prompt stays unchanged. */
export function createSkinVisionV2CandidatePrompt() {
  return [
    "Extract locale-neutral visible observations from ONE uploaded image.",
    "Return only JSON without markdown, unknown keys, images or identities.",
    "No survey, locale, products, medical diagnosis or user-facing recommendation.",
    "",
    "Required JSON shape:",
    "{",
    '  "schemaVersion": "' + SKIN_VISION_V2_CANDIDATE_VERSION + '",',
    "  " + createImageAnalysisEligibilityPromptContract() + ",",
    '  "skin": ' + JSON.stringify(candidateSkinPrompt(), null, 2) + ",",
    '  "face": ' + JSON.stringify(createFaceLabObservationPromptContract(), null, 2),
    "}",
    "",
    "Global rules:",
    "- One image only; Face and Skin are independent and must not share evidence.",
    "- Exactly seven Skin axes once each in the specified order. Do not output UV.",
    "- Do not include legacy numeric skin.signals or substitute 0 for unknown.",
    "- present: visible matching cue/area, integer 1-5 and low/medium/high confidence.",
    "- not_seen: clearly inspected matching area but no cue, value 0 and medium/high confidence.",
    "- unassessable: photo conditions prohibit judgment, value null, confidence unknown.",
    "- unknown: absent/unsupported evidence, value null, confidence unknown.",
    "- On unassessable/unknown, cue and area are null, reason uses the stated closed list.",
    "- Mark uncertainty for makeup, filters, blur, shadows, lighting or occlusion.",
    "- An unobserved cue does not prove a healthy skin condition.",
    "- Do not infer actual barrier function, hydration, acne disease or UV damage.",
    "",
    "Eligibility rules:",
    createImageAnalysisEligibilityRules(),
    "",
    "Face rules:",
    createFaceLabObservationPromptRules()
  ].join("\n").trim();
}

function gateFor(eligibility) {
  if (eligibility.source !== "vision") {
    return { photoStatus: "unknown", skinAnalysisEligible: false };
  }
  return {
    photoStatus: eligibility.skinAnalysisEligible
      ? "available"
      : eligibility.status === "ineligible" ? "ineligible" : "insufficient_evidence",
    skinAnalysisEligible: eligibility.skinAnalysisEligible === true
  };
}
function evaluation(skinEvidence, face, eligibility, classification, issues = []) {
  return {
    evaluationOnly: true,
    candidateVersion: SKIN_VISION_V2_CANDIDATE_VERSION,
    classification, eligibility, skinEvidence, face, issues,
    privacy: { sourceImagePersisted: false, rawProviderResponsePersisted: false },
    authority: {
      liveProviderEnabled: false,
      recommendationScoringActivated: false,
      faceContractModified: false,
      legacyPhotoZerosRecovered: false,
      humanPhotoValidationComplete: false
    }
  };
}

/** Offline, sanitized raw JSON test object only; v1 numeric zeros never imply observed absence. */
export function evaluateSkinVisionV2Candidate(parsed, options = {}) {
  if (record(parsed) && parsed.schemaVersion === VISION_OBSERVATION_SCHEMA_VERSION) {
    const old = normalizeVisionObservationBundle(parsed, options);
    const skin = assessSkinAxisEvidence(parsed, gateFor(old.eligibility));
    return evaluation(skin, old.face, old.eligibility, "legacy_v1_unverifiable",
      [{ code: "legacy_skin_zero_unverifiable" }]);
  }
  if (!record(parsed) || parsed.schemaVersion !== SKIN_VISION_V2_CANDIDATE_VERSION) {
    const fallback = normalizeVisionObservationBundle(null, options);
    return evaluation(
      assessSkinAxisEvidence(null, { photoStatus: "unknown", skinAnalysisEligible: false }),
      fallback.face, fallback.eligibility, "unknown_version_or_invalid_input",
      [{ code: "unrecognized_version_or_input" }]
    );
  }
  const eligibility = normalizeImageAnalysisEligibility(parsed.eligibility);
  const faceAnalysis = buildFaceLabObservationAnalysis(parsed.face, {
    eligibility, provider: options.provider || "openai",
    model: options.model || null,
    promptVersion: options.facePromptVersion || "vision-observation-prompt-v1"
  });
  const face = { status: faceAnalysis.status, analysis: faceAnalysis };
  const issues = [];
  if (unexpectedKeys(parsed, TOP_KEYS)) issues.push({ code: "unexpected_top_level_field" });
  if (!record(parsed.skin) || unexpectedKeys(parsed.skin, SKIN_KEYS)) {
    issues.push({ code: "skin_shape_invalid" });
  }
  // Use S1-A validator. Bad Skin rows cause HOLD, not failed Face projection.
  const manifest = record(parsed.skin) && !unexpectedKeys(parsed.skin, SKIN_KEYS)
    ? { schemaVersion: SKIN_AXIS_EVIDENCE_VERSION, axes: parsed.skin.axisEvidence }
    : null;
  const skinEvidence = assessSkinAxisEvidence(manifest, gateFor(eligibility));
  return evaluation(skinEvidence, face, eligibility,
    eligibility.source !== "vision" ? "invalid_eligibility" :
      issues.length || ["partial", "unsupported_schema"].includes(skinEvidence.status)
        ? "skin_partial_or_invalid" : "candidate_parsed",
    [...issues, ...skinEvidence.issues]);
}

export function measureSkinVisionV2CandidateFootprint() {
  const existing = createVisionObservationPrompt();
  const candidate = createSkinVisionV2CandidatePrompt();
  const minV1 = JSON.stringify({
    signals: Object.fromEntries([...SKIN_VISIBLE_AXES, "uv"].map(x => [x, 0])),
    observations: []
  }).length;
  const minV2 = JSON.stringify({
    axisEvidence: SKIN_VISIBLE_AXES.map(axis => ({
      axis, state: "unknown", value: null, confidence: "unknown",
      cue: null, area: null, reason: "missing"
    }))
  }).length;
  // Characters are not tokenizer measurements; cannot prove 2200-token safety.
  return {
    existingPromptCharacters: existing.length,
    candidatePromptCharacters: candidate.length,
    promptCharacterDelta: candidate.length - existing.length,
    minimalSyntheticV1SkinCharacters: minV1,
    minimalSyntheticV2SkinCharacters: minV2,
    minimalSkinCharacterDelta: minV2 - minV1,
    actualProviderTokensMeasured: false,
    currentProviderMaxCompletionTokens: 2200,
    safeToEnableProvider: false
  };
}
