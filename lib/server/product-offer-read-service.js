import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { applyProductOfferReadPath } from "@/lib/product-offer-read-path";

const PRODUCT_OFFER_READ_FIELDS = [
  "offer_id",
  "product_id",
  "seller_key",
  "seller_name",
  "source_name",
  "listing_id",
  "listing_url",
  "price_amount",
  "currency_code",
  "availability_state",
  "market_code",
  "locale",
  "offer_state",
  "product_scope_state",
  "first_observed_at",
  "last_observed_at",
  "created_at"
].join(", ");

async function loadProductOffersByIds(productIds) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    throw new Error("product_offer_read_unavailable");
  }

  const { data, error } = await supabase
    .from("product_offers")
    .select(PRODUCT_OFFER_READ_FIELDS)
    .in("product_id", productIds);

  if (error) {
    throw new Error("product_offer_read_failed");
  }

  return Array.isArray(data) ? data : [];
}

export async function projectDecisionWithCurrentProductOffers(decision) {
  return applyProductOfferReadPath(decision, loadProductOffersByIds, {
    marketCode: "KR"
  });
}
