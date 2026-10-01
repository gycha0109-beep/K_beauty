# Face Lab V2 — Catalog Matcher Shadow Contract v1

> Track: face-research
> Status: Gate C shadow-only matcher / no user-facing activation

## 1. Purpose

Gate A produces committed Appearance Slots.

Gate B determines whether a concrete candidate has explicit authority to support the slot's required Face Lab style capability.

Gate C adds deterministic, shadow-only criteria matching:

```text
Appearance Slot
+
Candidate Capability eligibility
+
Governed candidate attribute snapshot
→ shadow candidate match diagnostics
```

Gate C does not read the Production catalog by itself. Candidate records are injected by a caller or test harness.

## 2. Authority order

The matcher evaluates in this order:

```text
1. registered Appearance Slot
2. valid candidate identity
3. Gate B capability eligibility
4. valid governed attribute snapshot
5. required criteria
6. excluded criteria
7. preferred criteria diagnostics
```

A later layer may not skip an earlier authority gate.

## 3. Application constraints are not catalog criteria

Face Lab execution can contain instructions such as:

```text
avoid_overly_fixed_upward_angle
angle_neutral_to_slight
avoid_heavy_coverage
```

These are execution/application constraints unless a separately governed mapping converts them into a candidate attribute predicate.

Gate C therefore requires Appearance Handoff v2 semantics:

- machine-enforceable catalog attributes remain in `criteria`;
- application constraints remain in `executionCues.notes`;
- application copy is not treated as a product exclusion tag.

## 4. Candidate attribute snapshot

Conceptual shape:

```text
snapshotVersion
attributes
evidenceRefsByAttribute
sourceVersion?
```

Example:

```text
snapshotVersion: face-lab-candidate-attribute-snapshot-v1
attributes:
  opacity: light_to_medium
  finish:
    - natural
    - satin
evidenceRefsByAttribute:
  opacity:
    - catalog_attribute_review:product-1-opacity
  finish:
    - catalog_attribute_review:product-1-finish
```

Rules:

1. every consumed attribute must be in the Gate C attribute policy registry;
2. every present attribute must have at least one namespaced evidence ref;
3. unknown attributes fail closed;
4. candidate metadata, category, storefront labels, and marketing text are not attribute snapshots;
5. Gate C does not create Product Facts.

## 5. Initial attribute policy registry

Gate C v1 supports the current Face Lab handoff vocabulary only:

```text
hueFamily
undertone
depth
chroma
opacity
finish
glossLevel
blurLevel
shimmerLevel
diffusion
buildability

temperatureDirection
depthDirection
chromaDirection
contrastDirection

styleKeys
requiredParameters
preferredFamilies
```

The registry defines matching semantics per key.

No unknown key is treated as a generic tag.

## 6. Matching operators

### exact_or_member

Used for scalar-like attributes.

A scalar requirement matches:

- the same candidate scalar; or
- a candidate list containing that scalar.

### overlap_any

Used when the slot provides acceptable alternatives.

Example:

```text
required finish = [natural, satin]
candidate finish = satin
→ match
```

### contains_all

Used when a preferred structured style requires all listed parameters.

Example:

```text
preferred requiredParameters = [curvature, light_layers]
candidate requiredParameters = [curvature, light_layers, side_volume]
→ match
```

## 7. Required criteria

Every required criterion must be resolvable and matched.

If a required attribute is missing:

```text
criteria_required_missing
```

If present but incompatible:

```text
criteria_required_mismatch
```

The candidate is not shadow-eligible.

## 8. Excluded criteria

Every excluded criterion must use a registered attribute policy.

If the candidate matches a prohibited value:

```text
criteria_excluded_match
```

The candidate is not shadow-eligible.

Unknown excluded criteria fail closed as unresolved; they are never silently ignored.

## 9. Preferred criteria

Preferred criteria never override required or excluded criteria.

Gate C reports:

```text
preferredMatchedKeys
preferredUnmatchedKeys
preferredMissingKeys
```

It does not turn those counts into a score or ranking weight.

Gate C v1 does not choose a winner.

## 10. Shadow matcher result

Conceptual shape:

```text
matcherVersion
mode = shadow_only
slotKey
status
candidateCount
eligibleCandidateRefs[]
results[]
selectedEntityRef = null
selectedVariantRef = null
rankingApplied = false
publicActivation = false
```

Candidate result:

```text
candidateRef
entityType
status
reason
capability
required
excluded
preferred
evidenceRefs[]
```

Stable output ordering is by `candidateRef` only. This ordering is for deterministic replay and is not a recommendation rank.

## 11. Result statuses

Matcher-level:

```text
matched
no_eligible_candidates
invalid_slot
```

Candidate-level:

```text
eligible
invalid
capability_ineligible
criteria_unresolved
criteria_ineligible
```

## 12. Product Variant boundary

Gate C can compare governed attributes supplied for a `product_variant`.

It does not decide whether a product group must be expanded to variants.

Gate D remains responsible for Product Variant / shade authority and real variant enumeration.

## 13. Catalog access boundary

Gate C v1 is pure and injected:

```text
candidate records in
→ deterministic shadow diagnostics out
```

It does not:

- import `getRecommendationProducts`;
- query Supabase;
- invoke `catalog-taxonomy-v1` readers;
- call storefront APIs;
- create or update catalog data.

A later adapter may feed governed candidates into this matcher after a separate authority review.

## 14. Ranking boundary

```text
eligible candidate set
!= ranked recommendation
```

Gate C does not expose:

- score;
- rank;
- top pick;
- winner;
- boost;
- penalty;
- recommendation weight.

Preferred-criteria diagnostics remain descriptive only.

## 15. Binding boundary

Gate C never changes the Appearance Slot's `matchState`.

It does not set:

- `candidateRefs`;
- `selectedEntityRef`;
- `selectedVariantRef`;
- `bindingState`.

Binding requires a later explicit activation contract.

## 16. Gate C implementation scope

Gate C may implement:

- governed attribute policy registry;
- attribute snapshot validation;
- required/excluded/preferred deterministic matching;
- Gate B capability gating;
- deterministic shadow output;
- synthetic fixtures;
- dedicated verifier and CI gate.

Gate C must not implement:

- real catalog reads;
- Production matching activation;
- ranking;
- user-visible product recommendations;
- Product Variant enumeration;
- shade selection;
- database migrations;
- Production writes;
- purchase links;
- Render Profile generation;
- AI simulation.

## 17. Required invariants

1. Gate B capability eligibility is mandatory.
2. unknown attributes fail closed.
3. consumed attributes require evidence refs.
4. missing required attributes fail closed.
5. required mismatches fail closed.
6. excluded matches fail closed.
7. preferred criteria never override hard criteria.
8. deterministic ordering is not ranking.
9. matcher never binds a slot.
10. matcher never selects a candidate.
11. matcher never invents product facts.
12. application instructions never become catalog tags implicitly.
13. no Production catalog read occurs.

## 18. Next gate

Gate D — Product Variant / Shade Authority must define real variant identity and governed variant attributes before Face Lab may make shade/SKU-specific product selections.
