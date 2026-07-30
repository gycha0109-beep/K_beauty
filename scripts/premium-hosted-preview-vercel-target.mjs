function scalar(value) {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function normalizeRawTarget(value) {
  if (value == null) return null;
  const normalized = String(value).trim().toLowerCase();
  return normalized || null;
}

export function deriveVercelAttestationTarget(vercel, expected = {}) {
  const rawTarget = normalizeRawTarget(vercel?.target);
  const sourcePrNumber = scalar(vercel?.gitSource?.prId ?? vercel?.meta?.githubPrId);
  const sourceRef = scalar(vercel?.gitSource?.ref ?? vercel?.meta?.githubCommitRef);
  const sourceCommitSha = scalar(vercel?.gitSource?.sha ?? vercel?.meta?.githubCommitSha);
  const expectedPrNumber = scalar(expected.prNumber);
  const expectedHeadRef = scalar(expected.headRef);
  const expectedHeadSha = scalar(expected.headSha);
  const prBound = Boolean(
    expectedPrNumber &&
    expectedHeadRef &&
    expectedHeadSha &&
    sourcePrNumber === expectedPrNumber &&
    sourceRef === expectedHeadRef &&
    sourceCommitSha === expectedHeadSha
  );

  let vercelTarget = rawTarget;
  let vercelTargetEvidence = "api-target-unverified";

  if (rawTarget === "production") {
    vercelTargetEvidence = "api-explicit-production";
  } else if (rawTarget === "preview" && prBound) {
    vercelTarget = "preview";
    vercelTargetEvidence = "api-explicit-preview-pr-bound";
  } else if (rawTarget === null && prBound) {
    vercelTarget = "preview";
    vercelTargetEvidence = "api-null-pr-bound-preview";
  }

  return {
    vercelRawTarget: rawTarget,
    vercelTarget,
    vercelTargetEvidence,
    vercelSourcePrNumber: sourcePrNumber,
    vercelSourceRef: sourceRef,
    vercelSourceCommitSha: sourceCommitSha,
    vercelPrBound: prBound
  };
}

export function assertVercelPreviewIdentity(vercel, expected = {}) {
  const identity = deriveVercelAttestationTarget(vercel, expected);
  if (!identity.vercelPrBound) throw new Error("vercel_preview_pr_binding_invalid");
  if (identity.vercelTarget !== "preview") throw new Error("vercel_preview_target_invalid");
  if (!new Set(["api-explicit-preview-pr-bound", "api-null-pr-bound-preview"]).has(identity.vercelTargetEvidence)) {
    throw new Error("vercel_preview_target_evidence_invalid");
  }
  return identity;
}
