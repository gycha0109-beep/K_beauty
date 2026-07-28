import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, resolve } from "node:path";

export const FAILURE_CATEGORIES = Object.freeze({
  PRECONDITION: "PRECONDITION_FAILURE",
  AUTH: "AUTH_BOUNDARY_FAILURE",
  SESSION: "SESSION_FAILURE",
  PERSISTENCE: "PERSISTENCE_FAILURE",
  IMMUTABILITY: "IMMUTABILITY_FAILURE",
  REENTRY: "REENTRY_FAILURE",
  LOCALE: "LOCALE_AUTHORITY_FAILURE",
  INFRASTRUCTURE: "INFRASTRUCTURE_FAILURE",
  HARNESS: "HARNESS_FAILURE"
});

export const PREMIUM_COOKIE_NAME = "kbeauty_premium_report";
export const PRODUCTION_CONFIRMATION = "I_ACKNOWLEDGE_PRODUCTION_WRITES";
export const DEDICATED_ACCOUNT_CONFIRMATION = "DEDICATED_PREMIUM_TEST_ACCOUNT";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MIME_BY_EXT = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"]
]);
const FORBIDDEN_KEYS = new Set([
  "authorization",
  "accesstoken",
  "access_token",
  "premiumsessiontoken",
  "premium_session_token",
  "refreshtoken",
  "refresh_token",
  "sessionid",
  "session_id",
  "savedreportid",
  "saved_report_id",
  "token"
]);

export class JourneyFailure extends Error {
  constructor(category, step, code, message = code) {
    super(message);
    this.name = "JourneyFailure";
    this.category = category;
    this.step = step;
    this.code = code;
  }
}

export function requireCondition(condition, category, step, code, message) {
  if (!condition) throw new JourneyFailure(category, step, code, message);
}

export function sha256(value) {
  const input = Buffer.isBuffer(value) || value instanceof Uint8Array ? value : String(value);
  return createHash("sha256").update(input).digest("hex");
}

export function hashIdentifier(value) {
  return `sha256:${sha256(value)}`;
}

export function createRunId(value = "") {
  const supplied = String(value || "").trim();
  if (supplied) {
    requireCondition(
      /^[a-zA-Z0-9][a-zA-Z0-9._-]{7,79}$/.test(supplied),
      FAILURE_CATEGORIES.PRECONDITION,
      "configuration",
      "invalid_run_id"
    );
    return supplied;
  }
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `premium-e2e-${stamp}-${randomBytes(4).toString("hex")}`;
}

export function normalizeBaseUrl(value) {
  let url;
  try {
    url = new URL(String(value || ""));
  } catch {
    throw new JourneyFailure(FAILURE_CATEGORIES.PRECONDITION, "configuration", "invalid_base_url");
  }
  requireCondition(
    url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash,
    FAILURE_CATEGORIES.PRECONDITION,
    "configuration",
    "unsafe_base_url"
  );
  requireCondition(
    url.pathname === "/" || url.pathname === "",
    FAILURE_CATEGORIES.PRECONDITION,
    "configuration",
    "base_url_path_not_supported"
  );
  url.pathname = "/";
  return url;
}

export function validateEnvironmentGuard({
  baseUrl,
  environment,
  expectedHost,
  expectedSha,
  deploymentSha,
  productionConfirmation
}) {
  requireCondition(
    ["preview", "production-like", "production"].includes(environment),
    FAILURE_CATEGORIES.PRECONDITION,
    "configuration",
    "invalid_environment"
  );
  requireCondition(
    baseUrl.hostname === expectedHost,
    FAILURE_CATEGORIES.PRECONDITION,
    "configuration",
    "unexpected_target_host"
  );
  requireCondition(
    /^[0-9a-f]{40}$/i.test(expectedSha) && expectedSha.toLowerCase() === deploymentSha.toLowerCase(),
    FAILURE_CATEGORIES.PRECONDITION,
    "configuration",
    "deployment_sha_mismatch"
  );
  if (environment === "production") {
    requireCondition(
      productionConfirmation === PRODUCTION_CONFIRMATION,
      FAILURE_CATEGORIES.PRECONDITION,
      "configuration",
      "production_execution_not_confirmed"
    );
  }
}

export async function loadJsonFile(path, label) {
  requireCondition(path && existsSync(path), FAILURE_CATEGORIES.PRECONDITION, "configuration", `${label}_missing`);
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    throw new JourneyFailure(FAILURE_CATEGORIES.PRECONDITION, "configuration", `${label}_invalid_json`);
  }
}

export async function loadImageFixture(path) {
  requireCondition(path && existsSync(path), FAILURE_CATEGORIES.PRECONDITION, "configuration", "image_fixture_missing");
  const ext = extname(path).toLowerCase();
  const mimeType = MIME_BY_EXT.get(ext);
  requireCondition(Boolean(mimeType), FAILURE_CATEGORIES.PRECONDITION, "configuration", "image_fixture_type_not_allowed");
  const buffer = await readFile(path);
  requireCondition(buffer.length > 0 && buffer.length <= MAX_IMAGE_BYTES, FAILURE_CATEGORIES.PRECONDITION, "configuration", "image_fixture_size_invalid");
  return {
    buffer,
    mimeType,
    name: `premium-e2e${ext}`,
    size: buffer.length,
    fixtureHash: hashIdentifier(buffer)
  };
}

function assertSafeObject(value, path = "body") {
  if (Array.isArray(value)) return value.forEach((item, index) => assertSafeObject(item, `${path}[${index}]`));
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    requireCondition(!FORBIDDEN_KEYS.has(String(key).toLowerCase()), FAILURE_CATEGORIES.PRECONDITION, "configuration", "conflict_body_contains_control_key", `${path}.${key}`);
    assertSafeObject(item, `${path}.${key}`);
  }
}

export function resolveConflictBody(document, locale) {
  const candidate = document?.ko || document?.en ? document?.[locale] : document;
  requireCondition(candidate && typeof candidate === "object" && !Array.isArray(candidate) && Object.keys(candidate).length > 0, FAILURE_CATEGORIES.PRECONDITION, "configuration", `conflict_body_missing_for_${locale}`);
  assertSafeObject(candidate);
  return { ...candidate, locale };
}

function cookieMatchesHost(cookie, targetHost) {
  const domain = String(cookie?.domain || "").trim().replace(/^\./, "").toLowerCase();
  const host = String(targetHost || "").trim().toLowerCase();
  return Boolean(domain && host && (host === domain || host.endsWith(`.${domain}`)));
}

export function inspectStorageState(storageState, targetHost) {
  requireCondition(storageState && Array.isArray(storageState.cookies), FAILURE_CATEGORIES.PRECONDITION, "configuration", "invalid_storage_state");
  requireCondition(targetHost, FAILURE_CATEGORIES.PRECONDITION, "configuration", "storage_state_target_host_missing");
  const authCookies = storageState.cookies.filter((cookie) =>
    String(cookie?.name || "").includes("auth-token") &&
    cookie?.secure === true &&
    String(cookie?.path || "/") === "/" &&
    cookieMatchesHost(cookie, targetHost)
  );
  requireCondition(authCookies.length > 0, FAILURE_CATEGORIES.PRECONDITION, "configuration", "target_host_cookie_backed_auth_missing");
  return { authCookieCount: authCookies.length, targetHost };
}

export async function parseApiResponse(response) {
  const status = response.status();
  const text = await response.text();
  try {
    return { status, body: text ? JSON.parse(text) : null };
  } catch {
    return { status, body: null };
  }
}

export function safeResponseContract(name, response) {
  const body = response?.body || null;
  return {
    name,
    status: response?.status ?? null,
    errorCode: typeof body?.error === "string" ? body.error : null,
    reasonCode: typeof body?.reason === "string" ? body.reason : null,
    schemaVersion: Number.isFinite(body?.meta?.schemaVersion) ? body.meta.schemaVersion : null,
    source: typeof body?.meta?.source === "string" ? body.meta.source : null,
    locale: typeof body?.meta?.locale === "string" ? body.meta.locale : null,
    persistenceStatus: typeof body?.meta?.persistence?.status === "string" ? body.meta.persistence.status : null,
    savedReportId: typeof body?.meta?.persistence?.savedReportId === "string" ? body.meta.persistence.savedReportId : null,
    fingerprint: typeof body?.meta?.snapshot?.fingerprint === "string" ? body.meta.snapshot.fingerprint : null,
    hasSavedReport: typeof body?.hasSavedReport === "boolean" ? body.hasSavedReport : null,
    rotated: typeof body?.rotated === "boolean" ? body.rotated : null
  };
}

export function safeErrorCode(response) {
  return response?.body?.error || response?.body?.reason || `http_${response?.status ?? "unknown"}`;
}

export async function fetchAuthUser({ supabaseUrl, anonKey, accessToken }) {
  let response;
  try {
    response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` }
    });
  } catch {
    throw new JourneyFailure(FAILURE_CATEGORIES.INFRASTRUCTURE, "auth-user-lookup", "supabase_auth_unreachable");
  }
  const body = await response.json().catch(() => null);
  requireCondition(response.ok && body?.id, FAILURE_CATEGORIES.AUTH, "auth-user-lookup", "access_token_user_lookup_failed");
  return body;
}

async function supabaseRest({ supabaseUrl, anonKey, accessToken, path, method = "GET", prefer = "" }) {
  let response;
  try {
    response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        ...(prefer ? { Prefer: prefer } : {})
      }
    });
  } catch {
    throw new JourneyFailure(FAILURE_CATEGORIES.INFRASTRUCTURE, "persistence-read", "supabase_rest_unreachable");
  }
  const body = await response.json().catch(() => null);
  requireCondition(response.ok, FAILURE_CATEGORIES.PERSISTENCE, method === "DELETE" ? "cleanup" : "persistence-read", `supabase_rest_${response.status}`);
  return body;
}

export async function fetchSavedReportById(config, id) {
  const select = "id,user_id,report_type,report_version,source_type,source_session_id,premium_report,created_at,updated_at";
  const rows = await supabaseRest({
    ...config,
    path: `saved_reports?select=${encodeURIComponent(select)}&id=eq.${encodeURIComponent(id)}`
  });
  return Array.isArray(rows) ? rows[0] || null : null;
}

export async function fetchPremiumSessionRows(config) {
  const select = "id,report_type,source_type,source_session_id";
  const rows = await supabaseRest({
    ...config,
    path: `saved_reports?select=${encodeURIComponent(select)}&report_type=eq.premium&source_type=eq.premium_report_session`
  });
  return Array.isArray(rows) ? rows : [];
}

export async function deleteSavedReportById(config, id) {
  const rows = await supabaseRest({
    ...config,
    method: "DELETE",
    prefer: "return=representation",
    path: `saved_reports?id=eq.${encodeURIComponent(id)}&report_type=eq.premium&source_type=eq.premium_report_session&select=id`
  });
  return Array.isArray(rows) ? rows.map((row) => row?.id).filter(Boolean) : [];
}

export function countDuplicateSourceTuples(rows) {
  const counts = new Map();
  for (const row of rows || []) {
    if (!row?.source_session_id) continue;
    const key = [row.report_type, row.source_type, row.source_session_id].join("|");
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Array.from(counts.values()).filter((count) => count > 1).length;
}

export function buildPersistenceEvidence({ row, snapshot, responseFingerprint }) {
  return {
    savedReportId: row?.id || null,
    reportVersion: row?.report_version || null,
    snapshotVersion: snapshot?.version || null,
    decisionBundleVersion: snapshot?.decisionBundleVersion || null,
    fingerprint: snapshot?.fingerprint || responseFingerprint || null,
    responseFingerprint: responseFingerprint || null,
    locale: snapshot?.locale || null,
    sourceType: row?.source_type || null,
    sourceSessionHash: row?.source_session_id ? hashIdentifier(row.source_session_id) : null,
    createdAt: row?.created_at || null,
    updatedAt: row?.updated_at || null
  };
}

export async function writeArtifactSet({ artifactDir, manifest, steps, responses, persistence, verdict, summary }) {
  await mkdir(artifactDir, { recursive: true });
  const files = {
    "run-manifest.json": JSON.stringify(manifest, null, 2),
    "browser-steps.json": JSON.stringify(steps, null, 2),
    "response-contracts.json": JSON.stringify(responses, null, 2),
    "persistence-evidence.json": JSON.stringify(persistence, null, 2),
    "invariant-verdict.json": JSON.stringify(verdict, null, 2),
    "summary.md": summary.trim()
  };
  await Promise.all(Object.entries(files).map(([name, content]) => writeFile(resolve(artifactDir, name), `${content}\n`, "utf8")));
}

export async function scanArtifactDirectoryForSecrets(artifactDir, secretValues = []) {
  const names = ["run-manifest.json", "browser-steps.json", "response-contracts.json", "persistence-evidence.json", "invariant-verdict.json", "summary.md"];
  const contents = (await Promise.all(names.map((name) => readFile(resolve(artifactDir, name), "utf8")))).join("\n");
  for (const secret of secretValues.filter((value) => typeof value === "string" && value.length >= 8)) {
    requireCondition(!contents.includes(secret), FAILURE_CATEGORIES.HARNESS, "artifact-secret-scan", "secret_material_detected_in_artifact");
  }
  requireCondition(!/Bearer\s+[A-Za-z0-9._-]+/i.test(contents), FAILURE_CATEGORIES.HARNESS, "artifact-secret-scan", "bearer_material_detected_in_artifact");
  requireCondition(!/"email"\s*:/i.test(contents), FAILURE_CATEGORIES.HARNESS, "artifact-secret-scan", "email_field_detected_in_artifact");
}

export function getArtifactDir(root, runId) {
  return resolve(root || "tmp/premium-runtime-journey", runId);
}

export function getFixtureMetadata(fixture) {
  return {
    mimeType: fixture.mimeType,
    size: fixture.size,
    fixtureHash: fixture.fixtureHash
  };
}
