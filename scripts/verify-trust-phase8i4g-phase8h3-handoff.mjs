import fs from "node:fs";
import { verifyPhase8h3CanaryHandoff } from "../lib/trust/official-source-grouped-relocation-canary.mjs";

function argValue(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.slice(2).find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

const inputPath = argValue("input");
if (!inputPath) {
  throw new Error("Usage: node scripts/verify-trust-phase8i4g-phase8h3-handoff.mjs --input=<json>");
}

const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const result = verifyPhase8h3CanaryHandoff(input);
process.stdout.write(JSON.stringify(result, null, 2) + "\n");
if (result.result !== "PASS") process.exitCode = 1;
