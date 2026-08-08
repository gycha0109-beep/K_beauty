# Product Fact Subject / Formulation / Scope Contract v1

Status: **PF-1 architecture contract freeze — migration-ready semantics, no migration, no runtime activation**

Authority baseline:

```text
repository: gycha0109-beep/K_beauty
main: 097c1b5338293da00479ade05afc36776c530a36
upstream architecture: docs/architecture/product-fact-storage-admin-review-v1.md
Phase 3A Registry: product-fact-registry-cross-category-v1
Phase 3B pilot: cross-category-real-evidence-pilot-v1
```

This document freezes the Product Fact subject, formulation, variant, market/scope, validity, source-binding, and proposition-identity contract required before Product Fact migration SQL may be implemented.

The upstream architecture remains authoritative for the broader persistence/Admin design. This document resolves its highest-impact open decision, `OD-1 Product Fact subject/formulation physical model`, and makes the subject/scope portion migration-ready.

---

## 1. Status / Authority

PF-1 is architecture-only.

Authorized status when this contract is approved:

```text
PRODUCT_FACT_SUBJECT_FORMULATION_SCOPE_CONTRACT_FROZEN
PRODUCT_FACT_IDENTITY_LINEAGE_CONTRACT_FROZEN
PRODUCT_FACT_SCOPE_COMPATIBILITY_CONTRACT_FROZEN
```

This document does not authorize:

```text
PRODUCT_FACT_SCHEMA_FINAL
PRODUCT_FACT_SCHEMA_IMPLEMENTED
PRODUCT_FACT_MODEL_PRODUCTION_READY
PRODUCT_SCHEMA_MIGRATED
HOSTED_PRODUCT_FACT_SCHEMA_ACTIVE
ADMIN_PRODUCT_FACT_OPERATIONAL
CATALOG_ADOPTION_READY
CATALOG_ADOPTED
DECISION_AXIS_PRODUCTION_READY
RECOMMENDATION_ACTIVATED
```

Current upstream main has no GitHub Actions exact-SHA post-merge run for `097c1b53...`; Vercel success is not treated as GitHub Actions exact-SHA CI evidence. PF-1 must not retroactively close that debt.

PR #167 and PR #177 remain separate Draft / Open / Unmerged lineages and are not modified, rebased, readied, or merged by PF-1.

---

## 2. Scope / Non-goals

In scope:

- `products.id` → Product Fact semantic subject contract;
- physical subject entity model;
- semantic variant boundary;
- size / volume / refill / set / bundle treatment;
- formulation generation and reformulation lineage;
- commercial rename / packaging renewal / true formulation change distinction;
- market / region / locale classification;
- subject validity interval;
- subject scope vs Fact / Evidence / Source scope;
- source-to-subject binding states;
- identity resolution states and `identity_blocked`;
- EvidenceRecord and Fact FK semantics;
- Phase 3A proposition identity integration;
- relationship-bound Fact compatibility;
- re-review / invalidation triggers;
- canonicalization and uniqueness intent;
- Phase 3B mandatory acceptance cases;
- migration-facing pseudo-schema contract.

Out of scope:

- SQL / migration files;
- Hosted / Production DB writes;
- RPC / PostgreSQL function implementation;
- RLS implementation;
- Admin route or UI implementation;
- Product Fact runtime;
- catalog adoption;
- Decision Axis implementation;
- Recommendation changes or activation;
- Registry vocabulary expansion;
- final index syntax or UUID generator choice.

---

## 3. Current identity audit

### 3.1 Current `products` boundary

The current catalog is a commercial/recommendation anchor, not a formulation authority.

The inspected Admin product foundation contract contains at least:

```text
products.id
products.name
products.brand
products.category
products.product_form
products.normalized_name
products.normalized_brand
recommendation metadata / price / links / timestamps
```

The Admin foundation contract uses:

```text
UNIQUE (normalized_brand, normalized_name)
```

for catalog-level duplicate handling.

Current recommendation runtime explicitly projects products at the **product-line level, not SKU / set / refill splits**.

The current runtime also contains `market_signals`, but that object is recommendation metadata, not canonical Product Fact market identity or proposition scope.

The current Product Fact architecture and the inspected Admin/runtime contracts do not expose a canonical `products`-level formulation identity, variant identity, market-version identity, or validity lineage. PF-1 therefore does not reinterpret any legacy commercial field as such authority.

If unrelated legacy columns such as size or unit-price fields exist elsewhere in the migration history, they remain commercial metadata under this contract. Their presence does not make them Product Fact subject identity.

### 3.2 Current catalog normalization intentionally loses semantic detail

Current promotion identity normalization:

- lowercases and normalizes whitespace/punctuation;
- strips product volumes such as `ml`, `g`, `oz`, `sheet`, `pack`;
- strips option tokens including:
  - `refill`
  - `limited`
  - `special`
  - `set`
  - `gift`
  - `option`
  - `bundle`
  - `edition`
  - `renewal`
  - `1+1`
  - `리필`
  - `한정`
  - `기획`
  - `옵션`.

This is appropriate for catalog candidate dedupe. It is explicitly unsafe as Product Fact subject identity because it can erase the exact distinctions needed for provenance, formulation lineage, and exact-source matching.

### 3.3 Current runtime normalization also derives non-authoritative values

Current recommendation adaptation can default or derive values such as:

```text
skin_types -> combination
concerns -> dehydration
texture -> watery
finish -> natural
irritation_risk -> medium
sensitivity_safe -> boolean coercion
moisturizer category -> inferred from name / texture
```

These values are runtime compatibility outputs, not Product Fact identity or evidence.

### 3.4 Phase 3A semantic constraints that PF-1 must preserve

The frozen Registry/Core defines:

```text
scope fields:
market
region
locale
variant
formulation_version
valid_from
valid_to
```

and scope relations:

```text
equivalent
narrower
broader
disjoint
overlapping
```

The Registry also defines proposition identity per Fact through:

```text
include_fact_key
include_subject_ref
include_value_identity
scope_dimensions
qualifier_dimensions
```

Relationship-bound Facts such as:

```text
contains_active
→ active_concentration
```

require subject and scope compatibility.

Phase 3A already establishes that:

```text
fact_instance_id
!= semantic proposition identity
```

and that raw JSON inequality is not proposition independence.

### 3.5 Phase 3B constraints that PF-1 must preserve

The real-product pilot resulted in:

```text
products = 12
identity = 11 resolved / 1 ambiguous
sources = 15
evidence_records = 29
fused_facts = 23
S1 = 4
S2 = 0
S3 = 4
forced_mapping_count = 0
```

The S3 cases prove that catalog identity, source authority, exact presentation, and formulation lineage must remain separable.

---

## 4. Problem statement

The migration must be able to answer:

> Which exact semantic product state does this Evidence or Fact describe, under which scope, and during which validity period?

A safe subject contract must simultaneously allow:

```text
same formula + different size
→ same subject when compatibility is established

same formula + different locale page
→ same subject

same commercial name + different formulation
→ different subject

same commercial name + market-specific formula
→ different subject

same formula + different market regulatory claim
→ same subject, different proposition scope

ambiguous renewal
→ no forced mapping

historical reformulation
→ old Evidence/Facts preserved
```

A catalog dedupe key cannot satisfy these requirements.

---

## 5. Terminology

### Catalog product

A `products.id` row used for commerce, display, recommendation inventory, links, price, and existing metadata.

### Product Fact Subject

One immutable semantic product-state identity under a catalog product. A subject is the FK boundary for Product Fact Evidence and Facts after identity resolution.

A subject represents:

```text
catalog product anchor
+ semantic variant discriminator, when required
+ one formulation generation
```

A subject does **not** represent a package size, locale page, retailer listing, bundle wrapper, or marketing rename unless that distinction is proven to alter semantic Product Fact truth.

### Formulation generation

One formulation state in a product lineage. A true reformulation creates a new subject.

### Semantic variant

A reviewed product distinction that can cause Product Fact truth to differ independently of a sibling presentation. A token in a commercial name is not automatically a semantic variant.

### Commercial presentation

A sellable or display presentation such as size, pack count, gift set, refill pouch, limited package, localized page, or retailer SKU that does not by itself establish a different semantic product state.

### Subject scope

The applicability envelope of the subject identity and its known lineage.

### Proposition scope

The Registry-governed market/region/locale/time applicability of an individual Fact proposition within the subject.

### Source scope

What the source itself actually covers.

### Evidence scope

The bounded scope an EvidenceRecord can support after source-to-subject binding.

---

## 6. Catalog anchor boundary

### `products.id`

`products.id` is frozen as:

```text
catalog/commercial anchor
```

It is used to:

- connect Product Fact subjects to the existing catalog;
- locate the product in current Admin/catalog workflows;
- preserve existing commercial identity and recommendation inventory.

It is explicitly **not**:

```text
formulation identity
market-version authority
semantic variant authority
Evidence proposition identity
Fact proposition identity
source identity
validity authority
```

Two different Product Fact subjects may reference one `products.id`.

A Product Fact subject must never be derived solely from:

```text
normalized_brand + normalized_name
```

---

## 7. Frozen physical subject model

### D1 — FROZEN DECISION

PF-1 selects:

```text
products
  1
  |
  +----< product_fact_subjects
             |
             +----< product_evidence_source_subject_bindings
             |
             +----< product_evidence_records
             |
             +----< product_fact_instances
```

Variant and formulation are **not split into separate first-class tables in v1**.

The single `product_fact_subjects` entity is the semantic product-state / formulation-lineage node.

Rationale:

1. Phase 3A relationships need one clear subject FK.
2. Phase 3B found identity/version ambiguity but no structural need for independently queryable variant and formulation entities.
3. Size/refill/package are often presentation-only and should not multiply entity layers.
4. A single versioned subject makes Evidence and Fact FKs unambiguous.
5. True reformulation still produces immutable history through a new subject row.
6. Market-specific claims remain Fact scope rather than forcing market rows into formulation entities.
7. Future categories can add semantic variant keys without another table hierarchy.

### Candidate entity: `product_fact_subjects`

Migration-facing semantic fields:

```text
subject_id
product_id
subject_semantic_key

variant_key

formulation_revision_key
formulation_label

identity_status
identity_resolution_version

current_state

market_applicability
region_applicability

valid_from
valid_to

predecessor_subject_id
supersession_kind

created_at
```

The exact SQL data types and names are PF-2 decisions. The semantics are frozen here.

#### Required fields

```text
subject_id
product_id
subject_semantic_key
formulation_revision_key
identity_status
identity_resolution_version
current_state
created_at
```

#### Nullable fields

```text
variant_key
formulation_label
market_applicability
region_applicability
valid_from
valid_to
predecessor_subject_id
supersession_kind
```

`null` never means “use latest”, “same as catalog”, or “current”.

---

## 8. Subject stable identity

### D2 — FROZEN DECISION

`subject_id` is an opaque immutable storage/FK identifier allocated once.

A deterministic `subject_semantic_key` is computed from the canonical subject identity tuple:

```text
subject-identity-serializer-version
product_id
variant_key | null
formulation_revision_key
```

Market, region, locale, size, packaging, source URL, commercial name, and validity dates are **not** serialized into the base subject semantic key.

Why:

- market-specific regulatory Facts must not split an otherwise identical formulation;
- locale must not split formulations;
- size must not split formulations by default;
- validity dates may be unknown or corrected without redefining what formulation generation the subject is;
- source URLs and names are mutable provenance/display data.

### `formulation_revision_key`

`formulation_revision_key` is an immutable, reviewed semantic discriminator for one formulation generation.

Rules:

- it is never generated by stripping or normalizing product display text;
- tokens such as `EX`, `2.0`, `renewal`, or `new` are candidate identity evidence only;
- a source-defined version token may be adopted only after identity review confirms it denotes the formulation/semantic generation;
- if no reliable commercial version token exists, the resolver allocates an opaque stable revision key;
- once a subject has canonical Evidence or Fact lineage, changing the revision key in place is forbidden.

### Creation rule

Create a subject when:

1. a catalog product anchor exists;
2. a semantic variant/formulation state can be represented without knowingly merging incompatible states;
3. the identity state is explicitly recorded.

A provisional row may exist with `identity_status = ambiguous | unresolved`, but it cannot receive authoritative current Product Facts.

### Immutability rule

The following are immutable after canonical Evidence or Fact attachment:

```text
subject_id
product_id
subject_semantic_key
variant_key
formulation_revision_key
```

### Correction rule

Non-semantic corrections such as display aliases or notes do not create a new subject.

A correction that changes semantic identity creates a new subject and a correction/supersession lineage. Historical Evidence/Facts remain on the old subject.

### Supersession rule

True reformulation or semantic identity correction never overwrites historical subject identity.

---

## 9. Variant contract

### D4 — FROZEN DECISION

A commercial token becomes a semantic `variant_key` only when reviewed evidence establishes that the distinction can change Product Fact truth independently of another presentation.

### Same subject

Normally same subject:

- localized name;
- retailer-specific title;
- ordinary package size;
- multipack count;
- gift packaging;
- campaign/limited artwork;
- packaging-only renewal;
- refill presentation with proven identical semantic product state;
- commercial rename with no semantic change.

### Separate subject

A separate subject is required when the reviewed distinction changes or can independently determine:

- formulation/composition;
- governed physical product format;
- governed usage mode;
- active identity/concentration;
- protection system;
- a Product Fact-bearing semantic state.

### Ambiguous variant

If a token such as:

```text
EX
2.0
NEW
Renewal
UVLock
```

is identity-relevant but its semantic meaning is not resolved:

```text
variant/formulation binding = ambiguous
authoritative fusion = blocked
```

The token must not be stripped and then silently merged.

---

## 10. Size / volume contract

### D5 — FROZEN DECISION

Default invariant:

```text
different size
!= automatically different Product Fact subject
```

### Size is not subject identity when

- the only difference is quantity/volume/count;
- formula equivalence is established;
- physical/usage Facts relevant to the Registry do not change.

### Size is exact-source metadata when

A source identifies:

```text
150 mL
250 mL
350 mL
80 pads
refill 100 mL
```

That presentation must be retained in source/binding metadata even if it does not enter subject identity.

### Size requires a separate subject when

Reviewed evidence establishes that the size presentation is coupled to a semantic difference, for example:

- different formulation;
- distinct active concentration/composition;
- different governed physical format;
- different use instructions caused by the presentation;
- a size-specific variant that cannot share Product Fact truth safely.

In that case, the difference is represented through a new semantic variant/formulation subject. Size itself is not globally hard-coded as an identity dimension.

### Cross-size evidence rule

For exact 350mL subject/presentation and 250mL source:

```text
same-formulation evidence absent
→ do not promote 250mL source to authoritative 350mL Evidence
```

The source may remain product-family context, but authoritative EvidenceRecord creation for the 350mL subject requires either:

1. exact-subject presentation match; or
2. reviewed evidence that the two presentations are semantically equivalent.

This is the ANUA 350mL acceptance rule.

---

## 11. Formulation contract

### D3 — FROZEN DECISION

A formulation generation is represented by one immutable Product Fact Subject node.

A mutable `products.formulation_version` authority is not introduced.

A display `formulation_label` may be stored for Admin/source interpretation, but the stable identity is the subject + immutable `formulation_revision_key`.

### Same formulation criteria

A presentation may remain on the same subject when reviewed evidence supports continuity and no contradictory semantic evidence exists.

Examples of acceptable continuity evidence:

- manufacturer explicitly identifies sizes/presentations as the same formula;
- exact cross-reference between old/new packaging with unchanged formulation;
- authoritative composition/version evidence establishes equivalence.

Absence of a change notice is not proof of sameness.

### New formulation criteria

Create a new subject when:

- an authoritative source states reformulation;
- reviewed composition evidence establishes a material formulation difference;
- market-specific formula evidence establishes a distinct formulation state;
- an identity review proves a successor formulation despite the same commercial name.

### Unknown / ambiguous formulation

If old and new formula continuity cannot be established:

```text
do not force same subject
do not assume latest = catalog formulation
do not bind ambiguous Evidence to current Facts
```

---

## 12. Renewal / rename contract

Three events are distinct.

### Commercial rename

```text
name changes
semantic product state unchanged
→ same subject
```

The new name is alias/source metadata.

### Packaging-only renewal

```text
container / artwork / pack count changes
semantic product state unchanged
→ same subject
```

A new source binding may be reviewed, but historical Product Facts do not need a new formulation lineage.

### True formulation change

```text
semantic formulation changes
→ new subject
→ predecessor/supersession lineage
→ old Evidence/Facts remain historical
```

### Ambiguous renewal

```text
renewed/new/EX/2.0 string
+ no sufficient continuity/change evidence
→ identity/formulation ambiguous
→ forced same-subject mapping forbidden
```

String normalization alone never decides the result.

---

## 13. Market / region / locale contract

### D6 — FROZEN DECISION

The dimensions have different roles.

### Market

Definition:

```text
commercial/regulatory market in which a proposition or source applies
```

Primary role:

```text
Fact proposition scope
Evidence/source scope
```

Market is **not automatically formulation identity**.

If the same formulation has different market regulatory claims:

```text
same subject
+ market-scoped Facts
```

If a market has a proven different formula:

```text
different formulation subject
+ market-bounded source/fact scope
```

The reason for the subject split is the proven semantic formulation difference, not the mere existence of two market codes.

### Region

Definition:

```text
geographic narrowing below or alongside market where applicability requires it
```

Primary role:

```text
Fact/Evidence scope narrowing
```

Region does not split formulation by itself.

### Locale / language

Definition:

```text
language/rendering/source presentation, e.g. ko-KR, en-US
```

Primary role:

```text
source metadata
Fact proposition scope only when the proposition itself is locale-bound
```

Locale never creates a new formulation subject by itself.

A translated/localized page with the same product/formulation is the same subject.

### Subject applicability

`market_applicability` / `region_applicability` are subject-level safety metadata used to prevent a known market-specific formulation from being selected outside its reviewed applicability.

They do not replace proposition scope and are not part of the base subject semantic key.

Unknown applicability must not be serialized as global applicability.

---

## 14. Validity contract

### D7 — FROZEN DECISION

Validity uses half-open intervals:

```text
[valid_from, valid_to)
```

Meaning:

- `valid_from` is inclusive;
- `valid_to` is exclusive.

Date granularity is authoritative only when the source/review supports that exact date.

### Unknown start

```text
valid_from = null
```

means:

```text
authoritative start date unknown
```

It does not mean the formulation has existed forever.

### Open-ended / unknown end

```text
valid_to = null
```

means:

```text
no authoritative end date is known
```

It may be current, but `valid_to = null` alone is **not proof of currentness**.

Currentness is represented separately by `current_state`.

### Exact change date unknown

Do not invent a timestamp or date.

A lineage may be known while both the predecessor end and successor start date remain null.

Temporal comparison with an unknown bound is conservative: unless another dimension proves disjointness, the scopes are treated as potentially overlapping.

### Estimated dates

Estimated or inferred dates may be retained in source/review notes or bounded evidence metadata, but must not be written into authoritative `valid_from` / `valid_to`.

---

## 15. Lineage / supersession contract

### D8 — FROZEN DECISION

Use one directed edge on the new subject:

```text
predecessor_subject_id
supersession_kind
```

`successor` is obtained by reverse lookup. No duplicated successor pointer is required.

Allowed semantic meanings include:

```text
reformulation
identity_correction
semantic_variant_split
```

Final DB enum syntax is PF-2 work, but these meanings are frozen.

### Invariants

- no lineage cycles;
- predecessor and successor cannot be the same subject;
- a true reformulation does not rewrite the predecessor;
- historical Evidence/Facts remain attached to historical subjects;
- one subject cannot silently represent two incompatible formulation histories;
- ambiguous lineage remains unresolved rather than guessed;
- one predecessor may have multiple successors only when a reviewed split is real and their applicability does not create an unreviewed current collision.

### Proven reformulation

When dates are known:

```text
old subject.valid_to = change boundary
new subject.valid_from = same boundary
```

Under half-open semantics, the intervals do not overlap at the boundary.

When the exact boundary is unknown, lineage is retained and authoritative dates remain null.

---

## 16. Subject scope

Subject scope answers:

> Which semantic product state is this?

It includes:

- catalog anchor;
- semantic variant;
- formulation generation;
- reviewed market/region applicability;
- validity window.

It does not include locale as identity.

Fact proposition scope answers:

> Where and when does this proposition hold within that semantic product state?

Source scope answers:

> What did the source actually cover?

Evidence scope answers:

> What proposition scope may safely be supported after binding this source to the subject?

The scopes are related but not interchangeable.

---

## 17. Scope compatibility

### D6 / D7 scope invariant

```text
Fact proposition scope
must be compatible with
subject scope
```

and:

```text
Evidence scope
must not be widened beyond
verified Source scope
```

### Relation policy

| Relation | Subject ↔ Fact | Source/Evidence ↔ Fact | Admissibility |
| --- | --- | --- | --- |
| `equivalent` | allowed | allowed | canonical |
| `narrower` | allowed | allowed | canonical; narrower claim stays narrow |
| `broader` | Fact broader than subject is forbidden | Evidence broader than target is context-only unless a separate reviewed narrowing is created | fail closed |
| `overlapping` | not enough for canonical Fact promotion | context/review only | review required |
| `disjoint` | forbidden | forbidden | hard block |

The direction matters.

A narrower Fact inside a broader subject is allowed.

A Fact broader than the verified subject/source scope is forbidden.

### Unknown dimension

Unknown is not a wildcard.

Missing market/region/validity cannot be used to widen a proposition.

For comparison, unknown bounds are conservatively treated as potentially overlapping until resolved.

---

## 18. Source-to-subject binding

A Source does not state Product Fact truth merely because it is official or exact-name matched.

PF-1 introduces a required source/subject binding relation before canonical Evidence creation.

Candidate relation:

```text
product_evidence_source_subject_bindings
```

Minimum semantics:

```text
binding_id
source_id
product_id
subject_id | null
binding_state
scope_relation
presentation_metadata
identity_resolution_version
reviewed_at
```

### D9 — FROZEN binding states

```text
exact_subject_match
equivalent_presentation_match
product_family_only
variant_ambiguous
formulation_ambiguous
identity_unresolved
disjoint_subject
```

#### `exact_subject_match`

Source exactly identifies the semantic subject or its reviewed exact formulation/variant.

#### `equivalent_presentation_match`

Source presentation differs by size/refill/package/locale, but reviewed evidence establishes semantic equivalence to the subject.

#### `product_family_only`

Brand/product family is recognizable but exact semantic variant/formulation is not established.

#### `variant_ambiguous`

Variant mapping is not resolved.

#### `formulation_ambiguous`

Formulation generation mapping is not resolved.

#### `identity_unresolved`

The source cannot be safely mapped to a Product Fact subject.

#### `disjoint_subject`

The source is known to describe a different semantic subject.

### Binding vs source authority

Binding identity and evidence authority are independent.

For example:

```text
exact retailer 150mL identity
→ exact_subject_match for identity
→ still may be insufficient authority for a physical/efficacy Fact
```

---

## 19. EvidenceRecord binding

Canonical Product Fact `EvidenceRecord` is proposition-targeted.

### Creation gate

A canonical EvidenceRecord with `subject_id` may be created only when:

```text
binding_state in (
  exact_subject_match,
  equivalent_presentation_match
)
AND subject.identity_status = resolved
AND evidence scope is equivalent or narrower
AND Registry evidence class permits the proposition
```

If binding is unresolved/ambiguous:

```text
Source + binding review context are preserved
canonical EvidenceRecord is not fabricated
```

This preserves evidence material without arbitrary subject binding.

### Authoritative fusion gate

EvidenceRecord existence does not automatically authorize fusion.

Authoritative fusion additionally requires:

- evidence class permitted by Registry;
- evidence authority sufficient for the proposition;
- proposition target valid;
- scope compatible;
- source binding not downgraded;
- relationship subject compatible where required;
- no unresolved same-proposition conflict.

### Context-only cases

`product_family_only`, `broader`, or `overlapping` material may remain research/review context but cannot support a current Fact until explicitly resolved.

---

## 20. Fact binding

Every canonical `product_fact_instance` must reference exactly one resolved Product Fact Subject.

Frozen FK semantics:

```text
product_fact_instances.subject_id
→ product_fact_subjects.subject_id
```

A Fact is never directly keyed only by `products.id`.

Historical Facts remain on historical subjects after reformulation.

A new formulation never rewrites an old Fact instance.

---

## 21. Proposition identity integration

### D10 — FROZEN DECISION

`subject_id` is a mandatory Product Fact proposition identity input in persistence.

The persisted proposition key is computed using a versioned canonical serializer over:

```text
proposition-identity-serializer-version
subject_id
fact_key
relationship subject identity, when Registry requires subject_ref
value identity, when Registry requires it
canonical proposition scope dimensions
canonical qualifier identity dimensions
```

### `subject_id` inclusion

Answer:

```text
YES
```

Every persisted Product Fact proposition is subject-bound.

### Duplicating formulation/variant in proposition identity

For native canonical Product Facts:

```text
subject-owned variant/formulation identity
→ represented by subject_id
→ not redundantly serialized again as independent proposition identity
```

The frozen Registry may still list `variant` and `formulation_version` among allowed scope dimensions. Under native PF persistence, a proposition cannot silently specify a contradictory variant/formulation relative to its subject.

Legacy/import evidence carrying those scope fields must resolve them into the canonical subject before current Fact promotion.

### Market / region / locale in proposition identity

These remain scope inputs when the Registry definition includes them and the proposition is scoped.

This allows:

```text
same formulation subject
+ KR regulatory claim
+ US regulatory claim
→ separate propositions without separate formulation subjects
```

### Subject scope vs proposition scope

```text
subject identity
= which semantic product state

proposition scope
= where/when one Fact holds within that state
```

They are not duplicates.

### Formulation supersession

After a true reformulation:

```text
new subject_id
+ same fact_key
+ same value
→ new proposition
```

Historical collision is prevented because `subject_id` differs.

### Registry version / serializer version

`registry_version` is stored on Evidence/Facts for historical interpretation.

The proposition key is domain-separated by the **identity serializer version**, not blindly by every Registry release.

If a Registry release changes non-identity semantics only, the same semantic proposition may retain its key.

If proposition identity rules change:

```text
serializer/identity rule version must change
→ affected propositions require re-review/re-key
```

### Raw JSON equality

Forbidden.

Canonical structured serialization is required before hashing.

---

## 22. Relationship Fact compatibility

Phase 3A relationship semantics remain.

Example:

```text
contains_active
→ active_concentration
```

### Physical relationship references

For a relationship-bound child Fact, persist both concepts:

```text
parent proposition semantic reference
parent Fact instance lineage reference used by this child version
```

The semantic proposition identity uses the parent **proposition identity**, not a mutable child-visible `fact_instance_id` alone.

This prevents a parent Fact re-review/version from silently creating a different child proposition identity.

### Invariants

```text
child.subject_id = parent.subject_id
```

and child scope must be compatible with parent scope.

Allowed:

```text
parent broader
child narrower
```

Forbidden:

```text
different Product Fact subject
disjoint market
incompatible formulation
disjoint validity
```

Locale is not an inherited formulation identity dimension; it may narrow a claim when the Registry permits it.

### Reformulation safety

Old formulation:

```text
contains_active = niacinamide
```

New formulation:

```text
contains_active = retinal
```

The new subject ID makes it impossible for the old concentration relation to satisfy the new subject FK/relationship contract.

---

## 23. Identity resolution / blockers

### Subject identity states

```text
resolved
ambiguous
unresolved
```

#### resolved

Enough evidence exists to bind canonical Evidence/Facts to this subject.

#### ambiguous

Two or more plausible subject/formulation mappings remain.

#### unresolved

No safe subject identity can be established.

### `identity_blocked`

`identity_blocked` is not a semantic Fact status.

It is an operational outcome derived when an Evidence/Fusion/Promotion request cannot obtain a resolved subject or safe binding.

Rules:

```text
ambiguous identity
→ arbitrary subject binding forbidden

unresolved identity
→ arbitrary subject creation as “current” forbidden
```

Evidence material remains at Source/binding-review level until resolution.

---

## 24. Re-review / invalidation triggers

### D11 — FROZEN DECISION

Policy levels:

```text
NO_REVIEW
REVIEW_REQUIRED
HARD_INVALIDATE_CURRENT
```

`HARD_INVALIDATE_CURRENT` means affected current Product Fact consumption/promotion must stop until re-reviewed. Historical rows are retained.

| Change | Policy | Rule |
| --- | --- | --- |
| proven formulation change | `HARD_INVALIDATE_CURRENT` | new subject required; old subject becomes historical for current selection |
| semantic variant identity change | `HARD_INVALIDATE_CURRENT` | old binding/current projection cannot continue under changed identity |
| commercial rename only | `NO_REVIEW` | aliases/display metadata only |
| proven packaging-only renewal | `NO_REVIEW` for Fact truth | new source binding may still need identity verification |
| market applicability expanded/narrowed | `REVIEW_REQUIRED` | re-check scoped Facts; hard invalidate any Fact now outside scope |
| market applicability becomes disjoint | `HARD_INVALIDATE_CURRENT` | current proposition no longer applicable |
| locale page change only | `NO_REVIEW` normally | review only locale-scoped claims |
| source content digest change | `REVIEW_REQUIRED` | re-extract/review; old Evidence remains historical |
| changed source removes/contradicts sole authoritative support | `HARD_INVALIDATE_CURRENT` | cannot keep current support silently |
| source exact-product binding downgrade | `HARD_INVALIDATE_CURRENT` | affected Evidence can no longer support current Fact |
| Registry non-identity wording change | `REVIEW_REQUIRED` only if semantic interpretation changes | no automatic key change |
| Registry identity rule change | `HARD_INVALIDATE_CURRENT` | affected proposition keys require versioned re-key/review |
| subject semantic identity correction | `HARD_INVALIDATE_CURRENT` | new corrected subject; old current consumption stops |
| validity interval refined but remains compatible | `REVIEW_REQUIRED` | re-check overlap/currentness |
| validity update excludes current proposition | `HARD_INVALIDATE_CURRENT` | proposition is out of valid subject window |
| size/pack metadata correction with proven same formula | `NO_REVIEW` | source/presentation metadata only |

---

## 25. Canonicalization

Catalog display normalization and Product Fact semantic canonicalization are separate contracts.

### Subject serializer

Frozen version name candidate:

```text
product-fact-subject-identity-v1
```

Rules:

- UTF-8;
- Unicode NFKC for reviewed text keys;
- trim and collapse internal whitespace where text is permitted;
- no display brand/product name in subject semantic key;
- UUIDs serialize in lowercase canonical form;
- `variant_key` uses a reviewed canonical key, not display name;
- `formulation_revision_key` is immutable and canonical;
- missing value serializes as typed `null`, never empty string, `"unknown"`, `*`, or latest;
- canonical object keys sorted;
- types preserved.

### Market code

- controlled uppercase canonical code;
- no free-text aliases;
- `GLOBAL` is an explicit code only where the source/review actually establishes global applicability;
- unknown is `null`, not `GLOBAL`.

### Region

- controlled canonical geographic key;
- no comma-separated free text;
- unknown is null.

### Locale

Canonical BCP-47 form, e.g.:

```text
ko-KR
en-US
```

Locale normalization must not alter subject identity.

### Date

Authoritative dates serialize:

```text
YYYY-MM-DD
```

No synthetic midnight timestamp.

### Qualifiers

Only Registry-declared qualifier identity dimensions are serialized.

- object keys sorted;
- scalar types preserved;
- arrays preserve order only when the Registry says order is semantic;
- set-like qualifier arrays require Registry-specific canonical sorting before serialization.

### Proposition serializer

Frozen version name candidate:

```text
product-fact-proposition-identity-v2
```

The version is explicit because persisted PF proposition identity adds canonical Product Fact `subject_id` to the frozen Phase 3A proposition rule.

Digest candidate:

```text
SHA-256(UTF-8 canonical serialization)
```

Exact SQL function implementation is PF-2 work.

---

## 26. Uniqueness model

PF-1 freezes distinct uniqueness concepts.

### Storage uniqueness

```text
subject_id
source_id
binding_id
evidence_id
fact_instance_id
```

are storage identities.

### Semantic subject uniqueness

`subject_semantic_key` identifies one semantic subject tuple.

Duplicate subject rows with the same semantic key are forbidden.

### Current formulation uniqueness

For a given catalog product + semantic variant + applicability cell, there may be at most one:

```text
identity_status = resolved
current_state = current
```

subject.

If the current formulation is ambiguous, the correct count is zero current resolved subjects, not two guesses.

Market-specific formulations may each be current only in disjoint reviewed applicability.

PF-2 must not rely on ordinary PostgreSQL nullable composite uniqueness to express this rule. It must use a null-safe canonical key, `NULLS NOT DISTINCT`, exclusion/partial constraints, or equivalent verified logic.

The exact SQL syntax remains open; the semantic uniqueness does not.

### Proposition uniqueness

Many immutable Fact instances may share one `proposition_key`.

There is at most one approved current pointer for one `proposition_key`.

### Source identity uniqueness

A source snapshot identity is distinct from proposition identity.

At minimum it binds:

```text
canonical source locator/reference
publisher/source identity
source kind
content/metadata digest or immutable snapshot identity
```

A changed source snapshot does not overwrite the Evidence lineage that referenced the older snapshot.

### Nullable scope semantics

`null` is a semantic unknown/not-specified state, not automatically equal to every concrete value.

PF-2 constraints must therefore implement the frozen comparison semantics explicitly rather than relying on PostgreSQL's default `NULL != NULL` uniqueness behavior.

---

## 27. Dimension classification matrix

| Dimension | Catalog identity | Subject identity | Fact scope | Source metadata | Semantic rule |
| --- | --- | --- | --- | --- | --- |
| `product_id` | primary catalog anchor | required parent FK | represented indirectly through `subject_id` | may be candidate match target | never formulation authority by itself |
| brand | display/dedupe input | no | no | yes | alias/name correction must not redefine subject |
| commercial name | display/dedupe input | no | no | yes | rename alone keeps subject |
| market | commerce availability may use it | not automatic; applicability safety metadata | **yes** when Registry proposition is market-scoped | **yes** | different claim != different formula; proven market formula difference => new subject |
| region | optional catalog metadata | not automatic; applicability safety metadata | **yes** as narrowing | **yes** | geographic narrowing, not formula split by itself |
| locale/language | display/localization | **no** | only when proposition is locale-bound | **yes** | locale page alone never creates subject |
| variant | catalog title/SKU may contain it | **yes only after semantic review** | must not contradict subject; legacy scope resolves into subject | **yes** | `EX/2.0/UVLock` retained, never auto-stripped into sameness |
| size/volume | commercial SKU/presentation | **no by default** | no generic PF scope dimension | **yes, exact match metadata** | separate subject only when size couples to semantic difference |
| refill | commercial presentation | no by default | no generic PF scope dimension | **yes** | same subject only after formula/presentation compatibility; otherwise ambiguous |
| set/bundle | commercial wrapper | component subject is separate | bundle-specific Fact only if Registry defines it | **yes** | never inherit component formulation Facts to bundle automatically |
| packaging revision | commercial/source presentation | no when packaging-only | possible Fact only if a governed physical property changes | **yes** | packaging-only renewal does not create formulation history |
| formulation version | catalog text may hint | **core subject generation** | subject-owned; legacy scope must resolve to subject | **yes** | true reformulation always new subject |
| renewal | commercial event/token | only after classified as semantic change | no by itself | **yes** | string `renewal` never equals reformulation |
| validity interval | not catalog dedupe identity | **subject applicability** | **yes** for proposition applicability | source publication/access dates remain separate | half-open interval; unknown never fabricated |

---

## 28. Phase 3B acceptance cases

### Case A — ILLIYOON 150mL

Facts:

```text
exact 150mL retailer identity exists
exact official primary physical source missing
```

PF-1 result:

1. `products.id` can anchor the catalog product.
2. 150mL is retained in presentation/source-binding metadata.
3. Exact retailer identity can establish `exact_subject_match` for identity purposes if variant/formulation continuity is otherwise resolved.
4. Retailer identity does not gain primary physical Fact authority merely because the exact size matches.
5. Physical/efficacy Facts remain source-blocked until admissible evidence exists.

Outcome:

```text
identity resolution
!= source authority
```

### Case B — Dr.G EX

Facts:

```text
exact EX identity/review exists
exact official EX page missing
```

PF-1 result:

1. `EX` is preserved during identity review.
2. It is not removed by catalog-style normalization.
3. Exact EX identity may create/resolve an EX semantic subject if review establishes that EX is the relevant product state.
4. Non-EX/older evidence is not silently bound to the EX subject.
5. Missing exact official EX physical source remains source-blocked.

Outcome:

```text
EX identity resolved
+ physical Fact authority shortage
```

### Case C — ANUA 350mL

Facts:

```text
exact 350mL identity exists
official 250mL renewed page exists
same-formulation proof absent
```

PF-1 result:

1. 350mL is exact presentation metadata, not automatically a new formulation.
2. The 250mL official page is not automatically `equivalent_presentation_match`.
3. Without same-formulation evidence, the binding remains `product_family_only` or `formulation_ambiguous`.
4. No authoritative 350mL physical/usage EvidenceRecord is created from the 250mL source.
5. If future evidence proves formula equivalence, both sizes may bind to the same subject without creating two formulation subjects.

Outcome:

```text
size does not force split
size does not authorize unproven merge
```

### Case D — NEEDLY Daily Toner Pad renewal

Facts:

```text
current official renewed 80-pad product
frozen catalog formulation/version lineage unclear
```

PF-1 result:

1. `renewed` is not normalized into automatic sameness.
2. A provisional subject/binding may be `ambiguous`.
3. Source material is preserved.
4. Canonical EvidenceRecord/Fused Fact current promotion is blocked until the frozen row and renewed formulation relationship is resolved.
5. If proven packaging-only, retain one subject.
6. If proven reformulation, create a new successor subject.
7. If still unresolved, keep zero forced mappings.

Outcome:

```text
forced same subject = forbidden
```

---

## 29. Synthetic edge cases

### Same formula / different size

```text
same subject
```

after compatibility evidence.

Size remains source presentation metadata.

### Same formula / different locale page

```text
same subject
```

Locale remains source metadata and, where necessary, Fact scope.

### Same name / different market formula

```text
separate formulation subjects
```

because the formulation differs. Market scope controls which subject/evidence is applicable.

### Same formulation / different market regulatory claim

```text
same subject
separate market-scoped propositions
```

### Packaging-only renewal

```text
same subject
new source/presentation binding
no new formulation Fact history
```

### Proven reformulation

```text
old subject -> historical
new subject -> current after review
new subject.predecessor = old subject
historical Evidence/Facts unchanged
```

### Bundle/set containing canonical product

The bundle wrapper does not become the component formulation subject.

Component Facts stay attached to component subjects.

A bundle-level Product Fact requires an explicit Registry concept and evidence for the bundle itself.

### Refill with identical formula

If same formulation is established:

```text
same subject
refill = presentation metadata
```

If compatibility is not established:

```text
formulation_ambiguous
no authoritative cross-binding
```

### Ambiguous old catalog row

```text
no forced mapping
no best-effort current subject
```

The catalog anchor may exist while the Product Fact subject remains ambiguous/unresolved.

---

## 30. Legacy / catalog compatibility

Current catalog identity rules remain valid for their bounded purpose:

```text
candidate matching
dedupe
promotion
recommendation product-line projection
```

They are not reused as Product Fact semantic identity.

In particular:

```text
normalized product name
!= subject identity

normalized brand + normalized name
!= formulation identity

current catalog metadata
!= Product Fact authority
```

PR #177 may later solve scalar cleanser catalog-adoption lineage. It does not become PF-1 subject authority and does not define Product Fact proposition identity.

Historical `product_metadata_field_reviews` remains a scalar compatibility layer.

---

## 31. Migration-facing contract

The PF-2 implementer must not need to redesign identity semantics.

### Entity A — `product_fact_subjects`

Primary identity:

```text
subject_id
```

Stable semantic key:

```text
subject_semantic_key
```

FK:

```text
product_id -> products.id
predecessor_subject_id -> product_fact_subjects.subject_id
```

Required semantics:

```text
variant_key
formulation_revision_key
identity_status
current_state
validity
lineage
identity_resolution_version
```

Mutation:

- semantic identity immutable after canonical lineage attachment;
- operational current/identity review state may change under audited workflow;
- semantic correction creates a new subject when identity changes.

### Entity B — source/subject binding

Candidate:

```text
product_evidence_source_subject_bindings
```

Required semantics:

```text
source_id
product_id
subject_id nullable only for unresolved binding states
binding_state
scope_relation
presentation metadata
identity resolution version
```

It is the gate between Source identity and proposition-targeted Evidence.

### EvidenceRecord FK

Canonical EvidenceRecord:

```text
source_id -> product_evidence_sources
binding_id -> source/subject binding
subject_id -> resolved product_fact_subjects
```

Only binding states authorized in section 18 may create canonical subject-targeted EvidenceRecords.

### Fact FK

Every Product Fact instance:

```text
subject_id -> resolved product_fact_subjects
```

Relationship-bound child Facts also carry a stable semantic parent proposition reference plus the exact parent Fact lineage reference used by that version.

### Scope fields

Fact/Evidence scope continues to use Registry-governed:

```text
market
region
locale
valid_from
valid_to
```

Variant/formulation legacy scope is resolved into subject identity before native current Fact promotion.

### Identity states

```text
resolved
ambiguous
unresolved
```

Operational blockage remains separate.

---

## 32. Security / audit implications

PF-1 adds no security implementation, but PF-2/PF-4 must preserve the upstream Admin guarantees.

Required semantic/security boundary:

- browser cannot directly write subject/Evidence/Fact semantic tables;
- Admin actor is server-derived;
- source binding and identity correction are audited;
- historical Evidence/Facts are append-only;
- current pointer changes are atomic with confirmation/audit;
- raw source bodies are not required by this model;
- reviewer identity is never part of proposition identity or Recommendation payload;
- stale source digest / subject pre-state fails closed;
- ambiguous identity cannot be bypassed by client-supplied subject ID.

---

## 33. Frozen decisions

### D1 — Subject physical entity model

**FROZEN**

One versioned `product_fact_subjects` entity under `products.id`. No separate v1 variant/formulation tables.

### D2 — Subject stable identity rule

**FROZEN**

Opaque immutable `subject_id` + deterministic canonical `subject_semantic_key`; catalog names/normalized names are excluded.

### D3 — Formulation version representation

**FROZEN**

One formulation generation = one subject node, distinguished by immutable reviewed `formulation_revision_key`. True reformulation creates a successor subject.

### D4 — Variant representation

**FROZEN**

`variant_key` exists only for reviewed semantic variants. Commercial tokens are evidence, not automatic identity.

### D5 — Size / volume treatment

**FROZEN**

Presentation/source metadata by default; subject split only after semantic difference is established. Cross-size authority requires equivalence evidence.

### D6 — Market / region / locale classification

**FROZEN**

Market/region are primarily proposition/evidence scope; locale is primarily source presentation and optional proposition scope. None automatically creates formulation identity.

### D7 — Validity interval semantics

**FROZEN**

Half-open `[valid_from, valid_to)`. Null means unknown/no authoritative boundary; no fake dates; currentness separate.

### D8 — Lineage / supersession

**FROZEN**

New subject points to predecessor with explicit supersession kind; no cycles; no historical overwrite.

### D9 — Source → Subject binding states

**FROZEN**

`exact_subject_match`, `equivalent_presentation_match`, `product_family_only`, `variant_ambiguous`, `formulation_ambiguous`, `identity_unresolved`, `disjoint_subject`.

### D10 — Proposition identity integration

**FROZEN**

`subject_id` is mandatory. Registry-configured fact/value/relationship/scope/qualifier identity is canonicalized by a versioned serializer. Subject-owned formulation identity is not redundantly duplicated.

### D11 — Re-review / invalidation triggers

**FROZEN**

Three policy levels: `NO_REVIEW`, `REVIEW_REQUIRED`, `HARD_INVALIDATE_CURRENT`, with the trigger matrix in section 24.

---

## 34. Remaining non-blocking open decisions

The following do not block PF-2 semantics:

- final SQL table/constraint/index names;
- UUID generator;
- exact migration timestamp/file name;
- whether semantic digests use generated columns or server-side verified writes;
- exact PostgreSQL syntax for null-safe/current-overlap uniqueness;
- exact source snapshot retention implementation;
- Admin UI presentation;
- final PostgreSQL function names;
- whether a DB Registry mirror stores full immutable definitions or release/version/checksum only, provided code/config remains semantic authority.

No FK, subject identity, formulation, scope, source-binding, or proposition-identity semantic decision remains open.

---

## 35. Acceptance criteria

PF-1 passes only if all are true:

- `products.id` is explicitly a catalog anchor, not formulation identity.
- one physical subject model is selected.
- semantic variant vs commercial presentation is explicit.
- size/volume semantics are explicit.
- formulation generation and true reformulation are explicit.
- rename / packaging renewal / reformulation are distinct.
- market / region / locale roles are distinct.
- validity null/open-ended semantics are explicit.
- lineage and historical preservation are explicit.
- source-to-subject binding is explicit.
- ambiguous identity cannot create arbitrary Evidence/Facts.
- EvidenceRecord and Fact FK gates are explicit.
- subject integration into proposition identity is explicit.
- subject-owned formulation identity is not redundantly serialized.
- equivalent/narrower/broader/overlapping/disjoint scope policy is explicit.
- relationship Fact subject/scope compatibility is explicit.
- re-review/invalidation triggers are explicit.
- ILLIYOON, Dr.G EX, ANUA 350mL, and NEEDLY renewal are representable without forced mapping.
- same-formula size/locale cases do not force subject proliferation.
- proven reformulation cannot overwrite history.
- no migration or runtime implementation is introduced by PF-1.

---

## 36. Explicit non-status

Even after PF-1 contract freeze:

```text
PRODUCT_FACT_REGISTRY_PRODUCTION_READY = NO CLAIM
PRODUCT_FACT_SCHEMA_FINAL = NO
PRODUCT_FACT_SCHEMA_IMPLEMENTED = NO
PRODUCT_FACT_MODEL_PRODUCTION_READY = NO
PRODUCT_SCHEMA_MIGRATED = NO
HOSTED_PRODUCT_FACT_SCHEMA_ACTIVE = NO
ADMIN_PRODUCT_FACT_OPERATIONAL = NO
CATALOG_ADOPTION_READY = NO
CATALOG_ADOPTED = NO
DECISION_AXIS_PRODUCTION_READY = NO
RECOMMENDATION_ACTIVATED = NO
```

---

## 37. Next implementation gate

PF-1 completion does not start migration implementation automatically.

Required sequence:

```text
PF-1 Draft PR
→ architecture integration review
→ approved merge
→ new main authority recorded
→ PF-2 migration implementation
```

The next single task after this Draft PR is:

```text
PF-1 integration review / merge closeout
```

not PF-2.
