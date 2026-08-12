# V2.1-7 — Product Decision Axis Shadow Recommendation v1

## Boundary

This artifact compares the current durable Legacy Recommendation replay with an offline Decision-Axis shadow evaluation. It does not replace, import into, or mutate Production recommendation scoring.

- Base main: `e2be97b9fcbf75ff43b6f7ecfe96a680aff4cb87`
- Legacy products: 164
- Scenarios: 12
- Candidate evaluations: 1968
- Axis-fixture products matching the legacy catalog: 38
- Numeric shadow contributions: 0

## Shadow states

- HELD_UNCALIBRATED: 285
- IDENTITY_BLOCKED: 12
- INSUFFICIENT_PRODUCT_FACT_COVERAGE: 94
- NOT_APPLICABLE: 65
- NO_APPROVED_AXIS_INPUT: 1512

The current V2.1-5/V2.1-6 Decision Axes are not numerically calibrated. Therefore an axis with `estimate=null` is held rather than converted into a score, multiplier, penalty, or rank transition. `HELD_UNCALIBRATED` is an intentional success state.

## Constraint / Utility

Identity and conflict conditions are evaluated before Utility. A blocked candidate cannot be revived by positive Utility. No Production constraint is activated and no new numeric weight exists.

## Duplication ledger

The ledger audits product concern metadata, ingredient, review, market, hero, hard-penalty, derived-metadata, and Decision-Axis pathways. Semantic overlap is recorded without assuming evidence identity. Overlapping Decision-Axis signals remain non-additive while uncalibrated. Medicube P3 preserves two raw exfoliating active Facts but one `exfoliating_active_identity` family contribution unit.

## Production invariance

- score delta: 0
- ranking delta: 0
- Top Pick delta: 0
- Top3 delta: 0
- eligibility delta: 0
- public response delta: 0
- persistence projection delta: 0
- CandidatePolicy fingerprint delta: 0

## Lifecycle

`OFFLINE_SHADOW_CONSUMPTION = YES`

`DECISION_AXIS_PRODUCTION_CONSUMPTION = NO`

`RECOMMENDATION_SCORER_CHANGED = NO`

`RECOMMENDATION_ACTIVATED = NO`

`HOSTED_PRODUCT_FACT_WRITES_V21_7 = 0`
