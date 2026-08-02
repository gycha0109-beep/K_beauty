#!/usr/bin/env node
import { exportCampaignReport } from "../orchestrator.js";
import { fail, parseArgs, print, resolveDataRoot } from "./helpers.js";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const reportDigest = args.values.get("--report");
  if (!reportDigest || !args.flags.has("--internal-review") || args.flags.size !== 1) throw Object.assign(new Error("cli_argument_invalid"), { code: "cli_argument_invalid" });
  const result = await exportCampaignReport({
    dataRoot: resolveDataRoot(),
    reportDigest,
    actorId: args.values.get("--actor") || "report_operator"
  });
  print(result);
  if (!result.ok) process.exitCode = 1;
}

main().catch(fail);
