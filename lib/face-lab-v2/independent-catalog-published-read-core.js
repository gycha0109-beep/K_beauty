import {
  composeFaceLabReviewedLookDryRun
} from "./independent-catalog-publication-gate.js";

export const FACE_LAB_INDEPENDENT_PUBLISHED_READ_VERSION =
  "face-lab-independent-published-read-dry-run-v1";

const KEY = /^[a-z0-9][a-z0-9._-]{0,159}$/;

function object(value) {
  return value !== null && typeof value === "object" &&
    !Array.isArray(value);
}

function result(status, reason, extra = {}) {
  return {
    readVersion: FACE_LAB_INDEPENDENT_PUBLISHED_READ_VERSION,
    status,
    reason,
    previewSpec: null,
    selectionCount: 0,
    authority: null,
    providerRequest: null,
    governedSourceVerified: false,
    renderReady: false,
    imageModelInvoked: false,
    ...extra
  };
}

function validSelection(value) {
  const allowed = new Set([
    "faceLabItemId", "faceLabVariantId", "slotKey"
  ]);
  return object(value) &&
    Object.keys(value).every(key => allowed.has(key)) &&
    typeof value.faceLabItemId === "string" &&
    KEY.test(value.faceLabItemId) &&
    typeof value.slotKey === "string" &&
    KEY.test(value.slotKey) &&
    (value.faceLabVariantId === undefined ||
      (typeof value.faceLabVariantId === "string" &&
        KEY.test(value.faceLabVariantId)));
}

/**
 * Strictly offline publication read model. The injected "source" is a
 * non-privileged fixture adapter, NOT proof of a real catalog authority.
 * No Supabase, provider, storage, auth or network access occurs here.
 *
 * Recheck before AND after the pure compositor. A future production reader
 * must implement transactional reads plus real revocation and user auth.
 */
export async function readFaceLabIndependentPublishedDryRun(input = {}) {
  const {
    sessionId, selections, source, presentationPreference = null
  } = object(input) ? input : {};

  if (typeof sessionId !== "string" || !sessionId.trim() ||
      sessionId.length > 160 || !Array.isArray(selections) ||
      selections.length < 1 || selections.length > 8 ||
      !selections.every(validSelection)) {
    return result("blocked", "published_read_input_invalid");
  }

  const slotKeys = selections.map(selection => selection.slotKey);
  if (new Set(slotKeys).size !== slotKeys.length) {
    return result("blocked", "published_read_duplicate_slot");
  }

  if (!object(source) ||
      typeof source.readSnapshot !== "function" ||
      typeof source.verifySnapshot !== "function") {
    return result("unavailable", "published_read_source_unavailable");
  }

  let snapshot;
  try {
    snapshot = await source.readSnapshot({
      selections: structuredClone(selections)
    });
  } catch {
    return result("unavailable", "published_read_source_unavailable");
  }

  if (!object(snapshot) || snapshot.status !== "available" ||
      !Array.isArray(snapshot.candidateSelections) ||
      !Array.isArray(snapshot.referenceRecords) ||
      !Array.isArray(snapshot.reviewRecords) ||
      !object(snapshot.snapshotToken) ||
      snapshot.candidateSelections.length !== selections.length) {
    return result("blocked", "published_read_snapshot_not_available");
  }

  // The fixture store must bind every selected identity and slot to the
  // candidate it supplied. Unknown or extra source records fail closed.
  const actualSelections = snapshot.candidateSelections;
  for (let i = 0; i < selections.length; i++) {
    const request = selections[i];
    const candidate = actualSelections[i];
    if (!object(candidate) || !object(candidate.item) ||
        candidate.item.faceLabItemId !== request.faceLabItemId ||
        candidate.slotKey !== request.slotKey ||
        (candidate.item.kind === "product"
          ? !object(candidate.variant) ||
            candidate.variant.faceLabVariantId !== request.faceLabVariantId
          : request.faceLabVariantId !== undefined)) {
      return result("blocked", "published_read_identity_mismatch");
    }
  }

  async function verifyCurrent() {
    try {
      return await source.verifySnapshot(snapshot.snapshotToken);
    } catch {
      return { status: "unavailable" };
    }
  }

  const before = await verifyCurrent();
  if (!object(before) || before.status !== "current") {
    return result(
      before?.status === "unavailable" ? "unavailable" : "blocked",
      "published_read_current_state_mismatch"
    );
  }

  let composed;
  try {
    composed = composeFaceLabReviewedLookDryRun({
      sessionId,
      candidateSelections: snapshot.candidateSelections,
      referenceRecords: snapshot.referenceRecords,
      reviewRecords: snapshot.reviewRecords,
      presentationPreference
    });
  } catch {
    return result("blocked", "published_read_composition_invalid");
  }
  if (composed.status !== "dry_run") {
    return result("blocked", "published_read_review_or_preview_failed");
  }

  const after = await verifyCurrent();
  if (!object(after) || after.status !== "current") {
    return result(
      after?.status === "unavailable" ? "unavailable" : "blocked",
      "published_read_current_state_mismatch"
    );
  }

  return result("dry_run", "mock_publication_verified", {
    selectionCount: composed.selectionCount,
    previewSpec: composed.previewSpec
  });
}
