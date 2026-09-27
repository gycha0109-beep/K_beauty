# Face Lab V2 Recommendation Evaluation Contract v6

> Track: Face Lab 16H / Parameter Translation Completeness
> Status: Deterministic parameter-translation gate
> Supersedes: recommendation evaluation contract v5 for current suite semantics
> Authority ceiling: synthetic structured-face evaluation only

## 1. Question

This stage verifies that every action variant the current Style Delta logic can actually emit is translatable by its target domain engine into user-visible execution guidance.

The evaluated chain is:

```text
Style Delta action variant
→ synthetic single-action Route
→ domain execution engine
→ user-visible payload + evidence
```

## 2. Action discovery

The evaluator does not maintain a hand-written copy of the current parameter registry.

It derives action variants by executing current Style Delta logic with:

- every advertised target-style axis at a low probe
- every advertised target-style axis at a high probe
- upturned-eye face modifier probe
- already-defined contour modifier probe
- already-curved line-balance modifier probe
- already-high feature-contrast modifier probe

Action identity is:

```text
domain + parameter + direction
```

This captures modifier-generated variants such as `eyeDefinition` and `maintain` directions.

## 3. Hard gate

Each discovered action variant is executed in isolation through its current domain engine.

Required invariants:

- a matching domain engine exists
- execution status is `available`
- execution evidence includes `style_delta:<parameter>`
- execution contains at least one user-visible payload

Metadata-only values do not count as user-visible payload.

Hard failures:

- `E5-parameter-execution-missing`
- `E5-parameter-status`
- `E5-parameter-evidence`
- `E5-parameter-empty-translation`

## 4. Initial baseline

First full probe result:

- action variants: 33
- unique parameters: 27
- translated action variants: 33
- hard failures: 0

Domain action variants:

- accessories: 5
- brow_grooming: 3
- color: 2
- eyewear: 5
- facial_hair: 3
- hair: 8
- makeup: 7

This is a translation-surface baseline, not a user-prevalence distribution.

## 5. Relationship to lineage evaluation

Lineage v5 evaluates actions that were selected by real generated Routes in the Coverage cohort.

Parameter Translation v6 evaluates the broader Style Delta action surface, including variants that may not be selected by that cohort's default routes.

Both gates are required:

```text
lineage clean
AND
parameter translation clean
```

## 6. Manual execution

Parameter translation only:

```bash
FACE_LAB_EVAL_COHORT=parameter-translation npm run eval:face-lab-v2
```

Full suite:

```bash
FACE_LAB_EVAL_COHORT=all npm run eval:face-lab-v2
```

The full CLI suite includes:

- locked regression
- coverage
- adversarial
- target responsiveness
- axis consumption
- recommendation lineage
- parameter translation

## 7. Interpretation boundary

A clean result means current Style Delta actions do not terminate in a domain-engine dead end.

It does not establish:

- aesthetic correctness
- real-user preference
- population representativeness
- image-analysis accuracy
- fairness
- production calibration
