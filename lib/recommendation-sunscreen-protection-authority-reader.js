import "server-only";
import postgres from "postgres";
import {
  isCanonicalProtectionProductUuid,
  noRecommendationSunscreenProtectionAuthority,
  normalizeRecommendationSunscreenProtectionAuthorityPayload
} from "@/lib/recommendation-sunscreen-protection-authority-contract.mjs";

export const RECOMMENDATION_PROTECTION_DATABASE_URL_ENV =
  "RECOMMENDATION_PROTECTION_DATABASE_URL";
export const RECOMMENDATION_PROTECTION_SHADOW_FALLBACK_DATABASE_URL_ENV =
  "RECOMMENDATION_ADMISSION_DATABASE_URL";
export const RECOMMENDATION_PROTECTION_RUNTIME_ROLE =
  "recommendation_protection_runtime";
export const RECOMMENDATION_PROTECTION_SHADOW_FALLBACK_ROLE =
  "recommendation_admission_runtime";
export const RECOMMENDATION_PROTECTION_READ_RPC =
  "read_recommendation_sunscreen_protection_authority_v1";

const PROJECT_REF = "bygrczggxfuisupcevaz";
const EXPECTED_POOLER_USERNAMES = new Set([
  `${RECOMMENDATION_PROTECTION_RUNTIME_ROLE}.${PROJECT_REF}`,
  `${RECOMMENDATION_PROTECTION_SHADOW_FALLBACK_ROLE}.${PROJECT_REF}`
]);
const CONNECT_TIMEOUT_SECONDS = 5;
const IDLE_TIMEOUT_SECONDS = 10;
const MAX_LIFETIME_SECONDS = 60;
const QUERY_TIMEOUT_MS = 5_000;
const MAX_BATCH_PRODUCT_IDS = 50;

let sqlClient = null;
let sqlClientUrl = null;

function getDatabaseUrl(options = {}) {
  const primary =
    process.env[RECOMMENDATION_PROTECTION_DATABASE_URL_ENV];
  if (typeof primary === "string" && primary.trim()) {
    return primary.trim();
  }

  if (options.allowShadowTransportFallback === true) {
    const fallback =
      process.env[RECOMMENDATION_PROTECTION_SHADOW_FALLBACK_DATABASE_URL_ENV];
    if (typeof fallback === "string" && fallback.trim()) {
      return fallback.trim();
    }
  }

  return null;
}

function isApprovedDatabaseUrl(databaseUrl, options = {}) {
  try {
    const parsed = new URL(databaseUrl);
    const username = decodeURIComponent(parsed.username);
    const primaryUsername =
      `${RECOMMENDATION_PROTECTION_RUNTIME_ROLE}.${PROJECT_REF}`;
    const fallbackUsername =
      `${RECOMMENDATION_PROTECTION_SHADOW_FALLBACK_ROLE}.${PROJECT_REF}`;
    const usernameAllowed =
      username === primaryUsername ||
      (options.allowShadowTransportFallback === true &&
        username === fallbackUsername);

    return (
      parsed.protocol === "postgresql:" &&
      EXPECTED_POOLER_USERNAMES.has(username) &&
      usernameAllowed &&
      parsed.hostname.endsWith(".pooler.supabase.com") &&
      parsed.port === "6543" &&
      parsed.pathname === "/postgres" &&
      Boolean(parsed.password)
    );
  } catch {
    return false;
  }
}

function getSqlClient(options = {}) {
  const databaseUrl = getDatabaseUrl(options);
  if (!databaseUrl || !isApprovedDatabaseUrl(databaseUrl, options)) return null;
  if (sqlClient && sqlClientUrl === databaseUrl) return sqlClient;

  try {
    sqlClient = postgres(databaseUrl, {
      prepare: false,
      max: 1,
      connect_timeout: CONNECT_TIMEOUT_SECONDS,
      idle_timeout: IDLE_TIMEOUT_SECONDS,
      max_lifetime: MAX_LIFETIME_SECONDS
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
          Object.assign(new Error("protection_authority_read_timeout"), {
            code: "DATA_AI29C_AUTHORITY_TIMEOUT"
          })
        ),
      timeoutMs
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function transportFailureReason(error) {
  return error?.code === "DATA_AI29C_AUTHORITY_TIMEOUT"
    ? "PF_PROTECTION_AUTHORITY_READ_TIMEOUT"
    : "PF_PROTECTION_AUTHORITY_READ_FAILED";
}

export function getRecommendationProtectionCredentialMode(options = {}) {
  const primary = process.env[RECOMMENDATION_PROTECTION_DATABASE_URL_ENV];
  if (typeof primary === "string" && primary.trim()) {
    return isApprovedDatabaseUrl(primary.trim(), {
      allowShadowTransportFallback: false
    })
      ? "dedicated"
      : "unavailable";
  }

  if (options.allowShadowTransportFallback === true) {
    const fallback =
      process.env[RECOMMENDATION_PROTECTION_SHADOW_FALLBACK_DATABASE_URL_ENV];
    if (typeof fallback === "string" && fallback.trim()) {
      return isApprovedDatabaseUrl(fallback.trim(), {
        allowShadowTransportFallback: true
      })
        ? "admission_shadow_fallback"
        : "unavailable";
    }
  }

  return "unavailable";
}

export function isRecommendationProtectionCredentialConfigured(options = {}) {
  return getRecommendationProtectionCredentialMode(options) !== "unavailable";
}

export async function readRecommendationSunscreenProtectionAuthority(productId) {
  if (!isCanonicalProtectionProductUuid(productId)) {
    return noRecommendationSunscreenProtectionAuthority(
      "MALFORMED_PRODUCT_UUID"
    );
  }

  const sql = getSqlClient();
  if (!sql) {
    return noRecommendationSunscreenProtectionAuthority(
      "PF_PROTECTION_AUTHORITY_CREDENTIAL_UNAVAILABLE"
    );
  }

  try {
    const rows = await withTimeout(sql`
      select public.read_recommendation_sunscreen_protection_authority_v1(
        ${productId}::uuid
      ) as payload
    `);

    if (!Array.isArray(rows) || rows.length !== 1) {
      return noRecommendationSunscreenProtectionAuthority(
        "MALFORMED_RPC_CARDINALITY"
      );
    }

    return normalizeRecommendationSunscreenProtectionAuthorityPayload(
      rows[0]?.payload
    );
  } catch (error) {
    return noRecommendationSunscreenProtectionAuthority(
      transportFailureReason(error)
    );
  }
}

export async function readRecommendationSunscreenProtectionAuthorities(
  productIds,
  options = {}
) {
  const input = Array.isArray(productIds) ? productIds : [];
  const uniqueIds = Array.from(
    new Set(
      input
        .filter((value) => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );

  if (uniqueIds.length < 1 || uniqueIds.length > MAX_BATCH_PRODUCT_IDS) {
    return Object.freeze([]);
  }

  const invalidIds = uniqueIds.filter(
    (productId) => !isCanonicalProtectionProductUuid(productId)
  );
  if (invalidIds.length > 0) {
    return Object.freeze(
      uniqueIds.map((productId) =>
        Object.freeze({
          productId,
          authority: noRecommendationSunscreenProtectionAuthority(
            isCanonicalProtectionProductUuid(productId)
              ? "PF_PROTECTION_AUTHORITY_BATCH_ABORTED"
              : "MALFORMED_PRODUCT_UUID"
          )
        })
      )
    );
  }

  const allowShadowTransportFallback =
    options.allowShadowTransportFallback === true;
  const sql = getSqlClient({ allowShadowTransportFallback });
  if (!sql) {
    return Object.freeze(
      uniqueIds.map((productId) =>
        Object.freeze({
          productId,
          authority: noRecommendationSunscreenProtectionAuthority(
            "PF_PROTECTION_AUTHORITY_CREDENTIAL_UNAVAILABLE"
          )
        })
      )
    );
  }

  try {
    const rows = await withTimeout(sql`
      select
        input.product_id::text as product_id,
        public.read_recommendation_sunscreen_protection_authority_v1(
          input.product_id
        ) as payload
      from unnest(${sql.array(uniqueIds)}::uuid[]) as input(product_id)
      order by input.product_id
    `);

    if (!Array.isArray(rows) || rows.length !== uniqueIds.length) {
      return Object.freeze(
        uniqueIds.map((productId) =>
          Object.freeze({
            productId,
            authority: noRecommendationSunscreenProtectionAuthority(
              "MALFORMED_RPC_BATCH_CARDINALITY"
            )
          })
        )
      );
    }

    const byId = new Map(
      rows.map((row) => [
        String(row?.product_id || ""),
        normalizeRecommendationSunscreenProtectionAuthorityPayload(row?.payload)
      ])
    );

    return Object.freeze(
      uniqueIds.map((productId) =>
        Object.freeze({
          productId,
          authority:
            byId.get(productId) ||
            noRecommendationSunscreenProtectionAuthority(
              "MALFORMED_RPC_BATCH_MISSING_PRODUCT"
            )
        })
      )
    );
  } catch (error) {
    const reason = transportFailureReason(error);
    return Object.freeze(
      uniqueIds.map((productId) =>
        Object.freeze({
          productId,
          authority: noRecommendationSunscreenProtectionAuthority(reason)
        })
      )
    );
  }
}

export async function runRecommendationProtectionRuntimeSecurityProbe(productId) {
  const sql = getSqlClient();
  if (!sql) {
    return Object.freeze({
      credentialAvailable: false,
      runtimeRoleMatch: false,
      rawPfSelectDenied: false,
      authority: noRecommendationSunscreenProtectionAuthority(
        "PF_PROTECTION_AUTHORITY_CREDENTIAL_UNAVAILABLE"
      )
    });
  }

  let runtimeRoleMatch = false;
  try {
    const rows = await withTimeout(sql`select current_user::text as role`);
    runtimeRoleMatch =
      rows?.[0]?.role === RECOMMENDATION_PROTECTION_RUNTIME_ROLE;
  } catch {
    runtimeRoleMatch = false;
  }

  let rawPfSelectDenied = false;
  try {
    await withTimeout(
      sql`select subject_id from public.product_fact_subjects limit 1`
    );
  } catch (error) {
    rawPfSelectDenied = String(error?.code || "") === "42501";
  }

  const authority =
    await readRecommendationSunscreenProtectionAuthority(productId);

  return Object.freeze({
    credentialAvailable: true,
    runtimeRoleMatch,
    rawPfSelectDenied,
    authority
  });
}
