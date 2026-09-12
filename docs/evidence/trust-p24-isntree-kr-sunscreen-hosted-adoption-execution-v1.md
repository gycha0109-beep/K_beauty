# TRUST-P24 Isntree KR Sunscreen Hosted Adoption Execution

## Status

`TRUST_P24_PRODUCTION_ADOPTION_CONFIRMED`

This closeout freezes the controlled Production adoption of Isntree `히아루론산 워터리 선 젤 50ml` for KR sunscreen Product Facts.

## Authority

- Phase A merge: `cfc6fe9d4a306579b4ad9a0c75bf4746e6c69c3d`
- Plan content SHA-256: `68a7e27d6e0ee5e000fae54287a30bd33d1014b5343194eee1d51291286e2941`
- Subject semantic key: `31b72283f5cd817d0dd41f62ef8ae4eb149ad8393cdd40810f2e0ad4eb797cd0`
- Official KR page: `https://isntree.com/product/%ED%9E%88%EC%95%84%EB%A3%A8%EB%A1%A0%EC%82%B0-%EC%9B%8C%ED%84%B0%EB%A6%AC-%EC%84%A0-%EC%A0%A4-50ml/145/`
- Direct first-party claim asset: `https://isntree01.openhost.cafe24.com/product/hyaluronic_acid_sun_gel/hyaluronic_acid_sun_gel_4.jpg`
- Observed direct package claim: `SPF50+ PA++++`

No Global-to-KR formula transfer, cross-product transfer, third-party positive fact support, direct Product Fact DML, schema/RPC/Registry mutation, or recommendation/ranking change was used.

## Controlled execution

The only business mutations were performed through the governed Product Fact RPC lifecycle:

1. `admin_register_product_fact_subject_v1`
2. `admin_ingest_product_fact_evidence_v1`
3. `admin_prepare_product_fact_review_v1`
4. `admin_preflight_product_fact_confirmation_v1`
5. `admin_confirm_product_fact_v1`

Both SPF and UVA preflights returned `ready` before any confirmation. Both confirmations were then executed in one SQL statement / one transaction using the exact preflight payload and prestate digests.

## Runtime lineage

- Subject: `2f2377dd-b6d2-4a23-a680-733444bf40fc`
- Source: `2e75ba01-7ecb-4824-b712-d7e5d707782d`
- Binding: `597c8303-9c9d-43af-9fc6-806b4541630f`
- SPF evidence: `212b1572-5c14-4fde-9c95-da1ca9c6e9f2`
- SPF assignment: `af0fff96-ba08-4ce2-b040-a45b03999f18`
- SPF fact instance: `6afcc847-3018-4ec4-94a1-c53c26ee5e66`
- SPF confirmation: `ef66c5a9-0ea5-4947-bb85-a4baeb11e672`
- UVA evidence: `559d7b9a-0f58-462b-a799-23a89850854e`
- UVA assignment: `76593616-1cd4-4a03-81d5-859085c663d3`
- UVA fact instance: `c34ed8a5-45a5-44e0-a3b0-8f5cb401ea1a`
- UVA confirmation: `f7e459ec-bffd-46ae-b926-b0d58c423afb`

## Production delta

| Table/state | Before | After | Delta |
|---|---:|---:|---:|
| Subjects | 24 | 25 | +1 |
| Sources | 25 | 26 | +1 |
| Bindings | 25 | 26 | +1 |
| Evidence | 56 | 58 | +2 |
| Fact Instances | 56 | 58 | +2 |
| Evidence Links | 56 | 58 | +2 |
| Review Assignments | 56 | 58 | +2 |
| Confirmations | 56 | 58 | +2 |
| Current | 56 | 58 | +2 |

Target poststate is `Subject 1 / Current 2 / SPF Current 1 / UVA Current 1 / confirmed assignments 2`.

Execution content SHA-256: `8bcb5affd80a204a3c7e2585026884b5fa2cb336c089a9c4cccbdc7821846c82`
