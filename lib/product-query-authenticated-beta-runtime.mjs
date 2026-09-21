import { createHash } from "node:crypto";

export const PRODUCT_QUERY_AUTHENTICATED_BETA_RUNTIME_POLICY_VERSION =
  "product-query-authenticated-beta-runtime-policy-v1";

export const DATA_AI18_BETA_RUNTIME_PHASE_AUTHORIZED = false;

function normalized(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function hashProductQueryBetaSubject(subject) {
  const value = String(subject ?? "").trim();
  if (!value) return null;
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function parseApprovedProductQueryBetaAccountHashes(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return Object.freeze([]);

  const parts = raw.split(",").map((item) => item.trim().toLowerCase());
  if (
    parts.length === 0 ||
    parts.length > 25 ||
    parts.some((item) => !/^[0-9a-f]{64}$/.test(item)) ||
    new Set(parts).size !== parts.length
  ) {
    return null;
  }
  return Object.freeze(parts);
}

export function evaluateProductQueryAuthenticatedBetaStaticGate(
  envLike = {},
  { phaseRuntimeAuthorized = DATA_AI18_BETA_RUNTIME_PHASE_AUTHORIZED } = {}
) {
  const vercelEnv = normalized(envLike.VERCEL_ENV);
  const requested =
    normalized(envLike.BEJEWELY_PRODUCT_QUERY_BETA_ENABLED) === "true";
  const runtimeAuthorized =
    normalized(envLike.BEJEWELY_PRODUCT_QUERY_BETA_RUNTIME_AUTHORIZED) === "true";
  const approvedHashes = parseApprovedProductQueryBetaAccountHashes(
    envLike.BEJEWELY_PRODUCT_QUERY_BETA_APPROVED_ACCOUNT_HASHES
  );
  const approvedAccountConfigurationValid =
    Array.isArray(approvedHashes) && approvedHashes.length > 0;
  const productionEnvironment = vercelEnv === "production";

  const staticAllowed =
    phaseRuntimeAuthorized === true &&
    productionEnvironment &&
    requested &&
    runtimeAuthorized &&
    approvedAccountConfigurationValid;

  return Object.freeze({
    policyVersion: PRODUCT_QUERY_AUTHENTICATED_BETA_RUNTIME_POLICY_VERSION,
    staticAllowed,
    phaseRuntimeAuthorized: phaseRuntimeAuthorized === true,
    productionEnvironment,
    requested,
    runtimeAuthorized,
    approvedAccountConfigurationValid,
    authenticatedOnly: true,
    automaticTrafficSampling: false,
    publicSearchCutover: false,
    persisted: false
  });
}

export function evaluateProductQueryAuthenticatedBetaRuntime(
  {
    envLike = {},
    subject = null,
    phaseRuntimeAuthorized = DATA_AI18_BETA_RUNTIME_PHASE_AUTHORIZED
  } = {}
) {
  const staticGate = evaluateProductQueryAuthenticatedBetaStaticGate(envLike, {
    phaseRuntimeAuthorized
  });
  const subjectHash = hashProductQueryBetaSubject(subject);
  const approvedHashes = parseApprovedProductQueryBetaAccountHashes(
    envLike.BEJEWELY_PRODUCT_QUERY_BETA_APPROVED_ACCOUNT_HASHES
  );
  const approvedSubject =
    Boolean(subjectHash) &&
    Array.isArray(approvedHashes) &&
    approvedHashes.includes(subjectHash);
  const allowed = staticGate.staticAllowed && approvedSubject;

  return Object.freeze({
    policyVersion: PRODUCT_QUERY_AUTHENTICATED_BETA_RUNTIME_POLICY_VERSION,
    allowed,
    approvedSubject,
    phaseRuntimeAuthorized: staticGate.phaseRuntimeAuthorized,
    authenticatedOnly: true,
    explicitServerSideBetaEligibilityRequired: true,
    automaticTrafficSampling: false,
    publicSearchCutover: false,
    persisted: false
  });
}

export const PRODUCT_QUERY_AUTHENTICATED_BETA_RUNTIME_LIMITS = Object.freeze({
  phase: "DATA-AI18",
  defaultEnabled: false,
  phaseRuntimeAuthorized: false,
  authenticatedOnly: true,
  explicitServerSideBetaEligibilityRequired: true,
  approvedAccountHashAlgorithm: "sha256",
  maxApprovedAccounts: 25,
  rawAccountIdPersistence: false,
  accountHashPersistence: false,
  accessTokenPersistence: false,
  rawQueryPersistence: false,
  savedProfileRead: false,
  historyRead: false,
  profileMerge: false,
  persistence: "none",
  productionWrite: false,
  recommendationLogWrite: false,
  directProductFactRead: false,
  taxonomyRuntimeAuthority: false,
  providerRole: "intent_parsing_only",
  providerProductSelection: false,
  providerRankingAuthority: false,
  deterministicRankingAuthority: "existing_recommendation_engine",
  automaticTrafficSampling: false,
  publicSearchCutover: false,
  browserControlledActivation: false,
  requestControlledActivation: false,
  userFacingProductionActivation: false
});
