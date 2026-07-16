import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  hardenHostedEvaluationRecord,
  hardenHostedEvaluationReport,
  hardenHostedEvaluationSummary
} from "../lib/face-lab-hosted-evaluation-review.js";

function loadCore() {
  const source = readFileSync("lib/face-lab-hosted-evaluation.js", "utf8")
    .replace(/export const /g, "const ")
    .replace(/export function /g, "function ");
  return Function(`${source}\nreturn { validateHostedEvaluationManifest, buildHostedEvaluationCases, projectHostedEvaluationRecord, getPendingHostedEvaluationCases, createHostedEvaluationRunManifest, summarizeHostedEvaluation, renderHostedEvaluationReport };`)();
}

function parseArgs(argv) {
  const output = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    output[key] = next && !next.startsWith("--") ? argv[++index] : true;
  }
  return output;
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function readJsonLines(filePath) {
  if (!existsSync(filePath)) return [];
  return readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function getMimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  return "image/jpeg";
}

function getUploadFilename(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return `fixture-image${extension || ".jpg"}`;
}

const args = parseArgs(process.argv.slice(2));
if (!args.manifest) {
  throw new Error("--manifest is required");
}
const plan = args.plan || "smoke";
const repetitions = Number(args.repetitions || 1);
const maxCalls = Number(args["max-calls"] || 20);
const baseUrl = String(args["base-url"] || "http://localhost:3001").replace(/\/$/, "");
const locales = args.locales ? String(args.locales).split(",").map((item) => item.trim()) : undefined;
const runId = args["run-id"] || `face-lab-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
const runDir = path.resolve(args["run-dir"] || path.join("tmp", "face-lab-hosted-evaluation", runId));
const repoRoot = process.cwd();
const core = loadCore();
const manifest = core.validateHostedEvaluationManifest(readJson(path.resolve(args.manifest)), {
  repoRoot,
  pathApi: path,
  fileExists: existsSync,
  requireImageFiles: true
});
const planResult = core.buildHostedEvaluationCases(manifest, {
  plan,
  locales,
  repetitions,
  maxCalls
});

console.log(`[face-lab-eval] dataset=${manifest.datasetId} plan=${plan}`);
console.log(`[face-lab-eval] planned calls=${planResult.plannedCalls} max=${maxCalls}`);
console.log(`[face-lab-eval] output=${path.relative(repoRoot, runDir).replace(/\\/g, "/")}`);
if (args.confirm !== "RUN") {
  throw new Error("Review the planned call count, then rerun with --confirm RUN");
}

mkdirSync(runDir, { recursive: true });
const runManifestPath = path.join(runDir, "run-manifest.json");
const recordsPath = path.join(runDir, "records.jsonl");
const summaryPath = path.join(runDir, "summary.json");
const reportPath = path.join(runDir, "report.md");
const runManifest = core.createHostedEvaluationRunManifest({
  runId,
  datasetId: manifest.datasetId,
  plan,
  locales: planResult.locales,
  repetitions,
  maxCalls,
  plannedCalls: planResult.plannedCalls,
  baseUrl
});
if (!existsSync(runManifestPath)) {
  writeFileSync(runManifestPath, `${JSON.stringify(runManifest, null, 2)}\n`, "utf8");
}
const existingRecords = readJsonLines(recordsPath);
const pendingCases = core.getPendingHostedEvaluationCases(planResult.cases, existingRecords);
console.log(`[face-lab-eval] completed=${existingRecords.length} pending=${pendingCases.length}`);

for (const item of pendingCases) {
  const startedAt = Date.now();
  let httpStatus = null;
  let payload = null;
  let requestError = null;
  try {
    const bytes = readFileSync(item.imagePath);
    const formData = new FormData();
    formData.append("locale", item.locale);
    formData.append(
      "image",
      new Blob([bytes], { type: getMimeType(item.imagePath) }),
      getUploadFilename(item.imagePath)
    );
    const response = await fetch(`${baseUrl}/api/face-reading`, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(Number(args["timeout-ms"] || 120000))
    });
    httpStatus = response.status;
    const text = await response.text();
    payload = text ? JSON.parse(text) : null;
  } catch (error) {
    requestError = error instanceof Error ? error.name : "request_failed";
  }
  const record = hardenHostedEvaluationRecord(
    core.projectHostedEvaluationRecord({
      runId,
      caseDefinition: item,
      httpStatus,
      durationMs: Date.now() - startedAt,
      responsePayload: payload,
      requestError
    }),
    payload
  );
  appendFileSync(recordsPath, `${JSON.stringify(record)}\n`, "utf8");
  console.log(`[face-lab-eval] ${item.caseId} -> ${record.envelopeStatus || requestError || "invalid"}`);
}

const records = readJsonLines(recordsPath);
const summary = hardenHostedEvaluationSummary(
  records,
  core.summarizeHostedEvaluation(records, runManifest)
);
const report = hardenHostedEvaluationReport(
  core.renderHostedEvaluationReport(summary),
  summary
);
writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
writeFileSync(reportPath, report, "utf8");
console.log(`[face-lab-eval] complete hardInvariantFailures=${summary.hardInvariantFailures}`);
console.log(`[face-lab-eval] summary=${path.relative(repoRoot, summaryPath).replace(/\\/g, "/")}`);
