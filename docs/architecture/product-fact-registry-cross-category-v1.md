# Product Fact Registry Cross-Category v1

Status: **offline executable architecture POC / no Production activation**

Baseline: `main@e371d5bc037fb80d1edd3876f0c7d1d94a2c1461`

Registry version: `product-fact-registry-cross-category-v1`

## 1. Purpose

Phase 3A tests whether the Product Evidence architecture proven for cleanser facts can extend across structurally different product domains without either:

1. adding a new `products` column for every product property, or
2. degrading into an arbitrary string-tag warehouse.

This phase does **not** review real cross-category product claims, define a Production schema, activate Product Facts in recommendation, or finalize Decision Axes. It defines and executes a governed registry contract against synthetic but realistic sunscreen, treatment, moisturizer, and toner/pad cases.

The intended boundary remains:

```text
Evidence
→ governed Product Fact instances
→ future separately governed Decision Axis mapping
→ existing user/condition/constraint/utility layers
→ Recommendation
```

A Product Fact says what may be asserted about a product and under what evidence/scope. It does not contain recommendation weights.

## 2. Non-goals

Phase 3A intentionally excludes:

- new official-site / Hwahae / Olive Young product research;
- review scraping or manual product re-review;
- new canonical cross-category Product Fact truth for real products;
- Product Fact DB migrations or Hosted writes;
- Admin adoption or operation;
- recommendation scoring, penalties, hero boosts, or user-concern coefficients;
- Decision Axis Production definitions or runtime consumers;
- refactoring the Phase 2 cleanser POC onto the generic core;
- activation or modification of PR #167 or PR #177.

Real product evidence is a separate Phase 3B concern.

## 3. Current catalog inventory is not Product Fact authority

The current codebase and frozen recommendation reference provide useful structural inventory, but they do not provide proposition-level Product Fact authority for these domains.

The inventory boundary is explicit:

```text
current catalog / adapter / fixture value
!= reviewed Product Fact authority
```

Examples:

- an `spf_value` field does not prove the label was reviewed against scoped product evidence;
- `ingredient_signals` do not establish a specific active identity or concentration;
- `is_primary_moisturizer` is role metadata, not physical efficacy;
- `review_signals` label counts are not prevalence when the analyzed denominator is absent;
- adapter-derived `barrier_support`, `hydration_level`, or `irritation_risk` are not measurements.

The current recommendation adapter also contains fallbacks and sunscreen overrides. Phase 3A records those as provenance risks rather than treating them as evidence.

The executable audit is stored in:

`evidence/product-evidence-decision-axis-v1/current-catalog-inventory-audit-v1.json`

### 3.1 Reference inventory counts

The frozen 164-product recommendation reference used by current-main invariance contains:

| Domain | Count | Structural detail |
| --- | ---: | --- |
| Sunscreen | 11 | SPF/UVA/filter fields present on 11; water resistance on 1 |
| Treatment | 18 | canonical `treatment`, `product_form` present on 18 |
| Moisturizer | 61 | balm 20, cream 10, gel 10, lotion/emulsion 21 |
| Toner / pad | 48 | toner/essence 24, toner pad 24 |

These counts describe the reference inventory. They do not assert Hosted DB row counts or reviewed Product Fact completeness.

### 3.2 Current fallback/default risk

Current adapter behavior includes fallback or derivation paths such as:

- `skin_types → ["combination"]`;
- `concerns → ["dehydration"]`;
- `texture → "watery"`;
- `finish → "natural"`;
- `irritation_risk → "medium"`;
- Boolean coercion that can turn missing `sensitivity_safe` into `false`;
- sunscreen-specific null-filling overrides;
- derived barrier/hydration/sebum values.

These behaviors may be valid recommendation adapter behavior, but they are disqualified as automatic Product Fact authority.

## 4. Governed Fact Registry contract

A new fact key is admissible only through the versioned registry. Arbitrary unknown keys fail closed.

Each registry definition supports at least:

```text
fact_key
registry_version
domain_scope
value_type
allowed_values
unit_schema
cardinality
qualifier_schema
relationship_schema
scope_schema
semantic_definition
positive_evidence_requirement
negative_evidence_requirement
conflict_semantics
deprecated
superseded_by
```

The registry contains **no** recommendation `weight`, `score`, `penalty`, `hero_boost`, or `user_concern_coefficient`.

### 4.1 Key admission rule

A new key requires all of the following:

1. clear semantic definition;
2. structurally queryable product knowledge;
3. an evidence-verifiable proposition;
4. no semantic duplication of an existing key;
5. not merely a one-off marketing phrase;
6. durable product-knowledge value even if Recommendation never consumes it;
7. defined value and conflict semantics.

Marketing copy does not create a key by itself. A claim may instead use a governed semantic key, such as `barrier_support_claim`, with the original evidence/provenance retained outside the key name.

## 5. Value types

The POC registry proves support for:

- `boolean`;
- `enum`;
- `number`;
- `number_unit`;
- `range_unit`;
- `entity_identifier`.

Repeatability, scope, and relationships are orthogonal to value type.

Examples:

- `uv_filter_type`: enum;
- `water_resistance_duration`: number + `minutes`;
- `recommended_use_frequency`: number/range + `times_per_week`;
- `contains_active`: entity identifier;
- `active_concentration`: number + `%`, `ppm`, or `mg_per_g`;
- `tewl_change`: signed numeric measurement with a declared unit and method context.

Invalid enum values and units fail closed.

## 6. Fact instance identity and cardinality

A Product Fact instance has its own `fact_instance_id`. Registry definitions specify:

```text
cardinality = one | many
```

This is necessary for products containing several actives:

```text
contains_active
  fact_instance_id = active-niacinamide-1
  value = niacinamide

contains_active
  fact_instance_id = active-retinal-1
  value = retinal
```

Two supported independent facts are not a conflict. Cardinality `many` permits both instances. Cardinality `one` rejects duplicate same-key instances in the same proposition scope.

## 7. Relationship-bound facts

Related properties cannot lose their subject identity.

The chosen POC relationship contract is an explicit `subject_ref`:

```text
contains_active
  fact_instance_id = active-niacinamide-1
  value = niacinamide

active_concentration
  subject_ref = active-niacinamide-1
  value = 5
  unit = percent
```

A retinal concentration must reference the retinal active instance, not an unqualified product-level concentration field.

The verifier rejects:

- orphan `subject_ref` values;
- subject references to the wrong fact type;
- concentration instances that cannot identify their active subject.

Active identity evidence and concentration evidence remain separate provenance records. Establishing one does not establish the other.

## 8. Product, market, variant, and formulation scope

Product Fact truth is not assumed to apply forever to all markets and formulations sharing a display name.

The scope envelope can preserve:

```text
market
region
locale
variant
formulation_version
valid_from
valid_to
```

These fields are optional unless the fact definition or evidence requires them, but they remain part of proposition identity when present.

A Korea sunscreen label and a US label for the same named product therefore remain distinct scoped facts. The fusion layer must not collapse them into one global proposition merely because the canonical product identity matches.

## 9. Evidence class separation

Phase 3A explicitly separates:

### 9.1 Product claim

A producer/label assertion, for example `24h hydration` or a barrier-support claim. It establishes that the claim exists when evidence is sufficient; it does not automatically establish measured magnitude.

### 9.2 Measurement / test outcome

A numeric or categorical test result that requires the declared metric, unit where applicable, and method context. Measurement-shaped numeric facts fail if method/metric context is absent.

### 9.3 User/review observation

An observation such as white cast, stickiness, or eye sting. Aggregate counts without an analyzed denominator cannot be converted to prevalence.

### 9.4 Usage instruction

A direction such as `use twice weekly`. It is not a physical efficacy fact and does not imply effect magnitude.

Additional classes include composition identity, physical characteristic, role declaration, and legacy catalog observation. These remain semantically distinct rather than being collapsed into a generic “fact strength.”

## 10. Evidence authority and confidence are different dimensions

`evidence_authority` describes source/provenance class. `confidence` describes how strongly the reviewed proposition is established within the contract.

Several lower-authority observations do not become high-authority evidence by count alone. Conversely, a primary source can still yield limited confidence if wording or product/variant binding is ambiguous.

The POC carries the two fields separately and does not derive one numerically from the other.

## 11. Fact status and negative semantics

The cross-category model preserves Phase 2 statuses:

```text
supported
reviewed_not_established
not_reviewed
evidence_insufficient
evidence_conflict
```

Rules:

- absence is not `false`;
- not reviewed is not `false`;
- reviewed-but-not-established is not `false`;
- independent supported facts coexist;
- only meaningful support/opposition to the same scoped proposition produces `evidence_conflict`;
- unresolved conflict has authoritative `value = null`;
- explicit negative Boolean truth requires negative-proposition evidence permitted by that fact definition.

For example, an official “fragrance-free” marketing statement must not be silently reinterpreted as the stronger composition proposition “no fragrance ingredient exists” unless the registry definition and evidence actually support that proposition.

## 12. No generic intensity

The registry intentionally rejects universal fields such as:

```text
intensity = low | medium | high
strength = 1..3
```

Quantification must be attribute-specific. Examples include:

- SPF label value;
- water resistance minutes;
- active concentration;
- TEWL change;
- hydration change.

If no valid magnitude evidence exists, the fact remains qualitative, null, insufficient, or otherwise uncertainty-bounded. A marketing adjective never becomes a synthetic numeric intensity.

## 13. Sunscreen stress result contract

Synthetic cases prove:

- SPF numeric/label information, UVA label, and UV filter type can coexist as distinct facts;
- the same product name may hold different market-scoped protection labels without collapse;
- water resistance can carry numeric duration + minutes independently of protection completeness;
- white-cast and eye-sting observations remain observations;
- observation prevalence is forbidden without analyzed denominator;
- tone-up or white-cast metadata never becomes protection magnitude.

Missing water-resistance evidence therefore means “water resistance not established/reviewed,” not “sunscreen protection incomplete.”

## 14. Treatment / serum stress result contract

Synthetic cases prove:

- one or many active identities can coexist;
- each concentration is explicitly tied to its active via `subject_ref`;
- missing concentration does not mean zero concentration;
- active identity does not imply efficacy magnitude;
- product treatment claims do not become measured clinical outcomes;
- use-frequency instructions do not become physical efficacy;
- multiple actives do not imply additive Recommendation score.

## 15. Moisturizer stress result contract

Synthetic cases prove:

- full-face and local/spot-use role declarations are structured without new product columns;
- primary/local role is not Recommendation weight;
- a barrier-support claim is distinct from measured barrier improvement;
- TEWL/hydration measurements can carry numeric outcomes only with metric/unit/method context;
- balm-specific role information can coexist with generic cross-category facts.

## 16. Toner / pad stress result contract

Synthetic cases prove:

- liquid toner and pad are product-format facts, not skin effects;
- wipe-off use is a usage property;
- embossed/textured pad surface is a physical characteristic and does not automatically establish irritation magnitude;
- exfoliating active identity does not establish exfoliation intensity;
- recommended frequency is a usage instruction, not efficacy;
- pad-specific facts coexist with generic active/composition facts without special columns.

## 17. Shared facts across categories

A fact key is shared across categories only when its semantic proposition is actually the same. For example, `contains_active` can apply to treatment, toner/pad, moisturizer, or sunscreen without creating category-prefixed duplicates.

When meanings differ, the registry must use separate semantic definitions rather than forcing lexical similarity into a universal key.

`domain_scope` constrains where a fact is valid; it does not change its meaning.

## 18. Product Fact Registry is not Decision Axis Registry

Phase 3A defines only Product Facts and **mapping eligibility boundaries**.

Conceptual future axes may include names such as:

```text
photo_protection
cleansing_burden
hydration_support
barrier_support
irritation_burden
exfoliation_load
sebum_control
```

None is approved as a new Production axis by this phase.

Invariants:

- creating a Product Fact does not create a Decision Axis;
- Product Fact count does not determine recommendation dimensionality;
- the generic registry core has no automatic axis-generation method;
- Product Fact instances have no scoring weights.

## 19. Anti-feature-inflation boundary

Future consumption must not independently add score for every correlated Product Fact.

For correlated families such as:

```text
deep_cleansing
pore_cleansing
sebum_removal
clay_adsorption
```

or:

```text
barrier_support_claim
ceramide_presence
hydration_claim
```

a downstream policy layer must support at least:

- signal-family grouping;
- lineage deduplication;
- correlation grouping;
- saturation/capping.

This phase does not implement those score mechanics. It only forbids encoding them as registry weights and records the required architectural boundary.

## 20. Phase 2 preservation

The Phase 2 cleanser implementation remains an immutable regression baseline for this phase:

```text
26 products
52 propositions
low_ph supported = 13
deep_cleansing supported = 15
real numeric axis invention = 0
```

Phase 3A does not refactor or import the generic core into:

- `scripts/product-evidence/cleanser-poc-core.mjs`;
- `scripts/build-product-evidence-cleanser-poc-v1.mjs`;
- `scripts/verify-product-evidence-cleanser-poc-v1.mjs`;
- `evidence/product-evidence-decision-axis-v1/cleanser-poc-output-v1.json`.

The existing `PRODUCT_EVIDENCE_POC_FOCUSED_VERIFIER_EXECUTION_DEBT` remains recorded but is not a Phase 3A blocker. Phase 3A does not newly declare `PRODUCT_EVIDENCE_POC_VERIFIER_PASS`.

## 21. Executable verifier contract

`scripts/verify-product-fact-registry-cross-category-v1.mjs` directly verifies at least:

1. unique registry keys and fixed version;
2. unknown key rejection;
3. typed values, enums, units, and one/many cardinality;
4. repeated active identities;
5. subject-linked concentrations and orphan rejection;
6. retained market/variant scope and non-collapse of sunscreen market facts;
7. claim / measurement / observation / usage separation;
8. no review prevalence without analyzed denominator;
9. absence/not-reviewed semantics;
10. same-proposition conflict vs independent multi-fact coexistence;
11. role vs Recommendation weight separation;
12. no generic intensity or scoring fields in the Registry;
13. no automatic Decision Axis generation;
14. measurement metric/unit/context requirements;
15. marketing-key rejection;
16. prohibition on automatically upgrading legacy catalog observations to authoritative supported facts;
17. exact Phase 2 file blob preservation when full Git history is available;
18. exact offline-only changed-path allowlist and `git diff --check` when the baseline commit object is available.

If a runtime lacks the actual baseline Git object, the semantic verifier reports Git scope as not evaluated rather than fabricating a reconstructed full-history PASS. Remote Git compare and natural PR CI remain independent provenance evidence.

## 22. Production / Hosted invariance

Phase 3A must preserve:

```text
Production recommendation delta = 0
ranking delta = 0
Top Pick / Top3 delta = 0
Admin runtime delta = 0
DB migration = 0
Hosted write = 0
Production DB write = 0
CandidatePolicy activation = 0
PR #167 activation = 0
legacy cleansing_profile removal = 0
Product Fact runtime consumer = 0
Decision Axis runtime consumer = 0
```

The implementation is restricted to architecture documentation, offline registry/fixture/audit evidence, and offline verification scripts.

## 23. Phase 3A success meaning

A successful Phase 3A means only that the generic contract can represent and validate:

- non-Boolean typed facts;
- repeatable facts;
- linked facts;
- numeric/unit facts;
- category/domain scope;
- market/variant/formulation scope;
- evidence provenance independently from fact values;
- claim/measurement/observation/usage distinctions;
- Product Facts without new product columns;
- governed keys without arbitrary tags;
- strict separation from Recommendation scoring.

It does **not** mean cross-category facts have been reviewed against real evidence or that the registry/schema is Production-ready.

## 24. Next boundary

Phase 3B may define a small frozen, reviewed real-evidence pilot using the approved registry contract. That phase must independently establish product identity, evidence provenance, scope, and fact truth. Existing legacy catalog values cannot serve as a shortcut to `supported` Product Facts.
