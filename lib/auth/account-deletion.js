import "server-only";

import { createPrivateKey, sign } from "node:crypto";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const APPLE_CLIENT_ID_DEFAULT = "com.bejewely.mobile";
const APPLE_TOKEN_URL = "https://appleid.apple.com/auth/token";
const APPLE_REVOKE_URL = "https://appleid.apple.com/auth/oauth2/v2/revoke";
const APPLE_AUDIENCE = "https://appleid.apple.com";
const APPLE_CLIENT_SECRET_LIFETIME_SECONDS = 5 * 60;

const CUSTOMER_DATA_PURGE_STEPS = Object.freeze([
  Object.freeze({ table: "analysis_results", column: "user_id" }),
  Object.freeze({ table: "recommendation_logs", column: "user_id" }),
  Object.freeze({ table: "analysis_requests", column: "user_id" }),
  Object.freeze({ table: "profiles", column: "id" })
]);

// These production FK references currently use RESTRICT against auth.users.
// Preflight them before revocation/deletion so protected operational audit
// history cannot turn account deletion into a silent partial delete.
const OPERATIONAL_DELETE_BLOCKERS = Object.freeze([
  Object.freeze({ table: "admin_product_review_confirmations", column: "actor_user_id" }),
  Object.freeze({ table: "admin_product_review_import_confirmations", column: "actor_user_id" }),
  Object.freeze({ table: "admin_product_review_import_v2_confirmations", column: "actor_user_id" }),
  Object.freeze({ table: "crawler_canonical_adoption_requests", column: "actor_user_id" }),
  Object.freeze({ table: "product_evidence_source_subject_bindings", column: "reviewed_by" }),
  Object.freeze({ table: "product_fact_confirmations", column: "actor_user_id" }),
  Object.freeze({ table: "product_fact_review_assignments", column: "assigned_to" }),
  Object.freeze({ table: "product_fact_review_events", column: "actor_user_id" }),
  Object.freeze({ table: "product_metadata_field_reviews", column: "reviewed_by" })
]);

export class AccountDeletionError extends Error {
  constructor(code, cause = null) {
    super(code);
    this.name = "AccountDeletionError";
    this.code = code;
    this.cause = cause;
  }
}

function requireVerifiedUser(user) {
  const userId = typeof user?.id === "string" ? user.id.trim() : "";

  if (!userId) {
    throw new AccountDeletionError("account_deletion_invalid_user");
  }

  return Object.freeze({ ...user, id: userId });
}

function userUsesApple(user) {
  const provider = typeof user?.app_metadata?.provider === "string"
    ? user.app_metadata.provider
    : "";
  const providers = Array.isArray(user?.app_metadata?.providers)
    ? user.app_metadata.providers
    : [];

  return provider === "apple" || providers.includes("apple");
}

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function normalizeApplePrivateKey(value) {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }

  return value.includes("\\n") ? value.replace(/\\n/g, "\n").trim() : value.trim();
}

function getAppleRevocationConfig() {
  const teamId = process.env.MOBILE_IOS_APPLE_TEAM_ID?.trim() || "";
  const keyId = process.env.APPLE_SIGN_IN_KEY_ID?.trim() || "";
  const privateKey = normalizeApplePrivateKey(process.env.APPLE_SIGN_IN_PRIVATE_KEY);
  const clientId = process.env.APPLE_SIGN_IN_CLIENT_ID?.trim() || APPLE_CLIENT_ID_DEFAULT;

  if (!teamId || !keyId || !privateKey || !clientId) {
    return null;
  }

  return Object.freeze({ teamId, keyId, privateKey, clientId });
}

function createAppleClientSecret(config) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = base64UrlJson({ alg: "ES256", kid: config.keyId });
  const payload = base64UrlJson({
    iss: config.teamId,
    iat: issuedAt,
    exp: issuedAt + APPLE_CLIENT_SECRET_LIFETIME_SECONDS,
    aud: APPLE_AUDIENCE,
    sub: config.clientId
  });
  const signingInput = `${header}.${payload}`;
  let key;

  try {
    key = createPrivateKey(config.privateKey);
  } catch (error) {
    throw new AccountDeletionError("apple_revocation_not_configured", error);
  }

  const signature = sign("sha256", Buffer.from(signingInput, "utf8"), {
    key,
    dsaEncoding: "ieee-p1363"
  }).toString("base64url");

  return `${signingInput}.${signature}`;
}

async function postAppleForm(url, values) {
  let response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(values),
      cache: "no-store"
    });
  } catch (error) {
    throw new AccountDeletionError("apple_revocation_unavailable", error);
  }

  return response;
}

async function revokeAppleAuthorization(user, authorizationCode) {
  if (!userUsesApple(user)) {
    return Object.freeze({ required: false, revoked: false });
  }

  const code = typeof authorizationCode === "string" ? authorizationCode.trim() : "";
  const config = getAppleRevocationConfig();

  if (!code) {
    throw new AccountDeletionError("apple_reauthorization_required");
  }

  if (!config) {
    throw new AccountDeletionError("apple_revocation_not_configured");
  }

  const clientSecret = createAppleClientSecret(config);
  const tokenResponse = await postAppleForm(APPLE_TOKEN_URL, {
    client_id: config.clientId,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code"
  });
  const tokenPayload = await tokenResponse.json().catch(() => null);

  if (!tokenResponse.ok) {
    throw new AccountDeletionError("apple_token_exchange_failed");
  }

  const refreshToken = typeof tokenPayload?.refresh_token === "string"
    ? tokenPayload.refresh_token.trim()
    : "";
  const accessToken = typeof tokenPayload?.access_token === "string"
    ? tokenPayload.access_token.trim()
    : "";
  const token = refreshToken || accessToken;
  const tokenTypeHint = refreshToken ? "refresh_token" : "access_token";

  if (!token) {
    throw new AccountDeletionError("apple_token_exchange_failed");
  }

  const revokeResponse = await postAppleForm(APPLE_REVOKE_URL, {
    client_id: config.clientId,
    client_secret: clientSecret,
    token,
    token_type_hint: tokenTypeHint
  });

  if (!revokeResponse.ok) {
    throw new AccountDeletionError("apple_revocation_failed");
  }

  return Object.freeze({ required: true, revoked: true });
}

async function assertNoOperationalDeleteBlockers(admin, userId) {
  for (const blocker of OPERATIONAL_DELETE_BLOCKERS) {
    const { data, error } = await admin
      .from(blocker.table)
      .select(blocker.column)
      .eq(blocker.column, userId)
      .limit(1);

    if (error) {
      throw new AccountDeletionError("account_deletion_preflight_failed", error);
    }

    if (Array.isArray(data) && data.length > 0) {
      throw new AccountDeletionError("account_deletion_requires_support");
    }
  }
}

async function purgeCustomerData(admin, userId) {
  for (const step of CUSTOMER_DATA_PURGE_STEPS) {
    const { error } = await admin
      .from(step.table)
      .delete()
      .eq(step.column, userId);

    if (error) {
      throw new AccountDeletionError("account_data_deletion_failed", error);
    }
  }
}

export async function deleteVerifiedAccount(user, { appleAuthorizationCode = null } = {}) {
  const verifiedUser = requireVerifiedUser(user);
  const admin = createSupabaseAdminClient();

  if (!admin) {
    throw new AccountDeletionError("account_deletion_not_configured");
  }

  await assertNoOperationalDeleteBlockers(admin, verifiedUser.id);
  const appleRevocation = await revokeAppleAuthorization(verifiedUser, appleAuthorizationCode);
  await purgeCustomerData(admin, verifiedUser.id);

  const { error } = await admin.auth.admin.deleteUser(verifiedUser.id, false);

  if (error) {
    throw new AccountDeletionError("account_auth_deletion_failed", error);
  }

  return Object.freeze({ deleted: true, appleRevocation });
}

export function getAccountDeletionContract() {
  return Object.freeze({
    customerDataPurgeSteps: CUSTOMER_DATA_PURGE_STEPS,
    operationalDeleteBlockers: OPERATIONAL_DELETE_BLOCKERS,
    authDeleteMode: "hard",
    appleRevocation: Object.freeze({
      requiredForAppleUsers: true,
      tokenEndpoint: APPLE_TOKEN_URL,
      revokeEndpoint: APPLE_REVOKE_URL,
      clientIdDefault: APPLE_CLIENT_ID_DEFAULT,
      requiredEnvironmentKeys: Object.freeze([
        "MOBILE_IOS_APPLE_TEAM_ID",
        "APPLE_SIGN_IN_KEY_ID",
        "APPLE_SIGN_IN_PRIVATE_KEY"
      ])
    })
  });
}
