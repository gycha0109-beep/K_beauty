# EVAL-P9 Real Aggregate Calibration Contract v1

## Status

```text
STAGE = EVAL-P9
STAGE_NAME = Real Aggregate Calibration Contract
CONTRACT_STAGE_RESULT = SUCCESS
CALIBRATION_EXECUTION = HOLD
STAGE_SEMANTIC_RESULT = CONTRACT_ESTABLISHED_CALIBRATION_HELD
TERMINAL_OUTCOME = CALIBRATION_HOLD_SOURCE_AND_PRIVACY_AUTHORITY_NOT_ESTABLISHED
```

EVAL-P9 freezes the governance contract required before BEJEWELY Persona artifacts may be calibrated against real aggregate behavior. It does **not** execute real-data calibration, estimate weights, mutate a LOCKED cohort, or convert synthetic evidence into real-user truth.

## Starting authority

```text
P8_MERGED_MAIN = 2bff9f2382d47a0189f71c9ba2b242575cc7b6b8
P6_LOCKED_REGRESSION_COHORT_HASH = c774fc52ae1494c5a4fc39d11d2e7564a196460db391bb94f41d0510b7ae59f8
P6_PERSONA_COUNT = 37
P4_COVERAGE_HASH = ffcd3341fbf408116399ab39cfaa250468baab01e7d5eae3295193996ce0530a
P4_ADVERSARIAL_HASH = 957a8200d12aa5fb27744a65e11831ba69001f82401231bd2694e9aadbc1cbe7
```

## Master Spec boundary

The governing Calibration Principle permits long-term calibration of a synthetic population against **real aggregate behavior**, but only as aggregate population weighting rather than individual user cloning.

Calibration source classes remain distinct:

```text
pre-recommendation user input distribution
!= recommendation-exposed behavior
!= conversion / retention outcome
```

Calibration targets also remain separate:

```text
POPULATION_PRIOR_CALIBRATION
DOMAIN_STATE_DISTRIBUTION_CALIBRATION
DECISION_PREFERENCE_CALIBRATION
INTERACTION_BEHAVIOR_CALIBRATION
```

One signal may not automatically calibrate another Layer. In particular, click/purchase behavior may not be used to infer skin-state prevalence.

For low-count segments, an existing privacy suppression/minimum-cell rule is mandatory. If no such policy exists, the Persona Track must not invent an arbitrary `k`; calibration must HOLD pending separate privacy governance.

## Aggregate source assessment

The stage performed authority discovery only. No row-level real-user records, person identifiers, session histories, or raw questionnaire rows were retrieved.

Connected analytics inspection found a PostHog event schema surface, but the connected project reported **no events seen in the last 30 days**. Reference schema entries are therefore not treated as collected Production data.

Repository inspection found no Persona aggregate calibration instrumentation or authorized aggregate-source definition.

A separate warehouse source could not be established from the available inspection surface. EVAL-P9 therefore makes **no claim that a warehouse source is absent**; it records only that warehouse calibration authority is not established.

Result:

```text
PRODUCTION_AGGREGATE_SOURCE_AUTHORITY = NOT_ESTABLISHED
AGGREGATE_SNAPSHOT_REFERENCE = NONE
AGGREGATE_SNAPSHOT_HASH = NONE
```

## Privacy governance assessment

Repository searches for suppression/minimum-cell/low-count aggregate privacy governance found no predefined Persona calibration policy.

```text
PREDEFINED_SUPPRESSION_POLICY = NOT_ESTABLISHED
AUTHORIZED_MINIMUM_CELL_RULE = NOT_ESTABLISHED
AUTHORIZED_K_VALUE = NONE
PERSONA_TRACK_MAY_INVENT_K = NO
```

Therefore the Master Spec privacy gate requires HOLD.

## Calibration execution disposition

No real aggregate distribution comparison was executed.

```text
CALIBRATION_EXECUTED = NO
AGGREGATE_DISTRIBUTION_COMPARISON = NO
WEIGHTS_ESTIMATED = NO
WEIGHTS_APPLIED = NO
P4_LOCKED_COHORT_MUTATED = NO
P6_LOCKED_REGRESSION_COHORT_MUTATED = NO
SUCCESSOR_CALIBRATED_COHORT_CREATED = NO
```

Future reweighting requires all of the following before execution:

1. an authorized privacy-safe aggregate source and frozen source definition;
2. observation window and aggregation definition;
3. versioned segment-to-Persona-layer mapping;
4. source-selection and recommendation-exposure bias assessment;
5. existing privacy-policy reference and suppression/minimum-cell rule reference;
6. aggregate snapshot reference and hash;
7. explicit weighting semantics with numerator/denominator preservation;
8. a **new** Persona/cohort version with parent lineage rather than in-place mutation of P4/P6 LOCKED artifacts.

## P8 separation

P8 LLM Judge results remain `DIAGNOSTIC_ONLY` and may not become calibration weights or population prevalence targets.

```text
P8_LLM_JUDGE_AUTHORITY = DIAGNOSTIC_ONLY
P8_JUDGE_COUNTS_AS_CALIBRATION_TARGET = FORBIDDEN
P8_REPEATABILITY_AUTHORITY = NOT_ESTABLISHED
```

## Deterministic first-green evidence

First authoritative green candidate:

```text
HEAD = e39e756bcc1b94ba7442143392495599e8e6fc04
RUN = 32460342438
JOB = 96705868592
ARTIFACT_ID = 9438732077
ARTIFACT_DIGEST = sha256:62b1ff5646ccd60a1e2c0a818f54fb86e04f484ea3fa9510c0ab3a4d1c52fa8f
```

P9 semantic hashes:

```text
CONTRACT_SEMANTIC_HASH = 32665a63228828bab96bcd949c992350243044a05fc2daab385a7764195f55de
SOURCE_ASSESSMENT_SEMANTIC_HASH = 853c901cc875d7ba27ed28733af2ce9a3c311c321ae7b66dcd2f7ba20910b31f
SEMANTIC_EVIDENCE_HASH = 5318476dd2aa7ddd75047b9ac4731f9277b1e46f4d7014b05a36a90dfca21492
```

The verifier reproduced identical pass-A/pass-B evidence bytes.

## Recommendation invariance

The first green candidate replayed the exact P6 LOCKED regression cohort against P8 main and the P9 candidate.

```text
PERSONA_COUNT = 37
UNCHANGED = 37
CHANGED = 0
BASELINE_OUTPUT_HASH = 554d97fefe8012b2b0951a21d4b9905ee3eb6f6a816b8453cf28905fec39f27d
CANDIDATE_OUTPUT_HASH = 554d97fefe8012b2b0951a21d4b9905ee3eb6f6a816b8453cf28905fec39f27d
ALL_COMPONENT_DELTAS = 0
KEY_ENGINE_FILE_DELTAS = 0
TERMINAL_CLASSIFICATION = NO_SEMANTIC_DELTA
```

Historical EVAL-P3 deterministic harness, historical 164×12 Recommendation replay, and Production build also passed.

## Authority ceiling

```text
PRODUCTION_RECOMMENDATION_MUTATION = 0
PRODUCT_FACT_MUTATION = 0
HOSTED_WRITE = 0
ORGANIC_EVIDENCE_WRITE = 0
CONTROLLED_PRODUCTION_PROBE = 0
SHADOW_CHANGED = NO
ENFORCE_AUTHORIZED = NO
ENFORCE_ACTIVATED = NO
ROW_LEVEL_REAL_USER_DATA_USED = NO
REAL_USER_TRUTH = NO
MARKET_PREVALENCE_TRUTH = NO
SATISFACTION_OR_CONVERSION_TRUTH = NO
```

## Closeout rule

The first-green hashes above are evidence, not a waiver for later heads. The final PR head and merged `main` must independently reproduce the same contract, source-assessment, and semantic-evidence hashes and preserve P6 zero-delta before EVAL-P9 may be declared closed.

A safe calibration HOLD is the expected authoritative outcome under the current source/privacy state. It is not evidence that calibration is unnecessary, that real-user behavior is absent, or that the synthetic population is representative.
