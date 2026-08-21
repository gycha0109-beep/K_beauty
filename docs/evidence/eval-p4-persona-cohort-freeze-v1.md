# EVAL-P4 Population-Prior / Coverage / Adversarial Cohort Freeze v1

## 1. Stage boundary

Stage: `EVAL-P4`

Purpose: promote only currently authorized, reproducible Persona cohorts into immutable official cohort artifacts, while preserving the explicit hold on Population-Prior adoption.

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

Synthetic evidence remains evaluation-only authority.

## 2. Repository authority

P3 merged source authority:

```text
4265450ddcf40bdb4359a3d5c82d22b00a1024dd
```

P4 execution base after live revalidation:

```text
7806d6956d5d82743d176eb4c58959ee84b698c5
```

Intervening V2.1-9O changes are additive exfoliation calibration-governance artifacts. Current Persona-facing Recommendation authorities remain unchanged:

```text
survey contract blob = 0ad41d8328caf1939789063ab3bc06391a2a94d1
Recommendation scorer blob = 45358401d80e5edd8c92d303462f2a415196590c
Skin Decision engine blob = 13945cb21c0acec1c303eedfa2b9b6000f6e066d
/api/analyze route blob = cc059eba680034d28e1ade0b1a8147d43a8b30f7
```

Classification:

```text
INTERVENING_DRIFT = V2.1_9O_GOVERNANCE_ONLY
PERSONA_OR_RECOMMENDATION_RELATED_DRIFT = NO
```

V2.1-9O itself preserves that synthetic/Persona evidence cannot substitute for organic Production maturity and does not authorize ENFORCE.

## 3. P2 authority applied

P2 froze:

```text
AUTHORIZED_POPULATION_DATASET_V1 = NONE
AUTHORIZED_POPULATION_FIELD_REGISTRY_V1 = EMPTY
POPULATION_PRIOR_COHORT_LOCK_ALLOWED = NO
```

P2 also states that P3 technical fixtures do not automatically become a LOCKED official cohort. EVAL-P4 therefore performs an explicit promotion audit rather than merely renaming P3 fixtures.

A `LOCKED` cohort is immutable in place. Any semantic membership, Persona value, sampling, weighting, provenance, deduplication, or interpretation change requires a new version.

## 4. Freeze artifact and immutable reconstruction

Authoritative manifest:

```text
fixtures/persona-evaluation/eval-p4-cohort-freeze-manifest-v1.json
```

Immutable P3 reconstruction authority:

```text
source repository SHA = 4265450ddcf40bdb4359a3d5c82d22b00a1024dd
source materializer = scripts/persona-evaluation/eval-p3-contracts.mjs
source combined cohort hash = c00426432a8481fd8a16cd38110f29bbaf87c42d389560bd40c0b33c97a64cf9
source Coverage payload hash = 84910f8d4dac534226093734f9befe96d42ced2c369981bcd0e9ef4dde48088b
source Adversarial payload hash = 957a8200d12aa5fb27744a65e11831ba69001f82401231bd2694e9aadbc1cbe7
```

P4 CI reconstructs P3 from the immutable Git SHA rather than trusting future `main` materializer behavior.

## 5. Coverage collapse discovered during freeze audit

The first P4 exact-head run reached the cohort reconstruction gate after authority, bounded-scope, Production-mutation, syntax, and P3-source checks passed.

Diagnostic run:

```text
GitHub Actions run = 32439159163
job = 96646221870
failure gate = EVAL-P4 locked cohort reconstruction
finding = Coverage Persona collapse detected
```

The P3 technical Coverage set contains 32 Persona records but only 29 unique canonical Domain states.

Exact duplicates:

```text
P3-C27 duplicates P3-C03
P3-C28 duplicates P3-C04
P3-C31 duplicates P3-C07
```

P3 remains valid as its declared technical PoC fixture set, but promoting all 32 records into an unweighted official Coverage cohort would unintentionally give three Domain states duplicate representation.

P4 therefore freezes an explicit deterministic deduplication rule:

```text
FIRST_OCCURRENCE_BY_P3_SOURCE_ORDER_PER_CANONICAL_DOMAIN_HASH
```

Excluded duplicate records:

```text
P3-C27
P3-C28
P3-C31
```

This is a P4 cohort-promotion decision; it does not mutate or rewrite P3 history.

## 6. COVERAGE_COHORT v1

Promotion after collapse remediation:

```text
cohort_id = eval-p4-coverage-cohort-v1
lifecycle = LOCKED
source_persona_count = 32
locked_persona_count = 29
unique_domain_patterns = 29
sampler_version = eval-p4-coverage-dedup-first-occurrence-v1
cohort_hash = ffcd3341fbf408116399ab39cfaa250468baab01e7d5eae3295193996ce0530a
hash definition = SHA-256 over canonical locked Persona array
weighting_strategy = NONE
prng_algorithm = NONE
seed = 0
```

Authority:

```text
SYNTHETIC_COVERAGE_COHORT_EVIDENCE
```

Interpretation:

- designed technical coverage only;
- not a Korean-population sample;
- not a market-prevalence estimate;
- raw rates cannot be compared directly with Adversarial or future Population-Prior cohorts;
- `CURRENT_ENGINE_INPUT_DOMAIN / INDEPENDENT_BY_DESIGN` provenance is preserved.

## 7. ADVERSARIAL_COHORT v1

The P3 Adversarial source has no duplicate Domain states and is preserved exactly.

```text
cohort_id = eval-p4-adversarial-cohort-v1
lifecycle = LOCKED
source_persona_count = 8
locked_persona_count = 8
unique_domain_patterns = 8
sampler_version = eval-p4-adversarial-explicit-lock-v1
cohort_hash = 957a8200d12aa5fb27744a65e11831ba69001f82401231bd2694e9aadbc1cbe7
weighting_strategy = NONE
prng_algorithm = NONE
seed = 0
```

Authority:

```text
SYNTHETIC_ADVERSARIAL_COHORT_EVIDENCE
```

Interpretation:

- deliberate stress assignments only;
- failure rate is not real-user failure prevalence;
- `EXPLORATORY_STRESS_ASSIGNMENT / EXPLORATORY_STRESS_CORRELATION` provenance is preserved;
- no demographic realism claim is permitted.

## 8. POPULATION_PRIOR_COHORT

P4 does not fabricate a Population-Prior lock.

```text
lifecycle = DEFERRED_NOT_LOCKED
persona_count = 0
authorized_population_dataset = NONE
lock_allowed = false
reason = P2_REVISION_SPECIFIC_ADOPTION_RECORD_NOT_FROZEN
```

### 8.1 NVIDIA Nemotron-Personas-Korea revalidation

Public-source observations captured on 2026-08-21:

```text
candidate = nvidia/Nemotron-Personas-Korea
dataset version observed = 1.0
main revision observed = ada0f5b53a38bb5a30cce09358adde883c1ab63a
data revision observed = 03d5650aecd88bceaf142fd7e0059ad8fb288341
record count observed = 1,000,000
license observed = CC BY 4.0
commercial use = allowed subject to license terms
```

It remains a viable future Layer-A candidate, but P2 requires a revision-specific adoption record including `dataset_card_hash`, license/provenance fields, and redistribution/privacy limitations. P4 does not invent the missing byte-reproducible dataset-card hash or waive the P2 contract.

Decision:

```text
HOLD_FOR_REVISION_PINNED_ADOPTION_RECORD
```

Even after future adoption, Population fields remain Layer-A sampling/segmentation metadata and do not automatically derive K-beauty Domain fields.

### 8.2 PersonaHub revalidation

Public-source observations captured on 2026-08-21:

```text
candidate = proj-persona/PersonaHub
current dataset license observed = CC BY-NC-SA 4.0
official repository usage note = intended for research purposes only
Korean population-prior specificity = NOT_ESTABLISHED
```

Decision:

```text
RESEARCH_REFERENCE_ONLY_NOT_POPULATION_SEED
```

P4 does not make PersonaHub a commercial Population-Prior dependency.

## 9. LOCKED_REGRESSION_COHORT

P4 does not silently reinterpret the two technical cohorts as one regression cohort.

```text
LOCKED_REGRESSION_COHORT = NOT_CREATED
```

Regression infrastructure remains an EVAL-P6 concern. EVAL-P5 may use the independently locked Coverage and Adversarial cohorts for deterministic counterfactual/metamorphic evaluation.

## 10. Weighting and comparability

Both locked technical cohorts retain:

```text
weighting_strategy = NONE
```

Therefore:

```text
coverage raw rate != market prevalence
adversarial raw rate != user failure prevalence
coverage rate vs adversarial rate = NOT A VALID QUALITY COMPARISON
```

Future Population-Prior weighting must preserve upstream population-prior semantics and cannot inherit these technical distributions.

## 11. Persona-collapse protection after promotion

P4 verifier requires and the corrected run established:

```text
P3 source Coverage = 32 records / 29 unique Domain states
LOCKED Coverage = 29 records / 29 unique Domain states
LOCKED Adversarial = 8 records / 8 unique Domain states
Combined LOCKED technical cohort union = 37 records / 37 unique Domain states
```

Observed locked-domain distributions are diagnostic coverage descriptors only:

```text
skinType:
  combination = 8
  dry = 10
  not_sure = 9
  oily = 10

sensitivity:
  high = 12
  low = 12
  medium = 13

primaryConcern:
  acne = 4
  barrier = 5
  dehydration = 5
  oiliness = 5
  pores = 4
  redness = 5
  uneven_tone = 4
  uv = 5

sunscreenPreferenceState:
  answered = 28
  skipped = 4
  unknown = 5
```

These counts are fixture composition, not population frequencies.

## 12. Corrected authoritative execution

First corrected exact-head execution that passed the complete P4 gate:

```text
implementation/evidence head = 4da035f053aeec93ad63f2d940e1b6bf59a0a960
GitHub Actions run = 32439456276
job = 96647111015
result = SUCCESS
```

Passed stages:

```text
exact authority / ancestry
bounded EVAL-P4 scope
no Production Recommendation / Product Fact / Hosted mutation
syntax / manifest parse
immutable P3 materialization-source preparation
EVAL-P4 locked cohort reconstruction
frozen Recommendation reference preparation
EVAL-P3 deterministic harness replay
historical 164x12 Recommendation replay
production build
artifact upload
```

Artifact:

```text
artifact id = 9431898906
artifact name = eval-p4-persona-cohort-freeze-4da035f053aeec93ad63f2d940e1b6bf59a0a960
artifact ZIP SHA-256 = c9041a99f8175ce008fa5d33c30c94ec85638ab3f2c0e0cd27c9f39a98507242
```

Artifact semantic evidence:

```text
freeze_manifest_semantic_hash = 31acc3c76ad45fc0aa5006529e3d3dc488ddbaea14b6af99b69800980bf0ed7c
source_combined_cohort_hash = c00426432a8481fd8a16cd38110f29bbaf87c42d389560bd40c0b33c97a64cf9
locked_coverage_hash = ffcd3341fbf408116399ab39cfaa250468baab01e7d5eae3295193996ce0530a
locked_adversarial_hash = 957a8200d12aa5fb27744a65e11831ba69001f82401231bd2694e9aadbc1cbe7
```

The exact head containing this closeout document must independently pass the same CI before merge. The external GitHub status for that later exact head is authoritative; this document does not self-attest its own future run.

## 13. Verification contract

P4 exact-head and merged-main CI must prove:

```text
- exact P4 execution-base ancestry
- bounded additive evaluation-only scope
- no Production Recommendation / Product Fact / Hosted mutation
- immutable P3 source reconstruction from 4265450ddcf40bdb4359a3d5c82d22b00a1024dd
- P3 combined/source subcohort hashes exact
- exact Coverage duplicate map and deterministic first-occurrence dedup
- LOCKED Coverage membership/count/hash exact
- LOCKED Adversarial membership/count/hash exact
- Population-Prior remains zero and not LOCKED
- provenance/correlation authority preserved
- no duplicate Domain state remains in locked technical cohorts
- P3 deterministic harness replay PASS
- historical 164x12 Recommendation replay PASS
- production build PASS
```

## 14. Authority ceiling

```text
EVIDENCE_CLASS = SYNTHETIC_SIMULATION_EVIDENCE
ORGANIC_PRODUCTION_EVIDENCE = NO
CONTROLLED_PRODUCTION_EVIDENCE = NO
REAL_USER_TRUTH = NO
MARKET_PREVALENCE = NO
SATISFACTION_OR_CONVERSION_TRUTH = NO
PRODUCT_FACT_AUTHORITY = NO
ENFORCE_AUTHORITY = NO
```

## 15. P4 terminal outcome

```text
STAGE = EVAL-P4
TERMINAL_OUTCOME = COVERAGE_ADVERSARIAL_LOCKED_POPULATION_PRIOR_DEFERRED
SEMANTIC_RESULT = SUCCESS

COVERAGE_COHORT = LOCKED_V1
COVERAGE_SOURCE_PERSONAS = 32
COVERAGE_LOCKED_PERSONAS = 29
COVERAGE_UNIQUE_DOMAIN_STATES = 29

ADVERSARIAL_COHORT = LOCKED_V1
ADVERSARIAL_LOCKED_PERSONAS = 8
ADVERSARIAL_UNIQUE_DOMAIN_STATES = 8

POPULATION_PRIOR_COHORT = DEFERRED_NOT_LOCKED
POPULATION_PRIOR_PERSONAS = 0
AUTHORIZED_POPULATION_DATASET = NONE

LOCKED_REGRESSION_COHORT = NOT_CREATED
SYNTHETIC_EVIDENCE_AUTHORITY_ESCALATION = NO
PRODUCTION_OR_GOVERNANCE_AUTHORITY_CHANGE = NO
```

EVAL-P4 therefore freezes two immutable technical cohorts without silently preserving duplicate Coverage weighting or inventing Population-Prior realism. Population-Prior adoption remains a separately governed future decision.
