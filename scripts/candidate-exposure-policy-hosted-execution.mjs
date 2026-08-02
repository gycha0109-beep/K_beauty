import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { sortObject } from "../lib/candidate-exposure-policy-hosted-execution-contract.js";
import { buildPlan } from "../lib/candidate-exposure-policy-hosted-execution.js";

function readJson(path) { return JSON.parse(readFileSync(path, "utf8")); }
function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    if (!argv[index]?.startsWith("--") || argv[index + 1] == null) throw new Error("invalid_arguments");
    result[argv[index].slice(2)] = argv[index + 1];
  }
  return result;
}
async function main() {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  if ((args.mode || "plan-only") === "execute-approved") throw new Error("execute-approved requires a separately reviewed safe adapter and current user approval; this CLI performs no Vercel or Hosted operation");
  if ((args.mode || "plan-only") !== "plan-only" || !args.approval || !args["runtime-attestation"] || !args.fixtures) throw new Error("plan-only requires --approval, --runtime-attestation, and --fixtures; --deployments is optional");
  const plan = buildPlan({ receipt: readJson(args.approval), deploymentRefs: args.deployments ? readJson(args.deployments) : null, runtimeAttestation: readJson(args["runtime-attestation"]), fixtureManifest: readJson(args.fixtures), now: args.now ? new Date(args.now) : new Date() });
  console.log(JSON.stringify(sortObject(plan), null, 2));
  if (plan.status === "blocked_before_execution") process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
