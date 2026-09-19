# TRUST Phase 5-C — FATION formulation identity conflict v1

## Result

`FORMULATION_CONFLICT / HOLD`

Target:

- Product: 파티온 노스카나인 트러블 세럼
- Product ID: `da5df70c-8cdd-4eb2-93b6-ede46c2f171d`
- Market: KR
- TRUST state: `REVIEW_REQUIRED / SUBJECT_CREATION_REQUIRED`

This artifact authorizes **zero Production writes**.

## Fresh Production boundary

Read-only Production verification on 2026-09-19 found:

- intake `15566618-d039-44c5-ad45-6413ee399db3`
- source candidate `6a9627b6-a5da-458f-84f7-3a40f91453be`
- candidate review status `promoted`
- catalog identity `resolved`
- catalog authority `product_fact_write_allowed=false`
- three research tasks, all `REVIEW_REQUIRED / SUBJECT_CREATION_REQUIRED`
- Product Fact Subject count: 0
- current KR Subject count: 0

Phase 5-B now provides the governed registration action, but it correctly requires reviewer-established Product Fact identity. The current catalog evidence cannot supply that authority.

## Product identity is converged

Current first-party FATION material consistently identifies:

- 파티온 노스카나인 트러블 세럼
- FATION NOSCA9 TROUBLE SERUM
- 30 ml / 1.01 fl. oz.
- 코스맥스㈜ / 동아제약㈜
- 대한민국

That is sufficient to identify the Product/presentation. It is **not** sufficient to identify one unambiguous current formulation revision.

## First-party formulation conflict

### Water-first ordering

The FATION product page for product 329 and the FATION TRY 5 ml page both expose the same 26-ingredient ordering beginning:

`정제수 → 글리세린 → 다이프로필렌글라이콜 → 판테놀 → ...`

Frozen ordered-list SHA-256:

`6eeed9473eaaee36bd09a73fb7b9ac1ddd4b7761c9fe21ae57070c9bc0484334`

### Mugwort-first ordering

The FATION 2-product set page identifies the same 30 ml serum but exposes an ordering beginning:

`쑥잎추출물 → 정제수 → 글리세린 → 다이프로필렌글라이콜 → 판테놀 → ...`

The Dong-A Pharmaceutical corporate product page also exposes the mugwort-first ordering.

Frozen ordered-list SHA-256:

`2c0cd6fc3765c9b59baf72b6f34abd4ad905e94c07a49c3c7c5c4facbf977d20`

The two lists contain the same frozen set of 26 ingredient names but materially different ordering.

## Current retail context does not close the conflict

Current retail context points in both directions:

- a current 30 ml duty-free listing exposes the mugwort-first ordering and states stock manufactured on or after 2024-10-02;
- a 2026-08-25 indexed 50 ml Olive Young planning exposes the water-first ordering.

These are useful conflict signals, but neither is sufficient first-party authority to decide which ordering represents the current target 30 ml formulation.

## Decision

Do **not** create or freeze a Product Fact `formulation_revision_key` yet.

The provisional semantic variant label:

`NOSCA9_TROUBLE_SERUM_KR_30ML`

is retained only as `PROVISIONAL_NOT_AUTHORIZED`.

The previously considered revision:

`trust-p24-fation-329-current`

is explicitly rejected as an authority value at this stage. No Subject semantic key is computed because doing so would falsely imply a resolved formulation revision.

## Required next authority

One of the following, or equivalent first-party evidence, is required:

1. current 30 ml package ingredient panel tied to a manufacturing lot/date;
2. FATION/Dong-A statement identifying the current 30 ml ingredient list or reformulation history;
3. equivalent first-party evidence that distinguishes the current 30 ml formulation from stale/set-page metadata.

Until then:

`FORMULATION_CONFLICT → HOLD`

## Zero-write boundary

Authorized deltas:

- Product Fact Subjects: 0
- Product Fact Evidence: 0
- Product Fact Confirmations: 0
- Recommendation: 0
- Product source bindings: 0

No Production Subject registration is authorized by this artifact.
