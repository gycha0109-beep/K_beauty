# Face Lab V2 — Candidate Capability Contract v1

> Track: face-research
> Status: Gate B contract / no catalog matcher activation

## 1. Purpose

Gate A established the Face Lab Appearance Handoff:

```text
selected Route
→ Domain Execution
→ Face Lab Style Capability
→ Appearance Slot
```

Gate B defines the next authority boundary:

```text
concrete candidate
→ explicit capability proof
→ eligible / ineligible for one Appearance Slot
```

This contract does not search the catalog, rank candidates, select a SKU, persist a binding, or render an image.

## 2. Core rule

A concrete candidate may satisfy an Appearance Slot only when the candidate has an explicit, evidenced claim that it supports the slot's required Face Lab style capability.

The following are not sufficient by themselves:

- catalog category;
- catalog form;
- storefront category;
- brand taxonomy;
- commerce label;
- marketing copy;
- existing `catalog-taxonomy-v1 supports_capability` relation.

The catalog taxonomy capability axis remains applicability metadata for Product Fact dimensions. It is not Face Lab style-capability proof.

## 3. Candidate entity types

Gate B recognizes five semantic entity types:

```text
product
product_variant
style_reference
service
color_palette
```

### product

A catalog product identity or product group.

### product_variant

A specific executable variant, such as a shade/SKU-level identity.

`product_variant` remains distinct from `product` even though, for Appearance Slot entity-type compatibility, it inherits the `product` compatibility class.

This contract does not define the Product Variant database schema. Gate D owns variant/shade authority.

### style_reference

A governed style reference such as a hairstyle exemplar. It must not be forced into the Product catalog.

### service

A governed service definition such as a haircut, perm, brow service, or other executable styling service.

### color_palette

A governed palette entity used for `overall_palette`.

## 4. Candidate identity contract

Conceptual shape:

```text
candidateRef
entityType
entityId
variantId?
capabilityClaims[]
metadata?
```

Rules:

1. `candidateRef`, `entityType`, and `entityId` are required.
2. `product_variant` additionally requires `variantId`.
3. entity identity and capability proof are separate.
4. a candidate may expose multiple capability claims.
5. candidate metadata never grants capability authority by itself.

## 5. Capability claim contract

Each claim uses:

```text
capabilityKey
supportState
proofClass
proofVersion
evidenceRefs[]
qualifiers?
```

### supportState

Allowed values:

```text
supported
unsupported
```

Absence of a claim means unknown / unproven. Unknown is not converted into `supported`.

### proofClass

Allowed proof classes:

```text
governed_product_fact_mapping
governed_catalog_attribute_mapping
curated_capability_mapping
style_reference_definition
service_definition
palette_definition
```

The proof class states what governed layer establishes the candidate-to-capability relationship. It does not create Product Fact truth.

### evidenceRefs

A `supported` claim requires at least one evidence reference.

Examples:

```text
product_fact:...
catalog_attribute_review:...
curated_mapping:...
style_reference_definition:...
service_definition:...
palette_definition:...
```

Gate B validates that evidence refs are present and namespaced. It does not dereference or independently verify those records.

## 6. Explicitly forbidden proof shortcuts

The following proof classes are rejected:

```text
category_inference
commerce_label_inference
marketing_copy_inference
```

Examples of invalid reasoning:

```text
category = lip_color
therefore capability = lip_color
```

```text
storefront label contains "glow"
therefore capability = face_highlight
```

```text
catalog taxonomy says category supports shade_variant
therefore this concrete product supports lip_color
```

These are authority leaks.

## 7. Slot compatibility

The slot definition remains the authority for allowed entity compatibility.

Examples:

```text
hair_shape
→ product / product_variant
→ style_reference
→ service

overall_palette
→ color_palette

facial_frame
→ product / product_variant
```

`product_variant` is checked against the slot's `product` compatibility class while keeping variant identity intact.

A `style_reference` cannot satisfy a slot that accepts only products merely because its metadata looks similar.

## 8. Conflict handling

When the same candidate has both `supported` and `unsupported` claims for one capability, Gate B fails closed:

```text
capability_claim_conflict
```

The evaluator does not choose one claim by confidence, timestamp, or claim count.

Conflict resolution belongs to the governed source/mapping layer.

## 9. Candidate capability evaluation result

Conceptual result:

```text
contractVersion
status
reason
slotKey
requiredCapability
candidateRef
entityType
matchedClaim
evidenceRefs[]
```

Status:

```text
eligible
ineligible
invalid
```

### eligible

All Gate B authority checks pass.

### ineligible

The candidate is valid but cannot satisfy this slot, for example:

- entity type not accepted;
- capability claim absent;
- capability explicitly unsupported;
- conflicting capability claims.

### invalid

The candidate or claim contract itself is malformed, for example:

- missing identity;
- unknown entity type;
- unknown capability key;
- missing evidence on a supported claim;
- forbidden proof class;
- malformed evidence reference.

## 10. Product Variant boundary

Gate B recognizes `product_variant` as an entity type but does not decide when a product group must be narrowed to a shade/SKU.

That authority remains Gate D.

Therefore Gate B answers only:

> Does this concrete candidate have evidenced capability authority for the slot?

It does not answer:

> Is this the correct shade/SKU for this user's required attributes?

## 11. Relationship to Appearance Slot criteria

Gate B does not compare:

- `requiredAttributes`;
- `preferredAttributes`;
- `excludedAttributes`.

Those fields remain intact in the Appearance Slot.

Gate C owns criteria matching and shadow candidate enumeration.

This separation prevents capability proof from turning into an implicit ranking engine.

## 12. Relationship to Product Facts

```text
Product Fact
!=
Face Lab capability claim
```

A Product Fact may be referenced by a governed mapping as evidence for a capability claim, but the mapping itself must be explicit.

Example:

```text
governed Product Fact(s)
+ reviewed mapping rule
→ candidate supports lip_finish
```

A Product Fact registry key does not automatically become a Face Lab style capability.

## 13. Relationship to catalog taxonomy

```text
catalog taxonomy
→ what the entity is / what fact dimensions may apply

Face Lab candidate capability
→ what visible appearance change the concrete entity can execute
```

The layers may cross-reference each other later, but neither silently grants authority to the other.

## 14. Gate B implementation scope

Gate B may implement:

- candidate entity validation;
- capability-claim validation;
- explicit proof-class registry;
- fail-closed conflict handling;
- slot/entity compatibility;
- deterministic candidate capability evaluator;
- dedicated verifier and CI gate.

Gate B must not implement:

- catalog reads;
- candidate enumeration;
- attribute matching;
- ranking;
- recommendation weights;
- Product Variant/shade selection;
- hosted DB migration;
- Production writes;
- user-visible product recommendation;
- purchase links;
- Render Profile generation;
- image generation.

## 15. Required invariants

1. category alone cannot prove a Face Lab style capability.
2. commerce labels cannot prove a Face Lab style capability.
3. marketing copy cannot prove a Face Lab style capability.
4. `catalog-taxonomy-v1 supports_capability` cannot prove a Face Lab style capability.
5. a supported claim requires explicit evidence refs.
6. unsupported and supported claims for the same capability fail closed.
7. unknown capability keys fail closed.
8. slot entity compatibility is enforced.
9. product variants remain distinct identities.
10. capability eligibility does not rank candidates.
11. capability eligibility does not bind a slot.
12. no real product, style, service, palette, SKU, or shade is invented.

## 16. Next gate

Gate C — Catalog Matcher Shadow may consume:

```text
Appearance Slot
+
candidate capability eligibility
+
required / preferred / excluded attributes
+
user constraints
```

and produce shadow-only candidate matches with explicit evidence and version lineage.

Gate C remains non-user-facing until its own activation decision.
