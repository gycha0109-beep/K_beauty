import {
  createFaceLabProductVariantRef
} from "./product-variant-authority.js";
import {
  bindFaceLabCatalogTryOnReferences,
  prepareFaceLabCatalogTryOnReferences
} from "./catalog-reference-resolver.js";
import {
  FACE_LAB_VISUAL_TRY_ON_SUPPORTED_SLOT_KEYS,
  getFaceLabVisualTryOnSlotSupport
} from "./visual-try-on-registry.js";

export const FACE_LAB_TRY_ON_CATALOG_READ_BRIDGE_VERSION =
  "face-lab-try-on-catalog-read-bridge-v1";

const UUID =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const MAX_ASSET_CANDIDATES =
  FACE_LAB_VISUAL_TRY_ON_SUPPORTED_SLOT_KEYS.length * 8;

function plain(value) {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null);
}

function string(value) {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : null;
}

function invalid(reason) {
  return {
    bridgeVersion: FACE_LAB_TRY_ON_CATALOG_READ_BRIDGE_VERSION,
    status: "invalid",
    reason,
    actorId: null,
    authority: null,
    catalogAssets: [],
    provenance: [],
    renderSpec: null,
    referenceManifest: [],
    imageModelInvoked: false
  };
}

function normalizeRequests(requests) {
  if (
    !Array.isArray(requests) ||
    !requests.length ||
    requests.length > FACE_LAB_VISUAL_TRY_ON_SUPPORTED_SLOT_KEYS.length
  ) {
    return null;
  }
  const seen = new Set();
  const normalized = [];
  for (const request of requests) {
    if (
      !plain(request) ||
      Object.keys(request).some(k =>
        !["productId", "subjectId", "slotKey"].includes(k)
      )
    ) {
      return null;
    }
    const productId = string(request.productId);
    const subjectId = string(request.subjectId);
    const slotKey = string(request.slotKey);
    if (
      !productId || !UUID.test(productId) ||
      !subjectId || !UUID.test(subjectId) ||
      !slotKey ||
      seen.has(slotKey) ||
      getFaceLabVisualTryOnSlotSupport(slotKey)?.supportState !== "supported"
    ) {
      return null;
    }
    seen.add(slotKey);
    normalized.push({ productId, subjectId, slotKey });
  }
  return normalized.sort((a, b) =>
    a.slotKey.localeCompare(b.slotKey)
  );
}

/**
 * Host application MUST authenticate the viewer before passing actorId.
 * The injected readers MUST enforce viewer-scoped authorization and return
 * an authorization envelope for the exact requested identities.
 *
 * No raw tables, RPC, storage bucket, secrets or public URL are read here.
 */
export async function resolveFaceLabTryOnCatalogRead({
  actorId,
  sessionId,
  requests,
  readAuthorizedSelection,
  readAuthorizedAssets
} = {}) {
  if (!string(actorId) || !UUID.test(actorId)) {
    return invalid("actor_identity_required");
  }
  if (!string(sessionId) || sessionId.length > 160) {
    return invalid("session_id_invalid");
  }
  const normalized = normalizeRequests(requests);
  if (
    !normalized ||
    typeof readAuthorizedSelection !== "function" ||
    typeof readAuthorizedAssets !== "function"
  ) {
    return invalid("catalog_read_contract_invalid");
  }

  const selections = [];
  for (const request of normalized) {
    let reply;
    try {
      reply = await readAuthorizedSelection(Object.freeze({
        actorId,
        productId: request.productId,
        subjectId: request.subjectId,
        slotKey: request.slotKey
      }));
    } catch {
      return invalid("catalog_selection_read_unavailable");
    }
    const candidate = reply?.selection;
    if (
      !plain(reply) ||
      reply.contractVersion !== FACE_LAB_TRY_ON_CATALOG_READ_BRIDGE_VERSION ||
      reply.status !== "authorized" ||
      reply.actorId !== actorId ||
      !plain(candidate) ||
      candidate.product?.id !== request.productId ||
      candidate.subject?.subject_id !== request.subjectId ||
      candidate.subject?.product_id !== request.productId ||
      candidate.slotKey !== request.slotKey ||
      candidate.referenceAssets !== undefined
    ) {
      return invalid("catalog_selection_authorization_mismatch");
    }
    selections.push(candidate);
  }

  let assetsReply;
  try {
    assetsReply = await readAuthorizedAssets(Object.freeze({
      actorId,
      selectedVariants: Object.freeze(
        selections.map(selection => Object.freeze({
          productId: selection.product.id,
          subjectId: selection.subject.subject_id,
          variantKey: selection.subject.variant_key,
          slotKey: selection.slotKey
        }))
      )
    }));
  } catch {
    return invalid("catalog_assets_read_unavailable");
  }
  if (
    !plain(assetsReply) ||
    assetsReply.contractVersion !== FACE_LAB_TRY_ON_CATALOG_READ_BRIDGE_VERSION ||
    assetsReply.status !== "authorized" ||
    assetsReply.actorId !== actorId ||
    !Array.isArray(assetsReply.assets) ||
    assetsReply.assets.length > MAX_ASSET_CANDIDATES
  ) {
    return invalid("catalog_assets_authorization_mismatch");
  }
  const allowed = new Set(selections.map(selection => {
    const ref = createFaceLabProductVariantRef({
      productId: selection.product.id,
      variantId: selection.subject.variant_key
    });
    return `${ref ?? "invalid"}|${selection.slotKey}`;
  }));
  for (const asset of assetsReply.assets) {
    if (
      !plain(asset) ||
      !allowed.has(`${asset.candidateRef}|${asset.slotKey}`)
    ) {
      return invalid("catalog_assets_scope_violation");
    }
  }

  const bound = bindFaceLabCatalogTryOnReferences({
    sessionId,
    productSelections: selections,
    catalogAssets: assetsReply.assets
  });
  if (bound.status !== "ready") {
    return invalid(bound.reason);
  }

  return {
    bridgeVersion: FACE_LAB_TRY_ON_CATALOG_READ_BRIDGE_VERSION,
    status: "ready",
    reason: "authorized_catalog_read_bound",
    actorId,
    authority: bound.authority,
    catalogAssets: bound.catalogAssets,
    provenance: bound.provenance,
    renderSpec: bound.authority.renderSpec,
    referenceManifest: [],
    imageModelInvoked: false
  };
}

/**
 * Private server-only preparation step. The loader must check the actor's
 * access to the governed object on every invocation. Never send its return
 * value, which includes image bytes, to a browser or persist it in logs.
 */
export async function prepareFaceLabTryOnCatalogRead({
  resolved,
  sourceImageBuffer,
  sourceMimeType,
  loadAuthorizedBlob
} = {}) {
  if (
    !plain(resolved) ||
    resolved.status !== "ready" ||
    resolved.bridgeVersion !== FACE_LAB_TRY_ON_CATALOG_READ_BRIDGE_VERSION ||
    !string(resolved.actorId) ||
    !UUID.test(resolved.actorId) ||
    typeof loadAuthorizedBlob !== "function"
  ) {
    return invalid("catalog_preparation_contract_invalid");
  }
  const prepared = await prepareFaceLabCatalogTryOnReferences({
    authority: resolved.authority,
    catalogAssets: resolved.catalogAssets,
    sourceImageBuffer,
    sourceMimeType,
    loadApprovedBlob: async metadata => loadAuthorizedBlob(Object.freeze({
      ...metadata,
      actorId: resolved.actorId
    }))
  });
  if (prepared.status !== "ready") {
    return invalid(prepared.reason);
  }
  return {
    bridgeVersion: FACE_LAB_TRY_ON_CATALOG_READ_BRIDGE_VERSION,
    status: "ready",
    reason: "authorized_reference_request_prepared",
    actorId: resolved.actorId,
    authority: resolved.authority,
    catalogAssets: resolved.catalogAssets,
    provenance: resolved.provenance,
    renderSpec: resolved.renderSpec,
    referenceManifest: prepared.referenceManifest,
    providerRequest: prepared.providerRequest,
    imageModelInvoked: false
  };
}
