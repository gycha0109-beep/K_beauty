export const PRODUCTION_ENV_PREVIEW_READINESS_PROBE_FLAG =
  "ENABLE_PRODUCTION_ENV_PREVIEW_READINESS_PROBE";
export const PRODUCTION_ENV_PREVIEW_READINESS_PROBE_BRANCH =
  "codex/local-shadow-runtime-validation";
export const PRODUCTION_ENV_PREVIEW_READINESS_RESPONSE_FIELDS = Object.freeze([
  "analysisRequestGuardSecretConfigured",
  "analysisRequestGuardSecretFormatValid",
  "anonymousWriteGrantSecretConfigured",
  "anonymousWriteGrantSecretFormatValid",
  "secretsDistinct",
  "secretsIndependentFromExistingSecrets",
  "premiumReleaseModeBetaOpen",
  "ready",
  "stopReasons"
]);

const EXISTING_SECRET_NAMES = Object.freeze([
  "WRITE_ACCESS_TOKEN_SECRET",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY"
]);

function normalizedSecret(envLike, name) {
  const value = envLike[name];
  return typeof value === "string" ? value.trim() : "";
}

function isMinimum256BitBase64Url(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return false;

  try {
    const decoded = Buffer.from(value, "base64url");
    return decoded.byteLength >= 32 && decoded.toString("base64url") === value;
  } catch {
    return false;
  }
}

export function isProductionEnvPreviewReadinessProbeAllowed(envLike = {}) {
  return (
    envLike.VERCEL_ENV === "preview" &&
    envLike.VERCEL_GIT_COMMIT_REF === PRODUCTION_ENV_PREVIEW_READINESS_PROBE_BRANCH &&
    envLike[PRODUCTION_ENV_PREVIEW_READINESS_PROBE_FLAG] === "1"
  );
}

export function buildProductionEnvPreviewReadiness(envLike = {}) {
  const analysisSecret = normalizedSecret(envLike, "ANALYSIS_REQUEST_GUARD_SECRET");
  const grantSecret = normalizedSecret(envLike, "ANONYMOUS_WRITE_GRANT_SECRET");
  const existingSecrets = EXISTING_SECRET_NAMES.map((name) => normalizedSecret(envLike, name)).filter(Boolean);

  const analysisRequestGuardSecretConfigured = analysisSecret.length > 0;
  const analysisRequestGuardSecretFormatValid = isMinimum256BitBase64Url(analysisSecret);
  const anonymousWriteGrantSecretConfigured = grantSecret.length > 0;
  const anonymousWriteGrantSecretFormatValid = isMinimum256BitBase64Url(grantSecret);
  const secretsDistinct =
    analysisRequestGuardSecretConfigured &&
    anonymousWriteGrantSecretConfigured &&
    analysisSecret !== grantSecret;
  const secretsIndependentFromExistingSecrets =
    analysisRequestGuardSecretConfigured &&
    anonymousWriteGrantSecretConfigured &&
    !existingSecrets.includes(analysisSecret) &&
    !existingSecrets.includes(grantSecret);
  const premiumReleaseModeBetaOpen = envLike.PREMIUM_RELEASE_MODE === "beta_open";

  const checks = {
    analysisRequestGuardSecretConfigured,
    analysisRequestGuardSecretFormatValid,
    anonymousWriteGrantSecretConfigured,
    anonymousWriteGrantSecretFormatValid,
    secretsDistinct,
    secretsIndependentFromExistingSecrets,
    premiumReleaseModeBetaOpen
  };
  const stopReasons = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);

  return {
    ...checks,
    ready: stopReasons.length === 0,
    stopReasons
  };
}

export function executeProductionEnvPreviewReadinessProbe(envLike = {}) {
  if (!isProductionEnvPreviewReadinessProbeAllowed(envLike)) {
    return { allowed: false, status: 404 };
  }

  const response = buildProductionEnvPreviewReadiness(envLike);
  return {
    allowed: true,
    status: 200,
    response: Object.fromEntries(
      PRODUCTION_ENV_PREVIEW_READINESS_RESPONSE_FIELDS.map((field) => [field, response[field]])
    )
  };
}
