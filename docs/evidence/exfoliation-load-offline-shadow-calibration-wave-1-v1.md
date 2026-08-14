# V2.1-8K — Exfoliation Load Offline/Shadow Calibration Wave 1

## Status

- Axis: `exfoliation_load` only
- Execution-start repository authority: `c4d8c2273b21cd6453b123796222b62769736aeb`
- 8J canonical contract digest: `ce137d8755f454ae10c46e5321c718f3adca9f2cbceafc221bc3d93600543386`
- Cohort: 3 structurally eligible products
- Anchor feasibility verdict: `NO_VALID_CALIBRATION_ANCHOR_AVAILABLE`
- Calibration executed: **NO**
- Primary experiment outcome: `NUMERIC_ANCHOR_GAP_CONFIRMED`

This is a successful V2.1-8K experimental closure. The stage does not manufacture a numeric target merely because the cohort is structurally ready.

## Frozen cohort

| Topology | Product | Product ID | Subject | Relevant active propositions |
|---|---|---|---|---|
| treatment | 디오디너리 만델릭 애시드 10% + HA 세럼 | `0b88019a-9eb2-4be9-842d-f1e60e42cf51` | `c702942b-fce0-4a02-8edf-501d0c8361d0` | `mandelic_acid` |
| toner_essence | 닥터지 레드 블레미쉬 10-시카 캡슐 수딩 토너 | `c4a5f510-8d9e-46bd-a31c-3c0a34fee331` | `d0454c88-254b-4ea0-8a89-7a8c2e61bb11` | `mandelic_acid` |
| toner_pad | 메디큐브 제로 모공 패드 2.0 | `230f1c9c-cbf8-4458-aaac-ea1010a21e8c` | `5f4cbfeb-524c-41b6-a0f8-723fb2a60090` | `lactic_acid`, `salicylic_acid` |

All calibration-required active propositions are canonical Current, `supported`, `product_specific_primary`, and attached to resolved/current Subjects.

### Parent-bound concentration lineage

Only the treatment product has a governed `active_concentration` Current Fact:

- `mandelic_acid` proposition: `1130020852b0028698d62c01046ce25430db8f4869b43191ae0ff02fc93f14d4`
- parent Fact Instance: `2462db37-e18a-415a-837c-e42ae240bc76`
- matching concentration proposition: `7e3f44c47ef50a94953249bed4ae484b1a8ee7995fd05e1d497d07c6229763b2`
- concentration: `10 percent`
- concentration parent proposition and parent Fact Instance match exactly.

No concentration is attached to the toner or toner-pad actives. Missing concentration remains missing and is never treated as zero.

### Context coverage

| Context | Coverage | Semantics |
|---|---:|---|
| `active_concentration` | 1/3 | parent-bound context; not cross-active potency |
| `recommended_use_frequency` | 1/3 | usage instruction; not efficacy |
| `product_format` | 2/3 | context; not effect magnitude |
| `wipe_off_use` | 1/3 | context; not effect magnitude |
| `pad_surface_texture` | 1/3 | context; not effect magnitude |

The Medicube product retains both relevant active propositions. No first-active, max, sum, mean, or other aggregation is authorized. `MULTI_ACTIVE_AGGREGATION_NOT_AUTHORIZED` is preserved.

## Anchor feasibility

Current governed authority contains no independent product-level numeric or ordinal target for exfoliation load.

- `contains_active` is the predictor identity signal, not a target.
- `active_concentration` is available for one product only and has no governed cross-active potency equivalence.
- `recommended_use_frequency` is an instruction, not an efficacy or load measurement.
- `product_format`, `wipe_off_use`, and `pad_surface_texture` are context, not effect magnitude.
- No governed direct exfoliation measurement is present.
- No governed outcome measurement is present.
- No authoritative ordinal exfoliation label is present.
- No validated transformation contract or benchmark ground truth is present.

Using the predictor/context fields to manufacture a target and then fitting back to that target would be circular calibration.

Final feasibility verdict:

`NO_VALID_CALIBRATION_ANCHOR_AVAILABLE`

## Identifiability

- Independent usable anchor observations: **0**
- Free fitted parameters: **0** because fitting is prohibited without a target.
- Any proposed fitted model with one or more free parameters would have parameters greater than or equal to the number of independent usable anchor observations.
- Topology: 1 treatment / 1 toner_essence / 1 toner_pad, therefore every topology is a singleton.
- Ingredient confounding is material: mandelic acid repeats across two topologies, while the toner pad is multi-active.
- No governed cross-active potency equivalence or multi-active aggregation rule exists.
- Comparable concentration context is not repeated across products.

Identifiability verdict:

`NUMERIC_METHOD_NOT_IDENTIFIABLE_WITH_CURRENT_AUTHORITY`

## Calibration result

No numeric or ordinal calibration is executed.

- mode: `none`
- target/anchor: `null`
- parameters: none
- offline estimates: none
- uncertainty semantics: `STRUCTURAL_ONLY`, `ANCHOR_LIMITED`, `CONTEXT_INCOMPLETE`, `MULTI_ACTIVE_UNCALIBRATED`, `TOPOLOGY_SINGLETON`

The production Product Decision Axis mapper remains unchanged and its `estimate` remains `null`.

## Deterministic artifacts

- Input corpus: `evidence/product-decision-axis-calibration-v1/exfoliation-load-calibration-wave-1-input-v1.json`
  - SHA256: `7ed8ccfac43c34ffbd83cb236a00a00fd02ea8f5751dc904b4390a60b178c97b`
- Feasibility audit: `evidence/product-decision-axis-calibration-v1/exfoliation-load-calibration-feasibility-v1.json`
  - SHA256: `b2c8d716e6c53c54f7a32b713dc1c60209b43bfc598774aacecedd7e1367cd20`
- Result: `evidence/product-decision-axis-calibration-v1/exfoliation-load-calibration-wave-1-result-v1.json`
  - SHA256: `6b79abb7b72292b16a4c6f8b1a5e420da24f2892dd4e09c7a9ca7ec22f58ffcc`

The builder and verifier require byte-identical Build A/B output and exact replay of the 8I snapshot, 8I audit, 8J contract file, 8J canonical body digest, and 8J replay.

## Invariants

- Hosted Product Fact writes: 0
- External product evidence research: 0
- Registry definition delta: 0
- Migration delta: 0
- Product Decision Axis production consumption: 0
- Recommendation behavior delta: 0
- CandidatePolicy delta: 0
- Production mapper changed: NO
- Production consumer changed: NO
- Recommendation activated: NO

## Primary outcome

`OFFLINE_CALIBRATION_METHOD_VALIDATED = NO`

`NUMERIC_ANCHOR_GAP_CONFIRMED = YES`

`EXFOLIATION_LOAD_OFFLINE_CALIBRATED = NO`

## Exactly one next stage

**Exfoliation Load Numeric Anchor / Evidence Contract Design**

Scope: define the independent semantic target, admissible measurement/outcome authority, scale or order semantics, scope and lineage requirements, and any required Evidence/Registry contract before numeric calibration is attempted.

It will not perform external product research, numeric fitting, production Decision Axis consumption, or Recommendation activation.
