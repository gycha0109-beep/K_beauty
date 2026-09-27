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
