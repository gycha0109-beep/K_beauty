# TRUST P3 PR-A — 공식 HTML 템플릿 구조 진단 구현 (2026-10-13)

Status: implemented **metadata-only pilot**, awaiting actual governed runner evidence for template selection. Design parent: `trust-p3-template-family-adapter-design-v1.md`.

## Changed scope

- `lib/trust/official-template-shape-p3-v1.mjs`: one bounded lexical HTML scanner (2 MiB content, at most 20,000 tag tokens, at most 2,048 chars per tag, at most 512 open ancestor entries). Counts only HTML structural categories, not string values.
- `scripts/trust-p3-official-locator-revalidation.mjs`: attaches `live.templateShape` to *existing* six-locator, four-origin, robots-gated read-only probe. The source candidate/claim/variant classification is unchanged. On shape parser error, report `DIAGNOSTIC_UNAVAILABLE` without changing the P3 decision.
- `scripts/verify-trust-p3-template-shape-v1.mjs`: deterministic negative tests for PII/non-content, script/comment/template injection, nested markup, oversize, invalid Content-Type, boolean chosen controls and authority invariant.
- Canonical `trust-phase5b-7d-static.yml`: PR+push path ownership and test invocation only; no new scheduled workflow.

## Metadata retained

`templateShape` includes: contract, SHA-256 of HTML bytes, total byte and scanned tag counts, parser limit status; counts for `main`, `form`, H1, categorized `goodsDetail/productDetail/itemDetail/productDataAttribute` root markers, H1 position in main/marked root, scoped title class markers, and `select/radio/option/widget` controls with explicitly selected/check counts. Class/ID/label/HTML/option value/JSON-LD content/name/URL-param values are not retained in the new diagnostic.

`templateFamily` is deliberately `UNDETERMINED`: no family is validated from an unreviewed count. Marker counts **are not** proof of a unique primary product root or SKU and must never grant `EVIDENCE_CANDIDATE_ONLY`.

All outputs keep `exactSkuVerified=false`, `marketVerified=false`, `formulationVerified=false`, `sourceBindingAuthorized=false`, `subjectCreationAuthorized=false`, `factConfirmationAuthorized=false`, `dbWrites=0`, `aiApiCalls=0`.

## Acceptance boundaries

- Exactly the six frozen official URLs in `evidence/trust/p3-official-locator-revalidation-cohort-v1.json`.
- Exact-head P3/TRUST/PIE/Current Main/CodeQL checks before merge.
- Main merge commit may use existing explicit one-time marker `P3-LOCATOR-LIVE-TRIAL`, triggering the already-defined, time-bounded, robots-first read-only job with existing artifact name; no separate crawler, origin expansion or new scheduling.
- Check that previously measured 4 fetched + 2 blocked may vary with source availability. Report **observed** counts, no invented improvement in coverage.
- **No modifications** to P3 fact proposal approval logic, production data, product identity/alias/subject, source binding, recommendation or ranking.

## Gate into PR-B

Review run artifact and identify which first-party HTML page families have *scoped* product detail markers worth a narrowly defined parser/selector. Confirm the marker refers to a unique primary product region, rather than recommendations/reviews. If a page offers only metadata or script-side variants, retain `HOLD` and do not implement an imagined selected option. Unreachable Beauty of Joseon pages remain source-policy HOLD.

Known unrelated SCA issue (`braces` advisory allowlist expiration) is not bypassed.
