# 2026-09-11 / DATA-OFFER8 parser fixture admission

- Task type: execution / seller parser fixture provenance admission. Retailer-specific parsing semantics, live retailer calls, Production DB access, Product binding, Product Fact Subject binding, Offer materialization, recommendation ranking, and read-path activation are excluded.
- Baseline: fresh main `cef8a05a333b56f4244fc2d1295200230c97a52c`, after TRUST-P8 #421 advanced main on top of DATA-OFFER7.
- Repository evidence: current crawler contains `oliveyoung.co.kr` route identity rules (`goodsNo` -> seller `oliveyoung`) but no verified Olive Young raw response fixture or source-specific price/availability parser. Existing DATA-OFFER5/7 verifier payloads are synthetic test data and are not retailer evidence.
- Fixture contract: `seller_listing_parser_fixture_v1` wraps a DATA-OFFER6 evidence envelope with an explicit `provenance_class` of exactly `synthetic_test` or `captured_source`.
- Parser admission: `synthetic_test` fixtures are parseable for contract tests but are fail-closed for parser-source admission. Only `captured_source` may pass `admitSellerListingParserFixtureV1`.
- Integrity: admission reuses DATA-OFFER6 canonical base64 and SHA-256 verification. Captured-source fixtures with empty payloads are rejected for parser admission.
- Authority boundary: `captured_source` is a review-time provenance assertion, not cryptographic proof of retailer truth or source authenticity. SHA-256 proves byte integrity only. A PR adding real captured evidence must still be reviewed for source provenance and sensitive/copyrighted content before parser semantics are admitted.
- Identity separation: fixture root fields are exactly schema_version, provenance_class, evidence. Product ID, Product Subject ID, Offer ID, price, and availability cannot be added at the fixture root; DATA-OFFER6 evidence remains Product-agnostic.
- Checked-in data: no real retailer fixture is added by DATA-OFFER8. The verifier uses mechanical bytes only to test the contract and does not constitute source evidence.
- Verification: deterministic tests cover synthetic rejection, captured-class mechanical admission, byte decode, exact root fields, invalid provenance/schema, tampered digest rejection, empty captured payload rejection, and Product identity injection rejection.
- CI: dedicated exact-head DATA-OFFER8 workflow plus Current Main Health admission.
- Production safety: Production query/write count is zero; external retailer calls are zero; schema changes are zero.
- Next boundary: obtain or intentionally capture one reviewable source evidence artifact through the DATA-OFFER6/7 boundary. Only after that artifact is admitted as `captured_source` should an Olive Young parser for listing_id/price/availability be implemented against immutable bytes.
- Context promotion candidate: none.
