# 2026-09-11 / DATA-OFFER6 seller capture evidence

- Task type: execution / raw seller transport evidence authority. Retailer-specific parser semantics, live retailer calls, Production DB access, persistence wiring, Product binding, Product Fact Subject binding, Offer materialization, recommendation ranking, and read-path activation are excluded.
- Baseline: fresh main `6ff2a34ed7a81707c459e2d22db8a5dfe02e4ffc`, after DATA-OFFER5 merge closure.
- Repository evidence: no verified Olive Young-specific live parser or reviewable raw transport fixture was present on the reviewed main. DATA-OFFER6 therefore does not invent selectors or response semantics.
- Evidence contract: `seller-listing-capture-evidence-v1` serializes transport authority plus exact response bytes as canonical base64 with a computed SHA-256 digest.
- Authority fields: seller, listing URL, source version, and observation timestamp remain explicit provenance. Content type is preserved as observed transport metadata and may be null when absent.
- Byte authority: creators accept byte-oriented input only (`ArrayBuffer` or ArrayBuffer views). Strings are rejected so character encoding cannot be guessed silently. Serialized payload bytes are canonical base64.
- Integrity: `payload_sha256` is computed by trusted code from response bytes. Deserialization recomputes SHA-256 from canonical base64 and rejects digest mismatch or noncanonical base64.
- Semantics boundary: SHA-256 proves payload integrity only. It does not prove retailer truth, Product identity, price correctness, stock correctness, or source authenticity.
- Identity separation: serialized evidence contains no listing_id, price, availability, product_id, product_subject_id, or offer_id. Raw transport evidence cannot self-bind to parsed seller facts or catalog authority.
- Verification: deterministic tests cover canonical known SHA-256, binary byte round-trip, ArrayBuffer support, repeated-byte determinism, altered-byte divergence, empty payload, forbidden fact/identity fields, HTTPS provenance validation, offset-aware timestamps, byte-only input, nullable content type, canonical base64, tampered payload/digest rejection, and lowercase digest syntax.
- CI: dedicated exact-head DATA-OFFER6 workflow plus Current Main Health admission. No npm dependency or network call is required for the dedicated verifier.
- Production safety: Production query/write count is zero; external retailer calls are zero; schema changes are zero.
- Next boundary: after DATA-OFFER6 closes, wire successful transport capture to produce this evidence before a reviewed source-specific parser consumes the payload. A real retailer parser remains blocked until a reviewable source fixture or equivalent transport evidence is admitted.
- Context promotion candidate: none.
