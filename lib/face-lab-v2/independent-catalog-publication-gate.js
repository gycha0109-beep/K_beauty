import { createHash } from "node:crypto";
import {
  inspectFaceLabCatalogReviewRecord
} from "./independent-catalog-review-state.js";
import {
  validateFaceLabIndependentExecutionCandidate
} from "./independent-execution-candidate.js";
import {
  composeFaceLabIndependentLookPreview
} from "./independent-look-preview-bridge.js";

export const FACE_LAB_INDEPENDENT_PUBLICATION_GATE_VERSION =
  "face-lab-independent-publication-gate-v1";

function object(value) {
  return value !== null && typeof value === "object" &&
    !Array.isArray(value);
}
function invalid(reason, details = {}) {
  return {
    gateVersion: FACE_LAB_INDEPENDENT_PUBLICATION_GATE_VERSION,
    status: "blocked", reason,
    previewSpec: null, reviewSummary: [], selectionCount: 0,
    authority: null, providerRequest: null,
    governedSourceVerified: false, renderReady: false,
    imageModelInvoked: false, ...details
  };
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (object(value)) {
    return Object.fromEntries(
      Object.keys(value).sort()
        .filter(key => value[key] !== undefined)
        .map(key => [key, canonical(value[key])])
    );
  }
  return value;
}

/** Deterministic shape fingerprint, NOT a cryptographic proof of provenance. */
export function fingerprintFaceLabReviewSource({
  scope, targetRef, source
} = {}) {
  if (typeof scope !== "string" ||
      typeof targetRef !== "string" || !object(source)) {
    return null;
  }
  try {
    const serial = JSON.stringify(canonical({ scope, targetRef, source }));
    if (!serial) return null;
    return createHash("sha256").update(serial).digest("hex");
  } catch {
    return null;
  }
}
function requiredSource(scope, targetRef, source) {
  return {
    scope, targetRef,
    digest: fingerprintFaceLabReviewSource({ scope, targetRef, source })
  };
}
function targetForItem(item) {
  return "face_lab_item:" + item.kind + ":" + item.faceLabItemId;
}
function targetForCapability(candidateRef, slotKey) {
  return "face_lab_capability:" + candidateRef + ":" + slotKey;
}
function targetForShade(candidateRef) {
  return "face_lab_shade:" + candidateRef;
}
function targetForAsset(assetRef) {
  return "face_lab_asset:" + assetRef;
}

/**
 * Offline review gate. A forged publication ledger can pass this function:
 * live authority requires a trusted server read, real reviewer authorization,
 * current revocation checking, and image license/hash validation.
 *
 * This function NEVER returns an executable authority or a provider request.
 */
export function composeFaceLabReviewedLookDryRun(input = {}) {
  const {
    sessionId, candidateSelections, referenceRecords, reviewRecords,
    presentationPreference = null
  } = object(input) ? input : {};

  if (!Array.isArray(candidateSelections) ||
      candidateSelections.length === 0 ||
      !Array.isArray(referenceRecords) ||
      !Array.isArray(reviewRecords) || reviewRecords.length === 0) {
    return invalid("review_gate_inputs_invalid");
  }

  const reviews = new Map();
  for (const record of reviewRecords) {
    const inspected = inspectFaceLabCatalogReviewRecord(record);
    if (!inspected.valid) {
      return invalid("review_gate_record_invalid", {
        reviewReason: inspected.reason
      });
    }
    const key = record.scope + "|" + record.targetRef;
    if (reviews.has(key)) return invalid("review_gate_duplicate_record");
    reviews.set(key, record);
  }

  const required = new Map();
  for (const raw of candidateSelections) {
    if (!object(raw) || raw.referenceAssets !== undefined ||
        raw.binding !== undefined || raw.authority !== undefined) {
      return invalid("review_gate_untrusted_selection");
    }
    const checked = validateFaceLabIndependentExecutionCandidate(raw);
    if (checked.status !== "contract_valid") {
      return invalid("review_gate_candidate_invalid", {
        candidateReason: checked.reason
      });
    }
    if (checked.mode !== "visual_candidate") {
      return invalid("review_gate_guidance_not_renderable");
    }

    const candidateRef = checked.candidate.candidateRef;
    const itemRef = targetForItem(raw.item);
    const claims = [
      requiredSource("item", itemRef, { item: raw.item }),
      requiredSource("capability",
        targetForCapability(candidateRef, raw.slotKey), {
          candidateRef, slotKey: raw.slotKey,
          capabilityClaims: raw.capabilityClaims
        })
    ];
    if (raw.item.kind === "product") {
      claims.push(requiredSource("variant", candidateRef, {
        variant: raw.variant
      }));
    }
    if (checked.shadeProfile) {
      claims.push(requiredSource("shade",
        targetForShade(candidateRef), {
          shadeProfile: raw.variant.shadeProfile
        }));
    }
    for (const review of claims) {
      const key = review.scope + "|" + review.targetRef;
      if (!review.digest || (required.has(key) &&
          required.get(key).digest !== review.digest)) {
        return invalid("review_gate_conflicting_evidence");
      }
      required.set(key, review);
    }
  }

  for (const asset of referenceRecords) {
    if (!object(asset) || typeof asset.assetRef !== "string") {
      return invalid("review_gate_reference_invalid");
    }
    const claim = requiredSource("asset",
      targetForAsset(asset.assetRef), { asset });
    if (!claim.digest) return invalid("review_gate_reference_invalid");
    const key = claim.scope + "|" + claim.targetRef;
    if (required.has(key)) return invalid("review_gate_duplicate_asset");
    required.set(key, claim);
  }

  // Reject unrelated review records as well as missing ones. All approvals
  // must refer to exactly the chosen candidates and reference descriptors.
  if (reviews.size !== required.size) {
    return invalid("review_gate_review_scope_mismatch");
  }

  const summary = [];
  for (const [key, claim] of required) {
    const record = reviews.get(key);
    if (!record) return invalid("review_gate_review_missing");
    if (record.status !== "published" ||
        record.approvedContentRevision !== record.contentRevision ||
        record.publishedContentRevision !== record.contentRevision ||
        !record.reviewedEvidenceRefs.length) {
      return invalid("review_gate_not_published", {
        blockedScope: claim.scope
      });
    }
    if (record.sourceDigest !== claim.digest) {
      return invalid("review_gate_content_changed", {
        blockedScope: claim.scope
      });
    }
    summary.push({
      scope: record.scope,
      targetRef: record.targetRef,
      contentRevision: record.contentRevision,
      recordRevision: record.revision,
      revocationEpoch: record.revocationEpoch
    });
  }

  const preview = composeFaceLabIndependentLookPreview({
    sessionId, candidateSelections, referenceRecords, presentationPreference
  });
  if (preview.status !== "dry_run") {
    return invalid("review_gate_preview_blocked", {
      previewReason: preview.reason
    });
  }
  return {
    gateVersion: FACE_LAB_INDEPENDENT_PUBLICATION_GATE_VERSION,
    status: "dry_run",
    reason: "offline_published_claims_and_compositor_valid",
    previewSpec: preview.previewSpec,
    selections: preview.selections,
    referenceManifest: preview.referenceManifest,
    selectionCount: preview.selections.length,
    reviewSummary: summary.sort((a, b) =>
      a.scope.localeCompare(b.scope) ||
      a.targetRef.localeCompare(b.targetRef)),
    authority: null,
    providerRequest: null,
    governedSourceVerified: false,
    renderReady: false,
    imageModelInvoked: false
  };
}
