// Offline Skin S1-B pilot evidence evaluator. No network, no image, no write.
// Provider responses must be ephemeral in-memory inputs, NEVER persisted or logged.
import { evaluateSkinVisionV2Candidate } from "./skin-vision-v2-candidate-core.mjs";

export const SKIN_VISION_V2_PROVIDER_GATE_VERSION = "skin-v2-provider-evidence-gate-v1";
export const SKIN_PROVIDER_MAX_COMPLETION_TOKENS = 2200;
const VARIANTS = new Set(["v1", "v2"]);
const VALID_FINISH = new Set(["stop", "length", "content_filter", "tool_calls", "function_call"]);
const SAFE_CASE_ID = /^[A-Za-z0-9_-]{1,48}$/;
const FACE_STATUS_RANK = Object.freeze({
  unavailable: 0, insufficient_evidence: 1, partial: 2, available: 3
});
const COUNTS = ["present", "not_seen", "unassessable", "unknown"];

function isRecord(x) { return x !== null && typeof x === "object" && !Array.isArray(x); }
function cleanCount(x) { return Number.isSafeInteger(x) && x >= 0 ? x : null; }
function countAxisStates(evaluation) {
  const output = { present: 0, not_seen: 0, unassessable: 0, unknown: 0 };
  for (const axis of Object.values(evaluation?.skinEvidence?.axes || {})) {
    if (COUNTS.includes(axis?.state)) output[axis.state]++;
  }
  return output;
}
function faceAvailableFields(face) {
  const n = face?.analysis?.coverage?.availableFieldCount;
  return cleanCount(n);
}
function parseJson(raw) {
  // Deliberately no error payload or source content in exceptions/outputs.
  if (typeof raw !== "string" || raw.length > 1024 * 1024) return null;
  try {
    const parsed = JSON.parse(raw);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Extract only bounded numeric / categorical metrics from a sanitized ephemeral
 * Provider Chat Completion envelope, *without retaining raw face/photo content*.
 * This function NEVER calls an external provider.
 */
export function inspectSkinVisionTrial({ caseId, variant, providerEnvelope, maxCompletionTokens = SKIN_PROVIDER_MAX_COMPLETION_TOKENS } = {}) {
  if (typeof caseId !== "string" || !SAFE_CASE_ID.test(caseId)) throw new Error("unsafe_case_id");
  if (!VARIANTS.has(variant)) throw new Error("invalid_variant");
  if (maxCompletionTokens !== SKIN_PROVIDER_MAX_COMPLETION_TOKENS) throw new Error("unapproved_token_limit");
  const msg = providerEnvelope?.choices?.[0];
  const content = msg?.message?.content;
  const finishReason = VALID_FINISH.has(msg?.finish_reason) ? msg.finish_reason : "unknown";
  const outputTokens = cleanCount(providerEnvelope?.usage?.completion_tokens);
  const inputTokens = cleanCount(providerEnvelope?.usage?.prompt_tokens);
  const invalidJson = parseJson(content) === null;
  const parsed = invalidJson ? null : parseJson(content);
  const evaluation = parsed ? evaluateSkinVisionV2Candidate(parsed) : null;
  const expectedClassification = variant === "v1" ? "legacy_v1_unverifiable" : "candidate_parsed";
  const schemaMatches = variant === "v1"
    ? parsed?.schemaVersion === "vision-observation-v1"
    : parsed?.schemaVersion === "vision-observation-v2";
  const faceStatus = evaluation?.face?.status || "unavailable";
  const skinStatus = evaluation?.skinEvidence?.status || "blocked";
  const faceFieldCount = faceAvailableFields(evaluation?.face);
  const truncated = finishReason === "length";
  const outputExceeded = outputTokens !== null && outputTokens > maxCompletionTokens;
  const atTokenCap = outputTokens !== null && outputTokens >= maxCompletionTokens;
  // Provisional, NON-ACCEPTANCE warning; not a calibrated budget threshold.
  const nearTokenCap = outputTokens !== null && outputTokens * 10 >= maxCompletionTokens * 9;
  // Separate expected ineligible-photo abstention from eligible-photo Skin
  // contract failure. This is RESEARCH evidence, not positive acceptance.
  const expectedIneligibleAbstention = variant === "v2" &&
    finishReason === "stop" && schemaMatches && !invalidJson &&
    evaluation?.eligibility?.source === "vision" &&
    evaluation?.eligibility?.skinAnalysisEligible === false &&
    Array.isArray(parsed?.skin?.axisEvidence) &&
    parsed.skin.axisEvidence.length === 0 &&
    evaluation?.skinEvidence?.photoGate === "blocked" &&
    outputTokens !== null && !atTokenCap && !outputExceeded;
  const structurallyValid = finishReason === "stop" &&
    schemaMatches && evaluation?.classification === expectedClassification &&
    (variant === "v1" || skinStatus === "ready") &&
    evaluation?.eligibility?.source === "vision" &&
    !invalidJson &&
    outputTokens !== null && !atTokenCap && !outputExceeded;
  const problems = [];
  if (truncated) problems.push("finish_reason_length");
  else if (finishReason !== "stop") problems.push("non_stop_finish");
  if (invalidJson) problems.push("response_json_invalid");
  if (!schemaMatches) problems.push("schema_version_mismatch");
  if (!evaluation || evaluation.classification !== expectedClassification) problems.push("envelope_contract_invalid");
  if (variant === "v2" && skinStatus !== "ready") problems.push("skin_axis_evidence_incomplete");
  if (outputTokens === null) problems.push("completion_usage_missing");
  if (outputExceeded) problems.push("completion_usage_exceeds_cap");
  else if (atTokenCap) problems.push("completion_at_cap");
  if (nearTokenCap) problems.push("near_cap_review");
  if (evaluation?.eligibility?.source !== "vision") problems.push("eligibility_invalid");
  if (!Object.prototype.hasOwnProperty.call(FACE_STATUS_RANK, faceStatus)) problems.push("face_status_invalid");
  return {
    caseId,
    variant,
    result: structurallyValid ? "STRUCTURALLY_VALID" : "INVALID_OR_INCOMPLETE",
    responseComplete: finishReason === "stop" && !atTokenCap && !outputExceeded,
    finishReason,
    outputTokens,
    inputTokens,
    maxCompletionTokens,
    nearTokenCap,
    expectedIneligibleAbstention,
    faceStatus,
    faceAvailableFieldCount: faceFieldCount,
    skinStatus,
    skinAxisStates: countAxisStates(evaluation),
    problems: [...new Set(problems)],
    // No raw JSON, image content, evidence strings or user identity in output.
    sensitiveSourcePersisted: false,
    realPhotoTruthVerified: false
  };
}

/**
 * Evaluate *paired* metadata only, not skin diagnostic accuracy.
 * Same opaque case ID means operator ATTENDED paired-photo matching; we cannot
 * prove photo identity/consent from records, so release remains HOLD.
 */
export function summarizeSkinVisionTrials(rows, { evidenceOrigin = "synthetic" } = {}) {
  if (!Array.isArray(rows) || !rows.length || rows.length > 1000) throw new Error("trial_rows_invalid");
  if (!["synthetic", "operator_review_pending"].includes(evidenceOrigin)) throw new Error("evidence_origin_invalid");
  const records = new Map();
  for (const row of rows) {
    if (!isRecord(row) || !SAFE_CASE_ID.test(row.caseId || "") || !VARIANTS.has(row.variant)) {
      throw new Error("trial_row_invalid");
    }
    const caseRows = records.get(row.caseId) || {};
    if (caseRows[row.variant]) throw new Error("duplicate_variant_for_case");
    caseRows[row.variant] = row;
    records.set(row.caseId, caseRows);
  }
  let paired = 0;
  let bothStructurallyValid = 0;
  let faceStatusDegraded = 0;
  let faceCoverageDegraded = 0;
  let faceBaselineUnassessable = 0;
  let v2Truncated = 0;
  let v2NearCap = 0;
  let v2Invalid = 0;
  let v2ExpectedIneligibleAbstentions = 0;
  let v2EligibleStructuralFailures = 0;
  let maxObservedV2OutputTokens = 0;
  let v2WithUsage = 0;
  for (const pair of records.values()) {
    if (!pair.v1 || !pair.v2) continue;
    paired++;
    const a = pair.v1, b = pair.v2;
    if (a.result === "STRUCTURALLY_VALID" && b.result === "STRUCTURALLY_VALID") bothStructurallyValid++;
    if (FACE_STATUS_RANK[b.faceStatus] < FACE_STATUS_RANK[a.faceStatus]) faceStatusDegraded++;
    if (a.faceAvailableFieldCount !== null && b.faceAvailableFieldCount !== null &&
        b.faceAvailableFieldCount < a.faceAvailableFieldCount) faceCoverageDegraded++;
    // A pair with no assessable v1 Face baseline cannot prove Face quality was preserved.
    if (!(a.faceAvailableFieldCount > 0) || !(b.faceAvailableFieldCount > 0)) faceBaselineUnassessable++;
    if (b.finishReason === "length") v2Truncated++;
    if (b.nearTokenCap === true) v2NearCap++;
    if (b.result !== "STRUCTURALLY_VALID") {
      v2Invalid++; // Backward-compatible count; includes abstentions.
      if (b.expectedIneligibleAbstention === true) {
        v2ExpectedIneligibleAbstentions++;
      } else {
        v2EligibleStructuralFailures++;
      }
    }
    if (Number.isSafeInteger(b.outputTokens)) {
      maxObservedV2OutputTokens = Math.max(maxObservedV2OutputTokens, b.outputTokens);
      v2WithUsage++;
    }
  }
  const allPaired = records.size === paired;
  const structuralCandidatePass = allPaired && paired > 0 &&
    bothStructurallyValid === paired && faceStatusDegraded === 0 &&
    faceCoverageDegraded === 0 && faceBaselineUnassessable === 0 && v2Truncated === 0 && v2Invalid === 0 &&
    v2NearCap === 0 && v2WithUsage === paired;
  return {
    version: SKIN_VISION_V2_PROVIDER_GATE_VERSION,
    evidenceOrigin,
    matchedPairs: paired,
    unmatchedCases: records.size - paired,
    bothStructurallyValid,
    faceStatusDegraded,
    faceCoverageDegraded,
    faceBaselineUnassessable,
    v2Truncated,
    v2Invalid,
    v2ExpectedIneligibleAbstentions,
    v2EligibleStructuralFailures,
    v2NearCap,
    maxObservedV2OutputTokens: v2WithUsage ? maxObservedV2OutputTokens : null,
    structuralCandidatePass,
    verdict: structuralCandidatePass ? "STRUCTURAL_PREFLIGHT_PASSED_ONLY" : "BLOCKED_OR_INCOMPLETE",
    // Cannot prove image consent, photo identity, truth, costs or field accuracy.
    productReady: false,
    releaseReady: false,
    scoringActivationAuthorized: false,
    externallyVerifiedPhotoCohort: false,
    providerTestingApproved: false
  };
}
