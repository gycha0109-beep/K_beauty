// Browser-safe wire version check; the matching Node-only read contract is
// asserted in scripts/verify-face-lab-v2-catalog-status-presentation.mjs.
// Do not import independent-catalog-published-read-core into a client module:
// its Node crypto dependencies are intentionally server-only.
const FACE_LAB_INDEPENDENT_PUBLISHED_READ_VERSION =
  "face-lab-independent-published-read-dry-run-v1";

export const FACE_LAB_CATALOG_STATUS_PRESENTATION_VERSION =
  "face-lab-catalog-status-presentation-v1";

const COPY = Object.freeze({
  ko: {
    title: "실제 상품·색상 연결",
    notReady: "스타일 실행안은 확인할 수 있지만, 실제 구매 가능한 제품과 색상은 아직 연결되지 않았습니다.",
    sourceNotReady: "승인된 상품 정보를 현재 확인할 수 없습니다. 잘못된 제품이나 색상을 대신 보여주지 않습니다.",
    blocked: "선택한 제품이나 색상의 승인·철회 상태를 확인할 수 없어 표시하지 않았습니다."
  },
  en: {
    title: "Actual products and shades",
    notReady: "Your styling plan is available, but purchasable products and exact shades are not connected yet.",
    sourceNotReady: "Verified product sources are currently unavailable. Unverified products and shades are not shown.",
    blocked: "The selected product or shade could not pass the approval and revocation checks, so it is not shown."
  }
});

const REVOKED_OR_BLOCKED = new Set([
  "published_read_identity_mismatch",
  "published_read_duplicate_slot",
  "published_read_snapshot_not_available",
  "published_read_current_state_mismatch",
  "published_read_review_or_preview_failed",
  "published_read_composition_invalid",
  "published_read_input_invalid"
]);

/**
 * M3 product-availability UI only. The existing independent published reader
 * is strictly an OFFLINE fixture dry-run; its previewSpec, approval labels and
 * image refs must never be rendered as production merchandise or a buy CTA.
 *
 * A future verified production reader requires its own server authority and
 * explicit approval before this adapter can expose real product/shade identity.
 */
export function buildFaceLabCatalogStatusPresentation(readResult, { locale = "ko" } = {}) {
  const copy = COPY[locale === "en" ? "en" : "ko"];
  let status = "not_ready";

  if (readResult != null) {
    const recognized = readResult &&
      typeof readResult === "object" &&
      !Array.isArray(readResult) &&
      readResult.readVersion === FACE_LAB_INDEPENDENT_PUBLISHED_READ_VERSION;
    if (!recognized) {
      status = "blocked";
    } else if (readResult.status === "blocked" ||
      REVOKED_OR_BLOCKED.has(readResult.reason)) {
      status = "blocked";
    } else if (readResult.status === "unavailable") {
      status = "source_not_ready";
    } else if (readResult.status === "dry_run" &&
      readResult.reason === "mock_publication_verified" &&
      readResult.governedSourceVerified === false &&
      readResult.renderReady === false &&
      readResult.imageModelInvoked === false) {
      status = "not_ready";
    } else {
      // Unknown or contradictory authority state must not become 'ready'.
      status = "blocked";
    }
  }

  const body = status === "blocked"
    ? copy.blocked
    : status === "source_not_ready"
      ? copy.sourceNotReady
      : copy.notReady;

  return {
    version: FACE_LAB_CATALOG_STATUS_PRESENTATION_VERSION,
    status,
    title: copy.title,
    body,
    items: [],
    selectedProductId: null,
    selectedVariantId: null,
    selectedShadeId: null,
    canSelectProduct: false,
    canPurchase: false,
    displayProductImages: false,
    isRealCatalogReady: false
  };
}
