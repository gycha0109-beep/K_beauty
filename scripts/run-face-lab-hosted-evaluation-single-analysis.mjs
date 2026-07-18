import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync
} from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import {
  acquireRunLock,
  executeFaceLabEvaluationRequest,
  parseSafeInteger,
  readValidatedImageFile,
  resolveFaceLabEvaluationEndpoint,
  sanitizeCaseId
} from "../lib/face-lab-hosted-evaluation-transport.mjs";
import {
  buildHostedEvaluationProviderGroups,
  createSharedHostedEvaluationTransport,
  selectPendingHostedEvaluationProviderGroups
} from "../lib/face-lab-hosted-evaluation-groups.mjs";

const EXECUTION_MODEL = "single_provider_call_per_fixture_repetition_v1";

function fatalReasonCode(error) {
  const message = String(error?.message || "");
  if (message.includes("manifest exceeds")) return "manifest_size_exceeded";
  if (message.includes("run lock already exists")) return "run_lock_exists";
  if (message.includes("records.jsonl integrity")) return "records_integrity_invalid";
  if (message.includes("--confirm RUN")) return "confirmation_required";
  if (message.includes("--base-url")) return "base_url_invalid";
  if (message.includes("image")) return "fixture_image_invalid";
  if (message.includes("run manifest")) return "run_manifest_invalid";
  if (message.includes("provider call count")) return "provider_call_budget_exceeded";
  return "execution_failed";
}

let fatalHandled = false;
function handleFatal(error) {
  if (fatalHandled) return;
  fatalHandled = true;
  console.error(`[face-lab-eval] failed=${fatalReasonCode(error)}`);
  process.exitCode = 1;
}
process.on("uncaughtException", handleFatal);
process.on("unhandledRejection", handleFatal);

const DEFAULTS = Object.freeze({
  delayMs: 1500,
  timeoutMs: 120000,
  maxCalls: 20,
  maxRetriesPerCase: 1,
  maxRetryWaitMs: 120000,
  maxImageBytes: 15 * 1024 * 1024,
  maxResponseBytes: 2 * 1024 * 1024,
  maxManifestBytes: 1024 * 1024,
  maxRecordsRowBytes: 256 * 1024
});
const HARD_MAX = Object.freeze({
  delayMs: 120000,
  timeoutMs: 10 * 60 * 1000,
  maxCalls: 500,
  maxLogicalCases: 500,
  maxAttempts: 1000,
  maxRetriesPerCase: 3,
  maxRetryWaitMs: 10 * 60 * 1000,
  maxImageBytes: 50 * 1024 * 1024,
  maxResponseBytes: 8 * 1024 * 1024
});

function loadCore() {
  const source = readFileSync("lib/face-lab-hosted-evaluation.js", "utf8")
    .replace(/export const /g, "const ")
    .replace(/export function /g, "function ");
  return Function(`${source}\nreturn { validateHostedEvaluationManifest, buildHostedEvaluationCases, projectHostedEvaluationRecord, createNotAttemptedHostedEvaluationRecord, parseHostedEvaluationJsonLines, getPendingHostedEvaluationCases, getNextHostedEvaluationAttemptSequence, createHostedEvaluationRunManifest, summarizeHostedEvaluation, renderHostedEvaluationReport };`)();
}

function parseArgs(argv) {
  const output = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) throw new Error(`unexpected positional argument: ${token}`);
    const key = token.slice(2);
    const next = argv[index + 1];
    output[key] = next && !next.startsWith("--") ? argv[++index] : true;
  }
  return output;
}

function parseBooleanFlag(value, label) {
  if (value === undefined) return false;
  if (value === true) return true;
  throw new Error(`${label} does not accept a value`);
}

function readBoundedText(filePath, maxBytes, label) {
  const size = statSync(filePath).size;
  if (size > maxBytes) throw new Error(`${label} exceeds ${maxBytes} bytes`);
  return readFileSync(filePath, "utf8");
}

function fingerprintFile(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function writeTextAtomic(filePath, content) {
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tempPath, content, "utf8");
  renameSync(tempPath, filePath);
}

function appendJsonLine(filePath, value, maxRowBytes) {
  const line = `${JSON.stringify(value)}\n`;
  if (Buffer.byteLength(line, "utf8") > maxRowBytes) {
    throw new Error("records JSONL row exceeds max row size");
  }
  appendFileSync(filePath, line, "utf8");
}

function resolveEvaluationRunDir(repoRoot, value, runId) {
  const evaluationRoot = path.resolve(repoRoot, "tmp", "face-lab-hosted-evaluation");
  const resolved = path.resolve(repoRoot, value || path.join("tmp", "face-lab-hosted-evaluation", runId));
  const relative = path.relative(evaluationRoot, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("--run-dir must stay inside tmp/face-lab-hosted-evaluation/");
  }
  return resolved;
}

function getUploadFilename(mimeType) {
  if (mimeType === "image/png") return "fixture-image.png";
  if (mimeType === "image/webp") return "fixture-image.webp";
  return "fixture-image.jpg";
}

function readRunRecords(core, recordsPath, maxRowBytes) {
  if (!existsSync(recordsPath)) {
    return { records: [], integrity: { valid: true, errors: [], lastRecordSequence: 0, endsWithNewline: true } };
  }
  return core.parseHostedEvaluationJsonLines(readFileSync(recordsPath, "utf8"), {
    maxRowBytes,
    allowLegacy: true
  });
}

function buildOutputs(core, recordsResult, runManifest) {
  const summary = core.summarizeHostedEvaluation(recordsResult.records, runManifest, recordsResult.integrity);
  const providerRequestRecords = recordsResult.records.filter((record) => (record?.transport?.attemptCount || 0) > 0).length;
  const providerAttempts = recordsResult.records.reduce((sum, record) => sum + (record?.transport?.attemptCount || 0), 0);

  summary.providerExecution = {
    executionModel: EXECUTION_MODEL,
    plannedProviderCalls: runManifest.plannedProviderCalls,
    providerRequestRecords,
    providerAttempts,
    logicalCasesPerProviderCall: runManifest.plannedProviderCalls
      ? runManifest.plannedCalls / runManifest.plannedProviderCalls
      : null
  };
  summary.localeAgreement = {
    statusComparisons: 0,
    statusAgreement: null,
    valueComparisons: 0,
    valueAgreement: null
  };
  summary.localeAgreementMode = "not_independently_measured_shared_canonical_analysis";

  const providerReport = [
    "",
    "## Provider execution",
    "",
    `- Execution model: ${EXECUTION_MODEL}`,
    `- Planned provider calls: ${runManifest.plannedProviderCalls}`,
    `- Provider request records: ${providerRequestRecords}`,
    `- Provider attempts including retries: ${providerAttempts}`,
    "- Locale agreement: not independently measured because locale records share one canonical provider analysis.",
    ""
  ].join("\n");

  return {
    summary,
    report: `${core.renderHostedEvaluationReport(summary)}${providerReport}`
  };
}

function assertExistingRunManifest(existing, expected) {
  for (const key of [
    "runId",
    "datasetId",
    "plan",
    "plannedCalls",
    "plannedProviderCalls",
    "executionModel"
  ]) {
    if (existing?.[key] !== expected?.[key]) {
      throw new Error(`existing run manifest ${key} does not match requested run`);
    }
  }
}

function appendRecord({ recordsPath, recordsResult, record, maxRowBytes }) {
  appendJsonLine(recordsPath, record, maxRowBytes);
  recordsResult.records.push(record);
  recordsResult.integrity.lastRecordSequence = record.recordSequence;
  console.log(`[face-lab-eval] ${sanitizeCaseId(record.caseId)} -> ${record.transport.status}`);
}

const args = parseArgs(process.argv.slice(2));
if (!args.manifest) throw new Error("--manifest is required");
const repoRoot = process.cwd();
const core = loadCore();
const plan = args.plan || "smoke";
const repetitions = parseSafeInteger(args.repetitions ?? 1, "--repetitions", { min: 1, max: 10 });
const maxCalls = parseSafeInteger(args["max-calls"] ?? DEFAULTS.maxCalls, "--max-calls", { min: 1, max: HARD_MAX.maxCalls });
const maxAttempts = parseSafeInteger(args["max-attempts"] ?? Math.min(HARD_MAX.maxAttempts, maxCalls * 2), "--max-attempts", { min: 1, max: HARD_MAX.maxAttempts });
const maxRetriesPerCase = parseSafeInteger(args["max-retries-per-case"] ?? DEFAULTS.maxRetriesPerCase, "--max-retries-per-case", { min: 0, max: HARD_MAX.maxRetriesPerCase });
const maxRetryWaitMs = parseSafeInteger(args["max-retry-wait-ms"] ?? DEFAULTS.maxRetryWaitMs, "--max-retry-wait-ms", { min: 0, max: HARD_MAX.maxRetryWaitMs });
const delayMs = parseSafeInteger(args["delay-ms"] ?? DEFAULTS.delayMs, "--delay-ms", { min: 0, max: HARD_MAX.delayMs });
const timeoutMs = parseSafeInteger(args["timeout-ms"] ?? DEFAULTS.timeoutMs, "--timeout-ms", { min: 1000, max: HARD_MAX.timeoutMs });
const maxImageBytes = parseSafeInteger(args["max-image-bytes"] ?? DEFAULTS.maxImageBytes, "--max-image-bytes", { min: 1024, max: HARD_MAX.maxImageBytes });
const maxResponseBytes = parseSafeInteger(args["max-response-bytes"] ?? DEFAULTS.maxResponseBytes, "--max-response-bytes", { min: 1024, max: HARD_MAX.maxResponseBytes });
const retry429WithoutHint = parseBooleanFlag(args["retry-429-without-hint"], "--retry-429-without-hint");
const retryAmbiguousFailures = parseBooleanFlag(args["retry-ambiguous-failures"], "--retry-ambiguous-failures");
const recoverStaleLock = parseBooleanFlag(args["recover-stale-lock"], "--recover-stale-lock");
const locales = args.locales ? String(args.locales).split(",").map((item) => item.trim()) : undefined;
const selectedLocaleCount = new Set(locales || ["ko", "en"]).size;
const logicalCaseBudget = Math.min(HARD_MAX.maxLogicalCases, maxCalls * selectedLocaleCount);
const { baseUrl, endpoint, origin } = resolveFaceLabEvaluationEndpoint(args["base-url"] || "http://localhost:3001");
let runId = args["run-id"] || `face-lab-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
const runDir = resolveEvaluationRunDir(repoRoot, args["run-dir"], runId);
const preexistingRunManifestPath = path.join(runDir, "run-manifest.json");
let preexistingRunManifest = null;
if (args["run-dir"] && existsSync(preexistingRunManifestPath)) {
  preexistingRunManifest = JSON.parse(readBoundedText(preexistingRunManifestPath, DEFAULTS.maxManifestBytes, "run manifest"));
  if (!args["run-id"] && typeof preexistingRunManifest.runId === "string") runId = preexistingRunManifest.runId;
}
const manifestPath = path.resolve(String(args.manifest));
const manifestText = readBoundedText(manifestPath, DEFAULTS.maxManifestBytes, "manifest");
const manifest = core.validateHostedEvaluationManifest(JSON.parse(manifestText), {
  repoRoot,
  pathApi: path,
  fsApi: { existsSync, realpathSync: (await import("node:fs")).realpathSync, statSync },
  requireImageFiles: true
});
const planResult = core.buildHostedEvaluationCases(manifest, {
  plan,
  locales,
  repetitions,
  maxCalls: logicalCaseBudget
});
const providerGroups = buildHostedEvaluationProviderGroups(planResult.cases, {
  maxProviderCalls: maxCalls
});

console.log(`[face-lab-eval] dataset=${manifest.datasetId} plan=${plan}`);
console.log(`[face-lab-eval] planned-cases=${planResult.plannedCalls} planned-provider-calls=${providerGroups.length} max-provider-calls=${maxCalls} max-attempts=${maxAttempts}`);
console.log(`[face-lab-eval] output=${path.relative(repoRoot, runDir).replace(/\\/g, "/")}`);
if (args.confirm !== "RUN") throw new Error("Review the planned call count, then rerun with --confirm RUN");

mkdirSync(runDir, { recursive: true });
const lock = acquireRunLock(runDir, { recoverStaleLock });
try {
  const runManifestPath = path.join(runDir, "run-manifest.json");
  const recordsPath = path.join(runDir, "records.jsonl");
  const summaryPath = path.join(runDir, "summary.json");
  const reportPath = path.join(runDir, "report.md");
  const requestedRunManifest = {
    ...core.createHostedEvaluationRunManifest({
      runId,
      datasetId: manifest.datasetId,
      plan,
      locales: planResult.locales,
      repetitions,
      maxCalls,
      maxAttempts,
      plannedCalls: planResult.plannedCalls,
      baseUrl
    }),
    executionModel: EXECUTION_MODEL,
    plannedProviderCalls: providerGroups.length
  };
  let runManifest = requestedRunManifest;
  if (existsSync(runManifestPath)) {
    runManifest = preexistingRunManifest || JSON.parse(readBoundedText(runManifestPath, DEFAULTS.maxManifestBytes, "run manifest"));
    assertExistingRunManifest(runManifest, requestedRunManifest);
  } else {
    writeTextAtomic(runManifestPath, `${JSON.stringify(requestedRunManifest, null, 2)}\n`);
  }

  let recordsResult = readRunRecords(core, recordsPath, DEFAULTS.maxRecordsRowBytes);
  if (!recordsResult.integrity.valid) {
    const outputs = buildOutputs(core, recordsResult, runManifest);
    writeTextAtomic(summaryPath, `${JSON.stringify(outputs.summary, null, 2)}\n`);
    writeTextAtomic(reportPath, outputs.report);
    throw new Error("records.jsonl integrity is invalid; no requests were attempted");
  }

  const pendingCases = core.getPendingHostedEvaluationCases(planResult.cases, recordsResult.records);
  const pendingGroups = selectPendingHostedEvaluationProviderGroups(providerGroups, pendingCases);
  const existingAttemptCount = recordsResult.records.reduce((sum, record) => sum + (record?.transport?.attemptCount || 0), 0);
  let attemptBudgetUsed = existingAttemptCount;
  let nextRecordSequence = recordsResult.integrity.lastRecordSequence + 1;
  let circuitOpen = false;
  console.log(`[face-lab-eval] final-records=${planResult.plannedCalls - pendingCases.length} pending=${pendingCases.length} pending-provider-calls=${pendingGroups.length}`);

  for (let groupIndex = 0; groupIndex < pendingGroups.length; groupIndex += 1) {
    const group = pendingGroups[groupIndex];

    if (circuitOpen || attemptBudgetUsed >= maxAttempts) {
      const reasonCode = circuitOpen ? "rate_limit_circuit_open" : "max_attempts_reached";
      for (const item of group.pendingCases) {
        const record = core.createNotAttemptedHostedEvaluationRecord({
          runId,
          caseDefinition: item,
          recordSequence: nextRecordSequence,
          attemptSequence: core.getNextHostedEvaluationAttemptSequence(item.caseId, recordsResult.records),
          reasonCode
        });
        appendRecord({
          recordsPath,
          recordsResult,
          record,
          maxRowBytes: DEFAULTS.maxRecordsRowBytes
        });
        nextRecordSequence += 1;
      }
      continue;
    }

    const image = readValidatedImageFile(group.imagePath, {
      declaredMime: group.declaredMime,
      maxImageBytes
    });
    const remainingAttempts = maxAttempts - attemptBudgetUsed;
    const result = await executeFaceLabEvaluationRequest({
      endpoint,
      expectedOrigin: origin,
      timeoutMs,
      maxResponseBytes,
      maxAttemptsRemaining: Math.min(remainingAttempts, maxRetriesPerCase + 1),
      maxRetriesPerCase,
      maxRetryWaitMs,
      retry429WithoutHint,
      retryAmbiguousFailures,
      formDataFactory: () => {
        const formData = new FormData();
        formData.append("locale", group.providerLocale);
        formData.append("image", new Blob([image.bytes], { type: image.mimeType }), getUploadFilename(image.mimeType));
        return formData;
      }
    });
    attemptBudgetUsed += result.transport.attemptCount;

    for (let caseIndex = 0; caseIndex < group.pendingCases.length; caseIndex += 1) {
      const item = group.pendingCases[caseIndex];
      const transport = caseIndex === 0
        ? result.transport
        : createSharedHostedEvaluationTransport(result.transport);
      const record = core.projectHostedEvaluationRecord({
        runId,
        caseDefinition: item,
        recordSequence: nextRecordSequence,
        attemptSequence: core.getNextHostedEvaluationAttemptSequence(item.caseId, recordsResult.records),
        isFinal: true,
        transport,
        responsePayload: result.payload
      });
      appendRecord({
        recordsPath,
        recordsResult,
        record,
        maxRowBytes: DEFAULTS.maxRecordsRowBytes
      });
      nextRecordSequence += 1;
    }

    console.log(`[face-lab-eval] provider-group=${sanitizeCaseId(group.providerGroupId)} locale=${group.providerLocale} logical-cases=${group.pendingCases.length} status=${result.transport.status}`);
    if (result.transport.status === "rate_limited") circuitOpen = true;
    if (!circuitOpen && delayMs > 0 && groupIndex < pendingGroups.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  const beforeStat = existsSync(recordsPath) ? statSync(recordsPath) : null;
  const beforeHash = beforeStat ? fingerprintFile(recordsPath) : null;
  recordsResult = readRunRecords(core, recordsPath, DEFAULTS.maxRecordsRowBytes);
  const afterStat = existsSync(recordsPath) ? statSync(recordsPath) : null;
  const afterHash = afterStat ? fingerprintFile(recordsPath) : null;
  if (beforeStat && afterStat && (beforeStat.size !== afterStat.size || beforeStat.mtimeMs !== afterStat.mtimeMs || beforeHash !== afterHash)) {
    recordsResult.integrity.valid = false;
    recordsResult.integrity.errors.push({ code: "records_changed_during_summary", lineNumber: null });
  }
  const outputs = buildOutputs(core, recordsResult, runManifest);
  writeTextAtomic(summaryPath, `${JSON.stringify(outputs.summary, null, 2)}\n`);
  writeTextAtomic(reportPath, outputs.report);
  console.log(`[face-lab-eval] gate=${outputs.summary.gateStatus} evaluation-complete=${outputs.summary.evaluationComplete}`);
  console.log(`[face-lab-eval] summary=${path.relative(repoRoot, summaryPath).replace(/\\/g, "/")}`);
} finally {
  lock.release();
}
