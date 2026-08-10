import { mkdir, open, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { validatePilotProjection } from "@bejewely/face-contracts";
import { sha256Hex, stableStringify } from "../shared/canonical-json.js";
import { verifyPilotCampaignEventIntegrity } from "./events.js";
import { verifyGenerationHandoffIntegrity, verifyGenerationWorkPacketIntegrity } from "./generation.js";
import { verifyPilotCampaignPlanIntegrity, verifyPilotCampaignRunIntegrity, verifyPilotSlotIntegrity } from "./plan.js";
import { verifyPilotCheckpointApprovalIntegrity } from "./checkpoint.js";
import { verifyPilotCampaignCloseoutIntegrity } from "./closeout.js";
import { verifyPilotWaveCancellationIntegrity } from "./cancellation.js";

const TOKEN = /^[a-z0-9][a-z0-9._-]{0,127}$/;

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
export function campaignWaveCancellationRelativePath(runId, cancellationDigest) {
  return path.posix.join(campaignRunRootRelativePath(runId), "cancellations", `${cancellationDigest}.json`);
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
  if (!verifyPilotCampaignPlanIntegrity(plan) || !verifyPilotCampaignRunIntegrity(run, plan) || slots.length !== plan.objective.primarySlotCount || !slots.every((slot) => verifyPilotSlotIntegrity(slot, run, plan)) || !verifyPilotCampaignEventIntegrity(initialEvent)) throw Object.assign(new Error("campaign_bundle_invalid"), { code: "campaign_bundle_invalid" });
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

function verifyProjectionIntegrity(projection) {
  if (!validatePilotProjection(projection).ok) return false;
  const { projectionDigest, ...semantic } = projection;
  return projectionDigest === sha256Hex(stableStringify(semantic));
}

export async function saveProjection(dataRoot, projection) {
  if (!verifyProjectionIntegrity(projection)) throw Object.assign(new Error("campaign_projection_invalid"), { code: "campaign_projection_invalid" });
  return writeImmutableJson(nativePath(dataRoot, campaignProjectionRelativePath(projection.campaignRunId, projection.projectionDigest)), projection, (existing) => verifyProjectionIntegrity(existing) && existing.projectionDigest === projection.projectionDigest);
}

export async function saveCloseout(dataRoot, closeout) {
  if (!verifyPilotCampaignCloseoutIntegrity(closeout)) throw Object.assign(new Error("campaign_closeout_invalid"), { code: "campaign_closeout_invalid" });
  return writeImmutableJson(nativePath(dataRoot, campaignCloseoutRelativePath(closeout.campaignRunId, closeout.closeoutDigest)), closeout, (existing) => verifyPilotCampaignCloseoutIntegrity(existing) && existing.closeoutDigest === closeout.closeoutDigest);
}

export async function saveWaveCancellation(dataRoot, cancellation) {
  if (!verifyPilotWaveCancellationIntegrity(cancellation)) throw Object.assign(new Error("campaign_wave_cancellation_invalid"), { code: "campaign_wave_cancellation_invalid" });
  return writeImmutableJson(nativePath(dataRoot, campaignWaveCancellationRelativePath(cancellation.campaignRunId, cancellation.cancellationDigest)), cancellation, (existing) => verifyPilotWaveCancellationIntegrity(existing) && existing.cancellationDigest === cancellation.cancellationDigest);
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
  const slotTree = await readJsonFiles(path.join(runRoot, "slots"));
  const [plan, run, events, checkpoints, cancellations, closeouts] = await Promise.all([
    readJson(path.join(runRoot, "plan.json")),
    readJson(path.join(runRoot, "run.json")),
    readJsonFiles(path.join(runRoot, "events")),
    readJsonFiles(path.join(runRoot, "checkpoints")),
    readJsonFiles(path.join(runRoot, "cancellations")),
    readJsonFiles(path.join(runRoot, "closeouts"))
  ]);
  const slots = slotTree.filter((value) => ["pilot-slot-v1", "pilot-slot-v2"].includes(value?.schemaVersion)).sort((a,b) => a.slotId.localeCompare(b.slotId));
  const packets = slotTree.filter((value) => value?.schemaVersion === "generation-work-packet-v1");
  const handoffs = slotTree.filter((value) => value?.schemaVersion === "generation-handoff-v1");
  if (!verifyPilotCampaignPlanIntegrity(plan)) throw Object.assign(new Error("campaign_bundle_invalid:plan"), { code: "campaign_bundle_invalid", detail: "plan" });
  if (!verifyPilotCampaignRunIntegrity(run, plan) || run.campaignRunId !== runId) throw Object.assign(new Error("campaign_bundle_invalid:run"), { code: "campaign_bundle_invalid", detail: "run" });
  if (slots.length !== plan.objective.primarySlotCount || !slots.every((slot) => verifyPilotSlotIntegrity(slot, run, plan))) throw Object.assign(new Error("campaign_bundle_invalid:slots"), { code: "campaign_bundle_invalid", detail: `slots:${slots.length}` });
  if (!events.every(verifyPilotCampaignEventIntegrity)) throw Object.assign(new Error("campaign_bundle_invalid:events"), { code: "campaign_bundle_invalid", detail: "events" });
  if (!checkpoints.every((approval) => verifyPilotCheckpointApprovalIntegrity(approval))) throw Object.assign(new Error("campaign_bundle_invalid:checkpoints"), { code: "campaign_bundle_invalid", detail: "checkpoints" });
  if (!cancellations.every(verifyPilotWaveCancellationIntegrity)) throw Object.assign(new Error("campaign_bundle_invalid:cancellations"), { code: "campaign_bundle_invalid", detail: "cancellations" });
  if (!packets.every(verifyGenerationWorkPacketIntegrity)) throw Object.assign(new Error("campaign_bundle_invalid:packets"), { code: "campaign_bundle_invalid", detail: "packets" });
  for (const cancellation of cancellations) {
    const expectedBindings = packets
      .filter((packet) => slots.some((slot) => slot.slotId === packet.slotId && slot.waveOrdinal === cancellation.waveOrdinal))
      .map((packet) => ({ slotId: packet.slotId, attemptId: packet.attemptId, packetId: packet.packetId, packetDigest: packet.packetDigest }))
      .sort((left, right) => left.slotId.localeCompare(right.slotId));
    const cancellationEvent = events.find((event) => event.eventType === "wave_cancelled" && event.sourceRefs.some((ref) => ref.artifactDigest === cancellation.cancellationDigest));
    const terminalSlots = new Set(events.filter((event) => event.eventType === "slot_terminal" && event.reasonCodes.includes("cancelled_ungenerated_wave") && event.sourceRefs.some((ref) => ref.artifactDigest === cancellation.cancellationDigest)).map((event) => event.slotId));
    if (cancellation.campaignRunId !== runId || stableStringify(cancellation.slotBindings) !== stableStringify(expectedBindings) || !cancellationEvent || terminalSlots.size !== expectedBindings.length || expectedBindings.some((binding) => !terminalSlots.has(binding.slotId))) throw Object.assign(new Error("campaign_bundle_invalid:cancellations"), { code: "campaign_bundle_invalid", detail: "cancellation_binding" });
  }
  for (const handoff of handoffs) {
    const packet = packets.find((item) => item.attemptId === handoff.attemptId && item.slotId === handoff.slotId);
    if (!packet || !verifyGenerationHandoffIntegrity(handoff, packet)) throw Object.assign(new Error("campaign_bundle_invalid:handoffs"), { code: "campaign_bundle_invalid", detail: "handoffs" });
  }
  if (!closeouts.every(verifyPilotCampaignCloseoutIntegrity)) throw Object.assign(new Error("campaign_bundle_invalid:closeouts"), { code: "campaign_bundle_invalid", detail: "closeouts" });
  return Object.freeze({ plan, run, slots: Object.freeze(slots), events: Object.freeze(events), checkpoints: Object.freeze(checkpoints), cancellations: Object.freeze(cancellations), packets: Object.freeze(packets), handoffs: Object.freeze(handoffs), closeouts: Object.freeze(closeouts) });
}

export async function withCampaignWriterClaim(dataRoot, runId, actorId, operation, fn) {
  if (!TOKEN.test(actorId || "") || !TOKEN.test(operation || "")) throw Object.assign(new Error("campaign_writer_claim_invalid"), { code: "campaign_writer_claim_invalid" });
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
  if (!TOKEN.test(recoveredBy || "")) throw Object.assign(new Error("campaign_claim_recovery_invalid"), { code: "campaign_claim_recovery_invalid" });
  const claimPath = nativePath(dataRoot, path.posix.join(campaignRunRootRelativePath(runId), "claims", "writer.lock"));
  let claim;
  try {
    claim = await readJson(claimPath);
  } catch (error) {
    if (error?.code === "ENOENT") return Object.freeze({ ok: true, state: "no_claim" });
    throw error;
  }
  const { claimDigest, ...claimSemantic } = claim;
  if (claimDigest !== expectedClaimDigest || sha256Hex(stableStringify(claimSemantic)) !== expectedClaimDigest || reasonCode !== "stale_process_confirmed") throw Object.assign(new Error("campaign_claim_recovery_invalid"), { code: "campaign_claim_recovery_invalid" });
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
