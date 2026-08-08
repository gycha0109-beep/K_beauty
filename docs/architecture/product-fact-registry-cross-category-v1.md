# Product Fact Registry Cross-Category v1

Status: **offline executable architecture POC / semantic-finalized / no Production activation**

Baseline: `main@e371d5bc037fb80d1edd3876f0c7d1d94a2c1461`

Registry version: `product-fact-registry-cross-category-v1`

## 1. Purpose

Phase 3A tests whether Product Evidence architecture can extend beyond cleanser without either adding a `products` column for every product property or degrading into an arbitrary tag warehouse.

The semantic-finalization pass closes three contract gaps only:

1. storage `fact_instance_id` is separated from canonical semantic proposition identity;
2. scope overlap and relationship-bound scope compatibility are explicit;
3. evidence records are separated from fused Product Facts, including conflict and explicit-negative provenance.

This phase does **not** review new real-product claims, define a Production Product Fact schema, activate recommendation consumption, or finalize Decision Axes.

The boundary is:

```text
EvidenceRecord[]
→ governed proposition-level fusion
→ Fused Product Fact
→ future separately governed Decision Axis mapping
→ Recommendation policy
```

## 2. Non-goals

Phase 3A excludes:

- new official-site, Hwahae, Olive Young, review-scraping, or manual product research;
- Product Fact DB migrations or Hosted/Production writes;
- Admin runtime adoption;
- recommendation score, penalty, hero boost, or user-concern coefficients;
- Product Fact or Decision Axis runtime consumers;
- Phase 2 cleanser refactoring;
- modification or activation of PR #167 or PR #177.

Phase 3B is the separate real-evidence pilot.

## 3. Current catalog inventory is audit-only

Current catalog/runtime/fixture values are structural inventory, not proposition-level Product Fact authority.

```text
current catalog value
!= reviewed Product Fact authority
```

Reference inventory used for architecture stress testing:

| Domain | Reference count |
| --- | ---: |
| Sunscreen | 11 |
| Treatment | 18 |
| Moisturizer family | 61 |
| Toner / pad family | 48 |

The detailed audit remains in `current-catalog-inventory-audit-v1.json` and is intentionally not rewritten by this semantic-finalization pass.

## 4. Governed Fact Registry

Every admitted Fact definition is versioned and contains at least:

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

Unknown keys fail closed. Marketing phrases do not become keys merely because a source contains them.

Registry definitions do not contain recommendation `weight`, `score`, `penalty`, `hero_boost`, generic `intensity`, or generic `strength`.

## 5. Proposition identity

`fact_instance_id` is a storage/lineage identifier. It is **not** semantic proposition identity.

Canonical proposition identity is derived from each Fact definition's `proposition_identity_schema`.

The schema may include:

```text
fact_key
subject_ref
value identity when the value names the proposition
relevant scope dimensions
semantically required qualifier dimensions
```

The asserted value itself is excluded when it is an answer to the proposition rather than part of the proposition identity.

### 5.1 Active concentration

```text
fact_key = active_concentration
subject_ref = active-niacinamide-1
scope = market/formulation/etc. when present
```

`5%` and `10%` for the same active subject and overlapping effective scope are two incompatible answers to the **same** proposition, not two independent concentration Facts.

### 5.2 Contains-active

For `contains_active`, ingredient identity is itself part of proposition identity. Therefore niacinamide and retinal are independent propositions.

Evidence records use `proposition_value_identity` when value identity is needed to bind evidence to the correct semantic proposition without copying fused truth into the evidence layer.

### 5.3 Measurement Facts

For `tewl_change` and `hydration_change`, `timepoint` is part of proposition identity. A 4-hour outcome and an 8-hour outcome are not silently treated as contradictory answers to one proposition.

## 6. Cardinality semantics

`cardinality = one | many` remains a registry property, but enforcement is proposition-aware rather than `fact_key + exact JSON scope` aware.

For two assertions of the same Fact key:

- different proposition identity or disjoint scope → independent;
- same/overlapping proposition + same supported value → dedupe/corroboration required;
- same/overlapping proposition + incompatible supported values → unresolved conflict required;
- `cardinality=many` does not authorize contradictory values for the same semantic proposition.

Thus:

```text
niacinamide 5%
retinal 0.1%
```

is valid because `subject_ref` differs, while:

```text
same niacinamide subject + same effective scope + 5%
same niacinamide subject + same effective scope + 10%
```

cannot silently coexist as two supported Facts.

## 7. Scope relation semantics

Scope comparison is not exact JSON equality.

The executable model recognizes:

```text
equivalent
narrower
broader
disjoint
overlapping
```

Example:

```text
A: market=KR
B: market=KR, region=KR
```

B is narrower than A. They overlap and cannot evade contradiction handling merely because their serialized JSON differs.

Conflicting values on an overlapping cardinality-one proposition require review/conflict handling. No precedence rule is invented in Phase 3A.

Validity intervals using `valid_from` / `valid_to` are also checked for clear disjointness.

## 8. Relationship-bound scope compatibility

A child Fact such as `active_concentration` must be compatible with its referenced `contains_active` subject.

Inherited constraints:

```text
market
region
variant
formulation_version
```

If the subject specifies one of these, the child must carry the same value. The child may add narrower scope dimensions.

Allowed:

```text
subject: market=KR
child:   market=KR, formulation_version=v2
```

Rejected:

```text
subject: market=US
child:   market=KR
```

and:

```text
subject: formulation_version=v1
child:   formulation_version=v2
```

Clearly disjoint validity intervals are also rejected.

## 9. EvidenceRecord and Fused Product Fact are separate layers

Synthetic fixtures now use:

```text
product:
  evidence_records: [...]
  facts: [...]
```

### 9.1 EvidenceRecord

Minimum semantic fields:

```text
evidence_id
fact_key
subject_ref when applicable
proposition_value_identity when applicable
evidence_class
evidence_authority
confidence
support_direction
negative_admissibility
source_provenance
scope
qualifier_context when applicable
```

Evidence classes remain distinct:

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

### 9.2 Fused Product Fact

Minimum semantic fields:

```text
fact_instance_id
fact_key
subject_ref when applicable
scope
qualifier_context when proposition identity requires it
status
value
supporting_evidence_refs
opposing_evidence_refs
authority_ceiling
fused_confidence
```

A fused Fact must **not** carry a single `evidence_class`, `evidence_authority`, `confidence`, or generic `evidence_refs` truth field.

One Fact may be supported by heterogeneous evidence classes, for example an official product claim plus a measurement record. The evidence classes remain attached to their EvidenceRecords.

## 10. Evidence authority and confidence

`authority_ceiling` and `fused_confidence` are separate summaries.

Many weak-authority records do not become high authority by count. A primary source can coexist with low confidence when wording or proposition binding remains ambiguous.

Phase 3A does not calibrate an authority aggregation formula or confidence model.

## 11. Conflict provenance

A valid `evidence_conflict` Fact requires all of:

```text
status = evidence_conflict
value = null
supporting_evidence_refs.length > 0
opposing_evidence_refs.length > 0
```

Referenced support and opposition must bind to the same or overlapping semantic proposition. Conflict provenance cannot be synthesized from an unqualified ID array.

## 12. Explicit negative safety

Absence, not-reviewed state, and ambiguous/context-only opposition do not establish `false`.

A `supported(false)` boolean Fact requires:

1. evidence bound to the same proposition;
2. `support_direction = opposes`;
3. the Fact definition permits explicit-negative semantics;
4. the evidence record is explicitly admissible as `explicit_negative`.

`ambiguous`, `context_only`, or bare opposition cannot authorize false truth.

## 13. Claim / measurement / observation / usage separation

The architecture continues to distinguish:

```text
product claim
measurement/test outcome
user/review observation
usage instruction
```

They are EvidenceRecord classes, not one generic Fact-strength field.

Examples:

- labeled SPF is not wear experience;
- instrument hydration change is measurement evidence;
- white-cast reports are observations and do not become prevalence without analyzed denominator;
- recommended twice-weekly use is usage instruction, not efficacy magnitude.

## 14. Cross-category synthetic stress set

Existing cases remain:

- S1–S4 sunscreen;
- T1–T5 treatment;
- M1–M4 moisturizer;
- P1–P6 toner/pad.

Semantic-finalization cases add:

| Case | Contract |
| --- | --- |
| R1 | different active subjects permit independent concentrations |
| R2 | same active subject/scope contradictory concentrations require conflict handling |
| R3 | KR vs KR+region overlapping scope contradiction is detected |
| R4 | subject US / child KR relationship scope mismatch rejected |
| R5 | child may narrow KR subject with formulation version |
| R6 | claim + measurement may support one fused Fact without one evidence_class truth field |
| R7 | support + opposition produces provenance-complete conflict with null value |
| R8 | ambiguous/bare opposition cannot establish false |
| R9 | admissible explicit negative may establish false |

Additional negative controls cover incompatible formulation and disjoint validity relationships.

## 15. No generic intensity and no arbitrary tag warehouse

The registry continues to reject generic fields such as:

```text
intensity = low|medium|high
strength = 1..3
```

Quantitative properties use attribute-specific Facts and units such as SPF, water-resistance minutes, active concentration, TEWL change, or hydration change.

Unknown marketing keys fail closed.

## 16. Decision Axis isolation and anti-feature inflation

```text
Product Fact Registry
!= Decision Axis Registry
!= Recommendation scoring policy
```

New Fact keys do not create new Decision Axes automatically.

Future consumption must account for signal family, lineage dedupe, correlation grouping, and saturation/caps so correlated Product Facts cannot each add an independent recommendation bonus by default.

## 17. Phase 2 preservation

The Phase 2 cleanser POC and frozen cleanser corpus remain unchanged and are regression baselines only.

Phase 3A does not declare `PRODUCT_EVIDENCE_POC_VERIFIER_PASS`; the pre-existing focused-verifier execution debt remains separate and non-blocking for this architecture phase.

## 18. Production invariance

This PR remains offline-only.

```text
Production recommendation delta = 0
ranking delta = 0
Top Pick / Top3 delta = 0
Admin runtime delta = 0
DB migration = 0
Hosted write = 0
Production DB write = 0
Product Fact runtime consumer = 0
Decision Axis runtime consumer = 0
CandidatePolicy activation = 0
#167 activation = 0
#177 activation = 0
```

## 19. Success meaning

Successful Phase 3A semantic finalization means the offline contract can express and validate:

- governed cross-category Fact keys;
- proposition identity distinct from storage identity;
- proposition-aware cardinality;
- repeatable and relationship-bound Facts;
- overlap-aware product/market/formulation scope;
- evidence records separate from fused Facts;
- heterogeneous evidence support;
- provenance-complete conflict;
- safe explicit-negative fusion;
- authority ceiling separate from fused confidence;
- boolean, enum, number/unit, range/unit and entity values;
- no arbitrary tags, generic intensity, or recommendation weights.

It does **not** mean cross-category real Product Facts are reviewed or that the registry/schema is Production-ready.
