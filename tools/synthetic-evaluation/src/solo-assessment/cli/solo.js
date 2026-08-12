#!/usr/bin/env node
import {
  claimSoloReviewItem,
  confirmSoloWaveBrief,
  deriveSoloAlignmentReport,
  linkSoloBriefToCheckpoint,
  prepareSoloWave,
  revealSoloIntent,
  submitSoloIntentAssessment,
  submitSoloScreening
} from "../orchestrator.js";
import { fail, parseArgs, printResult, readRequestJson, resolveDataRoot } from "./helpers.js";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const requestPath = args.values.get("--request");
  const preflight = args.flags.has("--preflight");
  const confirm = args.flags.has("--confirm");
  if (!requestPath || preflight === confirm) throw Object.assign(new Error("cli_argument_invalid"), { code: "cli_argument_invalid" });
  const dataRoot = resolveDataRoot();
  const request = await readRequestJson(dataRoot, requestPath, "request");
  let result;
  if (request.action === "prepare_wave") {
    result = await prepareSoloWave({ dataRoot, runId: request.runId, waveOrdinal: request.waveOrdinal, operatorId: request.operatorId, confirm });
  } else if (request.action === "claim") {
    result = await claimSoloReviewItem({ dataRoot, sessionRef: request.sessionRef, reviewItemId: request.reviewItemId, confirm });
  } else if (request.action === "screen") {
    result = await submitSoloScreening({ dataRoot, sessionRef: request.sessionRef, reviewItemId: request.reviewItemId, claimDigest: request.claimDigest, draft: request.draft, confirm });
  } else if (request.action === "reveal") {
    result = await revealSoloIntent({ dataRoot, sessionRef: request.sessionRef, reviewItemId: request.reviewItemId, screeningDigest: request.screeningDigest, confirm });
  } else if (request.action === "assess") {
    result = await submitSoloIntentAssessment({ dataRoot, sessionRef: request.sessionRef, reviewItemId: request.reviewItemId, screeningDigest: request.screeningDigest, revealDigest: request.revealDigest, draft: request.draft, confirm });
  } else if (request.action === "brief") {
    result = await confirmSoloWaveBrief({ dataRoot, sessionRef: request.sessionRef, itemRefs: request.itemRefs, decisionDraft: request.decisionDraft, confirm });
  } else if (request.action === "link_checkpoint") {
    result = await linkSoloBriefToCheckpoint({ dataRoot, sessionRef: request.sessionRef, briefDigest: request.briefDigest, checkpointApprovalDigest: request.checkpointApprovalDigest, confirm });
  } else if (request.action === "derive_alignment_report") {
    result = await deriveSoloAlignmentReport({ dataRoot, sessionRef: request.sessionRef, itemRefs: request.itemRefs, limitations: request.limitations, confirm });
  } else {
    throw Object.assign(new Error("cli_argument_invalid"), { code: "cli_argument_invalid" });
  }
  printResult(result);
  if (!result.ok) process.exitCode = 1;
}

main().catch(fail);
