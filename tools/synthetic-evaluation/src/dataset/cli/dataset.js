#!/usr/bin/env node
import {
  lockAndActivateDataset,
  materializeHoldoutReferences,
  preflightDatasetLock,
  verifyCurrentDataset
} from "../orchestrator.js";
import { preflightDatasetSource } from "../source.js";
import { readExposureRegistry } from "../exposure.js";
import { dataRoot, fail, parseArgs, print, readRequest } from "./helpers.js";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = dataRoot();
  if (args.flags.has("--verify-current")) {
    const datasetLineageId = args.values.get("--dataset-lineage");
    const datasetVersionId = args.values.get("--dataset-version");
    if (!datasetLineageId || !datasetVersionId) throw Object.assign(new Error("cli_argument_invalid"), { code: "cli_argument_invalid" });
    const result = await verifyCurrentDataset({ dataRoot: root, datasetLineageId, datasetVersionId });
    print(result); if (!result.ok) process.exitCode = 1; return;
  }
  if (args.flags.has("--materialize-holdout")) {
    const datasetLineageId = args.values.get("--dataset-lineage");
    const datasetVersionId = args.values.get("--dataset-version");
    const requestPath = args.values.get("--holdout-request");
    if (!datasetLineageId || !datasetVersionId || !requestPath) throw Object.assign(new Error("cli_argument_invalid"), { code: "cli_argument_invalid" });
    const request = await readRequest(root, requestPath, "holdoutRequest");
    const result = await materializeHoldoutReferences({ dataRoot: root, datasetLineageId, datasetVersionId, request });
    print(result); if (!result.ok) process.exitCode = 1; return;
  }
  const requestPath = args.values.get("--request");
  if (!requestPath) throw Object.assign(new Error("cli_argument_invalid"), { code: "cli_argument_invalid" });
  const request = await readRequest(root, requestPath, "datasetRequest");
  if (args.flags.has("--source-preflight")) {
    const exposure = await readExposureRegistry(root, request.sourceRequest?.datasetLineageId || request.datasetLineageId);
    if (!exposure.ok) { print(exposure); process.exitCode = 1; return; }
    const source = await preflightDatasetSource({ dataRoot: root, request: request.sourceRequest || request, priorExposureRegistryDigest: exposure.registryDigest });
    print(source.ok ? { ok: true, sourceSnapshotDigest: source.sourceSnapshot.sourceSnapshotDigest, activeMembers: source.sourceSnapshot.members.length, exclusions: source.sourceSnapshot.exclusions.length, writesPerformed: 0 } : source);
    if (!source.ok) process.exitCode = 1; return;
  }
  if (args.flags.has("--simulate")) {
    const result = await preflightDatasetLock({ dataRoot: root, sourceRequest: request.sourceRequest, splitPlanDraft: request.splitPlan });
    print(result.ok ? { ok: true, sourceSnapshotDigest: result.sourceSnapshot.sourceSnapshotDigest, graphDigest: result.leakageGraph.graphDigest, planDigest: result.splitPlan.planDigest, assignmentDigest: result.assignment.assignmentDigest, achievedCounts: result.assignment.achievedCounts, writesPerformed: 0 } : result);
    if (!result.ok) process.exitCode = 1; return;
  }
  if (args.flags.has("--lock")) {
    const reviewPath = args.values.get("--review");
    if (!reviewPath) throw Object.assign(new Error("cli_argument_invalid"), { code: "cli_argument_invalid" });
    const reviewDraft = await readRequest(root, reviewPath, "lockReview");
    const result = await lockAndActivateDataset({ dataRoot: root, sourceRequest: request.sourceRequest, splitPlanDraft: request.splitPlan, lockReviewDraft: reviewDraft, predecessorDatasetVersionDigest: request.predecessorDatasetVersionDigest || null });
    print(result); if (!result.ok) process.exitCode = 1; return;
  }
  throw Object.assign(new Error("cli_argument_invalid"), { code: "cli_argument_invalid" });
}

main().catch(fail);
