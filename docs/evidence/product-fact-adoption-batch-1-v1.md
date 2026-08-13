# V2.1-8A — Product Fact Catalog Adoption Batch 1

## Authority

- Base main: `eb933621fd1320dc8270b86192d72e7636990c3f`
- Registry: `product-fact-registry-cross-category-v1`
- V2.1-2 materialization SHA-256: `b2f19878f00f53d9a60dad0b1515fff1f566449e6a531825e712dfa2e3f19bb2`
- V2.1-4 fusion SHA-256: `86332b78ec38d79f8dfa12c5879cee46f4a22979d69945ee2f5a9dcc7038b802`
- V2.1-5 cleanser axis SHA-256: `fbddc761328f2caa5025a5867061866d17f16d24cb6566fe82d0796c20a4a0b4`
- V2.1-6 cross-category axis SHA-256: `5dc5c7975be7474bf0767951ea63074ed60968faabee5fdb8734153ff698ab5e`
- V2.1-7 shadow SHA-256: `7059cd691a0819e935d3debbd1912c7b92a2e3998557bfde28a6ded4a4659e1f`

## Selection policy

Batch 1 is deterministic and frozen-pilot-only. It selects one safe candidate from each of sunscreen, moisturizer family, and treatment. V2.1-6 catalog domains `moisturizer_cream` / `moisturizer_balm` are mapped only to the existing mapper family `moisturizer_family`; the original catalog domain is preserved separately. Facts must be supported, high-confidence, product-specific-primary, root propositions with one admissible supporting Evidence record and no opposing/context Evidence. Existing V2.1-3 Hosted products are excluded.

## Selected products

- **S3 — ANESSA Perfect UV Skincare Milk NA / 퍼펙트 UV 선스크린 스킨케어 밀크 NA** (sunscreen; catalog domain sunscreen, cbcd06a2-de29-47ca-afd1-ab1d5de93903)
- **M2 — La Roche-Posay Cicaplast Baume B5+** (moisturizer_family; catalog domain moisturizer_balm, c67266dd-3706-4929-9196-936d1f61cbc5)
- **T3 — Anua PDRN Hyaluronic Acid Capsule 100 Serum** (treatment; catalog domain treatment, 24a339bf-f380-493f-88b5-68e6be887c30)

## Selected Fact proposals

- S3 / ANESSA Perfect UV Skincare Milk NA / 퍼펙트 UV 선스크린 스킨케어 밀크 NA: `spf_value` = `50` — product_specific_primary/high — ade30ee97c27c1bbd5280d0f671c7afae768d62386751798b73f334272d20b17
- S3 / ANESSA Perfect UV Skincare Milk NA / 퍼펙트 UV 선스크린 스킨케어 밀크 NA: `uva_label` = `"PA++++"` — product_specific_primary/high — a00cae7249ea6472f31d6a7bf5e0e0ffec90f2dd8c241bbda78bd5b0239d8742
- M2 / La Roche-Posay Cicaplast Baume B5+: `primary_use_role` = `"multi_area"` — product_specific_primary/high — 7447a2176f490ae2db3bdb9078622b7a6f1150bbd7cb8b75016ac04582182b80
- M2 / La Roche-Posay Cicaplast Baume B5+: `barrier_support_claim` = `true` — product_specific_primary/high — 5bd530c0b48f73553f935695d2254d415476b66539a88624c7e4e1d581c8f777
- T3 / Anua PDRN Hyaluronic Acid Capsule 100 Serum: `contains_active` = `"sodium_dna"` — product_specific_primary/high — ca47a8163253401226cf60b5c790f80385605be5f4332e04ae4850e1c7f3163e
- T3 / Anua PDRN Hyaluronic Acid Capsule 100 Serum: `contains_active` = `"hyaluronic_acid"` — product_specific_primary/high — caece34a8bcfd3e93a776bf84934dda10ad4bb33ad4706b4cca6db039032bc30

## Expected Hosted delta

```json
{
  "product_fact_registry_versions": 0,
  "product_fact_definition_snapshots": 0,
  "product_fact_subjects": 3,
  "product_evidence_sources": 3,
  "product_evidence_source_subject_bindings": 3,
  "product_evidence_records": 6,
  "product_fact_instances": 6,
  "product_fact_evidence_links": 6,
  "product_fact_review_assignments": 6,
  "product_fact_review_events": 27,
  "product_fact_confirmations": 6,
  "product_fact_current": 6
}
```

## Safety boundary

- New products: 3 / max 3
- New Facts: 6 / max 6
- Registry republish: NO
- Direct Product Fact table writes: NO
- Each Fact requires preflight, stale-state negative coverage, confirm, and exact retry idempotency.
- Hosted runtime fusion digests are computed only after Hosted UUID allocation.
- Temporary Admin capability, if used, must be transaction-scoped with persistent membership residue 0.
- Legacy product fields are never overwritten.
- Decision Axis production consumption remains NO.
- Recommendation activation remains NO.

## Lifecycle

```text
PRODUCT_FACT_PARTIAL_CATALOG_ADOPTION_PLANNED = YES
PRODUCT_FACT_CATALOG_ADOPTED = NO
CATALOG_FULLY_ADOPTED = NO
PRODUCT_DECISION_AXIS_PRODUCTION_CALIBRATED = NO
DECISION_AXIS_PRODUCTION_CONSUMPTION = NO
RECOMMENDATION_SCORER_CHANGED = NO
RECOMMENDATION_ACTIVATED = NO
HOSTED_WRITES_EXECUTED_BY_THIS_ARTIFACT_BUILD = 0
```
