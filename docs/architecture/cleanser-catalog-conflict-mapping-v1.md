# Cleanser Catalog Conflict Mapping v1

Status: design decision for Catalog Review Adoption v1. No database mutation or recommendation activation is authorized.

## 1. Purpose

This mapping is the only v1 authorization for converting the three frozen `schema_mapping_required` cleanser review decisions into the existing Admin v2 `reviewed_conflict` envelope during future Catalog Review Adoption.

It is bound to:

```text
catalog corpus: cleanser-catalog-field-review-v1
catalog SHA-256: 9c2472cecc720e420467d2bef0808dc47cdbcff31dad118c2d28933ca7bbde9f
mapping policy: cleanser-catalog-conflict-mapping-v1
review contract: admin-product-review-v2
metadata schema: cleanser-metadata-v1
catalog evidence schema: catalog-product-field-evidence-v1
```

This document does not alter the frozen corpus. It interprets three already-frozen conflict decisions for a future operational adoption transaction.

## 2. Decision

Selected model: **Option A**.

For each listed product:

```text
review_state = reviewed_conflict
field_value = null
confidence = unknown
structured_metadata_review_complete = false
products.cleansing_profile = null at future atomic confirm
```

Both independently supported physical values remain in evidence:

```text
low_ph
deep_clean
```

Semantics:

> The evidence supports facts on two independent semantic axes that the current single `cleansing_profile` enum cannot represent simultaneously. `reviewed_conflict` records the schema-level conflict; it does not assert that either supported physical fact is false.

The `manual_conflict_record` for each product is adjudication-only. It records why the values are not collapsed into one scalar and does not itself prove a physical product attribute.

## 3. Covered products

### 3.1 BRMUD Recovery Mud Pack to Foam Cleanser

```text
product_id: 5448b8c3-cf87-4561-a699-3baf3dcb3dab
frozen review_state: reviewed_conflict
frozen reviewed_profile: null
frozen confidence: unknown
```

Preserved evidence roles:

```text
cfrv1-09-01 → supported_value = low_ph
cfrv1-09-02 → supported_value = deep_clean
cfrv1-09-03 → supported_value = null; manual_conflict_record only
```

Operational mapping:

```text
reviewed_conflict / null / unknown
```

### 3.2 beplain Mung Bean pH-Balanced Cleansing Foam

```text
product_id: cd3b66be-cddc-47e1-906f-a871dea84412
frozen review_state: reviewed_conflict
frozen reviewed_profile: null
frozen confidence: unknown
```

Preserved evidence roles:

```text
cfrv1-10-01 → supported_value = low_ph
cfrv1-10-02 → supported_value = deep_clean
cfrv1-10-03 → supported_value = null; manual_conflict_record only
```

Operational mapping:

```text
reviewed_conflict / null / unknown
```

### 3.3 Jumiso Pore-Purifying Salicylic Acid Cleanser

```text
product_id: 3f83bb85-cc53-4aa0-a0f0-e08535288749
frozen review_state: reviewed_conflict
frozen reviewed_profile: null
frozen confidence: unknown
```

Preserved evidence roles:

```text
cfrv1-20-01 → supported_value = low_ph
cfrv1-20-02 → supported_value = deep_clean
cfrv1-20-03 → supported_value = null; manual_conflict_record only
```

Operational mapping:

```text
reviewed_conflict / null / unknown
```

## 4. Why Option A is selected

Admin v2 already defines a legitimate `reviewed_conflict` state with:

- null scalar value;
- `unknown` confidence;
- non-empty evidence;
- multiple conflicting supported values;
- `structured_metadata_review_complete = false`.

The frozen corpus has already determined that these three products each have independently supported `low_ph` and `deep_clean` facts. Discarding the review envelope until a future two-axis product schema exists would lose operational provenance that the current review envelope can preserve safely.

Option A therefore permits adoption while refusing false scalar authority.

## 5. Why Option B is not selected for v1

Option B would defer all three rows until a future schema such as:

```text
ph_profile
cleansing_strength
```

exists.

That future model may ultimately represent the product facts more naturally, but it is not required to preserve today's reviewed conflict state. Deferral would leave the catalog with legacy scalar values and no legitimate Admin review envelope even though the evidence and conflict decision are already frozen.

Option B remains a possible future schema-normalization project; it is not the adoption policy for this corpus.

## 6. Mapping boundaries

This policy is an exact allowlist, not a generic inference rule.

Only the three product IDs above may use this mapping under Catalog Adoption v1. A future product with two supported values does not automatically qualify.

Required future adoption checks:

1. product ID exactly matches this allowlist;
2. frozen corpus version/SHA exactly match this document;
3. frozen state is `reviewed_conflict`;
4. reviewed profile is null and confidence is `unknown`;
5. evidence contains both independently supported `low_ph` and `deep_clean` values;
6. the manual conflict record has null supported value and adjudication-only semantics;
7. evidence digests and source mappings validate under `catalog-product-field-evidence-v1`;
8. current DB target pre-state matches the approved dry-run;
9. final authenticated Admin explicitly confirms the Catalog Adoption batch.

Failure of any condition blocks the entire adoption transaction.

## 7. Scalar and completeness semantics

At a future atomic confirm:

```text
products.cleansing_profile = null
```

for each of the three products.

The null is intentional authority removal. Leaving a legacy scalar such as `balanced`, `low_ph`, or `deep_clean` populated beside `reviewed_conflict` would imply a single authoritative profile that the review explicitly cannot select.

Completeness remains:

```text
structured_metadata_review_complete = false
```

An adopted conflict row is legitimate reviewed provenance but not structured single-value authority.

## 8. Evidence preservation

Catalog Adoption preserves the existing `cfrv1-*` IDs. It does not mint candidate evidence UUIDs, candidate IDs, export batches, or source snapshots.

The physical-attribute evidence and adjudication evidence remain distinct:

```text
physical evidence
→ supported_value = low_ph or deep_clean

manual conflict adjudication
→ supported_value = null
```

No manual record is counted as independent physical support.

## 9. Recommendation boundary

This mapping does not authorize recommendation behavior.

```text
reviewed_conflict adoption != deep_clean ranking authority
reviewed_conflict adoption != non-deep authority
structured_metadata_review_complete = false
recommendation activation = 0
PR #167 activation = 0
isDeepCleanser unchanged
getHardPenalty unchanged
-18 unchanged
CandidatePolicy activation = 0
```

## 10. Decision state

```text
CATALOG_CONFLICT_MAPPING_DECISION_DEFINED
OPTION_A_SELECTED
THREE_PRODUCT_ALLOWLIST_FROZEN
NO_AUTOMATIC_CONFLICT_INFERENCE
NO_RECOMMENDATION_ACTIVATION
```
