#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { resolveSafeContainedFile } from "../../import/resolve-safe-path.js";
import { stableStringify } from "../../shared/canonical-json.js";
import {
  closePilotCampaign,
  compileAndStorePilotCampaign,
  getPilotCampaignStatus,
  issuePilotWave,
  nextPilotSlotAction,
  registerPilotGenerationHandoff,
  reservePilotGenerationRetry,
  resumePilotCampaign,
  submitPilotCheckpoint
} from "../orchestrator.js";
import { registerPilotStage } from "../stage-registration.js";
import { recoverCampaignWriterClaim } from "../storage.js";

function parseArgs(argv) {
  const flags = new Set();
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) throw Object.assign(new Error("cli_argument_invalid"), { code: "cli_argument_invalid" });
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) flags.add(token);
    else {
      values.set(token, next);
      index += 1;
    }
  }
  return { flags, values };
}

function print(value) {
  process.stdout.write(`${stableStringify(value)}\n`);
}

function dataRoot() {
  return path.resolve(process.env.BEJEWELY_SYNTHETIC_DATA_ROOT || path.join(process.cwd(), ".synthetic-local"));
}

async function requestJson(root, relativePath, field) {
  const requestsRoot = path.join(root, "requests");
  const resolved = await resolveSafeContainedFile(requestsRoot, relativePath, field);
  if (!resolved.ok) throw Object.assign(new Error("request_file_invalid"), { code: "request_file_invalid" });
  try {
    return JSON.parse(await readFile(resolved.absolutePath, "utf8"));
  } catch {
    throw Object.assign(new Error("request_file_invalid"), { code: "request_file_invalid" });
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = dataRoot();
  const runId = args.values.get("--run");
  let result;

  if (args.flags.has("--compile")) {
    const requestPath = args.values.get("--plan");
    const runNonce = args.values.get("--run-nonce");
    const startedBy = args.values.get("--started-by");
    if (!requestPath || !runNonce || !startedBy) throw Object.assign(new Error("cli_argument_invalid"), { code: "cli_argument_invalid" });
    const planDraft = await requestJson(root, requestPath, "plan");
    result = await compileAndStorePilotCampaign({ dataRoot: root, planDraft, runNonce, startedBy });
  } else if (args.values.has("--issue-wave")) {
    if (!runId) throw Object.assign(new Error("cli_argument_invalid"), { code: "cli_argument_invalid" });
    result = await issuePilotWave({ dataRoot: root, runId, waveOrdinal: Number(args.values.get("--issue-wave")), actorId: args.values.get("--actor") || "campaign_operator" });
  } else if (args.values.has("--generation-handoff")) {
    const slotId = args.values.get("--slot");
    if (!runId || !slotId) throw Object.assign(new Error("cli_argument_invalid"), { code: "cli_argument_invalid" });
    const request = await requestJson(root, args.values.get("--generation-handoff"), "generationHandoff");
    result = await registerPilotGenerationHandoff({ dataRoot: root, runId, slotId, packetId: request.packetId, handoffDraft: request.handoff, actorId: args.values.get("--actor") || "campaign_operator" });
  } else if (args.flags.has("--retry-generation")) {
    const slotId = args.values.get("--slot");
    if (!runId || !slotId) throw Object.assign(new Error("cli_argument_invalid"), { code: "cli_argument_invalid" });
    result = await reservePilotGenerationRetry({ dataRoot: root, runId, slotId, actorId: args.values.get("--actor") || "campaign_operator" });
  } else if (args.values.has("--stage")) {
    const slotId = args.values.get("--slot");
    const artifactPath = args.values.get("--artifact");
    if (!runId || !slotId || !artifactPath) throw Object.assign(new Error("cli_argument_invalid"), { code: "cli_argument_invalid" });
    const artifacts = await requestJson(root, artifactPath, "stageArtifact");
    result = await registerPilotStage({ dataRoot: root, runId, slotId, stage: args.values.get("--stage"), artifacts, actorId: args.values.get("--actor") || "campaign_operator" });
  } else if (args.values.has("--checkpoint")) {
    if (!runId) throw Object.assign(new Error("cli_argument_invalid"), { code: "cli_argument_invalid" });
    const checkpointDraft = await requestJson(root, args.values.get("--checkpoint"), "checkpoint");
    result = await submitPilotCheckpoint({ dataRoot: root, runId, checkpointDraft, actorId: args.values.get("--actor") || checkpointDraft.approvedBy || "checkpoint_reviewer" });
  } else if (args.flags.has("--status")) {
    if (!runId) throw Object.assign(new Error("cli_argument_invalid"), { code: "cli_argument_invalid" });
    result = await getPilotCampaignStatus({ dataRoot: root, runId });
  } else if (args.flags.has("--advance")) {
    const slotId = args.values.get("--slot");
    if (!runId || !slotId) throw Object.assign(new Error("cli_argument_invalid"), { code: "cli_argument_invalid" });
    const status = await getPilotCampaignStatus({ dataRoot: root, runId });
    const slot = status.projection?.slotProjections?.find((item) => item.slotId === slotId);
    result = slot ? { ok: true, slot, nextAction: nextPilotSlotAction(slot), writesPerformed: 0 } : { ok: false, errors: [{ code: "campaign_slot_invalid", path: "slotId", detail: null }] };
  } else if (args.flags.has("--resume")) {
    if (!runId) throw Object.assign(new Error("cli_argument_invalid"), { code: "cli_argument_invalid" });
    result = await resumePilotCampaign({ dataRoot: root, runId, actorId: args.values.get("--actor") || "campaign_operator" });
  } else if (args.flags.has("--close")) {
    const closedBy = args.values.get("--closed-by");
    if (!runId || !closedBy) throw Object.assign(new Error("cli_argument_invalid"), { code: "cli_argument_invalid" });
    result = await closePilotCampaign({ dataRoot: root, runId, closedBy });
  } else if (args.values.has("--recover-claim")) {
    if (!runId) throw Object.assign(new Error("cli_argument_invalid"), { code: "cli_argument_invalid" });
    const request = await requestJson(root, args.values.get("--recover-claim"), "claimRecovery");
    result = await recoverCampaignWriterClaim({ dataRoot: root, runId, ...request });
  } else {
    throw Object.assign(new Error("cli_argument_invalid"), { code: "cli_argument_invalid" });
  }

  print(result);
  if (!result?.ok) process.exitCode = 1;
}

main().catch((error) => {
  print({ ok: false, errors: [{ code: error?.code || "campaign_cli_failed", path: "$", detail: null }] });
  process.exitCode = 1;
});
