import "server-only";
import postgres from "postgres";
import { applyProductOfferReadPath } from "@/lib/product-offer-read-path";

export const PRODUCT_OFFER_DATABASE_URL_ENV = "RECOMMENDATION_ADMISSION_DATABASE_URL";
export const PRODUCT_OFFER_RUNTIME_ROLE = "recommendation_admission_runtime";
export const PRODUCT_OFFER_READ_RPC = "read_product_offer_presentation_authority_v1";
export const PRODUCT_OFFER_READ_CONTRACT_VERSION =
  "product-offer-presentation-authority-read-v1";

const PROJECT_REF = "bygrczggxfuisupcevaz";
const EXPECTED_POOLER_USERNAME = `${PRODUCT_OFFER_RUNTIME_ROLE}.${PROJECT_REF}`;
const PRODUCT_ID_LIMIT = 64;
const CONNECT_TIMEOUT_SECONDS = 5;
const IDLE_TIMEOUT_SECONDS = 10;
const MAX_LIFETIME_SECONDS = 60;
const QUERY_TIMEOUT_MS = 5_000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let sqlClient = null;
let sqlClientUrl = null;

function getDatabaseUrl() {
  const value = process.env[PRODUCT_OFFER_DATABASE_URL_ENV];
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
      () => reject(Object.assign(new Error("product_offer_read_timeout"), { code: "DATA_OFFER16_TIMEOUT" })),
      timeoutMs,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function normalizeProductIds(productIds) {
  if (!Array.isArray(productIds)) {
    throw new Error("product_offer_product_ids_invalid");
  }

  const normalized = productIds.map((value) =>
    typeof value === "string" ? value.trim().toLowerCase() : "",
  );

  if (normalized.some((value) => !UUID_PATTERN.test(value))) {
    throw new Error("product_offer_product_id_invalid");
  }

  const distinct = Array.from(new Set(normalized)).sort();
  if (distinct.length > PRODUCT_ID_LIMIT) {
    throw new Error("product_offer_product_id_limit_exceeded");
  }

  return distinct;
}

function normalizeOfferAuthorityPayload(payload) {
  if (
    !payload ||
    typeof payload !== "object" ||
    payload.read_contract_version !== PRODUCT_OFFER_READ_CONTRACT_VERSION ||
    payload.status !== "AUTHORITY_RESOLVED" ||
    !Array.isArray(payload.offers)
  ) {
    throw new Error("product_offer_authority_unavailable");
  }

  return payload.offers;
}

async function loadProductOffersByIds(productIds) {
  const normalizedProductIds = normalizeProductIds(productIds);
  if (!normalizedProductIds.length) return [];

  const sql = getSqlClient();
  if (!sql) {
    throw new Error("product_offer_read_unavailable");
  }

  const rows = await withTimeout(sql`
    select public.read_product_offer_presentation_authority_v1(
      ${sql.array(normalizedProductIds)}::uuid[]
    ) as payload
  `);

  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new Error("product_offer_read_cardinality_invalid");
  }

  return normalizeOfferAuthorityPayload(rows[0]?.payload);
}

export function isProductOfferPresentationCredentialConfigured() {
  const databaseUrl = getDatabaseUrl();
  return Boolean(databaseUrl && isApprovedDatabaseUrl(databaseUrl));
}

export async function projectDecisionWithCurrentProductOffers(decision) {
  return applyProductOfferReadPath(decision, loadProductOffersByIds, {
    marketCode: "KR"
  });
}
