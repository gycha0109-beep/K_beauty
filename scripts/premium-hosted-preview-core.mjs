import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  FAILURE_CATEGORIES,
  JourneyFailure,
  createRunId,
  hashIdentifier,
  normalizeBaseUrl,
  requireCondition,
  validateEnvironmentGuard
} from "./premium-browser-journey-core.mjs";

export const HOSTED_FAILURE_CATEGORIES = Object.freeze({
  ...FAILURE_CATEGORIES,
  OAUTH: "OAUTH_FAILURE",
  PREMIUM_ACCESS: "PREMIUM_ACCESS_FAILURE",
  ENGINE_OUTPUT: "ENGINE_OUTPUT_FAILURE",
  UI_PROJECTION: "UI_PROJECTION_FAILURE",
  PHOTO_FALLBACK: "PHOTO_FALLBACK_FAILURE",
  ERROR_HANDLING: "ERROR_HANDLING_FAILURE"
});

export const REQUIRED_HOSTED_LANES = Object.freeze([
  "preflight",
  "google-login",
  "premium-entry",
  "ko-normal",
  "en-normal",
  "selected-product",
  "not-in-db",
  "selected-plus-not-in-db",
  "photo-fallback",
  "persistence",
  "finalized-conflict",
  "session-rotation",
  "unauthenticated",
  "forbidden",
  "ownership",
  "safe-5xx"
]);

const FORBIDDEN_EVIDENCE_KEY = /^(authorization|accessToken|refreshToken|cookie|cookies|serviceRoleKey|oauthCode|email|rawPhoto|originalPhoto)$/i;

export function parseHostedConfig(env = process.env) {
  const runId = createRunId(env.PREMIUM_HOSTED_RUN_ID);
  const baseUrl = normalizeBaseUrl(env.PREMIUM_HOSTED_BASE_URL);
  const environment = String(env.PREMIUM_HOSTED_ENVIRONMENT || "").trim();
  const expectedHost = String(env.PREMIUM_HOSTED_EXPECTED_HOST || "").trim();
  const expectedSha = String(env.PREMIUM_HOSTED_EXPECTED_SHA || "").trim();
  const deploymentSha = String(env.PREMIUM_HOSTED_DEPLOYMENT_SHA || "").trim();
  validateEnvironmentGuard({
    baseUrl,
    environment,
    expectedHost,
    expectedSha,
    deploymentSha,
    productionConfirmation: env.PREMIUM_HOSTED_ALLOW_PRODUCTION
  });
  requireCondition(environment !== "production", HOSTED_FAILURE_CATEGORIES.PRECONDITION, "configuration", "production_not_allowed_for_step_10");
  const artifactDir = resolve(process.cwd(), env.PREMIUM_HOSTED_ARTIFACT_ROOT || "tmp/premium-hosted-preview-verification", runId);
  const manifestPath = String(env.PREMIUM_HOSTED_MANIFEST_PATH || "").trim();
  requireCondition(manifestPath && existsSync(manifestPath), HOSTED_FAILURE_CATEGORIES.PRECONDITION, "configuration", "hosted_manifest_missing");
  return { runId, baseUrl, environment, expectedHost, expectedSha, deploymentSha, artifactDir, manifestPath };
}

export async function loadHostedManifest(path) {
  let manifest;
  try {
    manifest = JSON.parse(await readFile(path, "utf8"));
  } catch {
    throw new JourneyFailure(HOSTED_FAILURE_CATEGORIES.PRECONDITION, "configuration", "hosted_manifest_invalid_json");
  }
  requireCondition(manifest && typeof manifest === "object", HOSTED_FAILURE_CATEGORIES.PRECONDITION, "configuration", "hosted_manifest_invalid");
  requireCondition(manifest.accountA?.expectedUserIdHash, HOSTED_FAILURE_CATEGORIES.PRECONDITION, "configuration", "account_a_hash_missing");
  requireCondition(manifest.accountB?.expectedUserIdHash, HOSTED_FAILURE_CATEGORIES.PRECONDITION, "configuration", "account_b_hash_missing");
  requireCondition(manifest.fixtures?.normalPhoto && manifest.fixtures?.fallbackPhoto, HOSTED_FAILURE_CATEGORIES.PRECONDITION, "configuration", "photo_fixtures_missing");
  requireCondition(manifest.uiCases?.ko && manifest.uiCases?.en, HOSTED_FAILURE_CATEGORIES.PRECONDITION, "configuration", "locale_ui_cases_missing");
  requireCondition(Array.isArray(manifest.currentProductCases) && manifest.currentProductCases.length >= 3, HOSTED_FAILURE_CATEGORIES.PRECONDITION, "configuration", "current_product_cases_incomplete");
  return manifest;
}

export function sanitizeEvidence(value, path = "root") {
  if (Array.isArray(value)) return value.map((item, index) => sanitizeEvidence(item, `${path}[${index}]`));
  if (!value || typeof value !== "object") return value;
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    requireCondition(!FORBIDDEN_EVIDENCE_KEY.test(key), HOSTED_FAILURE_CATEGORIES.HARNESS, "evidence-sanitize", "forbidden_evidence_field", `${path}.${key}`);
    output[key] = sanitizeEvidence(item, `${path}.${key}`);
  }
  return output;
}

export function compareLocaleSemantics(ko, en) {
  const keys = ["functionalStatus", "routineStatus", "conditionStatus", "consistencyVerdict", "topPickId", "snapshotFingerprint"];
  const mismatches = keys.filter((key) => (ko?.[key] ?? null) !== (en?.[key] ?? null));
  return { passed: mismatches.length === 0, mismatches };
}

export function evaluateHostedVerdict(lanes) {
  const byName = new Map((lanes || []).map((lane) => [lane.name, lane]));
  const missing = REQUIRED_HOSTED_LANES.filter((name) => !byName.has(name));
  const failed = REQUIRED_HOSTED_LANES.filter((name) => byName.get(name)?.status !== "passed");
  return {
    status: missing.length || failed.length ? "failed" : "passed",
    missingLanes: missing,
    failedLanes: failed,
    criticalCount: (lanes || []).filter((lane) => lane.severity === "critical" && lane.status !== "passed").length,
    importantCount: (lanes || []).filter((lane) => lane.severity === "important" && lane.status !== "passed").length
  };
}

export async function writeHostedArtifacts({ artifactDir, manifest, preflight, lanes, dbEvidence, verdict, summary }) {
  await mkdir(artifactDir, { recursive: true });
  const safeFiles = {
    "run-manifest.json": sanitizeEvidence(manifest),
    "preflight.json": sanitizeEvidence(preflight),
    "lane-results.json": sanitizeEvidence(lanes),
    "persistence-evidence.json": sanitizeEvidence(dbEvidence),
    "invariant-verdict.json": sanitizeEvidence(verdict)
  };
  await Promise.all(Object.entries(safeFiles).map(([name, value]) => writeFile(resolve(artifactDir, name), `${JSON.stringify(value, null, 2)}\n`, "utf8")));
  await writeFile(resolve(artifactDir, "summary.md"), `${String(summary || "").trim()}\n`, "utf8");
}

export async function assertHostedArtifactsSafe(artifactDir, secrets = []) {
  const files = ["run-manifest.json", "preflight.json", "lane-results.json", "persistence-evidence.json", "invariant-verdict.json", "summary.md"];
  const text = (await Promise.all(files.map((name) => readFile(resolve(artifactDir, name), "utf8")))).join("\n");
  for (const secret of secrets.filter((value) => typeof value === "string" && value.length >= 8)) {
    requireCondition(!text.includes(secret), HOSTED_FAILURE_CATEGORIES.HARNESS, "artifact-secret-scan", "secret_material_detected_in_artifact");
  }
  for (const name of files.filter((name) => name.endsWith(".json"))) {
    sanitizeEvidence(JSON.parse(await readFile(resolve(artifactDir, name), "utf8")));
  }
}

export function buildHostedRunManifest(config, manifest) {
  return {
    runId: config.runId,
    environment: config.environment,
    targetHost: config.baseUrl.hostname,
    expectedSha: config.expectedSha,
    deploymentSha: config.deploymentSha,
    accountAHash: manifest.accountA.expectedUserIdHash,
    accountBHash: manifest.accountB.expectedUserIdHash,
    fixtureHashes: Object.fromEntries(Object.entries(manifest.fixtures || {}).map(([key, value]) => [key, hashIdentifier(String(value))]))
  };
}
