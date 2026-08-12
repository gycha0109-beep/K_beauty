# FACE LAB MASTER SPEC

> Status: current product/architecture authority
> Scope: Bejewely Face Lab
> Current implementation status is intentionally excluded from this document. See `FACE_LAB_CURRENT_STATE.md`.
> Evaluation methodology is intentionally separated. See `FACE_LAB_EVALUATION_STRATEGY.md`.

## 1. Purpose

Face Lab is not a simple animal-look classifier, appearance score, physiognomy service, or one-shot LLM styling response.

Face Lab is a photo-based beauty and styling guide that:

1. observes visible facial structure and photo quality,
2. translates supported structural patterns into an intuitive archetype language,
3. explains the user's base style identity,
4. offers a Core strategy that preserves the base impression,
5. offers an Alternative strategy that meaningfully changes the impression,
6. derives color, hair, makeup, and face-adjacent styling directions from the same evidence,
7. composes those domain outputs into coherent Core and Alternative looks,
8. projects one canonical result into Free and Premium experiences.

The representative archetype is the entry point and user language. It is not the final purpose of Face Lab.

## 2. Canonical product flow

```text
Photo
→ Eligibility / Quality
→ FaceLabObservationAnalysis
→ Archetype scoring / hold
→ Style Identity
→ Core / Alternative Strategy
→ Color / Hair / Makeup / Face Style
→ Look Composer
→ Canonical Face Lab Result
→ Free projection / Premium projection / Storage
```

Evaluation and calibration run beside this flow; they do not replace the production decision layers.

## 3. Responsibility boundaries

### 3.1 Vision / multimodal model

Vision is an observation layer only.

It may produce evidence-backed visible observations such as:

- face shape and width relationships,
- facial vertical balance,
- jaw and cheekbone structure,
- eye direction, length, and openness,
- feature scale and concentration,
- straight/curve balance,
- contour definition and feature contrast,
- photo quality, pose, occlusion, lighting, white balance, and color-analysis suitability.

Vision must not directly produce or decide:

- final archetype,
- archetype affinity/similarity scores,
- personality, ability, health, fortune, physiognomy, ethnicity, or social traits,
- final hair, makeup, palette, clothing, or complete look recommendations,
- arbitrary user-facing styling copy that bypasses the decision engine.

### 3.2 Archetype engine

Archetype judgment is deterministic and traceable.

```text
observations
→ indicator matching
→ positive / negative contribution
→ evidence coverage
→ raw score
→ ranking
→ ambiguity / contradiction checks
→ decision or hold
```

The engine must preserve contribution provenance and fail closed when taxonomy, evidence, score, margin, or calibration requirements are not satisfied.

Archetype similarity is a normalized feature similarity within the supported taxonomy. It is not a probability, biological classification, attractiveness score, or objective truth about the person.

### 3.3 Style Identity and strategies

Archetype alone must never map directly to fixed style recommendations.

Style Identity derives from the broader observation pattern and archetype evidence. Core and Alternative strategies are separate decision objects:

- **Core**: preserve and strengthen the user's base visual language.
- **Alternative**: change the visual direction by a meaningful, evidence-compatible amount.

The Alternative strategy must not be a cosmetic rewrite of Core.

### 3.4 Domain styling engines

Color, Hair, Makeup, and Face Style are independent domains with their own evidence, status, confidence, and failure handling.

They consume canonical observations plus the selected strategy. They do not consume an animal label as a single lookup key.

Examples of prohibited fixed mappings:

- cat → always strong eyeliner,
- puppy → always coral,
- wolf → always slicked-back hair,
- any archetype → one universal neckline or accessory rule.

### 3.5 Look Composer

The Look Composer combines domain outputs into complete Core and Alternative looks.

It must:

- detect contradictions between color, hair, makeup, and face-adjacent styling,
- preserve strategy coherence,
- handle unavailable domains without fabricating replacements,
- keep Core and Alternative meaningfully distinct,
- avoid overstated names or unsupported claims.

## 4. Canonical result and projection

Free and Premium must read the same canonical Face Lab result.

```text
one analysis
→ one canonical result
   ├─ Free projection
   ├─ Premium projection
   └─ allowed storage snapshot
```

Free and Premium must not independently re-analyze the photo or produce different archetypes, strategies, or styling conclusions for the same canonical run.

Display depth may differ. Analysis authority may not.

## 5. Evidence and status contract

Evidence-free `available` is prohibited.

At the analysis and domain level, the system must distinguish at least:

- `available`
- `partial` where the owning contract supports it
- `insufficient_evidence`
- `unavailable`

Evidence-bearing fields must preserve the contract's equivalent of:

```text
status
source
confidence
evidence
unavailableReason
value
```

Missing evidence must not be repaired with default, mock, placeholder, fallback, or generic styling values.

## 6. Eligibility and failure policy

A valid product result requires a supported real-person facial image under the current eligibility contract.

The system must distinguish:

- image/content ineligibility,
- insufficient visual evidence,
- provider or system failure,
- downstream decision hold.

These states must not collapse into a normal-looking Face Lab result.

Legacy snapshots may be read under their historical contract, but legacy fallback/raw payloads must not be silently upgraded into current canonical `available` results.

## 7. Privacy and persistence

General Face Lab analysis and evaluation/research use are separate purposes.

Default service behavior:

```text
source image
→ temporary request-time analysis
→ structured result
→ source image not persisted
```

A canonical result or saved report must not contain raw face images, base64 image payloads, face crops, or raw provider responses unless a later explicit contract changes this boundary.

Evaluation-dataset use requires a separate opt-in consent and governance path. Service consent must not be interpreted as research/evaluation consent.

## 8. Prohibited product behavior

Face Lab must not:

- become an attractiveness score or ranking service,
- infer personality, health, ability, fortune, physiognomy, ethnicity, or sensitive traits from appearance,
- claim a definitive personal-color season from one uncontrolled photo,
- infer full-body type or full-body styling from a face-only image,
- expose unsupported celebrity-identity or identity-similarity claims,
- silently convert missing evidence into a normal recommendation,
- let model-generated prose become policy,
- let generation intent become ground truth,
- reuse one fixed Core/Alternative output for all users,
- create separate Free and Premium analyses for the same run.

## 9. Taxonomy and calibration authority

Taxonomy keys, rubric weights, minimum evidence coverage, minimum top score, top-margin threshold, contradiction threshold, display cutoff, and production activation are calibration-dependent.

They are not immutable product philosophy.

A taxonomy or weight table may exist in `proposed`, `rubric_ready`, `pilot`, or equivalent non-production lifecycle states without becoming user-facing authority.

Production archetype decisions require explicit calibration and activation gates.

## 10. Evaluation relationship

Generation and evaluation are separate responsibilities.

Synthetic data may be used for:

- technical fixtures,
- controlled cue tests,
- stress testing,
- ambiguity/hold testing,
- observation failure discovery,
- exploratory rubric evaluation.

Synthetic generation intent is never a truth label by itself. Final production calibration must not rely solely on AI-generated labels or AI-only circular evaluation.

Human-annotated and consensus-based evaluation evidence, including ambiguity, is required for claims about real-world archetype performance. See `FACE_LAB_EVALUATION_STRATEGY.md`.

## 11. Contract layering

This document is the Face Lab product and architecture authority. Detailed behavior remains owned by current component contracts and code.

Current component examples include:

- Unified Vision / Face Lab observation contract,
- archetype scoring contract and registry,
- archetype styling contract,
- synthetic evaluation contracts.

When this MASTER SPEC conflicts with a historical dated document, this MASTER SPEC wins for product direction. When implementation status is disputed, current `main` code and `FACE_LAB_CURRENT_STATE.md` win over historical status snapshots.

## 12. Historical source consolidation

This specification consolidates the still-valid product principles from the July Face Lab design materials, especially:

- `face lab은 무엇인가 0716.txt`
- `Face_Lab_구현_명세_0716_수정본.md`
- `face_lab_진행상황_0727.txt`
- `bejewely-face-analyze-pipeline-07-30.txt`

Those dated materials remain useful historical evidence, but their implementation-status statements are not current authority.
