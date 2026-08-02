import {
  REGRESSION_BASELINE_REQUEST_SCHEMA_VERSION,
  REGRESSION_BASELINE_REVIEW_SCHEMA_VERSION,
  REGRESSION_BASELINE_SCHEMA_VERSION,
  validateRegressionBaselineRequestShape,
  validateRegressionBaselineReviewShape,
  validateRegressionBaselineShape
} from "@bejewely/face-contracts";
import { readJson, writeExclusiveJson, writeSemanticAddressedJson } from "../judgment/artifact-store.js";
import { deepFreeze, sha256Hex, stableStringify } from "../shared/canonical-json.js";
import { REGRESSION_BASELINE_POLICY_RECORD } from "./policy.js";
import { verifyCurrentDataset } from "./orchestrator.js";
import { datasetStorageLayout, nativeDatasetPath } from "./storage-layout.js";

function failure(code, path, detail = null) { return Object.freeze({ ok: false, errors: Object.freeze([{ code, path, detail }]) }); }
function without(value, ...keys) { const clone = { ...value }; for (const key of keys) delete clone[key]; return clone; }

export function finalizeRegressionBaselineRequest(draft) {
  const semantic = {
    schemaVersion: REGRESSION_BASELINE_REQUEST_SCHEMA_VERSION,
    datasetVersionDigest: draft?.datasetVersionDigest,
    holdoutG5IndexDigest: draft?.holdoutG5IndexDigest,
    modelArtifactDigest: draft?.modelArtifactDigest,
    evaluationHarnessDigest: draft?.evaluationHarnessDigest,
    metricContractDigest: draft?.metricContractDigest,
    resultPackageDigest: draft?.resultPackageDigest
  };
  const request = deepFreeze({ ...semantic, requestedAt: draft?.requestedAt, requestDigest: sha256Hex(stableStringify(semantic)) });
  if (!validateRegressionBaselineRequestShape(without(request, "requestDigest")).ok) return failure("regression_baseline_request_invalid", "request");
  return Object.freeze({ ok: true, request });
}

export function finalizeRegressionBaselineReview({ request, draft }) {
  if (!request?.requestDigest || request.requestDigest !== sha256Hex(stableStringify(without(request, "requestedAt", "requestDigest")))) return failure("regression_baseline_request_invalid", "request");
  const semantic = {
    schemaVersion: REGRESSION_BASELINE_REVIEW_SCHEMA_VERSION,
    requestDigest: request.requestDigest,
    reviewerId: draft?.reviewerId,
    datasetAndG5CurrentReviewed: draft?.datasetAndG5CurrentReviewed,
    resultPackageIntegrityReviewed: draft?.resultPackageIntegrityReviewed,
    metricContractReviewed: draft?.metricContractReviewed,
    decision: draft?.decision
  };
  const review = deepFreeze({ ...semantic, completedAt: draft?.completedAt, reviewDigest: sha256Hex(stableStringify(semantic)) });
  return verifyRegressionBaselineReviewIntegrity(review) ? Object.freeze({ ok: true, review }) : failure("regression_baseline_review_invalid", "review");
}

export function verifyRegressionBaselineReviewIntegrity(review) {
  return validateRegressionBaselineReviewShape(review).ok && review.reviewDigest === sha256Hex(stableStringify(without(review, "completedAt", "reviewDigest")));
}

export function verifyRegressionBaselineIntegrity(baseline) {
  return validateRegressionBaselineShape(baseline).ok && baseline.policyDigest === REGRESSION_BASELINE_POLICY_RECORD.digest && baseline.baselineDigest === sha256Hex(stableStringify(without(baseline, "activatedAt", "baselineDigest")));
}

export async function preflightRegressionBaseline({ dataRoot, datasetLineageId, datasetVersionId, requestDraft }) {
  const finalized = finalizeRegressionBaselineRequest(requestDraft);
  if (!finalized.ok) return finalized;
  const current = await verifyCurrentDataset({ dataRoot, datasetLineageId, datasetVersionId });
  if (!current.ok || current.version.datasetVersionDigest !== finalized.request.datasetVersionDigest) return failure("regression_baseline_dataset_inactive", "dataset");
  const holdoutIndexDigest = sha256Hex(stableStringify(current.g5Records.map((record) => record.gradeRecordDigest).sort()));
  if (holdoutIndexDigest !== finalized.request.holdoutG5IndexDigest || current.g5Records.length === 0) return failure("regression_baseline_g5_mismatch", "holdoutG5IndexDigest");
  return Object.freeze({ ok: true, request: finalized.request, current, writesPerformed: 0 });
}

export async function activateRegressionBaseline({ dataRoot, datasetLineageId, datasetVersionId, requestDraft, reviewDraft, activatedAt = new Date().toISOString() }) {
  const prepared = await preflightRegressionBaseline({ dataRoot, datasetLineageId, datasetVersionId, requestDraft });
  if (!prepared.ok) return prepared;
  const reviewed = finalizeRegressionBaselineReview({ request: prepared.request, draft: reviewDraft });
  if (!reviewed.ok || reviewed.review.decision !== "approve") return failure("regression_baseline_rejected", "review");
  const semantic = {
    schemaVersion: REGRESSION_BASELINE_SCHEMA_VERSION,
    datasetVersionDigest: prepared.request.datasetVersionDigest,
    holdoutG5IndexDigest: prepared.request.holdoutG5IndexDigest,
    modelArtifactDigest: prepared.request.modelArtifactDigest,
    evaluationHarnessDigest: prepared.request.evaluationHarnessDigest,
    metricContractDigest: prepared.request.metricContractDigest,
    resultPackageDigest: prepared.request.resultPackageDigest,
    activatedByReviewDigest: reviewed.review.reviewDigest,
    policyDigest: REGRESSION_BASELINE_POLICY_RECORD.digest
  };
  const baseline = deepFreeze({ ...semantic, activatedAt, baselineDigest: sha256Hex(stableStringify(semantic)) });
  if (!verifyRegressionBaselineIntegrity(baseline)) return failure("regression_baseline_invalid", "baseline");
  const claimValue = { schemaVersion: "regression-baseline-activation-claim-v1", datasetVersionDigest: baseline.datasetVersionDigest, modelArtifactDigest: baseline.modelArtifactDigest, baselineDigest: baseline.baselineDigest };
  const claimPath = nativeDatasetPath(dataRoot, datasetStorageLayout.baselineActivationClaim(baseline.datasetVersionDigest, baseline.modelArtifactDigest));
  try { await writeExclusiveJson(claimPath, claimValue); }
  catch (error) {
    if (error?.code !== "EEXIST") throw error;
    const existing = await readJson(claimPath);
    if (stableStringify(existing) !== stableStringify(claimValue)) return failure("regression_baseline_conflict", "activationClaim");
  }
  const requestStored = await writeSemanticAddressedJson(nativeDatasetPath(dataRoot, datasetStorageLayout.baselineRequest(prepared.request.requestDigest)), prepared.request, (existing, proposed) => existing.requestDigest === proposed.requestDigest);
  const reviewStored = await writeSemanticAddressedJson(nativeDatasetPath(dataRoot, datasetStorageLayout.baselineReview(reviewed.review.reviewDigest)), reviewed.review, (existing, proposed) => verifyRegressionBaselineReviewIntegrity(existing) && existing.reviewDigest === proposed.reviewDigest);
  const baselineStored = await writeSemanticAddressedJson(nativeDatasetPath(dataRoot, datasetStorageLayout.baseline(baseline.baselineDigest)), baseline, (existing, proposed) => verifyRegressionBaselineIntegrity(existing) && existing.baselineDigest === proposed.baselineDigest);
  return Object.freeze({ ok: true, state: baselineStored.created ? "registered" : "existing", baseline: baselineStored.value, writesPerformed: Number(requestStored.created) + Number(reviewStored.created) + Number(baselineStored.created) });
}
