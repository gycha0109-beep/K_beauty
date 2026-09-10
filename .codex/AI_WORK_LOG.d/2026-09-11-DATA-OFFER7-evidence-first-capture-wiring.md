# 2026-09-11 / DATA-OFFER7 evidence-first capture wiring

- Task type: execution / evidence-first seller capture composition. Retailer-specific parsing semantics, live retailer calls, Production DB access, evidence persistence, Product binding, Product Fact Subject binding, Offer materialization, recommendation ranking, and read-path activation are excluded.
- Baseline: fresh main `d1f54d8e59c96f92c982aeab3c051fb57f755235`, after DATA-OFFER6 merged-main closure.
- DATA-OFFER6 closure: merged-main DATA-OFFER3/4/5/6 and Current Main Health all completed successfully on the baseline SHA.
- Composition contract: `seller-listing-capture-with-evidence-v1` composes DATA-OFFER5 observation authority with DATA-OFFER6 raw transport integrity authority without changing the existing DATA-OFFER5 v1 API.
- Transport boundary: injected transport must return exactly `payload_bytes` and `content_type`. Parsed seller facts and catalog identities are rejected at the transport boundary.
- Ordering: caller authority validation -> transport -> clock -> raw evidence creation -> evidence integrity revalidation -> payload decode -> parser -> parser byte-integrity recheck -> DATA-OFFER5 observation validation.
- Evidence-first rule: parser receives only bytes decoded from a successfully revalidated evidence envelope, plus the frozen evidence object as secondary provenance context.
- Mutation guard: parser receives a private byte copy. After parser completion the byte digest is recomputed; any mutation causes `seller_listing_capture_parser_mutated_payload` before an observation can be returned.
- Authority alignment: evidence and observation share normalized seller, listing URL, source version, and the exact same observation timestamp. Evidence still contains no listing_id, price, availability, product_id, product_subject_id, or offer_id.
- Compatibility: `captureSellerListingObservationV1` remains unchanged. DATA-OFFER7 is a separate composition layer.
- Verification: deterministic tests cover ordering, normalized provenance, binary and ArrayBuffer transport, null content type, exact transport fields, byte-only evidence input, invalid authority fail-before-fetch, transport/clock/parser failure boundaries, invalid timestamp fail-before-parser, forbidden Product identity in parser output, and parser payload mutation rejection.
- CI: dedicated exact-head DATA-OFFER7 workflow plus Current Main Health admission.
- Production safety: Production query/write count is zero; external retailer calls are zero; schema changes are zero.
- Next boundary: a real retailer-specific parser remains blocked until a reviewable raw fixture or equivalent admitted transport evidence exists. After such evidence exists, source-specific parser semantics can be implemented against immutable fixture bytes and only then considered for persistence/materialization wiring.
- Context promotion candidate: none.
