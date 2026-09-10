# 2026-09-11 / DATA-OFFER5 capture adapter authority

- Task type: execution / capture adapter authority. Live retailer calls, Production DB queries/writes, Product binding, Product Fact Subject binding, Offer materialization, and recommendation/read-path changes are excluded.
- Baseline: fresh main `64b15d5f3a6f9eec5d30067c1fe168d67346fcb5`, after DATA-OFFER4 merged-main closure.
- Repository inspection: no Olive Young-specific live retailer parser/crawler was found on the fresh main, so this task does not invent retailer HTML selectors or response semantics.
- Authority split: transport configuration owns `seller`, `listing_url`, and `source_version`; the trusted clock owns `observed_at`; a seller parser may return only `listing_id`, `price`, and `availability`.
- Provenance anti-spoofing: parser output with `seller`, `listing_url`, `observed_at`, `source_version`, `product_id`, `product_subject_id`, `offer_id`, or any other extra field fails closed.
- Fetch boundary: static seller/listing/source authority is validated before network execution; the fetcher receives only the normalized HTTPS listing URL. If transport fails, neither clock nor parser runs and no observation is produced.
- Observation time: clock executes immediately after successful transport return and before parsing; its value must satisfy the existing offset-aware `seller_listing_observation_v1` contract.
- Output authority: final capture output is always re-admitted through `parseSellerListingObservationV1`, preserving null listing ID, null price, and `unknown` availability without inference.
- Verification: deterministic fake-fetch fixtures cover positive capture, null evidence, provenance/identity injection rejection, missing parser fields, pre-fetch unsafe URL rejection, transport failure ordering, invalid clock timestamp, and invalid availability. No external retailer or provider call is made.
- Next boundary: add one source-specific parser from an independently captured, reviewable retailer response fixture. Only after source semantics are evidenced should a live runner persist captures into `seller_listing_observations`. Product binding and Offer materialization remain later gates.
- Context promotion candidate: none.
