# Face Lab V2 — Product Variant / Shade Authority Contract v1

> Track: face-research
> Status: Gate D contract / no hosted schema activation

## 1. Purpose

Gate A created Appearance Slots.

Gate B established explicit candidate-to-capability proof.

Gate C added shadow-only criteria matching over governed candidate attributes.

Gate D defines the missing identity layer for shade/SKU-sensitive products:

```text
Product
→ Product Variant identity
→ governed Shade Profile
→ Gate B capability claim
→ Gate C attribute snapshot
→ shadow match
```

This contract is required before Face Lab may claim that a specific shade, colorway, SKU, or variant is the concrete executable product.

## 2. Existing authorities that must not be overloaded

### 2.1 `products`

Current Recommendation products are intentionally product-line level.

Current runtime code explicitly treats recommendation products as product-line identities rather than SKU / set / refill splits.

Gate D does not mutate that authority.

### 2.2 `product_fact_subjects.variant_key`

The existing Product Fact Subject `variant_key` participates in formulation / market / subject identity.

It is not automatically a commerce Product Variant identifier and must not be reused as a Face Lab shade/SKU identity without a separately reviewed mapping.

### 2.3 `product_source_bindings`

Existing source bindings attach external identities to `products` and may still be `product_subject_unresolved`.

A product-level source binding does not prove a shade/SKU variant.

### 2.4 catalog taxonomy

Catalog taxonomy answers what the product is and which metadata dimensions may apply.

It does not by itself prove:

- a concrete shade;
- a SKU;
- a GTIN;
- a color swatch;
- an applied cosmetic color.

## 3. Product Variant identity

Gate D introduces a runtime contract for one concrete variant.

Conceptual shape:

```text
variantRef
productId
variantId
identityVersion
identityState
lifecycleState
variantAxes
identityEvidenceRefs[]
sourceVariantRefs[]
shadeProfile?
```

### variantRef

Canonical runtime reference:

```text
product_variant:<productId>:<variantId>
```

The caller must not supply a conflicting arbitrary candidate reference.

### productId

Parent BEJEWELY product identity.

### variantId

Stable internal variant identity within one product.

It is not derived from display text at runtime.

### identityState

Allowed values:

```text
resolved
ambiguous
unresolved
```

Only `resolved` identities may become Gate C candidate records.

### lifecycleState

Allowed values:

```text
active
retired
```

Only `active` variants may become recommendation candidates.

### variantAxes

A controlled object describing which concrete dimensions distinguish this variant.

Examples:

```text
shade: "012-rosewood"
size: "3.2g"
market: "KR"
```

Gate D does not infer identity from arbitrary storefront labels.

### identityEvidenceRefs

A resolved variant requires one or more namespaced evidence references proving the concrete identity.

## 4. Shade Profile

A shade-sensitive Product Variant may carry a governed Shade Profile.

Conceptual shape:

```text
profileVersion
shadeKey
displayLabel
attributes
evidenceRefsByAttribute
colorAnchors[]
```

### shadeKey

Stable shade key within the product.

Examples:

```text
012-rosewood
21n1-ivory
steel-blue
```

It is identity data, not presentation copy.

### displayLabel

Human-readable source label.

Examples:

```text
"012 Rosewood"
"21N1 Ivory"
```

Display text alone is never converted into color facts.

## 5. Shade attributes

Gate D v1 may govern these Face Lab matcher attributes:

```text
hueFamily
undertone
depth
chroma
opacity
finish
glossLevel
shimmerLevel
```

Example:

```text
hueFamily: rose
undertone: neutral_cool
depth: medium
chroma: medium
opacity: buildable
finish: satin
glossLevel: medium
```

Every populated attribute requires one or more namespaced evidence references.

Unknown shade attributes fail closed.

## 6. Color anchors

Exact or semi-exact visual color references are modeled separately from semantic shade attributes.

Conceptual shape:

```text
anchorId
role
colorSpace
value
evidenceRefs[]
```

Allowed roles:

```text
brand_swatch
merchant_swatch
applied_reference
```

Allowed color spaces in v1:

```text
srgb_hex
cie_lab
```

### Important rendering boundary

```text
brand_swatch
!=
applied cosmetic appearance
```

A brand swatch may describe a source color chip, but it does not prove how a translucent lipstick, gloss, foundation, blush, or eyeshadow will render on the user's skin.

Therefore Gate D preserves anchor role and never upgrades a swatch to an applied-reference claim.

Gate E Render Adapter must decide how each anchor role is used.

## 7. Shade authority does not come from name parsing

The following are forbidden shortcuts:

```text
"Rose Gold" → exact RGB
"21N" → exact skin color
"Steel Blue" → exact rendered shade
"Glow" → glossLevel
"Matte" in marketing title → governed finish
```

A label may remain presentation metadata.

Structured shade attributes require governed evidence.

## 8. Variant identity does not come from SKU text alone

A SKU / seller option / storefront option may be useful source evidence, but no external identifier becomes BEJEWELY variant authority by string presence alone.

A resolved variant requires explicit identity evidence and a stable internal `variantId`.

## 9. Gate C projection

A valid active resolved variant may project to:

```text
candidate:
  entityType = product_variant
  entityId = productId
  variantId = variantId

attributeSnapshot:
  governed Shade Profile attributes only
```

Gate D does not generate Face Lab capability claims.

Capability claims remain Gate B authority and must be supplied explicitly.

This prevents:

```text
shade exists
→ therefore candidate supports lip_color
```

from becoming an implicit rule.

## 10. Candidate projection contract

Conceptual result:

```text
authorityVersion
status
reason

candidate:
  candidateRef
  entityType
  entityId
  variantId
  capabilityClaims

attributeSnapshot:
  snapshotVersion
  sourceVersion
  attributes
  evidenceRefsByAttribute

renderHints:
  shadeKey
  displayLabel
  colorAnchors[]
```

The `renderHints` block is non-authoritative for matching and is only reserved for Gate E.

## 11. Statuses

```text
ready
identity_only
inactive
invalid
```

### ready

Variant identity is resolved, active, and a valid governed Shade Profile is present.

### identity_only

Variant identity is resolved and active, but no Shade Profile is present.

This state may be valid for size-only variants but is insufficient for shade-sensitive Face Lab selection.

### inactive

Variant identity is valid but retired.

### invalid

Identity or shade contract is malformed, ambiguous, unresolved, or unsupported.

## 12. Evidence reference rules

All evidence references must be namespaced.

Examples:

```text
brand_variant:...
catalog_variant_review:...
brand_swatch:...
merchant_swatch:...
applied_reference:...
```

Gate D validates reference shape but does not dereference the underlying record.

Hosted evidence persistence remains a later schema concern.

## 13. Relationship to Product Fact

A Product Fact may later provide governed evidence for a shade attribute or variant property.

However:

```text
Product Fact Subject variant_key
!=
Product Variant variantId
```

unless an explicit reviewed mapping says otherwise.

No implicit equality is allowed.

## 14. Relationship to AI simulation

Gate D provides identity and color evidence.

It does not claim that an image model can reproduce the exact real-world product appearance.

Future flow:

```text
Variant identity
+ Shade Profile
+ Color anchors
+ Face Lab placement / intensity
+ user skin / lighting context
→ Render Adapter
→ model-specific simulation controls
```

The Render Adapter remains responsible for differentiating:

- source swatch color;
- translucency;
- finish;
- reflectivity;
- skin interaction;
- placement;
- intensity.

## 15. Hosted schema boundary

Gate D v1 is contract-first.

It does not create:

- `product_variants` table;
- shade table;
- SKU table;
- source-variant binding table;
- Production write RPC;
- migration.

A hosted schema migration may be designed only after this runtime contract and fixtures are stable.

## 16. Gate D implementation scope

Gate D may implement:

- Product Variant identity validation;
- deterministic canonical `variantRef`;
- lifecycle / resolution checks;
- Shade Profile validation;
- color-anchor validation;
- Gate C attribute snapshot projection;
- candidate record projection;
- verifier and CI gate.

Gate D must not implement:

- catalog crawling;
- source scraping;
- real SKU discovery;
- real shade ingestion;
- hosted DB writes;
- Product Fact mutation;
- ranking;
- slot binding;
- purchase-link selection;
- Render Adapter logic;
- image generation.

## 17. Required invariants

1. Product Variant identity is separate from Product identity.
2. Product Fact `variant_key` is not Product Variant authority.
3. product-level source bindings are not Product Variant authority.
4. unresolved or ambiguous variants fail closed.
5. retired variants do not become candidates.
6. display labels do not generate shade facts.
7. every projected shade attribute has evidence.
8. unknown shade attributes fail closed.
9. swatch color is not treated as applied cosmetic color.
10. color anchors preserve source role.
11. variant identity does not generate capability claims.
12. Gate D does not rank or bind candidates.
13. Gate D does not mutate hosted data.
14. no real SKU, shade, or product fact is invented.

## 18. Next gate

Gate E — Render Adapter may consume:

```text
selected / evaluated Product Variant
+
Shade Profile
+
color anchors
+
Face Lab execution placement
+
Look Composer output
```

and translate those governed facts into image-model-specific controls without polluting catalog authority.
