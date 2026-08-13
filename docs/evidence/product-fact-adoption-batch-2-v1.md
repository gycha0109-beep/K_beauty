# V2.1-8B — Product Fact Catalog Adoption Batch 2

## Authority

- Source main: `a303e216f3953567a175c4d01978efc06b20bbc6`
- Registry: `product-fact-registry-cross-category-v1`
- Hosted prestate digest: `f07c2814deda56a2f92ae9ba996cbf4741e1ab7c4aa7f5c1d4b7f570b60375fd`
- V2.1-2 materialization SHA-256: `b2f19878f00f53d9a60dad0b1515fff1f566449e6a531825e712dfa2e3f19bb2`
- V2.1-4 fusion SHA-256: `86332b78ec38d79f8dfa12c5879cee46f4a22979d69945ee2f5a9dcc7038b802`
- V2.1-6 cross-category axis SHA-256: `5dc5c7975be7474bf0767951ea63074ed60968faabee5fdb8734153ff698ab5e`
- V2.1-7 shadow SHA-256: `7059cd691a0819e935d3debbd1912c7b92a2e3998557bfde28a6ded4a4659e1f`
- V2.1-8A Batch 1 SHA-256: `62eeb8232fa2a2fef098c536b6bbb2b11977b575bddc9aa810cfc608c5602a61`

## Selection comparator

Candidate source is frozen cross-category pilot only. Eligibility requires resolved/current identity, eligible exact/equivalent binding, supported Product Fact semantics, product-specific-primary authority, high confidence, and a closed parent dependency. Existing adopted pilot products are excluded. Eligible products are ranked by new Fact-family coverage descending, eligible Fact count descending, then pilot_id/product_id ascending. Final execution order is separately stabilized by pilot_id/product_id with parent-before-child ordering. Authority always wins over diversity.

## Selected products

- **S1 — ROUND LAB 자작나무 수분 선크림** (sunscreen; 0bb742d2-df6b-49a7-8e29-8f76ae62ac0d)
- **S2 — Beauty of Joseon 맑은쌀 선크림 / Relief Sun : Rice + Probiotics** (sunscreen; 25b2763f-529f-4b2e-a436-2e0776279c55)
- **T1 — Derma Factory Niacinamide 20% Serum / 나이아신아마이드 20% 세럼** (treatment; fa5b1f6b-1e55-47b0-bfa1-494be512df07)

## Selected Facts

- S1 / ROUND LAB 자작나무 수분 선크림: `spf_value` = `50` — product_specific_primary/high — 61a9e96f7bc31ce1ed67304a4af2592ca7d27c7b931c57a786bf75807e170913
- S1 / ROUND LAB 자작나무 수분 선크림: `uva_label` = `"PA++++"` — product_specific_primary/high — b7b5726258b05371f9486d243e703f165b8fd3ea09d158bbdd60d8248e2c11b9
- S2 / Beauty of Joseon 맑은쌀 선크림 / Relief Sun : Rice + Probiotics: `spf_value` = `50` — product_specific_primary/high — 6b1aecc4a6e4e78e178e68c3310c756b3a87a1b9610938c92e53ac5771eb9c1a
- T1 / Derma Factory Niacinamide 20% Serum / 나이아신아마이드 20% 세럼: `contains_active` = `"niacinamide"` — product_specific_primary/high — 89703d12e70171885f5a0db6edb1920bbd3e1ae3f2dc652c0511d93643bc1c55
- T1 / Derma Factory Niacinamide 20% Serum / 나이아신아마이드 20% 세럼: `active_concentration` = `{"amount":20,"unit":"percent"}` — product_specific_primary/high — f13b69729b2a15b9c1a86c4dbaa5a9718ae71e12d21ca5d8950e2e19fc39d00a; parent=89703d12e70171885f5a0db6edb1920bbd3e1ae3f2dc652c0511d93643bc1c55

## Excluded products

- M1: `authority_below_batch_threshold` — no supported high-confidence product-specific-primary Fact with admissible exact/equivalent Evidence
- M2: `already_adopted` — existing Hosted Current product before Batch 2
- M3: `authority_below_batch_threshold` — no supported high-confidence product-specific-primary Fact with admissible exact/equivalent Evidence
- P1: `authority_below_batch_threshold` — no supported high-confidence product-specific-primary Fact with admissible exact/equivalent Evidence
- P2: `identity_ambiguous` — frozen_identity_status_ambiguous
- P3: `already_adopted` — existing Hosted Current product before Batch 2
- S3: `already_adopted` — existing Hosted Current product before Batch 2
- T2: `already_adopted` — existing Hosted Current product before Batch 2
- T3: `already_adopted` — existing Hosted Current product before Batch 2

## Parent dependency

- T1 / active_concentration: parent `89703d12e70171885f5a0db6edb1920bbd3e1ae3f2dc652c0511d93643bc1c55` must be confirmed first and its Hosted fact_instance_id must be bound into the child confirmation.

## Coverage

- Categories: sunscreen, treatment
- Fact families: active_concentration, contains_active, spf_value, uva_label
- New vs Batch 1 Fact families: active_concentration

## Expected Hosted delta

```json
{
  "product_fact_registry_versions": 0,
  "product_fact_definition_snapshots": 0,
  "product_fact_subjects": 3,
  "product_evidence_sources": 3,
  "product_evidence_source_subject_bindings": 3,
  "product_evidence_records": 5,
  "product_fact_instances": 5,
  "product_fact_evidence_links": 5,
  "product_fact_review_assignments": 5,
  "product_fact_review_events": 23,
  "product_fact_confirmations": 5,
  "product_fact_current": 5
}
```

## Expected final Hosted state

```json
{
  "counts": {
    "product_fact_registry_versions": 1,
    "product_fact_definition_snapshots": 20,
    "product_fact_subjects": 8,
    "product_evidence_sources": 8,
    "product_evidence_source_subject_bindings": 8,
    "product_evidence_records": 13,
    "product_fact_instances": 13,
    "product_fact_evidence_links": 13,
    "product_fact_review_assignments": 13,
    "product_fact_review_events": 60,
    "product_fact_confirmations": 13,
    "product_fact_current": 13
  },
  "current_proposition_keys": [
    "1130020852b0028698d62c01046ce25430db8f4869b43191ae0ff02fc93f14d4",
    "5bd530c0b48f73553f935695d2254d415476b66539a88624c7e4e1d581c8f777",
    "61a9e96f7bc31ce1ed67304a4af2592ca7d27c7b931c57a786bf75807e170913",
    "6b1aecc4a6e4e78e178e68c3310c756b3a87a1b9610938c92e53ac5771eb9c1a",
    "7447a2176f490ae2db3bdb9078622b7a6f1150bbd7cb8b75016ac04582182b80",
    "89703d12e70171885f5a0db6edb1920bbd3e1ae3f2dc652c0511d93643bc1c55",
    "a00cae7249ea6472f31d6a7bf5e0e0ffec90f2dd8c241bbda78bd5b0239d8742",
    "ade30ee97c27c1bbd5280d0f671c7afae768d62386751798b73f334272d20b17",
    "b6f1424d1fef32965ec9b1d58d160f8d6b288ce5dcaf7d00fd478fc005eef098",
    "b7b5726258b05371f9486d243e703f165b8fd3ea09d158bbdd60d8248e2c11b9",
    "ca47a8163253401226cf60b5c790f80385605be5f4332e04ae4850e1c7f3163e",
    "caece34a8bcfd3e93a776bf84934dda10ad4bb33ad4706b4cca6db039032bc30",
    "f13b69729b2a15b9c1a86c4dbaa5a9718ae71e12d21ca5d8950e2e19fc39d00a"
  ],
  "unique_adopted_product_count": 8,
  "current_fact_count": 13,
  "unexpected_current_count": 0
}
```

## Safety boundary

- New products: 3 / max 4
- New subjects: 3 / max 4
- New Facts: 5 / max 8
- New Evidence: 5 / max 10
- Registry republish: NO
- Migration / DDL / repair / db push: 0
- Direct Product Fact table writes: NO
- Existing eight Current propositions must remain byte-semantically and ID invariant.
- Every Fact requires zero-write preflight, controlled confirmation, and exact retry idempotency.
- At least one stale-prestate rejection must be rechecked in Hosted execution.
- Legacy product scalar sync remains 0.
- Decision Axis production consumption remains NO.
- Recommendation activation remains NO.

## Lifecycle

```text
V21_8B_BATCH_PLAN_FROZEN = PLANNED
PRODUCT_FACT_ADOPTION_BATCH_2_COMPLETE = NO
PRODUCT_FACT_PARTIAL_CATALOG_ADOPTION = YES (Batch 1 authority only before Hosted Batch 2 execution)
CATALOG_FULLY_ADOPTED = NO
PRODUCT_DECISION_AXIS_PRODUCTION_CALIBRATED = NO
DECISION_AXIS_PRODUCTION_CONSUMPTION = NO
RECOMMENDATION_SCORER_CHANGED = NO
RECOMMENDATION_ACTIVATED = NO
ADMIN_PRODUCT_FACT_UI_OPERATIONAL = NO
HOSTED_WRITES_EXECUTED_BY_THIS_ARTIFACT_BUILD = 0
```
