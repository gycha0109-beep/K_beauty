# Face Lab V2 Recommendation Evaluation Contract v3

> Track: Face Lab 16E / Target Responsiveness
> Status: Deterministic target-sweep evaluation
> Supersedes: recommendation evaluation contract v2 for current suite semantics
> Authority ceiling: synthetic structured-face evaluation only

## 1. Question

This stage asks:

> When the same face and the same styling constraints are held fixed, does changing only the user-confirmed target style produce meaningfully different recommendation state?

The evaluator is designed to detect recommendation collapse. It does not define a single objectively correct style for a face.

## 2. Target-sweep cohort

The target-sweep cohort reuses one structured face observation across every current target-style registry key.

Initial contract:

- cohort version: `face-lab-v2-target-sweep-cohort-v1`
- deterministic seed: `face-lab-v2-target-sweep-v1`
- face groups: 8
- target keys per face: 12
- total cases: 96

All non-target conditions are held fixed:

- presentation preference: neutral examples
- styling scope: all current executable domains
- change tolerance: moderate
- makeup intensity: medium
- daily time: 30 minutes
- budget: standard
- maintenance: medium
- no hard exclusions

This isolates target responsiveness from scope and lifestyle variation.

## 3. Signatures

### Style-delta signature

Built from all allowed style-delta priorities:

```text
domain
+ parameter
+ direction
+ strength
+ reason
```

The signature measures recommendation intent before route selection.

### Selected-route signature

Built from:

```text
selected route strategy
+ selected route action domain
+ parameter
+ direction
+ strength
```

The selected-route signature is diagnostic because different target deltas can legitimately converge on the same practical route.

## 4. Hard failure

### E3-target-responsiveness-collapse

A face group fails when all confirmed target styles collapse to one identical style-delta signature.

This indicates that the target input is functionally ignored for that face fixture.

The initial hard gate is intentionally narrow:

```text
12 confirmed targets
→ exactly one style-delta signature
→ HARD FAIL
```

## 5. Contrast-pair diagnostics

The evaluator also compares six intentionally distant target pairs:

- natural ↔ sophisticated
- soft ↔ chic
- cute_playful ↔ mature_calm
- minimal ↔ statement_glam
- classic ↔ trendy
- clear_soft ↔ defined

A pair collision means both targets produced the same style-delta signature for the same face.

Pair collisions are diagnostic in v3, not hard failures. Their baseline must be observed before promotion to a blocking threshold.

## 6. Reported metrics

Per face:

- target count
- unique style-delta signature count
- unique selected-route signature count
- no-route count
- contrast-pair collisions

Aggregate:

- collapsed face count
- contrast-pair comparison count
- contrast-pair collision count
- average unique style-delta signatures per face
- average unique selected-route signatures per face

## 7. Interpretation

High uniqueness is not automatically better. The goal is not to force every target to produce a completely different routine.

The evaluator only establishes whether target authority is being consumed and how strongly the engine responds.

Further quality judgments require:

- target-pair review
- action/evidence linkage analysis
- Human calibration
- real-photo end-to-end evaluation

## 8. Manual execution

```bash
FACE_LAB_EVAL_COHORT=target-sweep npm run eval:face-lab-v2
```

The `all` suite includes locked, coverage, adversarial, and target-sweep evaluation.
