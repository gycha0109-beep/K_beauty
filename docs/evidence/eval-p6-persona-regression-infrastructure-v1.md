# EVAL-P6 Persona Cohort Regression Infrastructure v1

## 1. Stage boundary

Stage: `EVAL-P6`

Purpose: establish the first immutable Persona regression cohort and deterministic Engine A / Engine B replay infrastructure over the already-LOCKED P4 technical Personas.

P6 does **not** reinterpret a synthetic delta as user preference truth, market prevalence, satisfaction, conversion quality, Product Fact authority, or ENFORCE authority.

```text
PRODUCTION_NETWORK_CALLS = 0
HOSTED_WRITES = 0
PRODUCT_FACT_WRITES = 0
ORGANIC_EVIDENCE_WRITES = 0
CONTROLLED_PRODUCTION_PROBES = 0
SHADOW_MODE_CHANGED = NO
ENFORCE_AUTHORIZED_BY_PERSONA = NO
ENFORCE_ACTIVATED_BY_PERSONA = NO
PRODUCTION_RECOMMENDATION_MUTATION = 0
LLM_JUDGE_CALLS = 0
```

Evidence class remains:

```text
SYNTHETIC_SIMULATION_EVIDENCE
```

## 2. Repository authority

Accepted P5 main / P6 execution base:

```text
269fe701a7f3ee967d12e15c88e9e5767af895f6
```

P4 LOCKED source authority:

```text
a4772e3cd44d68f67fe4bbf25926ba0942f353b3
```

Immutable P3 Persona materialization source:

```text
4265450ddcf40bdb4359a3d5c82d22b00a1024dd
```

Frozen Recommendation reference:

```text
783afb91a964f5d762f46846f9ef854902b48e95
```

P6 is additive evaluation infrastructure only. No `lib`, `app/api`, Supabase migration, package dependency, Product Fact, Hosted, SHADOW, or ENFORCE semantics are modified.

## 3. Why a new regression cohort exists

P4 explicitly left:

```text
LOCKED_REGRESSION_COHORT = NOT_CREATED
```

because P6 owns regression infrastructure.

P6 does not mutate the P4 Coverage or Adversarial cohorts in place. Instead it creates a new, versioned regression artifact whose membership is the exact ordered union of those already-LOCKED source cohorts.

```text
cohort_id = eval-p6-locked-regression-cohort-v1
cohort_type = LOCKED_REGRESSION_COHORT
lifecycle = LOCKED
mutation_policy = NEW_VERSION_REQUIRED
```

Any future membership, sampling, weighting, provenance, interpretation, or materialization-semantic change requires a successor cohort version.

## 4. LOCKED regression cohort composition

Source 1:

```text
P4 COVERAGE_COHORT
members = 29
hash = ffcd3341fbf408116399ab39cfaa250468baab01e7d5eae3295193996ce0530a
```

Source 2:

```text
P4 ADVERSARIAL_COHORT
members = 8
hash = 957a8200d12aa5fb27744a65e11831ba69001f82401231bd2694e9aadbc1cbe7
```

Regression cohort:

```text
persona_count = 37
sampling_strategy = EXACT_P4_LOCKED_MEMBER_PROMOTION_PRESERVE_SOURCE_COHORT_ORDER
weighting_strategy = NONE
prng_algorithm = NONE
seed = 0
population_prior_members = 0
persona_payload_mutation = false
sampling_weight_mutation = false
```

Locked regression cohort hash:

```text
c774fc52ae1494c5a4fc39d11d2e7564a196460db391bb94f41d0510b7ae59f8
```

Hash definition:

```text
SHA256_CANONICAL_JSON_OF_DEFINITION_SAMPLER_PRNG_SEED_GENERATION_MANIFEST_AND_MEMBER_IDS
```

Population-Prior remains deferred and absent. P6 does not silently authorize or adopt a population dataset.

## 5. Regression comparison contract

Version:

```text
eval-p6-persona-regression-contract-v1
```

Comparator:

```text
eval-p6-persona-regression-comparator-v1
```

Deterministic evaluator:

```text
eval-p6-persona-regression-evaluator-v1
```

Comparison unit:

```text
SAME_PERSONA_ID
+ SAME_LOCKED_REGRESSION_COHORT
+ SAME_DETERMINISTIC_CONTEXT
+ ENGINE_A_VS_ENGINE_B
```

The comparator records semantic component deltas. It does not infer that a change is automatically better or worse.

```text
AUTOMATIC_QUALITY_DIRECTION_INFERENCE = FORBIDDEN
CROSS_COHORT_RAW_RATE_COMPARISON = FORBIDDEN
SEMANTIC_DELTA = REQUIRES_EXPLICIT_REVIEW
```

P6 baseline establishment is a special zero-delta case because this P6 branch adds evaluation infrastructure only and does not intentionally change Production Recommendation semantics.

## 6. Per-Persona regression snapshot

Every one of the 37 locked members is replayed through both:

```text
DOMAIN_CORE_HARNESS
CONTRACT_INTEGRATION_HARNESS
```

For each Persona, P6 records deterministic hashes for:

- semantic projection;
- public response projection;
- ranking identity/score projection;
- score breakdown projection;
- explanation projection;
- CandidatePolicy fingerprint;
- survey-derived state;
- top-ranked product IDs as diagnostic context;
- combined Persona regression snapshot.

For every Persona, Domain Core and Contract Integration semantic projection and survey-derived state must remain equivalent under the frozen adapter contract.

## 7. Reproducibility lineage

The baseline simulation context is frozen with the following material fields.

### Persona / cohort lineage

```text
population_dataset_id = NONE
population_dataset_version = NONE
population_dataset_hash = NONE
cohort_type = LOCKED_REGRESSION_COHORT
cohort_definition_version = eval-p6-locked-regression-cohort-v1
sampler_version = eval-p6-p4-locked-union-promotion-v1
prng_algorithm = NONE
seed = 0
cohort_hash = c774fc52ae1494c5a4fc39d11d2e7564a196460db391bb94f41d0510b7ae59f8
persona_count = 37
domain_adapter_version = kbeauty-domain-persona-v1
decision_model_version = persona-decision-model-v1
interaction_model_version = NONE_NOT_IN_EVAL_P6
scenario_generator_version = eval-p6-locked-regression-exact-replay-v1
survey_adapter_version = eval-p3-route-pinned-adapter-v1
```

### Runtime lineage

The first authoritative green run observed:

```text
runtime_version = v20.20.2
```

The P6 workflow therefore pins:

```text
node-version = 20.20.2
```

rather than relying on the moving Node 20 alias.

Dependency lock hash:

```text
096ffe45b4414a540a73b29a07b31f17b5374014f3f5ec5ef08d8bebb6d05a88
```

Relevant feature flag snapshot:

```text
DEV_ONLY_CANDIDATE_EXPOSURE_POLICY_SHADOW = ABSENT
DISABLE_CANDIDATE_EXPOSURE_POLICY_SHADOW = ABSENT
VERCEL_ENV = ABSENT
NODE_ENV = ABSENT
```

### Catalog lineage

```text
catalog_snapshot_reference = 783afb91a964f5d762f46846f9ef854902b48e95
catalog_product_count = 164
catalog_sunscreen_count = 11
catalog_declared_hash = e4788383a21ac4207d553fbfb5300dc629b8eab5ad200ffd1313d43e94e0c856
catalog_file_sha256 = e20903b9f8a3f6bc97cc9cfce46b3d78f7b220d359d635eeb909c711db605ef0
```

### Product Fact lineage

P6 is an offline regression harness over the frozen Recommendation fixture and does not consume Product Fact authority.

```text
product_fact_authority_snapshot = NOT_CONSUMED_BY_P6_OFFLINE_REGRESSION_HARNESS
product_fact_snapshot_hash = 7e49a2656f5de619167c9c97284d692c79c8a986b656ac15f7a33f52b7284bef
```

This sentinel does not claim that Product Fact does not exist. It records that Product Fact authority is outside this regression execution path.

### Evaluator / Judge lineage

```text
deterministic_evaluator_version = eval-p6-persona-regression-evaluator-v1
llm_judge_model = NONE
llm_judge_prompt_version = NONE
llm_judge_config = NONE
```

Operational `simulation_run_id` and `created_at` are stored separately from canonical semantic hashes.

## 8. Frozen baseline v1

Baseline contract:

```text
fixtures/persona-evaluation/eval-p6-regression-baseline-v1.json
```

Baseline lifecycle:

```text
LOCKED
```

Baseline engine:

```text
269fe701a7f3ee967d12e15c88e9e5767af895f6
```

Deterministic context hash:

```text
78a83ef112481f051a1380a47bad9a8de26ede664afc062f92b939cf5f821bb9
```

Baseline output semantic hash:

```text
554d97fefe8012b2b0951a21d4b9905ee3eb6f6a816b8453cf28905fec39f27d
```

Baseline contract canonical hash:

```text
0ee4f15b08008bb7bc11884a859451ee5904d002478a67ecdf22a55fadd53177
```

The contract also freezes all 37 Persona regression hashes.

Accepted baseline mutation policy:

```text
NEW_VERSION_REQUIRED
```

If an Engine, adapter, contract, catalog context, or other semantic dependency changes and the resulting delta is intentionally accepted, a new baseline version must be governed. Baseline v1 is not rewritten in place.

## 9. First authoritative establishment run

First green PR execution:

```text
head = 2299c6ef6320c1b4ae33d42ca1407d8689656339
run = 32449020588
job = 96673839277
result = SUCCESS
```

Artifact:

```text
artifact_id = 9435032901
artifact_name = eval-p6-persona-regression-2299c6ef6320c1b4ae33d42ca1407d8689656339
artifact_zip_sha256 = e9e7bb97df9445e2356b4085f4b8dbbe35c7e739c42aff7f1ae897b6f38e8ff2
```

Engine A:

```text
269fe701a7f3ee967d12e15c88e9e5767af895f6
```

Engine B:

```text
2299c6ef6320c1b4ae33d42ca1407d8689656339
```

Comparator result:

```text
changed_persona_count = 0
unchanged_persona_count = 37
all tracked component delta counts = 0
key Production engine file deltas = 0
terminal_classification = NO_SEMANTIC_DELTA
```

This proves the P6 infrastructure-only candidate did not alter the accepted P5 engine outputs under the locked regression context.

The first run establishes the values used by the frozen baseline contract. The branch head containing the baseline contract, exact runtime pin, verifier, and this closeout document must independently pass the full P6 exact-head CI before merge; this document does not self-attest that later run.

## 10. Historical regression preservation

The P6 workflow also requires:

```text
P4 LOCKED source reconstruction = PASS
P5 counterfactual/metamorphic replay = PASS
P3 deterministic Persona harness replay = PASS
historical 164x12 Recommendation replay = PASS
Production build = PASS
```

P6 therefore cannot establish its regression baseline by modifying Production Recommendation code or rewriting historical Persona/Recommendation authority.

## 11. Delta handling after P6

A future Engine B result can produce:

```text
NO_SEMANTIC_DELTA
```

or:

```text
SEMANTIC_DELTA_REQUIRES_EXPLICIT_REVIEW
```

A semantic delta is evidence that the engine behavior changed under the same locked synthetic inputs. It is not, by itself, evidence that:

- users prefer the new result;
- the new result improves satisfaction or conversion;
- one cohort represents population prevalence;
- Product Facts changed;
- ENFORCE should be authorized.

The regression report is therefore a reproducible change detector and review surface, not a synthetic quality score.

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
LLM_JUDGE_AUTHORITY = NOT_USED
```

## 13. Terminal outcome

Subject to final exact-head CI, merge, merged-main exact-SHA CI, and same-SHA Production deployment verification, the semantic terminal outcome is:

```text
LOCKED_REGRESSION_COHORT_AND_BASELINE_ESTABLISHED
```

This means:

1. the first `LOCKED_REGRESSION_COHORT` exists as an immutable successor artifact to P4's source cohorts;
2. baseline v1 is locked to the accepted P5 engine and exact reproducibility context;
3. deterministic Engine A / Engine B comparison is implemented;
4. zero-delta establishment is proven without Production semantic mutation;
5. future semantic deltas are reviewable without automatically being labeled improvement or degradation;
6. synthetic evidence authority remains bounded.
