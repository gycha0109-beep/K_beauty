import {
  applyPremiumSessionDiagnosticHeaders,
  createPremiumSessionDiagnosticContext
} from "./premium-session-payload-diagnostics.js";
import { diffPremiumSnapshots } from "./premium-snapshot-diff.js";
import { writeSafeLog } from "./security/error-redaction.js";

export const PREMIUM_SNAPSHOT_REPLAY_DIAGNOSTIC_VERSION =
  "premium-snapshot-replay-diagnostic-v1";
export const PREMIUM_SNAPSHOT_REPLAY_STATUS_HEADER =
  "x-bejewely-premium-replay-status";
export const PREMIUM_SNAPSHOT_REPLAY_DIFF_HEADER =
  "x-bejewely-premium-replay-diff-paths";
export const PREMIUM_SNAPSHOT_REPLAY_DIFF_CONTRACT_HEADER =
  "x-bejewely-premium-replay-diff-contract";
export const PREMIUM_SNAPSHOT_REPLAY_EXISTING_FINGERPRINT_HEADER =
  "x-bejewely-premium-existing-fingerprint";
export const PREMIUM_SNAPSHOT_REPLAY_NEXT_FINGERPRINT_HEADER =
  "x-bejewely-premium-next-fingerprint";

function currentProductsInputState(body) {
  if (!Object.prototype.hasOwnProperty.call(body || {}, "currentProducts")) return "absent";
  if (!Array.isArray(body.currentProducts)) return "invalid";
  return body.currentProducts.length ? "nonempty" : "empty";
}

function safeDiffPaths(diff) {
  return diff.diffPaths.slice(0, 4).map((entry) => entry.path);
}

function safeDiffContract(diff) {
  return diff.diffPaths.slice(0, 4).map((entry) => ({
    path: entry.path,
    existingType: entry.existingType,
    nextType: entry.nextType,
    existingPresent: entry.existingPresent,
    nextPresent: entry.nextPresent,
    existingArrayLength: entry.existingArrayLength ?? null,
    nextArrayLength: entry.nextArrayLength ?? null,
    existingObjectKeyCount: entry.existingObjectKeyCount ?? null,
    nextObjectKeyCount: entry.nextObjectKeyCount ?? null,
    existingHash: entry.existingHash || null,
    nextHash: entry.nextHash || null
  }));
}

export function createPremiumSnapshotReplayDiagnostic({
  request,
  replay,
  body,
  locale,
  currentProductsChanged,
  faceLabPersistenceDecision,
  sourceStage,
  env = process.env
}) {
  const context = createPremiumSessionDiagnosticContext(request, env);
  if (!context.active || !replay?.existing?.canonical || !replay?.next?.canonical) {
    return { active: false };
  }

  const diff = diffPremiumSnapshots(
    replay.existing.canonical,
    replay.next.canonical,
    { maxDiffPaths: 8 }
  );
  const diagnostic = {
    active: true,
    diagnosticVersion: PREMIUM_SNAPSHOT_REPLAY_DIAGNOSTIC_VERSION,
    diagnosticId: context.diagnosticId,
    runtimeCommitSha: context.runtimeCommitSha,
    replayStatus: replay.status,
    existingFingerprint: replay.existing.fingerprint,
    nextFingerprint: replay.next.fingerprint,
    diffPaths: safeDiffPaths(diff),
    diffContract: safeDiffContract(diff),
    diffTruncated: diff.truncated || diff.diffPaths.length > 4,
    existingContextHash: replay.existing.contextHash,
    nextContextHash: replay.next.contextHash,
    existingContextRevision: replay.existing.contextRevision,
    nextContextRevision: replay.next.contextRevision,
    currentProductsInputState: currentProductsInputState(body),
    currentProductsChanged: Boolean(currentProductsChanged),
    locale: locale === "en" ? "en" : "ko",
    faceLabPersistenceDecision:
      faceLabPersistenceDecision === "persist" ? "persist" : "preserve",
    sourceStage: String(sourceStage || "finalized_replay").slice(0, 48)
  };

  writeSafeLog("info", {
    event: "analysis_diagnostic",
    category: "runtime_state",
    operation: "premium_snapshot_replay",
    dependency: "application",
    ...diagnostic,
    ok: replay.status === "existing"
  });
  return diagnostic;
}

export function applyPremiumSnapshotReplayDiagnosticHeaders(response, diagnostic) {
  if (!diagnostic?.active || !response?.headers?.set) return response;
  const context = {
    active: true,
    diagnosticVersion: "premium-session-runtime-boundary-v1",
    diagnosticId: diagnostic.diagnosticId,
    runtimeCommitSha: diagnostic.runtimeCommitSha,
    finalStage: null
  };
  applyPremiumSessionDiagnosticHeaders(response, context);
  response.headers.set(PREMIUM_SNAPSHOT_REPLAY_STATUS_HEADER, diagnostic.replayStatus);
  response.headers.set(
    PREMIUM_SNAPSHOT_REPLAY_DIFF_HEADER,
    diagnostic.diffPaths.join(",").slice(0, 512)
  );
  response.headers.set(
    PREMIUM_SNAPSHOT_REPLAY_DIFF_CONTRACT_HEADER,
    Buffer.from(JSON.stringify(diagnostic.diffContract), "utf8").toString("base64url")
  );
  response.headers.set(
    PREMIUM_SNAPSHOT_REPLAY_EXISTING_FINGERPRINT_HEADER,
    diagnostic.existingFingerprint
  );
  response.headers.set(
    PREMIUM_SNAPSHOT_REPLAY_NEXT_FINGERPRINT_HEADER,
    diagnostic.nextFingerprint
  );
  return response;
}
