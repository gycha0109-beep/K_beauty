import { existsSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { acquireRunLock, parseSafeInteger } from "../lib/face-lab-hosted-evaluation-transport.mjs";

let fatalHandled = false;
function handleFatal(error) {
  if (fatalHandled) return;
  fatalHandled = true;
  const message = String(error?.message || "");
  const code = message.includes("run lock already exists")
    ? "run_lock_exists"
    : message.includes("required")
      ? "run_files_missing"
      : "report_generation_failed";
  console.error(`[face-lab-eval-report] failed=${code}`);
  process.exitCode = 1;
}
process.on("uncaughtException", handleFatal);
process.on("unhandledRejection", handleFatal);

const MAX_MANIFEST_BYTES = 1024 * 1024;
const DEFAULT_MAX_ROW_BYTES = 256 * 1024;

function loadCore() {
  const source = readFileSync("lib/face-lab-hosted-evaluation.js", "utf8")
    .replace(/export const /g, "const ")
    .replace(/export function /g, "function ");
  return Function(`${source}\nreturn { parseHostedEvaluationJsonLines, summarizeHostedEvaluation, renderHostedEvaluationReport };`)();
}

function parseArgs(argv) {
  const output = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) throw new Error(`unexpected positional argument: ${token}`);
    const next = argv[index + 1];
    output[token.slice(2)] = next && !next.startsWith("--") ? argv[++index] : true;
  }
  return output;
}

function resolveRunDir(value) {
  const root = path.resolve("tmp", "face-lab-hosted-evaluation");
  const resolved = path.resolve(value);
  const relative = path.relative(root, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("--run-dir must stay inside tmp/face-lab-hosted-evaluation/");
  }
  return resolved;
}

function readBounded(filePath, maxBytes, label) {
  if (statSync(filePath).size > maxBytes) throw new Error(`${label} exceeds ${maxBytes} bytes`);
  return readFileSync(filePath, "utf8");
}

function fingerprintFile(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function parseBooleanFlag(value, label) {
  if (value === undefined) return false;
  if (value === true) return true;
  throw new Error(`${label} does not accept a value`);
}

function writeAtomic(filePath, content) {
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tempPath, content, "utf8");
  renameSync(tempPath, filePath);
}

const args = parseArgs(process.argv.slice(2));
if (!args["run-dir"]) throw new Error("--run-dir is required");
const runDir = resolveRunDir(args["run-dir"]);
if (!existsSync(runDir)) throw new Error("run directory and required files are missing");
const lock = acquireRunLock(runDir, {
  recoverStaleLock: parseBooleanFlag(args["recover-stale-lock"], "--recover-stale-lock")
});
try {
  const manifestPath = path.join(runDir, "run-manifest.json");
  const recordsPath = path.join(runDir, "records.jsonl");
  if (!existsSync(manifestPath) || !existsSync(recordsPath)) {
    throw new Error("run-manifest.json and records.jsonl are required");
  }
  const maxRowBytes = parseSafeInteger(args["max-record-row-bytes"] ?? DEFAULT_MAX_ROW_BYTES, "--max-record-row-bytes", { min: 1024, max: 1024 * 1024 });
  const core = loadCore();
  const runManifest = JSON.parse(readBounded(manifestPath, MAX_MANIFEST_BYTES, "run manifest"));
  const before = statSync(recordsPath);
  const beforeHash = fingerprintFile(recordsPath);
  const parsed = core.parseHostedEvaluationJsonLines(readFileSync(recordsPath, "utf8"), { maxRowBytes, allowLegacy: true });
  const after = statSync(recordsPath);
  const afterHash = fingerprintFile(recordsPath);
  if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || beforeHash !== afterHash) {
    parsed.integrity.valid = false;
    parsed.integrity.errors.push({ code: "records_changed_during_summary", lineNumber: null });
  }
  const summary = core.summarizeHostedEvaluation(parsed.records, runManifest, parsed.integrity);
  const report = core.renderHostedEvaluationReport(summary);
  writeAtomic(path.join(runDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  writeAtomic(path.join(runDir, "report.md"), report);
  console.log(`Face Lab hosted evaluation report regenerated: ${path.relative(process.cwd(), runDir).replace(/\\/g, "/")}`);
  console.log(`Gate: ${summary.gateStatus}; evaluationComplete=${summary.evaluationComplete}`);
} finally {
  lock.release();
}
