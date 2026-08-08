# Product Fact Storage / Admin Review Architecture v1

Status: **architecture/design candidate — no Production schema finalization, no migration, no activation**

Authority baseline audited for this design:

```text
repository: gycha0109-beep/K_beauty
main: a35fb7d7be11b030f7c7281e7fd3fac24a9b1e71
Phase 3A registry: product-fact-registry-cross-category-v1
Phase 3B pilot: cross-category-real-evidence-pilot-v1
```

This document defines a Production-candidate persistence and Admin review architecture. All table names below are **Candidate table/model** names, not approved migration names.

---

## 1. Status / Scope

The target boundary remains:

```text
Product Identity
→ Evidence Source
→ EvidenceRecord
→ Fused Product Fact
→ Product Decision Axis
→ User Concern / Condition
→ constraints + utility
→ Recommendation Ranking
```

This design converts the already-tested Product Evidence / Product Fact semantics into a persistence and Admin-operations candidate without collapsing those layers.

In scope:

- Product Fact persistence candidate model;
- Product identity, market, variant and formulation lineage;
- source and EvidenceRecord persistence;
- proposition identity and scope representation;
- fused Product Fact history/current-state model;
- Registry governance and version binding;
- Admin review, adjudication, re-review and supersession lifecycle;
- reuse/generalization boundary for current Admin v1/v2 infrastructure;
- legacy catalog and frozen cleanser corpus adoption boundaries;
- Decision Axis and Recommendation-facing read boundaries;
- migration, idempotency, rollback, Hosted activation and security gates.

Out of scope:

- migration SQL or Supabase schema changes;
- Hosted or Production DB operations;
- Admin UI implementation;
- Product Fact runtime consumer implementation;
- Decision Axis implementation;
- recommendation scorer or penalty changes;
- catalog backfill/adoption confirmation;
- `products.cleansing_profile` removal;
- PR #167 or PR #177 modification/activation;
- S1 vocabulary candidate admission;
- Recommendation activation.

Maximum status authorized by this document:

```text
PRODUCT_FACT_STORAGE_ADMIN_REVIEW_ARCHITECTURE_DESIGNED
MIGRATION_BOUNDARY_DESIGNED
LEGACY_ADOPTION_BOUNDARY_DESIGNED
```

This document does **not** authorize `PRODUCT_FACT_SCHEMA_FINAL` or any Production-ready declaration.

---

## 2. Current-state audit

### 2.1 Phase 3A / 3B Product Fact architecture

Current main contains the frozen Phase 3A Registry/Core and Phase 3B real-evidence pilot.

The Registry requires governed definitions with:

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
proposition_identity_schema
semantic_definition
positive_evidence_requirement
negative_evidence_requirement
conflict_semantics
permitted_evidence_classes
deprecated
superseded_by
```

The executable core distinguishes:

- storage `fact_instance_id` from semantic proposition identity;
- `equivalent | narrower | broader | disjoint | overlapping` scope relations;
- subject-bound relationships such as `active_concentration -> contains_active`;
- EvidenceRecord from Fused Product Fact;
- heterogeneous evidence classes from fused semantic truth;
- explicit negative from missing/not-established evidence;
- same-proposition contradiction from independent multi-fact coexistence.

Phase 3B then tested those contracts with real evidence:

```text
products = 12
sources = 15
evidence_records = 29
fused_facts = 23
S1 = 4
S2 = 0
S3 = 4
forced_mapping_count = 0
architecture_outcome = ARCHITECTURE_SURVIVES_REAL_EVIDENCE_PILOT
```

Current catalog metadata was candidate-selection inventory only and was explicitly not Product Fact authority.

The four S1 vocabulary candidates remain non-canonical:

```text
uva_regulatory_label_broad_spectrum
uv_water_resistance_rating
general_irritation_observed
subjective_soothing_observed
```

They MUST NOT appear in a Product Fact Registry DB mirror as admitted canonical keys until a separate Registry governance review approves them.

### 2.2 Existing Admin v1

Current Admin v1 already solves operational concerns that Product Fact review should reuse rather than rebuild:

```text
candidate/review queue
→ export package
→ external review
→ strict dry-run
→ exact pre-state binding
→ atomic confirm
→ audit
→ idempotency ledger
```

Current durable primitives include:

- authenticated Admin membership;
- capability checks, including `admin.products.review`;
- server-derived actor identity;
- same-origin mutation protection;
- service-role-only mutation boundary;
- bounded request/file bodies and safe errors;
- batch/request IDs and payload digests;
- optimistic concurrency and stale-state rejection;
- advisory locks and deterministic row locking;
- PostgreSQL transaction atomicity;
- audit events and fail-closed rollback;
- RLS/direct-browser-write denial.

These are operational infrastructure, not Product Fact semantics.

### 2.3 Existing Cleanser Metadata Admin v2

Current main also contains the Cleanser Metadata Admin v2 implementation.

Its durable storage is centered on:

```text
products.cleansing_profile
product_metadata_field_reviews
admin_product_review_import_v2_confirmations
product_metadata_review_completeness_v1
```

`product_metadata_field_reviews` currently has a primary key of `(product_id, field_name)` and enforces:

```text
field_name = cleansing_profile
field_value = low_ph | balanced | deep_clean | null
review_state = reviewed_valid | reviewed_unknown | reviewed_conflict | not_applicable
```

It embeds field evidence as JSONB, binds candidate/import lineage, and writes the scalar `products.cleansing_profile` in the same confirm transaction.

This is a valid bounded scalar metadata review contract. It is **not** a cross-category sparse Product Fact persistence model.

### 2.4 Current product/catalog inventory

The current inventory audit covers 164 reference products and identifies existing legacy/runtime fields across sunscreen, treatment, moisturizer and toner/pad categories.

Examples include:

```text
skin_types
concerns
texture
finish
irritation_risk
sensitivity_safe
cleansing_profile
sunscreen protection/wear fields
ingredient_signals
review_signals
market_signals
balm role/tag fields
```

The same audit records fallback risks in the runtime adapter, including default `combination`, `dehydration`, `watery`, `natural`, `medium`, and missing-value boolean coercion risk. Therefore normalized runtime values cannot be retroactively treated as reviewed Product Facts.

Current normalized product identity remains useful for commerce/catalog matching, but it is insufficient for semantic Product Fact subject identity. The current promotion normalizer intentionally strips volume and tokens such as refill/set/bundle/renewal. Those rules are useful for dedupe, but they may erase exactly the variant/formulation distinctions required by Product Fact provenance.

### 2.5 Current authority conclusion

```text
Current products/catalog metadata
= legacy inventory / runtime compatibility input
!= reviewed Product Fact authority

Cleanser Admin v2 review envelope
= scalar compatibility review authority
!= cross-category Product Fact model

Phase 3A Registry/Core
= semantic architecture authority for this design

Phase 3B pilot
= real-evidence architecture validation input
```

PR #177 is an Open/Draft/unmerged catalog-adoption design and is not current-main authority. This architecture is designed to coexist with it if it is later approved, without depending on it.

---

## 3. Problem definition

A Product Fact persistence layer must support sparse and evolving propositions without either failure mode below.

### Failure mode A — closed schema expansion

```text
new semantic property
→ add products column
→ add field-specific review enum
→ add field-specific Admin route
→ repeat
```

This cannot scale to cross-category Facts such as multiple actives, subject-bound concentrations, scoped market claims, measurements with timepoints, pad physical properties, and future categories.

### Failure mode B — untyped JSON/tag warehouse

```text
fact_key + arbitrary JSON value + arbitrary evidence JSON
```

This loses typed queryability, proposition identity, scope safety, cardinality rules, relationship constraints and fail-closed Registry governance.

The target is a third model:

```text
governed Registry definition
+ typed sparse Fact instances
+ explicit semantic proposition identity
+ explicit source/evidence lineage
+ immutable review history
+ bounded current-state projection
```

---

## 4. Existing Admin v2 reuse matrix

| Existing element | Classification | Product Fact decision |
| --- | --- | --- |
| authenticated Admin session | `REUSE_AS_IS` | Same Admin identity boundary. |
| `admin.products.review` capability | `REUSE_AS_IS` initially | Product Fact review can use the same capability until a later least-privilege split is justified. |
| server-derived reviewer actor | `REUSE_AS_IS` | Client/corpus/evidence must never supply final Admin actor. |
| same-origin mutation policy | `REUSE_AS_IS` | Required for all new mutation endpoints. |
| service-role server boundary | `REUSE_AS_IS` | No browser direct Product Fact mutation. |
| RLS/direct privilege denial pattern | `REUSE_AS_IS` | New semantic tables default to no browser writes. |
| safe error projection / body limits | `REUSE_AS_IS` | Product Fact payloads remain bounded and allowlisted. |
| request ID / exact retry | `GENERALIZE` | New Product Fact namespace and payload identity required. |
| export/batch ID | `GENERALIZE` | Candidate import, catalog adoption, and Product Fact research/import need distinct lineage namespaces. |
| canonical payload digest | `REUSE_AS_IS` concept | Canonicalization schema is Product Fact-specific. |
| evidence digest binding | `REUSE_AS_IS` concept | EvidenceRecord canonical digest and source digest become first-class. |
| dry-run / confirm separation | `REUSE_AS_IS` | Required for semantic writes and adoption. |
| optimistic concurrency | `REUSE_AS_IS` concept | Bind subject, source, evidence, current proposition/fact and Registry version pre-state. |
| advisory locks / deterministic lock order | `REUSE_AS_IS` concept | Lock Product Fact subjects/propositions/current pointers deterministically. |
| atomic PostgreSQL transaction | `REUSE_AS_IS` | Confirm + current pointer + audit + idempotency must be atomic. |
| audit writer | `GENERALIZE` | Reuse actor/action framework, but keep raw evidence/source bodies out of audit metadata. |
| `product_metadata_field_reviews` row model | `COMPATIBILITY_ONLY` | Keep for scalar legacy metadata reviews. Do not generalize it into Product Fact storage. |
| `field_name = cleansing_profile` | `COMPATIBILITY_ONLY` | Explicitly cleanser scalar-specific. |
| `field_value text` | `DO_NOT_REUSE` for Product Facts | Cannot represent typed values/relationships/cardinality safely. |
| `(product_id, field_name)` PK | `DO_NOT_REUSE` for Product Facts | Cannot represent multiple semantic propositions or scoped versions. |
| `reviewed_valid/unknown/conflict/not_applicable` | `SUPERSEDE_FOR_PRODUCT_FACT` | Product Fact semantic states use the Phase 3A Registry states; operational states are separate. |
| embedded `evidence_records jsonb` | `DO_NOT_REUSE` as canonical evidence store | Product Fact EvidenceRecords must be independently addressable and reusable across fused facts. |
| direct `products.cleansing_profile` write | `COMPATIBILITY_ONLY` | Never the canonical Product Fact write path. |
| cleanser completeness view | `COMPATIBILITY_ONLY` | Future Product Fact readiness needs proposition/Registry-aware projection. |

### Answer to Q1 / Q2

`product_metadata_field_reviews` should **not** be generalized into the canonical Product Fact model. It remains the scalar legacy metadata-review compatibility layer. Its operational patterns are reusable, but its semantic row shape is not.

---

## 5. Canonical entity model

Candidate table/model names:

| Candidate entity/model | Purpose | Canonical authority | Key identity | Relationships | Mutation model | Runtime visibility | Admin visibility | Retention |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `product_fact_registry_versions` | Registry release/version checksum and effective window | code/config Registry release | registry_version | definition snapshot/mirror | append-only release | version only | full | permanent |
| `product_fact_definition_snapshots` | optional DB query projection of approved definitions | mirror, not primary authority | registry_version + fact_key | registry version | append-only per release | no direct Recommendation read | full | permanent |
| `product_fact_subjects` | resolved product/market/variant/formulation semantic subject | Product Fact identity boundary | subject_id + product_id + scope/version | products, lineage parent | versioned | bounded ID only | full | permanent |
| `product_evidence_sources` | source identity/provenance/access snapshot metadata | source provenance | source_id / canonical source digest | subject(s) | append-only with verification events | none | full | permanent metadata; body optional/limited |
| `product_evidence_records` | proposition-targeted evidence assertion | evidence layer | evidence_id | source, subject, Registry definition | append-only | none | full | permanent unless legal retention requires removal of content refs |
| `product_fact_instances` | immutable fused semantic result/version | Product Fact history | fact_instance_id | subject, proposition, Registry version | append-only versions | via approved projection only | full | permanent |
| `product_fact_evidence_links` | supporting/opposing lineage | lineage | fact_instance_id + evidence_id + role | Fact/Evidence | append-only with Fact version | none | full | permanent |
| `product_fact_current` | one approved current pointer per semantic proposition | current Product Fact projection | proposition_key | current fact_instance_id | transactional pointer replacement | Decision Axis interface | full | current + audit history elsewhere |
| `product_fact_review_assignments` | assignment/queue state | Admin workflow only | assignment_id | subject/proposition/reviewer pool | mutable operational state | none | full | policy-defined |
| `product_fact_review_events` | review/adjudication/re-review timeline | Admin audit semantic supplement | event_id | assignment/fact/evidence | append-only | none | full | permanent/audit policy |
| `product_fact_confirmations` | request/batch idempotency and bounded result | operational | request_id + namespace | payload/prestate digest | append-only | none | bounded | permanent/audit policy |

No candidate table name is final until migration design approval.

---

## 6. Product identity / formulation lineage

### 6.1 `products.id` remains necessary but insufficient

`products.id` remains the catalog/commercial anchor. Product Facts should reference it, but Product Fact semantic subject identity needs an additional versioned subject boundary.

A candidate `product_fact_subjects` record should represent:

```text
subject_id
product_id
market
region
locale
variant
formulation_version
valid_from
valid_to
identity_status
identity_resolution_version
lineage_parent_subject_id / supersedes_subject_id
created_at
```

`size` should not automatically become a formulation dimension. It may be stored as source/commerce identity metadata and promoted into subject identity only when the reviewed source demonstrates that size maps to a distinct variant/formulation.

### 6.2 Phase 3B S3 acceptance cases

The future schema/review flow must preserve these cases without forced merge:

- **ILLIYOON** — exact 150mL retailer identity can resolve the catalog row while official physical Fact authority remains source-blocked.
- **Dr.G EX** — exact EX identity/review source does not imply an exact official EX physical source.
- **ANUA toner 350mL** — exact-size identity may be resolved while a different-size official page remains only partial scope evidence.
- **NEEDLY Daily Toner Pad** — renewed official product cannot be collapsed into a frozen catalog row when formulation/version lineage is unresolved.

### 6.3 Identity state is not Fact state

Candidate operational identity outcomes include:

```text
resolved
ambiguous
unresolved
```

`identity_blocked` is a workflow/adoption blockage attached to subject/evidence processing. It is not a Product Fact semantic status and must not be written into `product_fact_instances.status`.

---

## 7. Fact Registry governance

### 7.1 Authority choice

Recommended v1 governance:

```text
Code/config Registry artifact
= semantic authority

DB Registry version/checksum row
= release binding

Optional DB definition snapshot
= query/Admin projection only
```

Rationale:

1. Phase 3A Registry semantics are already executable and verifier-bound.
2. Allowing direct DB edits to Fact definitions would split semantic authority between application history and DB state.
3. A DB mirror is still useful for SQL checks, Admin display and historical interpretation.
4. Version/checksum binding lets persisted Evidence/Facts remain interpretable after Registry evolution.

### 7.2 Synchronization contract

If a DB mirror is implemented later:

- Registry releases are immutable.
- `registry_version + canonical_sha256` is unique.
- a DB snapshot is published only through an approved migration/release operation;
- the migration/verifier must byte/canonical-content match the code artifact;
- application code fails closed if a persisted Registry version is unknown;
- Admin cannot edit Fact definitions in place;
- S1 candidates are not mirrored as admitted Facts until formally accepted.

### 7.3 Definition lifecycle

Definition fields include the Phase 3A fields plus release governance metadata:

```text
activation/effective window
deprecated
superseded_by
release digest
```

Deprecation does not rewrite historical Fact instances. Old instances retain their original Registry version and definition interpretation.

### Answers to Q13 / Q14

Existing Fact instances remain immutable under their original `registry_version`. A superseding Registry version may create new review/adjudication work and a new current Fact version, but old history is retained. `deprecated` prevents new canonical creation under the deprecated definition after the effective cutoff; it does not erase prior truth history.

---

## 8. Evidence Source model

### Q4 — source and EvidenceRecord separation

**Yes. They must be separate.**

One source page/document may support multiple propositions, and multiple EvidenceRecords may target different Facts or different support directions from the same source.

Candidate `product_evidence_sources` fields:

```text
source_id
source_kind
publisher/source identity
canonical safe URL or immutable document reference
market/region/language
exact_product_match state
subject binding / source identity state
accessed_at
last_verified_at
availability state
source_content_digest
source_metadata_digest
archive/reference policy marker
created_at
```

The source row does not state Product Fact truth.

### Raw body policy

Default recommendation: **do not persist arbitrary raw source bodies** in the Product Fact operational DB.

Prefer:

- safe source reference;
- accessed timestamp;
- canonical digest;
- bounded structured extraction/evidence record;
- optional immutable snapshot reference only when legally/operationally justified and separately protected.

This reduces copyright, secret/log and retention risk while preserving change detection and auditability.

A source changing or disappearing should produce a verification event/re-review trigger; it must not mutate historical EvidenceRecords in place.

---

## 9. EvidenceRecord persistence

### Q3 — append-only?

**Yes, semantic EvidenceRecords should be append-only.**

A correction, re-extraction, source change or scope correction creates a new EvidenceRecord and a supersession/invalidation event. Historical records remain linked to the Fact version that consumed them.

Minimum persisted semantics:

```text
evidence_id
registry_version
fact_key
subject_id
subject_ref when required
proposition target/proposition key
proposition_value_identity when required
evidence_class
evidence_authority
evidence_confidence
support_direction
negative_admissibility
source_id
source_provenance
accessed_at
scope
qualifier context
formulation/market validity
evidence_digest
supersedes_evidence_id / invalidation state
created_at
```

Evidence classes remain exactly governed by the Registry version, initially:

```text
product_claim
measurement
observation
usage_instruction
composition_identity
physical_characteristic
role_declaration
legacy_catalog_observation
```

Rules:

- official page does not imply measurement;
- marketing numeric wording does not imply measured magnitude;
- ingredient identity does not imply efficacy magnitude;
- review observation does not imply prevalence;
- missing analyzed denominator forbids prevalence;
- `not established != false`;
- missing Fact != false.

Evidence confidence is confidence in the evidence/proposition binding, not fused Product Fact confidence and not Recommendation utility.

---

## 10. Proposition identity

### Q6 — DB representation

Store both:

```text
fact_instance_id = lineage/version identity
proposition_key = semantic identity digest/key
```

`proposition_key` should be derived deterministically from:

```text
registry_version-compatible proposition identity rule
fact_key
subject identity
subject_ref where configured
value identity where configured
canonical scope dimensions
canonical qualifier identity dimensions
```

The asserted answer/value is excluded when it is the answer to the proposition rather than part of identity.

Recommended representation:

- canonical structured identity columns/fields for querying;
- canonical serializer version;
- SHA-256 `proposition_key` or digest for uniqueness/stale binding;
- verifier that recomputes it from structured fields.

Raw JSON object equality must never decide proposition equality.

---

## 11. Scope / qualifier representation

### Q7 — JSONB or normalized rows?

Recommended v1: **hybrid typed columns + constrained JSONB qualifiers**.

Frequently queried and identity-critical scope dimensions should be normalized columns:

```text
market
region
locale
variant
formulation_version
valid_from
valid_to
```

Reasons:

- predictable indexes and uniqueness;
- easier overlap/range queries;
- simpler stale/pre-state bindings;
- explicit relationship inheritance constraints;
- less semantic drift than arbitrary JSON.

Registry-specific qualifiers should use constrained canonical JSONB initially because qualifier shapes vary by Fact and would otherwise create many sparse columns/tables. The Registry validator must reject unknown/invalid qualifier keys and canonicalize qualifier identity fields before calculating `proposition_key`.

If a qualifier becomes high-volume/query-critical, it can later receive a normalized child model under a new schema version.

Trade-off:

- full JSONB is migration-light but weak for overlap/typed constraints;
- fully normalized child rows are strict but operationally expensive for sparse evolving definitions;
- the hybrid model preserves critical scope safety while allowing Registry evolution.

---

## 12. Fused Product Fact persistence

### Q5 — mutable row vs immutable version?

Recommended model: **immutable versioned Fact instance + explicit current pointer/projection**.

`product_fact_instances` is append-only semantic history. A review/adjudication change creates a new Fact instance. `product_fact_current` moves transactionally to the approved current Fact instance for that proposition.

Benefits:

- audit and rollback without destructive mutation;
- Registry evolution remains interpretable;
- re-review can compare old/new evidence sets;
- source/formulation changes can invalidate currentness without deleting history;
- recommendation-facing consumers can read one bounded current projection.

Minimum Fact instance semantics:

```text
fact_instance_id
proposition_key
registry_version
fact_key
subject_id
subject_ref
scope
qualifier identity/status
semantic status
typed value
authority_ceiling
fused_confidence
fusion_policy_version
fusion_input_digest
created_at
adjudicated_at
supersedes_fact_instance_id
```

Supporting/opposing evidence belongs in a link table, not one undifferentiated JSON array.

A Fused Fact MUST NOT copy:

```text
single evidence_class
single evidence_authority
raw evidence confidence
generic undifferentiated evidence_refs
```

---

## 13. Fact semantic status

Canonical Product Fact semantic status remains the Phase 3A Registry set:

```text
supported
reviewed_not_established
not_reviewed
evidence_insufficient
evidence_conflict
```

### Q11 — explicit negative vs reviewed-not-established

They are different database semantics.

```text
explicit negative
= status supported
+ typed boolean value false
+ same-proposition evidence with negative_admissibility = explicit_negative

reviewed_not_established
= status reviewed_not_established
+ authoritative value null
```

Absence, ambiguous opposition, context-only evidence or review incompleteness cannot create `false`.

### Q12 — identity/source blocked

`identity_blocked` and `source_blocked` are **workflow/research blockage states**, not Product Fact semantic states. They belong to subject/evidence review tasks, assignments, gap/adoption results or review events.

A blocked proposition may have no new Fact instance, or may retain an older current instance marked stale/re-review-required operationally; it must not invent a semantic Product Fact status outside the Registry.

---

## 14. Admin operational review lifecycle

Admin operational state should be modeled separately from semantic Fact state.

Candidate lifecycle:

```text
not_reviewed
→ queued
→ assigned
→ under_review
→ identity/source inspection
→ proposition review
→ needs_adjudication (when required)
→ ready_for_confirm
→ confirmed
→ current
→ stale / re_review_required
→ superseded
```

Operational blockers include:

```text
identity_blocked
source_blocked
registry_gap
needs_adjudication
stale_prestate
```

The UI may display these, but they must not be encoded into the Product Fact semantic status enum.

Admin confirmation remains a two-step operation:

```text
canonical dry-run
→ operator reviews exact planned result
→ confirm against the same Registry/source/evidence/subject/current-Fact pre-state
```

---

## 15. Fusion / adjudication lifecycle

Candidate lifecycle per proposition:

```text
resolved subject
+ validated EvidenceRecords
→ group by semantic proposition
→ validate support/opposition admissibility
→ deterministic fusion proposal
→ Admin review/adjudication where policy requires
→ proposed Fact instance
→ dry-run
→ atomic confirm
→ current pointer update
```

Fusion must be deterministic for the same:

```text
Registry version
subject version
EvidenceRecord set
fusion policy version
```

Persist `fusion_input_digest` over those inputs. Repeating the same fusion request must produce the same semantic proposal and no additional confirmed current version.

Conflicting supported values for an overlapping cardinality-one proposition fail closed into `evidence_conflict`; they do not coexist as two current supported facts.

For cardinality-many, multiple independent propositions may coexist only when the Registry proposition identity says they are independent.

### Q9 — cardinality-many

Represent each semantic proposition as its own proposition/current row. Examples:

```text
contains_active=niacinamide
contains_active=retinal
```

are independent because value identity belongs to proposition identity.

```text
active_concentration(subject_ref=niacinamide)=5%
active_concentration(subject_ref=retinal)=0.1%
```

are independent because `subject_ref` differs.

Two incompatible concentrations for the same active and overlapping scope require conflict handling.

---

## 16. Audit and provenance

Two audit layers are recommended:

1. existing general Admin audit event framework for security/operation accountability;
2. Product Fact semantic review events for domain history.

General Admin audit records:

```text
actor
capability
action
request/batch id
subject/proposition IDs
before/after semantic status IDs or digests
payload/prestate digest
result
timestamp
```

It should not contain raw source bodies, full URLs where unnecessary, reviewer email, cookies, tokens, or large evidence payloads.

Product Fact review events may record bounded reason codes, source/evidence IDs, adjudication outcome, Registry version and re-review trigger.

### Q10 — supporting/opposing lineage

Use an explicit `product_fact_evidence_links` candidate model:

```text
fact_instance_id
evidence_id
link_role = supporting | opposing
ordinal/created_at if needed
```

This preserves heterogeneous evidence lineage and direction while keeping the Fact semantic row clean.

---

## 17. Legacy metadata compatibility

No current product metadata is deleted by this architecture.

In particular:

```text
products.cleansing_profile
= LEGACY / DERIVED / NON-CANONICAL compatibility field
```

until a separate migration/consumer activation explicitly changes that status.

Three lineages remain distinct:

```text
A. current catalog metadata
   → legacy catalog observation / runtime compatibility

B. frozen reviewed cleanser corpus
   → reviewed legacy research lineage

C. new Product Fact system
   → canonical Product Fact lineage
```

A scalar compatibility field may later be projected from canonical Product Facts only under a separately approved projection policy. This design does not authorize that projection or any current-row rewrite.

### Q16 — products row relation

`products` remains the commercial/catalog parent and lookup anchor. Canonical Product Facts attach to a versioned Product Fact subject that references `products.id`; they do not become columns on `products` by default.

---

## 18. Frozen cleanser corpus adoption boundary

The frozen corpus remains:

```text
valid = 22
unknown = 1
conflict = 3

direct eligible = 22
evidence upgrade required = 1
schema mapping required = 3
```

It is never declared 26/26 ready.

### Q17 — lineage

If the frozen cleanser corpus is later adopted into Product Facts, it requires an explicit **legacy reviewed research adoption contract** with:

```text
source corpus version + SHA
product identity binding
per-evidence provenance mapping
Registry version
legacy evidence-class mapping
proposition mapping
conflict mapping
Admin adopter identity
request/batch id
payload/prestate digest
```

No row may become canonical Product Fact authority simply because `products.cleansing_profile` or `product_metadata_field_reviews` contains a value.

PR #177, if later approved, can continue to serve the scalar Admin-v2 compatibility/adoption problem. It must not be interpreted as Product Fact adoption. In particular, a scalar `reviewed_conflict` caused by `low_ph` and `deep_cleansing` both being supported is not a same-proposition Product Fact conflict; those are independent Facts in the Phase 3A architecture.

---

## 19. Current catalog adoption boundary

Current catalog values follow:

```text
catalog metadata
→ legacy_catalog_observation EvidenceRecord only when explicitly imported with lineage
→ never automatic supported Product Fact
```

Automatic promotion is forbidden.

A future adoption/import must distinguish:

- pure inventory fields used only to locate the product;
- reviewed legacy evidence with explicit provenance;
- adapter-derived/fallback values that cannot establish Product Facts;
- fields whose source/formulation scope is unknown.

For fields derived from runtime fallback/defaults, the default action is **do not create EvidenceRecord** unless the lineage explicitly records that the evidence is merely `legacy_catalog_observation` and non-authoritative.

---

## 20. Decision Axis boundary

Product Fact persistence stops before Decision Axis policy.

A future Product Fact read interface for Decision Axis should expose only approved/current proposition data required by the mapper, for example:

```text
product/subject ID
fact key
typed value
semantic status
authority ceiling
fused confidence / uncertainty
scope
Registry version
Fact instance / lineage ID
```

It should not expose raw Admin review state, reviewer identity, raw source body, full audit history or unapproved EvidenceRecords.

### Q18 — consumer interface

Recommended interface:

```text
Approved Product Fact projection
→ versioned Decision Axis mapper
→ Decision Axis snapshot
```

The mapper reads a bounded current Product Fact projection by subject + Registry/policy version, not arbitrary tables. Missing, conflict and not-established states remain explicit inputs rather than being coerced to false/zero.

---

## 21. Recommendation consumer boundary

Recommendation runtime should ultimately receive a Decision Axis projection such as:

```text
axis key
estimate/value
uncertainty/coverage
eligibility/context
Decision Axis policy version
upstream lineage ID
```

It must not receive:

```text
reviewer UUID/email
raw source body
full source URLs
Admin comments
audit event history
unapproved evidence
raw conflict text
```

Explainability is a separate lineage query:

```text
recommendation contribution
→ recommendation policy/version
→ Decision Axis snapshot
→ Product Fact instance
→ bounded Evidence summary
→ source scope/provenance
```

Recommendation must not query raw evidence or Admin audit tables directly.

---

## 22. Migration sequence

No migration is created in this phase. Future implementation gates are:

| Stage | Gate | Required evidence before next stage |
| ---: | --- | --- |
| 1 | schema design freeze | approved entity/identity/scope/value/current-pointer decisions; threat and rollback review |
| 2 | migration SQL implementation | migration files only after Stage 1 approval; no Hosted apply |
| 3 | static migration verifier | exact objects, constraints, RLS, privileges, Registry checks, forbidden paths |
| 4 | local clean DB replay | fresh DB can replay complete migration chain |
| 5 | local existing-schema upgrade rehearsal | current-main-equivalent DB upgrades without legacy data loss |
| 6 | idempotency verification | migration and semantic operation retry matrix passes |
| 7 | rollback rehearsal | pre-Hosted and post-data semantic rollback procedure proven locally |
| 8 | Draft PR exact-head CI | exact checkout, migration/runtime/security/build evidence |
| 9 | main integration | approved merge only; new main exact SHA recorded |
| 10 | Hosted migration approval | explicit separate coordinator approval |
| 11 | Hosted migration | additive schema only under reviewed runbook |
| 12 | Hosted schema verification | tables/constraints/RLS/functions/checks match expected exact version |
| 13 | Admin workflow enablement | write path enabled only after Hosted verification |
| 14 | small catalog adoption dry-run | zero writes; exact cohort/prestate/evidence counts |
| 15 | adoption confirm | explicit separate approval; bounded cohort only |
| 16 | Decision Axis consumer integration | Product Fact projection only; no raw evidence consumer |
| 17 | recommendation shadow verification | legacy vs proposed comparison, invariance/expected delta evidence |
| 18 | separate Recommendation activation review | explicit policy/penalty/consumer activation approval |

Every stage has a distinct state. Implementation, merge, Hosted schema presence, Admin operation, catalog adoption and recommendation activation are never collapsed into one “done” state.

---

## 23. Backfill / adoption sequence

Recommended future adoption order:

```text
1. zero-data schema + Admin contracts
2. synthetic/local fixtures
3. Phase 3B 12-product evidence replay into candidate Product Fact model
4. verify byte/semantic equivalence to frozen mapping
5. frozen cleanser corpus explicit legacy research adoption dry-run
6. only approved subset confirm after separate approval
7. current catalog other categories remain unadopted
8. new evidence enters native Product Fact workflow
```

Phase 3B real-evidence pilot is the best first semantic replay because it contains relationship, scope, market/variant, source-shortage and identity-ambiguity cases without requiring Production catalog-wide adoption.

A successful replay means the persistence model can represent the frozen semantic output. It does not mean the 12 products are Production-complete or the S1 vocabulary is admitted.

---

## 24. Idempotency

Idempotency is required at multiple layers.

### Migration idempotency

- exact schema object/version checks;
- deterministic constraints/indexes/functions;
- upgrade rehearsals from current main;
- no silent replacement of unknown schema versions.

### Semantic import idempotency

Key inputs:

```text
import/adoption namespace
batch ID
Registry version
subject set
source/evidence set
canonical payload digest
prestate digest
```

Exact retry returns exact prior result. Same request ID with changed semantic payload fails closed.

### Review action idempotency

```text
request ID
actor
proposition key
expected current Fact instance
expected evidence/fusion digest
expected subject/Registry versions
```

Exact retry adds zero new Fact instances, current-pointer moves or audit events.

### Fusion/adjudication idempotency

Deterministic `fusion_input_digest` binds Registry + proposition + evidence set + fusion policy. Same digest cannot create duplicate current semantic versions.

### Catalog adoption idempotency

Catalog import/adoption has its own lineage namespace and ledger. It must never reuse candidate-import IDs merely to fit an existing path.

---

## 25. Rollback strategy

A down migration alone is not rollback.

### Before Hosted

- revert code/migration branch;
- run clean replay and existing-schema upgrade rollback rehearsal;
- no remote data consequences.

### After Hosted migration, before Admin activation

Preferred rollback is **operational disablement first**:

1. keep new tables dormant;
2. disable Product Fact write routes/feature gate;
3. rollback application readers/writers;
4. preserve additive schema and audit until reviewed removal is safe;
5. only run destructive schema reversal under explicit DB rollback approval.

No semantic data should exist yet, so schema removal may be possible but is still a separate reviewed action.

### After Product Facts exist

Do not delete history to “rollback.”

Semantic rollback means:

```text
stop new writes
→ identify affected batch/Fact versions
→ restore prior current pointers where valid
→ mark/supersede/revoke affected current instances operationally
→ preserve EvidenceRecords and audit lineage
→ verify Decision Axis consumers no longer reference affected lineage
```

If a Registry/schema defect makes a Fact uninterpretable, quarantine current consumption and retain the historical row for forensic/audit purposes.

Recommendation activation rollback is separately controlled at the Decision Axis/Recommendation policy layer.

---

## 26. Hosted activation gates

Hosted schema presence does not imply operation.

Required gates:

```text
HOSTED_SCHEMA_PRESENT
≠ ADMIN_PRODUCT_FACT_OPERATIONAL
≠ CATALOG_ADOPTED
≠ DECISION_AXIS_CONSUMING
≠ RECOMMENDATION_ACTIVATED
```

Before Admin Product Fact operation:

- exact Hosted migration version verified;
- RLS and direct browser denial verified;
- server-derived actor/capability verified;
- dry-run zero-write verified against Hosted schema;
- idempotency and stale-prestate negatives verified;
- audit writes verified without sensitive payload leakage;
- rollback/disable runbook approved.

Before catalog adoption:

- explicit cohort and lineage contract;
- source/evidence/identity readiness;
- zero-write dry-run;
- separate confirm approval.

Before Recommendation activation:

- Decision Axis mapping version approved;
- shadow evidence and expected deltas reviewed;
- raw evidence/Admin data absent from runtime payload;
- separate activation approval.

---

## 27. Security / privacy

Reuse current Admin security architecture wherever semantics do not require a new rule.

Required controls:

```text
Admin authentication
capability authorization
server-derived reviewer actor
same-origin mutation
service-role-only semantic writes
RLS and browser direct-table denial
bounded request/body/file sizes
canonical payload/evidence digests
optimistic concurrency
stale source/evidence/Fact pre-state protection
actor-bound audit
safe error/log projection
secret/token/cookie sanitization
```

Reviewer identity is Admin-only operational data. It must not enter Product Fact current projections, Decision Axes, recommendation payloads or public explainability output.

Raw source body storage is disabled by default. If an immutable snapshot becomes necessary, it requires a separate retention/access/legal design and a content-addressed reference; it does not belong in audit logs or runtime Fact projections.

External sources may change or disappear. Preserve:

```text
source identity
accessed_at
content/metadata digest
scope/market binding
availability/verification events
EvidenceRecord created under that source version
```

A later source mismatch triggers re-review rather than silently mutating old evidence.

---

## 28. Open decisions

These are Production-schema decisions that should be explicitly approved before migration implementation.

### OD-1. Product Fact subject/formulation physical model

Recommendation: introduce a separate versioned Product Fact subject model referencing `products.id`, with market/variant/formulation validity and lineage. Final choice between one subject table and separate variant/formulation tables remains open.

This is the highest-impact open decision because it determines Evidence/Facts FKs and uniqueness.

### OD-2. Current pointer representation

Recommendation: explicit `product_fact_current` pointer/projection table rather than an `is_current` flag on immutable Fact history. This makes rollback and uniqueness clearer. Final SQL form remains open.

### OD-3. Qualifier normalization threshold

Recommendation: identity-critical scope columns normalized; Registry-specific qualifiers JSONB. Define criteria for promoting a qualifier to normalized structure after usage data exists.

### OD-4. Source snapshot retention

Recommendation: safe reference + digest by default, no arbitrary raw body. Determine whether any source class needs immutable content snapshots and what legal/retention boundary applies.

### OD-5. DB Registry mirror depth

Recommendation: code/config remains authority; DB stores release/version/checksum and optionally immutable definition snapshots. Decide whether the first implementation needs full definition snapshots or version/checksum only.

None of these decisions authorizes migration implementation in this PR.

---

## 29. Explicit non-goals

This architecture does not:

- admit the four Phase 3B S1 vocabulary candidates;
- finalize Fact Registry vocabulary;
- finalize Product Fact physical table names;
- create a generic `intensity`/`strength` field;
- turn current catalog tags into Product Facts;
- infer Product Facts from normalized name/category;
- make `products.cleansing_profile` canonical;
- rewrite the frozen cleanser corpus;
- make PR #177 Product Fact authority;
- decide penalty magnitude or Recommendation policy;
- implement Decision Axes;
- activate Recommendation;
- define raw review prevalence without an analyzed denominator;
- store reviewer identity in recommendation-facing data.

---

## 30. Acceptance criteria

This architecture is ready for a migration-design review when all of the following hold:

1. Evidence Source and EvidenceRecord are separate.
2. EvidenceRecord semantic history is append-only.
3. Fused Facts are immutable versions with a separate current pointer/projection.
4. `fact_instance_id != proposition identity` is explicit and enforceable.
5. scope overlap is not JSON equality.
6. relationship-bound Facts can enforce subject/scope compatibility.
7. boolean/enum/number/number+unit/range+unit/entity identifier are typed and queryable.
8. cardinality-many does not permit same-proposition contradiction.
9. support/opposition lineage is explicit.
10. explicit negative cannot be created from absence/not-established evidence.
11. Fact semantic status is separate from Admin operational status.
12. Registry versions preserve historical interpretation.
13. deprecated/superseded definitions do not rewrite history.
14. formulation/market change can trigger re-review without forced identity merge.
15. current products fields remain compatibility data, not automatic authority.
16. frozen cleanser adoption requires explicit legacy-research lineage.
17. Decision Axis reads approved Product Fact projection only.
18. Recommendation reads Decision Axis output only.
19. Admin v1/v2 security, audit, idempotency, dry-run/confirm and stale protection are reused conceptually.
20. Product Fact semantics are not forced into the cleanser scalar review row model.
21. rollback after semantic data exists preserves history and restores current pointers rather than deleting evidence.
22. migration/Hosted/Admin/catalog/Recommendation activation remain separate gates.

### Direct answers to the required questions

| Question | Decision |
| --- | --- |
| Q1 Can `product_metadata_field_reviews` be generalized to Product Facts? | No, not as canonical semantic persistence. |
| Q2 Should it remain scalar legacy compatibility? | Yes. Reuse operational infrastructure around it, not its row semantics. |
| Q3 EvidenceRecord append-only? | Yes; corrections create superseding/invalidation records/events. |
| Q4 Separate source and EvidenceRecord? | Yes. Source provenance is reusable across multiple proposition-targeted records. |
| Q5 Fused Fact persistence form? | Immutable versioned Fact instances + explicit current pointer/projection. |
| Q6 Proposition identity? | Deterministic Registry-governed canonical identity + stored proposition key/digest, separate from Fact UUID. |
| Q7 Scope storage? | Hybrid: normalized identity-critical scope columns + constrained canonical qualifier JSONB. |
| Q8 Typed Fact value? | Sum-type/discriminator with typed boolean/enum/number/unit/range/entity fields and CHECKs; not one generic JSON string. |
| Q9 Cardinality-many? | Multiple independent proposition rows according to Registry identity; contradictions on same proposition still fail closed. |
| Q10 Evidence lineage? | Explicit supporting/opposing link rows. |
| Q11 Explicit negative vs not established? | `supported(false)` + explicit-negative evidence vs null `reviewed_not_established`. |
| Q12 identity/source blocked? | Admin/research operational blockage, not Fact semantic status. |
| Q13 Registry version change? | Existing instances retain original version; new release can create new review/current versions. |
| Q14 Deprecated/superseded definition? | Stop new canonical use after effective cutoff; preserve historical instances and lineage. |
| Q15 Formulation/market change re-review? | Re-review when subject scope/version changes, source digest/version changes, or evidence no longer binds to current subject scope. |
| Q16 `products` relation? | Catalog parent only; Product Facts attach to versioned semantic subjects referencing `products.id`. |
| Q17 legacy cleanser corpus lineage? | Explicit reviewed-legacy-research adoption with corpus digest, proposition mapping, Admin adopter and pre-state binding. |
| Q18 Decision Axis interface? | Versioned approved-current Product Fact projection; no raw Evidence/Admin tables. |

### Q8 typed value candidate

A future SQL implementation may use a value discriminator plus nullable typed fields such as:

```text
value_type
value_boolean
value_enum
value_number
value_unit
value_range_min
value_range_max
value_entity_identifier
```

with CHECK constraints ensuring exactly the representation allowed by the Registry definition is populated. `subject_ref` remains a relationship field, not a stringified value blob.

This is a candidate physical representation, not final DDL.

---

## 31. Recommended implementation phases

### Phase PF-1 — Schema Contract Freeze

Finalize only:

- subject/formulation model;
- source/evidence model;
- proposition key algorithm;
- typed value representation;
- immutable Fact + current pointer model;
- Registry DB-binding depth;
- RLS/privilege model;
- migration/rollback test matrix.

Output: migration-ready design contract, still no Hosted operation.

### Phase PF-2 — Migration implementation + local static verification

Create additive migration SQL and focused verifier only after PF-1 approval.

### Phase PF-3 — Local clean replay + upgrade + rollback

Prove current-main schema upgrade, deterministic Registry binding, RLS, idempotency and rollback on isolated local Supabase.

### Phase PF-4 — Product Fact Admin contract

Implement Product Fact-specific dry-run/confirm and review/adjudication operations using the reused Admin security primitives. No catalog adoption yet.

### Phase PF-5 — Frozen Phase 3B persistence replay

Replay the 12-product frozen pilot into the new local persistence and require semantic equivalence to the frozen mapping/gap result, including `S2=0` and `forced_mapping_count=0` preservation.

### Phase PF-6 — Legacy adoption design/implementation

Only after native Product Fact persistence is stable, design and implement explicit frozen-cleanser/cross-category adoption paths. Keep scalar Admin-v2 compatibility separate.

### Phase PF-7 — Decision Axis consumer

Add a versioned mapper reading the approved Product Fact projection.

### Phase PF-8 — Recommendation shadow

Compare existing recommendation behavior with Decision Axis-backed shadow behavior. No activation.

### Phase PF-9 — Recommendation activation review

Separate policy decision after evidence, calibration, operational rollback and consumer safety are reviewed.

---

## Final design verdict

The Product Fact architecture should **reuse Admin operational guarantees without inheriting Admin v2's scalar semantic shape**.

The key separation is:

```text
Existing Admin v1/v2
→ authentication / capability / audit / idempotency / dry-run / confirm / stale protection / RLS / atomicity

New Product Fact persistence
→ subject/formulation identity / sources / EvidenceRecords / proposition identity / typed sparse Facts / fusion history / current projection
```

This preserves the architecture that survived the real-evidence pilot:

```text
Evidence
→ Fact
→ Decision Axis
→ Recommendation
```

without turning it back into either a closed `products` column schema or an ungoverned JSON tag store.
