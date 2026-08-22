import "server-only";
import postgres from "postgres";
import {
  isCanonicalRecommendationUuid,
  noRecommendationAdmissionAuthority,
  normalizeRecommendationAdmissionAuthorityPayload,
} from "@/lib/recommendation-admission-authority-contract.mjs";

export const RECOMMENDATION_ADMISSION_DATABASE_URL_ENV =
  "RECOMMENDATION_ADMISSION_DATABASE_URL";
export const RECOMMENDATION_ADMISSION_RUNTIME_ROLE =
  "recommendation_admission_runtime";
export const RECOMMENDATION_ADMISSION_READ_RPC =
  "read_recommendation_admission_authority_v1";

const PROJECT_REF = "bygrczggxfuisupcevaz";
const EXPECTED_POOLER_USERNAME =
  `${RECOMMENDATION_ADMISSION_RUNTIME_ROLE}.${PROJECT_REF}`;
const CONNECT_TIMEOUT_SECONDS = 5;
const IDLE_TIMEOUT_SECONDS = 10;
const MAX_LIFETIME_SECONDS = 60;
const QUERY_TIMEOUT_MS = 5_000;

let sqlClient = null;
let sqlClientUrl = null;

function getDatabaseUrl() {
  const value = process.env[RECOMMENDATION_ADMISSION_DATABASE_URL_ENV];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isApprovedDatabaseUrl(databaseUrl) {
  try {
    const parsed = new URL(databaseUrl);
    return (
      parsed.protocol === "postgresql:" &&
      decodeURIComponent(parsed.username) === EXPECTED_POOLER_USERNAME &&
      parsed.hostname.endsWith(".pooler.supabase.com") &&
      parsed.port === "6543" &&
      parsed.pathname === "/postgres" &&
      Boolean(parsed.password)
    );
  } catch {
    return false;
  }
}

function getSqlClient() {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl || !isApprovedDatabaseUrl(databaseUrl)) return null;
  if (sqlClient && sqlClientUrl === databaseUrl) return sqlClient;

  try {
    sqlClient = postgres(databaseUrl, {
      prepare: false,
      max: 1,
      connect_timeout: CONNECT_TIMEOUT_SECONDS,
      idle_timeout: IDLE_TIMEOUT_SECONDS,
      max_lifetime: MAX_LIFETIME_SECONDS,
    });
    sqlClientUrl = databaseUrl;
    return sqlClient;
  } catch {
    sqlClient = null;
    sqlClientUrl = null;
    return null;
  }
}

function withTimeout(promise, timeoutMs = QUERY_TIMEOUT_MS) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(Object.assign(new Error("authority_read_timeout"), { code: "G3A_TIMEOUT" })),
      timeoutMs,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function transportFailureReason(error) {
  return error?.code === "G3A_TIMEOUT"
    ? "PF_AUTHORITY_READ_TIMEOUT"
    : "PF_AUTHORITY_READ_FAILED";
}

export function isRecommendationAdmissionCredentialConfigured() {
  const databaseUrl = getDatabaseUrl();
  return Boolean(databaseUrl && isApprovedDatabaseUrl(databaseUrl));
}

export async function readRecommendationAdmissionAuthority(productId) {
  if (!isCanonicalRecommendationUuid(productId)) {
    return noRecommendationAdmissionAuthority("MALFORMED_PRODUCT_UUID");
  }

  const sql = getSqlClient();
  if (!sql) {
    return noRecommendationAdmissionAuthority("PF_AUTHORITY_CREDENTIAL_UNAVAILABLE");
  }

  try {
    const rows = await withTimeout(sql`
      select public.read_recommendation_admission_authority_v1(${productId}::uuid) as payload
    `);
    if (!Array.isArray(rows) || rows.length !== 1) {
      return noRecommendationAdmissionAuthority("MALFORMED_RPC_CARDINALITY");
    }
    return normalizeRecommendationAdmissionAuthorityPayload(rows[0]?.payload);
  } catch (error) {
    return noRecommendationAdmissionAuthority(transportFailureReason(error));
  }
}

export async function runRecommendationAdmissionRuntimeSecurityProbe(productId) {
  const sql = getSqlClient();
  if (!sql) {
    return Object.freeze({
      credentialAvailable: false,
      runtimeRoleMatch: false,
      rawPfSelectDenied: false,
      authority: noRecommendationAdmissionAuthority("PF_AUTHORITY_CREDENTIAL_UNAVAILABLE"),
    });
  }

  let runtimeRoleMatch = false;
  try {
    const rows = await withTimeout(sql`select current_user::text as role`);
    runtimeRoleMatch = rows?.[0]?.role === RECOMMENDATION_ADMISSION_RUNTIME_ROLE;
  } catch {
    runtimeRoleMatch = false;
  }

  let rawPfSelectDenied = false;
  try {
    await withTimeout(sql`select subject_id from public.product_fact_subjects limit 1`);
  } catch (error) {
    rawPfSelectDenied = String(error?.code || "") === "42501";
  }

  const authority = await readRecommendationAdmissionAuthority(productId);
  return Object.freeze({
    credentialAvailable: true,
    runtimeRoleMatch,
    rawPfSelectDenied,
    authority,
  });
}
