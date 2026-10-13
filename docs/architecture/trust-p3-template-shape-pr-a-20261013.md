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


## PR-A exact-main live acceptance (2026-10-13)

Main merge `e14cef3c9e570bc8ef8f5e30896701eef6336495` (PR #1273), [official source run #38351753272](https://github.com/gycha0109-beep/K_beauty/actions/runs/38351753272), job `115145490366` successful, artifact `11790653317`. Frozen bounded measurements: `evidence/trust/p3-template-shape-live-20261013.json`.

Measured unchanged 4/6 HTML fetched, 2/6 source blocked, **0/6 P3 review candidates**, **0 exact SKUs verified**. Subject/Fact/source/DB/recommendation/AI writes = 0.

Torriden both tested HTML pages returned `scanStatus=COMPLETE`, `mainCount=0`, `goodsDetail=2`, `itemDetail=3`, `scopedNameClass=1`, `select=1`, `option=5`, `explicitSelectedOption=0`. These **are structural markers only**, and two goods-detail counts are **not** a unique primary root. Do not use these counts to approve even the alternate URL.

Aestura KR and international pages each stopped the diagnostic scanner with `MALFORMED_OR_OVERSIZED_TAG` at tag 488 and 1002 respectively. Subsequent **zero counters do not prove absence** of root or variant controls; the current parser has a 2,048-char-per-tag limit and the error may be an oversized tag or malformed markup. First implement bounded skip/provenance *while leaving identity/size gates unchanged*, then independently verify the true primary root and selected variant. Beauty of Joseon remained `SOURCE_BLOCKED` and must remain policy HOLD.

**Exit**: PR-A scanner delivered and live observability established. **PR-B entry BLOCKED** for Aestura until an overflow-safe structural diagnostic is verified, and for Torriden until unique primary root can be established from markup rather than matching incidental names. No authority relaxation.


## PR-A.1: diagnostic continuation over long tags (follow-on, policy unchanged)

Aestura official pages stopped scanning at the original 2,048-character tag limit in live PR-A. The scanner now uses a quote-aware bound of **128 KiB per HTML tag** *only* to find the matching unquoted closing `>`. For each tag longer than 2,048 characters, **its attributes/selector markers are deliberately ignored**, the tag-name structural ancestor is tracked, and scanning proceeds to later content. If any tag was skipped, the result is `COMPLETE_WITH_SKIPPED_OVERSIZED_TAGS`, `countsComplete=false`, and bounded `oversizedTagCount`. All counters are lower bounds; no root/variant absence or identity conclusion may be drawn from zero values. A tag beyond 128 KiB returns `TAG_SCAN_LIMIT_REACHED`, and more than 128 long tags returns `OVERSIZED_TAG_COUNT_LIMIT_REACHED`, both non-authoritative. Existing 2 MiB total source response limit, 20,000-tag limit and 512-nesting limit remain.

The change touches **only the diagnostic** and its deterministic tests; no source, SKU, Subject, Fact, recommendation or existing P3 review candidate logic is modified. Tests inject fake HTML inside huge quoted attributes and check no secret/HTML/option text leaks, that normal subsequent tags are counted, that long selected options are never inferred as selected, and that both length/count limits terminate safely.

A real robots-gated fixed six-locator run is needed before claiming Aestura template visibility improved; even a structurally complete result does not establish official variant selection or a unique primary product root.


## PR-A.2 measured limitation and bounded 512 KiB follow-up

Live [workflow #38354149646](https://github.com/gycha0109-beep/K_beauty/actions/runs/38354149646) on merged PR #1275 (`049a4970b6fc7df170b74c5e8f64ae2da046450e`, artifact `11792306105`) again fetched 4/6 and blocked 2/6, with 0 P3 candidate approvals. **Aestura international** recovered after skipping one oversized tag: `main=1`, `productDataAttribute=1`, `h1WithinMarkedRoot=1`, **selected variants not observed**. This is a *structural lead*, not proof of the displayed product title/variant. **Aestura KR** still hit `TAG_SCAN_LIMIT_REACHED` at a markup tag extending beyond the 128 KiB quote-aware bound. Both Torriden pages remained structurally complete (`main=0`, several goods/item-detail markers), no unique root confirmed.

Because full official page responses are capped at 2 MiB, the follow-up raises the bounded quote-aware **skip-only** tag scan ceiling from 128 to 512 KiB, retaining the same 2 KiB attribute-inspection cutoff, 128 skipped-tag maximum and read-only/no-authority contract. A larger quoted attribute never supplies a product name, option selection or root marker. A 600 KiB long tag must still terminate with `TAG_SCAN_LIMIT_REACHED` and `countsComplete=false`. Re-measure KR to see whether a complete structural diagnostic can be established; do not assume it will pass.

When the template shape is incomplete, its zero counts remain **unknown rather than absent**. Current recommendation, Fact and Subject authority are unchanged.
