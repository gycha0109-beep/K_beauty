import {
  issuePilotWave as issuePilotWaveUnsafe,
  resumePilotCampaign as resumePilotCampaignUnsafe,
  submitPilotCheckpoint as submitPilotCheckpointUnsafe
} from "./orchestrator.js";
import { verifyPilotSourceFreezeCurrent } from "./source-freeze.js";
import { readCampaignBundle } from "./storage.js";

function failure(code, path, detail = null) {
  return Object.freeze({ ok: false, errors: Object.freeze([{ code, path, detail }]) });
}

function sourcePreflight(bundle) {
  if (!verifyPilotSourceFreezeCurrent(bundle.plan.sourceFreeze)) {
    return failure("campaign_source_freeze_drift", "plan.sourceFreeze", null);
  }
  return Object.freeze({ ok: true });
}

export async function issuePilotWave(input) {
  const before = await readCampaignBundle(input.dataRoot, input.runId);
  const preflight = sourcePreflight(before);
  if (!preflight.ok) return preflight;
  const beforePacketCount = before.packets.length;
  const result = await issuePilotWaveUnsafe(input);
  if (!result.ok) return result;
  const after = await readCampaignBundle(input.dataRoot, input.runId);
  return Object.freeze({
    ...result,
    packetsIssued: after.packets.length - beforePacketCount
  });
}

export async function submitPilotCheckpoint(input) {
  const bundle = await readCampaignBundle(input.dataRoot, input.runId);
  const current = verifyPilotSourceFreezeCurrent(bundle.plan.sourceFreeze);
  const declared = input.checkpointDraft?.checklist?.sourceFreezeStillValid;
  if (declared !== current) {
    return failure("campaign_checkpoint_invalid", "checklist.sourceFreezeStillValid", "source_freeze_declaration_mismatch");
  }
  if (input.checkpointDraft?.decision === "continue" && !current) {
    return failure("campaign_source_freeze_drift", "plan.sourceFreeze", null);
  }
  return submitPilotCheckpointUnsafe(input);
}

export async function resumePilotCampaign(input) {
  const bundle = await readCampaignBundle(input.dataRoot, input.runId);
  const preflight = sourcePreflight(bundle);
  if (!preflight.ok) return preflight;
  return resumePilotCampaignUnsafe(input);
}
