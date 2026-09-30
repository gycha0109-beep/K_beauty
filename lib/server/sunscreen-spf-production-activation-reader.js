import "server-only";

import postgres from "postgres";
import {
  D5D_SPF_RUNTIME_ACTIVATION_CONTRACT_VERSION,
  normalizeD5dSpfRuntimeActivation,
} from "@/lib/sunscreen-spf-production-activation-contract.mjs";

export const D5D_SPF_ACTIVATION_DATABASE_URL_ENV =
  "RECOMMENDATION_ADMISSION_DATABASE_URL";
export const D5D_SPF_ACTIVATION_RUNTIME_ROLE =
  "recommendation_admission_runtime";
export const D5D_SPF_ACTIVATION_READ_RPC =
  "read_data_ai29c_d5d_spf_runtime_activation_v1";

const PROJECT_REF = "bygrczggxfuisupcevaz";
const EXPECTED_POOLER_USERNAME =
  `${D5D_SPF_ACTIVATION_RUNTIME_ROLE}.${PROJECT_REF}`;

let sqlClient = null;
let sqlClientUrl = null;

function getDatabaseUrl() {
  const value = process.env[D5D_SPF_ACTIVATION_DATABASE_URL_ENV];
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
      connect_timeout: 5,
      idle_timeout: 10,
      max_lifetime: 60,
    });
    sqlClientUrl = databaseUrl;
    return sqlClient;
  } catch {
    sqlClient = null;
    sqlClientUrl = null;
    return null;
  }
}

function failClosed(reason) {
  return normalizeD5dSpfRuntimeActivation({
    contract_version:
      D5D_SPF_RUNTIME_ACTIVATION_CONTRACT_VERSION,
    scope: "authenticated_product_query_beta",
    enabled: false,
    authorized_phase: "DATA-AI29C-D5D",
    updated_at: null,
    reason,
  });
}

export async function readD5dSpfRuntimeActivation() {
  const sql = getSqlClient();
  if (!sql) {
    return failClosed("D5D_ACTIVATION_CREDENTIAL_UNAVAILABLE");
  }

  try {
    const rows = await sql`
      select public.read_data_ai29c_d5d_spf_runtime_activation_v1()
        as payload
    `;

    if (!Array.isArray(rows) || rows.length !== 1) {
      return failClosed("D5D_ACTIVATION_RPC_CARDINALITY_INVALID");
    }

    return normalizeD5dSpfRuntimeActivation(rows[0]?.payload);
  } catch {
    return failClosed("D5D_ACTIVATION_READ_FAILED");
  }
}
