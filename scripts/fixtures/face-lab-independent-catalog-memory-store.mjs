import {
  inspectFaceLabCatalogReviewRecord,
  transitionFaceLabCatalogReview
} from "../../lib/face-lab-v2/independent-catalog-review-state.js";
import {
  composeFaceLabReviewedLookDryRun
} from "../../lib/face-lab-v2/independent-catalog-publication-gate.js";

const copy = value => structuredClone(value);
const keyForSelection = ({ faceLabItemId, faceLabVariantId, slotKey }) =>
  JSON.stringify([faceLabItemId, faceLabVariantId ?? null, slotKey]);
const keyForReview = record => record.scope + "|" + record.targetRef;

function stateOf(record) {
  return {
    reviewKey: keyForReview(record),
    revision: record.revision,
    contentRevision: record.contentRevision,
    publishedContentRevision: record.publishedContentRevision,
    revocationEpoch: record.revocationEpoch,
    sourceDigest: record.sourceDigest,
    status: record.status
  };
}
function blocked(reason) {
  return { status: "blocked", reason };
}
function selectionFor(candidate) {
  return {
    faceLabItemId: candidate.item.faceLabItemId,
    ...(candidate.item.kind === "product"
      ? { faceLabVariantId: candidate.variant.faceLabVariantId } : {}),
    slotKey: candidate.slotKey
  };
}

export function createFaceLabIndependentCatalogMemoryStore({ entries } = {}) {
  if (!Array.isArray(entries) || !entries.length) {
    throw new Error("mock_entries_required");
  }
  const catalog = new Map();
  const reviews = new Map();
  const requests = new Map();
  let offline = false;

  function collectStamps(entry) {
    const stamps = [];
    for (const reviewKey of entry.reviewKeys) {
      const record = reviews.get(reviewKey);
      if (!record || record.status !== "published" ||
          inspectFaceLabCatalogReviewRecord(record).valid !== true) {
        return null;
      }
      stamps.push(stateOf(record));
    }
    return stamps.sort((a, b) => a.reviewKey.localeCompare(b.reviewKey));
  }
  function currentHead(entry) {
    const stamps = collectStamps(entry);
    return stamps && JSON.stringify(stamps) ===
      JSON.stringify(entry.head.stamps);
  }

  for (const sourceEntry of entries) {
    if (!sourceEntry || !sourceEntry.candidate ||
        !Array.isArray(sourceEntry.referenceRecords) ||
        !Array.isArray(sourceEntry.reviewRecords) ||
        !sourceEntry.reviewRecords.length) {
      throw new Error("mock_entry_invalid");
    }
    const candidate = copy(sourceEntry.candidate);
    const selection = selectionFor(candidate);
    const entryKey = keyForSelection(selection);
    if (catalog.has(entryKey)) throw new Error("mock_duplicate_selection");

    const reviewKeys = [];
    for (const rawReview of sourceEntry.reviewRecords) {
      const review = copy(rawReview);
      if (inspectFaceLabCatalogReviewRecord(review).valid !== true) {
        throw new Error("mock_review_invalid");
      }
      const reviewKey = keyForReview(review);
      if (reviewKeys.includes(reviewKey)) throw new Error("mock_duplicate_review");
      reviewKeys.push(reviewKey);
      if (reviews.has(reviewKey)) {
        if (JSON.stringify(reviews.get(reviewKey)) !== JSON.stringify(review)) {
          throw new Error("mock_shared_review_conflict");
        }
      } else {
        reviews.set(reviewKey, review);
      }
    }
    const check = composeFaceLabReviewedLookDryRun({
      sessionId: "mock-seed-validation",
      candidateSelections: [candidate],
      referenceRecords: sourceEntry.referenceRecords,
      reviewRecords: sourceEntry.reviewRecords
    });
    if (check.status !== "dry_run") {
      throw new Error("mock_seed_unapproved:" + check.reason);
    }
    catalog.set(entryKey, {
      candidate,
      references: copy(sourceEntry.referenceRecords),
      reviewKeys,
      head: { revision: 1, stamps: null }
    });
  }
  for (const entry of catalog.values()) {
    entry.head.stamps = collectStamps(entry);
    if (!entry.head.stamps) throw new Error("mock_unpublished_head");
  }

  function readSnapshot({ selections } = {}) {
    if (offline) throw new Error("mock_storage_unavailable");
    if (!Array.isArray(selections) || !selections.length) {
      return blocked("mock_selection_invalid");
    }
    const candidates = [], assets = [], collected = new Map();
    const tokens = [];
    for (const selection of selections) {
      const entryKey = keyForSelection(selection);
      const entry = catalog.get(entryKey);
      if (!entry || !currentHead(entry)) {
        return blocked("mock_publication_unavailable");
      }
      candidates.push(copy(entry.candidate));
      assets.push(...copy(entry.references));
      tokens.push({ entryKey, headRevision: entry.head.revision,
        stamps: copy(entry.head.stamps) });
      for (const reviewKey of entry.reviewKeys) {
        collected.set(reviewKey, copy(reviews.get(reviewKey)));
      }
    }
    return {
      status: "available",
      candidateSelections: candidates,
      referenceRecords: assets,
      reviewRecords: [...collected.values()],
      snapshotToken: { tokens }
    };
  }

  function verifySnapshot(snapshotToken) {
    if (offline) return { status: "unavailable" };
    if (!snapshotToken || !Array.isArray(snapshotToken.tokens) ||
        !snapshotToken.tokens.length) return { status: "changed" };
    for (const saved of snapshotToken.tokens) {
      const entry = catalog.get(saved.entryKey);
      if (!entry || !Number.isSafeInteger(saved.headRevision) ||
          entry.head.revision !== saved.headRevision ||
          !currentHead(entry)) {
        return { status: "changed" };
      }
      const now = collectStamps(entry);
      if (!now || JSON.stringify(now) !== JSON.stringify(saved.stamps)) {
        return { status: "changed" };
      }
    }
    return { status: "current" };
  }

  function applyReviewAction({
    scope, targetRef, expectedRevision, requestId, action
  } = {}) {
    if (offline) return { status: "unavailable" };
    if (typeof requestId !== "string" ||
        !/^[a-z0-9][a-z0-9._-]{7,119}$/i.test(requestId)) {
      return blocked("mock_request_id_invalid");
    }
    const requestFingerprint = JSON.stringify({
      scope, targetRef, expectedRevision, action
    });
    if (requests.has(requestId)) {
      const old = requests.get(requestId);
      return old.requestFingerprint === requestFingerprint
        ? copy(old.result) : blocked("mock_request_id_conflict");
    }
    const reviewKey = scope + "|" + targetRef;
    const record = reviews.get(reviewKey);
    if (!record) return blocked("mock_review_missing");
    const changed = transitionFaceLabCatalogReview({
      record: copy(record), expectedRevision, action
    });
    if (changed.status !== "accepted") {
      return blocked(changed.reason);
    }
    // No await between candidate validation and one synchronous commit.
    // Only simulates atomicity; does not model actual database transactions.
    reviews.set(reviewKey, copy(changed.record));
    const output = {
      status: "accepted", recordRevision: changed.record.revision,
      revocationEpoch: changed.record.revocationEpoch,
      reviewStatus: changed.record.status
    };
    requests.set(requestId, {
      requestFingerprint, result: copy(output)
    });
    return output;
  }

  function publishHead({ selection, expectedHeadRevision } = {}) {
    if (offline) return { status: "unavailable" };
    const entry = catalog.get(keyForSelection(selection));
    if (!entry) return blocked("mock_publication_missing");
    if (entry.head.revision !== expectedHeadRevision) {
      return blocked("mock_head_revision_conflict");
    }
    const current = collectStamps(entry);
    if (!current) return blocked("mock_review_not_published");
    const reviewRecords = entry.reviewKeys.map(key => copy(reviews.get(key)));
    const test = composeFaceLabReviewedLookDryRun({
      sessionId: "mock-republish-validation",
      candidateSelections: [entry.candidate],
      referenceRecords: entry.references,
      reviewRecords
    });
    if (test.status !== "dry_run") {
      return blocked("mock_content_and_review_mismatch");
    }
    entry.head = {
      revision: entry.head.revision + 1,
      stamps: current
    };
    return { status: "accepted", headRevision: entry.head.revision };
  }

  return {
    readSnapshot, verifySnapshot, applyReviewAction, publishHead,
    setOffline(value) { offline = value === true; },
    getFixtureReview(scope, targetRef) {
      const record = reviews.get(scope + "|" + targetRef);
      return record ? copy(record) : null;
    },
    getFixtureHeadRevision(selection) {
      return catalog.get(keyForSelection(selection))?.head.revision ?? null;
    }
  };
}
