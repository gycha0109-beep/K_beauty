import { readFile } from "node:fs/promises";
import {
  assertHostedArtifactsSafe,
  buildHostedRunManifest,
  evaluateHostedVerdict,
  loadDeploymentAttestation,
  loadHostedManifest,
  parseHostedConfig,
  writeHostedArtifacts,
  HOSTED_FAILURE_CATEGORIES
} from "./premium-hosted-preview-core-v2.mjs";
import { assertPathInside } from "./premium-hosted-preview-security.mjs";
import { requireCondition } from "./premium-browser-journey-core.mjs";

const config = parseHostedConfig();
const manifest = await loadHostedManifest(config.manifestPath);
const attestation = await loadDeploymentAttestation(config, manifest);

async function readJsonEnv(name) {
  const input = String(process.env[name] || "").trim();
  requireCondition(input, HOSTED_FAILURE_CATEGORIES.PRECONDITION, "gate", `${name.toLowerCase()}_missing`);
  const path = assertPathInside(
    config.securePaths.credentialsDir,
    input,
    `${name.toLowerCase()}_outside_secure_root`
  );
  return JSON.parse(await readFile(path, "utf8"));
}

function requireHostedBinding(document, label) {
  requireCondition(
    document?.status === "passed" &&
      document?.runId === config.runId &&
      document?.prNumber === config.prNumber &&
      document?.deploymentId === attestation.vercelDeploymentId &&
      document?.deploymentSha === attestation.prHeadSha &&
      document?.immutableHost === attestation.immutableHost,
    HOSTED_FAILURE_CATEGORIES.PREVIEW_ATTESTATION,
    "gate",
    `${label}_attestation_mismatch`
  );
}

const preflight = await readJsonEnv("PREMIUM_HOSTED_PREFLIGHT_RESULT_PATH");
const ui = await readJsonEnv("PREMIUM_HOSTED_UI_RESULT_PATH");
const errors = await readJsonEnv("PREMIUM_HOSTED_ERROR_RESULT_PATH");
const dbEvidence = await readJsonEnv("PREMIUM_HOSTED_DB_RESULT_PATH");
const browserStepsDocument = await readJsonEnv("PREMIUM_HOSTED_BROWSER_STEPS_PATH");
const browserManifest = await readJsonEnv("PREMIUM_HOSTED_BROWSER_MANIFEST_PATH");
const browserVerdict = await readJsonEnv("PREMIUM_HOSTED_BROWSER_VERDICT_PATH");
const browserSteps = Array.isArray(browserStepsDocument) ? browserStepsDocument : browserStepsDocument.steps;
requireCondition(Array.isArray(browserSteps), HOSTED_FAILURE_CATEGORIES.HARNESS, "gate", "browser_steps_invalid");

requireHostedBinding(preflight, "preflight");
requireHostedBinding(ui, "ui");
requireHostedBinding(errors, "errors");
requireHostedBinding(dbEvidence, "db_evidence");
requireCondition(
  browserManifest?.runId === config.runId &&
    browserManifest?.environment === "preview" &&
    browserManifest?.targetHost === attestation.immutableHost &&
    browserManifest?.targetGitSha === attestation.prHeadSha &&
    browserManifest?.expectedGitSha === attestation.prHeadSha &&
    browserManifest?.accountHash === manifest.accountA.expectedUserIdHash &&
    browserManifest?.conflictAccountHash === manifest.accountB.expectedUserIdHash,
  HOSTED_FAILURE_CATEGORIES.PREVIEW_ATTESTATION,
  "gate",
  "browser_manifest_binding_mismatch"
);
requireCondition(
  browserVerdict?.passed === true &&
    browserVerdict?.failure == null &&
    Array.isArray(browserVerdict?.checks) &&
    browserVerdict.checks.length > 0 &&
    browserVerdict.checks.every((check) => check?.passed === true),
  HOSTED_FAILURE_CATEGORIES.HARNESS,
  "gate",
  "browser_verdict_failed"
);

const stepCounts = new Map();
for (const step of browserSteps) {
  const name = String(step?.name || "");
  requireCondition(name, HOSTED_FAILURE_CATEGORIES.HARNESS, "gate", "browser_step_name_missing");
  stepCounts.set(name, (stepCounts.get(name) || 0) + 1);
}
requireCondition(
  [...stepCounts.values()].every((count) => count === 1),
  HOSTED_FAILURE_CATEGORIES.HARNESS,
  "gate",
  "browser_step_duplicate"
);

const lanes = [
  { name: "preflight", severity: "critical", status: "passed" },
  ...(ui.lanes || []),
  ...(errors.lanes || [])
];

function browserLane(name, expectedNames, severity = "important") {
  const matched = expectedNames.map((expectedName) => browserSteps.find((step) => step?.name === expectedName));
  return {
    name,
    severity,
    status: matched.every((step) => step?.status === "passed") ? "passed" : "failed",
    evidence: {
      expectedStepCount: expectedNames.length,
      matchedStepCount: matched.filter(Boolean).length
    }
  };
}

lanes.push(
  browserLane("persistence", [
    "ko:first-save",
    "ko:identical-retry",
    "ko:saved-reopen",
    "en:first-save",
    "en:identical-retry",
    "en:saved-reopen"
  ]),
  browserLane("finalized-conflict", ["ko:finalized-conflict", "en:finalized-conflict"]),
  browserLane("session-rotation", ["ko:rotation", "ko:second-save", "en:rotation", "en:second-save"]),
  browserLane("principal-conflict", ["ko:principal-conflict", "en:principal-conflict"], "critical")
);

requireCondition(
  Array.isArray(ui.lanes) && ui.lanes.length === 9 && ui.createdReportCount === 7,
  HOSTED_FAILURE_CATEGORIES.HARNESS,
  "gate",
  "ui_lane_count_invalid"
);
requireCondition(
  Array.isArray(errors.lanes) && errors.lanes.length === 4,
  HOSTED_FAILURE_CATEGORIES.HARNESS,
  "gate",
  "error_lane_count_invalid"
);
requireCondition(
  dbEvidence.duplicateTupleCount === 0 &&
    dbEvidence.cleanupManifestCreated === true &&
    /^[0-9a-f]{64}$/i.test(dbEvidence.cleanupManifestHash || "") &&
    /^[0-9a-f]{64}$/i.test(dbEvidence.browserPersistenceHash || "") &&
    /^[0-9a-f]{64}$/i.test(dbEvidence.uiEvidenceHash || "") &&
    Array.isArray(dbEvidence.rows) &&
    dbEvidence.rows.length === 11 &&
    dbEvidence.rows.every((row) =>
      row.ownerMatches === true &&
      row.sourceSessionHash &&
      row.savedReportIdHash &&
      row.sourceType === "premium_report_session"
    ),
  HOSTED_FAILURE_CATEGORIES.PERSISTENCE,
  "gate",
  "db_evidence_failed"
);
const verdict = evaluateHostedVerdict(lanes);
requireCondition(
  verdict.status === "passed" && verdict.criticalCount === 0 && verdict.importantCount === 0,
  HOSTED_FAILURE_CATEGORIES.HARNESS,
  "gate",
  "hosted_preview_gate_failed"
);

const runManifest = buildHostedRunManifest(config, manifest, attestation);
const summary = `# Premium Hosted Preview Verification\n\n- Run: ${config.runId}\n- PR: ${config.prNumber}\n- Host: ${attestation.immutableHost}\n- Deployment SHA: ${attestation.prHeadSha}\n- Verdict: PASS\n- Required lanes: ${lanes.length}\n- Verified created reports: ${dbEvidence.rows.length}\n- Duplicate source tuples: 0`;
await writeHostedArtifacts({
  artifactDir: config.artifactDir,
  manifest: runManifest,
  preflight,
  lanes,
  dbEvidence,
  verdict,
  summary
});
await assertHostedArtifactsSafe(config.artifactDir, [
  process.env.PREMIUM_HOSTED_ACCESS_TOKEN,
  process.env.PREMIUM_HOSTED_ACCOUNT_B_ACCESS_TOKEN,
  process.env.PREMIUM_HOSTED_SUPABASE_ANON_KEY,
  process.env.PREMIUM_HOSTED_PREVIEW_BYPASS_TOKEN,
  process.env.PREMIUM_HOSTED_FAULT_PREVIEW_BYPASS_TOKEN,
  process.env.GITHUB_TOKEN,
  process.env.VERCEL_TOKEN
]);
console.log(JSON.stringify({ status: "passed", artifactDir: config.artifactDir, verdict }, null, 2));
