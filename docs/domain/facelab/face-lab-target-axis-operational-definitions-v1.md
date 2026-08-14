# Face Lab Target-Axis Operational Definitions v1

## Purpose

This document freezes an evaluation-only visible-definition contract for the 11 target axes used by the Face Lab Archetype stress campaign. It makes future blind Human cue review and observer-prototype comparison possible without treating generation intent as visible truth.

The contract is not a production observation prompt, population norm, beauty standard, biometric system, score threshold, or calibration result.

## Authority

- Schema: `face-lab-target-axis-operational-definition-contract-v1`
- Contract: `face-lab-target-axis-operational-definitions-20260814-v1`
- Status: `evaluation_ready_not_production_active`
- Contract digest: `8e630605ece0629da6a51e30829297688c27f10a3a92be6a3c8e3413f546bb46`
- Freeze digest: `cb7d3a0d60ce398dc9c76ee1aa4ff88ee94b0e001fa378f173367712ea279029`
- D2C matrix: `d6ca9fb61d7450d0d3dd0602d26c6473363e956e3081ef95b97b2ce67c3c51fe`
- D2C proposal: `4fb8cd3278650a4472476337e4c1772ebbb47f89a6e951ed190568e87c09cfa6` (`PROPOSAL_ONLY` historically)
- D2C audit: `e52fb4364e1a83f2b15f3dd6275cf5534a7699370ffe8452532acb709b7a9dd9`

The proposal was independently reviewed. This document does not promote the old proposal wholesale or rewrite D1/D2C findings.

## Why Token Parity Was Insufficient

D2C found exact generation/observation token parity for 11/11 target axes, but shared operational definitions for 0/11. The production observation prompt listed enum values without axis-specific references or neighboring-category boundaries. Equal tokens therefore did not establish equal semantics.

`Generation intent != generated visible fact != Vision observation != Human cue judgment != Archetype score != Human consensus != calibration truth != production activation.`

## Contract Status

The machine-readable contract lives in `packages/face-contracts/src/archetype-human-evaluation/target-axis-operational-definitions.js`. It is exported from the evaluation namespace for future packet builders and verifiers. Current production observation, generation, and scoring paths do not import or consume it.

No numerical boundary, demographic norm, or production decision threshold is activated.

## Common Reviewer Rules

- Use visible image evidence only.
- Use the named within-face reference, never a population average or image-frame proportion unless explicitly stated.
- Choose one enum token only when the corresponding evidence and neighboring contrast are supported.
- Do not infer generation success, intended target, identity, personality, health, attractiveness, or a whole Archetype.
- Evidence tags describe visible relationships, never target or scorer outcomes.
- A forced category is prohibited.

## Uncertain vs Not Assessable

`uncertain` means the feature is visible but neighboring categories cannot be distinguished reliably.

`not_assessable` means image evidence is insufficient because of pose, occlusion, quality, expression, lighting, makeup, perspective, or an axis-specific limitation.

`mixed` is a visible heterogeneous pattern for axes that support it. It is not a synonym for either response.

## Axis Definitions

### `observations.outline.faceShape`

- Enum: `oval | round | square | oblong | heart | diamond | triangle | mixed`
- Observable target: frontal facial perimeter interpreted through face length, upper/cheek/lower widths, taper, cheek prominence, and lower-contour geometry.
- Reference: the visible face perimeter and within-face width relationships, not the image frame or hairstyle.
- Neighboring contrast: elongated/tapered versus similarly broad, curved versus cornered, upper-wide versus cheek-wide versus lower-wide patterns.
- Ambiguity: `mixed` requires visible conflicting constituent patterns; insufficient or borderline evidence is `uncertain`.
- Image limitations: hair, pose, perspective, crop, expression.
- Disposition/readiness: `RETAIN_AS_COMPOSITE_WITH_CONSTITUENT_RULES`; `READY_FOR_BLIND_HUMAN_CUE_AUDIT`.

### `observations.outline.jawlineAngularity`

- Enum: `soft | moderate | angular`
- Observable target: curvature and direction changes along the lower-face perimeter and chin transition.
- Reference: frontal lower-face silhouette under level pose and even illumination.
- Neighboring contrast: gradual curvature, localized but subdued direction change, and clearly dominant corner.
- Ambiguity: shadow edges must not substitute for geometric corners.
- Image limitations: lighting, facial hair, hair occlusion, pose, retouching.
- Disposition/readiness: `RETAIN_WITH_OPERATIONAL_DEFINITION`; `READY_FOR_BLIND_HUMAN_CUE_AUDIT`.

### `observations.vertical.faceLengthBalance`

- Enum: `short | balanced | long`
- Observable target: visible face height relative to the same face's broad cheek region.
- Reference: within-face vertical extent and cheek width; image framing is excluded.
- Neighboring contrast: vertical extent subordinate, neither dimension dominant, or vertical extent prominent.
- Ambiguity: partial upper-boundary visibility may be `uncertain`; absent upper boundary or chin makes the field `not_assessable`.
- Image limitations: hairline/chin visibility, pitch, perspective, cropping.
- Disposition/readiness: `RETAIN_WITH_OPERATIONAL_DEFINITION`; `READY_FOR_BLIND_HUMAN_CUE_AUDIT`.

### `observations.eyes.eyeDirection`

- Enum: `upturned | level | downturned | mixed`
- Observable target: outer-versus-inner eye-corner vertical relation for each eye.
- Reference: each eye under frontal, level, neutral-expression capture.
- Neighboring contrast: outer corner visibly higher, no clear displacement, or visibly lower; `mixed` requires bilateral disagreement.
- Ambiguity: eyebrow direction is not deciding evidence.
- Image limitations: head roll/yaw, expression, eyeliner, occlusion.
- Disposition/readiness: `RETAIN_WITH_OPERATIONAL_DEFINITION`; `READY_FOR_BLIND_HUMAN_CUE_AUDIT`.

### `observations.eyes.eyeLength`

- Enum: `short | medium | long`
- Observable target: horizontal eye-opening span, explicitly separate from vertical aperture.
- Reference: same-face width context and neighboring central-feature scale; no single validated reference dominates yet.
- Neighboring contrast: clearly compact, neither compact nor prominent, or clearly prominent horizontal span.
- Ambiguity: disagreements among plausible same-face references remain `uncertain`.
- Image limitations: yaw, perspective, eyeliner, occlusion, sharpness.
- Disposition/readiness: `RETAIN_WITH_OPERATIONAL_DEFINITION`; `NOT_READY_REQUIRES_VALIDATION`.

### `observations.eyes.eyeOpenness`

- Enum: `narrow | medium | wide`
- Observable target: vertical eyelid aperture relative to the same eye's horizontal span, with cautious iris/sclera evidence.
- Reference: each eye under neutral expression.
- Neighboring contrast: clearly compressed, intermediate, or clearly expanded aperture.
- Ambiguity: transient expression or eyelid state must be separated from stable visible structure.
- Image limitations: expression, blink, yaw, eyeliner, sharpness.
- Disposition/readiness: `RETAIN_WITH_OPERATIONAL_DEFINITION`; `READY_FOR_BLIND_HUMAN_CUE_AUDIT`.

### `observations.featureLayout.featureScale`

- Enum: `small | medium | large | mixed`
- Observable target: eyes, brows, nose, and lips assessed separately relative to the same face.
- Reference: face perimeter; cheekbones and jawline are excluded from this evaluation aggregate.
- Neighboring contrast: most constituents compact, intermediate, or prominent; `mixed` requires heterogeneous constituent categories.
- Ambiguity: too few reliable constituents or borderline evidence is `uncertain`, not `mixed`.
- Image limitations: perspective, expression, makeup, occlusion, crop.
- Disposition/readiness: `RETAIN_AS_COMPOSITE_WITH_CONSTITUENT_RULES`; `READY_FOR_BLIND_HUMAN_CUE_AUDIT`.

### `observations.featureLayout.featureConcentration`

- Enum: `spread | balanced | centered`
- Observable target: spatial distribution of eyes, brows, nose, and lips relative to the visible facial center and perimeter.
- Reference: same-face center/perimeter under frontal level pose; feature size is excluded as the deciding signal.
- Neighboring contrast: broad distribution, neither broad nor clustered, or center clustering.
- Ambiguity: unstable face center or conflicting feature positions is `uncertain`.
- Image limitations: yaw, perspective, crop, expression, occlusion.
- Disposition/readiness: `RETAIN_AS_COMPOSITE_WITH_CONSTITUENT_RULES`; `READY_FOR_BLIND_HUMAN_CUE_AUDIT`.

### `observations.visualLanguage.straightCurveBalance`

- Enum: `curved | balanced | straight`
- Observable target: curve/straight geometry across brows, eye openings, nose edges, jawline, and lip contour.
- Reference: the frozen facial-structure set; hair, clothing, background, and makeup graphics are excluded.
- Neighboring contrast: curved predominance, supported mixture without predominance, or straight predominance.
- Ambiguity: `balanced` requires visible evidence of both families; inability to judge is `uncertain`.
- Image limitations: makeup, expression, pose, occlusion, retouching.
- Disposition/readiness: `RETAIN_AS_COMPOSITE_WITH_CONSTITUENT_RULES`; `READY_FOR_BLIND_HUMAN_CUE_AUDIT`.

### `observations.visualLanguage.contourDefinition`

- Enum: `soft | moderate | defined`
- Observable target: visibility and continuity of facial perimeter, jawline boundary, and cheek transition after separating structural evidence from photographic edge enhancement.
- Reference: named boundaries under even lighting and stable sharpness.
- Neighboring contrast: gradual transition, localized delineation, or clear delineation across multiple regions.
- Ambiguity: inseparable structural and photographic edge evidence is `uncertain`.
- Image limitations: lighting, contrast, sharpness, editing, makeup.
- Disposition/readiness: `RETAIN_AS_COMPOSITE_WITH_CONSTITUENT_RULES`; `NOT_READY_REQUIRES_VALIDATION`.

### `observations.visualLanguage.featureContrast`

- Enum: `low | medium | high` retained for historical compatibility.
- Observable target: unresolved because the historical token may conflate tonal/color contrast, geometric scale contrast, and feature-versus-face salience.
- Reference: none is frozen for the aggregate; each future component needs its own feature set and within-image reference.
- Neighboring contrast: intentionally not defined for direct use.
- Ambiguity: all new direct judgments are `not_assessable` until decomposition is frozen.
- Image limitations: lighting, white balance, makeup, exposure, editing, feature scale.
- Disposition/readiness: `DECOMPOSITION_REQUIRED_BEFORE_DIRECT_USE`; `NOT_READY_REQUIRES_DECOMPOSITION`.

## Composite Axis Decisions

`faceShape`, `featureScale`, `featureConcentration`, `straightCurveBalance`, and `contourDefinition` are retained only with explicit constituent rules. `featureContrast` is not directly usable and must be decomposed. The task removes no historical field and creates no production formula.

## Historical Result Compatibility

Historical W1/W1M observations used `face-lab-observation-prompt-v1-label-only`. The new contract applies prospectively. D1/D2C and the historical 0/14 intended-cue recovery result are not reinterpreted as though the observer had seen these definitions.

## Generation Parity

Generation tokens remain exact, but generation operational parity is `UNVALIDATED` for every axis. Similar adjectives in compiled prompts are not proof that the compiler implements these visible rules.

## Observation Parity

The current production observer remains `face-lab-observation-prompt-v1` and consumes none of this contract. `observerPrototypeInstruction` is future evaluation input only.

## Reviewer-Safe Projection

The pure `projectTargetAxisDefinitionsForReviewer` projection exposes definitions, response options, evidence tags, and readiness. It excludes generation metadata, historical results, target metadata, Vision results, rubric dependency, and scorer weights. Projection determinism and leakage guards are verifier-enforced.

## Human Audit Readiness

Eight axes are ready for a blind Human cue audit packet. `eyeLength` and `contourDefinition` require reliability validation. `featureContrast` requires decomposition. Readiness means instructions are usable for an evaluation protocol; it does not mean Human validity or production calibration is established.

Future reviewers must not see generation condition/spec/prompt, intended cue, target metadata, scorer output, prior Vision output, historical diagnostics, or semantic filenames. The current operator and this conversation are not independent blind evidence.

## What This Contract Does Not Prove

- that generated images contain requested cues;
- that the current Vision observer is wrong or fixed;
- that generation semantics match the contract;
- that Human reviewers agree;
- that the current rubric, weights, or taxonomy are calibrated;
- that production activation is allowed.

## W2 Status

`W2_REMAINS_LOCKED`.

## Next Gate

After final review and merge of this contract, the next intended gate is `FACE-EVAL-CX1G-D2D-P`: independent blind Human cue audit protocol and packet freeze. Human execution remains separately authorized under `FACE-EVAL-CX1G-D2D-X`.
