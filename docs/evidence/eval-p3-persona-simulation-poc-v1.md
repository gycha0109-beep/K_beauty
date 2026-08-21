# EVAL-P3 Deterministic Persona Simulation Harness PoC — Evidence / Closeout v1

## 1. Stage boundary

Stage: `EVAL-P3`

Purpose: implement and verify the bounded deterministic Persona Simulation PoC authorized by EVAL-P2.

This evidence freezes an offline evaluation result only.

```text
EVIDENCE_CLASS = SYNTHETIC_SIMULATION_EVIDENCE
PRODUCTION_NETWORK_CALLS = 0
HOSTED_WRITES = 0
PRODUCT_FACT_WRITES = 0
ORGANIC_EVIDENCE_WRITES = 0
CONTROLLED_PRODUCTION_PROBE = 0
SHADOW_MODE_CHANGED = NO
ENFORCE_AUTHORIZED_BY_PERSONA = NO
ENFORCE_ACTIVATED_BY_PERSONA = NO
PRODUCTION_CONFIG_CHANGE = 0
LLM_JUDGE_CALLS = 0
```

Synthetic evidence is not real-user truth, market-prevalence evidence, satisfaction/conversion evidence, Production maturity evidence, Product Fact authority, or ENFORCE authority.

## 2. Authority

EVAL-P2 semantic authority:

```text
b702652c7167b49da96ce4f5308112436e066bd3
```

P3 execution base after authority revalidation:

```text
524ea7ff96616259b725ecdc9ac1a3f22133e6dc
```

The intervening commit from P2 authority to the execution base was PR #274, a Face Lab D2D-X execution-authorization documentation change. It did not modify Recommendation, survey input, scorer, Skin Decision, Product Fact, `app/api`, migrations, or Persona semantics.

Classification:

```text
INTERVENING_DRIFT = FACE_LAB_DOCUMENTATION_ONLY
PERSONA_OR_RECOMMENDATION_RELATED_DRIFT = NO
```

Frozen Recommendation execution authorities retained from P2:

```text
Recommendation reference SHA = 783afb91a964f5d762f46846f9ef854902b48e95
catalog declared SHA-256 = e4788383a21ac4207d553fbfb5300dc629b8eab5ad200ffd1313d43e94e0c856
survey contract blob = 0ad41d8328caf1939789063ab3bc06391a2a94d1
Recommendation scorer blob = 45358401d80e5edd8c92d303462f2a415196590c
Skin Decision engine blob = 13945cb21c0acec1c303eedfa2b9b6000f6e066d
/api/analyze route blob = cc059eba680034d28e1ade0b1a8147d43a8b30f7
```

## 3. Implementation scope

P3 adds evaluation-only implementation under bounded paths:

```text
scripts/persona-evaluation/eval-p3-contracts.mjs
scripts/verify-eval-p3-persona-simulation-v1.mjs
.github/workflows/eval-p3-persona-simulation.yml
docs/evidence/eval-p3-persona-simulation-poc-v1.md
```

No `lib`, `app/api`, `supabase/migrations`, `package.json`, or `package-lock.json` semantic change is owned by P3.

## 4. Persona materialization

The PoC materializes exactly:

```text
TOTAL_PERSONAS = 40
COVERAGE_COHORT = 32
ADVERSARIAL_COHORT = 8
POPULATION_PRIOR_COHORT = 0
CONTRACT_NEGATIVE_FIXTURES = 8
```

Materialization properties:

```text
sampling_strategy = EXPLICIT_DETERMINISTIC_ENUMERATION
weighting_strategy = NONE
PRNG = NONE
seed = 0
AUTHORIZED_POPULATION_DATASET = NONE
```

Coverage fixtures are explicitly non-representative technical coverage fixtures. Adversarial fixtures are explicitly non-representative stress assignments. Neither cohort supports a Korean-population or K-beauty prevalence claim.

Every materialized Domain leaf carries recoverable Persona attribute provenance. Layer A population data remains `null` because P2 did not authorize a population dataset.

## 5. Frozen catalog

P3 reads the historical frozen Recommendation reference rather than Hosted Production product state.

Observed fixture counts:

```text
PRODUCTS = 164
SUNSCREENS = 11
```

The fixture-declared canonical catalog SHA-256 matched the P2-frozen authority:

```text
e4788383a21ac4207d553fbfb5300dc629b8eab5ad200ffd1313d43e94e0c856
```

## 6. Offline harnesses

### 6.1 DOMAIN_CORE_HARNESS

Execution path:

```text
Persona Domain
→ current Recommendation-answer projection
→ current survey contract for derived-state observation
→ current buildSkinMatchDecisionBundle(...)
→ frozen 164-product fixture injected directly
→ semantic result projection
```

A deterministic fallback photo observation is used. Network access is not required.

### 6.2 CONTRACT_INTEGRATION_HARNESS

Execution path:

```text
Persona Domain
→ route-like payload aliases
→ pinned /api/analyze Recommendation-input materialization semantics
→ current survey normalization
→ current buildSkinMatchDecisionBundle(...)
→ frozen 164-product fixture injected directly
→ semantic result projection
```

The public `/api/analyze` endpoint is not invoked. Image upload, request guard, provider calls, Hosted current-product reads, persistence grant, and Production traffic are outside P3.

The verifier replaces global `fetch` with a throwing sentinel so accidental network use fails the run.

## 7. Cross-harness equivalence

For every one of the 40 Persona scenarios:

```text
DOMAIN_CORE semantic hash
==
CONTRACT_INTEGRATION semantic hash
```

Result:

```text
HARNESS_EQUIVALENCE = PASS
40 / 40 equivalent
```

This proves equivalence only for the bounded Recommendation-relevant offline adapter contract exercised by P3. It does not claim full HTTP/API route equivalence.

## 8. Deterministic replay

The complete 40-Persona execution was run twice in the same exact-head CI execution.

Hashes:

```text
cohort_hash = c00426432a8481fd8a16cd38110f29bbaf87c42d389560bd40c0b33c97a64cf9
first_pass_semantic_hash = cb20195c4800c6222a07f5edd4d99b7ae4363f47e6bcd28c29414502a3758944
second_pass_semantic_hash = cb20195c4800c6222a07f5edd4d99b7ae4363f47e6bcd28c29414502a3758944
semantic_evidence_hash = 20eb1a511253494eafbaf90c3c32b222bfb62b4db0af3da21992391cad93ca7a
```

Therefore:

```text
SAME_INPUT_ENGINE_CATALOG_CONTRACTS_REPLAY = PASS
```

## 9. E1 hard-constraint execution

P2-frozen rules executed as evaluator-only policy probes:

```text
POL-GENDER-001 = PASS
POL-SUN-001 = PASS
POL-SUN-002 = PASS
POL-SUN-003 = PASS
POL-SUN-004 = PASS
POL-SUN-005 = PASS
```

Aggregate:

```text
E1_HARD_CONSTRAINTS = 6 / 6 PASS
```

Probe authority is frozen as:

```text
EVALUATOR_RULE_FIXTURE_NOT_CATALOG_TRUTH
```

The probes validate rule executability and current-policy consistency. They are not independent catalog truth or real-user preference truth.

## 10. Metamorphic execution

P2-frozen metamorphic relations:

```text
MR-GENDER-001 = PASS
MR-SUN-EYE-001 = PASS
MR-SUN-WHITECAST-001 = PASS
MR-SUN-MAKEUP-001 = PASS
MR-SUN-SENSITIVITY-001 = PASS
MR-DERIVED-DRYNESS-001 = PASS
MR-DERIVED-REDNESS-001 = PASS
```

Aggregate:

```text
METAMORPHIC_RELATIONS = 7 / 7 PASS
```

White-cast, makeup/pilling, and dry/soft-matte checks preserve the P2 strict-candidate boundary; they do not incorrectly assert that penalty-only fallback is impossible.

## 11. Negative contract fixtures

Exactly eight negative fixtures were evaluated before engine invocation.

```text
P3-N01 -> GAP-DOMAIN-004_UNSUPPORTED_SCORER_VALUE
P3-N02 -> GAP-DOMAIN-004_UNSUPPORTED_SCORER_VALUE
P3-N03 -> GAP-DOMAIN-003_NON_PUBLIC_SCORER_INPUT
P3-N04 -> GAP-DOMAIN-003_NON_PUBLIC_SCORER_INPUT
P3-N05 -> INVALID_DOMAIN_ENUM
P3-N06 -> MISSING_REQUIRED_DOMAIN_FIELD
P3-N07 -> INVALID_DOMAIN_ENUM
P3-N08 -> INVALID_DOMAIN_ENUM
```

Result:

```text
NEGATIVE_FIXTURES_TYPED = 8 / 8 PASS
```

## 12. Contract-gap observations

All four P2-frozen gaps are emitted as typed, evaluation-only observations.

### GAP-DOMAIN-001

```text
SURVEY_COMPLETENESS_NOT_CONSUMED_BY_RECOMMENDATION_NORMALIZER
AUTHORITY = DIAGNOSTIC_ONLY
AFFECTED_VALID_FIXTURES = 10
```

The 10 fixtures have sunscreen `preferenceState != answered`. This count is a fixture observation, not a user-population frequency.

### GAP-DOMAIN-002

```text
CURRENT_ROUTE_INPUT_OUTSIDE_SURVEY_CONTRACT
AUTHORITY = DIAGNOSTIC_ONLY
AFFECTED_VALID_FIXTURES = 40
```

All P3 Persona records explicitly represent `verySensitivePeriod` in the route-extension namespace. This count reflects P3 schema design, not real-user prevalence.

### GAP-DOMAIN-003

```text
DOMAIN_CORE_DIAGNOSTIC_ONLY_NOT_PUBLIC_CONTRACT_INPUT
AUTHORITY = DIAGNOSTIC_ONLY
NEGATIVE_FIXTURES = P3-N03, P3-N04
```

### GAP-DOMAIN-004

```text
LEGACY_OR_INTERNAL_SCORER_VALUE_UNSUPPORTED_FOR_PERSONA_V1
AUTHORITY = DIAGNOSTIC_ONLY
NEGATIVE_FIXTURES = P3-N01, P3-N02
```

No gap observation changes Production input contracts in P3.

## 13. No-result observation

Observed across the 40 valid Persona runs:

```text
UNEXPECTED_NO_RESULT_OBSERVATIONS = 0
```

This is a bounded PoC observation only. It is not a production no-result rate, satisfaction metric, catalog-coverage metric, or market-quality threshold.

## 14. Historical invariance

The existing frozen historical Recommendation replay was executed after the P3 harness:

```text
PRODUCTS = 164
HISTORICAL_SCENARIOS = 12
```

Result:

```text
HISTORICAL_164x12_RECOMMENDATION_REPLAY = PASS
```

P3 therefore does not require a Recommendation semantic change to achieve its PoC acceptance criteria.

## 15. Build and exact-head CI

First authoritative passing exact-head implementation:

```text
implementation SHA = b19335554612e03b98e711156b271ec4708d8f6d
GitHub Actions run = 32436441976
job = 96638510789
```

The run passed:

```text
exact authority / ancestry
bounded P3 change scope
no Production Recommendation / Product Fact / Hosted semantic mutation
syntax checks
frozen 164-product reference preparation
EVAL-P3 deterministic Persona harness
historical 164x12 Recommendation replay
production build
artifact upload
exact-head status attestation
```

Uploaded CI artifact:

```text
artifact id = 9430921486
artifact name = eval-p3-persona-simulation-b19335554612e03b98e711156b271ec4708d8f6d
artifact ZIP SHA-256 = e2ec2be3c8ee21ab08d5684943ce6bf23a8bbaa35cef8501e8105ab22aea39dc
```

Artifact contents:

```text
persona-simulation-summary-v1.json
persona-run-results-v1.json
contract-gap-observations-v1.json
metamorphic-results-v1.json
```

The execution artifact is CI evidence and is not Product Fact, organic Production evidence, or a Production persistence surface.

## 16. Authority ceilings after PoC

P3 does not establish:

```text
CATALOG_COVERAGE = CATALOG_COVERAGE_NOT_ESTABLISHED
POPULATION_PRIOR_REALISM = NOT_ESTABLISHED
REAL_USER_PREFERENCE_ORACLE = NOT_ESTABLISHED
LLM_JUDGE_RELEASE_AUTHORITY = NOT_ESTABLISHED
```

It also does not establish real demographic-domain correlations, market weighting, satisfaction, conversion, or aggregate calibration.

## 17. P3 terminal outcome

```text
STAGE = EVAL-P3
TERMINAL_OUTCOME = SUCCESS

VALID_PERSONAS = 40
COVERAGE_PERSONAS = 32
ADVERSARIAL_PERSONAS = 8
POPULATION_PRIOR_PERSONAS = 0
CONTRACT_NEGATIVE_FIXTURES = 8

DOMAIN_CORE_HARNESS = PASS
CONTRACT_INTEGRATION_HARNESS = PASS
CROSS_HARNESS_EQUIVALENCE = 40 / 40 PASS
DETERMINISTIC_REPLAY = PASS
E1_HARD_CONSTRAINTS = 6 / 6 PASS
METAMORPHIC_RELATIONS = 7 / 7 PASS
CONTRACT_GAPS_TYPED = 4 / 4
NEGATIVE_FIXTURES_TYPED = 8 / 8 PASS
HISTORICAL_164x12_REPLAY = PASS
PRODUCTION_BUILD = PASS

SYNTHETIC_EVIDENCE_AUTHORITY_ESCALATION = NO
PRODUCTION_OR_GOVERNANCE_AUTHORITY_CHANGE = NO
```

EVAL-P3 proves that the P2-frozen Persona contracts are executable as a deterministic, bounded, offline evaluation PoC against the frozen Recommendation reference. It does not prove population realism, preference validity, catalog completeness, or Production readiness.