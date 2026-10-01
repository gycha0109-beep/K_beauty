# Face Lab Catalog / Recommendation Architecture v1

> Track: face-research
> Status: foundation contract / no catalog matching activation
> Baseline intent: preserve existing catalog-taxonomy-v1 authority and add a Face Lab-specific appearance handoff plane

## 1. Purpose

Face Lab must eventually connect one selected styling Route to concrete executable assets without encoding every product name or commerce category directly into Face Lab.

Target flow:

```text
Photo
→ Current Face Profile
→ Target Style
→ Style Delta
→ Route
→ Domain Execution
→ Face Lab Style Capability
→ Appearance Slot
→ Catalog / Style / Service Candidate Matching
→ Selected Candidate / Variant
→ Look Composer
→ Render Adapter
→ AI Simulation
```

This architecture is the contract for the middle section:

```text
Domain Execution
→ Style Capability
→ Appearance Slot
→ Candidate Binding
```

It does not select real products yet.

## 2. Existing catalog authority must be reused, not duplicated

The repository already has `catalog-taxonomy-v1` with these independent axes:

- `entity_kind`
- `domain`
- `recommendation_family`
- `category`
- `form`
- `capability`

Its current authority is shadow-only and existing Production recommendation semantics remain independently governed.

Face Lab must not create a second competing product-category authority.

Important semantic boundary:

```text
catalog-taxonomy-v1 capability
!=
Face Lab style capability
```

The catalog taxonomy `supports_capability` relation means a taxonomy node may support an attribute / Product Fact dimension. It is applicability metadata and is not proof that an individual Product has a property.

Face Lab style capability means:

> what visible appearance change an executable asset can contribute to.

The two concepts remain separately versioned.

## 3. Stable conceptual layers

### 3.1 Recommendable entity

Future matching may return different kinds of executable entities:

```text
product / product variant
style reference
service
color palette
```

Current catalog Product identity remains governed by the existing catalog plane. Non-product entities must not be forced into `products`.

### 3.2 Product group and variant

The architecture distinguishes a product family/model from a purchasable shade, size, or SKU variant.

Example:

```text
Product group: Dior Lip Glow
Variants:
- 001 Pink
- 004 Coral
- 012 Rosewood
```

Face Lab candidate binding should prefer the executable variant when shade/formulation differences matter.

This document does not introduce a Product Variant database migration. It only reserves the semantic boundary.

### 3.3 Canonical product category and form

Product identity answers:

> What is this product?

Form answers:

> In what physical/delivery form does it exist?

Examples:

```text
foundation + cushion
blush + cushion
highlighter + stick
brow_product + gel
eyeshadow + powder
```

Therefore terms such as `cushion`, `stick`, and `gel` must not automatically become new product categories.

### 3.4 Attributes / facets

Attributes describe the entity rather than multiplying categories.

Shared future dimensions may include:

```text
color:
  hue_family
  undertone
  depth
  chroma
  exact_color

optical:
  opacity
  gloss
  shimmer
  pearl
  metallic
  glitter
  reflectivity

finish:
  matte
  natural
  satin
  radiant
  glossy

form:
  liquid
  cream
  powder
  stick
  pencil
  gel
  balm
  oil
  cushion
  spray
```

Category-specific attribute registries remain separately governed.

### 3.5 Application area

Application area is multi-valued metadata, not product identity.

Examples:

```text
face_all
under_eye
t_zone
cheek
cheekbone
nose
jaw
upper_lid
lower_lid
lash_line
brow
lash
lip
iris
hair
facial_hair
face_frame
```

A lip-and-cheek tint can therefore remain one product while supporting both `lip` and `cheek` application areas.

## 4. Face Lab style capability v1

A Face Lab style capability describes a visible appearance effect.

Initial stable vocabulary:

```text
complexion_prepare
complexion_even
complexion_correct
complexion_finish

cheek_color
face_shadow
face_highlight

eye_color
eye_definition
lash_definition

brow_definition

lip_color
lip_finish

iris_appearance
facial_frame

hair_shape
hair_color

facial_hair_shape

face_accessory
overall_palette
```

This vocabulary is intentionally much smaller than the number of possible product categories.

A single entity may support multiple Face Lab style capabilities.

Examples:

```text
tinted lip balm
→ lip_color
→ lip_finish

contact lens
→ iris_appearance

eyeglass frame
→ facial_frame

hair styling product
→ hair_shape

haircut style reference
→ hair_shape

hair perm service
→ hair_shape
```

Capability support by a concrete candidate must eventually be governed by an explicit candidate-to-capability mapping. Category membership alone must not manufacture compatibility.

## 5. Appearance Slot v1

An Appearance Slot is a requirement emitted by the selected Face Lab Route.

It answers:

> What visible change does this result currently need?

It does not answer:

> Which product category should be purchased?

Initial stable slots:

```text
complexion_prepare
complexion_even
complexion_correct
complexion_finish

cheek_color
face_shadow
face_highlight

eye_color
eye_definition
lash_definition

brow_definition

lip_color
lip_finish

iris_appearance
facial_frame

hair_shape
hair_color

facial_hair_shape

face_accessory
overall_palette
```

Each slot references one required Face Lab style capability but the slot and capability remain separate concepts.

A candidate may satisfy more than one slot, and a slot may be satisfied by candidates from different entity kinds.

Example:

```text
slot: hair_shape

possible future bindings:
- hairstyle reference
- haircut / perm service
- hair styling product
```

## 6. Slot contract

Each emitted slot uses the following conceptual shape:

```text
slotId
slotKey
requiredCapability
sourceDomains[]
sourceRefs[]

criteria:
  requiredAttributes
  preferredAttributes
  excludedAttributes

executionCues:
  placement[]
  direction[]
  intensity
  notes[]

matchState:
  criteriaState
  bindingState
  candidateRefs[]
  selectedEntityRef
  selectedVariantRef
  matcherVersion
  catalogTaxonomyVersion
```

Rules:

1. `requiredAttributes` are machine-enforceable constraints only.
2. descriptive execution copy must not be silently promoted into exact catalog facts.
3. `preferredAttributes` may influence future ranking but are not hard filters.
4. `excludedAttributes` are fail-closed exclusions when their semantics are known.
5. slots are emitted only after Route choice is committed.
6. `default_preview` must never unlock route-specific catalog matching.
7. an unbound slot is a valid result state.
8. no slot may invent a real product, SKU, shade, style, or service.

## 7. Current execution-to-slot bridge

Current Face Lab execution data can already seed some slots.

### Hair

Available Hair execution may emit:

```text
hair_shape
```

Current hair example `styleKey` / `requiredParameters` can be preserved as structured cues. Korean explanatory copy remains execution evidence, not catalog truth.

### Makeup

Current Makeup Product Specifications can seed:

```text
base        → complexion_even
eyeliner    → eye_definition
eyeshadow   → eye_color
blush       → cheek_color
contour     → face_shadow
highlighter → face_highlight
lip         → lip_color
brow        → brow_definition
mascara     → lash_definition
```

Only mappings backed by emitted execution/spec data may produce a slot.

### Grooming

```text
brows       → brow_definition
facialHair  → facial_hair_shape
```

### Eyewear

```text
eyewear execution → facial_frame
```

### Accessories

```text
face-adjacent accessory execution → face_accessory
```

### Color

```text
color execution → overall_palette
```

Slots such as `iris_appearance`, `hair_color`, `lip_finish`, and `complexion_finish` remain defined but must not be emitted until a current execution contract explicitly requires them.

## 8. Explicit Route Choice authority

Existing Face Lab authority remains unchanged.

For multi-route results:

```text
default_preview
→ comparison only
→ no execution commitment
→ no appearance slots
→ no catalog matching
```

After explicit choice:

```text
user_selected
→ route execution
→ appearance slots
→ future matching eligible
```

`single_route_auto` may emit slots because the current Face Lab contract treats it as a committed executable path.

## 9. Candidate binding

Future Catalog Matcher input:

```text
Appearance Slot
+
required attributes
+
preferred attributes
+
excluded attributes
+
user constraints
```

Future output:

```text
candidate entity refs[]
selected entity ref
selected variant ref when applicable
match evidence
catalog taxonomy version
matcher version
```

Candidate binding is not implemented by this foundation.

## 10. Catalog taxonomy crosswalk

External commerce taxonomies must remain source metadata.

Examples:

```text
Olive Young
Shopify
brand taxonomy
future catalog source
```

Flow:

```text
source taxonomy
→ governed normalization
→ existing BEJEWELY catalog taxonomy
→ candidate capability mapping
→ Appearance Slot matching
```

Face Lab must not parse storefront category strings directly as recommendation authority.

## 11. Composite and hybrid products

A package or marketing format must not automatically create a canonical category.

Examples:

```text
eyeshadow palette
contour + highlighter duo
lip + cheek tint
cushion blush
glitter eyeliner
colored lip balm
```

These are expressed through existing category/form/component/attribute semantics where possible.

A new canonical category is the last resort, not the default response to a new commerce label.

## 12. Render Adapter boundary

Catalog matching and AI rendering are separate planes.

```text
selected candidate facts
+
Face Lab execution placement
+
composed look
→ Render Adapter
→ model-specific Render Profile
→ image generation/edit model
```

Catalog data must not be polluted with model-specific prompt fields.

The Render Adapter may translate catalog facts such as:

```text
shade
opacity
finish
gloss
frame geometry
hair style reference
```

into model-specific rendering controls.

Changing image models must not require redesigning the catalog taxonomy.

## 13. Persistence / schema strategy

Near-term implementation is additive and contract-first.

Do not create a large nullable makeup/style table and do not create a parallel catalog taxonomy.

Preferred future storage pattern:

```text
existing catalog taxonomy
+
governed product / variant identity
+
category-specific attribute facts or projections
+
Face Lab candidate-capability mapping
+
Face Lab appearance slot snapshot
+
candidate binding snapshot
+
separate Render Profile
```

Any hosted DB migration requires a separate schema review after the runtime contract is stable.

## 14. Foundation implementation scope

This foundation may implement:

- Face Lab style capability registry;
- Appearance Slot registry;
- deterministic execution-to-slot bridge;
- additive canonical `appearanceHandoff`;
- verifier for Route authority and slot semantics.

It must not implement:

- real SKU selection;
- shade recommendation from an unreviewed catalog;
- new Product Fact truth;
- new catalog taxonomy activation;
- Production catalog writes;
- recommendation ranking weights;
- AI image generation;
- product purchase links.

## 15. Invariants

1. Existing `catalog-taxonomy-v1` remains the catalog taxonomy authority.
2. Face Lab style capability is not the catalog taxonomy `capability` axis.
3. Category is not Appearance Slot.
4. Form is not Category.
5. Commerce labels are not canonical authority.
6. Route preview is not user selection.
7. Slot existence is not proof that a matching catalog candidate exists.
8. Candidate category membership alone is not proof that it satisfies a Face Lab capability.
9. Product Fact authority remains separate from matching criteria.
10. Render Profile remains separate from catalog facts.
11. No real product is invented when catalog evidence is absent.
12. New categories are introduced only when existing category + form + attributes cannot represent the product identity.

## 16. Next gates

### Gate A — Appearance Handoff foundation

- registry
- deterministic bridge
- canonical additive output
- verifier
- no catalog reads

### Gate B — Candidate capability contract

Define how a concrete Product Variant / Style Reference / Service / Palette proves that it supports a Face Lab style capability.

### Gate C — Catalog matcher shadow

Run candidate matching without user-facing activation.

### Gate D — Product Variant / shade authority

Only after product identity and shade evidence are governed.

### Gate E — Render Adapter

Translate selected, evidenced candidates into model-specific simulation controls.

### Gate F — AI Simulation

Generate a visual preview while preserving identity and limiting edits to the committed Look.
