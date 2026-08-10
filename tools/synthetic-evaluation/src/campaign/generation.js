import {
  GENERATION_HANDOFF_SCHEMA_VERSION,
  GENERATION_RETRY_ALLOWED_REASONS,
  GENERATION_WORK_PACKET_SCHEMA_VERSION,
  validateGenerationHandoff,
  validateGenerationWorkPacket
} from "@bejewely/face-contracts";
import { compileGenerationPrompt } from "../generation/compile-prompt.js";
import { SKIN_CONTROL_FIXTURES } from "../generation/fixtures/skin-control-fixtures.js";
import { deepFreeze, sha256Hex, stableStringify } from "../shared/canonical-json.js";
import { verifyPilotCampaignPlanIntegrity, verifyPilotCampaignRunIntegrity, verifyPilotSlotIntegrity } from "./plan.js";

const TOKEN = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const SAFE_RELATIVE_PATH = /^(?![A-Za-z]:)(?!\\\\)(?!\/)(?!.*(?:^|[\\/])\.\.(?:[\\/]|$))(?!.*\0).+$/;

function failure(code, path, detail = null) {
  return Object.freeze({ ok: false, errors: Object.freeze([{ code, path, detail }]) });
}

function packetSemantic(packet) {
  const { packetId, packetDigest, issuedAt, ...semantic } = packet;
  return semantic;
}

function handoffSemantic(handoff) {
  const { handoffId, handoffDigest, generatedAt, ...semantic } = handoff;
  return semantic;
}

export function issueGenerationWorkPacket({ plan, run, slot, attemptOrdinal, issuedAt = new Date().toISOString() }) {
  if (!verifyPilotCampaignPlanIntegrity(plan) || !verifyPilotCampaignRunIntegrity(run, plan) || !verifyPilotSlotIntegrity(slot, run, plan)) return failure("campaign_source_freeze_drift", "source");
  if (![1, 2].includes(attemptOrdinal) || !Number.isFinite(Date.parse(issuedAt)) || new Date(issuedAt).toISOString() !== issuedAt) return failure("generation_packet_invalid", "$", null);
  const fixture = SKIN_CONTROL_FIXTURES[slot.conditionId];
  const draftSpec = slot.subjectVariant
    ? {
        ...fixture.spec,
        subject: {
          ...fixture.spec.subject,
          adultAgeBand: slot.subjectVariant.adultAgeBand,
          presentation: slot.subjectVariant.presentation,
          regionalAppearanceHint: slot.subjectVariant.regionalAppearanceHint
        }
      }
    : fixture.spec;
  const compiled = compileGenerationPrompt({ draftSpec, providerProfileId: run.providerProfileId });
  if (!compiled.ok) return failure("campaign_source_freeze_drift", `fixtures.${slot.conditionId}`, compiled.errors?.[0]?.code || null);
  if (
    sha256Hex(stableStringify(fixture)) !== plan.sourceFreeze.fixtureObjectDigests[slot.conditionId] ||
    (!slot.subjectVariant && compiled.canonicalSpec.finalizedSpec.specDigest !== plan.sourceFreeze.finalizedSpecDigests[slot.conditionId]) ||
    compiled.compiledPrompt.providerProfile.id !== run.providerProfileId ||
    compiled.compiledPrompt.providerProfile.version !== plan.sourceFreeze.providerProfileVersion
  ) return failure("campaign_source_freeze_drift", "sourceFreeze");

  const attemptSemantic = {
    slotId: slot.slotId,
    attemptOrdinal,
    compiledPromptDigest: compiled.compiledPrompt.promptDigest,
    providerProfileDigest: plan.sourceFreeze.providerProfileDigest
  };
  const attemptDigest = sha256Hex(stableStringify(attemptSemantic));
  const attemptId = `att_${attemptDigest.slice(0, 24)}`;
  const semantic = {
    schemaVersion: GENERATION_WORK_PACKET_SCHEMA_VERSION,
    campaignRunId: run.campaignRunId,
    slotId: slot.slotId,
    attemptId,
    attemptOrdinal,
    providerProfileId: run.providerProfileId,
    providerProfileVersion: plan.sourceFreeze.providerProfileVersion,
    finalizedSpecDigest: compiled.canonicalSpec.finalizedSpec.specDigest,
    compiledPromptDigest: compiled.compiledPrompt.promptDigest,
    promptArtifactRef: `objects/generation/prompt/by-digest/${compiled.compiledPrompt.promptDigest.slice(0, 2)}/${compiled.compiledPrompt.promptDigest}.json`,
    expectedOutput: {
      oneImageOnly: true,
      allowedFormats: ["png", "jpeg", "webp_static"],
      requiredWidth: compiled.canonicalSpec.finalizedSpec.capture.width,
      requiredHeight: compiled.canonicalSpec.finalizedSpec.capture.height
    },
    blindBoundary: {
      judgmentIntentDisclosure: "forbidden",
      rawAccountMetadataRetention: "forbidden"
    }
  };
  const packetDigest = sha256Hex(stableStringify(semantic));
  const packet = deepFreeze({
    ...semantic,
    packetId: `pkt_${packetDigest.slice(0, 24)}`,
    issuedAt,
    packetDigest
  });
  return validateGenerationWorkPacket(packet).ok
    ? Object.freeze({ ok: true, packet, finalizedSpec: compiled.canonicalSpec.finalizedSpec, compiledPrompt: compiled.compiledPrompt })
    : failure("generation_packet_invalid", "$", null);
}

export function verifyGenerationWorkPacketIntegrity(packet) {
  if (!validateGenerationWorkPacket(packet).ok) return false;
  const digest = sha256Hex(stableStringify(packetSemantic(packet)));
  return packet.packetDigest === digest && packet.packetId === `pkt_${digest.slice(0, 24)}`;
}

export function finalizeGenerationHandoff({
  packet,
  localAssetRelativePath = null,
  outcome,
  operatorId,
  generatedAt = new Date().toISOString()
}) {
  if (!verifyGenerationWorkPacketIntegrity(packet)) return failure("generation_packet_invalid", "packet");
  if (!TOKEN.test(operatorId || "") || !Number.isFinite(Date.parse(generatedAt)) || new Date(generatedAt).toISOString() !== generatedAt) return failure("generation_handoff_invalid", "$", null);
  if (outcome === "asset_ready") {
    if (typeof localAssetRelativePath !== "string" || !SAFE_RELATIVE_PATH.test(localAssetRelativePath)) return failure("generation_handoff_invalid", "localAssetRelativePath");
  } else if (localAssetRelativePath !== null || !GENERATION_RETRY_ALLOWED_REASONS.slice(0, 3).includes(outcome)) {
    return failure("generation_handoff_invalid", "outcome");
  }
  const semantic = {
    schemaVersion: GENERATION_HANDOFF_SCHEMA_VERSION,
    campaignRunId: packet.campaignRunId,
    slotId: packet.slotId,
    attemptId: packet.attemptId,
    providerProfileId: packet.providerProfileId,
    compiledPromptDigest: packet.compiledPromptDigest,
    localAssetRelativePath,
    outcome,
    operator: {
      operatorId,
      syntheticOnlyConfirmed: true,
      realPersonReferenceUsed: false,
      termsAndRightsReviewedForImport: true
    }
  };
  const handoffDigest = sha256Hex(stableStringify(semantic));
  const handoff = deepFreeze({
    ...semantic,
    handoffId: `hnd_${handoffDigest.slice(0, 24)}`,
    generatedAt,
    handoffDigest
  });
  return validateGenerationHandoff(handoff).ok ? Object.freeze({ ok: true, handoff }) : failure("generation_handoff_invalid", "$", null);
}

export function verifyGenerationHandoffIntegrity(handoff, packet) {
  if (!validateGenerationHandoff(handoff).ok || !verifyGenerationWorkPacketIntegrity(packet)) return false;
  const digest = sha256Hex(stableStringify(handoffSemantic(handoff)));
  return handoff.handoffDigest === digest && handoff.handoffId === `hnd_${digest.slice(0, 24)}` && handoff.campaignRunId === packet.campaignRunId && handoff.slotId === packet.slotId && handoff.attemptId === packet.attemptId && handoff.providerProfileId === packet.providerProfileId && handoff.compiledPromptDigest === packet.compiledPromptDigest;
}
