import {
  PRODUCT_QUERY_PRODUCTION_ACTIVATION_MAX_SAMPLE_BPS
} from "./product-query-production-activation-policy.mjs";
import {
  PRODUCT_QUERY_PRODUCTION_ACTIVATION_SAFETY
} from "./product-query-production-activation-safety-contract.mjs";

export const PRODUCT_QUERY_PRODUCTION_CANARY_PREFLIGHT_VERSION =
  "product-query-production-canary-preflight-v1";

export const PRODUCT_QUERY_PRODUCTION_CANARY_MAX_ACCOUNT_HASHES = 3;
export const PRODUCT_QUERY_PRODUCTION_CANARY_MAX_WINDOW_MINUTES = 60;

function normalized(value) {
  return String(value ?? "").trim().toLowerCase();
}

function parsePositiveSampleBps(value) {
  const raw = String(value ?? "").trim();
  if (!/^\d+$/.test(raw)) return null;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed)) return null;
  if (parsed < 1 || parsed > PRODUCT_QUERY_PRODUCTION_ACTIVATION_MAX_SAMPLE_BPS) {
    return null;
  }
  return parsed;
}

function parseApprovedAccountHashes(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return Object.freeze([]);
  const values = raw.split(",").map((item) => item.trim()).filter(Boolean);
  const unique = Array.from(new Set(values));
  if (unique.length !== values.length) return null;
  if (unique.length < 1 || unique.length > PRODUCT_QUERY_PRODUCTION_CANARY_MAX_ACCOUNT_HASHES) {
    return null;
  }
  if (!unique.every((item) => /^[a-f0-9]{64}$/.test(item))) return null;
  return Object.freeze(unique);
}

function parseUtcInstant(value) {
  const raw = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(raw)) return null;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : null;
}

export function evaluateProductQueryProductionCanaryPreflight(envLike = {}) {
  const approvedSampleBps =
    parsePositiveSampleBps(envLike.BEJEWELY_PRODUCT_QUERY_PRODUCTION_APPROVED_SAMPLE_BPS);
  const approvedAccountHashes =
    parseApprovedAccountHashes(envLike.BEJEWELY_PRODUCT_QUERY_PRODUCTION_APPROVED_ACCOUNT_HASHES);
  const windowStartMs =
    parseUtcInstant(envLike.BEJEWELY_PRODUCT_QUERY_PRODUCTION_WINDOW_START_UTC);
  const windowEndMs =
    parseUtcInstant(envLike.BEJEWELY_PRODUCT_QUERY_PRODUCTION_WINDOW_END_UTC);
  const windowDurationMs =
    windowStartMs !== null && windowEndMs !== null ? windowEndMs - windowStartMs : null;
  const windowValid =
    windowDurationMs !== null &&
    windowDurationMs > 0 &&
    windowDurationMs <= PRODUCT_QUERY_PRODUCTION_CANARY_MAX_WINDOW_MINUTES * 60_000;
  const environmentMutationAuthorized =
    normalized(envLike.BEJEWELY_PRODUCT_QUERY_PRODUCTION_ENV_MUTATION_AUTHORIZED) === "true";
  const dataAi11Ready =
    PRODUCT_QUERY_PRODUCTION_ACTIVATION_SAFETY.readinessState ===
      "production_activation_safety_contract_ready" &&
    PRODUCT_QUERY_PRODUCTION_ACTIVATION_SAFETY.activationDecision === "not_authorized" &&
    PRODUCT_QUERY_PRODUCTION_ACTIVATION_SAFETY.effectiveSampleBps === 0;

  const blockers = [];
  if (!dataAi11Ready) blockers.push("data_ai11_safety_not_ready");
  if (approvedSampleBps === null) blockers.push("approved_initial_sample_bps_missing_or_invalid");
  if (approvedAccountHashes === null || approvedAccountHashes.length === 0) {
    blockers.push("approved_account_hashes_missing_or_invalid");
  }
  if (!windowValid) blockers.push("activation_window_missing_or_invalid");
  if (!environmentMutationAuthorized) blockers.push("production_environment_mutation_not_authorized");

  return Object.freeze({
    preflightVersion: PRODUCT_QUERY_PRODUCTION_CANARY_PREFLIGHT_VERSION,
    phase: "DATA-AI12",
    dataAi11Ready,
    approvedSampleBps: approvedSampleBps ?? 0,
    approvedAccountHashCount: approvedAccountHashes?.length ?? 0,
    rawAccountIdsAccepted: false,
    windowValid,
    environmentMutationAuthorized,
    preflightReady: blockers.length === 0,
    blockers: Object.freeze(blockers.sort((a, b) => a.localeCompare(b, "en"))),
    activationAllowed: false,
    effectiveSampleBps: 0,
    operationalState: blockers.length === 0
      ? "inputs_validated_activation_still_not_authorized"
      : "hold_operational_inputs_pending"
  });
}

export const PRODUCT_QUERY_PRODUCTION_CANARY_PREFLIGHT_LIMITS = Object.freeze({
  phase: "DATA-AI12",
  preflightOnly: true,
  effectiveSampleBps: 0,
  activationAllowed: false,
  minimumApprovedSampleBps: 1,
  maximumApprovedSampleBps: PRODUCT_QUERY_PRODUCTION_ACTIVATION_MAX_SAMPLE_BPS,
  maximumApprovedAccountHashes: PRODUCT_QUERY_PRODUCTION_CANARY_MAX_ACCOUNT_HASHES,
  accountHashFormat: "lowercase_sha256_hex",
  rawAccountIdsProhibited: true,
  maximumActivationWindowMinutes: PRODUCT_QUERY_PRODUCTION_CANARY_MAX_WINDOW_MINUTES,
  productionEnvironmentMutationRequiresExplicitAuthorization: true,
  routeWiring: false,
  productionEnvironmentMutation: false,
  publicSearchCutover: false,
  automaticTrafficSampling: false,
  persistence: "none",
  releaseGateImplemented: false
});
