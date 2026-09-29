import { createHash } from "node:crypto";
import { buildFaceLabV2Canonical } from "../canonical-composer.js";
import { buildFaceLabV2ResultPresentation } from "../result-presentation.js";
import { buildFaceLabRouteChoiceEvidence } from "../route-choice-evidence.js";
import { normalizeFaceLabV2PersistencePayload } from "../survey-contract.js";
import { buildFaceLabV2TargetSweepCohort } from "./target-responsiveness.js";

export const FACE_LAB_V2_END_TO_END_COMPLETION_AUDIT_VERSION =
  "face-lab-v2-end-to-end-completion-audit-v1";

const PRIORITY_MODES = Object.freeze([
  "face_harmony",
  "target_forward"
]);

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])])
    );
  }
  return value;
}

function fingerprint(value) {
  return createHash("sha256")
    .update(JSON.stringify(stableValue(value)))
    .digest("hex")
    .slice(0, 16);
}

function addFailure(failures, payload) {
  const failure = {
    severity: "hard",
    ...payload
  };
  failures.push({
    ...failure,
    fingerprint: fingerprint(failure)
  });
}

function surveyForMode(caseDef, recommendationPriority) {
  return {
    ...structuredClone(caseDef.surveyAnswers),
    recommendationPriority
  };
}

function assertInvariant(failures, {
  caseId,
  mode,
  routeId = null,
  evaluatorId,
  expected,
  observed,
  condition
}) {
  if (condition) return;
  addFailure(failures, {
    caseId,
    mode,
    routeId,
    evaluatorId,
    expected,
    observed
  });
}

export function runFaceLabV2EndToEndCompletionAudit() {
  const cohort = buildFaceLabV2TargetSweepCohort();
  const failures = [];
  const rows = [];
  let previewCaseCount = 0;
  let explicitRouteChoiceCaseCount = 0;
  let routeChoiceEvidenceCount = 0;
  let roundTripCaseCount = 0;
  let previewExecutionLeakCount = 0;
  let previewLookLeakCount = 0;
  let previewProductLeakCount = 0;
  let selectionMismatchCount = 0;
  let executionMismatchCount = 0;
  let evidenceMismatchCount = 0;
  let roundTripMismatchCount = 0;

  for (const caseDef of cohort.cases) {
    for (const mode of PRIORITY_MODES) {
      const surveyAnswers = surveyForMode(caseDef, mode);
      const preview = buildFaceLabV2Canonical({
        analysis: caseDef.analysis,
        surveyAnswers,
        selectedRouteId: null,
        locale: "ko",
        resultId: `${caseDef.caseId}-${mode}-preview`
      });
      const previewView = buildFaceLabV2ResultPresentation(
        preview,
        { locale: "ko" }
      );
      const routes = preview?.routes?.routes || [];
      const multiRoute = routes.length >= 2;
      const expectedPreviewState = multiRoute
        ? "default_preview"
        : routes.length === 1
          ? "single_route_auto"
          : "no_route";

      previewCaseCount += 1;

      assertInvariant(failures, {
        caseId: caseDef.caseId,
        mode,
        evaluatorId: "E2E-preview-selection-state",
        expected: expectedPreviewState,
        observed: preview?.routes?.selectionState || null,
        condition: preview?.routes?.selectionState === expectedPreviewState
      });

      if (multiRoute) {
        const executionLeak = previewView.execution?.domains?.length || 0;
        const lookLeak = previewView.look ? 1 : 0;
        const productLeak = previewView.productGuides?.length || 0;

        previewExecutionLeakCount += executionLeak ? 1 : 0;
        previewLookLeakCount += lookLeak;
        previewProductLeakCount += productLeak ? 1 : 0;

        assertInvariant(failures, {
          caseId: caseDef.caseId,
          mode,
          evaluatorId: "E2E-preview-presentation-authority",
          expected: {
            selectionCommitted: false,
            selectedRouteId: null,
            executionDomains: 0,
            look: null,
            productGuides: 0,
            comparison: "available"
          },
          observed: {
            selectionCommitted: previewView.routes?.selectionCommitted,
            selectedRouteId: previewView.routes?.selectedRouteId,
            executionDomains: executionLeak,
            look: Boolean(previewView.look),
            productGuides: productLeak,
            comparison: previewView.routes?.comparison ? "available" : null
          },
          condition:
            previewView.routes?.selectionCommitted === false &&
            previewView.routes?.selectedRouteId === null &&
            executionLeak === 0 &&
            !previewView.look &&
            productLeak === 0 &&
            Boolean(previewView.routes?.comparison)
        });

        assertInvariant(failures, {
          caseId: caseDef.caseId,
          mode,
          evaluatorId: "E2E-preview-preference-evidence",
          expected: null,
          observed: buildFaceLabRouteChoiceEvidence(preview),
          condition: buildFaceLabRouteChoiceEvidence(preview) === null
        });
      }

      const choiceRows = [];

      for (const route of routes) {
        const selected = buildFaceLabV2Canonical({
          analysis: caseDef.analysis,
          surveyAnswers,
          selectedRouteId: route.routeId,
          locale: "ko",
          resultId: `${caseDef.caseId}-${mode}-${route.routeId}`
        });
        const selectedView = buildFaceLabV2ResultPresentation(
          selected,
          { locale: "ko" }
        );
        const evidence = buildFaceLabRouteChoiceEvidence(
          selected,
          { capturedAt: "2026-09-29T02:20:00.000Z" }
        );

        explicitRouteChoiceCaseCount += 1;
        if (evidence) routeChoiceEvidenceCount += 1;

        const selectedCardCount = (
          selectedView.routes?.cards || []
        ).filter((item) => item.selected).length;
        const selectionMatches =
          selected?.routes?.selectionState === "user_selected" &&
          selected?.routes?.selectedRouteId === route.routeId &&
          selectedView.routes?.selectionCommitted === true &&
          selectedView.routes?.selectedRouteId === route.routeId &&
          selectedCardCount === 1;

        if (!selectionMatches) selectionMismatchCount += 1;

        assertInvariant(failures, {
          caseId: caseDef.caseId,
          mode,
          routeId: route.routeId,
          evaluatorId: "E2E-explicit-route-authority",
          expected: {
            selectionState: "user_selected",
            selectedRouteId: route.routeId,
            presentationSelected: 1
          },
          observed: {
            selectionState: selected?.routes?.selectionState || null,
            canonicalRouteId: selected?.routes?.selectedRouteId || null,
            presentationRouteId: selectedView.routes?.selectedRouteId || null,
            selectedCardCount
          },
          condition: selectionMatches
        });

        const executionMatches =
          selectedView.execution?.routeId === route.routeId &&
          (selectedView.execution?.domains?.length || 0) > 0 &&
          selectedView.look !== null;

        if (!executionMatches) executionMismatchCount += 1;

        assertInvariant(failures, {
          caseId: caseDef.caseId,
          mode,
          routeId: route.routeId,
          evaluatorId: "E2E-route-execution-lineage",
          expected: {
            executionRouteId: route.routeId,
            executionDomains: ">0",
            look: "available"
          },
          observed: {
            executionRouteId: selectedView.execution?.routeId || null,
            executionDomains: selectedView.execution?.domains?.length || 0,
            look: Boolean(selectedView.look)
          },
          condition: executionMatches
        });

        const evidenceMatches =
          evidence?.selectionState === "user_selected" &&
          evidence?.preferenceEligible === true &&
          evidence?.routeId === route.routeId &&
          evidence?.recommendationPriority === mode &&
          evidence?.routeGeneratorVersion ===
            selected?.lineage?.routeGeneratorVersion;

        if (!evidenceMatches) evidenceMismatchCount += 1;

        assertInvariant(failures, {
          caseId: caseDef.caseId,
          mode,
          routeId: route.routeId,
          evaluatorId: "E2E-route-choice-evidence-lineage",
          expected: {
            selectionState: "user_selected",
            preferenceEligible: true,
            routeId: route.routeId,
            recommendationPriority: mode,
            routeGeneratorVersion: selected?.lineage?.routeGeneratorVersion
          },
          observed: evidence,
          condition: evidenceMatches
        });

        const normalizedPersisted = normalizeFaceLabV2PersistencePayload({
          surveyAnswers,
          targetFinderResult: null,
          selectedRouteId: route.routeId
        });
        const rehydrated = buildFaceLabV2Canonical({
          analysis: caseDef.analysis,
          surveyAnswers: normalizedPersisted.surveyAnswers,
          targetFinderResult: normalizedPersisted.targetFinderResult,
          selectedRouteId: normalizedPersisted.selectedRouteId,
          locale: "ko",
          resultId: `${caseDef.caseId}-${mode}-roundtrip`
        });
        const rehydratedEvidence = buildFaceLabRouteChoiceEvidence(
          rehydrated,
          { capturedAt: "2026-09-29T02:20:00.000Z" }
        );

        roundTripCaseCount += 1;

        const roundTripMatches =
          rehydrated?.routes?.selectionState === "user_selected" &&
          rehydrated?.routes?.selectedRouteId === route.routeId &&
          rehydrated?.targetStyle?.recommendationPriority === mode &&
          rehydratedEvidence?.routeId === route.routeId &&
          rehydratedEvidence?.preferenceEligible === true;

        if (!roundTripMatches) roundTripMismatchCount += 1;

        assertInvariant(failures, {
          caseId: caseDef.caseId,
          mode,
          routeId: route.routeId,
          evaluatorId: "E2E-persistence-roundtrip",
          expected: {
            routeId: route.routeId,
            recommendationPriority: mode,
            preferenceEligible: true
          },
          observed: {
            selectionState: rehydrated?.routes?.selectionState || null,
            routeId: rehydrated?.routes?.selectedRouteId || null,
            recommendationPriority:
              rehydrated?.targetStyle?.recommendationPriority || null,
            evidenceRouteId: rehydratedEvidence?.routeId || null,
            preferenceEligible:
              rehydratedEvidence?.preferenceEligible ?? null
          },
          condition: roundTripMatches
        });

        choiceRows.push({
          routeId: route.routeId,
          strategy: route.strategy,
          executionDomainCount:
            selectedView.execution?.domains?.length || 0,
          preferenceEligible:
            evidence?.preferenceEligible === true,
          roundTripMatches
        });
      }

      rows.push({
        caseId: caseDef.caseId,
        faceGroupId: caseDef.faceGroupId,
        targetKey: caseDef.targetKey,
        recommendationPriority: mode,
        previewSelectionState: preview?.routes?.selectionState || null,
        routeCount: routes.length,
        comparisonAvailable: Boolean(previewView.routes?.comparison),
        choices: choiceRows
      });
    }
  }

  return {
    reportVersion: "face-lab-v2-end-to-end-completion-audit-report-v1",
    evaluatorVersion: FACE_LAB_V2_END_TO_END_COMPLETION_AUDIT_VERSION,
    cohort: {
      version: cohort.cohortVersion,
      hash: cohort.cohortHash,
      faceCount: cohort.faceCount,
      targetCount: cohort.targetCount,
      baseCaseCount: cohort.caseCount,
      recommendationPriorityModes: [...PRIORITY_MODES]
    },
    summary: {
      previewCaseCount,
      explicitRouteChoiceCaseCount,
      routeChoiceEvidenceCount,
      roundTripCaseCount,
      previewExecutionLeakCount,
      previewLookLeakCount,
      previewProductLeakCount,
      selectionMismatchCount,
      executionMismatchCount,
      evidenceMismatchCount,
      roundTripMismatchCount,
      hardFailureCount: failures.length
    },
    rows,
    failures
  };
}
