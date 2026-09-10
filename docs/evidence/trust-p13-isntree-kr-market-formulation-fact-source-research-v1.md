# TRUST-P13 — Isntree KR Market / Formulation / Fact Source Research v1

## Status

`KR_MARKET_IDENTITY_RESOLVED_FORMULATION_AND_FACT_SOURCE_RECOVERY_REQUIRED`

This is a research/adjudication freeze only. Product Fact writes remain zero.

## Target

- Product: `336bb533-0fe4-4380-8b9f-ab16fb24b807`
- Catalog: 이즈앤트리 `히아루론산 워터리 선젤`, 50ml
- P6 prior disposition: `MARKET_SCOPE_REVIEW_REQUIRED`

## Fresh Production prestate

Captured at `2026-09-11T06:46:17.69428+09:00`:

- Subjects 20 / Sources 21 / Bindings 21 / Evidence 49
- Fact Instances 49 / Evidence Links 49 / Review Assignments 49 / Confirmations 49 / Current 49
- target Subject 0 / Current 0

## First-party findings

### Isntree Korea

Current official sunscreen catalog:

`https://m.isntree.com/product/list.html?cate_no=69`

Machine-readable body lists:

- `히아루론산 워터리 선 젤 50ml`
- `#유기자차 #보습케어`

This resolves current KR market identity for the exact catalog product/size. It does not expose a direct SPF numeric value, PA label, or comparable full formulation in the reviewed body.

The current category links to the exact official product route:

`https://m.isntree.com/product/%ED%9E%88%EC%95%84%EB%A3%A8%EB%A1%A0%EC%82%B0-%EC%9B%8C%ED%84%B0%EB%A6%AC-%EC%84%A0-%EC%A0%A4-50ml/145/category/69/display/1/`

Direct retrieval of that detail route was not available in the research fetch path, so no hidden/image-only claim is admitted.

### Isntree Global

Current official product page:

`https://isntree-global.com/products/isntree-hyaluronic-acid-watery-sun-gel-50ml`

Machine-readable body exposes:

- `Hyaluronic Acid Watery Sun Gel 50ml`
- `SIZE 50ml`
- product notice that it is not available in the U.S. due to OTC regulations
- a full ingredient list

The reviewed current machine-readable body does **not** expose a direct `SPF50+` or `PA++++` claim for this exact product.

## Adjudication

- KR market identity: `resolved`
- cross-market formulation bridge: `not_established`
- `spf_value`: `fact_source_recovery_required`
- `uva_label`: `fact_source_recovery_required`
- Subject registration: `blocked`

The global page's ingredient body cannot be silently transferred to the KR subject because a comparable KR formulation body or explicit first-party same-formulation bridge was not established. Product category, reviews, common product knowledge, or image-only presentation do not establish SPF/PA values.

## Next gate

One of these first-party paths is required before Product Fact writes:

1. KR machine-readable product/formulation body that directly exposes SPF/PA, or
2. explicit first-party same-formulation bridge from the KR exact product to a first-party source that directly exposes SPF/PA.

No Subject registration, evidence ingest, confirmation, Registry/schema/RPC, recommendation, or ranking change is authorized by TRUST-P13.

Research content SHA-256:

`b769de2dd9858191fe14723aed4e284406f8f2e000c95b14d8bd60d1a0183a52`
