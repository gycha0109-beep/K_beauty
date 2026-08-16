# V2.1-8X — Exfoliation Non-Numeric PDA Normative Production Policy Decision Contract v1

## Terminal

`NORMATIVE_PRODUCTION_POLICY_DECISION_CONTRACT_FROZEN`

Contract version:

`exfoliation-non-numeric-pda-normative-production-policy-decision-contract-v1`

V2.1-8X closes the authority gap frozen by V2.1-8W by creating an explicit, versioned normative production-policy authority for `exfoliation_load`.

This is a **POLICY_DECISION** contract. Its rules are not `PRODUCT_FACT`, `PDA_FACT`, `EFFICACY_FACT`, or `POTENCY_FACT`.

No production runtime consumer is implemented or activated by this stage.

## Authority baseline

- Repository: `gycha0109-beep/K_beauty`
- 8X base main: `fc5da448cc97572547e14c4a796b57773aa0b8d0`
- Upstream authority-gap contract: `exfoliation-non-numeric-pda-production-policy-authority-gap-v1`
- Hosted project: `bygrczggxfuisupcevaz`
- Hosted baseline: `164 / 1 / 20 / 16 / 16 / 16 / 41 / 41 / 41 / 41 / 180 / 41 / 41 / 16`
- Latest migration: `20260815023734 face_lab_hosted_intake_v1`

## Policy vocabulary

The 8X action vocabulary is namespaced as `policy_action` so it does not collide with existing `RoutinePolicy`, `RecentInstabilityGuardPolicy`, or `CandidateExposurePolicy` values.

### ALLOW

Adequate governed authority exists and no higher-precedence authorized policy concern applies.

**ALLOW does not mean eligible or safe.** It does not grant eligibility, assert zero risk, assert efficacy, or assert potency. It means only that this policy adds no restriction.

- eligibility: `PRESERVE_EXISTING_ELIGIBILITY`
- ranking: `NO_DIRECT_RANK_MUTATION`
- score: `NO_DIRECT_SCORE_MUTATION`
- Top-K: `NO_DIRECT_TOP_K_MUTATION`
- warning: `NO_WARNING_REQUIRED`

### CAUTION

Adequate governed authority exists, but authorized context warrants a visible caution without categorical exclusion.

- eligibility: `PRESERVE_EXISTING_ELIGIBILITY`
- ranking: `NO_DIRECT_RANK_MUTATION`
- score: `NO_DIRECT_SCORE_MUTATION`
- Top-K: `NO_DIRECT_TOP_K_MUTATION`
- warning: `WARNING_REQUIRED`

### RESTRICT

RESTRICT is reserved for already-authoritative external states that themselves encode hard restriction: `hard_block_candidate`, routine `hold`, or same-window `blocked`.

It does not mean high potency or intrinsic product invalidity.

- eligibility: `EXCLUDE_WHEN_POLICY_ENFORCED`
- ranking: `NO_DIRECT_RANK_MUTATION`
- score: `NO_DIRECT_SCORE_MUTATION`
- Top-K: `INDIRECT_VIA_ELIGIBILITY_WHEN_ENFORCED`
- warning: `RESTRICTION_EXPLANATION_REQUIRED`

The exclusion effect is part of the frozen normative contract but is **not active in 8X**.

### DEFER

Authority or required external context is insufficient, blocked, conflicted, or unresolved. DEFER does not mean BLOCK and never becomes ALLOW by default.

- eligibility: `PRESERVE_EXISTING_ELIGIBILITY`
- ranking: `NO_DIRECT_RANK_MUTATION`
- score: `NO_DIRECT_SCORE_MUTATION`
- Top-K: `NO_DIRECT_TOP_K_MUTATION`
- warning: `UNCERTAINTY_EXPLANATION_REQUIRED`

### NOT_APPLICABLE

The governed exfoliation PDA is not applicable. This is neutral, not a negative product judgment.

- eligibility: `PRESERVE_EXISTING_ELIGIBILITY`
- ranking: `NO_DIRECT_RANK_MUTATION`
- score: `NO_DIRECT_SCORE_MUTATION`
- Top-K: `NO_DIRECT_TOP_K_MUTATION`
- warning: `NOT_APPLICABLE_EXPLANATION_OPTIONAL`

## Authority precedence

1. `NOT_APPLICABLE` is retained before all other policy evaluation.
2. Governed authority validity comes next. Any 8U/8V `DEFER_*` remains `DEFER`; external context cannot promote it.
3. On READY only, authorized safety policy states contribute.
4. On READY only, authorized routine policy states contribute.
5. Governed identity overlap may contribute `CAUTION`.
6. Preference/ranking benefit cannot downgrade `CAUTION`, `RESTRICT`, or `DEFER`.
7. Legacy count/strength/scoring disagreement is observational only.

When multiple external contributions coexist on READY, precedence is:

`RESTRICT > DEFER > CAUTION > NONE`

All contributing reason/provenance states must be retained.

## Exact mapping rules

| Input condition | Normative action |
|---|---|
| `NOT_APPLICABLE` neutral gate | `NOT_APPLICABLE` |
| `DEFER_INSUFFICIENT_AUTHORITY` | `DEFER` |
| `DEFER_BLOCKED_AUTHORITY` | `DEFER` |
| `DEFER_CONTEXT_CONFLICT` | `DEFER` |
| READY + `RecentInstabilityGuardPolicy.hard_block_candidate` | `RESTRICT` |
| READY + RoutinePolicy `hold` | `RESTRICT` |
| READY + same-window `blocked` | `RESTRICT` |
| READY + safety `insufficient_data` | `DEFER` |
| READY + routine `check_needed` | `DEFER` |
| READY + safety `allow_with_context` / `soft_penalty_candidate` / `collapsed_exposure_candidate` | `CAUTION` |
| READY + routine `reduce` / same-window `warning` / duplicate exfoliation | `CAUTION` |
| READY + governed identity overlap | `CAUTION` |
| READY + no higher-precedence concern | `ALLOW` |

## Deliberate owner-policy decisions frozen in 8X

The value-laden choices are explicit rather than hidden behind technical terms:

- Duplicate exfoliation and governed identity overlap are `CAUTION` by default, not `RESTRICT`.
- RESTRICT is reserved for external policies that already carry hard-block/hold/blocked semantics.
- RESTRICT maps to future exclusion from new exfoliation recommendation eligibility when and only when enforcement is separately implemented and activated.
- CAUTION does not automatically exclude and does not change numeric score or rank.
- No action directly changes numeric score or rank.
- Preference/ranking benefit cannot override restrictive or cautionary safety/routine authority.
- Multi-active, missing concentration, identity count, and legacy strength cannot create potency ordering.

These choices are authorized as 8X normative policy. They are not scientific claims.

## Safety and routine context

Raw sensitivity or recent-change flags may appear in provenance and explanation, but raw flags alone do not justify RESTRICT. The action contribution follows the already-resolved `RecentInstabilityGuardPolicy` state.

Routine context follows the already-resolved `RoutinePolicy` outputs:

- `hold` / same-window `blocked` → RESTRICT contribution
- `reduce` / same-window `warning` / duplicate exfoliation → CAUTION contribution
- `check_needed` → DEFER contribution
- `keep` / `maintain` → no contribution

This preserves external context as external context. It does not convert routine or user state into Product Fact or intrinsic PDA state.

## Governed-state preservation

The following are intentionally non-escalating by themselves:

- multi-active state
- missing concentration when the upstream non-numeric envelope is otherwise READY
- legacy strength disagreement

`multiple != stronger`

`identity count != potency`

`missing != zero`

`legacy strength != governed PDA potency`

## Warning and explanation contract

Warning/explanation is independent from score and rank.

Every non-ALLOW explanation must include deterministic policy reason codes, authority source, uncertainty, provenance, and contract version. Restriction explanations must identify the external state that justified restriction and must not claim intrinsic product invalidity.

Reason codes are `POLICY_REASON` values only.

## Legacy coexistence

Before any later activation:

- mode is `DUAL_RUN_SHADOW_ONLY`
- new policy output remains separate
- existing production output remains unchanged
- divergence logging is required
- reason/provenance comparison is required
- no automatic legacy replacement
- rollback path is required
- activation is version-gated
- scorer/ranker formulas remain unchanged
- CandidateExposurePolicy remains unchanged

A later implementation may enforce RESTRICT eligibility only through an explicit implementation contract. That enforcement is not part of 8X.

## Activation requirements

A future runtime stage must, at minimum:

1. materialize this frozen contract in shadow without mutating production output;
2. replay canonical cases and governed products;
3. preserve `164 x 12 = 1968` zero-delta production invariance before activation;
4. log policy/legacy divergence with reason and provenance;
5. provide rollback to legacy-only behavior without data migration;
6. keep activation separately version-gated and authorized;
7. implement RESTRICT eligibility explicitly rather than through score/rank coupling.

## Canonical coverage

The deterministic example corpus covers all 17 required decision surfaces:

- READY with no external concern
- governed identity overlap
- duplicate exfoliation
- same-window stacking
- sensitivity
- recent reaction/instability
- multiple external concerns
- all three `DEFER_*` gates
- NOT_APPLICABLE
- multi-active
- missing concentration
- unknown governed authority
- legacy strength disagreement
- safety conflict with preference/ranking benefit
- conflict among multiple external policy states

All examples keep `production_activation = false`.

## Explicit stage invariants

- `DECISION_AXIS_PRODUCTION_CONSUMPTION = NO`
- `PRODUCTION_POLICY_RUNTIME_IMPLEMENTED = NO`
- `PRODUCTION_POLICY_ACTIVATED = NO`
- `PRODUCTION_ACTIVATION_AUTHORIZED = NO`
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
- `NORMATIVE_POLICY_CONTRACT_FROZEN = YES`
- `NORMATIVE_POLICY_RUNTIME_ACTIVE = NO`
