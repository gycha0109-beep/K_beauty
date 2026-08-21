# EVAL-P4 Population-Prior / Coverage / Adversarial Cohort Freeze v1

## 1. Stage boundary

Stage: `EVAL-P4`

Purpose: promote only the Persona cohorts that are currently authorized and reproducible into immutable official cohort artifacts, while preserving the explicit hold on Population-Prior adoption.

This stage does not modify Recommendation semantics, Product Fact, Hosted state, SHADOW/ENFORCE state, public API behavior, or Production configuration.

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

## 2. Repository authority

P3 merged source authority:

```text
4265450ddcf40bdb4359a3d5c82d22b00a1024dd
```

P4 execution base after live revalidation:

```text
7806d6956d5d82743d176eb4c58959ee84b698c5
```

Intervening V2.1-9O files are additive exfoliation calibration-governance artifacts. Current survey, Recommendation scorer, Skin Decision Engine, and `/api/analyze` blobs remain identical to P2/P3.

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

V2.1-9O also preserves that synthetic/Persona evidence cannot substitute for organic Production maturity and does not authorize ENFORCE.

## 3. P2 authority applied

P2 froze:

```text
AUTHORIZED_POPULATION_DATASET_V1 = NONE
AUTHORIZED_POPULATION_FIELD_REGISTRY_V1 = EMPTY
POPULATION_PRIOR_COHORT_LOCK_ALLOWED = NO
```

P2 also states that P3 technical fixtures do not automatically become a LOCKED official cohort. EVAL-P4 is the stage that makes the explicit promotion decision.

A `LOCKED` cohort is immutable in place. Any semantic membership, Persona value, sampling, weighting, provenance, or interpretation change requires a new version.

## 4. Freeze artifact

Authoritative manifest:

```text
fixtures/persona-evaluation/eval-p4-cohort-freeze-manifest-v1.json
```

Reconstruction source:

```text
source repository SHA = 4265450ddcf40bdb4359a3d5c82d22b00a1024dd
source materializer = scripts/persona-evaluation/eval-p3-contracts.mjs
source combined cohort hash = c00426432a8481fd8a16cd38110f29bbaf87c42d389560bd40c0b33c97a64cf9
```

The P4 CI reconstructs the materialized P3 cohort from the immutable Git source SHA, rather than trusting future `main` materializer behavior.

## 5. COVERAGE_COHORT v1

Promotion:

```text
cohort_id = eval-p4-coverage-cohort-v1
lifecycle = LOCKED
persona_count = 32
cohort_hash = 84910f8d4dac534226093734f9befe96d42ced2c369981bcd0e9ef4dde48088b
hash definition = SHA-256 over canonical materialized Persona array
sampling_strategy = EXPLICIT_DETERMINISTIC_ENUMERATION
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

## 6. ADVERSARIAL_COHORT v1

Promotion:

```text
cohort_id = eval-p4-adversarial-cohort-v1
lifecycle = LOCKED
persona_count = 8
cohort_hash = 957a8200d12aa5fb27744a65e11831ba69001f82401231bd2694e9aadbc1cbe7
hash definition = SHA-256 over canonical materialized Persona array
sampling_strategy = EXPLICIT_DETERMINISTIC_ENUMERATION
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

## 7. POPULATION_PRIOR_COHORT

P4 does not fabricate a Population-Prior lock.

```text
lifecycle = DEFERRED_NOT_LOCKED
persona_count = 0
authorized_population_dataset = NONE
lock_allowed = false
reason = P2_REVISION_SPECIFIC_ADOPTION_RECORD_NOT_FROZEN
```

This is an authority-preserving result, not a missing synthetic fill-in.

### 7.1 NVIDIA Nemotron-Personas-Korea revalidation

Current public-source observations captured on 2026-08-21:

```text
candidate = nvidia/Nemotron-Personas-Korea
dataset version observed = 1.0
main revision observed = ada0f5b53a38bb5a30cce09358adde883c1ab63a
data revision observed = 03d5650aecd88bceaf142fd7e0059ad8fb288341
record count observed = 1,000,000
license observed = CC BY 4.0
commercial use = allowed subject to license terms
```

It is a viable future Layer-A candidate, but P2 requires a revision-specific adoption record including `dataset_card_hash`, license/provenance fields, and redistribution/privacy limitations. P4 does not invent the missing byte-reproducible card hash or silently waive the P2 contract.

Decision:

```text
HOLD_FOR_REVISION_PINNED_ADOPTION_RECORD
```

Even after future adoption, Population fields would remain Layer-A sampling/segmentation metadata and would not automatically derive K-beauty Domain fields.

### 7.2 PersonaHub revalidation

Current public-source observations captured on 2026-08-21:

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

## 8. LOCKED_REGRESSION_COHORT

P4 does not silently reinterpret the two technical cohorts as one regression cohort.

```text
LOCKED_REGRESSION_COHORT = NOT_CREATED
```

Regression infrastructure remains an EVAL-P6 concern. EVAL-P5 may use the independently locked Coverage and Adversarial cohorts for deterministic counterfactual/metamorphic evaluation.

## 9. Weighting and comparability

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

## 10. Persona-collapse protection

P4 verifier requires:

```text
Coverage unique domain patterns = 32 / 32
Adversarial unique domain patterns = 8 / 8
Combined unique domain patterns = 40 / 40
```

This is a deterministic structural diversity check, not an opaque diversity score and not a realism metric.

## 11. Verification contract

P4 exact-head CI must prove:

```text
- exact P4 execution-base ancestry
- bounded additive evaluation-only scope
- no Production Recommendation / Product Fact / Hosted mutation
- immutable P3 source reconstruction from 4265450ddcf40bdb4359a3d5c82d22b00a1024dd
- source combined hash = c00426432a8481fd8a16cd38110f29bbaf87c42d389560bd40c0b33c97a64cf9
- Coverage membership/count/hash exact
- Adversarial membership/count/hash exact
- Population-Prior remains zero and not LOCKED
- provenance/correlation authority preserved
- no Persona collapse in the frozen technical materialization
- P3 deterministic harness replay PASS
- historical 164x12 Recommendation replay PASS
- production build PASS
```

## 12. Authority ceiling

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

## 13. Provisional terminal outcome

The semantic freeze decision is:

```text
COVERAGE_COHORT = LOCKED_V1
ADVERSARIAL_COHORT = LOCKED_V1
POPULATION_PRIOR_COHORT = DEFERRED_NOT_LOCKED
LOCKED_REGRESSION_COHORT = NOT_CREATED
```

Exact-head and merged-main CI evidence are appended/finalized only after execution. No CI success is claimed by this section before those runs complete.
