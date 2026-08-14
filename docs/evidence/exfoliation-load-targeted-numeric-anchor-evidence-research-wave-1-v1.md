# V2.1-8M — Exfoliation Load Targeted Numeric Anchor Evidence Research Wave 1

Status: **FROZEN RESEARCH CLOSEOUT**  
Stage: `V2.1-8M`  
Axis: `exfoliation_load`  
Start main authority: `f7b024b81d2ffcae2082fdadda7399c33c8a1ff7`  
Upstream V2.1-8L contract SHA256: `07aa89c15039b77763a0e2bd411575279e5867468db7ed9ca1ac34b6f61740d8`

## 1. Question

For the exact three-product cohort frozen by V2.1-8K, does an independent product-specific numeric final-product exfoliation-response outcome exist in official/primary evidence, and can all three products be joined into one authoritative comparable protocol family?

This stage performs **research only**. It does not perform numeric calibration, Registry publication, Hosted Product Fact writes, Recommendation changes, or production PDA consumption.

## 2. Exact V2.1-8K cohort

| Product | Product ID | Category | Subject ID | 8K role |
|---|---|---|---|---|
| 디오디너리 만델릭 애시드 10% + HA 세럼 | `0b88019a-9eb2-4be9-842d-f1e60e42cf51` | `treatment` | `c702942b-fce0-4a02-8edf-501d0c8361d0` | treatment representative |
| 닥터지 레드 블레미쉬 10-시카 캡슐 수딩 토너 | `c4a5f510-8d9e-46bd-a31c-3c0a34fee331` | `toner_essence` | `d0454c88-254b-4ea0-8a89-7a8c2e61bb11` | toner/essence representative |
| 메디큐브 제로 모공 패드 2.0 | `230f1c9c-cbf8-4458-aaac-ea1010a21e8c` | `toner_pad` | `5f4cbfeb-524c-41b6-a0f8-723fb2a60090` | toner-pad representative |

Topology remains exactly `treatment=1`, `toner_essence=1`, `toner_pad=1`.

## 3. V2.1-8L target contract

The only numeric target is:

`protocol_scoped_final_product_exfoliation_response_change`

An admitted numeric anchor must be a measurement of the **final marketed product** and must preserve source-native metric/unit plus method/protocol, baseline/comparator semantics, exposure protocol, timepoint, anatomical site, exact/equivalent product identity, and `product_specific_primary` authority.

The following remain predictors/context/surrogates, not ground truth:

- `contains_active`
- `active_concentration`
- `recommended_use_frequency`
- `product_format`
- `wipe_off_use`
- `pad_surface_texture`
- marketing/treatment claims
- formulation pH
- consumer preference percentages
- generic ingredient studies

No cross-protocol normalization, active-potency coefficient, invented metric, or universal score is authorized.

## 4. Research coverage

Each product was searched through at least eight query families covering:

- exact product + clinical test
- exact product + exfoliation
- dead-skin / corneocyte / keratin terminology
- exact product + clinical result
- manufacturer measurement
- exact product + study/publication
- official brand domain
- exact marketed-product primary-publication search

The frozen ledger contains four official product-specific sources:

1. The Ordinary Korean-market exact product page.
2. Dr.G Korean exact product page.
3. Medicube Korean exact product page.
4. Medicube US exact-name product page containing a clinical-results summary.

Retailer pages, consumer reviews, blogs, generic ingredient literature, and search snippets were not admitted as anchor authority.

## 5. Product findings

### The Ordinary Mandelic Acid 10% + HA

Disposition: `NO_QUALIFYING_ANCHOR_FOUND`

The official Korean-market product page exposes numeric formulation properties such as `10%` mandelic-acid naming and pH `3.5–4.5`, and gives once-daily use guidance. These are not measured final-product exfoliation-response outcomes and are rejected as surrogate/context values.

No exact-product product-specific measured exfoliation-response change was located in the searched official/primary families.

### Dr.G Red Blemish 10-Cica Capsule Soothing Toner

Disposition: `NO_QUALIFYING_ANCHOR_FOUND`

The official Dr.G page confirms the exact 300 mL toner identity and product positioning. It does not expose a measured final-product exfoliation-response endpoint with source-native numeric or protocol-defined ordinal semantics.

No qualifying exact-product primary measurement source was located.

### Medicube Zero Pore Pad 2.0

Disposition: `NO_QUALIFYING_ANCHOR_FOUND`

The official Korean page confirms the exact KR product identity but does not expose a measured exfoliation-response change.

The official US page reports a two-week clinical summary with numeric pore outcomes:

- pore size reduction: `1.57%`
- pore condition improvement: `3.15%`

Those values are **pore outcomes, not exfoliation-response outcomes**. The page also reports consumer response percentages, which are not measured exfoliation-response magnitude. The US source does not independently establish US-to-KR formulation equivalence for the KR-scoped cohort Subject. These candidates therefore remain in the ledger but are not anchor eligible.

## 6. Comparability

Comparable numeric family: **NO**

Required dimensions:

`metric + unit + method_protocol_family + baseline_or_comparator_semantics + exposure_protocol + timepoint + anatomical_site`

There are zero admitted final-product numeric exfoliation-response anchors, so a three-product comparable family cannot be constructed. This is not an `INCOMPATIBLE_PROTOCOL_FAMILIES_ONLY` result: the rejected Medicube numeric values fail the target metric gate before protocol-family comparison.

No arbitrary unit conversion, cross-metric normalization, cross-protocol normalization, rank normalization, or active-potency mapping was performed.

## 7. Terminal outcome

`NO_NUMERIC_ANCHOR_SOURCE_FOUND`

Rationale:

- qualifying numeric anchor products: `0 / 3`
- qualifying numeric anchors: `0`
- authoritative protocol-defined ordinal anchors: `0`
- comparable numeric families: `0`
- all three products were terminally researched under the bounded 8L contract

The finding is a successful V2.1-8M research closeout. Evidence absence is preserved as absence; it is not converted to a false Product Fact.

## 8. Deterministic artifacts

The live-web research phase is frozen in:

`evidence/product-decision-axis-anchor-research-v1/exfoliation-load-targeted-numeric-anchor-source-ledger-wave-1-v1.json`

CI does not refetch the web. The builder consumes only the frozen ledger and deterministically reproduces the research result and replay artifacts. Build A/B must be byte-identical.

## 9. Production and Hosted invariants

V2.1-8M authorizes none of the following:

- Hosted Product Fact write
- Registry definition publication
- migration / DDL
- Subject/Evidence/Current mutation
- numeric fitting or calibration
- Product Decision Axis production consumption
- scorer/ranker or CandidatePolicy change
- Recommendation activation

Production behavior remains subject to the canonical `164 products × 12 scenarios = 1968 evaluations` invariance verifier.

## 10. Next stage recommendation

Exactly one recommendation is frozen and **not executed**:

`Exfoliation Load Calibration Feasibility Reassessment`

A generic evidence-search expansion is not automatically authorized.
