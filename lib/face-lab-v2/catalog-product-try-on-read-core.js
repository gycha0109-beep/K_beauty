import {
  getFaceLabVisualTryOnSlotSupport
} from "./visual-try-on-registry.js";
import {
  buildFaceLabCatalogProductTryOnSelection
} from "./catalog-product-try-on-binding.js";

export const FACE_LAB_CATALOG_TRY_ON_READ_VERSION =
  "face-lab-catalog-try-on-read-v1";

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const VARIANT_ID = /^[a-z0-9][a-z0-9._-]{0,159}$/;

function result(status, reason, extra = {}) {
  return {
    readVersion: FACE_LAB_CATALOG_TRY_ON_READ_VERSION,
    status,
    reason,
    selection: null,
    imageModelInvoked: false,
    ...extra
  };
}

/**
 * P1-D read boundary. The user supplies only identifiers. Product identity
 * comes from an existing catalog read, and all other authorities must come
 * from a separately approved server-only projection. No shadow fallback.
 *
 * This module never calls a database, storage provider, or image model itself.
 */
export async function resolveFaceLabCatalogTryOnRead({
  request,
  lookupCatalogProduct,
  readApprovedTryOnBundle
} = {}) {
  const productId = request?.productId;
  const variantId = request?.variantId;
  const slotKey = request?.slotKey;

  if (
    typeof productId !== "string" || !UUID.test(productId) ||
    typeof variantId !== "string" || !VARIANT_ID.test(variantId) ||
    typeof slotKey !== "string" ||
    getFaceLabVisualTryOnSlotSupport(slotKey)?.supportState !== "supported"
  ) {
    return result("invalid", "catalog_try_on_request_invalid");
  }
  if (typeof lookupCatalogProduct !== "function") {
    return result("unavailable", "catalog_product_reader_unavailable");
  }

  let product;
  try {
    product = await lookupCatalogProduct(productId);
  } catch {
    return result("unavailable", "catalog_product_read_failed");
  }
  if (product == null) {
    return result("unsupported", "catalog_product_not_found");
  }
  if (product?.id !== productId) {
    return result("unavailable", "catalog_product_identity_mismatch");
  }

  // Existing public catalog reads do NOT confer Subject/Taxonomy authority.
  if (typeof readApprovedTryOnBundle !== "function") {
    return result("unavailable", "approved_try_on_projection_unavailable");
  }

  let bundle;
  try {
    bundle = await readApprovedTryOnBundle(Object.freeze({
      productId,
      variantId,
      slotKey
    }));
  } catch {
    return result("unavailable", "approved_try_on_projection_read_failed");
  }
  if (!bundle || typeof bundle !== "object" || Array.isArray(bundle)) {
    return result("unsupported", "approved_try_on_projection_missing");
  }
  if (
    bundle.product?.id !== productId ||
    bundle.subject?.product_id !== productId ||
    bundle.subjectVariantBridge?.productId !== productId ||
    bundle.subjectVariantBridge?.subjectId !== bundle.subject?.subject_id ||
    bundle.subjectVariantBridge?.variantId !== variantId ||
    bundle.variant?.variantId !== variantId ||
    bundle.slotKey !== slotKey
  ) {
    return result("unsupported", "approved_try_on_projection_identity_mismatch");
  }

  const binding = buildFaceLabCatalogProductTryOnSelection(bundle);
  if (binding.status !== "ready") {
    return result("unsupported", binding.reason);
  }
  return result("ready", "approved_catalog_product_bound", {
    selection: binding.selection,
    productId: binding.productId,
    subjectId: binding.subjectId,
    variantRef: binding.variantRef,
    slotKey: binding.slotKey,
    taxonomyVersion: binding.taxonomyVersion,
    mappingVersion: binding.mappingVersion
  });
}
