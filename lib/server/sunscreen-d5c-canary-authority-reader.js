import "server-only";

import postgres from "postgres";
import {
  D5C_SUNSCREEN_CANARY_PRODUCT_IDS,
  normalizeD5cSunscreenCanaryAuthorityPayload,
} from "@/lib/sunscreen-d5c-canary-authority-contract.mjs";

export const D5C_CANARY_DATABASE_URL_ENV =
  "RECOMMENDATION_ADMISSION_DATABASE_URL";
export const D5C_CANARY_RUNTIME_ROLE =
  "recommendation_admission_runtime";
export const D5C_CANARY_READ_RPC =
  "read_data_ai29c_d5c_sunscreen_canary_authority_v1";

const PROJECT_REF = "bygrczggxfuisupcevaz";
const EXPECTED_POOLER_USERNAME =
  `${D5C_CANARY_RUNTIME_ROLE}.${PROJECT_REF}`;
const CONNECT_TIMEOUT_SECONDS = 5;
const IDLE_TIMEOUT_SECONDS = 10;
const MAX_LIFETIME_SECONDS = 60;
const QUERY_TIMEOUT_MS = 5_000;
const TRANSIENT_RETRY_DELAY_MS = 75;

export const D5C_CANARY_TRANSIENT_RETRY_VERSION =
  "data-ai29c-d5d-r1-d5c-authority-retry-v1";

let sqlClient = null;
let sqlClientUrl = null;

function getDatabaseUrl() {
  const value = process.env[D5C_CANARY_DATABASE_URL_ENV];
  return typeof value === "string" && value.trim()
    ? value.trim()
    : null;
}

function isApprovedDatabaseUrl(databaseUrl) {
  try {
    const parsed = new URL(databaseUrl);
    return (
      parsed.protocol === "postgresql:" &&
      decodeURIComponent(parsed.username) ===
        EXPECTED_POOLER_USERNAME &&
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
      () =>
        reject(
          Object.assign(new Error("d5c_canary_authority_read_timeout"), {
            code: "DATA_AI29C_D5C_TIMEOUT",
          }),
        ),
      timeoutMs,
    );
  });

  return Promise.race([promise, timeout]).finally(() =>
    clearTimeout(timer),
  );
}

function noAuthority(reason) {
  return normalizeD5cSunscreenCanaryAuthorityPayload({
    read_contract_version:
      "data-ai29c-d5c-sunscreen-canary-authority-read-v1",
    status: "NO_AUTHORITY",
    reason,
  });
}

function transportFailureReason(error) {
  return error?.code === "DATA_AI29C_D5C_TIMEOUT"
    ? "D5C_CANARY_AUTHORITY_READ_TIMEOUT"
    : "D5C_CANARY_AUTHORITY_READ_FAILED";
}

export function isD5cCanaryCredentialConfigured() {
  const databaseUrl = getDatabaseUrl();
  return Boolean(
    databaseUrl && isApprovedDatabaseUrl(databaseUrl),
  );
}

async function readD5cSunscreenCanaryAuthorityOnce(productId) {
  if (!D5C_SUNSCREEN_CANARY_PRODUCT_IDS.includes(productId)) {
    return noAuthority("PRODUCT_NOT_D5C_CANARY_TARGET");
  }

  const sql = getSqlClient();
  if (!sql) {
    return noAuthority("D5C_CANARY_AUTHORITY_CREDENTIAL_UNAVAILABLE");
  }

  try {
    const rows = await withTimeout(sql`
      select public.read_data_ai29c_d5c_sunscreen_canary_authority_v1(
        ${productId}::uuid
      ) as payload
    `);

    if (!Array.isArray(rows) || rows.length !== 1) {
      return noAuthority("D5C_CANARY_RPC_CARDINALITY_INVALID");
    }

    return normalizeD5cSunscreenCanaryAuthorityPayload(
      rows[0]?.payload,
    );
  } catch (error) {
    return noAuthority(transportFailureReason(error));
  }
}

function shouldRetryAuthority(result) {
  return (
    result?.status === "NO_AUTHORITY" &&
    (result?.reason === "D5C_CANARY_AUTHORITY_READ_TIMEOUT" ||
      result?.reason === "D5C_CANARY_AUTHORITY_READ_FAILED")
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function readD5cSunscreenCanaryAuthority(productId) {
  const first = await readD5cSunscreenCanaryAuthorityOnce(productId);
  if (!shouldRetryAuthority(first)) return first;

  await sleep(TRANSIENT_RETRY_DELAY_MS);
  return readD5cSunscreenCanaryAuthorityOnce(productId);
}

export async function readD5cSunscreenCanaryAuthorities() {
  const results = [];
  for (const productId of D5C_SUNSCREEN_CANARY_PRODUCT_IDS) {
    results.push(
      await readD5cSunscreenCanaryAuthority(productId),
    );
  }
  return Object.freeze(results);
}

export async function runD5cCanaryAuthoritySecurityProbe() {
  const sql = getSqlClient();
  if (!sql) {
    return Object.freeze({
      credentialAvailable: false,
      runtimeRoleMatch: false,
      rawTaxonomySelectDenied: false,
      rawSemanticSelectDenied: false,
      directSemanticRpcDenied: false,
    });
  }

  let runtimeRoleMatch = false;
  try {
    const rows = await withTimeout(
      sql`select current_user::text as role`,
    );
    runtimeRoleMatch =
      rows?.[0]?.role === D5C_CANARY_RUNTIME_ROLE;
  } catch {
    runtimeRoleMatch = false;
  }

  let rawTaxonomySelectDenied = false;
  try {
    await withTimeout(
      sql`select product_id from public.product_catalog_taxonomy_assignments limit 1`,
    );
  } catch (error) {
    rawTaxonomySelectDenied =
      String(error?.code || "") === "42501";
  }

  let rawSemanticSelectDenied = false;
  try {
    await withTimeout(
      sql`select product_id from public.sunscreen_recommendation_semantic_field_reviews limit 1`,
    );
  } catch (error) {
    rawSemanticSelectDenied =
      String(error?.code || "") === "42501";
  }

  let directSemanticRpcDenied = false;
  try {
    await withTimeout(sql`
      select public.read_sunscreen_recommendation_semantic_bundle_v1(
        ${D5C_SUNSCREEN_CANARY_PRODUCT_IDS[0]}::uuid
      )
    `);
  } catch (error) {
    directSemanticRpcDenied =
      String(error?.code || "") === "42501";
  }

  return Object.freeze({
    credentialAvailable: true,
    runtimeRoleMatch,
    rawTaxonomySelectDenied,
    rawSemanticSelectDenied,
    directSemanticRpcDenied,
  });
}
