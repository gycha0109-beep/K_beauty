import {
  ALIGNMENT_POLICY_ID,
  ALIGNMENT_POLICY_VERSION,
  INTENT_ALIGNMENT_SCHEMA_VERSION,
  JUDGMENT_CAPTURE_AXES,
  validateIntentAlignmentShape
} from "@bejewely/face-contracts";
import { deepFreeze, sha256Hex, stableStringify } from "../shared/canonical-json.js";
import { verifyJudgmentConsensusIntegrity } from "./consensus.js";
import { resolveCandidateIntent } from "./intent-resolver.js";

function sortedArray(value) {
  return [...value].sort();
}

function sameValue(left, right) {
  if (Array.isArray(left) && Array.isArray(right)) return stableStringify(sortedArray(left)) === stableStringify(sortedArray(right));
  return left === right;
}

function compareAxis(consensus, axis, intended, role) {
  const result = consensus.axes?.[axis];
  if (!result || result.status !== "agreed") {
    return deepFreeze({
      axis,
      role,
      intended,
      judged: result?.value ?? null,
      verdict: "unverifiable",
      reasonCode: result?.status === "not_reviewed" ? "axis_not_reviewed" : "axis_consensus_unavailable"
    });
  }
  const matched = sameValue(intended, result.value);
  return deepFreeze({
    axis,
    role,
    intended,
    judged: result.value,
    verdict: matched ? "matched" : "mismatched",
    reasonCode: matched ? "axis_exact_match" : role === "gate" ? "capture_gate_mismatch" : "target_value_mismatch"
  });
}

function skinTargets(spec) {
  return [
    ["skin.redness.presence", spec.skinIntent.redness.severity],
    ["skin.redness.regions", spec.skinIntent.redness.regions],
    ["skin.blemishes.presence", spec.skinIntent.blemishes.severity],
    ["skin.blemishes.countBand", spec.skinIntent.blemishes.countBand],
    ["skin.blemishes.regions", spec.skinIntent.blemishes.regions]
  ];
}

function featureTargets(spec) {
  if (!spec.featureIntent) return [];
  return Object.entries(spec.featureIntent.cues)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([axis, cue]) => [`face.${axis}`, cue.value, cue.strength]);
}

function requiredPolicy(spec) {
  const capture = [...JUDGMENT_CAPTURE_AXES];
  if (spec.purpose === "capture_control") {
    return { gateAxes: capture, targetAxes: [], featureStrengths: [] };
  }
  if (spec.purpose === "skin_cue_control" || spec.purpose === "paired_skin_edit") {
    return { gateAxes: capture, targetAxes: skinTargets(spec), featureStrengths: [] };
  }
  if (spec.purpose === "face_feature_control") {
    const features = featureTargets(spec);
    return { gateAxes: capture, targetAxes: features.map(([axis, value]) => [axis, value]), featureStrengths: features };
  }
  if (spec.purpose === "mixed_control_pilot") {
    const features = featureTargets(spec);
    return { gateAxes: capture, targetAxes: [...skinTargets(spec), ...features.map(([axis, value]) => [axis, value])], featureStrengths: features };
  }
  return null;
}

function determineVerdict(spec, results) {
  const gates = results.filter((item) => item.role === "gate");
  const targets = results.filter((item) => item.role === "target");
  if (gates.some((item) => item.verdict === "mismatched") || targets.some((item) => item.verdict === "mismatched")) return "misaligned";
  if (gates.some((item) => item.verdict === "unverifiable") || targets.some((item) => item.verdict === "unverifiable")) return "unverifiable";
  if (spec.purpose === "paired_skin_edit") return "target_match_pair_unverified";
  const diagnosticMismatch = results.some((item) => item.role === "diagnostic" && item.verdict === "mismatched");
  return diagnosticMismatch ? "partially_aligned" : "aligned";
}

function alignmentSemantic(alignment) {
  const { alignmentId, alignmentDigest, alignedAt, ...semantic } = alignment;
  return semantic;
}

function hasValidAlignmentSemantics(alignment) {
  const requiredAxes = alignment.policy.requiredAxes;
  const sortedRequiredAxes = [...requiredAxes].sort();
  if (
    stableStringify(requiredAxes) !== stableStringify(sortedRequiredAxes) ||
    new Set(requiredAxes).size !== requiredAxes.length ||
    alignment.policy.requiredAxesDigest !== sha256Hex(stableStringify(requiredAxes))
  ) {
    return false;
  }
  const axisNames = alignment.axisResults.map((result) => result.axis);
  if (new Set(axisNames).size !== axisNames.length) return false;
  const resultByAxis = new Map(alignment.axisResults.map((result) => [result.axis, result]));
  if (!requiredAxes.every((axis) => {
    const result = resultByAxis.get(axis);
    return result && (result.role === "gate" || result.role === "target");
  })) {
    return false;
  }
  const requiredResults = requiredAxes.map((axis) => resultByAxis.get(axis));
  const hasMismatch = requiredResults.some((result) => result.verdict === "mismatched");
  const hasUnverifiable = requiredResults.some((result) => result.verdict === "unverifiable");
  if (hasMismatch && alignment.overallVerdict !== "misaligned") return false;
  if (!hasMismatch && hasUnverifiable && alignment.overallVerdict !== "unverifiable") return false;
  if (
    !hasMismatch &&
    !hasUnverifiable &&
    alignment.generation.purpose === "paired_skin_edit" &&
    alignment.overallVerdict !== "target_match_pair_unverified"
  ) {
    return false;
  }
  if (alignment.overallVerdict === "aligned" && requiredResults.some((result) => result.verdict !== "matched")) return false;
  const sortedReasons = [...alignment.promotionBlockReasons].sort();
  if (
    stableStringify(alignment.promotionBlockReasons) !== stableStringify(sortedReasons) ||
    new Set(alignment.promotionBlockReasons).size !== alignment.promotionBlockReasons.length ||
    !alignment.promotionBlockReasons.includes("promotion_policy_pending_t6") ||
    alignment.promotionReviewEligible !== false
  ) {
    return false;
  }
  return true;
}

export function alignJudgmentToIntent({
  consensus,
  candidateManifest,
  finalizedSpec,
  compiledPrompt,
  alignedAt = new Date().toISOString()
}) {
  if (!verifyJudgmentConsensusIntegrity(consensus)) {
    return Object.freeze({ ok: false, errors: Object.freeze([{ code: "judgment_consensus_integrity_invalid", path: "consensus", detail: null }]) });
  }
  if (!["sealed_complete", "sealed_partial"].includes(consensus.status)) {
    return Object.freeze({ ok: false, errors: Object.freeze([{ code: "judgment_consensus_unresolved", path: "consensus.status", detail: consensus.status }]) });
  }
  if (!Number.isFinite(Date.parse(alignedAt))) {
    return Object.freeze({ ok: false, errors: Object.freeze([{ code: "alignment_artifact_conflict", path: "alignedAt", detail: null }]) });
  }
  const resolved = resolveCandidateIntent({ candidateManifest, finalizedSpec, compiledPrompt });
  if (!resolved.ok) return resolved;
  const intent = resolved.intent;
  if (
    consensus.candidateId !== intent.candidate.candidateId ||
    consensus.canonicalSha256 !== intent.candidate.canonicalSha256
  ) {
    return Object.freeze({ ok: false, errors: Object.freeze([{ code: "intent_join_mismatch", path: "consensus", detail: "candidate_or_asset_mismatch" }]) });
  }
  const spec = intent.generation.finalizedSpec;
  const policy = requiredPolicy(spec);
  if (!policy) {
    return Object.freeze({ ok: false, errors: Object.freeze([{ code: "alignment_policy_unsupported", path: "generation.purpose", detail: spec.purpose }]) });
  }

  const axisResults = [];
  for (const axis of policy.gateAxes) axisResults.push(compareAxis(consensus, axis, "confirmed", "gate"));
  for (const [axis, intended] of policy.targetAxes) axisResults.push(compareAxis(consensus, axis, intended, "target"));
  for (const [axis, , strength] of policy.featureStrengths) {
    axisResults.push(deepFreeze({
      axis: `${axis}.strength`,
      role: "diagnostic",
      intended: strength,
      judged: null,
      verdict: "unverifiable",
      reasonCode: "feature_strength_not_assessed_v1"
    }));
  }

  const overallVerdict = determineVerdict(spec, axisResults);
  const requiredAxes = [...new Set([...policy.gateAxes, ...policy.targetAxes.map(([axis]) => axis)])].sort();
  const requiredAxesDigest = sha256Hex(stableStringify(requiredAxes));
  const promotionBlockReasons = [...intent.policyHolds, "promotion_policy_pending_t6"];
  if (spec.purpose === "mixed_control_pilot") promotionBlockReasons.push("mixed_control_pilot_promotion_disabled");
  if (spec.purpose === "paired_skin_edit") promotionBlockReasons.push("paired_identity_verification_unavailable");
  if (overallVerdict !== "aligned") promotionBlockReasons.push(`overall_${overallVerdict}`);
  const promotionReviewEligible = false;

  const semantic = {
    schemaVersion: INTENT_ALIGNMENT_SCHEMA_VERSION,
    candidate: intent.candidate,
    observation: {
      runId: consensus.observationRunId,
      observationDigest: consensus.observationDigest
    },
    consensus: {
      consensusId: consensus.consensusId,
      consensusDigest: consensus.consensusDigest
    },
    generation: {
      specDigest: intent.generation.specDigest,
      promptDigest: intent.generation.promptDigest,
      purpose: spec.purpose
    },
    policy: {
      id: ALIGNMENT_POLICY_ID,
      version: ALIGNMENT_POLICY_VERSION,
      requiredAxes,
      requiredAxesDigest
    },
    axisResults,
    overallVerdict,
    promotionReviewEligible,
    promotionBlockReasons: [...new Set(promotionBlockReasons)].sort()
  };
  const alignmentDigest = sha256Hex(stableStringify(semantic));
  const alignment = deepFreeze({
    ...semantic,
    alignmentId: `aln_${alignmentDigest.slice(0, 24)}`,
    alignedAt,
    alignmentDigest
  });
  return Object.freeze({ ok: true, alignment });
}

export function verifyIntentAlignmentIntegrity(alignment) {
  if (!validateIntentAlignmentShape(alignment).ok || !hasValidAlignmentSemantics(alignment)) return false;
  const digest = sha256Hex(stableStringify(alignmentSemantic(alignment)));
  return alignment.alignmentDigest === digest && alignment.alignmentId === `aln_${digest.slice(0, 24)}`;
}
