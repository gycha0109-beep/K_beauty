# V2.1-8E — Recovered Source-Gap Hosted Adoption Wave 1

> Deterministic Phase A execution freeze. Hosted writes occur only after exact-head CI, squash merge, and exact-main closeout.

- Source main: `da4e499b9b33af5a36c33e2c4c189462d731786b`
- Product: `4aa41038-de5b-4125-97b0-a50e7575cc00` / ILLIYOON Ceramide Ato Concentrate Cream 150mL / 세라마이드 아토 집중크림
- Subject semantic key: `d600446336216d911d4aada62502fcbcc5b800abc671094b27fa5625f241d810`
- Subject market applicability: `null`; Fact scope: `{"market":"KR"}`
- Binding: `exact_subject_match / narrower`
- Facts: **2**; expected Current: **23 → 25**; adopted products: **8 → 9**
- Plan content SHA-256: `cc47824a2af6a61e42a7c7945ff8d9b92507e6fadea32dd186c76a4bbe39e099`

## Exact propositions

- `primary_use_role="multi_area"`: `00bb4342dc4f76621a6961b928f39910aa311d5fa3e9b5f01d27fbc385a2c3c4`; evidence `b7ec18be4f271bdad3be58421004a8a244e376fd06fab70036d73c918a161f67`
- `barrier_support_claim=true`: `bbf0b595d0b81eae256ffa6b06065430e36c528f9d20cdd14c575c992c2be2fd`; evidence `da5b96ebe73fd5ffbcf4d53ae0a802f5cf7ad2e4fce09a4f087a3d5312ab0bad`

## Controlled lifecycle

1. `admin_register_product_fact_subject_v1`
2. `admin_ingest_product_fact_evidence_v1`
3. `admin_prepare_product_fact_review_v1`
4. `admin_preflight_product_fact_confirmation_v1`
5. `admin_confirm_product_fact_v1`

Preflight is zero-write. One stale-prestate negative must reject with SQLSTATE `40001`. Both confirmations must be retried idempotently, and final IDs must come from authoritative Hosted joins.

## Boundary

- No new source research, Registry publication, DDL, schema/migration/RLS change, direct Product Fact table write, or recommendation activation.
- M3, P1, and P2 remain excluded with zero Subject and Current rows.
- The existing 23 Current rows and legacy business tables must remain byte-equivalent under the same pre/post serialization.
