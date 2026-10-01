# Face Lab V2 — AI Simulation Adapter / Fidelity Contract v1

> Track: face-research
> Status: Gate F foundation / provider transport allowed, public activation forbidden

## 1. Purpose

Gate E established a provider-neutral Render Spec.

Gate F defines how one validated Render Spec may be translated into one bounded image-edit request while preserving the authority boundaries established by Gates A–E.

Target flow:

```text
original portrait
+ Render Spec
→ deterministic simulation instructions
→ image-edit provider
→ generated preview
→ fidelity state
```

Gate F is a visualization layer. It does not decide what the user should change.

## 2. Provider choice

For the initial OpenAI adapter, use the Image API edit endpoint:

```text
POST /v1/images/edits
```

Default model:

```text
gpt-image-2.5-sunburst
```

The model is selected because the workflow prioritizes precise editing and subject preservation over minimum latency.

The model identifier remains isolated in the server provider adapter so a future provider/model change does not alter Face Lab catalog, slot, candidate, variant, or Render Spec authority.

## 3. Authority chain

Gate F accepts only:

```text
Render Spec v1
```

The authoritative chain remains:

```text
Current Face / Target
→ Route
→ Appearance Slot
→ candidate capability proof
→ candidate attribute match
→ variant / shade authority
→ Render Spec
→ simulation
```

The image model must not create a new recommendation, select a product, choose an uncommitted styling domain, or reinterpret the target.

## 4. No arbitrary prompt authority

A client-supplied free-form image prompt is forbidden.

Simulation instructions must be compiled deterministically from the Render Spec.

The provider receives:

- an internally compiled instruction;
- the original canonicalized portrait;
- bounded provider options.

It must not receive arbitrary prompt text from the browser.

## 5. Edit-only identity model

The supplied portrait is the identity source.

The instruction must state that the result is an edit of the same person and must preserve the Render Spec identity lock.

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

These are preserved unless a future separately versioned contract explicitly changes the lock.

## 6. Allowed edits

Only Render Spec operations may be edited.

Examples:

```text
hair_shape
hair_color
brow_definition
eye_color
eye_definition
lash_definition
complexion_even
complexion_finish
cheek_color
face_shadow
face_highlight
lip_color
lip_finish
iris_appearance
facial_frame
facial_hair_shape
face_accessory
overall_palette
```

An absent slot is not an implied edit.

## 7. Candidate-bound vs execution-only

### candidate_bound

The instruction may include governed candidate attributes and color anchors.

It must preserve:

- candidate reference;
- variant identity where present;
- semantic shade attributes;
- color-anchor role.

### execution_only

The instruction may visualize the selected Face Lab direction using only Render Spec criteria and execution cues.

The result must not be described as a preview of a specific commercial product.

## 8. Color fidelity

A numerical or semantic color input is an instruction to the image model, not proof that the output image is exact.

Input fidelity states remain:

```text
applied_reference
swatch_reference
semantic_only
none
```

Provider instructions must preserve this distinction.

### applied_reference

Use the governed applied-reference anchor as the strongest color reference.

### swatch_reference

Use the source swatch as an approximate source-color reference only.

Do not tell the model that the swatch proves the actual appearance on skin, lips, eyelids, hair, or other surfaces.

### semantic_only

Use semantic properties such as hue family, undertone, depth, chroma, opacity, finish, gloss, and shimmer.

### none

No exact color claim is made.

## 9. Numerical color serialization

Supported color anchors from Gate D may be serialized as:

```text
sRGB HEX: #RRGGBB
CIE Lab: L=<n>, a=<n>, b=<n>
```

The instruction must retain the anchor role.

Example:

```text
Applied-reference color: CIE Lab L=51.2, a=27.4, b=6.3.
```

Not:

```text
The product is exactly this RGB on the user.
```

## 10. Provider request contract

Initial provider request:

```text
model = gpt-image-2.5-sunburst
image = original canonicalized portrait
prompt = deterministic compiled simulation instruction
quality = high
size = auto
output_format = png
n = 1
```

No streaming and no partial images in v1.

## 11. Provider transport rules

The OpenAI image-edit runtime must:

1. be server-only;
2. require an API key;
3. accept only JPEG / PNG / WEBP input;
4. accept a bounded image buffer;
5. use a bounded timeout;
6. reject redirects;
7. bound response bytes;
8. validate the provider JSON response;
9. validate returned base64 before exposing bytes;
10. emit provider runtime telemetry without logging the source image, base64 output, or full prompt.

No CI verifier may make a live provider call.

## 12. Output

Provider-neutral simulation result:

```text
simulationVersion
status
provider
model
renderSpecVersion
routeId
lookId
mimeType
imageBytes
providerRequestId?
fidelity
telemetry
```

The test API may encode image bytes as base64 for transient browser display.

Production persistence is not authorized by this contract.

## 13. Fidelity state

Initial output fidelity is explicitly:

```text
not_evaluated
```

Required checks:

```text
identity_preservation
route_adherence
color_fidelity
edit_scope
```

A successful provider response does not mean those checks passed.

## 14. Future fidelity states

Reserved states:

```text
not_evaluated
pass
fail_identity
fail_route_adherence
fail_color_fidelity
fail_edit_scope
manual_review_required
```

Gate F v1 only emits `not_evaluated`.

A later evaluation layer must establish evidence before upgrading the state.

## 15. UAT boundary

The first browser integration must be test-only.

It may display a transient preview but must not:

- persist the generated portrait;
- consume Production Face Lab quota;
- appear in paid/Production Full Report;
- claim a commercial product match when the Render Spec operation is execution-only.

The test route must have its own bounded cost-control quota before provider activation.

## 16. Server rebuild requirement

A browser must not be allowed to submit arbitrary Render Spec or provider prompt as authoritative input.

The test route should rebuild the Face Lab canonical result and Render Spec server-side from bounded Face Lab inputs, then compile simulation instructions on the server.

Any future product-bound simulation must obtain candidate bindings from server-side governed catalog authority rather than arbitrary client candidate payloads.

## 17. Logging and privacy

Do not log:

- original image bytes;
- image base64;
- full generated image;
- full compiled simulation prompt;
- raw personal identity data.

Provider logs may contain only bounded operational metadata such as:

- stage;
- provider;
- model;
- duration;
- HTTP status;
- error category;
- response byte count;
- route operation count.

## 18. Failure behavior

Provider or contract failures fail closed.

The UI may show that simulation is unavailable while preserving the deterministic Face Lab result.

A simulation failure must not invalidate the underlying Face Lab recommendation.

If a request consumed a test-only quota bucket and fails before a valid preview is returned, the test-route guard may refund that simulation quota according to its own policy.

## 19. Gate F foundation implementation scope

This foundation may implement:

- deterministic Render Spec → simulation-instruction compiler;
- OpenAI image-edit transport;
- strict provider response validation;
- simulation result envelope;
- explicit `not_evaluated` fidelity metadata;
- mock-only verifier;
- CI gate.

The foundation does not yet require public API-route activation.

## 20. Public / Production non-goals

Gate F foundation must not:

- enable Production Full Report simulation;
- create a public arbitrary image-edit endpoint;
- accept arbitrary prompt text;
- persist generated images;
- select a commercial candidate;
- change catalog / Product Fact authority;
- claim pixel-exact product reproduction;
- claim identity fidelity without evaluation.

## 21. Required invariants

1. Render Spec is the only styling authority.
2. arbitrary browser prompt text is forbidden.
3. original portrait is the identity source.
4. identity lock is explicit.
5. absent slots cannot become edits.
6. candidate identity is preserved in candidate-bound instructions.
7. color-anchor role is preserved.
8. swatches are not described as proven applied color.
9. provider model configuration remains isolated.
10. provider response is bounded and validated.
11. provider success does not imply fidelity pass.
12. fidelity begins as `not_evaluated`.
13. no image persistence occurs.
14. no Production activation occurs.
15. no live provider call occurs in CI.

## 22. Next gate

Gate F-UAT may add a test-only endpoint and Face Lab test-page control after:

- simulation-specific quota / idempotency protection is in place;
- server-side canonical rebuild is verified;
- provider transport verifier is green.

After UAT, a separate fidelity-evaluation gate must decide whether the feature is fit for Production.
