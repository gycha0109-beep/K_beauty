import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

function loadCore() {
  const source = readFileSync("lib/face-lab-hosted-evaluation.js", "utf8")
    .replace(/export const /g, "const ")
    .replace(/export function /g, "function ");
  return Function(`${source}\nreturn { summarizeHostedEvaluation, renderHostedEvaluationReport };`)();
}

function parseArgs(argv) {
  const output = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const next = argv[index + 1];
    output[token.slice(2)] = next && !next.startsWith("--") ? argv[++index] : true;
  }
  return output;
}

function readJsonLines(filePath) {
  return readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

const args = parseArgs(process.argv.slice(2));
if (!args["run-dir"]) throw new Error("--run-dir is required");
const runDir = path.resolve(args["run-dir"]);
const manifestPath = path.join(runDir, "run-manifest.json");
const recordsPath = path.join(runDir, "records.jsonl");
if (!existsSync(manifestPath) || !existsSync(recordsPath)) {
  throw new Error("run-manifest.json and records.jsonl are required");
}
const core = loadCore();
const runManifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const records = readJsonLines(recordsPath);
const summary = core.summarizeHostedEvaluation(records, runManifest);
writeFileSync(path.join(runDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
writeFileSync(path.join(runDir, "report.md"), core.renderHostedEvaluationReport(summary), "utf8");
console.log(`Face Lab hosted evaluation report regenerated: ${runDir}`);
