# Face Lab V2 — Render Adapter Contract v1

> Track: face-research
> Status: Gate E contract / no image model invocation

## 1. Purpose

Gate A created Appearance Slots.

Gate B established candidate capability authority.

Gate C added shadow-only criteria matching.

Gate D established Product Variant / Shade authority and preserved source color-anchor roles.

Gate E converts one committed Face Lab Look plus caller-supplied, already-authorized candidate bindings into a deterministic image-edit specification.

Target flow:

```text
Committed Route
+ Appearance Handoff
+ Look Composer output
+ optional explicit candidate bindings
→ Render Adapter
→ Render Spec
→ provider-specific image edit
```

Gate E does not call an image model.

## 2. Core boundary

The Render Adapter may translate governed facts into rendering instructions.

It must never create new recommendation authority.

Therefore:

```text
Render Adapter
!=
Catalog Matcher
!=
Candidate Selector
!=
Image Generator
```

The caller may supply a binding for a slot. Gate E validates that binding by replaying Gate C with exactly that candidate. Gate E never chooses a candidate on its own.

## 3. Input

Conceptual input:

```text
appearanceHandoff
look
bindingsBySlot
```

### appearanceHandoff

Must be the committed route's available Appearance Handoff.

### look

Must be the Look Composer output for the same route.

### bindingsBySlot

Optional map:

```text
slotKey:
  candidate
  attributeSnapshot
  renderHints?
```

A binding is accepted only if the candidate passes the slot through Gate C shadow matching.

## 4. Source modes

Each render operation is one of:

```text
execution_only
candidate_bound
```

### execution_only

No concrete candidate was supplied.

The adapter uses only:

- slot criteria;
- execution placement;
- execution direction;
- intensity;
- target palette direction.

This can visualize a general styling direction, but it cannot claim to depict a specific product.

### candidate_bound

A concrete, authorized candidate was supplied and validated.

The adapter may additionally use:

- candidate attribute snapshot;
- Product Variant Shade Profile projection;
- color anchors;
- variant identity;
- other governed render hints.

## 5. Render operations

Initial operation vocabulary follows stable Appearance Slots:

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

Every operation preserves its originating `slotKey`.

## 6. Target regions

Gate E translates slots into explicit visual regions.

Examples:

```text
lip_color
→ lips

eye_color
→ upper_eyelid / lower_eyelid when applicable

cheek_color
→ cheeks

face_highlight
→ cheekbone / nose / other execution placement

facial_frame
→ eyewear

hair_shape
→ hair

facial_hair_shape
→ facial_hair

overall_palette
→ rendered_style_elements
```

The adapter must not silently broaden one operation to unrelated regions.

## 7. Identity lock

All Face Lab simulations are image edits of the same person.

Default locked dimensions:

```text
identity
facial_geometry
eye_anatomy
nose_geometry
jaw_chin_geometry
ear_geometry
head_pose
camera_perspective
expression
background
lighting_direction
```

These must not change merely because a styling candidate requests a different look.

## 8. Editable dimensions

Only committed styling domains may change:

```text
hair silhouette
hair color
brow grooming
eye makeup
lash appearance
complexion cosmetics
cheek color
contour / highlight
lip color / finish
iris appearance when an authorized lens candidate exists
eyewear
facial hair
face-adjacent accessory
```

A slot not present in the committed Appearance Handoff must not be created by the adapter.

## 9. Color authority

Gate D may supply color anchors with these roles:

```text
applied_reference
brand_swatch
merchant_swatch
```

Gate E preserves the distinction.

Primary anchor precedence:

```text
applied_reference
>
brand_swatch
>
merchant_swatch
```

Within one role, deterministic order is by `anchorId`.

### fidelity state

Each candidate-bound color operation reports:

```text
applied_reference
swatch_reference
semantic_only
none
```

Meaning:

### applied_reference

A governed applied-reference anchor exists.

This is the strongest available rendering reference, but Gate E still does not promise pixel-exact model output.

### swatch_reference

Only brand / merchant source swatches exist.

They may guide color, but must not be represented as proven applied cosmetic appearance.

### semantic_only

Only governed semantic attributes exist, such as:

```text
hueFamily = rose
undertone = neutral_cool
chroma = medium
finish = satin
```

### none

No color authority is available.

## 10. Important product-color rule

The following are never treated as sufficient exact rendering controls:

```text
shade display label
marketing shade name
storefront product title
brand name
category
```

For example:

```text
"Rose Gold"
"21N"
"Steel Blue"
```

remain labels unless separately governed attributes or color anchors exist.

## 11. Color anchor preservation

Gate E does not collapse different anchor roles into one generic RGB.

Conceptual render block:

```text
colorAuthority:
  fidelityState
  primaryAnchor
  alternateAnchors[]
  semanticAttributes
```

This allows a later provider adapter to make an informed rendering decision.

## 12. Semantic controls

Candidate-bound operations may carry governed attributes:

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

Execution-only operations may carry Face Lab criteria even when no concrete candidate is bound.

The adapter must label those values by source.

## 13. Application controls

Execution cues remain separate from catalog facts.

Conceptual block:

```text
application:
  placement[]
  direction[]
  intensity
  notes[]
```

Examples:

```text
upper cheek
outer eye third
soft outward extension
avoid heavy coverage
```

These are placement / technique controls, not Product Facts.

## 14. Conflict and Look Composer context

Gate E may include:

- Look Composer `conflictsResolved`;
- `remainingTradeoffs`;
- route / look identity.

It must not invent a new conflict resolution.

## 15. Render Spec

Conceptual output:

```text
renderSpecVersion
status
routeId
lookId
identityLock[]
operations[]
conflictsResolved[]
remainingTradeoffs[]
providerPayload = null
imageModelInvoked = false
```

Operation:

```text
operationId
slotKey
sourceMode
targetRegions[]
candidateRef?
variantId?
criteria
candidateAttributes
application
colorAuthority
```

## 16. Candidate binding validation

For every supplied binding:

```text
Appearance Slot
+
candidate
+
attributeSnapshot
→ Gate C replay
```

Gate E requires exactly one eligible candidate.

If a supplied binding fails Gate C, the Render Spec fails closed.

Gate E never silently falls back from an invalid supplied candidate to execution-only rendering.

## 17. Unbound slots

A committed slot without a supplied candidate remains valid as `execution_only`.

This is important because Face Lab must be able to visualize:

> the recommended direction

before the real catalog is fully populated.

However the UI must not label such an operation as depicting a specific commercial product.

## 18. Overall palette

`overall_palette` is a constraint operation.

It may harmonize rendered styling elements but must not:

- recolor the background;
- recolor the user's natural skin;
- change clothing unless that clothing is explicitly in scope;
- override a stronger candidate-bound color anchor.

## 19. Model/provider boundary

Gate E outputs a provider-neutral Render Spec.

A later provider adapter may convert it to:

- prompt text;
- edit masks;
- region controls;
- reference-image controls;
- seed / strength parameters;
- provider-specific structured fields.

Provider-specific fields must not enter catalog, variant, or Appearance Slot authority.

## 20. Exactness boundary

Gate E can pass exact numerical color anchors when evidence exists.

It cannot guarantee that a generative image model reproduces them pixel-for-pixel.

Therefore:

```text
governed numerical input
!=
guaranteed rendered output
```

Gate F must measure model fidelity separately.

## 21. Gate E implementation scope

Gate E may implement:

- Render Spec contract;
- slot-to-region mapping;
- identity lock;
- binding validation through Gate C;
- color-anchor precedence;
- semantic attribute projection;
- application cue projection;
- deterministic operation ordering;
- verifier and CI gate.

Gate E must not implement:

- catalog search;
- candidate ranking;
- candidate selection;
- binding persistence;
- hosted DB migration;
- image-model invocation;
- generated image storage;
- user-visible production activation.

## 22. Required invariants

1. only committed Appearance Slots become render operations.
2. supplied bindings must replay successfully through Gate C.
3. invalid supplied bindings fail closed.
4. unbound slots remain execution-only.
5. execution-only operations never claim a specific product.
6. candidate-bound operations preserve candidate identity.
7. color-anchor role is preserved.
8. applied-reference anchors outrank swatches.
9. swatches are not promoted to applied color.
10. shade labels do not create exact colors.
11. identity geometry remains locked.
12. overall palette cannot recolor unrelated regions.
13. provider payload remains null in Gate E.
14. no image model is invoked.
15. no new recommendation authority is created.

## 23. Next gate

Gate F — AI Simulation Adapter / Fidelity Evaluation may:

```text
Render Spec
→ provider-specific image edit request
→ output image
→ identity drift checks
→ color / route adherence evaluation
```

before any production activation.
