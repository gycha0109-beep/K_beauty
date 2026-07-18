import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import {
  HOSTED_FAILURE_CATEGORIES,
  assertHostedArtifactsSafe as assertLegacyArtifactsSafe,
  buildHostedRunManifest as buildLegacyRunManifest,
  loadHostedManifest as loadLegacyManifest,
  parseHostedConfig as parseLegacyConfig,
  sanitizeEvidence as sanitizeLegacyEvidence,
  writeHostedArtifacts as writeLegacyArtifacts
} from "./premium-hosted-preview-core.mjs";
import {
  HostedContractError,
  compareHostedLocaleSemantics,
  projectHostedCanonicalEvidence,
  validateHostedDeploymentAttestation,
  validateHostedUiCaseFixture
} from "./premium-hosted-preview-contract-core.mjs";
import { resolveHostedRunPaths } from "./premium-hosted-preview-security.mjs";
import { JourneyFailure, requireCondition } from "./premium-browser-journey-core.mjs";

export { HOSTED_FAILURE_CATEGORIES };

export const REQUIRED_HOSTED_LANES = Object.freeze([
  "preflight",
  "google-login",
  "premium-entry",
  "ko-normal",
  "en-normal",
  "selected-product",
  "not-in-db",
  "selected-plus-not-in-db",
  "duplicate-axis",
  "photo-fallback",
  "persistence",
  "finalized-conflict",
  "session-rotation",
  "unauthenticated",
  "forbidden",
  "ownership",
  "principal-conflict",
  "safe-5xx"
]);

const FORBIDDEN_TEXT = /(bearer\s+\S+|data:image\/|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/i;
const RAW_UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;
const HASHED_IDENTIFIER_KEYS = new Set([
  "savedReportId",
  "productId",
  "topPickProductId",
  "sourceSessionId",
  "userId",
  "ownerId"
]);
const PRODUCT_LANES = Object.freeze([
  "selected-product",
  "not-in-db",
  "selected-plus-not-in-db",
  "duplicate-axis"
]);
const CLICK_ROLES = new Set(["button", "link", "radio", "checkbox", "tab", "option"]);
const MARKER_ROLES = new Set([...CLICK_ROLES, "status", "navigation", "region"]);

function wrap(error, category, step, fallbackCode) {
  if (error instanceof JourneyFailure) return error;
  if (error instanceof HostedContractError) {
    return new JourneyFailure(category, step, error.code, error.detail == null ? error.code : String(error.detail));
  }
  return new JourneyFailure(category, step, fallbackCode, error?.message || fallbackCode);
}

function hashArtifactIdentifier(value) {
  return `sha256:${createHash("sha256").update(String(value)).digest("hex")}`;
}

function normalizeArtifactEvidence(value, key = null, path = "root") {
  if (typeof value === "string") {
    if (key && HASHED_IDENTIFIER_KEYS.has(key) && value) return hashArtifactIdentifier(value);
    requireCondition(!RAW_UUID.test(value), HOSTED_FAILURE_CATEGORIES.HARNESS, "evidence-sanitize", "raw_uuid_detected", path);
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => normalizeArtifactEvidence(item, null, `${path}[${index}]`));
  }
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([childKey, child]) => [
      childKey,
      normalizeArtifactEvidence(child, childKey, `${path}.${childKey}`)
    ])
  );
}

function validateGoogleSignInMarker(marker) {
  requireCondition(marker && typeof marker === "object" && !Array.isArray(marker), HOSTED_FAILURE_CATEGORIES.PRECONDITION, "configuration", "google_signin_marker_missing");
  requireCondition(
    Object.keys(marker).every((key) => ["role", "name"].includes(key)),
    HOSTED_FAILURE_CATEGORIES.PRECONDITION,
    "configuration",
    "google_signin_marker_unknown_field"
  );
  requireCondition(
    CLICK_ROLES.has(marker.role) && typeof marker.name === "string" && marker.name.trim(),
    HOSTED_FAILURE_CATEGORIES.PRECONDITION,
    "configuration",
    "google_signin_marker_invalid"
  );
}

function validateAccessibleMarker(marker, code) {
  requireCondition(marker && typeof marker === "object" && !Array.isArray(marker), HOSTED_FAILURE_CATEGORIES.PRECONDITION, "configuration", `${code}_missing`);
  requireCondition(
    Object.keys(marker).every((key) => ["kind", "name", "role"].includes(key)),
    HOSTED_FAILURE_CATEGORIES.PRECONDITION,
    "configuration",
    `${code}_unknown_field`
  );
  requireCondition(
    ["heading", "text", "role"].includes(marker.kind) && typeof marker.name === "string" && marker.name.trim(),
    HOSTED_FAILURE_CATEGORIES.PRECONDITION,
    "configuration",
    `${code}_invalid`
  );
  if (marker.kind === "role") {
    requireCondition(MARKER_ROLES.has(marker.role), HOSTED_FAILURE_CATEGORIES.PRECONDITION, "configuration", `${code}_role_invalid`);
  } else {
    requireCondition(marker.role == null, HOSTED_FAILURE_CATEGORIES.PRECONDITION, "configuration", `${code}_unexpected_role`);
  }
}

export function parseHostedPrNumber(value) {
  const raw = String(value ?? "").trim();
  requireCondition(
    /^\d+$/.test(raw),
    "PREVIEW_ATTESTATION_FAILURE",
    "configuration",
    "premium_hosted_pr_number_missing_or_invalid"
  );
  const parsed = Number(raw);
  requireCondition(
    Number.isSafeInteger(parsed) && parsed > 0,
    "PREVIEW_ATTESTATION_FAILURE",
    "configuration",
    "premium_hosted_pr_number_missing_or_invalid"
  );
  return parsed;
}

export function parseHostedConfig(env = process.env) {
  const legacy = parseLegacyConfig(env);
  const prNumber = parseHostedPrNumber(env.PREMIUM_HOSTED_PR_NUMBER);
  let securePaths;
  try {
    securePaths = resolveHostedRunPaths(legacy.runId, env);
  } catch (error) {
    throw wrap(error, "CREDENTIAL_STORAGE_FAILURE", "configuration", "secure_run_path_invalid");
  }
  return { ...legacy, prNumber, artifactDir: securePaths.artifactsDir, securePaths };
}

export async function loadHostedManifest(path) {
  const manifest = await loadLegacyManifest(path);
  requireCondition(
    manifest.accountA.expectedUserIdHash !== manifest.accountB.expectedUserIdHash,
    "AUTH_EVIDENCE_FAILURE",
    "configuration",
    "account_hashes_must_differ"
  );
  requireCondition(
    manifest.deploymentAttestationPath && existsSync(manifest.deploymentAttestationPath),
    "PREVIEW_ATTESTATION_FAILURE",
    "configuration",
    "deployment_attestation_missing"
  );
  requireCondition(
    typeof manifest.vercelProjectId === "string" && manifest.vercelProjectId.trim(),
    "PREVIEW_ATTESTATION_FAILURE",
    "configuration",
    "vercel_project_id_missing"
  );
  requireCondition(
    typeof manifest.supabaseProjectRef === "string" && /^[a-z0-9]{8,64}$/.test(manifest.supabaseProjectRef),
    "PREVIEW_ATTESTATION_FAILURE",
    "configuration",
    "supabase_project_ref_missing_or_invalid"
  );
  requireCondition(
    typeof manifest.catalogHash === "string" && /^[0-9a-f]{64}$/i.test(manifest.catalogHash),
    HOSTED_FAILURE_CATEGORIES.PRECONDITION,
    "configuration",
    "catalog_hash_missing_or_invalid"
  );
  requireCondition(
    manifest.fixtureRoot && existsSync(manifest.fixtureRoot),
    HOSTED_FAILURE_CATEGORIES.PRECONDITION,
    "configuration",
    "fixture_root_missing"
  );
  validateGoogleSignInMarker(manifest.googleSignInMarker);
  validateAccessibleMarker(manifest.signedInMarker, "signed_in_marker");
  validateAccessibleMarker(manifest.premiumEntryMarker, "premium_entry_marker");
  const lanes = manifest.currentProductCases.map((item) => item?.laneName);
  requireCondition(
    lanes.length === PRODUCT_LANES.length &&
      new Set(lanes).size === PRODUCT_LANES.length &&
      PRODUCT_LANES.every((name) => lanes.includes(name)),
    HOSTED_FAILURE_CATEGORIES.PRECONDITION,
    "configuration",
    "current_product_lanes_invalid"
  );
  return manifest;
}

export async function loadDeploymentAttestation(config, manifest) {
  let document;
  try {
    document = JSON.parse(await readFile(manifest.deploymentAttestationPath, "utf8"));
  } catch {
    throw new JourneyFailure("PREVIEW_ATTESTATION_FAILURE", "deployment-attestation", "deployment_attestation_invalid_json");
  }
  const attestation = validateDeploymentAttestation(document, {
    repository: "gycha0109-beep/K_beauty",
    prNumber: config.prNumber,
    headSha: config.expectedSha,
    vercelProjectId: manifest.vercelProjectId
  });
  requireCondition(
    attestation.immutableHost === config.baseUrl.hostname,
    "PREVIEW_ATTESTATION_FAILURE",
    "deployment-attestation",
    "immutable_host_mismatch"
  );
  requireCondition(
    attestation.prHeadSha === config.expectedSha,
    "PREVIEW_ATTESTATION_FAILURE",
    "deployment-attestation",
    "attested_head_mismatch"
  );
  return attestation;
}

export function validateSupabasePublicConfig(supabaseUrl, manifest) {
  let url;
  try {
    url = new URL(supabaseUrl);
  } catch {
    throw new JourneyFailure("PREVIEW_ATTESTATION_FAILURE", "supabase-config", "supabase_url_invalid");
  }
  requireCondition(url.protocol === "https:", "PREVIEW_ATTESTATION_FAILURE", "supabase-config", "supabase_url_not_https");
  requireCondition(
    url.hostname === `${manifest.supabaseProjectRef}.supabase.co`,
    "PREVIEW_ATTESTATION_FAILURE",
    "supabase-config",
    "supabase_project_ref_mismatch"
  );
  return url;
}

export function compareLocaleSemantics(ko, en) {
  return compareHostedLocaleSemantics(ko, en);
}

export function projectCanonicalEvidence(body, options = {}) {
  try {
    return projectHostedCanonicalEvidence(body, options);
  } catch (error) {
    throw wrap(error, "CANONICAL_PROJECTION_FAILURE", "canonical-projection", "canonical_projection_failed");
  }
}

export function validateUiCaseFixture(value) {
  try {
    return validateHostedUiCaseFixture(value);
  } catch (error) {
    throw wrap(error, "FIXTURE_CONTRACT_FAILURE", "fixture-contract", "fixture_contract_failed");
  }
}

export function validateDeploymentAttestation(value, expected, options = {}) {
  try {
    return validateHostedDeploymentAttestation(value, expected, options);
  } catch (error) {
    throw wrap(error, "PREVIEW_ATTESTATION_FAILURE", "deployment-attestation", "deployment_attestation_failed");
  }
}

export function sanitizeEvidence(value, path = "root") {
  const normalized = normalizeArtifactEvidence(value, null, path);
  const sanitized = sanitizeLegacyEvidence(normalized, path);
  function scan(item, currentPath) {
    if (typeof item === "string") {
      requireCondition(!FORBIDDEN_TEXT.test(item), HOSTED_FAILURE_CATEGORIES.HARNESS, "evidence-sanitize", "forbidden_evidence_value", currentPath);
      requireCondition(!RAW_UUID.test(item), HOSTED_FAILURE_CATEGORIES.HARNESS, "evidence-sanitize", "raw_uuid_detected", currentPath);
      return;
    }
    if (Array.isArray(item)) {
      item.forEach((child, index) => scan(child, `${currentPath}[${index}]`));
      return;
    }
    if (item && typeof item === "object") {
      Object.entries(item).forEach(([childKey, child]) => scan(child, `${currentPath}.${childKey}`));
    }
  }
  scan(sanitized, path);
  return sanitized;
}

export function evaluateHostedVerdict(lanes) {
  const source = Array.isArray(lanes) ? lanes : [];
  const names = source.map((lane) => lane?.name).filter(Boolean);
  const duplicateLanes = [...new Set(names.filter((name, index) => names.indexOf(name) !== index))];
  const byName = new Map(source.map((lane) => [lane.name, lane]));
  const missingLanes = REQUIRED_HOSTED_LANES.filter((name) => !byName.has(name));
  const failedLanes = REQUIRED_HOSTED_LANES.filter((name) => byName.get(name)?.status !== "passed");
  return {
    status: missingLanes.length || failedLanes.length || duplicateLanes.length ? "failed" : "passed",
    missingLanes,
    failedLanes,
    duplicateLanes,
    criticalCount: source.filter((lane) => lane?.severity === "critical" && lane?.status !== "passed").length,
    importantCount: source.filter((lane) => lane?.severity === "important" && lane?.status !== "passed").length
  };
}

export async function writeHostedArtifacts(input) {
  const safeInput = {
    ...input,
    manifest: sanitizeEvidence(input.manifest),
    preflight: sanitizeEvidence(input.preflight),
    lanes: sanitizeEvidence(input.lanes),
    dbEvidence: sanitizeEvidence(input.dbEvidence),
    verdict: sanitizeEvidence(input.verdict),
    summary: sanitizeEvidence(String(input.summary || ""), "summary")
  };
  return writeLegacyArtifacts(safeInput);
}

export async function assertHostedArtifactsSafe(artifactDir, secrets = []) {
  await assertLegacyArtifactsSafe(artifactDir, secrets);
}

export function buildHostedRunManifest(config, manifest, attestation = null) {
  return {
    ...buildLegacyRunManifest(config, manifest),
    prNumber: config.prNumber,
    deploymentSha: attestation?.prHeadSha || config.deploymentSha,
    deploymentId: attestation?.vercelDeploymentId || null,
    immutableHost: attestation?.immutableHost || null,
    supabaseProjectRef: manifest.supabaseProjectRef
  };
}
