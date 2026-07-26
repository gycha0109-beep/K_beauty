export const RPC_VISIBILITY_TIMEOUT_MS = 60_000;
export const RPC_VISIBILITY_INTERVAL_MS = 1_000;
export const RPC_VISIBILITY_MAX_ATTEMPTS = 60;
export const RPC_VISIBILITY_READY_CODE = "22023";

const SAFE_CODE_PATTERN = /^(?:[A-Z0-9_]{2,20}|[0-9]{5})$/;
const TRANSIENT_CODES = new Set(["PGRST000", "PGRST001", "PGRST002", "PGRST003", "PGRST202", "PGRSTX00"]);
const TRANSIENT_HTTP_STATUSES = new Set([404, 502, 503]);
const AUTH_HTTP_STATUSES = new Set([401, 403]);
const AUTH_CODES = new Set(["PGRST301", "PGRST302", "PGRST303"]);

export function normalizeSafeErrorCode(value) {
  return typeof value === "string" && SAFE_CODE_PATTERN.test(value)
    ? value
    : "unknown";
}

function numericStatus(value) {
  return Number.isInteger(value) ? value : null;
}

function classifyProbeResponse({ error, status, networkError }) {
  const safeErrorCode = normalizeSafeErrorCode(error?.code);
  const safeStatus = numericStatus(status);

  if (networkError) {
    return { action: "retry", marker: "anonymous_grant_rpc_network_unready", safeErrorCode };
  }
  if (safeErrorCode === RPC_VISIBILITY_READY_CODE) {
    return { action: "ready", marker: null, safeErrorCode };
  }
  if (!error) {
    return {
      action: "fail",
      marker: "anonymous_grant_rpc_probe_contract_invalid",
      safeErrorCode
    };
  }
  if (safeErrorCode === "42501") {
    return {
      action: "fail",
      marker: "anonymous_grant_rpc_permission_denied",
      safeErrorCode
    };
  }
  if (AUTH_HTTP_STATUSES.has(safeStatus) || AUTH_CODES.has(safeErrorCode)) {
    return {
      action: "fail",
      marker: "anonymous_grant_rpc_auth_failed",
      safeErrorCode
    };
  }
  if (TRANSIENT_CODES.has(safeErrorCode) || TRANSIENT_HTTP_STATUSES.has(safeStatus)) {
    return {
      action: "retry",
      marker: "anonymous_grant_rpc_network_unready",
      safeErrorCode
    };
  }
  return {
    action: "fail",
    marker: "anonymous_grant_rpc_probe_contract_invalid",
    safeErrorCode
  };
}

export async function waitForAnonymousGrantRpcVisibility({
  probeRpc,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  now = () => Date.now(),
  timeoutMs = RPC_VISIBILITY_TIMEOUT_MS,
  intervalMs = RPC_VISIBILITY_INTERVAL_MS,
  maxAttempts = RPC_VISIBILITY_MAX_ATTEMPTS
}) {
  const startedAt = now();
  let probeAttempts = 0;
  let lastSafeErrorCode = null;
  let lastTransientMarker = null;

  while (probeAttempts < maxAttempts && now() - startedAt <= timeoutMs) {
    probeAttempts += 1;
    let result;
    try {
      result = await probeRpc();
    } catch {
      result = { error: null, status: null, networkError: true };
    }

    const classification = classifyProbeResponse(result || {});
    lastSafeErrorCode = classification.safeErrorCode;
    if (classification.action === "ready") {
      return {
        ok: true,
        failureMarker: null,
        safeErrorCode: RPC_VISIBILITY_READY_CODE,
        probeAttempts,
        elapsedMs: Math.max(0, now() - startedAt),
        visibilityReady: true
      };
    }
    if (classification.action === "fail") {
      return {
        ok: false,
        failureMarker: classification.marker,
        safeErrorCode: classification.safeErrorCode,
        probeAttempts,
        elapsedMs: Math.max(0, now() - startedAt),
        visibilityReady: false
      };
    }

    lastTransientMarker = classification.marker;
    if (probeAttempts >= maxAttempts || now() - startedAt >= timeoutMs) break;
    await sleep(intervalMs);
  }

  return {
    ok: false,
    failureMarker: "anonymous_grant_rpc_visibility_timeout",
    transientMarker: lastTransientMarker,
    safeErrorCode: lastSafeErrorCode,
    probeAttempts,
    elapsedMs: Math.max(0, now() - startedAt),
    visibilityReady: false
  };
}

export function createPreflightDiagnostic() {
  return {
    schemaVersion: "anonymous-grant-preflight-v1",
    stage: "visibility_probe",
    finalStatus: "FAIL",
    failureMarker: null,
    primaryFailureMarker: null,
    cleanupFailureMarker: null,
    safeErrorCode: null,
    probeAttempts: 0,
    elapsedMs: 0,
    visibilityReady: false,
    actualCreateRpcAttempts: 0,
    createdCount: null,
    rowCount: null,
    cleanupRowCount: null
  };
}

export async function runAnonymousGrantRpcContract({
  probeRpc,
  createRpc,
  selectRows,
  deleteRows,
  countRows,
  sleep,
  now,
  timeoutMs,
  intervalMs,
  maxAttempts
}) {
  const diagnostic = createPreflightDiagnostic();
  const visibility = await waitForAnonymousGrantRpcVisibility({
    probeRpc,
    sleep,
    now,
    timeoutMs,
    intervalMs,
    maxAttempts
  });
  Object.assign(diagnostic, {
    safeErrorCode: visibility.safeErrorCode,
    probeAttempts: visibility.probeAttempts,
    elapsedMs: visibility.elapsedMs,
    visibilityReady: visibility.visibilityReady
  });

  let primaryFailureMarker = visibility.failureMarker;
  try {
    if (!primaryFailureMarker) {
      diagnostic.stage = "create_rpc";
      diagnostic.actualCreateRpcAttempts += 1;
      let createResponse;
      try {
        createResponse = await createRpc();
      } catch {
        diagnostic.safeErrorCode = "unknown";
        primaryFailureMarker = "anonymous_grant_rpc_execution_failed";
      }

      if (!primaryFailureMarker && createResponse?.error) {
        diagnostic.safeErrorCode = normalizeSafeErrorCode(createResponse.error.code);
        primaryFailureMarker = "anonymous_grant_rpc_execution_failed";
      }

      const createdCount = createResponse?.data?.created;
      diagnostic.createdCount = Number.isInteger(createdCount) ? createdCount : null;
      if (!primaryFailureMarker && diagnostic.createdCount !== 2) {
        primaryFailureMarker = "anonymous_grant_created_count_invalid";
      }
    }

    if (!primaryFailureMarker) {
      diagnostic.stage = "row_contract";
      let rowResponse;
      try {
        rowResponse = await selectRows();
      } catch {
        rowResponse = { error: true, rows: null };
      }
      const rows = Array.isArray(rowResponse?.rows) ? rowResponse.rows : null;
      diagnostic.rowCount = rows?.length ?? null;
      const operations = rows?.map((row) => row.operation).sort() || [];
      if (
        rowResponse?.error ||
        !rows ||
        rows.length !== 2 ||
        operations.join(",") !== "result:create,track:create"
      ) {
        primaryFailureMarker = "anonymous_grant_row_contract_invalid";
      }
    }
  } finally {
    const primaryStage = diagnostic.stage;
    let cleanupFailureMarker = null;
    try {
      const deleteResponse = await deleteRows();
      const countResponse = await countRows();
      diagnostic.cleanupRowCount = Number.isInteger(countResponse?.count)
        ? countResponse.count
        : null;
      if (deleteResponse?.error || countResponse?.error || diagnostic.cleanupRowCount !== 0) {
        cleanupFailureMarker = "anonymous_grant_cleanup_failed";
      }
    } catch {
      cleanupFailureMarker = "anonymous_grant_cleanup_failed";
    }

    diagnostic.primaryFailureMarker = primaryFailureMarker;
    diagnostic.cleanupFailureMarker = cleanupFailureMarker;
    diagnostic.failureMarker = cleanupFailureMarker || primaryFailureMarker;
    diagnostic.finalStatus = diagnostic.failureMarker ? "FAIL" : "PASS";
    diagnostic.stage = cleanupFailureMarker
      ? "cleanup"
      : primaryFailureMarker
        ? primaryStage
        : "cleanup";
  }

  return diagnostic;
}
