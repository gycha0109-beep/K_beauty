export function normalizeFaceLabRevision(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

export function readFaceLabLocalSyncState(localState) {
  if (!localState || typeof localState !== "object" || Array.isArray(localState)) {
    return null;
  }

  return {
    syncStatus:
      typeof localState.syncStatus === "string" ? localState.syncStatus : "legacy",
    baseServerRevision: normalizeFaceLabRevision(localState.baseServerRevision),
    acknowledgedRevision: normalizeFaceLabRevision(localState.acknowledgedRevision)
  };
}

export function resolveFaceLabRestore({
  serverState,
  serverRevision,
  localState
}) {
  const revision = normalizeFaceLabRevision(serverRevision);
  const serverAvailable = Boolean(serverState?.surveyAnswers);
  const localAvailable = Boolean(localState?.surveyAnswers);

  if (!localAvailable) {
    return {
      source: serverAvailable ? "server" : "none",
      shouldRetryPersist: false,
      conflict: false
    };
  }

  const localSync = readFaceLabLocalSyncState(localState);

  if (localSync?.syncStatus === "synced") {
    if (
      serverAvailable &&
      localSync.acknowledgedRevision === revision
    ) {
      return {
        source: "server",
        shouldRetryPersist: false,
        conflict: false
      };
    }

    return {
      source: serverAvailable ? "server" : "none",
      shouldRetryPersist: false,
      conflict: localSync.acknowledgedRevision !== revision
    };
  }

  if (localSync?.syncStatus === "pending" || localSync?.syncStatus === "auth_required") {
    if (localSync.baseServerRevision === revision) {
      return {
        source: "local",
        shouldRetryPersist: true,
        conflict: false
      };
    }

    return {
      source: serverAvailable ? "server" : "none",
      shouldRetryPersist: false,
      conflict: true
    };
  }

  if (localSync?.syncStatus === "conflict") {
    return {
      source: serverAvailable ? "server" : "none",
      shouldRetryPersist: false,
      conflict: true
    };
  }

  // Legacy local entries predate revision metadata. They may only be replayed
  // when the server has never accepted a Face Lab V2 mutation.
  if (!serverAvailable && revision === 0) {
    return {
      source: "local",
      shouldRetryPersist: true,
      conflict: false
    };
  }

  return {
    source: serverAvailable ? "server" : "none",
    shouldRetryPersist: false,
    conflict: false
  };
}

export function buildFaceLabLocalState(value, {
  syncStatus,
  baseServerRevision,
  acknowledgedRevision
}) {
  return {
    surveyAnswers: value?.surveyAnswers || null,
    targetFinderResult: value?.targetFinderResult || null,
    selectedRouteId: value?.selectedRouteId || null,
    syncStatus,
    baseServerRevision: normalizeFaceLabRevision(baseServerRevision),
    acknowledgedRevision: normalizeFaceLabRevision(acknowledgedRevision),
    localEditedAt: new Date().toISOString()
  };
}

/**
 * A deferred server save is not a successful local backup unless the browser
 * actually accepted the fallback write. Do not hide blocked/private storage
 * behind a misleading "saved on this device" message.
 */
export function resolveFaceLabDeferredSaveStatus({
  localSaved,
  authRequired = false
} = {}) {
  if (localSaved !== true) return "local_failed";
  return authRequired ? "auth_required" : "pending";
}

/**
 * The same payload can be submitted multiple times (A → B → A, or manual
 * retry). Fingerprint equality alone cannot identify the newest request.
 */
export function isLatestFaceLabSaveRequest({
  requestFingerprint,
  latestFingerprint,
  requestSequence,
  latestSequence
} = {}) {
  return (
    typeof requestFingerprint === "string" &&
    requestFingerprint.length > 0 &&
    Number.isSafeInteger(requestSequence) &&
    requestSequence > 0 &&
    requestFingerprint === latestFingerprint &&
    requestSequence === latestSequence
  );
}
