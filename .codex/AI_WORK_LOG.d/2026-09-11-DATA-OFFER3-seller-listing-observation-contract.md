# 2026-09-11 / DATA-OFFER3 seller listing observation contract

- Task type: execution / pure provenance contract. Production, external retailer calls, DB schema/migrations/RLS, Product/Offer writes, Product Fact writes, recommendation scoring, and read-path activation are excluded.
- Baseline: fresh main `e47b1674669ea85f5f639b276d7bfc8e1ccefc2d`, after DATA-OFFER2 merge closure.
- Authority boundary: `seller_listing_observation_v1` is a raw seller-listing observation only. Its root fields are exactly `seller`, `listing_id`, `listing_url`, `price`, `availability`, `observed_at`, and `source_version`.
- Product identity separation: unexpected fields fail closed. In particular `product_id`, `product_subject_id`, and `offer_id` cannot appear in the raw observation. This contract does not bind a listing to a catalog Product, Product Fact Subject, or Offer row.
- Listing identity: `seller` is required; `listing_id` is present but may be null when the source does not expose a stable ID; `listing_url` is required HTTPS and rejects credentials and fragments.
- Price provenance: `price` is either null or `{ amount, currency }`; amount must be a finite non-negative number and currency must be a three-letter code. This establishes only what the seller listing observer captured, not Product price authority.
- Availability provenance: values are limited to `unknown`, `in_stock`, `out_of_stock`, and `discontinued`. Missing evidence is represented as `unknown`, never inferred as `in_stock`.
- Observation time: `observed_at` is mandatory and offset-aware. `source_version` is mandatory so future collector/parser changes remain attributable.
- Verification: focused deterministic verifier covers the positive shape, null price, nullable listing ID, all governed availability states, Product/Subject/Offer identity injection rejection, missing observation time, unsafe listing URL forms, invalid timestamp, invalid availability, invalid price/currency, nested unexpected fields, and missing source version.
- CI: dedicated exact-head workflow uses Node 22 only and performs no dependency install, network observation, hosted query, or provider execution.
- Next boundary: separately define seller/listing observation persistence or capture adapter only after the pure contract closes. Product binding and Offer write authority remain later independent gates.
- Context promotion candidate: none.
