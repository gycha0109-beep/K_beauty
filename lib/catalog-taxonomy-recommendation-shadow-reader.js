import "server-only";
import postgres from "postgres";
import {
  RECOMMENDATION_ADMISSION_DATABASE_URL_ENV,
  RECOMMENDATION_ADMISSION_RUNTIME_ROLE,
} from "@/lib/recommendation-admission-authority-reader";

export const DATA_TAXONOMY5_READ_RPC = "recommendation_shadow.read_catalog_taxonomy_recommendation_overlay_v1";

const PROJECT_REF = "bygrczggxfuisupcevaz";
const EXPECTED_POOLER_USERNAME = `${RECOMMENDATION_ADMISSION_RUNTIME_ROLE}.${PROJECT_REF}`;
const QUERY_TIMEOUT_MS = 5000;
let client = null;
let clientUrl = null;

function getDatabaseUrl() {
  const value = process.env[RECOMMENDATION_ADMISSION_DATABASE_URL_ENV];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function approved(databaseUrl) {
  try {
    const parsed = new URL(databaseUrl);
    return parsed.protocol === "postgresql:" && decodeURIComponent(parsed.username) === EXPECTED_POOLER_USERNAME && parsed.hostname.endsWith(".pooler.supabase.com") && parsed.port === "6543" && parsed.pathname === "/postgres" && Boolean(parsed.password);
  } catch {
    return false;
  }
}

function getClient() {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl || !approved(databaseUrl)) return null;
  if (client && clientUrl === databaseUrl) return client;
  try {
    client = postgres(databaseUrl, { prepare: false, max: 1, connect_timeout: 5, idle_timeout: 10, max_lifetime: 60 });
    clientUrl = databaseUrl;
    return client;
  } catch {
    client = null;
    clientUrl = null;
    return null;
  }
}

function withTimeout(promise) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error("taxonomy_shadow_read_timeout"), { code: "DATA_TAXONOMY5_TIMEOUT" })), QUERY_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function normalizeNullable(value) {
  return value == null || value === "" ? null : String(value);
}

function normalizeRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => Object.freeze({
    productId: String(row.product_id || ""),
    taxonomyVersion: String(row.taxonomy_version || ""),
    legacyCategory: normalizeNullable(row.legacy_category),
    legacyProductForm: normalizeNullable(row.legacy_product_form),
    projectedLegacyCategory: normalizeNullable(row.projected_legacy_category),
    projectedLegacyProductForm: normalizeNullable(row.projected_legacy_product_form),
    taxonomyLifecycleState: String(row.taxonomy_lifecycle_state || ""),
    taxonomyAuthorityMode: String(row.taxonomy_authority_mode || ""),
    exactEquivalent: row.exact_equivalent === true,
  }));
}

export async function readCatalogTaxonomyRecommendationOverlay() {
  const sql = getClient();
  if (!sql) return Object.freeze({ credentialAvailable: false, rows: [] });
  try {
    const rows = await withTimeout(sql`select * from recommendation_shadow.read_catalog_taxonomy_recommendation_overlay_v1()`);
    return Object.freeze({ credentialAvailable: true, rows: Object.freeze(normalizeRows(rows)) });
  } catch {
    return Object.freeze({ credentialAvailable: true, rows: [] });
  }
}

export async function runCatalogTaxonomyRecommendationShadowSecurityProbe() {
  const sql = getClient();
  if (!sql) return Object.freeze({ credentialAvailable: false, runtimeRoleMatch: false, rawProductSelectDenied: false, rawTaxonomySelectDenied: false, rows: [] });

  let runtimeRoleMatch = false;
  try {
    const rows = await withTimeout(sql`select current_user::text as role`);
    runtimeRoleMatch = rows?.[0]?.role === RECOMMENDATION_ADMISSION_RUNTIME_ROLE;
  } catch {}

  let rawProductSelectDenied = false;
  try {
    await withTimeout(sql`select id from public.products limit 1`);
  } catch (error) {
    rawProductSelectDenied = String(error?.code || "") === "42501";
  }

  let rawTaxonomySelectDenied = false;
  try {
    await withTimeout(sql`select product_id from public.catalog_taxonomy_product_exact_equivalence_v1 limit 1`);
  } catch (error) {
    rawTaxonomySelectDenied = String(error?.code || "") === "42501";
  }

  const overlay = await readCatalogTaxonomyRecommendationOverlay();
  return Object.freeze({ credentialAvailable: true, runtimeRoleMatch, rawProductSelectDenied, rawTaxonomySelectDenied, rows: overlay.rows });
}
