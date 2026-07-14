import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { buildBaselineResponseShapeSnapshot } from "../../lib/shadow-dry-run-snapshot-contract.js";
import {
  validateLocalActualRuntimeEvidence,
  validateLocalShadowPolicyEvidence,
  validateLocalShadowRecommendationEvidence
} from "../../lib/shadow-boundary-dry-run-artifact-writer.js";

const ROUTE_RUNS_SUBDIRECTORY = ["tmp", "isolated-shadow-route-runs"];
const EXPECTED_AUDIT_SURFACES = new Set([
  "analysis_guard_rate_limit_rpc",
  "analysis_guard_idempotency_rpc",
  "premium_report_session_table",
  "anonymous_write_grant_table"
]);

function isWithinDirectory(candidate, directory) {
  const relative = path.relative(directory, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function sameOrderedValues(left = [], right = []) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function subtractCounts(before = {}, after = {}) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return Object.fromEntries([...keys].sort().map((key) => [key, Number(after[key] || 0) - Number(before[key] || 0)]));
}

function subtractAuditEvents(before = [], after = []) {
  const values = new Map();
  for (const event of before) values.set(`${event.surfaceId}|${event.operation}`, -Number(event.count || 0));
  for (const event of after) {
    const key = `${event.surfaceId}|${event.operation}`;
    values.set(key, Number(values.get(key) || 0) + Number(event.count || 0));
  }
  return [...values.entries()]
    .filter(([, count]) => count !== 0)
    .map(([key, count]) => {
      const [surfaceId, operation] = key.split("|");
      return { surfaceId, operation, count };
    });
}

function classifyCounts(flagOffCount, flagOnCount, sharedAllowed) {
  if (flagOffCount === 0 && flagOnCount === 0) return "no_mutation";
  return sharedAllowed && flagOffCount === flagOnCount ? "expected_shared_mutation" : "unexpected_mutation";
}

function classifyAuditEvents(flagOffEvents, flagOnEvents) {
  const byKey = (events) => new Map(events.map((event) => [`${event.surfaceId}|${event.operation}`, Number(event.count || 0)]));
  const flagOff = byKey(flagOffEvents);
  const flagOn = byKey(flagOnEvents);
  return [...new Set([...flagOff.keys(), ...flagOn.keys()])].sort().map((key) => {
    const [surfaceId, operation] = key.split("|");
    const flagOffCount = flagOff.get(key) || 0;
    const flagOnCount = flagOn.get(key) || 0;
    return {
      surfaceId,
      operation,
      flagOffCount,
      flagOnCount,
      classification: classifyCounts(flagOffCount, flagOnCount, EXPECTED_AUDIT_SURFACES.has(surfaceId))
    };
  });
}

function classifyTableMutations(flagOff = {}, flagOn = {}) {
  return [...new Set([...Object.keys(flagOff), ...Object.keys(flagOn)])].sort().map((surfaceId) => {
    const flagOffCount = Number(flagOff[surfaceId] || 0);
    const flagOnCount = Number(flagOn[surfaceId] || 0);
    return {
      surfaceId,
      flagOffCount,
      flagOnCount,
      classification: classifyCounts(flagOffCount, flagOnCount, true)
    };
  });
}

function responseContractsMatch(left, right) {
  return Boolean(
    left &&
    right &&
    left.responseShapeHash === right.responseShapeHash &&
    sameOrderedValues(left.topLevelKeys, right.topLevelKeys) &&
    left.valueDumped === false &&
    right.valueDumped === false
  );
}

function comparisonDirectory({ root, runDirectory, comparisonRunId }) {
  const runsRoot = path.resolve(root, ...ROUTE_RUNS_SUBDIRECTORY);
  const resolvedRunDirectory = path.resolve(runDirectory || "");
  if (
    !isWithinDirectory(resolvedRunDirectory, runsRoot) ||
    !existsSync(path.join(resolvedRunDirectory, ".phase43-isolated-run"))
  ) {
    return null;
  }
  return path.join(resolvedRunDirectory, "route-comparison", comparisonRunId);
}

export function buildRouteResponseContract(payload) {
  return buildBaselineResponseShapeSnapshot(payload);
}

export function collectLocalMutationSnapshot(query) {
  const sql = `
    select json_build_object(
      'databaseCounts', json_build_object(
        'analysisRequestRateWindows', (select count(*) from public.analysis_request_rate_windows),
        'analysisRequestIdempotency', (select count(*) from public.analysis_request_idempotency),
        'premiumReportSessions', (select count(*) from public.premium_report_sessions),
        'anonymousWriteGrants', (select count(*) from public.anonymous_write_grants)
      ),
      'storageObjectCount', (select count(*) from storage.objects),
      'auditEvents', coalesce((
        select json_agg(event_row order by event_row->>'surfaceId', event_row->>'operation')
        from (
          select json_build_object('surfaceId', surface_id, 'operation', operation, 'count', sum(event_count)) as event_row
          from shadow_audit.mutation_events
          group by surface_id, operation
        ) grouped
      ), '[]'::json)
    )::text;
  `;
  const result = query(sql);
  if (result.status !== 0) return { ok: false, reasonCode: "local_snapshot_query_failed" };
  try {
    const value = JSON.parse(String(result.stdout || "").trim());
    return {
      ok: true,
      value: {
        databaseCounts: value.databaseCounts || {},
        storageObjectCount: Number(value.storageObjectCount || 0),
        auditEvents: Array.isArray(value.auditEvents) ? value.auditEvents : []
      }
    };
  } catch {
    return { ok: false, reasonCode: "local_snapshot_query_failed_parse_failed" };
  }
}

export async function readComparisonRecommendationEvidence({ root, runDirectory, comparisonRunId, condition }) {
  const directory = comparisonDirectory({ root, runDirectory, comparisonRunId });
  const expectedNames = condition === "off"
    ? ["recommendation-flag-off.json"]
    : ["recommendation-flag-off.json", "recommendation-flag-on.json"];
  const expectedDirectories = condition === "on" ? ["policy", "runtime"] : ["runtime"];
  const expectedName = `recommendation-flag-${condition}.json`;
  if (!directory || !existsSync(directory)) {
    return { ok: false, reasonCode: "recommendation_evidence_directory_missing" };
  }

  const entries = await readdir(directory, { withFileTypes: true });
  const names = entries.filter((entry) => entry.isFile()).map((entry) => entry.name).sort();
  const directories = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  if (
    entries.some((entry) => !entry.isFile() && !entry.isDirectory()) ||
    !sameOrderedValues(names, expectedNames) ||
    !sameOrderedValues(directories, expectedDirectories) ||
    !isWithinDirectory(path.join(directory, "runtime"), directory) ||
    (condition === "on" && !isWithinDirectory(path.join(directory, "policy"), directory))
  ) {
    return { ok: false, reasonCode: "recommendation_evidence_residual_or_unexpected_file" };
  }

  try {
    const evidence = JSON.parse(await readFile(path.join(directory, expectedName), "utf8"));
    const validation = validateLocalShadowRecommendationEvidence(evidence, { comparisonRunId, condition });
    if (!validation.valid) return { ok: false, reasonCode: "recommendation_evidence_contract_invalid" };

    return {
      ok: true,
      evidence,
      metadata: {
        directory: path.relative(root, directory).replace(/\\/g, "/"),
        expectedFileCount: expectedNames.length,
        observedFileCount: names.length,
        expectedDirectories,
        observedDirectories: directories,
        residualFiles: [],
        residualDirectories: []
      }
    };
  } catch {
    return { ok: false, reasonCode: "recommendation_evidence_read_failed" };
  }
}

export async function readComparisonActualRuntimeEvidence({ root, runDirectory, comparisonRunId, condition }) {
  const directory = comparisonDirectory({ root, runDirectory, comparisonRunId });
  const runtimeDirectory = directory ? path.join(directory, "runtime") : null;
  const expectedNames = condition === "on"
    ? ["runtime-flag-off.json", "runtime-flag-on.json"]
    : ["runtime-flag-off.json"];
  const filePath = runtimeDirectory ? path.join(runtimeDirectory, `runtime-flag-${condition}.json`) : null;
  if (!runtimeDirectory || !filePath || !existsSync(filePath)) return { ok: false, reasonCode: "actual_runtime_evidence_missing" };

  try {
    const entries = await readdir(runtimeDirectory, { withFileTypes: true });
    const names = entries.filter((entry) => entry.isFile()).map((entry) => entry.name).sort();
    if (
      !isWithinDirectory(runtimeDirectory, directory) ||
      !sameOrderedValues(names, expectedNames) ||
      entries.some((entry) => !entry.isFile())
    ) return { ok: false, reasonCode: "actual_runtime_evidence_residual_or_unexpected_file" };
    const evidence = JSON.parse(await readFile(filePath, "utf8"));
    if (!validateLocalActualRuntimeEvidence(evidence, { comparisonRunId, condition }).valid) {
      return { ok: false, reasonCode: "actual_runtime_evidence_contract_invalid" };
    }
    return {
      ok: true,
      evidence,
      metadata: {
        directory: path.relative(root, runtimeDirectory).replace(/\\/g, "/"),
        expectedFileCount: expectedNames.length,
        observedFileCount: names.length,
        residualFiles: []
      }
    };
  } catch {
    return { ok: false, reasonCode: "actual_runtime_evidence_read_failed" };
  }
}

export async function readComparisonPolicyEvidence({ root, runDirectory, comparisonRunId }) {
  const directory = comparisonDirectory({ root, runDirectory, comparisonRunId });
  const policyDirectory = directory ? path.join(directory, "policy") : null;
  const filePath = policyDirectory ? path.join(policyDirectory, "policy-flag-on.json") : null;
  if (!policyDirectory || !existsSync(policyDirectory) || !existsSync(filePath)) {
    return { ok: false, reasonCode: "policy_evidence_missing" };
  }

  try {
    const entries = await readdir(policyDirectory, { withFileTypes: true });
    if (
      !isWithinDirectory(policyDirectory, directory) ||
      entries.length !== 1 ||
      !entries[0].isFile() ||
      entries[0].name !== "policy-flag-on.json"
    ) {
      return { ok: false, reasonCode: "policy_evidence_residual_or_unexpected_file" };
    }
    const evidence = JSON.parse(await readFile(filePath, "utf8"));
    if (!validateLocalShadowPolicyEvidence(evidence, { comparisonRunId }).valid) {
      return { ok: false, reasonCode: "policy_evidence_contract_invalid" };
    }
    return {
      ok: true,
      evidence,
      metadata: {
        directory: path.relative(root, policyDirectory).replace(/\\/g, "/"),
        expectedFileCount: 1,
        observedFileCount: 1,
        residualFiles: []
      }
    };
  } catch {
    return { ok: false, reasonCode: "policy_evidence_read_failed" };
  }
}

export function createConditionEvidence({
  routeInvocationCount = 0,
  httpStatus = null,
  responseContract = null,
  recommendationEvidence = null,
  recommendationEvidenceMetadata = null,
  policyEvidence = null,
  policyEvidenceMetadata = null,
  actualRuntimeEvidence = null,
  actualRuntimeEvidenceMetadata = null,
  beforeSnapshot = null,
  afterSnapshot = null,
  reasonCode = null
} = {}) {
  return {
    routeInvocationCount,
    httpStatus,
    responseContract,
    recommendationEvidence,
    recommendationEvidenceMetadata,
    policyEvidence,
    policyEvidenceMetadata,
    actualRuntimeEvidence,
    actualRuntimeEvidenceMetadata,
    databaseBeforeSnapshot: beforeSnapshot?.databaseCounts || null,
    databaseAfterSnapshot: afterSnapshot?.databaseCounts || null,
    storageBeforeCount: beforeSnapshot?.storageObjectCount ?? null,
    storageAfterCount: afterSnapshot?.storageObjectCount ?? null,
    auditBeforeEventCount: beforeSnapshot?.auditEvents?.length ?? null,
    auditAfterEventCount: afterSnapshot?.auditEvents?.length ?? null,
    databaseDelta: beforeSnapshot && afterSnapshot ? subtractCounts(beforeSnapshot.databaseCounts, afterSnapshot.databaseCounts) : null,
    storageDelta: beforeSnapshot && afterSnapshot ? afterSnapshot.storageObjectCount - beforeSnapshot.storageObjectCount : null,
    auditEvents: beforeSnapshot && afterSnapshot ? subtractAuditEvents(beforeSnapshot.auditEvents, afterSnapshot.auditEvents) : null,
    providerEvidence: { providerStubbed: !reasonCode && routeInvocationCount === 1, externalProviderInvocationCount: 0 },
    reasonCode,
    completed: routeInvocationCount === 1 && !reasonCode
  };
}

export function compareRouteExecutions(flagOff, flagOn) {
  const completeRecommendationComparison = Boolean(flagOff.recommendationEvidence && flagOn.recommendationEvidence);
  const topPickChanged = completeRecommendationComparison && flagOff.recommendationEvidence.topPickId !== flagOn.recommendationEvidence.topPickId;
  const supportingProductsChanged = completeRecommendationComparison && !sameOrderedValues(
    flagOff.recommendationEvidence.supportingProductIdsInOrder,
    flagOn.recommendationEvidence.supportingProductIdsInOrder
  );
  const budgetAlternativesChanged = completeRecommendationComparison && !sameOrderedValues(
    flagOff.recommendationEvidence.budgetAlternativeIdsInOrder,
    flagOn.recommendationEvidence.budgetAlternativeIdsInOrder
  );
  const databaseMutationClassification = classifyAuditEvents(flagOff.auditEvents || [], flagOn.auditEvents || []);
  const tableMutationClassification = classifyTableMutations(flagOff.databaseDelta || {}, flagOn.databaseDelta || {});
  const storageMutationClassification = {
    flagOffCount: flagOff.storageDelta || 0,
    flagOnCount: flagOn.storageDelta || 0,
    classification: classifyCounts(flagOff.storageDelta || 0, flagOn.storageDelta || 0, true)
  };
  const hasUnexpectedDatabaseMutation = [...databaseMutationClassification, ...tableMutationClassification]
    .some((event) => event.classification === "unexpected_mutation");
  const policyViolationCounts = flagOn.policyEvidence?.violationCounts || null;
  const actualRuntime = flagOn.actualRuntimeEvidence;
  const policyViolationDetected =
    Number(actualRuntime?.unexpectedReceiverCount || 0) > 0 ||
    Object.values(actualRuntime?.safetyViolationCounts || policyViolationCounts || {})
      .some((count) => Number(count || 0) > 0);
  const excludedIds = new Set(
    Object.values(actualRuntime?.excludedCandidates || {}).flat().map((row) => row.productId)
  );
  const visibleIds = new Set(actualRuntime?.visibleCandidateIdsInOrder || []);
  const changedIdsArePolicyDriven = (before = [], after = []) =>
    before.filter((id) => !after.includes(id)).every((id) => excludedIds.has(id)) &&
    after.every((id) => visibleIds.has(id));
  const expectedRecommendationDelta = Boolean(
    actualRuntime?.runtimeExecuted &&
    changedIdsArePolicyDriven(
      [flagOff.recommendationEvidence?.topPickId].filter(Boolean),
      [flagOn.recommendationEvidence?.topPickId].filter(Boolean)
    ) &&
    changedIdsArePolicyDriven(
      flagOff.recommendationEvidence?.supportingProductIdsInOrder || [],
      flagOn.recommendationEvidence?.supportingProductIdsInOrder || []
    ) &&
    changedIdsArePolicyDriven(
      flagOff.recommendationEvidence?.budgetAlternativeIdsInOrder || [],
      flagOn.recommendationEvidence?.budgetAlternativeIdsInOrder || []
    )
  );

  return {
    responseShapeChanged: !responseContractsMatch(flagOff.responseContract, flagOn.responseContract) || flagOff.httpStatus !== flagOn.httpStatus,
    recommendationChanged: Boolean(topPickChanged || supportingProductsChanged || budgetAlternativesChanged),
    topPickChanged: Boolean(topPickChanged),
    supportingProductsChanged: Boolean(supportingProductsChanged),
    budgetAlternativesChanged: Boolean(budgetAlternativesChanged),
    databaseMutationClassification,
    tableMutationClassification,
    storageMutationClassification,
    shadowAddedDbMutationDelta: hasUnexpectedDatabaseMutation ? null : 0,
    shadowAddedStorageMutationDelta: storageMutationClassification.classification === "unexpected_mutation" ? null : 0,
    completeRecommendationComparison,
    expectedRecommendationDelta,
    unexpectedRecommendationDelta: Boolean(topPickChanged || supportingProductsChanged || budgetAlternativesChanged) && !expectedRecommendationDelta,
    policyViolationCounts,
    policyViolationDetected
  };
}
