# Face Lab V2 Recommendation Evaluation Contract v5

> Track: Face Lab 16G / Recommendation Lineage Integrity
> Status: Deterministic lineage gate
> Supersedes: recommendation evaluation contract v4 for current suite semantics
> Authority ceiling: synthetic structured-face evaluation only

## 1. Question

This stage verifies that a Face Lab recommendation remains traceable through the canonical chain:

```text
Style Delta priority
→ selected Route action
→ domain execution
→ Look Composer piece
```

It does not judge whether a styling recommendation is aesthetically optimal. It verifies that no recommendation appears without a valid upstream reason and no execution result claims availability without producing user-visible guidance.

## 2. Evaluation cohort

The lineage evaluator reuses the existing designed Coverage cohort:

- cohort version: `face-lab-v2-coverage-cohort-v1`
- cases: 96
- target labels, scope profiles, constraints, and hard exclusions are already varied by the Coverage contract

No new synthetic population is introduced for lineage evaluation.

## 3. Route source lineage

Every selected Route action must map to an allowed Style Delta priority with identical:

- domain
- parameter
- direction
- reason
- expected effect / route explanation
- evidence set

Route constraints are allowed to lower action strength, but never increase it beyond the source Style Delta priority.

Hard failures:

- `E4-route-source-lineage`
- `E4-route-strength-lineage`

## 4. Domain execution lineage

Every selected Route action must resolve to its executable domain:

```text
hair → hair
brow_grooming → grooming
facial_hair → grooming
makeup → makeup
color → color
eyewear → eyewear
accessories → accessories
```

For each selected action:

- execution status must be `available`
- execution evidence must include `style_delta:<parameter>`
- available execution must contain at least one user-visible payload

Hard failures:

- `E4-execution-status-lineage`
- `E4-execution-evidence-lineage`
- `E4-empty-available-execution`

The payload gate is domain-aware. Metadata-only values such as makeup intensity do not count as user-visible execution guidance.

## 5. Look Composer lineage

When Look Composer is available:

- look route id must equal selected route id
- every look piece must reference a domain whose execution is `available`
- look evidence must contain `execution_domain:<domain>`
- each look piece summary must be non-empty

Hard failures:

- `E4-look-route-lineage`
- `E4-look-execution-lineage`
- `E4-look-evidence-lineage`
- `E4-look-empty-piece`

## 6. Initial baseline

First Coverage run after introducing the evaluator:

- input cases: 96
- actionable cases: 94
- selected-route actions: 172
- available execution domains: 130
- Look Composer pieces: 130
- hard failures: 0

Execution-domain coverage:

- hair: 42
- makeup: 23
- eyewear: 23
- accessories: 17
- grooming: 22
- color: 3

This baseline proves broad lineage coverage across all current executable domains. It is not a user-prevalence distribution.

## 7. CI authority

The Face Lab recommendation evaluation verifier hard-fails when lineage failures are greater than zero.

The evaluator is deterministic and contains no LLM Judge.

## 8. Manual execution

Lineage only:

```bash
FACE_LAB_EVAL_COHORT=lineage npm run eval:face-lab-v2
```

Full suite:

```bash
FACE_LAB_EVAL_COHORT=all npm run eval:face-lab-v2
```

The full CLI suite includes locked regression, coverage, adversarial, target responsiveness, axis consumption, and lineage evaluation.

## 9. Interpretation boundary

A clean lineage result means:

- recommendations are attributable to current Style Delta authority
- route constraints do not amplify source strength
- execution output does not become detached from selected route actions
- Look Composer does not invent unsupported execution pieces

It does not establish real-user preference, aesthetic correctness, fairness, or image-analysis calibration.
