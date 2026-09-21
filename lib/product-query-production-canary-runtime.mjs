import { createHash } from "node:crypto";

import {
  evaluateProductQueryProductionActivationPolicy
} from "./product-query-production-activation-policy.mjs";
import {
  evaluateProductQueryProductionCanaryPreflight,
  parseApprovedProductQueryCanaryAccountHashes
} from "./product-query-production-canary-preflight.mjs";

export const PRODUCT_QUERY_PRODUCTION_CANARY_RUNTIME_POLICY_VERSION =
  "product-query-production-canary-runtime-policy-v1";

function normalized(value) {
  return String(value ?? "").trim().toLowerCase();
}

function parseUtcInstant(value) {
  const raw = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(raw)) return null;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : null;
}

export function hashProductQueryCanarySubject(subject) {
  const value = String(subject ?? "").trim();
  if (!value) return null;
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function evaluateProductQueryProductionCanaryStaticGate(
  envLike = {},
  nowMs = Date.now()
) {
  const activationPolicy = evaluateProductQueryProductionActivationPolicy(envLike);
  const preflight = evaluateProductQueryProductionCanaryPreflight(envLike);
  const runtimeAuthorized =
    normalized(envLike.BEJEWELY_PRODUCT_QUERY_PRODUCTION_RUNTIME_AUTHORIZED) === "true";
  const windowStartMs =
    parseUtcInstant(envLike.BEJEWELY_PRODUCT_QUERY_PRODUCTION_WINDOW_START_UTC);
  const windowEndMs =
    parseUtcInstant(envLike.BEJEWELY_PRODUCT_QUERY_PRODUCTION_WINDOW_END_UTC);
  const insideWindow =
    Number.isFinite(nowMs) &&
    windowStartMs !== null &&
    windowEndMs !== null &&
    nowMs >= windowStartMs &&
    nowMs < windowEndMs;

  const sampleApprovalMatchesConfiguration =
    activationPolicy.configuredSampleBps === preflight.approvedSampleBps &&
    preflight.approvedSampleBps > 0;
  const staticAllowed =
    activationPolicy.configurationEligible === true &&
    preflight.preflightReady === true &&
    sampleApprovalMatchesConfiguration &&
    runtimeAuthorized &&
    insideWindow;

  return Object.freeze({
    policyVersion: PRODUCT_QUERY_PRODUCTION_CANARY_RUNTIME_POLICY_VERSION,
    staticAllowed,
    runtimeAuthorized,
    insideWindow,
    configurationEligible: activationPolicy.configurationEligible,
    preflightReady: preflight.preflightReady,
    sampleApprovalMatchesConfiguration,
    approvedSampleBps: preflight.approvedSampleBps,
    effectiveSampleBps: staticAllowed ? preflight.approvedSampleBps : 0,
    expiresAtUtc: windowEndMs === null ? null : new Date(windowEndMs).toISOString(),
    manualOnly: true,
    automaticTrafficSampling: false
  });
}

export function evaluateProductQueryProductionCanaryRuntime(
  { envLike = {}, subject = null, nowMs = Date.now() } = {}
) {
  const staticGate = evaluateProductQueryProductionCanaryStaticGate(envLike, nowMs);
  const subjectHash = hashProductQueryCanarySubject(subject);
  const approvedHashes =
    parseApprovedProductQueryCanaryAccountHashes(
      envLike.BEJEWELY_PRODUCT_QUERY_PRODUCTION_APPROVED_ACCOUNT_HASHES
    );
  const approvedSubject =
    Boolean(subjectHash) &&
    Array.isArray(approvedHashes) &&
    approvedHashes.includes(subjectHash);
  const allowed = staticGate.staticAllowed && approvedSubject;

  return Object.freeze({
    policyVersion: PRODUCT_QUERY_PRODUCTION_CANARY_RUNTIME_POLICY_VERSION,
    allowed,
    approvedSubject,
    effectiveSampleBps: allowed ? staticGate.approvedSampleBps : 0,
    expiresAtUtc: staticGate.expiresAtUtc,
    manualOnly: true,
    automaticTrafficSampling: false,
    publicSearchCutover: false,
    persisted: false
  });
}

export const PRODUCT_QUERY_PRODUCTION_CANARY_RUNTIME_LIMITS = Object.freeze({
  phase: "DATA-AI13",
  authenticatedOnly: true,
  manualOnly: true,
  automaticTrafficSampling: false,
  publicSearchCutover: false,
  persistence: "none",
  rawAccountIdPersistence: false,
  accountHashPersistence: false,
  rawQueryPersistence: false,
  accessTokenPersistence: false,
  savedProfileRead: false,
  historyRead: false,
  productionWrite: false,
  recommendationLogWrite: false,
  directProductFactRead: false,
  taxonomyRuntimeAuthority: false,
  providerProductSelection: false,
  providerRankingAuthority: false,
  deterministicRankingAuthorityPreserved: true,
  fallbackMode: "existing_path",
  releaseGateImplemented: false
});
