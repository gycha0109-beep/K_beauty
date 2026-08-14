# V2.1-8L — Exfoliation Load Numeric Anchor / Evidence Contract Design

## Result

V2.1-8L freezes a **numeric-anchor evidence contract** for `exfoliation_load` without performing external evidence research, Registry mutation, numeric fitting, or Recommendation activation.

Primary contract outcome:

`NUMERIC_ANCHOR_EVIDENCE_CONTRACT_DESIGNED`

Disposition:

`TARGETED_ANCHOR_EVIDENCE_ACQUISITION_REQUIRED_BEFORE_REGISTRY_PUBLICATION_AND_CALIBRATION`

The V2.1-8K result remains authoritative: `NUMERIC_ANCHOR_GAP_CONFIRMED`.

## Authority

- repository: `gycha0109-beep/K_beauty`
- execution main: `43595dfa5722d3612ab33c21737490e3cc34ab97`
- Hosted project: `bygrczggxfuisupcevaz`
- Registry: `product-fact-registry-cross-category-v1`
- Registry definitions: `20`
- Registry checksum: `79d41ac13de8080df5199543e31ad7bbc1c1763836ef776313613b7547b79575`
- V2.1-8J contract digest: `ce137d8755f454ae10c46e5321c718f3adca9f2cbceafc221bc3d93600543386`
- V2.1-8K result SHA256: `6b79abb7b72292b16a4c6f8b1a5e420da24f2892dd4e09c7a9ca7ec22f58ffcc`

Hosted Product Fact state is read-only in this stage.

## Frozen source finding

The current 20-definition Registry contains **no Fact that is an independent numeric or ordinal `exfoliation_load` anchor**.

Current predictor/context facts remain non-anchors:

- `contains_active` — predictor identity, not intensity ground truth
- `active_concentration` — context, not governed cross-active potency
- `recommended_use_frequency` — instruction context, not efficacy
- `product_format` — presentation, not effect magnitude
- `wipe_off_use` — usage mode, not effect magnitude
- `pad_surface_texture` — physical characteristic, not effect magnitude
- `treatment_claim` — claim, not measured magnitude

The existing Registry does, however, establish a reusable **measurement-shaped Product Fact pattern**:

- `hydration_change`: `range_unit`, cardinality many, measurement evidence, required metric/method/timepoint context
- `tewl_change`: `number_unit`, cardinality many, measurement evidence, required metric/method/timepoint context

This is architecture precedent only. Neither Fact is semantically reused for exfoliation.

## Anchor target semantics

The 8L target is:

`protocol_scoped_final_product_exfoliation_response_change`

It means:

> A numeric change in a declared exfoliation-response measurement observed for the exact final-product formulation under a declared protocol, relative to a declared baseline or comparator, at a declared timepoint.

This contract deliberately does **not** define a universal 0–1 exfoliation score.

The anchor is a final-product outcome. It is not an ingredient-potency label. Therefore a future comparable final-product outcome measurement does not require inventing potency constants for mandelic, lactic, or salicylic acid.

## Admissible numeric anchor

A numeric anchor is admissible only when all required properties are established:

1. exact/equivalent resolved final-product Subject;
2. `measurement` evidence;
3. `supported` semantic status;
4. `product_specific_primary` authority;
5. declared measurement metric;
6. declared source-native unit;
7. declared method/protocol context;
8. declared baseline or comparator;
9. declared exposure protocol;
10. declared timepoint;
11. declared anatomical site;
12. metric directionality defined;
13. independent from the predictor/context facts used by the mapper.

An authoritative protocol-defined ordinal outcome may be stored as ordinal evidence, but it does not satisfy the numeric-anchor gate and must not be mapped to arbitrary numeric distances.

## Comparability contract

Numeric observations may be pooled into one future calibration anchor family only when these dimensions are identical or linked by a pre-existing explicit equivalence contract:

- metric
- unit
- method/protocol family
- baseline/comparator semantics
- exposure protocol
- timepoint
- anatomical site

No cross-metric normalization is authorized.

No incompatible protocol-family normalization is authorized.

No ingredient-level potency equivalence is inferred.

## Multi-active contract

The anchor belongs to the **final product formulation**.

For multi-active products:

- preserve every relevant `contains_active` proposition and lineage;
- do not decompose the measured outcome into acid-specific contributions;
- do not sum, average, maximize, or rank acid potencies;
- keep `active_concentration` attached only to its matching parent active lineage;
- predictor lineage remains separate from the independent outcome target.

## Prospective Product Fact family

8L designs, but does **not register**, a prospective Fact family:

`exfoliation_response_change`

Status:

`DESIGNED_NOT_REGISTERED`

Proposed shape:

- value type: `range_unit`
- cardinality: many
- domains: treatment / toner_essence / toner_pad
- evidence class: measurement only
- authority floor: product_specific_primary
- required context:
  - metric
  - method_context
  - timepoint
  - baseline_or_comparator
  - exposure_protocol
  - anatomical_site

Registry publication is **not yet authorized** because no source-derived exfoliation metric/unit vocabulary has been acquired. The allowed unit set remains empty rather than inventing a unit or a generic score.

Therefore:

`REGISTRY_DEFINITION_DELTA_V21_8L = 0`

## Calibration-entry gate

The V2.1-8J structural gate remains necessary but is not sufficient.

A future numeric calibration stage additionally requires:

- at least one comparable numeric anchor observation for each of the three frozen structurally eligible products;
- all three observations belong to one comparable anchor family;
- topology remains treatment ≥1, toner_essence ≥1, toner_pad ≥1;
- partial anchor coverage does not count;
- future identifiability analysis still passes.

This is a structural execution gate only. Statistical power is not claimed.

## Exact targeted evidence research contract

The next evidence-acquisition wave is constrained to the exact V2.1-8K three-product cohort first:

1. `0b88019a-9eb2-4be9-842d-f1e60e42cf51` — treatment — mandelic acid
2. `c4a5f510-8d9e-46bd-a31c-3c0a34fee331` — toner_essence — mandelic acid
3. `230f1c9c-cbf8-4458-aaac-ea1010a21e8c` — toner_pad — lactic acid + salicylic acid

The research objective is only to locate product-specific primary measurement/outcome evidence satisfying this contract.

Valid research-wave terminal states are:

- `COMPARABLE_NUMERIC_ANCHOR_SET_FOUND`
- `PARTIAL_NUMERIC_ANCHOR_SOURCE_GAP`
- `NO_NUMERIC_ANCHOR_SOURCE_FOUND`
- `INCOMPATIBLE_PROTOCOL_FAMILIES_ONLY`
- `ORDINAL_ONLY_ANCHOR_FOUND`

The wave must not silently expand into generic catalog research.

## Why evidence acquisition precedes Registry publication

Current Product Fact infrastructure already demonstrates measurement-shaped Facts. The missing authority is not a generic storage mechanism; it is the **source-derived metric/unit/protocol vocabulary** for exfoliation response.

Publishing `exfoliation_response_change` now would require inventing an allowed unit/metric schema.

Therefore the correct sequence is:

`8L anchor/evidence contract`
→ `targeted anchor evidence research`
→ `Registry definition/extension only if source semantics justify it`
→ `governed Product Fact materialization`
→ `future offline calibration`
→ `future production-consumption gate`

## Non-actions

V2.1-8L performs none of the following:

- external product evidence research
- Product Fact writes
- Registry publication
- migration/DDL
- numeric fitting
- ingredient potency constants
- synthetic target generation
- production PDA consumption
- Recommendation behavior changes
- Recommendation activation

## Next stage

Exactly one next stage is recommended and not executed:

**Exfoliation Load Targeted Numeric Anchor Evidence Research Wave 1**

It will test whether the exact three-product cohort has source-native, product-specific measurements that satisfy the 8L contract and will freeze the exact protocol/metric/unit gap without numerical invention.
