import assert from "node:assert/strict";
import { buildPremiumDecisionState, rebuildPremiumDecisionState } from "../lib/premium-decision-state.js";
import { buildPremiumSessionReportSource } from "../lib/premium-session-payload.js";
import { buildRotatedPremiumReportPayload } from "../lib/premium-report-reentry.js";
import { buildPremiumReportSnapshot, classifyPremiumSnapshotReplay } from "../lib/premium-report-snapshot.js";
import { canonicalizeAnonymousResultForPersistence } from "../lib/security/anonymous-write-grant-core.js";
import { SHARED_SKIN_DECISION_CONTEXT_VERSION } from "../lib/shared-skin-decision-context-v4.js";

const photoEvidenceState = {
  status: "unavailable",
  source: "vision",
  failureReason: "provider_timeout",
  failureClass: "provider_failure",
  analysisEligible: false
};
const imageEligibility = {
  status: "eligible",
  source: "vision",
  imageType: "photorealistic_human",
  humanFaceCount: 1,
  faceLabEligible: true,
  skinAnalysisEligible: true,
  faceLabFailureReason: null,
  skinFailureReason: null,
  confidence: 0.95,
  evidence: ["one photorealistic human face is visible"]
};
const input = {
  locale: "ko",
  freeResult: {
    priority: { axis: "redness", score: 24 },
    scoring: {
      concernScores: {
        barrier: { total: 10 }, redness: { total: 24 }, dehydration: { total: 8 },
        oiliness: { total: 4 }, acne: { total: 5 }, pores: { total: 3 },
        uneven_tone: { total: 2 }, uv: { total: 6 }
      }
    },
    answers: {
      skinType: "combination",
      sensitivity: "high",
      mainConcern: "redness",
      mainConcerns: ["redness"],
      recentSkinChange: "no",
      recentlyChangedProduct: "no",
      productReaction: "no",
      postWashFeeling: "comfortable",
      afternoonSkinChange: "red_or_irritated",
      environmentExposure: []
    },
    photoEvidenceState,
    imageEligibility
  },
  photoEvidenceState,
  imageEligibility,
  currentProducts: null
};

const first = buildPremiumDecisionState(structuredClone(input), { locale: "ko", source: "closeout-persistence" });
assert.equal(first.decisionBundle.context.version, SHARED_SKIN_DECISION_CONTEXT_VERSION);
assert.equal(first.decisionBundle.context.photo.status, "unavailable");
assert.equal(first.decisionBundle.context.photo.failureClass, "provider_failure");
assert.equal(first.decisionBundle.context.photo.eligibility.skinAnalysisEligible, true);

const sessionSource = buildPremiumSessionReportSource({
  premiumReport: null,
  decision: {
    photoEvidenceState,
    imageEligibility,
    routineStructure: null,
    morning: [],
    night: [],
    products: []
  },
  freeResult: input.freeResult
});
assert.deepEqual(sessionSource.photoEvidenceState, photoEvidenceState);
assert.deepEqual(sessionSource.imageEligibility, imageEligibility);

const sessionState = rebuildPremiumDecisionState(sessionSource, { locale: "ko", source: "closeout-session" });
assert.equal(sessionState.decisionBundle.context.version, SHARED_SKIN_DECISION_CONTEXT_VERSION);
assert.equal(sessionState.decisionBundle.context.photo.failureReason, "provider_timeout");

const snapshot = buildPremiumReportSnapshot(sessionState);
assert.equal(snapshot.canonical.photoEvidenceState.failureClass, "provider_failure");
assert.equal(snapshot.canonical.imageEligibility.status, "eligible");
assert.equal(snapshot.contextHash, sessionState.decisionBundle.contextHash);
assert.equal(classifyPremiumSnapshotReplay(sessionState, structuredClone(sessionState)).status, "existing");

const changed = structuredClone(sessionState);
changed.photoEvidenceState.failureReason = "provider_http_503";
assert.equal(classifyPremiumSnapshotReplay(sessionState, changed).status, "conflict");

const rotated = buildRotatedPremiumReportPayload(sessionState);
assert.equal(rotated.currentProducts, null);
assert.deepEqual(rotated.photoEvidenceState, sessionState.photoEvidenceState);
assert.deepEqual(rotated.imageEligibility, sessionState.imageEligibility);
assert.equal(rotated.decisionBundle.context.version, SHARED_SKIN_DECISION_CONTEXT_VERSION);

const legacy = rebuildPremiumDecisionState({
  freeResult: input.freeResult,
  currentProducts: null,
  decisionBundle: {
    contextVersion: "shared-skin-decision-context-v3",
    context: { version: "shared-skin-decision-context-v3" }
  }
}, { locale: "ko", source: "legacy-reentry" });
assert.equal(legacy.decisionBundle.context.version, SHARED_SKIN_DECISION_CONTEXT_VERSION);
assert.equal(legacy.decisionBundle.context.uncertaintyState.unknownPreserved, true);

const unsupported = rebuildPremiumDecisionState({
  freeResult: input.freeResult,
  decisionBundle: {
    contextVersion: "shared-skin-decision-context-v999",
    contextHash: "unsupported",
    contextRevision: 99,
    context: { version: "shared-skin-decision-context-v999", skinState: { skinType: "invented" } }
  }
}, { locale: "ko", source: "unsupported-reentry" });
assert.equal(unsupported.decisionBundle.context.version, SHARED_SKIN_DECISION_CONTEXT_VERSION);
assert.notEqual(unsupported.decisionBundle.contextHash, "unsupported");
assert.notEqual(unsupported.decisionBundle.context.skinState.skinType, "invented");

const anonymous = canonicalizeAnonymousResultForPersistence({
  summary: "summary",
  priority: { axis: "redness" },
  topPick: null,
  alternative: null,
  amFocus: "",
  pmFocus: "",
  routineStructure: null,
  morning: [],
  night: [],
  warnings: [],
  photoEvidence: [],
  photoObservations: null,
  photoEvidenceState: { ...photoEvidenceState, rawProviderResponse: { secret: true } },
  imageEligibility,
  surveyEvidence: [],
  scoring: null,
  altPicks: [],
  categoryPicks: []
});
assert.equal(anonymous.photoEvidenceState.failureClass, "provider_failure");
assert.equal(Object.hasOwn(anonymous.photoEvidenceState, "rawProviderResponse"), false);
assert.equal(anonymous.imageEligibility.skinAnalysisEligible, true);

console.log("verify-skin-decision-persistence-reentry: PASS");
