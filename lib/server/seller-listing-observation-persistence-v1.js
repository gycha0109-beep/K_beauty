import { parseSellerListingObservationV1 } from "../seller-listing-observation-v1.js";

export const SELLER_LISTING_OBSERVATION_PERSISTENCE_VERSION =
  "seller-listing-observation-persistence-v1";

const INSERT_FIELDS = Object.freeze([
  "seller",
  "listing_id",
  "listing_url",
  "price_amount",
  "price_currency",
  "availability",
  "observed_at",
  "source_version"
]);

export function buildSellerListingObservationInsertV1(input) {
  const observation = parseSellerListingObservationV1(input);
  const row = {
    seller: observation.seller,
    listing_id: observation.listing_id,
    listing_url: observation.listing_url,
    price_amount: observation.price?.amount ?? null,
    price_currency: observation.price?.currency ?? null,
    availability: observation.availability,
    observed_at: observation.observed_at,
    source_version: observation.source_version
  };

  if (Object.keys(row).join("\u0000") !== INSERT_FIELDS.join("\u0000")) {
    throw new Error("seller_listing_observation_persistence_shape_drift");
  }

  return Object.freeze(row);
}
