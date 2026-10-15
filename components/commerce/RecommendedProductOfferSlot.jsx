"use client";

import ProductOfferComparison from "@/components/commerce/ProductOfferComparison";

// D8K-5: source-level mount points only. Do not turn on in this PR.
// A future reviewed server DTO, permissions test and independent owner rollout
// must precede ANY price or purchase display. Client props are never authority.
export const RECOMMENDATION_OFFER_UI_RELEASE_GATE = "OFF_PENDING_D8K5_RUNTIME_APPROVAL";
const LIVE_COMPARISON_RELEASE_ENABLED = false;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One shared placement for free Top Pick and premium product cards. */
export default function RecommendedProductOfferSlot({
  product = null, comparison = null, locale = "ko", compact = true
}) {
  if (!LIVE_COMPARISON_RELEASE_ENABLED) return null;
  const id = typeof product?.id === "string" && UUID.test(product.id)
    ? product.id.toLowerCase() : null;
  if (!id || comparison?.productId !== id ||
      comparison?.status !== "options_observed") return null;
  // This display check is NOT a server authorization or evidence verification.
  return <div className="mt-3"><ProductOfferComparison
    comparison={comparison} locale={locale} compact={compact} /></div>;
}
