import { createPublicKey, verify as verifySignature } from "crypto";

export const G3A_GITHUB_OIDC_ISSUER = "https://token.actions.githubusercontent.com";
export const G3A_RUNTIME_PROBE_AUDIENCE =
  "urn:bejewely:v21-admission-g3a:runtime-probe";
export const G3A_RUNTIME_PROBE_REPOSITORY = "gycha0109-beep/K_beauty";
export const G3A_RUNTIME_PROBE_REPOSITORY_ID = "1205065704";
export const G3A_RUNTIME_PROBE_WORKFLOW_PATH =
  ".github/workflows/v21-admission-g3a-pf-authority-read.yml";

const OIDC_METADATA_URL =
  `${G3A_GITHUB_OIDC_ISSUER}/.well-known/openid-configuration`;
const CLOCK_SKEW_SECONDS = 60;
const MAX_TOKEN_AGE_SECONDS = 10 * 60;
const SHA_PATTERN = /^[0-9a-f]{40}$/;
const RUN_ID_PATTERN = /^\d+$/;

function decodeJwtJson(segment) {
  try {
    return JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function audienceMatches(actual, expected) {
  return Array.isArray(actual) ? actual.includes(expected) : actual === expected;
}

async function fetchJson(fetchImpl, url) {
  const response = await fetchImpl(url, {
    method: "GET",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!response?.ok) throw new Error("oidc_fetch_failed");
  return response.json();
}

function validateTimeClaims(payload, nowSeconds) {
  const exp = Number(payload?.exp);
  const iat = Number(payload?.iat);
  const nbf = payload?.nbf == null ? iat : Number(payload.nbf);
  if (![exp, iat, nbf].every(Number.isFinite)) return "invalid_time_claim";
  if (exp <= nowSeconds - CLOCK_SKEW_SECONDS) return "token_expired";
  if (nbf > nowSeconds + CLOCK_SKEW_SECONDS) return "token_not_yet_valid";
  if (iat > nowSeconds + CLOCK_SKEW_SECONDS) return "token_issued_in_future";
  if (nowSeconds - iat > MAX_TOKEN_AGE_SECONDS) return "token_too_old";
  return null;
}

function validateClaims(payload, { expectedDeploymentSha, expectedGitRef }, nowSeconds) {
  const expectedRef = `refs/heads/${expectedGitRef}`;
  const expectedWorkflowRef = `${G3A_RUNTIME_PROBE_REPOSITORY}/${G3A_RUNTIME_PROBE_WORKFLOW_PATH}@${expectedRef}`;
  if (payload?.iss !== G3A_GITHUB_OIDC_ISSUER) return "invalid_issuer";
  if (!audienceMatches(payload?.aud, G3A_RUNTIME_PROBE_AUDIENCE)) return "invalid_audience";
  if (payload?.repository !== G3A_RUNTIME_PROBE_REPOSITORY) return "invalid_repository";
  if (String(payload?.repository_id || "") !== G3A_RUNTIME_PROBE_REPOSITORY_ID) return "invalid_repository_id";
  if (payload?.event_name !== "push") return "invalid_event_name";
  if (payload?.ref !== expectedRef || payload?.ref_type !== "branch") return "invalid_ref";
  if (payload?.workflow_ref !== expectedWorkflowRef) return "invalid_workflow_ref";
  if (!SHA_PATTERN.test(String(expectedDeploymentSha || ""))) return "invalid_expected_deployment_sha";
  if (payload?.workflow_sha !== expectedDeploymentSha || payload?.sha !== expectedDeploymentSha) {
    return "deployment_sha_mismatch";
  }
  if (!RUN_ID_PATTERN.test(String(payload?.run_id || ""))) return "invalid_run_id";
  if (!RUN_ID_PATTERN.test(String(payload?.run_attempt || ""))) return "invalid_run_attempt";
  if (payload?.runner_environment !== "github-hosted") return "invalid_runner_environment";
  return validateTimeClaims(payload, nowSeconds);
}

export function getG3ABearerTokenFromRequest(request) {
  const authorization = request?.headers?.get?.("authorization") || "";
  const match = authorization.match(/^Bearer\s+([^\s]+)$/i);
  return match ? match[1] : null;
}

export async function verifyG3AGitHubActionsOidcToken(
  token,
  {
    expectedDeploymentSha,
    expectedGitRef,
    fetchImpl = fetch,
    nowMs = Date.now(),
  } = {},
) {
  if (typeof token !== "string" || !token.trim()) {
    return { ok: false, code: "missing_bearer_token" };
  }
  if (typeof expectedGitRef !== "string" || !expectedGitRef.trim()) {
    return { ok: false, code: "invalid_expected_git_ref" };
  }

  const segments = token.split(".");
  if (segments.length !== 3) return { ok: false, code: "malformed_jwt" };
  const [encodedHeader, encodedPayload, encodedSignature] = segments;
  const header = decodeJwtJson(encodedHeader);
  const payload = decodeJwtJson(encodedPayload);
  if (!header || !payload || header.alg !== "RS256" || !header.kid) {
    return { ok: false, code: "invalid_jwt_header" };
  }

  let metadata;
  let jwks;
  try {
    metadata = await fetchJson(fetchImpl, OIDC_METADATA_URL);
    if (metadata?.issuer !== G3A_GITHUB_OIDC_ISSUER) {
      return { ok: false, code: "invalid_oidc_metadata_issuer" };
    }
    const jwksUrl = new URL(String(metadata?.jwks_uri || ""));
    if (jwksUrl.protocol !== "https:" || jwksUrl.hostname !== "token.actions.githubusercontent.com") {
      return { ok: false, code: "invalid_jwks_uri" };
    }
    jwks = await fetchJson(fetchImpl, jwksUrl.toString());
  } catch {
    return { ok: false, code: "oidc_metadata_unavailable" };
  }

  const jwk = Array.isArray(jwks?.keys)
    ? jwks.keys.find((candidate) =>
        candidate?.kid === header.kid &&
        candidate?.kty === "RSA" &&
        (!candidate.alg || candidate.alg === "RS256") &&
        (!candidate.use || candidate.use === "sig"))
    : null;
  if (!jwk) return { ok: false, code: "signing_key_not_found" };

  let signatureValid = false;
  try {
    const publicKey = createPublicKey({ key: jwk, format: "jwk" });
    signatureValid = verifySignature(
      "RSA-SHA256",
      Buffer.from(`${encodedHeader}.${encodedPayload}`, "utf8"),
      publicKey,
      Buffer.from(encodedSignature, "base64url"),
    );
  } catch {
    signatureValid = false;
  }
  if (!signatureValid) return { ok: false, code: "invalid_signature" };

  const claimError = validateClaims(
    payload,
    { expectedDeploymentSha: String(expectedDeploymentSha || ""), expectedGitRef: expectedGitRef.trim() },
    Math.floor(nowMs / 1000),
  );
  if (claimError) return { ok: false, code: claimError };

  return {
    ok: true,
    code: "trusted_github_actions_oidc",
    claims: Object.freeze({
      repository: payload.repository,
      ref: payload.ref,
      workflowSha: payload.workflow_sha,
      runId: String(payload.run_id),
      runAttempt: String(payload.run_attempt),
    }),
  };
}
