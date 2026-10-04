import "server-only";
import postgres from "postgres";
import { isCanonicalRecommendationUuid } from "@/lib/recommendation-admission-authority-contract.mjs";
import {
  RECOMMENDATION_ADMISSION_DATABASE_URL_ENV,
  RECOMMENDATION_ADMISSION_RUNTIME_ROLE,
} from "@/lib/recommendation-admission-authority-reader";

export const RECOMMENDATION_CATEGORY_AUTHORITY_READ_CONTRACT_VERSION =
  "recommendation-category-authority-read-v1";
export const RECOMMENDATION_CATEGORY_AUTHORITY_READ_RPC =
  "read_recommendation_category_authority_v1";
export const RECOMMENDATION_CATEGORY_AUTHORITY_STATUS = Object.freeze({
  RESOLVED: "CATEGORY_AUTHORITY_RESOLVED",
  NONE: "NO_AUTHORITY",
});

const PROJECT_REF = "bygrczggxfuisupcevaz";
const EXPECTED_POOLER_USERNAME =
  `${RECOMMENDATION_ADMISSION_RUNTIME_ROLE}.${PROJECT_REF}`;
const CONNECT_TIMEOUT_SECONDS = 5;
const IDLE_TIMEOUT_SECONDS = 10;
const MAX_LIFETIME_SECONDS = 60;
const QUERY_TIMEOUT_MS = 5_000;
const SHA256_RE = /^[0-9a-f]{64}$/;
const SUPPORTED_CATEGORIES = new Set(["treatment", "toner_essence", "toner_pad"]);

let sqlClient = null;
let sqlClientUrl = null;

function noCategoryAuthority(reason) {
  return Object.freeze({
    readContractVersion: RECOMMENDATION_CATEGORY_AUTHORITY_READ_CONTRACT_VERSION,
    status: RECOMMENDATION_CATEGORY_AUTHORITY_STATUS.NONE,
    reason: String(reason || "CATEGORY_AUTHORITY_UNAVAILABLE"),
    authority: null,
    recommendationAdmissionMutated: false,
    productionCutoverAuthorized: false,
  });
}

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
      () =>
        reject(
          Object.assign(new Error("category_authority_read_timeout"), {
            code: "G4F2_TIMEOUT",
          }),
        ),
      timeoutMs,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function normalizeCategoryAuthorityPayload(payload, expectedProductId) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return noCategoryAuthority("MALFORMED_CATEGORY_RPC_OUTPUT");
  }
  if (
    payload.read_contract_version !==
    RECOMMENDATION_CATEGORY_AUTHORITY_READ_CONTRACT_VERSION
  ) {
    return noCategoryAuthority("CATEGORY_READ_CONTRACT_VERSION_MISMATCH");
  }
  if (payload.status === RECOMMENDATION_CATEGORY_AUTHORITY_STATUS.NONE) {
    return noCategoryAuthority(
      typeof payload.reason === "string" && payload.reason
        ? payload.reason
        : "CATEGORY_AUTHORITY_UNAVAILABLE",
    );
  }
  if (payload.status !== RECOMMENDATION_CATEGORY_AUTHORITY_STATUS.RESOLVED) {
    return noCategoryAuthority("MALFORMED_CATEGORY_RPC_STATUS");
  }

  const authority = payload.authority;
  if (!authority || typeof authority !== "object" || Array.isArray(authority)) {
    return noCategoryAuthority("MALFORMED_CATEGORY_RPC_AUTHORITY");
  }
  if (
    authority.product_id !== expectedProductId ||
    !isCanonicalRecommendationUuid(authority.product_id)
  ) {
    return noCategoryAuthority("CATEGORY_AUTHORITY_PRODUCT_BINDING_MISMATCH");
  }
  if (!SUPPORTED_CATEGORIES.has(authority.category)) {
    return noCategoryAuthority("CATEGORY_AUTHORITY_CATEGORY_UNSUPPORTED");
  }
  if (
    authority.taxonomy_version !== "catalog-taxonomy-v1" ||
    typeof authority.category_term_id !== "string" ||
    !authority.category_term_id.endsWith(`:category:${authority.category}`)
  ) {
    return noCategoryAuthority("CATEGORY_AUTHORITY_TAXONOMY_BINDING_MISMATCH");
  }
  if (
    !SHA256_RE.test(String(authority.assignment_snapshot_digest || "")) ||
    !isCanonicalRecommendationUuid(authority.candidate_id) ||
    !isCanonicalRecommendationUuid(authority.review_id) ||
    typeof authority.source_rule_key !== "string" ||
    typeof authority.review_policy_version !== "string"
  ) {
    return noCategoryAuthority("MALFORMED_CATEGORY_AUTHORITY_LINEAGE");
  }
  if (
    payload.recommendation_admission_mutated !== false ||
    payload.production_cutover_authorized !== false
  ) {
    return noCategoryAuthority("CATEGORY_AUTHORITY_BOUNDARY_VIOLATION");
  }

  return Object.freeze({
    readContractVersion: payload.read_contract_version,
    status: RECOMMENDATION_CATEGORY_AUTHORITY_STATUS.RESOLVED,
    reason: null,
    authority: Object.freeze({
      productId: authority.product_id,
      category: authority.category,
      taxonomyVersion: authority.taxonomy_version,
      entityKindTermId: authority.entity_kind_term_id || null,
      domainTermId: authority.domain_term_id || null,
      recommendationFamilyTermId: authority.recommendation_family_term_id || null,
      categoryTermId: authority.category_term_id,
      assignmentSnapshotDigest: authority.assignment_snapshot_digest,
      candidateId: authority.candidate_id,
      sourceRuleKey: authority.source_rule_key,
      reviewId: authority.review_id,
      reviewPolicyVersion: authority.review_policy_version,
    }),
    recommendationAdmissionMutated: false,
    productionCutoverAuthorized: false,
  });
}

function categoryTransportFailureReason(error) {
  return error?.code === "G4F2_TIMEOUT"
    ? "CATEGORY_AUTHORITY_READ_TIMEOUT"
    : "CATEGORY_AUTHORITY_READ_FAILED";
}

export async function readRecommendationCategoryAuthority(productId) {
  if (!isCanonicalRecommendationUuid(productId)) {
    return noCategoryAuthority("MALFORMED_PRODUCT_UUID");
  }

  const sql = getSqlClient();
  if (!sql) {
    return noCategoryAuthority("CATEGORY_AUTHORITY_CREDENTIAL_UNAVAILABLE");
  }

  try {
    const rows = await withTimeout(sql`
      select public.read_recommendation_category_authority_v1(${productId}::uuid) as payload
    `);
    if (!Array.isArray(rows) || rows.length !== 1) {
      return noCategoryAuthority("MALFORMED_CATEGORY_RPC_CARDINALITY");
    }
    return normalizeCategoryAuthorityPayload(rows[0]?.payload, productId);
  } catch (error) {
    return noCategoryAuthority(categoryTransportFailureReason(error));
  }
}

async function rawSelectDenied(sql, query) {
  try {
    await withTimeout(query(sql));
    return false;
  } catch (error) {
    return String(error?.code || "") === "42501";
  }
}

export async function runRecommendationCategoryAuthorityRuntimeSecurityProbe(
  productId,
) {
  const sql = getSqlClient();
  if (!sql) {
    return Object.freeze({
      credentialAvailable: false,
      runtimeRoleMatch: false,
      rawCategoryReviewSelectDenied: false,
      rawTaxonomySelectDenied: false,
      rawTaxonomyVersionSelectDenied: false,
      authority: noCategoryAuthority("CATEGORY_AUTHORITY_CREDENTIAL_UNAVAILABLE"),
    });
  }

  let runtimeRoleMatch = false;
  try {
    const rows = await withTimeout(sql`select current_user::text as role`);
    runtimeRoleMatch =
      rows?.[0]?.role === RECOMMENDATION_ADMISSION_RUNTIME_ROLE;
  } catch {
    runtimeRoleMatch = false;
  }

  const rawCategoryReviewSelectDenied = await rawSelectDenied(
    sql,
    (client) =>
      client`select review_id from public.recommendation_category_authority_reviews limit 1`,
  );
  const rawTaxonomySelectDenied = await rawSelectDenied(
    sql,
    (client) =>
      client`select product_id from public.product_catalog_taxonomy_assignments limit 1`,
  );
  const rawTaxonomyVersionSelectDenied = await rawSelectDenied(
    sql,
    (client) =>
      client`select version from public.catalog_taxonomy_versions limit 1`,
  );

  const authority = await readRecommendationCategoryAuthority(productId);
  return Object.freeze({
    credentialAvailable: true,
    runtimeRoleMatch,
    rawCategoryReviewSelectDenied,
    rawTaxonomySelectDenied,
    rawTaxonomyVersionSelectDenied,
    authority,
  });
}
