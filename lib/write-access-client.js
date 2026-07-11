const LEGACY_WRITE_ACCESS_SESSION_KEY = "skinTestWriteAccessToken";
export const RESULT_WRITE_ACCESS_SESSION_KEY = "skinTestResultWriteAccessToken";
export const TRACK_WRITE_ACCESS_SESSION_KEY = "skinTestTrackWriteAccessToken";
export const ANALYSIS_RUN_SESSION_KEY = "skinTestAnonymousAnalysisRunId";

function getSessionStorage() {
  return typeof window === "undefined" ? null : window.sessionStorage;
}

function readTokenExpiry(token) {
  if (typeof token !== "string") {
    return null;
  }

  try {
    const encodedPayload = token.split(".")[0];
    const payload = JSON.parse(atob(encodedPayload.replace(/-/g, "+").replace(/_/g, "/")));
    return Number.isSafeInteger(payload?.expiresAt) ? payload.expiresAt : null;
  } catch {
    return null;
  }
}

function isExpired(token) {
  const expiresAt = readTokenExpiry(token);

  return expiresAt !== null && expiresAt <= Date.now();
}

export function readAnonymousWriteGrantState() {
  const storage = getSessionStorage();

  if (!storage) {
    return {
      resultToken: null,
      trackToken: null,
      analysisRunId: null
    };
  }

  storage.removeItem(LEGACY_WRITE_ACCESS_SESSION_KEY);

  const resultToken = storage.getItem(RESULT_WRITE_ACCESS_SESSION_KEY);
  const trackToken = storage.getItem(TRACK_WRITE_ACCESS_SESSION_KEY);

  if (isExpired(resultToken)) {
    storage.removeItem(RESULT_WRITE_ACCESS_SESSION_KEY);
  }

  if (isExpired(trackToken)) {
    storage.removeItem(TRACK_WRITE_ACCESS_SESSION_KEY);
  }

  const nextResultToken = storage.getItem(RESULT_WRITE_ACCESS_SESSION_KEY);
  const nextTrackToken = storage.getItem(TRACK_WRITE_ACCESS_SESSION_KEY);

  if (!nextResultToken && !nextTrackToken) {
    storage.removeItem(ANALYSIS_RUN_SESSION_KEY);
  }

  return {
    resultToken: nextResultToken,
    trackToken: nextTrackToken,
    analysisRunId: storage.getItem(ANALYSIS_RUN_SESSION_KEY)
  };
}

export function writeAnonymousWriteGrantState({ resultToken, trackToken, analysisRunId } = {}) {
  const storage = getSessionStorage();

  if (!storage) {
    return;
  }

  storage.removeItem(LEGACY_WRITE_ACCESS_SESSION_KEY);

  if (typeof resultToken === "string" && resultToken) {
    storage.setItem(RESULT_WRITE_ACCESS_SESSION_KEY, resultToken);
  } else {
    storage.removeItem(RESULT_WRITE_ACCESS_SESSION_KEY);
  }

  if (typeof trackToken === "string" && trackToken) {
    storage.setItem(TRACK_WRITE_ACCESS_SESSION_KEY, trackToken);
  } else {
    storage.removeItem(TRACK_WRITE_ACCESS_SESSION_KEY);
  }

  if (typeof analysisRunId === "string" && analysisRunId) {
    storage.setItem(ANALYSIS_RUN_SESSION_KEY, analysisRunId);
  } else {
    storage.removeItem(ANALYSIS_RUN_SESSION_KEY);
  }
}

export function createAnonymousResultPersistencePayload(result) {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return null;
  }

  const persistenceResult = { ...result };
  delete persistenceResult.analysisRunId;
  delete persistenceResult.meta;
  delete persistenceResult.faceLab;
  delete persistenceResult.faceLabTeaser;
  delete persistenceResult.faceLabStructured;

  return persistenceResult;
}

export function clearResultWriteAccessToken() {
  const storage = getSessionStorage();

  if (!storage) {
    return;
  }

  storage.removeItem(RESULT_WRITE_ACCESS_SESSION_KEY);

  if (!storage.getItem(TRACK_WRITE_ACCESS_SESSION_KEY)) {
    storage.removeItem(ANALYSIS_RUN_SESSION_KEY);
  }
}

export function clearTrackWriteAccessToken() {
  const storage = getSessionStorage();

  if (!storage) {
    return;
  }

  storage.removeItem(TRACK_WRITE_ACCESS_SESSION_KEY);

  if (!storage.getItem(RESULT_WRITE_ACCESS_SESSION_KEY)) {
    storage.removeItem(ANALYSIS_RUN_SESSION_KEY);
  }
}

export function clearAnonymousWriteGrantState() {
  const storage = getSessionStorage();

  if (!storage) {
    return;
  }

  storage.removeItem(LEGACY_WRITE_ACCESS_SESSION_KEY);
  storage.removeItem(RESULT_WRITE_ACCESS_SESSION_KEY);
  storage.removeItem(TRACK_WRITE_ACCESS_SESSION_KEY);
  storage.removeItem(ANALYSIS_RUN_SESSION_KEY);
}
