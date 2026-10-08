import { createHash } from "node:crypto";
import {
  createFaceLabProductVariantRef
} from "./product-variant-authority.js";
import {
  FACE_LAB_VISUAL_TRY_ON_AUTHORITY_VERSION
} from "./visual-try-on-authority.js";
import {
  FACE_LAB_VISUAL_TRY_ON_REFERENCE_ROLES
} from "./visual-try-on-registry.js";
import {
  buildFaceLabCatalogProductTryOnAuthority
} from "./catalog-product-try-on-binding.js";
import {
  buildFaceLabVisualTryOnProviderRequest
} from "./visual-try-on-service-core.js";
import {
  OPENAI_IMAGE_EDIT_MAX_INPUT_BYTES,
  OPENAI_IMAGE_EDIT_MAX_REFERENCE_IMAGES,
  OPENAI_IMAGE_EDIT_MAX_TOTAL_INPUT_BYTES
} from "../openai-image-edit-runtime-core.js";

export const FACE_LAB_CATALOG_REFERENCE_RESOLVER_VERSION =
  "face-lab-catalog-reference-resolver-v1";

const ROLES = new Set(FACE_LAB_VISUAL_TRY_ON_REFERENCE_ROLES);
const EVIDENCE_REF = /^[a-z0-9][a-z0-9._-]*:[^\s]+$/i;
const SHA256 = /^[a-f0-9]{64}$/;
const MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const ROLE_PRIORITY = Object.freeze({
  applied_reference: 0,
  wearing_reference: 1,
  brand_swatch: 2,
  merchant_swatch: 3,
  product_image: 4,
  style_reference: 5
});

function nonempty(value) {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : null;
}

function invalid(reason) {
  return {
    resolverVersion: FACE_LAB_CATALOG_REFERENCE_RESOLVER_VERSION,
    status: "invalid",
    reason,
    authority: null,
    referenceManifest: [],
    resolvedReferenceImages: [],
    providerRequest: null,
    imageModelInvoked: false
  };
}

function validStorageKey(key) {
  if (
    !nonempty(key) ||
    key.length > 240 ||
    key.includes("\\") ||
    key.startsWith("/") ||
    /:\/\//.test(key) ||
    !/^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(key)
  ) {
    return false;
  }
  const segments = key.split("/");
  return segments.every(segment =>
    segment !== "" && segment !== "." && segment !== ".."
  );
}

function validReferenceRecord(record) {
  return Boolean(
    record &&
    typeof record === "object" &&
    !Array.isArray(record) &&
    nonempty(record.assetRef) &&
    EVIDENCE_REF.test(record.assetRef) &&
    nonempty(record.evidenceRef) &&
    EVIDENCE_REF.test(record.evidenceRef) &&
    nonempty(record.candidateRef) &&
    nonempty(record.slotKey) &&
    ROLES.has(record.role) &&
    record.approvalState === "approved" &&
    record.assetStatus === "active" &&
    record.usagePermission === "virtual_try_on" &&
    record.storageKind === "governed_blob" &&
    validStorageKey(record.storageKey) &&
    MIME_TYPES.has(record.mimeType) &&
    Number.isSafeInteger(record.byteLength) &&
    record.byteLength > 0 &&
    record.byteLength <= OPENAI_IMAGE_EDIT_MAX_INPUT_BYTES &&
    typeof record.sha256 === "string" &&
    SHA256.test(record.sha256)
  );
}

function signatureMatches(bytes, mimeType) {
  if (mimeType === "image/png") {
    return bytes.length >= 8 &&
      bytes.subarray(0, 8).equals(
        Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])
      );
  }
  if (mimeType === "image/jpeg") {
    return bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff;
  }
  if (mimeType === "image/webp") {
    return bytes.length >= 12 &&
      bytes.toString("ascii", 0, 4) === "RIFF" &&
      bytes.toString("ascii", 8, 12) === "WEBP";
  }
  return false;
}

function sortedRecords(records) {
  return [...records].sort((a, b) =>
    (ROLE_PRIORITY[a.role] ?? 99) - (ROLE_PRIORITY[b.role] ?? 99) ||
    a.assetRef.localeCompare(b.assetRef)
  );
}

/**
 * Resolve a user-selected Product/Variant into governed catalog descriptors.
 * Caller supplies an authorized catalog-read projection; this adapter does not
 * read DB tables, scrape images, fetch URLs, or invent reference evidence.
 */
export function bindFaceLabCatalogTryOnReferences({
  sessionId,
  productSelections,
  catalogAssets,
  presentationPreference = null
} = {}) {
  if (
    !Array.isArray(productSelections) ||
    !productSelections.length ||
    !Array.isArray(catalogAssets)
  ) {
    return invalid("catalog_reference_inputs_invalid");
  }
  if (
    catalogAssets.some(record =>
      !record || typeof record !== "object" || Array.isArray(record)
    )
  ) {
    return invalid("catalog_reference_records_invalid");
  }

  const seenRefs = new Set();
  const enrichedSelections = [];
  const selectedAssets = [];

  for (const raw of productSelections) {
    if (
      !raw || typeof raw !== "object" ||
      (raw.referenceAssets !== undefined &&
        (!Array.isArray(raw.referenceAssets) ||
          raw.referenceAssets.length !== 0))
    ) {
      return invalid("unreviewed_reference_descriptors_forbidden");
    }

    const candidateRef = createFaceLabProductVariantRef({
      productId: raw.product?.id,
      variantId: raw.variant?.variantId
    });
    if (!candidateRef || !nonempty(raw.slotKey)) {
      return invalid("catalog_selection_identity_invalid");
    }

    const matches = catalogAssets.filter(record =>
      record.candidateRef === candidateRef &&
      record.slotKey === raw.slotKey
    );

    if (!matches.length) {
      return invalid("catalog_reference_unavailable");
    }
    if (matches.some(record => !validReferenceRecord(record))) {
      return invalid("catalog_reference_not_governed");
    }

    const chosen = sortedRecords(matches).slice(0, 2);
    for (const record of chosen) {
      if (seenRefs.has(record.assetRef)) {
        return invalid("catalog_reference_asset_ref_duplicate");
      }
      seenRefs.add(record.assetRef);
      selectedAssets.push(record);
    }
    enrichedSelections.push({
      ...raw,
      referenceAssets: chosen.map(record => ({
        assetRef: record.assetRef,
        role: record.role,
        evidenceRef: record.evidenceRef
      }))
    });
  }

  if (selectedAssets.length > OPENAI_IMAGE_EDIT_MAX_REFERENCE_IMAGES) {
    return invalid("catalog_reference_count_exceeded");
  }

  const bound = buildFaceLabCatalogProductTryOnAuthority({
    sessionId,
    productSelections: enrichedSelections,
    presentationPreference
  });

  if (bound.status !== "ready") {
    return invalid(bound.reason);
  }
  return {
    resolverVersion: FACE_LAB_CATALOG_REFERENCE_RESOLVER_VERSION,
    status: "ready",
    reason: "catalog_reference_descriptors_bound",
    authority: bound.authority,
    provenance: bound.provenance,
    catalogAssets: selectedAssets.map(record => ({ ...record })),
    referenceManifest: [],
    resolvedReferenceImages: [],
    providerRequest: null,
    imageModelInvoked: false
  };
}

/**
 * A server-injected, access-controlled blob loader supplies bytes.
 * A URL is never accepted as a load target. No paid provider is invoked.
 */
export async function prepareFaceLabCatalogTryOnReferences({
  authority,
  catalogAssets,
  sourceImageBuffer,
  sourceMimeType,
  loadApprovedBlob
} = {}) {
  if (
    authority?.status !== "ready" ||
    authority.authorityVersion !== FACE_LAB_VISUAL_TRY_ON_AUTHORITY_VERSION ||
    !Array.isArray(authority.referenceAssets)
  ) {
    return invalid("visual_try_on_authority_invalid");
  }
  if (
    !Buffer.isBuffer(sourceImageBuffer) ||
    !sourceImageBuffer.length ||
    sourceImageBuffer.length > OPENAI_IMAGE_EDIT_MAX_INPUT_BYTES ||
    !signatureMatches(sourceImageBuffer, sourceMimeType)
  ) {
    return invalid("source_image_invalid");
  }
  if (!Array.isArray(catalogAssets) ||
    typeof loadApprovedBlob !== "function") {
    return invalid("reference_resolver_inputs_invalid");
  }
  if (
    authority.referenceAssets.length < 1 ||
    authority.referenceAssets.length > OPENAI_IMAGE_EDIT_MAX_REFERENCE_IMAGES ||
    catalogAssets.length !== authority.referenceAssets.length
  ) {
    return invalid("catalog_reference_count_mismatch");
  }

  const recordByRef = new Map();
  for (const record of catalogAssets) {
    if (!validReferenceRecord(record)) {
      return invalid("catalog_reference_not_governed");
    }
    if (recordByRef.has(record.assetRef)) {
      return invalid("catalog_reference_asset_ref_duplicate");
    }
    recordByRef.set(record.assetRef, record);
  }

  const ordered = [];
  let totalBytes = sourceImageBuffer.length;
  for (const descriptor of authority.referenceAssets) {
    const record = recordByRef.get(descriptor.assetRef);
    if (!record) {
      return invalid("catalog_reference_missing");
    }
    if (
      record.candidateRef !== descriptor.candidateRef ||
      record.slotKey !== descriptor.slotKey ||
      record.role !== descriptor.role ||
      record.evidenceRef !== descriptor.evidenceRef
    ) {
      return invalid("catalog_reference_binding_mismatch");
    }
    totalBytes += record.byteLength;
    if (totalBytes > OPENAI_IMAGE_EDIT_MAX_TOTAL_INPUT_BYTES) {
      return invalid("catalog_reference_total_bytes_exceeded");
    }
    ordered.push(record);
  }

  const resolvedReferenceImages = [];
  const referenceManifest = [];
  for (const record of ordered) {
    let bytes;
    try {
      bytes = await loadApprovedBlob(Object.freeze({
        assetRef: record.assetRef,
        storageKey: record.storageKey,
        sha256: record.sha256,
        mimeType: record.mimeType,
        byteLength: record.byteLength
      }));
    } catch {
      return invalid("catalog_reference_blob_unavailable");
    }
    if (!Buffer.isBuffer(bytes) ||
      bytes.length !== record.byteLength ||
      !signatureMatches(bytes, record.mimeType) ||
      createHash("sha256").update(bytes).digest("hex") !== record.sha256) {
      return invalid("catalog_reference_blob_integrity_failed");
    }
    resolvedReferenceImages.push({
      assetRef: record.assetRef,
      mimeType: record.mimeType,
      imageBuffer: bytes
    });
    referenceManifest.push({
      assetRef: record.assetRef,
      candidateRef: record.candidateRef,
      slotKey: record.slotKey,
      role: record.role,
      evidenceRef: record.evidenceRef,
      sha256: record.sha256,
      byteLength: record.byteLength,
      mimeType: record.mimeType
    });
  }

  const providerRequest = buildFaceLabVisualTryOnProviderRequest({
    authority,
    resolvedReferenceImages
  });
  if (providerRequest.status !== "ready") {
    return invalid("reference_provider_request_unavailable");
  }
  return {
    resolverVersion: FACE_LAB_CATALOG_REFERENCE_RESOLVER_VERSION,
    status: "ready",
    reason: "catalog_reference_provider_request_prepared",
    authority,
    referenceManifest: providerRequest.referenceManifest.map(item => ({
      ...item,
      evidenceRef: referenceManifest.find(record =>
        record.assetRef === item.assetRef
      )?.evidenceRef
    })),
    resolvedReferenceImages,
    providerRequest,
    imageModelInvoked: false
  };
}
