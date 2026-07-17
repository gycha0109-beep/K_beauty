import { readFile } from "node:fs/promises";
import {
  assertHostedArtifactsSafe,
  buildHostedRunManifest,
  evaluateHostedVerdict,
  loadHostedManifest,
  parseHostedConfig,
  writeHostedArtifacts,
  HOSTED_FAILURE_CATEGORIES
} from "./premium-hosted-preview-core.mjs";
import { requireCondition } from "./premium-browser-journey-core.mjs";

const config = parseHostedConfig();
const manifest = await loadHostedManifest(config.manifestPath);

async function readJsonEnv(name) {
  const path = String(process.env[name] || "").trim();
  requireCondition(path, HOSTED_FAILURE_CATEGORIES.PRECONDITION, "gate", `${name.toLowerCase()}_missing`);
  return JSON.parse(await readFile(path, "utf8"));
}

const preflight = await readJsonEnv("PREMIUM_HOSTED_PREFLIGHT_RESULT_PATH");
const ui = await readJsonEnv("PREMIUM_HOSTED_UI_RESULT_PATH");
const errors = await readJsonEnv("PREMIUM_HOSTED_ERROR_RESULT_PATH");
const dbEvidence = await readJsonEnv("PREMIUM_HOSTED_DB_RESULT_PATH");
const browserSteps = await readJsonEnv("PREMIUM_HOSTED_BROWSER_STEPS_PATH");

const lanes = [
  { name: "preflight", severity: "critical", status: preflight.status === "passed" ? "passed" : "failed" },
  ...(ui.lanes || []),
  ...(errors.lanes || [])
];

function browserLane(name, matcher, severity = "important") {
  const matches = (browserSteps || []).filter((step) => matcher.test(step.name || ""));
  return {
    name,
    severity,
    status: matches.length > 0 && matches.every((step) => step.status === "passed") ? "passed" : "failed",
    evidence: { matchedStepCount: matches.length }
  };
}

lanes.push(
  browserLane("persistence", /first-save|identical-retry|saved-reopen/),
  browserLane("finalized-conflict", /finalized-conflict/),
  browserLane("session-rotation", /session-rotation|new-session-save/)
);

requireCondition(dbEvidence.status === "passed" && dbEvidence.duplicateTupleCount === 0, HOSTED_FAILURE_CATEGORIES.PERSISTENCE, "gate", "db_evidence_failed");
const verdict = evaluateHostedVerdict(lanes);
requireCondition(verdict.status === "passed" && verdict.criticalCount === 0 && verdict.importantCount === 0, HOSTED_FAILURE_CATEGORIES.HARNESS, "gate", "hosted_preview_gate_failed");

const runManifest = buildHostedRunManifest(config, manifest);
const summary = `# Premium Hosted Preview Verification\n\n- Run: ${config.runId}\n- Host: ${config.baseUrl.hostname}\n- Deployment SHA: ${config.deploymentSha}\n- Verdict: PASS\n- Required lanes: ${lanes.length}\n- Duplicate source tuples: 0`;
await writeHostedArtifacts({ artifactDir: config.artifactDir, manifest: runManifest, preflight, lanes, dbEvidence, verdict, summary });
await assertHostedArtifactsSafe(config.artifactDir, [
  process.env.PREMIUM_HOSTED_ACCESS_TOKEN,
  process.env.PREMIUM_HOSTED_ACCOUNT_B_ACCESS_TOKEN,
  process.env.PREMIUM_HOSTED_SUPABASE_ANON_KEY
]);
console.log(JSON.stringify({ status: "passed", artifactDir: config.artifactDir, verdict }, null, 2));
