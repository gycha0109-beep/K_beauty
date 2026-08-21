# EVAL-P2 Population / Domain / Decision Persona Contract Freeze v1

## 1. Stage boundary

Stage: `EVAL-P2`

Purpose: freeze the first authoritative Persona Track component contracts required before a deterministic offline Persona Simulation harness is implemented.

This stage is contract/documentation only.

```text
RECOMMENDATION_RUNTIME_MUTATION = 0
PRODUCT_FACT_WRITE = 0
HOSTED_WRITE = 0
PRODUCTION_TRAFFIC = 0
SHADOW_MODE_CHANGE = 0
ENFORCE_AUTHORIZATION_CHANGE = 0
```

Synthetic evidence remains `SYNTHETIC_SIMULATION_EVIDENCE` and cannot become organic or controlled Production evidence, real-user truth, Product Fact authority, or ENFORCE authority.

## 2. Repository authority

P2 starting authority:

```text
main = e1cdd9a777253f0497ac032573018045bebf5be3
```

P1 authority:

```text
79b16cea59624ede542b5c635bc86a7df90b343c
```

Current main is a direct descendant of the P1 authority. The intervening V2.1-9N merge freezes ENFORCE reassessment sufficiency calibration governance and explicitly bounds its change scope away from Recommendation, Product Fact, CandidatePolicy runtime, `app/api`, and migrations.

P2 drift classification:

```text
DESCENDANT_GOVERNANCE_ONLY
PERSONA_CONTRACT_RELEVANT_DRIFT = NO
```

Current contract implementation references frozen for P2:

```text
lib/survey-input-contract.js
  blob = 0ad41d8328caf1939789063ab3bc06391a2a94d1
  contract = survey-input-contract-v1

lib/recommendation-scoring.ts
  blob = 45358401d80e5edd8c92d303462f2a415196590c

lib/skin-match-decision-engine.js
  blob = 13945cb21c0acec1c303eedfa2b9b6000f6e066d

app/api/analyze/route.js
  blob = cc059eba680034d28e1ade0b1a8147d43a8b30f7
```

Historical deterministic Recommendation reference retained by current governance CI:

```text
reference SHA = 783afb91a964f5d762f46846f9ef854902b48e95
products-v1 canonical SHA-256 = e4788383a21ac4207d553fbfb5300dc629b8eab5ad200ffd1313d43e94e0c856
product count = 164
sunscreen count = 11
user-scenarios-v1 canonical SHA-256 = 7aa02ed3f1a264a67aee3d97c916b4a955a713fdbb173844d1727e9cfb1c918e
historical scenario count = 12
```

The historical 12-scenario fixture is a regression reference, not a Persona population sample.

## 3. Frozen component versions

```text
ATTRIBUTE_PROVENANCE_CONTRACT_VERSION = persona-attribute-provenance-v1
POPULATION_PROJECTION_CONTRACT_VERSION = population-persona-projection-v1
DOMAIN_PERSONA_CONTRACT_VERSION = kbeauty-domain-persona-v1
CORRELATION_REGISTRY_VERSION = persona-correlation-registry-v1
DECISION_MODEL_CONTRACT_VERSION = persona-decision-model-v1
METAMORPHIC_RELATION_REGISTRY_VERSION = persona-metamorphic-registry-v1
COHORT_MATERIALIZATION_CONTRACT_VERSION = persona-cohort-materialization-v1
HARNESS_EQUIVALENCE_CONTRACT_VERSION = persona-harness-equivalence-v1
ARTIFACT_HASH_CONTRACT_VERSION = persona-artifact-hash-v1
P3_POC_SCOPE_VERSION = eval-p3-poc-scope-v1
```

A semantic change to a LOCKED component requires a new version. In-place semantic mutation is forbidden.

## 4. Common attribute provenance

Every materialized Persona attribute or governed derivation must permit recovery of:

```text
attribute_key
value
source_class
source_reference
contract_version
correlation_basis
authority_ceiling
```

Frozen source classes:

```text
PUBLIC_DATASET_OBSERVED_FIELD
CURRENT_ENGINE_INPUT_DOMAIN
GOVERNED_CORRELATION_DERIVATION
BEJEWELY_HYPOTHESIS
EXPLORATORY_STRESS_ASSIGNMENT
UNKNOWN
```

Frozen authority ceilings used by P2:

```text
SEGMENTATION_ONLY
SIMULATION_INPUT_ALLOWED
EVALUATION_RULE_ALLOWED
DIAGNOSTIC_ONLY
NO_RECOMMENDATION_USE
```

Rules:

```text
synthetic value != observed human truth
hypothesis != population fact
stress assignment != prevalence claim
population metadata != Recommendation scoring input
```

## 5. Layer A — Population Persona Projection v1

### 5.1 Adoption state

P1 did not authorize an external population dataset as a production/evaluation dependency. Therefore P2 freezes the projection contract without inventing an upstream schema.

```text
AUTHORIZED_POPULATION_DATASET_V1 = NONE
AUTHORIZED_POPULATION_FIELD_REGISTRY_V1 = EMPTY
POPULATION_PRIOR_COHORT_LOCK_ALLOWED = NO
```

A future external population source can be adopted only after a revision-specific adoption record freezes:

```text
source_url
retrieved_at
dataset_revision_or_commit
dataset_card_hash
license_identifier
license_reference
commercial_use_status
attribution_requirement
redistribution_status
privacy/provenance limitations
```

### 5.2 Projection envelope

```yaml
population:
  source_dataset_id: string
  source_dataset_revision: string
  source_record_ref: string | null
  source_record_hash: string | null
  attributes:
    - attribute_key: string
      value: scalar | bounded-enum
      provenance: AttributeProvenanceV1
```

Until an adoption record authorizes a field, `attributes` must remain empty in official P3 Persona fixtures.

External names and free-text biographies are not required by the contract and must not be copied merely to make a Persona feel realistic.

### 5.3 Recommendation-use prohibition

Layer A attributes are segmentation/sampling metadata by default.

In particular:

```text
population.gender_or_presentation
MUST NOT automatically map to
profile.genderPreference
```

The current `genderPreference` field is a Recommendation eligibility preference, not an inferred demographic property.

No Layer A field may alter routing, scoring, eligibility, Product suitability, or Decision rules without a separately governed correlation/policy contract.

## 6. Layer B — K-beauty Domain Persona v1

### 6.1 Canonical writable Persona inputs

P2 authorizes the following current-engine-facing fields.

```yaml
skinType: oily | dry | combination | not_sure
sensitivity: low | medium | high
primaryConcern: oiliness | dehydration | acne | pores | redness | barrier | uneven_tone | uv
secondaryConcern: oiliness | dehydration | acne | pores | redness | barrier | uneven_tone | uv | null
postWashFeeling: tight | comfortable | still_oily
afternoonSkinChange: more_oily | more_dry | red_or_irritated | mostly_same
cleansingFrequency: once | twice | 3_plus
environmentExposure: [heat | humidity | mask | kitchen | outdoor | aircon]
preferredTexture: gel | watery | lotion | cream
mostDislikedFeel: sticky | greasy | heavy
recentSkinChange: yes | no | unknown
recentlyChangedProduct: yes | no | unknown
sunscreen:
  preferenceState: answered | skipped | unknown
  whiteCastHate: boolean
  toneUpWanted: boolean
  makeupUse: boolean
  eyeSensitive: boolean
profile:
  genderPreference: female | male | unspecified
routeExtensions:
  verySensitivePeriod: boolean
```

Canonical concern materialization:

```text
mainConcern = primaryConcern
primaryConcern = primaryConcern
mainConcerns = [primaryConcern, secondaryConcern?]
```

`mainConcerns` is capped at two for official P3 Persona materialization because current Recommendation normalization consumes at most two effective concerns.

Set-like `environmentExposure` is de-duplicated and canonicalized. Concern order is semantic and must be preserved.

### 6.2 Derived-only fields

The Persona generator MUST NOT directly assign the following as authoritative Domain input:

```text
goals.concernSource
goals.unresolvedPrimaryConcern
safety.sensitivityRisk
safety.drynessRisk
safety.rednessRisk
sunscreen.sourceCompleteness
metadata.missingFields
metadata.warnings
normalized Recommendation answers
Skin Decision priority
Skin Decision score card
Recommendation score / rank
```

These are produced by current contracts/engine execution and belong in result-side derived-state snapshots.

### 6.3 Current contract gaps frozen by P2

P2 does not hide current cross-contract differences.

#### GAP-DOMAIN-001 — sunscreen preference completeness

`survey-input-contract-v1` preserves `sunscreenPreferenceState` and emits `answered`, `skipped`, or `ambiguous_boolean_defaults`, while current Recommendation normalization consumes the four booleans without consuming that completeness state.

P2 normative rule:

```text
Decision/evaluation rules that interpret a sunscreen boolean as an explicit preference
REQUIRE sunscreen.preferenceState = answered.
```

If the current engine acts on false boolean defaults while preference state is skipped/unknown, P3 must preserve that observation as a diagnostic contract-gap candidate rather than redefine skipped as an explicit preference.

#### GAP-DOMAIN-002 — route-only sensitive-period input

`verySensitivePeriod` is read by `/api/analyze` and consumed by Recommendation scoring, but it is not a field of `survey-input-contract-v1`.

P2 classification:

```text
CURRENT_ROUTE_INPUT_OUTSIDE_SURVEY_CONTRACT
```

It remains allowed in `routeExtensions` for replay, but cannot be described as part of `survey-input-contract-v1`.

#### GAP-DOMAIN-003 — non-public domain-function knobs

The Recommendation scorer can accept:

```text
sunscreenIntent
explicitCategoryIntent
```

but current `/api/analyze` form materialization does not set them.

P2 classification:

```text
DOMAIN_CORE_DIAGNOSTIC_ONLY
NOT_OFFICIAL_PERSONA_PUBLIC_CONTRACT_INPUT
```

Historical fixtures using these fields remain valid historical replay artifacts but do not define P2 Persona input semantics.

#### GAP-DOMAIN-004 — scorer-only values outside survey contract

Current scorer code contains handling for values such as:

```text
skinType = sensitive
mostDislikedFeel = drying
```

that are not authorized by `survey-input-contract-v1` enums.

P2 classification:

```text
LEGACY_OR_INTERNAL_SCORER_VALUE
UNSUPPORTED_FOR_OFFICIAL_PERSONA_INPUT_V1
```

### 6.4 Explicitly unsupported/future-only fields

The following are not official P2 Recommendation inputs unless a future current contract adds them:

```text
price_sensitivity
cosmetics_budget
brand_loyalty
review_dependency
novelty_preference
shopping_channel
fragrance_tolerance
ingredient_concern
standalone finish_preference
```

They may be future research or stress attributes, but they must not be silently passed into the current Recommendation engine.

## 7. Correlation Governance v1

Default Layer A → Layer B rule:

```text
DEFAULT_A_TO_B_CORRELATION = UNKNOWN_CORRELATION
AUTOMATIC_A_TO_B_DERIVATION = FORBIDDEN
```

Frozen correlation states:

```text
SUPPORTED_CORRELATION
INDEPENDENT_BY_DESIGN
UNKNOWN_CORRELATION
EXPLORATORY_STRESS_CORRELATION
```

P2 has no approved real-population A→B correlation exception registry.

Therefore examples such as these remain unauthorized:

```text
age -> skinType
gender/presentation -> sensitivity
region -> acne
occupation -> budget
income -> brand loyalty
```

Coverage/adversarial fixtures may intentionally co-assign attributes only when marked `EXPLORATORY_STRESS_CORRELATION`; those assignments have no prevalence or realism authority.

Deterministic transformations inside current code, such as raw survey input → `drynessRisk`, are engine derivations, not demographic correlations.

## 8. Layer C — Decision Persona v1

### 8.1 Model form

P2 freezes a rule/relation model, not a numeric synthetic utility score.

```text
NO copied Recommendation weights
NO copied Recommendation total score
NO synthetic 0-100 satisfaction score
NO implicit preference ordering
```

Each rule must contain:

```text
rule_id
input_dimensions
applicability_preconditions
product_predicate
relation_or_constraint
source_class
source_reference
authority_ceiling
precedence
conflict_behavior
unknown_behavior
contract_version
```

Frozen rule kinds:

```text
HARD_EXCLUSION
STRICT_ELIGIBILITY
PREFERENCE_RELATION
DEFER_EXPECTATION
```

Frozen evaluator outcomes:

```text
HARD_CONSTRAINTS_SATISFIED
HARD_CONSTRAINT_CONFLICT
PREFERENCE_RELATION_SUPPORTED
PREFERENCE_RELATION_CONFLICT
PREFERENCE_RELATION_NOT_ESTABLISHED
INSUFFICIENT_EVALUATION_AUTHORITY
DECISION_MODEL_CONFLICT
```

There is no implicit precedence by source class. If two applicable rules conflict and the frozen rules do not define precedence, the outcome is `DECISION_MODEL_CONFLICT` / `INSUFFICIENT_EVALUATION_AUTHORITY`.

Unknown Product Fact/product-field state is not coerced to false and cannot silently satisfy a rule.

### 8.2 Product-side read boundary

Decision evaluation may read only a frozen evaluator product projection with recoverable authority/provenance.

It MUST NOT use as reference truth:

```text
Recommendation score
rank position
Top-K membership
why_picked text
score_breakdown
Recommendation debug reason generated by the same rule under test
```

This prevents scorer self-comparison from being mislabeled independent evaluation.

### 8.3 Initial code-backed policy relation registry

The following are frozen as current-policy consistency rules, not real-user preference truth.

#### POL-GENDER-001

```text
precondition: profile.genderPreference = female
product predicate: is_mens = true
constraint: HARD_EXCLUSION
scope: all Recommendation categories
source: PRODUCT_POLICY_DERIVED
```

#### POL-SUN-001

```text
precondition:
  sensitivity = high
  OR primaryConcern in {redness, barrier}
  OR routeExtensions.verySensitivePeriod = true
product predicate: category = sunscreen AND irritation_risk = high
constraint: HARD_EXCLUSION
source: PRODUCT_POLICY_DERIVED
```

#### POL-SUN-002

```text
precondition:
  sunscreen.preferenceState = answered
  AND sunscreen.eyeSensitive = true
product predicate: category = sunscreen AND eye_sting = high
constraint: HARD_EXCLUSION
source: PRODUCT_POLICY_DERIVED
```

#### POL-SUN-003

```text
precondition:
  sunscreen.preferenceState = answered
  AND sunscreen.whiteCastHate = true
  AND sunscreen.toneUpWanted = false
product predicate: category = sunscreen AND white_cast = high
constraint: STRICT_ELIGIBILITY
source: PRODUCT_POLICY_DERIVED
```

This rule is not a global final-result exclusion because current sunscreen fallback can relax strict filtering into penalty-only mode.

#### POL-SUN-004

```text
precondition:
  sunscreen.preferenceState = answered
  AND sunscreen.makeupUse = true
product predicate: category = sunscreen AND pilling_risk = high
constraint: STRICT_ELIGIBILITY
source: PRODUCT_POLICY_DERIVED
```

This rule is not a global final-result exclusion for the same fallback reason.

#### POL-SUN-005

```text
precondition:
  skinType = dry
  AND primaryConcern != oiliness
product predicate: category = sunscreen AND canonical finish = soft_matte
constraint: STRICT_ELIGIBILITY
source: PRODUCT_POLICY_DERIVED
```

P2 deliberately does not freeze price, brand, popularity, review dependency, or lifestyle trade-off rules because current authority does not justify them as user truth.

## 9. Metamorphic Relation Registry v1

Hard metamorphic assertions are limited to code/policy-backed relations. Rank monotonicity is not inferred merely because a direction seems intuitive.

### MR-GENDER-001

```text
controlled change: genderPreference unspecified -> female
precondition: evaluated product has is_mens = true
expected: product becomes ineligible and cannot appear as a Recommendation result
level: Recommendation eligibility
```

### MR-SUN-EYE-001

```text
controlled change: eyeSensitive false -> true
preconditions:
  sunscreen.preferenceState = answered
  evaluated sunscreen eye_sting = high
expected: sunscreen enters hard-rejected set
not asserted: exact rank delta of unrelated candidates
```

### MR-SUN-WHITECAST-001

```text
controlled change: whiteCastHate false -> true
preconditions:
  sunscreen.preferenceState = answered
  toneUpWanted = false
  evaluated sunscreen white_cast = high
expected: sunscreen is rejected from strict candidate set
not asserted: global final-result exclusion after fallback
```

### MR-SUN-MAKEUP-001

```text
controlled change: makeupUse false -> true
preconditions:
  sunscreen.preferenceState = answered
  evaluated sunscreen pilling_risk = high
expected: sunscreen is rejected from strict candidate set
not asserted: global final-result exclusion after fallback
```

### MR-SUN-SENSITIVITY-001

```text
controlled change: sensitivity low|medium -> high
preconditions:
  primaryConcern not in {redness, barrier}
  verySensitivePeriod = false
  evaluated sunscreen irritation_risk = high
expected: sunscreen enters hard-rejected set
not asserted: exact numeric score/rank movement
```

### MR-DERIVED-DRYNESS-001

```text
controlled change: postWashFeeling comfortable -> tight
precondition: afternoonSkinChange != more_dry
expected derived state: survey contract drynessRisk -> high
Recommendation direction: NOT FROZEN
```

### MR-DERIVED-REDNESS-001

```text
controlled change: afternoonSkinChange mostly_same -> red_or_irritated
precondition: rednessRisk not already high from another governed signal
expected derived state: survey contract rednessRisk -> high
Recommendation direction: NOT FROZEN
```

Any additional hard relation requires a new registry version or additive reviewed rule under the same frozen versioning policy.

## 10. Layer D — Interaction Persona

P2 does not materialize Layer D.

```text
INTERACTION_PERSONA_V1 = DEFERRED
P3_SINGLE_SHOT_POC_REQUIRES_INTERACTION = NO
```

No multi-step free-form LLM behavior is introduced in P3.

## 11. Cohort Materialization Contract v1

A materialized record must identify:

```text
persona_id
cohort_type
population projection or null
domain persona
decision model version / applicable rule refs
attribute provenance
scenario modifiers
materialization version
```

Official cohort types remain:

```text
POPULATION_PRIOR_COHORT
COVERAGE_COHORT
ADVERSARIAL_COHORT
LOCKED_REGRESSION_COHORT
```

P2 rules:

- `POPULATION_PRIOR_COHORT` cannot be LOCKED while `AUTHORIZED_POPULATION_DATASET_V1 = NONE`.
- `COVERAGE_COHORT` distribution is not market prevalence.
- `ADVERSARIAL_COHORT` failure rate is not real-user failure prevalence.
- A future `LOCKED_REGRESSION_COHORT` is immutable in place.
- P3 PoC fixtures are technical/validation fixtures and do not automatically become a LOCKED official cohort; cohort promotion/freeze is a later stage decision.

Required lineage:

```text
sampling_frame
sampling_strategy
weighting_strategy
sampler_version
prng_algorithm
seed
oversampling_flags
cohort_hash
persona_count
```

## 12. Harness Equivalence Contract v1

### 12.1 DOMAIN_CORE_HARNESS

Primary current reuse point:

```text
buildSkinMatchDecisionBundle(input, options)
```

P3 must inject the frozen product fixture through `options.products` so `getRecommendationProducts()` network/hosted resolution is not used.

Candidate-level deterministic sunscreen checks may additionally reuse current exported Recommendation functions where appropriate.

### 12.2 CONTRACT_INTEGRATION_HARNESS

P3 must not call public `/api/analyze` over the network.

Current `/api/analyze` mixes Recommendation input preparation with:

```text
required image upload validation
request/security guard
Vision provider execution
current-product hosted snapshot reads
anonymous persistence grants
premium/session concerns
optional explanation provider calls
```

Therefore P2 freezes the P3 integration target as an offline, route-pinned deterministic projection of the current Recommendation-relevant request contract, not the full transport/security/provider route.

The P3 adapter must be pinned to the current route blob and reproduce the Recommendation-relevant form materialization semantics, including aliases/defaulting and:

```text
outdoorExposure = explicit boolean when supplied,
otherwise environmentExposure includes outdoor
```

It then executes current survey normalization and `buildSkinMatchDecisionBundle` with injected fixtures and deterministic photo fallback state.

Route/provider/persistence code must not be invoked merely to claim integration coverage.

### 12.3 Equivalent fields

For the same canonical Persona input, frozen catalog fixture, deterministic photo fallback, and engine SHA, both harnesses must agree on the Recommendation-semantic projection that both legitimately own.

At minimum:

```text
normalized canonical Recommendation answers
eligible product IDs
priority
Top Pick product ID
alternative product ID when present
category pick product IDs
morning/night deterministic routine product identities
no-result presence/classification input
```

When full deterministic decision snapshots are compared, volatile/provider fields are excluded.

### 12.4 Non-equivalent/out-of-scope fields

P2 does not require byte equality for:

```text
generatedAt
request IDs
security guard metadata
provider telemetry
OpenAI explanation text
image bytes/fingerprint
hosted persistence grants
session cookies
runtime timing
```

`DOMAIN_CORE PASS != CONTRACT_INTEGRATION PASS` remains an invariant.

## 13. No-result classification contract

Persona evaluation does not treat every null/empty recommendation as failure.

Frozen evaluator classifications:

```text
EXPECTED_ABSTENTION
EXPECTED_DEFER
UNEXPECTED_NO_RESULT
UNSUPPORTED_SCOPE
```

Current Production response semantics are observed, not mutated, by this classification layer.

## 14. Artifact / hash contract v1

Canonical semantic hashes use SHA-256 over canonical JSON.

Rules:

```text
object keys -> lexical order
set-like arrays -> canonical lexical order
semantic-order arrays -> preserve order
numbers/booleans/null -> native canonical JSON values
volatile operational metadata -> excluded from semantic hash
```

Semantic-order examples:

```text
primary/secondary concern order
Recommendation rank order
rule precedence where explicitly ordered
```

Set-like examples:

```text
environmentExposure
unordered provenance references
unordered failure tags
```

Official run lineage must be able to recover:

```text
engine SHA
route blob SHA
survey contract blob/version
Recommendation scorer blob
catalog fixture reference/hash
Product Fact/PDA snapshot reference when used
cohort materialization version/hash
domain adapter version
decision model version
metamorphic registry version
deterministic evaluator version
feature/config snapshot
```

`simulation_run_id`, timestamps, host timing, and log sequence IDs are operational metadata and do not alter the canonical semantic hash.

## 15. Exact P3 PoC scope frozen by P2

Next implementation stage candidate:

```text
EVAL-P3
Deterministic Persona Simulation Harness PoC
```

P3 scope:

```text
Primary evaluation category = sunscreen
Engine catalog input = full frozen 164-product fixture
Sunscreen products in fixture = 11
New Persona scenarios = 40
  COVERAGE technical personas = 32
  valid ADVERSARIAL technical personas = 8
Contract-negative input fixtures = 8
Historical Recommendation baseline replay = existing 12 scenarios
Population-prior personas = 0 until external source adoption clears
LLM Judge calls = 0
Production network calls = 0
Hosted writes = 0
Product Fact writes = 0
Organic/controlled evidence writes = 0
```

The 40 P3 Persona scenarios are PoC fixtures, not claimed representative population and not automatically promoted to a LOCKED cohort.

P3 minimum acceptance targets are structural, not fabricated quality thresholds:

```text
same input + same engine/catalog/contracts -> deterministic semantic hash replay
DOMAIN_CORE_HARNESS executable offline
CONTRACT_INTEGRATION_HARNESS executable offline
harness equivalence assertions implemented
current 12-scenario historical replay preserved
E1 hard constraints executable deterministically
contract-gap observations typed, not silently normalized away
synthetic evidence written only to evaluation artifacts
```

P3 must not invent a synthetic pass-rate threshold such as 95% to claim user quality.

## 16. Carried risks / explicit non-authority

The following remain unresolved by design:

```text
external Korean population source adoption
real demographic-domain correlations
real-user Decision preference weights
market prevalence
real satisfaction/conversion
full independent catalog suitable-set authority
validated LLM Judge authority
real aggregate calibration
```

Consequences:

```text
POPULATION_PRIOR_REALISM = NOT_ESTABLISHED
REAL_USER_PREFERENCE_ORACLE = NOT_ESTABLISHED
CATALOG_COVERAGE_ORACLE = NOT_ESTABLISHED
LLM_JUDGE_RELEASE_AUTHORITY = NOT_ESTABLISHED
```

Where an independent catalog reference set cannot be justified, evaluation must return:

```text
CATALOG_COVERAGE_NOT_ESTABLISHED
```

rather than use current ranker Top-K as its own reference truth.

## 17. Production / Governance final boundary

```text
PERSONA_PRODUCTION_TRAFFIC_GENERATED = NO
PRODUCT_FACT_WRITE = 0
ORGANIC_EVIDENCE_WRITE = 0
CONTROLLED_PRODUCTION_PROBE = 0
SHADOW_MODE_CHANGED = NO
ENFORCE_AUTHORIZED_BY_PERSONA = NO
ENFORCE_ACTIVATED_BY_PERSONA = NO
PRODUCTION_CONFIG_CHANGE = 0
```

The P2 contract does not supersede Production/Governance authority.

## 18. EVAL-P2 terminal contract decision

```text
STAGE = EVAL-P2
CONTRACT_FREEZE = SUCCESS
POPULATION_PROJECTION_CONTRACT = FROZEN_V1
AUTHORIZED_POPULATION_DATASET = NONE
DOMAIN_PERSONA_CONTRACT = FROZEN_V1
CORRELATION_REGISTRY = FROZEN_V1
DECISION_MODEL_CONTRACT = FROZEN_V1
METAMORPHIC_RELATION_REGISTRY = FROZEN_V1
COHORT_MATERIALIZATION_CONTRACT = FROZEN_V1
HARNESS_EQUIVALENCE_CONTRACT = FROZEN_V1
ARTIFACT_HASH_CONTRACT = FROZEN_V1
P3_POC_SCOPE = FROZEN_V1
NEXT_STAGE = EVAL-P3
```

P2 success does not claim population realism or real-user preference validity. It authorizes only the bounded deterministic Persona Simulation harness PoC described above.