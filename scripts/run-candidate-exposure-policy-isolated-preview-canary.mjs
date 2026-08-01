import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateCandidateExposurePolicy } from "../lib/candidate-exposure-policy.js";
import {
  CANDIDATE_EXPOSURE_DIVERGENCE_CATEGORIES,
  compareCandidateExposurePolicyWithLegacy
} from "../lib/candidate-exposure-policy-observability.js";
import {
  CANDIDATE_EXPOSURES,
  CANDIDATE_EXPOSURE_LANES
} from "../lib/candidate-exposure-policy-contract.js";
import {
  reviewCandidateExposurePolicyIsolatedCanaryHarnessDesign
} from "../lib/candidate-exposure-policy-isolated-preview-canary-harness-design.js";
import {
  ISOLATED_CANARY_STOP_CONDITIONS,
  canExecuteIsolatedCanaryEntry,
  createIsolatedCanaryControl,
  stopIsolatedCanaryRun,
  transitionIsolatedCanaryControl
} from "../lib/candidate-exposure-policy-isolated-canary-control.js";
import {
  buildIsolatedCandidateProjection
} from "../lib/candidate-exposure-policy-isolated-projection.js";
import {
  buildIsolatedCanaryTelemetry,
  serializeIsolatedCanaryTelemetry,
  validateIsolatedCanaryTelemetry
} from "../lib/candidate-exposure-policy-isolated-canary-telemetry.js";
import {
  createIsolatedCanaryImplementationEvidence,
  serializeIsolatedCanaryImplementationEvidence,
  validateIsolatedCanaryImplementationEvidence
} from "../lib/candidate-exposure-policy-isolated-canary-evidence.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DESIGN_BASE_SHA = "d82f097ac49bf3d2fbfe68b0ee57b1f07c55953a";
const RUNTIME_IMPLEMENTATION_SHA = "1bc119347a2f8d3387a935163e24849ceebe349d";
const DESIGN_EVIDENCE_PATH = path.join(
  ROOT,
  "docs/verification/candidate-exposure-policy-isolated-preview-canary-harness-design.json"
);
const FIXTURE_MANIFEST_PATH = path.join(
  ROOT,
  "fixtures/candidate-exposure-policy-isolated-canary/manifest.v1.json"
);
const OUTPUT_PATH = path.join(
  ROOT,
  "tmp/stage11f-isolated-canary-implementation-evidence.json"
);

const RUNTIME_ROOTS = Object.freeze([
  "app/api/analyze/route.js",
  "lib/candidate-exposure-policy.js",
  "lib/candidate-exposure-policy-shadow.js",
  "lib/candidate-exposure-policy-observability.js",
  "lib/candidate-exposure-policy-divergence-diagnostics.js",
  "lib/skin-match-decision-engine.js"
]);

const EXACT_ALLOWED_PATHS = new Set([
  "lib/candidate-exposure-policy-isolated-canary-control.js",
  "lib/candidate-exposure-policy-isolated-projection.js",
  "lib/candidate-exposure-policy-isolated-canary-telemetry.js",
  "lib/candidate-exposure-policy-isolated-canary-evidence.js",
  "scripts/run-candidate-exposure-policy-isolated-preview-canary.mjs",
  "scripts/check-candidate-exposure-policy-isolated-canary-contract.mjs",
  "scripts/check-candidate-exposure-policy-isolated-canary-import-boundary.mjs",
  "docs/reviews/candidate-exposure-policy-isolated-canary-implementation-review.md",
  "docs/verification/candidate-exposure-policy-isolated-canary-implementation-result.md",
  ".github/workflows/stage11f-isolated-canary-final-validation.yml"
]);
const ALLOWED_PREFIXES = Object.freeze([
  "fixtures/candidate-exposure-policy-isolated-canary/"
]);

function parseMode(argv) {
  const modeIndex = argv.indexOf("--mode");
  if (modeIndex < 0 || argv[modeIndex + 1] !== "validate-only") {
    throw new Error("stage11f_runner_validate_only_mode_required");
  }
  if (argv.length !== 2) {
    throw new Error("stage11f_runner_unknown_argument");
  }
  return "validate-only";
}

function runGit(args) {
  const result = spawnSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (result.status !== 0) {
    throw new Error(`git_command_failed:${args.join(" ")}:${String(result.stderr || "").trim()}`);
  }
  return String(result.stdout || "").trim();
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort((left, right) => left.localeCompare(right, "en"))
      .map((key) => [key, stableValue(value[key])])
  );
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function loadJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function pathAllowed(filePath) {
  return EXACT_ALLOWED_PATHS.has(filePath) ||
    ALLOWED_PREFIXES.some((prefix) => filePath.startsWith(prefix));
}

function reviewImplementationScope(headSha) {
  const changedPaths = runGit([
    "diff",
    "--name-only",
    `${DESIGN_BASE_SHA}..${headSha}`
  ]).split("\n").map((value) => value.trim()).filter(Boolean);
  const disallowedPaths = changedPaths.filter((filePath) => !pathAllowed(filePath));
  return {
    allowed: disallowedPaths.length === 0,
    changedFileCount: changedPaths.length,
    disallowedPaths
  };
}

function extractRelativeImports(source) {
  const imports = new Set();
  const staticPattern = /(?:import|export)\s+(?:[^"']*?\s+from\s+)?["'](\.[^"']+)["']/g;
  const dynamicPattern = /import\(\s*["'](\.[^"']+)["']\s*\)/g;
  for (const pattern of [staticPattern, dynamicPattern]) {
    let match;
    while ((match = pattern.exec(source)) !== null) imports.add(match[1]);
  }
  return [...imports];
}

function resolveLocalImport(fromPath, specifier) {
  const raw = path.posix.normalize(path.posix.join(path.posix.dirname(fromPath), specifier));
  const candidates = path.posix.extname(raw)
    ? [raw]
    : [raw, `${raw}.js`, `${raw}.mjs`, `${raw}.json`, `${raw}/index.js`];
  return candidates.find((candidate) => existsSync(path.join(ROOT, candidate))) || null;
}

function baselineFile(filePath) {
  return runGit(["show", `${RUNTIME_IMPLEMENTATION_SHA}:${filePath}`]);
}

function attestRuntimeClosure() {
  const queue = [...RUNTIME_ROOTS];
  const visited = new Set();
  const changedFiles = [];

  while (queue.length) {
    const filePath = queue.shift();
    if (visited.has(filePath)) continue;
    visited.add(filePath);

    const absolutePath = path.join(ROOT, filePath);
    if (!existsSync(absolutePath)) {
      throw new Error(`runtime_attestation_current_file_missing:${filePath}`);
    }
    const current = readFileSync(absolutePath, "utf8");
    const baseline = baselineFile(filePath);
    if (Buffer.from(current).compare(Buffer.from(baseline)) !== 0) changedFiles.push(filePath);

    for (const specifier of extractRelativeImports(current)) {
      const resolved = resolveLocalImport(filePath, specifier);
      if (!resolved) throw new Error(`runtime_attestation_import_unresolved:${filePath}:${specifier}`);
      if (!visited.has(resolved)) queue.push(resolved);
    }
  }

  return {
    match: changedFiles.length === 0,
    closureFileCount: visited.size,
    changedRuntimeFileCount: changedFiles.length,
    changedFiles
  };
}

function exactMatrix(scenarios) {
  const entries = [];
  let sequence = 1;
  for (const locale of ["ko", "en"]) {
    for (const scenario of scenarios) {
      for (const mode of ["control", "canary"]) {
        entries.push({
          sequence,
          locale,
          scenario,
          mode,
          executeAfterStop: false
        });
        sequence += 1;
      }
    }
  }
  return entries;
}

function zeroCountMap(keys) {
  return Object.fromEntries(keys.map((key) => [key, 0]));
}

function normalizeCountMap(value, keys) {
  return Object.fromEntries(keys.map((key) => [key, value?.[key] || 0]));
}

function assertExpectedReasons(fixture, decisions) {
  const observed = new Set(decisions.flatMap((decision) => decision.reasonCodes || []));
  for (const reason of fixture.expectedReasonCodes || []) {
    if (!observed.has(reason)) {
      throw new Error(`fixture_expected_reason_missing:${fixture.scenario}:${reason}`);
    }
  }
}

function summarizeTelemetry(records) {
  return {
    recordCount: records.length,
    validRecordCount: records.filter((record) => validateIsolatedCanaryTelemetry(record).valid).length,
    unexpectedDivergenceCount: records.reduce((sum, record) => sum + record.unexpectedDivergenceCount, 0),
    unclassifiedDivergenceCount: records.reduce((sum, record) => sum + record.unclassifiedDivergenceCount, 0),
    shadowExceptionCount: records.reduce((sum, record) => sum + record.shadowExceptionCount, 0),
    fallbackCount: records.reduce((sum, record) => sum + record.fallbackCount, 0),
    invalidContextCount: records.reduce((sum, record) => sum + record.invalidContextCount, 0),
    mutationMismatchCount: records.filter((record) =>
      !record.responseFingerprintMatch ||
      !record.snapshotFingerprintMatch ||
      !record.candidateOrderMatch
    ).length
  };
}

function createControlTelemetry(entry, runtimeMatch) {
  return buildIsolatedCanaryTelemetry({
    runtimeImplementationShaMatch: runtimeMatch,
    fixtureScenario: entry.scenario,
    locale: entry.locale,
    mode: entry.mode,
    executionStatus: "validate_only_control_disabled",
    candidateCount: 0,
    exposureCounts: zeroCountMap(CANDIDATE_EXPOSURES),
    laneEligibilityCounts: zeroCountMap(CANDIDATE_EXPOSURE_LANES),
    divergenceCategoryCounts: zeroCountMap(CANDIDATE_EXPOSURE_DIVERGENCE_CATEGORIES),
    responseFingerprintMatch: true,
    snapshotFingerprintMatch: true,
    candidateOrderMatch: true,
    projectionFingerprintPresent: false,
    unexpectedDivergenceCount: 0,
    unclassifiedDivergenceCount: 0,
    shadowExceptionCount: 0,
    fallbackCount: 0,
    invalidContextCount: 0,
    stopCondition: null
  });
}

function createCanaryTelemetry(entry, fixture, runtimeMatch) {
  const canonicalState = structuredClone(fixture.canonicalState);
  const candidates = structuredClone(fixture.candidates);
  const canonicalBefore = stableStringify(canonicalState);
  const candidatesBefore = stableStringify(candidates);
  const candidateOrderBefore = candidates.map((candidate) => String(candidate.id || ""));
  const policyResult = evaluateCandidateExposurePolicy({ canonicalState, candidates });

  if (policyResult.status !== "evaluated") {
    throw new Error(`fixture_policy_not_evaluated:${fixture.scenario}`);
  }
  assertExpectedReasons(fixture, policyResult.decisions);

  const descriptors = candidates.map((candidate, sourceIndex) => ({
    candidateRef: String(candidate.id || candidate.productId || candidate.product_id || ""),
    sourceIndex
  }));
  const projection = buildIsolatedCandidateProjection({
    candidates: descriptors,
    decisions: policyResult.decisions
  });
  const comparison = compareCandidateExposurePolicyWithLegacy({
    decisions: policyResult.decisions,
    legacyExecution: policyResult.evaluatorExecution
  });
  const responseFingerprintMatch = canonicalBefore === stableStringify(canonicalState);
  const snapshotFingerprintMatch = candidatesBefore === stableStringify(candidates);
  const candidateOrderMatch = stableStringify(candidateOrderBefore) ===
    stableStringify(projection.memoryOnly.orderedCandidateRefs);
  const invalidContextCount = policyResult.decisions.filter((decision) =>
    decision.reasonCodes.some((reason) => [
      "invalid_context",
      "current_findings_missing",
      "current_findings_invalid"
    ].includes(reason))
  ).length;

  return buildIsolatedCanaryTelemetry({
    runtimeImplementationShaMatch: runtimeMatch,
    fixtureScenario: entry.scenario,
    locale: entry.locale,
    mode: entry.mode,
    executionStatus: "validate_only_simulation",
    candidateCount: projection.aggregate.candidateCount,
    exposureCounts: projection.aggregate.exposureCounts,
    laneEligibilityCounts: projection.aggregate.laneEligibilityCounts,
    divergenceCategoryCounts: normalizeCountMap(
      comparison.categoryCounts,
      CANDIDATE_EXPOSURE_DIVERGENCE_CATEGORIES
    ),
    responseFingerprintMatch,
    snapshotFingerprintMatch,
    candidateOrderMatch,
    projectionFingerprintPresent: typeof projection.fingerprint === "string" && projection.fingerprint.length === 64,
    unexpectedDivergenceCount: comparison.unexpectedDivergenceCount,
    unclassifiedDivergenceCount: comparison.unclassifiedDivergenceCount,
    shadowExceptionCount: 0,
    fallbackCount: 0,
    invalidContextCount,
    stopCondition: null
  });
}

function stopConditionForTelemetry(record) {
  if (!record.runtimeImplementationShaMatch) return "runtimeShaMismatch";
  if (record.unexpectedDivergenceCount > 0) return "unexpectedDivergence";
  if (record.unclassifiedDivergenceCount > 0) return "unclassifiedDivergence";
  if (record.shadowExceptionCount > 0) return "shadowException";
  if (record.fallbackCount > 0) return "fallback";
  if (record.invalidContextCount > 0) return "invalidContext";
  if (!record.responseFingerprintMatch) return "responseFingerprintMismatch";
  if (!record.snapshotFingerprintMatch) return "snapshotFingerprintMismatch";
  if (!record.candidateOrderMatch) return "candidateOrderMismatch";
  return null;
}

function main() {
  const mode = parseMode(process.argv.slice(2));
  const headSha = runGit(["rev-parse", "HEAD"]);
  const designEvidence = loadJson(DESIGN_EVIDENCE_PATH);
  const designReview = reviewCandidateExposurePolicyIsolatedCanaryHarnessDesign(designEvidence);
  if (designReview.status !== "design_ready_for_implementation_review") {
    throw new Error(`stage11e_design_not_ready:${designReview.blockers.join(",")}`);
  }

  const manifest = loadJson(FIXTURE_MANIFEST_PATH);
  if (manifest.actualUserData !== false) throw new Error("fixture_manifest_user_data_not_false");
  if (manifest.runtimeImplementationSha !== RUNTIME_IMPLEMENTATION_SHA) {
    throw new Error("fixture_manifest_runtime_sha_mismatch");
  }
  const expectedScenarios = [
    "standard_goal_alignment",
    "stabilization_active_block",
    "current_product_semantics",
    "metadata_incomplete"
  ];
  const scenarios = manifest.scenarios.map((fixture) => fixture.scenario);
  if (stableStringify(scenarios) !== stableStringify(expectedScenarios)) {
    throw new Error("fixture_manifest_scenarios_invalid");
  }
  const fixtureByScenario = new Map(manifest.scenarios.map((fixture) => [fixture.scenario, fixture]));
  const matrix = exactMatrix(expectedScenarios);
  const implementationScope = reviewImplementationScope(headSha);
  const runtimeAttestation = attestRuntimeClosure();
  const stopConditions = Object.fromEntries(
    ISOLATED_CANARY_STOP_CONDITIONS.map((key) => [key, true])
  );

  let control = createIsolatedCanaryControl({
    designStatus: designReview.status,
    stage11eDesignBaseSha: DESIGN_BASE_SHA,
    expectedStage11eDesignBaseSha: DESIGN_BASE_SHA,
    runtimeImplementationSha: RUNTIME_IMPLEMENTATION_SHA,
    expectedRuntimeImplementationSha: RUNTIME_IMPLEMENTATION_SHA,
    runtimeAttestationMatch: runtimeAttestation.match,
    implementationPathsAllowed: implementationScope.allowed,
    mode,
    maxAnalyzeRequests: 16,
    maxDurationMinutes: 60,
    stopConditions,
    networkAccessAllowed: false,
    hostedExecutionAllowed: false,
    productionAllowed: false
  });
  control = transitionIsolatedCanaryControl(control, { type: "authorize" });
  if (control.state !== "eligible") {
    throw new Error(`isolated_canary_authority_blocked:${control.authority.blockers.join(",")}`);
  }
  control = transitionIsolatedCanaryControl(control, { type: "start" });

  const telemetryRecords = [];
  const fixtureSemanticFingerprints = new Map();
  for (const entry of matrix) {
    if (!canExecuteIsolatedCanaryEntry(control, entry)) {
      throw new Error(`isolated_canary_entry_not_executable:${entry.sequence}`);
    }
    const fixture = fixtureByScenario.get(entry.scenario);
    const semanticFingerprint = sha256(stableStringify({
      scenario: fixture.scenario,
      semanticVersion: fixture.semanticVersion,
      canonicalState: fixture.canonicalState,
      candidates: fixture.candidates,
      expectedReasonCodes: fixture.expectedReasonCodes
    }));
    const previousFingerprint = fixtureSemanticFingerprints.get(entry.scenario);
    if (previousFingerprint && previousFingerprint !== semanticFingerprint) {
      throw new Error(`fixture_semantic_fingerprint_drift:${entry.scenario}`);
    }
    fixtureSemanticFingerprints.set(entry.scenario, semanticFingerprint);

    const telemetry = entry.mode === "control"
      ? createControlTelemetry(entry, runtimeAttestation.match)
      : createCanaryTelemetry(entry, fixture, runtimeAttestation.match);
    const validation = validateIsolatedCanaryTelemetry(telemetry);
    if (!validation.valid) {
      throw new Error(`isolated_canary_telemetry_invalid:${entry.sequence}:${validation.errors.join(",")}`);
    }
    serializeIsolatedCanaryTelemetry(telemetry);
    telemetryRecords.push(telemetry);

    const stopCondition = stopConditionForTelemetry(telemetry);
    if (stopCondition) {
      control = stopIsolatedCanaryRun(control, stopCondition);
      throw new Error(`isolated_canary_stopped:${stopCondition}`);
    }
    control = transitionIsolatedCanaryControl(control, { type: "record_entry" });
  }
  control = transitionIsolatedCanaryControl(control, { type: "complete" });
  if (control.state !== "completed") {
    throw new Error(`isolated_canary_control_not_completed:${control.state}`);
  }

  const telemetrySummary = summarizeTelemetry(telemetryRecords);
  const evidence = createIsolatedCanaryImplementationEvidence({
    designVersion: designEvidence.design.version,
    planVersion: "candidate-exposure-policy-limited-preview-canary-plan-v1",
    stage11eDesignBaseSha: DESIGN_BASE_SHA,
    runtimeImplementationSha: RUNTIME_IMPLEMENTATION_SHA,
    harnessImplementationSha: headSha,
    mode,
    plannedEntryCount: 16,
    completedEntryCount: control.completedEntries,
    controlEntryCount: matrix.filter((entry) => entry.mode === "control").length,
    canaryEntryCount: matrix.filter((entry) => entry.mode === "canary").length,
    fixtureScenarioCount: expectedScenarios.length,
    localeCount: 2,
    runtimeAttestation: {
      match: runtimeAttestation.match,
      closureFileCount: runtimeAttestation.closureFileCount,
      changedRuntimeFileCount: runtimeAttestation.changedRuntimeFileCount
    },
    implementationScope,
    matrix: {
      exact: matrix.length === 16 && matrix.every((entry, index) => entry.sequence === index + 1),
      sequenceCount: matrix.length,
      scenarioCount: expectedScenarios.length,
      localeCount: 2,
      modeCount: 2
    },
    telemetrySummary,
    cleanup: {
      temporaryFileResidue: 0,
      networkOperationCount: 0,
      hostedOperationCount: 0,
      productionChangeCount: 0
    },
    status: "implementation_ready_for_hosted_execution_review"
  });
  const evidenceValidation = validateIsolatedCanaryImplementationEvidence(evidence);
  if (!evidenceValidation.valid) {
    throw new Error(`isolated_canary_evidence_invalid:${evidenceValidation.errors.join(",")}`);
  }

  mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, serializeIsolatedCanaryImplementationEvidence(evidence), "utf8");
  console.log(JSON.stringify({
    status: evidence.status,
    harnessImplementationSha: headSha,
    runtimeImplementationSha: RUNTIME_IMPLEMENTATION_SHA,
    runtimeClosureFileCount: runtimeAttestation.closureFileCount,
    changedRuntimeFileCount: runtimeAttestation.changedRuntimeFileCount,
    implementationChangedFileCount: implementationScope.changedFileCount,
    completedEntryCount: control.completedEntries,
    telemetryRecordCount: telemetrySummary.recordCount,
    unexpectedDivergenceCount: telemetrySummary.unexpectedDivergenceCount,
    networkOperationCount: evidence.cleanup.networkOperationCount,
    hostedOperationCount: evidence.cleanup.hostedOperationCount,
    productionChangeCount: evidence.cleanup.productionChangeCount
  }, null, 2));
}

main();
