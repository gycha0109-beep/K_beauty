import {
  PROVIDER_COMPARISON_KEY_SCHEMA_VERSION,
  validateProviderComparisonKey
} from "@bejewely/face-contracts";
import { deepFreeze, sha256Hex, stableStringify } from "../shared/canonical-json.js";

function failure(code, path, detail = null) {
  return Object.freeze({ ok: false, errors: Object.freeze([{ code, path, detail }]) });
}

function withoutProvider(sourceFreeze) {
  const {
    providerProfileId,
    providerProfileVersion,
    providerProfileDigest,
    providerTemplateVersion,
    sourceFreezeDigest,
    ...rest
  } = sourceFreeze;
  return rest;
}

function campaignPolicy(plan) {
  return {
    objective: plan.objective,
    matrix: plan.matrix,
    budgets: plan.budgets,
    retryPolicy: plan.retryPolicy,
    checkpointPolicy: plan.checkpointPolicy,
    stopPolicy: plan.stopPolicy,
    outputPolicy: plan.outputPolicy
  };
}

export function buildProviderComparisonKey(leftSource, rightSource) {
  const left = leftSource.plan;
  const right = rightSource.plan;
  if (!left || !right || left.comparisonGroupId === null || left.comparisonGroupId !== right.comparisonGroupId) return failure("provider_comparison_invalid", "comparisonGroupId");
  if (left.sourceFreeze.providerProfileId === right.sourceFreeze.providerProfileId && left.sourceFreeze.providerProfileDigest === right.sourceFreeze.providerProfileDigest) return failure("provider_comparison_invalid", "provider", "provider_not_varied");
  const objectiveDigest = sha256Hex(stableStringify(left.objective));
  const matrixDigest = sha256Hex(stableStringify(left.matrix));
  const nonProviderSourceFreezeDigest = sha256Hex(stableStringify(withoutProvider(left.sourceFreeze)));
  const campaignPolicyDigest = sha256Hex(stableStringify(campaignPolicy(left)));
  if (
    objectiveDigest !== sha256Hex(stableStringify(right.objective)) ||
    matrixDigest !== sha256Hex(stableStringify(right.matrix)) ||
    nonProviderSourceFreezeDigest !== sha256Hex(stableStringify(withoutProvider(right.sourceFreeze))) ||
    campaignPolicyDigest !== sha256Hex(stableStringify(campaignPolicy(right)))
  ) return failure("provider_comparison_invalid", "source", "non_provider_drift");
  const semantic = {
    schemaVersion: PROVIDER_COMPARISON_KEY_SCHEMA_VERSION,
    comparisonGroupId: left.comparisonGroupId,
    objectiveDigest,
    matrixDigest,
    nonProviderSourceFreezeDigest,
    campaignPolicyDigest
  };
  const comparisonKeyDigest = sha256Hex(stableStringify(semantic));
  const comparisonKey = deepFreeze({ ...semantic, comparisonKeyDigest });
  return validateProviderComparisonKey(comparisonKey).ok
    ? Object.freeze({ ok: true, comparisonKey })
    : failure("provider_comparison_invalid", "$", "contract");
}

export function verifyProviderComparisonKey(value) {
  if (!validateProviderComparisonKey(value).ok) return false;
  const { comparisonKeyDigest, ...semantic } = value;
  return comparisonKeyDigest === sha256Hex(stableStringify(semantic));
}
