#!/usr/bin/env node
import { activateRegressionBaseline, preflightRegressionBaseline } from "../baseline.js";
import { dataRoot, fail, parseArgs, print, readRequest } from "./helpers.js";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = dataRoot();
  const requestPath = args.values.get("--request");
  const datasetLineageId = args.values.get("--dataset-lineage");
  const datasetVersionId = args.values.get("--dataset-version");
  if (!requestPath || !datasetLineageId || !datasetVersionId) throw Object.assign(new Error("cli_argument_invalid"), { code: "cli_argument_invalid" });
  const requestDraft = await readRequest(root, requestPath, "baselineRequest");
  if (args.flags.has("--preflight")) {
    const result = await preflightRegressionBaseline({ dataRoot: root, datasetLineageId, datasetVersionId, requestDraft });
    print(result.ok ? { ok: true, requestDigest: result.request.requestDigest, writesPerformed: 0 } : result);
    if (!result.ok) process.exitCode = 1; return;
  }
  if (args.flags.has("--activate")) {
    const reviewPath = args.values.get("--review");
    if (!reviewPath) throw Object.assign(new Error("cli_argument_invalid"), { code: "cli_argument_invalid" });
    const reviewDraft = await readRequest(root, reviewPath, "baselineReview");
    const result = await activateRegressionBaseline({ dataRoot: root, datasetLineageId, datasetVersionId, requestDraft, reviewDraft });
    print(result); if (!result.ok) process.exitCode = 1; return;
  }
  throw Object.assign(new Error("cli_argument_invalid"), { code: "cli_argument_invalid" });
}

main().catch(fail);
