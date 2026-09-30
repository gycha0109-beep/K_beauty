import {
  evaluateAuthorityCompleteMixedSubsetShadow,
} from "./sunscreen-authority-complete-subset-shadow.mjs";

export const SUNSCREEN_UVA_AUTHORITY_RECOVERY_REVIEW_VERSION =
  "data-ai29c-d4-uva-authority-recovery-review-v1";

function sorted(values) {
  return [...values].sort();
}

export function evaluateUvaAuthorityRecoveryReview({
  legacyProducts,
  authorityRows,
  semanticBundles,
  recoveryFixture,
  protectionRecords,
  uvaRecoveryReview,
}) {
  const d3r3 = evaluateAuthorityCompleteMixedSubsetShadow({
    legacyProducts,
    authorityRows,
    semanticBundles,
    recoveryFixture,
    protectionRecords,
  });

  const missingIds = sorted(d3r3.uvaCoverage.missingProductIds);
  const targetIds = sorted(
    (uvaRecoveryReview?.targets || []).map(
      (target) => target.productId,
    ),
  );

  const exactMissingTargets =
    JSON.stringify(missingIds) === JSON.stringify(targetIds);

  const allTargetsHeld = (uvaRecoveryReview?.targets || []).every(
    (target) =>
      target.currentUvaFact === false &&
      target.candidateValue == null &&
      typeof target.decision === "string" &&
      target.decision.startsWith("HOLD_"),
  );

  const noGovernedWrites =
    uvaRecoveryReview?.recovery?.confirmedFactsWritten === 0 &&
    uvaRecoveryReview?.recovery?.evidenceRecordsWritten === 0 &&
    uvaRecoveryReview?.recovery?.reviewAssignmentsWritten === 0;

  const uvaPfDeclaredUnused =
    Number(
      uvaRecoveryReview?.currentHistoricalUvaPfDeclaredInstanceCount,
    ) === 0;

  const noForbiddenConversion = (
    uvaRecoveryReview?.targets || []
  ).every(
    (target) =>
      Array.isArray(target.forbiddenConversions) &&
      target.forbiddenConversions.length > 0 &&
      target.candidateValue == null,
  );

  const gates = Object.freeze({
    mixedCorpusStillBounded:
      d3r3.mixedBaselineCount === 14 &&
      d3r3.newScoreableCount === 3,
    currentCoverageStillIncomplete:
      d3r3.uvaCoverage.complete === false &&
      d3r3.uvaCoverage.eligibleCount === 12 &&
      d3r3.uvaCoverage.totalCount === 14,
    exactMissingTargets,
    allTargetsHeld,
    noGovernedWrites,
    uvaPfDeclaredUnused,
    noForbiddenConversion,
    productionStillFrozen:
      d3r3.limits.productionCandidateAdmissionWired === false &&
      d3r3.limits.productionRankingChanged === false &&
      d3r3.limits.productionCutoverAuthorized === false &&
      d3r3.limits.outdoorRankableSignalAuthorized === false &&
      d3r3.limits.publicActivation === false &&
      d3r3.limits.waterResistanceApplied === false,
  });

  const holdRequired = Object.values(gates).every(Boolean);

  return Object.freeze({
    version: SUNSCREEN_UVA_AUTHORITY_RECOVERY_REVIEW_VERSION,
    comparableCorpusCount: d3r3.mixedBaselineCount,
    coverage: d3r3.uvaCoverage,
    missingProductIds: Object.freeze(missingIds),
    targets: Object.freeze(
      (uvaRecoveryReview?.targets || []).map((target) =>
        Object.freeze({
          productId: target.productId,
          productName: target.productName,
          subjectId: target.subjectId,
          market: target.market,
          variantKey: target.variantKey,
          decision: target.decision,
          candidateValue: target.candidateValue,
          forbiddenConversions: Object.freeze([
            ...(target.forbiddenConversions || []),
          ]),
        }),
      ),
    ),
    gates,
    holdRequired,
    decision: holdRequired
      ? "UVA_AXIS_D4_HOLD_EXACT_SUBJECT_AUTHORITY_INCOMPLETE"
      : "UVA_AXIS_D4_RECOVERY_REVIEW_INVALID",
    nextGate: Object.freeze({
      acceptablePaths: Object.freeze([
        ...(uvaRecoveryReview?.nextGate?.acceptablePaths || []),
      ]),
      forbiddenPaths: Object.freeze([
        ...(uvaRecoveryReview?.nextGate?.forbiddenPaths || []),
      ]),
    }),
    limits: Object.freeze({
      productFactWritten: false,
      registryChanged: false,
      productionCandidateAdmissionWired: false,
      productionRankingChanged: false,
      productionCutoverAuthorized: false,
      outdoorRankableSignalAuthorized: false,
      publicActivation: false,
      uvaActivated: false,
      waterResistanceApplied: false,
      persistence: false,
    }),
  });
}
