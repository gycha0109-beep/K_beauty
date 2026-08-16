# V2.1-8W — Exfoliation Non-Numeric PDA Production Policy Authority Gap

## Terminal

`PRODUCTION_POLICY_MAPPING_REQUIRES_NORMATIVE_POLICY_DECISION`

This is a successful design/freeze terminal. The current repository has sufficient architecture to host a later versioned production policy, but it does **not** contain repository-authoritative governed-PDA normative rules that map the frozen 8U/8V neutral envelope to `ALLOW`, `CAUTION`, `RESTRICT`, `BLOCK`, eligibility, score, or rank.

## Authority revalidation

- Repository: `gycha0109-beep/K_beauty`
- V2.1-8W base main: `d85ed057cb01923d3f3beef18b08e820fb7d7e22`
- Hosted project: `bygrczggxfuisupcevaz`
- Catalog / Product Fact baseline: `164 / 1 / 20 / 16 / 16 / 16 / 41 / 41 / 41 / 41 / 180 / 41 / 41 / 16`
- Latest migration: `20260815023734 face_lab_hosted_intake_v1`
- Hosted writes authorized by 8W: `0`

## Governed-PDA normative authority: NO

The ownership audit found four distinct authority domains:

1. **Governed PDA** — signal status, active identities, coverage, uncertainty, provenance, neutral gate.
2. **External routine/user/safety** — current products, duplicate/stacking/same-window state, sensitivity, recent changes, reaction/instability.
3. **Legacy production behavior** — current hard filters, numeric scoring, CandidateExposurePolicy exposure lanes, Top-K and public recommendation behavior.
4. **Normative production policy** — `ALLOW / CAUTION / RESTRICT / DEFER` and consequences for eligibility/rank/exclusion/warnings.

Domains 1–3 exist. Domain 4 does not yet contain a governed-PDA-compatible mapping contract.

## Ownership audit findings

### 8U / 8V

8U freezes a neutral production-consumption boundary. 8V materializes that boundary at runtime only as a non-authoritative shadow envelope.

`READY_FOR_SEPARATE_POLICY_EVALUATION != ALLOW`

Every 8V envelope keeps:

- `production_decision = UNSPECIFIED`
- `production_authority = false`
- dual-run mode `SHADOW_OBSERVATION_ONLY`

The 8V dual-run observes CandidateExposurePolicy before/after and does not feed the new neutral gate into CandidateExposurePolicy.

### CandidateExposurePolicy

`lib/candidate-exposure-policy.js` and its contract own presentation/exposure semantics:

- `primary`
- `contextual`
- `collapsed`
- `hidden`
- `insufficient_evidence`

The contract also derives lane eligibility for `topPick`, `supporting`, `budget`, `routine`, and `treatment`.

This is existing candidate exposure authority. It is **not** an authority to convert a governed exfoliation PDA neutral gate to `ALLOW / CAUTION / RESTRICT`.

### RoutinePolicy

`lib/routine-policy.js` owns routine-specific state and actions such as:

- AM/PM windows
- `maintain / reduce / hold / check_needed`
- frequency caps
- duplicate/active-stack burden
- same-window warnings/blocked severity

Those are routine-domain decisions, not intrinsic governed-PDA decisions.

### RecentInstabilityGuardPolicy

`lib/recent-instability-guard-policy.js` owns safety-domain guard outcomes such as:

- `no_guard`
- `allow_with_context`
- `collapsed_exposure_candidate`
- `hard_block_candidate`
- `insufficient_data`

These can be authoritative within the existing safety-guard path. They do not define what a governed PDA `READY_FOR_SEPARATE_POLICY_EVALUATION` means normatively.

### FunctionalRankingContract / ProductFunctionalProfile

The legacy functional path contains:

- count-derived `low / medium / high` strength
- confidence
- hard-filter eligibility
- weighted numeric score

Those remain legacy production behavior. They are not governed PDA potency authority and cannot be used to fill the normative gap.

### CurrentProductFindings

Current-product findings own relations such as selected/not-in-db/not-using/unanswered, supports-goal, duplicate-axis, and non-evaluable state. A duplicate relation alone does not authorize a governed-PDA `BLOCK`.

### SkinMatchDecisionEngine

The existing production engine owns current orchestration, concern priority, legacy product scoring/ranking, Top Pick/supporting selection, routine/public copy, and response shaping. It does not consume the 8V production-consumption envelope.

## Frozen authority gap

`READY_FOR_SEPARATE_POLICY_EVALUATION` has no repository-authoritative mapping to `ALLOW / CAUTION / RESTRICT`.

Therefore:

`UNSPECIFIED != ALLOW`

and 8W does not create such a mapping.

## Prohibited transformations

- `READY_FOR_SEPARATE_POLICY_EVALUATION -> ALLOW`
- governed identity overlap -> `RESTRICT` without a normative policy
- routine duplicate -> `BLOCK` without a normative policy
- multiple -> stronger
- identity count -> potency
- legacy strength -> governed PDA potency
- unknown -> safe
- missing -> inactive/zero
- CandidateExposurePolicy presentation state -> governed PDA normative action

## Neutral-gate compatibility

| Neutral gate | 8W-authorized interpretation | Production action |
|---|---|---|
| `READY_FOR_SEPARATE_POLICY_EVALUATION` | separate future policy may evaluate | `UNSPECIFIED` |
| `DEFER_INSUFFICIENT_AUTHORITY` | authority/coverage/context insufficient | `UNSPECIFIED` |
| `DEFER_BLOCKED_AUTHORITY` | governed authority blocked | `UNSPECIFIED` |
| `DEFER_CONTEXT_CONFLICT` | external conflict preserved | `UNSPECIFIED` |
| `NOT_APPLICABLE` | governed PDA not applicable | `UNSPECIFIED` |

## Eligibility / ranking / action separation

8W freezes that the neutral envelope itself has no eligibility, numeric score, ranking, Top-K, or production-action authority.

Existing legacy production behavior remains unchanged. Existing external safety/routine policies remain unchanged. A future governed-PDA production policy may define consequences only after its own semantic/versioning/shadow/rollback/activation contract is approved.

## Unresolved normative decisions

A future policy stage must explicitly decide:

1. What combination means `ALLOW`?
2. What combination means `CAUTION`?
3. What combination means `RESTRICT`?
4. What combination means `DEFER`?
5. Does `RESTRICT` affect eligibility?
6. Does `CAUTION` affect ranking?
7. Can a governed-PDA action affect scoring at all?
8. Is warning/explanation independent from eligibility?
9. How do sensitivity, reaction, overlap, duplicate, and same-window conflicts resolve?
10. What precedence exists between safety policy and preference ranking?
11. How does legacy count/strength behavior coexist during migration?
12. What observability, shadow, rollback, and activation evidence is required?

8W does not answer these by invention.

## Canonical examples

The frozen example corpus contains 13 authority-boundary cases covering READY/no concern, governed identity overlap, duplicate exfoliation, same-window conflict, sensitivity, recent reaction/instability, each defer/not-applicable gate, multi-active, unknown authority, and legacy-strength conflict.

Every case preserves `production_policy_action = UNSPECIFIED`.

## Lifecycle invariants

- `DECISION_AXIS_PRODUCTION_CONSUMPTION = NO`
- `PRODUCTION_CONSUMPTION_CANONICAL_IMPLEMENTED = NO`
- `PRODUCTION_POLICY_RUNTIME_IMPLEMENTED = NO`
- `PRODUCTION_POLICY_ACTIVATED = NO`
- `PRODUCTION_ACTIVATION_AUTHORIZED = NO`
- `NORMATIVE_ALLOW_RULE_INVENTED = NO`
- `NORMATIVE_CAUTION_RULE_INVENTED = NO`
- `NORMATIVE_RESTRICT_RULE_INVENTED = NO`
- `NEUTRAL_READY_PROMOTED_TO_ALLOW = NO`
- `RECOMMENDATION_SCORER_CHANGED = NO`
- `RECOMMENDATION_RANKER_CHANGED = NO`
- `RECOMMENDATION_ACTIVATED = NO`
- `CANDIDATE_POLICY_PRODUCTION_CHANGED = NO`
- `LEGACY_HEURISTIC_REPLACED = NO`
- `NUMERIC_FITTING = 0`
- `POTENCY_ORDERING_CREATED = NO`
- `HOSTED_PRODUCT_FACT_WRITES = 0`
- `REGISTRY_DEFINITION_DELTA = 0`
- `MIGRATION_DELTA = 0`
