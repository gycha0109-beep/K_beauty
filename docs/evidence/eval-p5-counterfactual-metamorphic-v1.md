# EVAL-P5 Counterfactual / Metamorphic Evaluation v1

## 1. Stage boundary

Stage: `EVAL-P5`

Purpose: execute the seven P2-frozen metamorphic relations as deterministic paired evaluations over the P4 LOCKED technical cohorts, without inventing rank monotonicity, user preference truth, or Production authority.

```text
PRODUCTION_NETWORK_CALLS = 0
HOSTED_WRITES = 0
PRODUCT_FACT_WRITES = 0
ORGANIC_EVIDENCE_WRITES = 0
CONTROLLED_PRODUCTION_PROBES = 0
SHADOW_MODE_CHANGED = NO
ENFORCE_AUTHORIZED_BY_PERSONA = NO
ENFORCE_ACTIVATED_BY_PERSONA = NO
PRODUCTION_CONFIG_CHANGE = 0
LLM_JUDGE_CALLS = 0
```

Synthetic evidence remains `SYNTHETIC_SIMULATION_EVIDENCE`.

## 2. Repository authority

P4 merged authority:

```text
a4772e3cd44d68f67fe4bbf25926ba0942f353b3
```

P5 execution base after live revalidation:

```text
6a18af5a992eb6a70e2006361e99456e3b491ed2
```

The intervening V2.1-9P merge is additive ENFORCE reassessment normative-acceptance governance. It does not modify the Persona-facing Recommendation authorities.

Current blob readback at the P5 execution base:

```text
lib/survey-input-contract.js
  0ad41d8328caf1939789063ab3bc06391a2a94d1

lib/recommendation-scoring.ts
  45358401d80e5edd8c92d303462f2a415196590c

lib/skin-match-decision-engine.js
  13945cb21c0acec1c303eedfa2b9b6000f6e066d

app/api/analyze/route.js
  cc059eba680034d28e1ade0b1a8147d43a8b30f7
```

These remain identical to the P2/P3 frozen implementation references.

```text
INTERVENING_DRIFT = V2.1_9P_GOVERNANCE_ONLY
PERSONA_OR_RECOMMENDATION_RELATED_DRIFT = NO
```

## 3. Upstream Persona authority

P5 does not regenerate or mutate the P4 cohorts.

Authoritative P4 manifest:

```text
fixtures/persona-evaluation/eval-p4-cohort-freeze-manifest-v1.json
```

P4 manifest semantic hash:

```text
31acc3c76ad45fc0aa5006529e3d3dc488ddbaea14b6af99b69800980bf0ed7c
```

P5 reconstructs the underlying materialized Personas from the immutable P3 source SHA:

```text
4265450ddcf40bdb4359a3d5c82d22b00a1024dd
```

and then selects exactly the P4 LOCKED member IDs.

Expected technical cohort input:

```text
COVERAGE_COHORT
  cohort_id = eval-p4-coverage-cohort-v1
  lifecycle = LOCKED
  personas = 29
  hash = ffcd3341fbf408116399ab39cfaa250468baab01e7d5eae3295193996ce0530a

ADVERSARIAL_COHORT
  cohort_id = eval-p4-adversarial-cohort-v1
  lifecycle = LOCKED
  personas = 8
  hash = 957a8200d12aa5fb27744a65e11831ba69001f82401231bd2694e9aadbc1cbe7

POPULATION_PRIOR_COHORT
  lifecycle = DEFERRED_NOT_LOCKED
  personas = 0
```

Paired counterfactual scenarios derived in P5 are evaluation cases, not new cohort members. P5 does not mutate a LOCKED Persona in place.

## 4. Evaluation contract

Frozen P5 execution contract:

```text
fixtures/persona-evaluation/eval-p5-metamorphic-evaluation-contract-v1.json
```

Versions:

```text
P2 metamorphic registry = persona-metamorphic-registry-v1
P5 evaluator = eval-p5-counterfactual-metamorphic-evaluator-v1
P5 scenario generator = eval-p5-paired-scenario-generator-v1
```

A semantic change to the P5 evaluation method requires a new version.

## 5. Pair semantics

Each applicable P5 pair must satisfy:

```text
before Domain Persona
vs
after Domain Persona

raw input path difference count = exactly 1
changed path = relation.controlled_path
```

The source LOCKED Persona supplies the unchanged background context. The pair may normalize the controlled field to the relation's frozen before/after endpoints; that does not rewrite the source Persona.

Pair preconditions are evaluated explicitly. A source Persona that does not satisfy a relation precondition is recorded as:

```text
PAIR_PRECONDITION_NOT_MET
```

and is not counted as a relation failure.

## 6. Frozen relations executed

P5 executes exactly the seven relations frozen in P2.

### MR-GENDER-001

```text
controlled change:
  profile.genderPreference
  unspecified -> female

product predicate:
  is_mens = true

hard assertion level:
  Recommendation eligibility

expected:
  target product eligible before
  target product ineligible after
```

### MR-SUN-EYE-001

```text
controlled change:
  sunscreen.eyeSensitive
  false -> true

precondition:
  sunscreen.preferenceState = answered

product predicate:
  sunscreen AND eye_sting = high

hard assertion level:
  hard-rejected set
```

### MR-SUN-WHITECAST-001

```text
controlled change:
  sunscreen.whiteCastHate
  false -> true

preconditions:
  sunscreen.preferenceState = answered
  sunscreen.toneUpWanted = false

product predicate:
  sunscreen AND white_cast = high

hard assertion level:
  strict candidate set
```

Penalty-only fallback may still retain the product after strict filtering. Therefore global final-result exclusion and exact rank movement are not asserted.

### MR-SUN-MAKEUP-001

```text
controlled change:
  sunscreen.makeupUse
  false -> true

precondition:
  sunscreen.preferenceState = answered

product predicate:
  sunscreen AND pilling_risk = high

hard assertion level:
  strict candidate set
```

Penalty-only fallback remains a known exception to final-result exclusion.

### MR-SUN-SENSITIVITY-001

```text
controlled change:
  sensitivity
  source low|medium -> high

preconditions:
  source sensitivity in {low, medium}
  primaryConcern not in {redness, barrier}
  routeExtensions.verySensitivePeriod = false

product predicate:
  sunscreen AND irritation_risk = high

hard assertion level:
  hard-rejected set
```

### MR-DERIVED-DRYNESS-001

```text
controlled change:
  postWashFeeling
  comfortable -> tight

precondition:
  afternoonSkinChange != more_dry

hard assertion level:
  survey-derived state

expected:
  drynessRisk non-high -> high
```

No Recommendation rank direction is frozen.

### MR-DERIVED-REDNESS-001

```text
controlled change:
  afternoonSkinChange
  mostly_same -> red_or_irritated

precondition:
  before rednessRisk is not already high from another governed signal

hard assertion level:
  survey-derived state

expected:
  rednessRisk non-high -> high
```

No Recommendation rank direction is frozen.

## 7. Product comparison classifications

A relation-level product predicate can interact with an independent constraint already active in the same Persona context.

Example:

```text
eye_sting = high sunscreen
+
product already rejected before eyeSensitive changes
because another hard constraint applies
```

P5 does not misclassify this as a failure or a successful marginal effect.

Classification:

```text
MASKED_BY_OTHER_CONSTRAINT
```

Only a product whose relevant before-state is evaluable contributes to the hard before/after assertion.

If the frozen 164-product catalog has no product satisfying a relation predicate, P5 records:

```text
CATALOG_PRODUCT_PREDICATE_NOT_OBSERVED
```

This is not silently converted to a passing Product Fact claim.

## 8. Evaluator-only isolated probes

For code/policy-backed product relations, P5 also uses a minimal deterministic product fixture that isolates the single policy predicate under test.

Authority:

```text
EVALUATOR_RULE_FIXTURE_NOT_CATALOG_TRUTH
```

These probes can establish that the frozen relation is executable in the current code path. They cannot establish that such a product exists in the catalog, cannot create Product Fact, and cannot establish real-user preference truth.

Every applicable product relation pair must pass its isolated probe. A probe violation is a hard P5 failure.

## 9. Full Recommendation output boundary

P5 also executes the current Skin Match Decision Engine with the frozen 164-product Recommendation fixture for each before/after pair.

It records deterministic output identities such as:

```text
Top Pick ID
Alternative ID
priority identity
category-pick IDs
```

However:

```text
FULL_RECOMMENDATION_DELTA_AUTHORITY = DIAGNOSTIC_ONLY
RANK_MONOTONICITY_HARD_ASSERTION = NO
```

A Top Pick change is an observation. A lack of Top Pick change is also an observation. Neither is automatically a metamorphic failure unless P2 explicitly froze that Recommendation-level direction.

This prevents P5 from manufacturing intuitive but unauthorized rank rules.

## 10. Request-contract normalization check

For every before and after Domain Persona, P5 checks that:

```text
canonical Domain -> toRecommendationAnswers -> Recommendation normalization
```

and:

```text
canonical Domain -> P3 route-like payload -> route-pinned materialization -> Recommendation normalization
```

produce the same canonical normalized Recommendation answers.

This is an offline contract check. Public `/api/analyze` is not called.

## 11. Deterministic replay

The complete P5 semantic evaluation is executed twice under identical:

```text
LOCKED cohort
P2 relation contract
P5 evaluator contract
Recommendation code
frozen catalog fixture
```

The two semantic hashes must be identical.

Volatile CI metadata and artifact IDs are excluded from the semantic evaluation payload.

## 12. Acceptance contract

P5 passes only when:

```text
- P4 LOCKED cohort hashes reconstruct exactly
- Population-Prior remains 0 / DEFERRED_NOT_LOCKED
- all seven P2 frozen metamorphic relations have at least one applicable pair
- every applicable pair changes exactly one raw input path
- every before/after route normalization check is equivalent
- every isolated policy probe passes
- zero evaluable catalog metamorphic violations are observed
- zero derived-state metamorphic violations are observed
- masked comparisons remain typed, not treated as pass/fail evidence
- full Recommendation deltas remain DIAGNOSTIC_ONLY
- deterministic semantic replay hashes are equal
- P3 deterministic harness replay passes
- historical 164x12 Recommendation replay passes
- production build passes
```

There is no invented target such as `95% metamorphic accuracy`. Hard frozen relations are deterministic invariants; applicable violations are not averaged away.

## 13. Failure taxonomy

P5 preserves at least:

```text
PAIR_PRECONDITION_NOT_MET
MASKED_BY_OTHER_CONSTRAINT
CATALOG_PRODUCT_PREDICATE_NOT_OBSERVED
METAMORPHIC_VIOLATION
DERIVED_STATE_VIOLATION
ROUTE_NORMALIZATION_DIVERGENCE
```

A hard relation failure is not compensated by a different relation passing.

## 14. Cohort weighting and comparability

P4 Coverage and Adversarial cohorts remain unweighted technical cohorts.

P5 may report relation execution counts separately by cohort to make test coverage visible, but:

```text
Coverage pass count vs Adversarial pass count
!= population quality comparison

Coverage raw rate vs Adversarial raw rate
!= market prevalence comparison
```

P5 does not aggregate them into a market-level success rate.

## 15. Authority ceiling

```text
EVIDENCE_CLASS = SYNTHETIC_SIMULATION_EVIDENCE
ORGANIC_PRODUCTION_EVIDENCE = NO
CONTROLLED_PRODUCTION_EVIDENCE = NO
REAL_USER_TRUTH = NO
MARKET_PREVALENCE = NO
SATISFACTION_OR_CONVERSION_TRUTH = NO
PRODUCT_FACT_AUTHORITY = NO
ENFORCE_AUTHORITY = NO
LLM_JUDGE_AUTHORITY = NOT_USED
```

## 16. Provisional execution state

Before exact-head execution completes:

```text
STAGE = EVAL-P5
EXECUTION_STATUS = PENDING_AUTHORITATIVE_CI
TERMINAL_OUTCOME = NOT_YET_CLAIMED
```

The final relation counts, pair counts, catalog predicate observations, semantic hashes, exact-head CI evidence, merged-main CI evidence, and production deployment authority are appended only after those executions complete.
