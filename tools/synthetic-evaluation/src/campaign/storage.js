import { mkdir, open, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { sha256Hex, stableStringify } from "../shared/canonical-json.js";
import { verifyPilotCampaignEventIntegrity } from "./events.js";
import { verifyGenerationHandoffIntegrity, verifyGenerationWorkPacketIntegrity } from "./generation.js";
import { verifyPilotCampaignPlanIntegrity, verifyPilotCampaignRunIntegrity, verifyPilotSlotIntegrity } from "./plan.js";
import { verifyPilotCheckpointApprovalIntegrity } from "./checkpoint.js";
import { verifyPilotCampaignCloseoutIntegrity } from "./closeout.js";

function text(value) {
  return `${stableStringify(value)}\n`;
}

export function campaignPlanRelativePath(plan) {
  return path.posix.join("campaigns", "plans", plan.campaignId, `${plan.planDigest}.json`);
}
export function campaignRunRootRelativePath(runId) {
  return path.posix.join("campaigns", "runs", runId);
}
export function campaignRunRelativePath(runId) {
  return path.posix.join(campaignRunRootRelativePath(runId), "run.json");
}
export function campaignRunPlanRelativePath(runId) {
  return path.posix.join(campaignRunRootRelativePath(runId), "plan.json");
}
export function campaignSlotRelativePath(runId, slotId) {
  return path.posix.join(campaignRunRootRelativePath(runId), "slots", slotId, "slot.json");
}
export function campaignPacketRelativePath(runId, slotId, packetId) {
  return path.posix.join(campaignRunRootRelativePath(runId), "slots", slotId, "packets", `${packetId}.json`);
}
export function campaignHandoffRelativePath(runId, slotId, handoffId) {
  return path.posix.join(campaignRunRootRelativePath(runId), "slots", slotId, "handoffs", `${handoffId}.json`);
}
export function campaignEventRelativePath(runId, slotId, eventDigest) {
  return path.posix.join(campaignRunRootRelativePath(runId), "events", slotId || "run", `${eventDigest}.json`);
}
export function campaignCheckpointRelativePath(runId, approvalDigest) {
  return path.posix.join(campaignRunRootRelativePath(runId), "checkpoints", `${approvalDigest}.json`);
}
export function campaignProjectionRelativePath(runId, projectionDigest) {
  return path.posix.join(campaignRunRootRelativePath(runId), "projections", `${projectionDigest}.json`);
}
export function campaignCloseoutRelativePath(runId, closeoutDigest) {
  return path.posix.join(campaignRunRootRelativePath(runId), "closeouts", `${closeoutDigest}.json`);
}

export function nativePath(dataRoot, relativePath) {
  return path.join(dataRoot, ...relativePath.split("/"));
}

export async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

export async function writeImmutableJson(filePath, value, verifyExisting = null) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const serialized = text(value);
  try {
    const handle = await open(filePath, "wx", 0o600);
    try {
      await handle.writeFile(serialized, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    return Object.freeze({ created: true, value });
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    let existing;
    try {
      existing = JSON.parse(await readFile(filePath, "utf8"));
    } catch {
      throw Object.assign(new Error("immutable_artifact_conflict"), { code: "immutable_artifact_conflict" });
    }
    const valid = typeof verifyExisting === "function" ? verifyExisting(existing, value) : stableStringify(existing) === stableStringify(value);
    if (!valid) throw Object.assign(new Error("immutable_artifact_conflict"), { code: "immutable_artifact_conflict" });
    return Object.freeze({ created: false, value: existing });
  }
}

export async function saveCompiledCampaign({ dataRoot, plan, run, slots, initialEvent }) {
  if (!verifyPilotCampaignPlanIntegrity(plan) || !verifyPilotCampaignRunIntegrity(run, plan) || slots.length !== 20 || !slots.every((slot) => verifyPilotSlotIntegrity(slot, run, plan)) || !verifyPilotCampaignEventIntegrity(initialEvent)) throw Object.assign(new Error("campaign_bundle_invalid"), { code: "campaign_bundle_invalid" });
  const writes = [];
  writes.push(await writeImmutableJson(nativePath(dataRoot, campaignPlanRelativePath(plan)), plan, (existing) => verifyPilotCampaignPlanIntegrity(existing) && existing.planDigest === plan.planDigest));
  writes.push(await writeImmutableJson(nativePath(dataRoot, campaignRunPlanRelativePath(run.campaignRunId)), plan, (existing) => verifyPilotCampaignPlanIntegrity(existing) && existing.planDigest === plan.planDigest));
  writes.push(await writeImmutableJson(nativePath(dataRoot, campaignRunRelativePath(run.campaignRunId)), run, (existing) => verifyPilotCampaignRunIntegrity(existing, plan) && existing.runIdentityDigest === run.runIdentityDigest));
  for (const slot of slots) writes.push(await writeImmutableJson(nativePath(dataRoot, campaignSlotRelativePath(run.campaignRunId, slot.slotId)), slot, (existing) => verifyPilotSlotIntegrity(existing, run, plan) && existing.slotIdentityDigest === slot.slotIdentityDigest));
  writes.push(await saveCampaignEvent(dataRoot, initialEvent));
  return Object.freeze({ createdCount: writes.filter((item) => item.created).length });
}

export async function saveCampaignEvent(dataRoot, event) {
  if (!verifyPilotCampaignEventIntegrity(event)) throw Object.assign(new Error("campaign_event_invalid"), { code: "campaign_event_invalid" });
  return writeImmutableJson(nativePath(dataRoot, campaignEventRelativePath(event.campaignRunId, event.slotId, event.eventDigest)), event, (existing) => verifyPilotCampaignEventIntegrity(existing) && existing.eventDigest === event.eventDigest);
}

export async function saveGenerationPacket(dataRoot, packet) {
  if (!verifyGenerationWorkPacketIntegrity(packet)) throw Object.assign(new Error("generation_packet_invalid"), { code: "generation_packet_invalid" });
  return writeImmutableJson(nativePath(dataRoot, campaignPacketRelativePath(packet.campaignRunId, packet.slotId, packet.packetId)), packet, (existing) => verifyGenerationWorkPacketIntegrity(existing) && existing.packetDigest === packet.packetDigest);
}

export async function saveGenerationHandoff(dataRoot, handoff, packet) {
  if (!verifyGenerationHandoffIntegrity(handoff, packet)) throw Object.assign(new Error("generation_handoff_invalid"), { code: "generation_handoff_invalid" });
  return writeImmutableJson(nativePath(dataRoot, campaignHandoffRelativePath(handoff.campaignRunId, handoff.slotId, handoff.handoffId)), handoff, (existing) => verifyGenerationHandoffIntegrity(existing, packet) && existing.handoffDigest === handoff.handoffDigest);
}

export async function saveCheckpoint(dataRoot, approval) {
  if (!verifyPilotCheckpointApprovalIntegrity(approval)) throw Object.assign(new Error("campaign_checkpoint_invalid"), { code: "campaign_checkpoint_invalid" });
  return writeImmutableJson(nativePath(dataRoot, campaignCheckpointRelativePath(approval.campaignRunId, approval.approvalDigest)), approval, (existing) => verifyPilotCheckpointApprovalIntegrity(existing) && existing.approvalDigest === approval.approvalDigest);
}

export async function saveProjection(dataRoot, projection) {
  return writeImmutableJson(nativePath(dataRoot, campaignProjectionRelativePath(projection.campaignRunId, projection.projectionDigest)), projection, (existing) => existing?.projectionDigest === projection.projectionDigest);
}

export async function saveCloseout(dataRoot, closeout) {
  if (!verifyPilotCampaignCloseoutIntegrity(closeout)) throw Object.assign(new Error("campaign_closeout_invalid"), { code: "campaign_closeout_invalid" });
  return writeImmutableJson(nativePath(dataRoot, campaignCloseoutRelativePath(closeout.campaignRunId, closeout.closeoutDigest)), closeout, (existing) => verifyPilotCampaignCloseoutIntegrity(existing) && existing.closeoutDigest === closeout.closeoutDigest);
}

async function readJsonFiles(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
  const values = [];
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) values.push(...await readJsonFiles(full));
    else if (entry.isFile() && entry.name.endsWith(".json")) values.push(await readJson(full));
  }
  return values;
}

export async function readCampaignBundle(dataRoot, runId) {
  const runRoot = nativePath(dataRoot, campaignRunRootRelativePath(runId));
  const [plan, run, slots, events, checkpoints, packets, handoffs, closeouts] = await Promise.all([
    readJson(path.join(runRoot, "plan.json")),
    readJson(path.join(runRoot, "run.json")),
    readJsonFiles(path.join(runRoot, "slots")).then((values) => values.filter((value) => value?.schemaVersion === "pilot-slot-v1")),
    readJsonFiles(path.join(runRoot, "events")),
    readJsonFiles(path.join(runRoot, "checkpoints")),
    readJsonFiles(path.join(runRoot, "slots")).then((values) => values.filter((value) => value?.schemaVersion === "generation-work-packet-v1")),
    readJsonFiles(path.join(runRoot, "slots")).then((values) => values.filter((value) => value?.schemaVersion === "generation-handoff-v1")),
    readJsonFiles(path.join(runRoot, "closeouts"))
  ]);
  if (!verifyPilotCampaignPlanIntegrity(plan) || !verifyPilotCampaignRunIntegrity(run, plan) || run.campaignRunId !== runId || slots.length !== 20 || !slots.every((slot) => verifyPilotSlotIntegrity(slot, run, plan))) throw Object.assign(new Error("campaign_bundle_invalid"), { code: "campaign_bundle_invalid" });
  return Object.freeze({ plan, run, slots: Object.freeze(slots), events: Object.freeze(events), checkpoints: Object.freeze(checkpoints), packets: Object.freeze(packets), handoffs: Object.freeze(handoffs), closeouts: Object.freeze(closeouts) });
}

export async function withCampaignWriterClaim(dataRoot, runId, actorId, operation, fn) {
  const claimPath = nativePath(dataRoot, path.posix.join(campaignRunRootRelativePath(runId), "claims", "writer.lock"));
  await mkdir(path.dirname(claimPath), { recursive: true });
  const claim = { schemaVersion: "campaign-writer-claim-v1", runId, actorId, operation, claimedAt: new Date().toISOString() };
  claim.claimDigest = sha256Hex(stableStringify(claim));
  let handle;
  try {
    handle = await open(claimPath, "wx", 0o600);
    await handle.writeFile(text(claim), "utf8");
    await handle.sync();
  } catch (error) {
    await handle?.close();
    if (error?.code === "EEXIST") throw Object.assign(new Error("campaign_writer_claim_exists"), { code: "campaign_writer_claim_exists" });
    throw error;
  }
  await handle.close();
  try {
    return await fn(claim);
  } finally {
    await rm(claimPath, { force: true });
  }
}

export async function recoverCampaignWriterClaim({ dataRoot, runId, expectedClaimDigest, recoveredBy, reasonCode }) {
  const claimPath = nativePath(dataRoot, path.posix.join(campaignRunRootRelativePath(runId), "claims", "writer.lock"));
  let claim;
  try {
    claim = await readJson(claimPath);
  } catch (error) {
    if (error?.code === "ENOENT") return Object.freeze({ ok: true, state: "no_claim" });
    throw error;
  }
  if (claim.claimDigest !== expectedClaimDigest || sha256Hex(stableStringify(Object.fromEntries(Object.entries(claim).filter(([key]) => key !== "claimDigest")))) !== expectedClaimDigest || reasonCode !== "stale_process_confirmed") throw Object.assign(new Error("campaign_claim_recovery_invalid"), { code: "campaign_claim_recovery_invalid" });
  const recovery = {
    schemaVersion: "campaign-writer-claim-recovery-v1",
    runId,
    recoveredClaimDigest: expectedClaimDigest,
    recoveredBy,
    reasonCode,
    recoveredAt: new Date().toISOString()
  };
  recovery.recoveryDigest = sha256Hex(stableStringify(recovery));
  const recoveryPath = nativePath(dataRoot, path.posix.join(campaignRunRootRelativePath(runId), "claims", "recoveries", `${recovery.recoveryDigest}.json`));
  await writeImmutableJson(recoveryPath, recovery);
  await rm(claimPath, { force: false });
  return Object.freeze({ ok: true, state: "recovered", recovery });
}
