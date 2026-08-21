# EVAL-P5 Counterfactual / Metamorphic Evaluation v1

## 1. Stage boundary

Stage: `EVAL-P5`

Purpose: execute the seven P2-frozen counterfactual/metamorphic relations as deterministic paired evaluations over the P4 LOCKED technical cohorts without inventing rank monotonicity, real-user preference truth, Product Fact authority, or Production/ENFORCE authority.

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

The intervening V2.1-9P merge is additive ENFORCE reassessment normative-acceptance governance only.

Persona-facing Recommendation authorities remained unchanged:

```text
survey contract blob
0ad41d8328caf1939789063ab3bc06391a2a94d1

Recommendation scorer blob
45358401d80e5edd8c92d303462f2a415196590c

Skin Decision engine blob
13945cb21c0acec1c303eedfa2b9b6000f6e066d

/api/analyze route blob
cc059eba680034d28e1ade0b1a8147d43a8b30f7
```

Classification:

```text
INTERVENING_DRIFT = V2.1_9P_GOVERNANCE_ONLY
PERSONA_OR_RECOMMENDATION_RELATED_DRIFT = NO
```

## 3. LOCKED cohort authority

P5 does not regenerate or mutate the P4 cohorts.

Authoritative P4 manifest:

```text
fixtures/persona-evaluation/eval-p4-cohort-freeze-manifest-v1.json
```

P4 manifest semantic hash:

```text
31acc3c76ad45fc0aa5006529e3d3dc488ddbaea14b6af99b69800980bf0ed7c
```

P5 reconstructs source Personas from immutable P3 authority:

```text
4265450ddcf40bdb4359a3d5c82d22b00a1024dd
```

and selects exactly the P4 LOCKED IDs.

```text
COVERAGE_COHORT
  lifecycle = LOCKED
  personas = 29
  hash = ffcd3341fbf408116399ab39cfaa250468baab01e7d5eae3295193996ce0530a

ADVERSARIAL_COHORT
  lifecycle = LOCKED
  personas = 8
  hash = 957a8200d12aa5fb27744a65e11831ba69001f82401231bd2694e9aadbc1cbe7

TOTAL_LOCKED_TECHNICAL_PERSONAS = 37

POPULATION_PRIOR_COHORT
  lifecycle = DEFERRED_NOT_LOCKED
  personas = 0
```

Counterfactual before/after cases are evaluation cases only. They are not new cohort members and do not mutate LOCKED Personas in place.

## 4. Frozen evaluation versions

```text
P2 metamorphic registry
persona-metamorphic-registry-v1

P5 evaluator
eval-p5-counterfactual-metamorphic-evaluator-v1.1

P5 paired scenario generator
eval-p5-paired-scenario-generator-v1

P5 policy fixture projection
eval-p5-metadata-restored-fixture-projection-v1
```

Authoritative contract:

```text
fixtures/persona-evaluation/eval-p5-metamorphic-evaluation-contract-v1.json
```

## 5. Pair semantics

Every applicable pair satisfies:

```text
before Domain Persona
vs
after Domain Persona

raw input path difference count = exactly 1
changed path = relation.controlled_path
```

A source Persona that does not satisfy a frozen precondition is recorded as:

```text
PAIR_PRECONDITION_NOT_MET
```

and is not counted as a relation failure.

The source LOCKED Persona remains immutable.

## 6. Seven frozen relations

P5 executes exactly the seven P2 relations:

```text
MR-GENDER-001
MR-SUN-EYE-001
MR-SUN-WHITECAST-001
MR-SUN-MAKEUP-001
MR-SUN-SENSITIVITY-001
MR-DERIVED-DRYNESS-001
MR-DERIVED-REDNESS-001
```

Hard assertion levels remain those frozen in P2:

```text
MR-GENDER-001              Recommendation eligibility
MR-SUN-EYE-001             hard-rejected set
MR-SUN-WHITECAST-001       strict candidate set
MR-SUN-MAKEUP-001          strict candidate set
MR-SUN-SENSITIVITY-001     hard-rejected set
MR-DERIVED-DRYNESS-001     survey-derived state
MR-DERIVED-REDNESS-001     survey-derived state
```

For white-cast and makeup relations, penalty-only fallback is preserved as a known exception to global final-result exclusion.

Exact rank movement is not a hard assertion for any relation.

## 7. Historical fixture views

Historical Recommendation reference:

```text
783afb91a964f5d762f46846f9ef854902b48e95
```

Frozen fixture:

```text
product count = 164
sunscreen count = 11
catalog declared SHA-256 = e4788383a21ac4207d553fbfb5300dc629b8eab5ad200ffd1313d43e94e0c856
```

P5 explicitly separates two fixture views.

### 7.1 Legacy replay view

```text
buildRecommendationProductFromSource(raw_fixture_product)
```

Authority:

```text
P3_AND_HISTORICAL_REPLAY_COMPATIBILITY_ONLY
```

This view is retained unchanged so P5 cannot rewrite the P3 or historical 164x12 regression baseline to make itself pass.

### 7.2 Policy evaluation view

The historical fixture can preserve Recommendation/scoring fields under `metadata`. Current `buildRecommendationProductFromSource()` reads canonical source fields from the source-row top level.

P5 therefore audits a source-faithful restoration view:

```text
raw fixture identity/category retained
+
existing raw_fixture.metadata fields restored to canonical source fields
+
buildRecommendationProductFromSource(...)
```

Rules:

```text
restoration source = HISTORICAL_FIXTURE_METADATA_ONLY
invented values = forbidden
Product Fact mutation = forbidden
Production runtime claim = forbidden
```

The policy-view predicate membership must exactly equal predicate membership observable from the frozen fixture source itself.

## 8. Fixture projection investigation

The first P5 implementation observed zero policy-target products after legacy materialization. This was not accepted as evidence that the fixture truly lacked those predicates.

P5 therefore re-ran with explicit source-vs-legacy-vs-policy projection comparison.

Result:

```text
legacy_projection_gap_relations = []
```

The metadata-restored policy view preserved source predicate membership exactly.

Therefore the zero target count was not a hidden projection defect.

The frozen historical fixture itself contains zero target products for all five product-policy relations:

```text
MR-GENDER-001
  is_mens = true
  frozen fixture targets = 0

MR-SUN-EYE-001
  sunscreen AND eye_sting = high
  frozen fixture targets = 0

MR-SUN-WHITECAST-001
  sunscreen AND white_cast = high
  frozen fixture targets = 0

MR-SUN-MAKEUP-001
  sunscreen AND pilling_risk = high
  frozen fixture targets = 0

MR-SUN-SENSITIVITY-001
  sunscreen AND irritation_risk = high
  frozen fixture targets = 0
```

Classification:

```text
FROZEN_FIXTURE_PRODUCT_PREDICATE_COVERAGE_GAP
```

This classification is restricted to the frozen historical fixture.

It is explicitly NOT:

```text
current Production catalog absence
Product Fact absence
real-user absence
market prevalence evidence
Recommendation policy failure
```

Downstream ownership:

```text
EVAL-P7 — Catalog Gap / Product Gap
```

## 9. Isolated policy probes

Because the frozen fixture does not contain the five product-policy predicates, P5 uses minimal deterministic evaluator fixtures to establish execution of the frozen code/policy relation itself.

Authority:

```text
EVALUATOR_RULE_FIXTURE_NOT_CATALOG_TRUTH
```

These probes:

- do not create Product Fact;
- do not claim such products exist in current Production;
- do not establish market prevalence;
- do not establish user preference truth;
- cannot substitute for the P7 catalog/product-gap track.

Every applicable product-policy pair passed its isolated probe.

## 10. Product comparison masking taxonomy

When a real frozen-fixture target is available in a future compatible fixture, a product already excluded by an independent constraint before the controlled change is classified:

```text
MASKED_BY_OTHER_CONSTRAINT
```

It is not counted as either a marginal-effect pass or a metamorphic violation.

Current P5 frozen fixture has no target predicate products, so:

```text
policy_product_comparisons = 0
policy_masked_by_other_constraints = 0
policy_metamorphic_violations = 0
```

This zero comparison count is preserved as a coverage gap rather than represented as catalog-integrated validation.

## 11. Full Recommendation delta boundary

P5 executes the current Skin Match Decision Engine with the policy evaluation fixture view for every applicable before/after pair and records deterministic Recommendation identities.

Observed full Recommendation Top Pick changes:

```text
27 / 177 applicable pairs
```

Relation-level diagnostic Top Pick changes:

```text
MR-GENDER-001              0
MR-SUN-EYE-001             2
MR-SUN-WHITECAST-001       0
MR-SUN-MAKEUP-001          1
MR-SUN-SENSITIVITY-001     8
MR-DERIVED-DRYNESS-001    12
MR-DERIVED-REDNESS-001     4
```

Authority:

```text
FULL_RECOMMENDATION_DELTA_AUTHORITY = DIAGNOSTIC_ONLY
RANK_MONOTONICITY_HARD_ASSERTION = NO
```

Neither a Top Pick change nor a lack of Top Pick change is treated as a hard metamorphic result unless P2 explicitly froze that level of behavior.

## 12. Authoritative pair execution results

Corrected authoritative pre-closeout execution:

```text
implementation head
885fa08718d01281e99cb4a80731191698c4cd48

GitHub Actions run
32445229092

job
96663492147

result
SUCCESS
```

Aggregate execution:

```text
relations = 7
LOCKED Personas = 37
possible source x relation combinations = 259
applicable pairs = 177
precondition exclusions = 82
hard violations = 0
full Recommendation Top Pick changes = 27
LLM Judge calls = 0
```

Relation results:

| Relation | Applicable | Excluded | Frozen-fixture target products | Hard violations | Top Pick changes |
|---|---:|---:|---:|---:|---:|
| MR-GENDER-001 | 37 | 0 | 0 | 0 | 0 |
| MR-SUN-EYE-001 | 28 | 9 | 0 | 0 | 2 |
| MR-SUN-WHITECAST-001 | 18 | 19 | 0 | 0 | 0 |
| MR-SUN-MAKEUP-001 | 28 | 9 | 0 | 0 | 1 |
| MR-SUN-SENSITIVITY-001 | 15 | 22 | 0 | 0 | 8 |
| MR-DERIVED-DRYNESS-001 | 27 | 10 | n/a | 0 | 12 |
| MR-DERIVED-REDNESS-001 | 24 | 13 | n/a | 0 | 4 |

Product-policy isolated-probe executions:

```text
MR-GENDER-001             37 / 37 PASS
MR-SUN-EYE-001            28 / 28 PASS
MR-SUN-WHITECAST-001      18 / 18 PASS
MR-SUN-MAKEUP-001         28 / 28 PASS
MR-SUN-SENSITIVITY-001    15 / 15 PASS
```

Derived-state hard evaluations:

```text
MR-DERIVED-DRYNESS-001
  applicable = 27
  violations = 0

MR-DERIVED-REDNESS-001
  applicable = 24
  violations = 0
```

## 13. Pair precondition exclusions

The 82 non-applicable source/relation combinations remain typed rather than silently dropped:

```text
AFTERNOON_MORE_DRY_MASKS_CONTROLLED_CHANGE = 10
PRIMARY_CONCERN_PRECONDITION_NOT_MET = 7
REDNESS_ALREADY_HIGH_FROM_OTHER_SIGNAL = 13
SOURCE_SENSITIVITY_NOT_LOW_OR_MEDIUM = 12
SUNSCREEN_PREFERENCE_NOT_ANSWERED = 27
TONE_UP_PRECONDITION_NOT_MET = 10
VERY_SENSITIVE_PERIOD_PRECONDITION_NOT_MET = 3
```

These are relation applicability exclusions, not failures.

## 14. Deterministic semantic replay

The complete P5 semantic evaluation was executed twice under identical cohort, contracts, code, and frozen fixture authority.

```text
evaluation_semantic_hash
ad7b6cb42af1b2d78ac033adacb535b43b8b4c424bc807ad5ab5a1ffa365523d

replay_semantic_hash
ad7b6cb42af1b2d78ac033adacb535b43b8b4c424bc807ad5ab5a1ffa365523d

contract_semantic_hash
7f90c88cd333f0596d13d644a557d6cd30d7283d479ad95e9c6f3ae153b7d313
```

Result:

```text
DETERMINISTIC_SEMANTIC_REPLAY = PASS
```

## 15. Regression and build preservation

The same exact-head CI also passed:

```text
P4 LOCKED cohort reconstruction = PASS
P3 deterministic Persona harness replay = PASS
historical 164x12 Recommendation replay = PASS
production build = PASS
```

The P5 result therefore does not depend on modifying Production Recommendation code or rewriting historical regression authority.

## 16. Artifact authority

Pre-closeout passing artifact:

```text
artifact id = 9433845835
artifact name = eval-p5-counterfactual-metamorphic-885fa08718d01281e99cb4a80731191698c4cd48
artifact ZIP SHA-256 = 46baedf4fcba0264a874e8030d68cbb23b144915748380c2294ab78969f0c599
```

Artifact terminal classification:

```text
SUCCESS_WITH_FROZEN_FIXTURE_PRODUCT_PREDICATE_GAP
```

The exact branch head containing this closeout document must independently pass the same CI before merge. The external GitHub exact-SHA status is authoritative; this document does not self-attest its later run.

## 17. Acceptance results

```text
deterministic semantic hash replay = PASS
seven frozen relations executed = PASS
every relation has applicable pairs = PASS
all hard relation evaluations = PASS
one raw input path changed per pair = PASS
route normalization equivalence = PASS
policy fixture projection preserves source predicate membership = PASS
frozen fixture predicate absence typed, not hidden = PASS
legacy fixture projection gap typed, not hidden = PASS
rank monotonicity not used as hard assertion = PASS
full Recommendation deltas diagnostic-only = PASS
masked constraints not counted as failures = PASS
evaluator probes not catalog truth = PASS
synthetic evidence remains evaluation-only = PASS
```

No opaque quality percentage or pass-rate threshold is used.

## 18. Authority ceiling

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

The frozen-fixture predicate gap is `DIAGNOSTIC_ONLY` and does not establish a current Production catalog fact.

## 19. P5 terminal outcome

Semantic terminal result:

```text
STAGE = EVAL-P5
SEMANTIC_RESULT = SUCCESS
TERMINAL_OUTCOME = SUCCESS_WITH_FROZEN_FIXTURE_PRODUCT_PREDICATE_GAP

LOCKED_PERSONAS = 37
APPLICABLE_PAIRS = 177
PRECONDITION_EXCLUSIONS = 82
HARD_VIOLATIONS = 0
TOP_PICK_DIAGNOSTIC_CHANGES = 27

PRODUCT_POLICY_RELATIONS = 5
FROZEN_FIXTURE_PRODUCT_POLICY_TARGET_RELATIONS = 0
PRODUCT_POLICY_RELATIONS_VALIDATED_BY_ISOLATED_PROBE = 5

DERIVED_STATE_RELATIONS = 2
DERIVED_STATE_VIOLATIONS = 0

PRODUCTION_OR_GOVERNANCE_AUTHORITY_CHANGE = NO
```

P5 therefore validates the frozen relation mechanics and derived-state metamorphic behavior while preserving an explicit limitation: the historical 164-product fixture does not contain products that exercise the five frozen product-policy predicates. That limitation is carried forward to the catalog/product-gap track rather than converted into fictitious catalog evidence.
