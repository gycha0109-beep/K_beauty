import {
  FACE_LAB_CANDIDATE_ATTRIBUTE_SNAPSHOT_VERSION
} from "./catalog-matcher-shadow.js";
import {
  validateFaceLabIndependentExecutionCandidate
} from "./independent-execution-candidate.js";
import {
  FACE_LAB_PRODUCT_VARIANT_AUTHORITY_VERSION,
  FACE_LAB_SHADE_PROFILE_VERSION
} from "./product-variant-authority.js";
import {
  buildFaceLabVisualTryOnAuthority
} from "./visual-try-on-authority.js";
import {
  FACE_LAB_VISUAL_TRY_ON_REFERENCE_ROLES
} from "./visual-try-on-registry.js";
import {
  OPENAI_IMAGE_EDIT_MAX_INPUT_BYTES,
  OPENAI_IMAGE_EDIT_MAX_REFERENCE_IMAGES,
  OPENAI_IMAGE_EDIT_MAX_TOTAL_INPUT_BYTES
} from "../openai-image-edit-runtime-core.js";

export const FACE_LAB_INDEPENDENT_LOOK_PREVIEW_BRIDGE_VERSION =
  "face-lab-independent-look-preview-bridge-v1";

const EVIDENCE = /^[a-z0-9][a-z0-9._-]*:[^\s]+$/i;
const SHA256 = /^[a-f0-9]{64}$/;
const ROLES = new Set(FACE_LAB_VISUAL_TRY_ON_REFERENCE_ROLES);
const MIME = new Set(["image/png", "image/jpeg", "image/webp"]);
const COLOR_SENSITIVE_SLOTS = new Set([
  "lip_color", "cheek_color", "eye_color", "iris_appearance",
  "face_highlight", "face_shadow", "complexion_even",
  "complexion_correct", "complexion_finish", "hair_color"
]);
const MAX_ASSETS_PER_SLOT = 2;

function object(value) {
  return value !== null && typeof value === "object" &&
    !Array.isArray(value);
}

function namespacedRef(value) {
  return typeof value === "string" &&
    value.length <= 240 && EVIDENCE.test(value);
}

function storageKey(value) {
  return typeof value === "string" &&
    value.length > 0 && value.length <= 240 &&
    !value.includes("\\") && !value.startsWith("/") &&
    !value.includes("://") &&
    /^[a-z0-9][a-z0-9._/-]*$/i.test(value) &&
    value.split("/").every(segment =>
      segment.length > 0 && segment !== "." && segment !== ".."
    );
}

function invalid(reason, extra = {}) {
  return {
    bridgeVersion: FACE_LAB_INDEPENDENT_LOOK_PREVIEW_BRIDGE_VERSION,
    status: "invalid",
    reason,
    previewSpec: null,
    selections: [],
    referenceManifest: [],
    authority: null,
    providerRequest: null,
    governedSourceVerified: false,
    renderReady: false,
    imageModelInvoked: false,
    ...extra
  };
}

function checkRecord(raw, candidateRef, slotKey) {
  return object(raw) &&
    raw.candidateRef === candidateRef &&
    raw.slotKey === slotKey &&
    namespacedRef(raw.assetRef) &&
    namespacedRef(raw.evidenceRef) &&
    ROLES.has(raw.role) &&
    raw.approvalState === "approved" &&
    raw.assetStatus === "active" &&
    raw.usagePermission === "virtual_try_on" &&
    raw.storageKind === "governed_blob" &&
    storageKey(raw.storageKey) &&
    MIME.has(raw.mimeType) &&
    Number.isSafeInteger(raw.byteLength) &&
    raw.byteLength > 0 &&
    raw.byteLength <= OPENAI_IMAGE_EDIT_MAX_INPUT_BYTES &&
    typeof raw.sha256 === "string" &&
    SHA256.test(raw.sha256) &&
    raw.imageBuffer === undefined &&
    raw.bytes === undefined &&
    raw.url === undefined;
}

function createBinding(checked) {
  const shade = checked.shadeProfile;
  const candidate = structuredClone(checked.candidate);
  const binding = {
    candidate,
    attributeSnapshot: {
      snapshotVersion: FACE_LAB_CANDIDATE_ATTRIBUTE_SNAPSHOT_VERSION,
      sourceVersion: shade ? FACE_LAB_SHADE_PROFILE_VERSION : "face-lab-independent-no-shade-v1",
      attributes: shade ? structuredClone(shade.attributes) : {},
      evidenceRefsByAttribute:
        shade ? structuredClone(shade.evidenceRefsByAttribute) : {}
    }
  };
  if (shade) {
    binding.candidate.metadata = {
      ...binding.candidate.metadata,
      variantAuthorityVersion: FACE_LAB_PRODUCT_VARIANT_AUTHORITY_VERSION
    };
    binding.renderHints = {
      shadeKey: shade.shadeKey,
      displayLabel: shade.displayLabel,
      colorAnchors: structuredClone(shade.colorAnchors)
    };
  }
  return binding;
}

/**
 * Offline compositing preview only.
 *
 * The input is not an authorized server projection: approval labels, source
 * refs, checksums and storage metadata remain unverified claims. We construct
 * and inspect the existing compositor's render spec but NEVER return its
 * executable "ready" authority nor any image-provider request.
 */
export function composeFaceLabIndependentLookPreview({
  sessionId,
  candidateSelections,
  referenceRecords,
  presentationPreference = null
} = {}) {
  if (
    typeof sessionId !== "string" || !sessionId.trim() ||
    sessionId.length > 160 ||
    !Array.isArray(candidateSelections) || !candidateSelections.length ||
    !Array.isArray(referenceRecords)
  ) {
    return invalid("independent_preview_inputs_invalid");
  }

  const selected = [];
  const seenSlots = new Set();
  const selectedRecords = [];
  const seenAssetRefs = new Set();
  let referenceTotalBytes = 0;

  for (const raw of candidateSelections) {
    if (!object(raw) || raw.referenceAssets !== undefined ||
        raw.binding !== undefined || raw.authority !== undefined) {
      return invalid("independent_preview_selection_untrusted");
    }

    const checked = validateFaceLabIndependentExecutionCandidate(raw);
    if (checked.status !== "contract_valid") {
      return invalid("independent_preview_candidate_invalid", {
        candidateReason: checked.reason
      });
    }
    if (checked.mode !== "visual_candidate") {
      return invalid("independent_preview_guidance_not_renderable");
    }
    if (seenSlots.has(checked.slotKey)) {
      return invalid("independent_preview_slot_duplicate");
    }
    seenSlots.add(checked.slotKey);
    if (COLOR_SENSITIVE_SLOTS.has(checked.slotKey) && !checked.shadeProfile) {
      return invalid("independent_preview_color_evidence_missing");
    }

    const ref = checked.candidate.candidateRef;
    const records = referenceRecords.filter(record =>
      object(record) && record.candidateRef === ref &&
      record.slotKey === checked.slotKey
    );

    if (!records.length || records.length > MAX_ASSETS_PER_SLOT) {
      return invalid("independent_preview_reference_count_invalid");
    }

    const descriptors = [];
    for (const record of [...records].sort((a, b) =>
      String(a.assetRef).localeCompare(String(b.assetRef)))) {
      if (!checkRecord(record, ref, checked.slotKey)) {
        return invalid("independent_preview_reference_not_governed");
      }
      if (seenAssetRefs.has(record.assetRef)) {
        return invalid("independent_preview_reference_duplicate");
      }
      seenAssetRefs.add(record.assetRef);
      referenceTotalBytes += record.byteLength;
      if (referenceTotalBytes > OPENAI_IMAGE_EDIT_MAX_TOTAL_INPUT_BYTES) {
        return invalid("independent_preview_reference_bytes_exceeded");
      }
      descriptors.push({
        assetRef: record.assetRef,
        role: record.role,
        evidenceRef: record.evidenceRef
      });
      selectedRecords.push({
        assetRef: record.assetRef,
        candidateRef: ref,
        slotKey: checked.slotKey,
        role: record.role,
        evidenceRef: record.evidenceRef,
        sha256: record.sha256,
        byteLength: record.byteLength,
        mimeType: record.mimeType
      });
    }
    selected.push({
      slotKey: checked.slotKey,
      binding: createBinding(checked),
      referenceAssets: descriptors
    });
  }

  if (
    selectedRecords.length > OPENAI_IMAGE_EDIT_MAX_REFERENCE_IMAGES ||
    selectedRecords.length !== referenceRecords.length
  ) {
    return invalid("independent_preview_reference_scope_invalid");
  }

  const composed = buildFaceLabVisualTryOnAuthority({
    sessionId,
    selections: selected,
    presentationPreference
  });
  if (composed.status !== "ready" ||
      composed.renderSpec?.status !== "ready") {
    return invalid("independent_preview_compositor_rejected", {
      compositorReason: composed.reason,
      renderSpecReason: composed.renderSpecReason ?? null
    });
  }

  // Preserve the existing compositor's deterministic slot and reference
  // ordering, but do NOT return the executable ready authority.
  const recordMap = new Map(selectedRecords.map(record => [
    record.assetRef, record
  ]));
  const referenceManifest = composed.referenceAssets.map(descriptor =>
    structuredClone(recordMap.get(descriptor.assetRef))
  );
  return {
    bridgeVersion: FACE_LAB_INDEPENDENT_LOOK_PREVIEW_BRIDGE_VERSION,
    status: "dry_run",
    reason: "independent_look_composed_offline",
    previewSpec: structuredClone(composed.renderSpec),
    selections: composed.selections.map(selection => ({
      slotKey: selection.slotKey,
      candidateRef: selection.candidateRef,
      variantId: selection.variantId,
      referenceAssetRefs: [...selection.referenceAssetRefs]
    })),
    referenceManifest,
    authority: null,
    providerRequest: null,
    governedSourceVerified: false,
    renderReady: false,
    imageModelInvoked: false
  };
}
