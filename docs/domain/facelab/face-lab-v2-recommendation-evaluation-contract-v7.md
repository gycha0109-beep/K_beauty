# Face Lab V2 Recommendation Evaluation Contract v7

> Track: Face Lab 16I / Constraint Responsiveness
> Status: Deterministic paired-constraint gate
> Supersedes: recommendation evaluation contract v6 for current suite semantics
> Authority ceiling: synthetic structured-face evaluation only

## 1. Question

This stage verifies that tightening visible user constraints does not make the selected recommendation route more burdensome.

The paired evaluation holds face and target constant, then changes one constraint at a time.

## 2. Evaluation cohort

The evaluator reuses the frozen target-sweep cohort:

- 8 structured faces
- 12 confirmed target styles per face
- 96 base cases

For each base case, four constraint variants are evaluated:

- daily time: 30 minutes → 5 minutes
- budget: standard → low
- maintenance tolerance: medium → low
- makeup intensity: baseline → light

Total paired comparisons:

```text
96 × 4 = 384
```

## 3. Hard invariants

### Daily time

When daily time is tightened from 30 minutes to 5 minutes:

- an actionable selected route must remain available
- selected route `dailyEffort` must stay equal or become lighter

### Budget

When budget is tightened from standard to low:

- an actionable selected route must remain available
- selected route `costBand` must stay equal or become cheaper

### Maintenance

When maintenance tolerance is tightened from medium to low:

- an actionable selected route must remain available
- selected route `maintenance` must stay equal or become lighter

### Makeup intensity

When makeup intensity is `light`:

- every emitted makeup route action must use `light` strength

## 4. Hard failures

- `E6-constraint-route-loss`
- `E6-constraint-rank-unknown`
- `E6-constraint-regression`
- `E6-makeup-intensity-cap`

## 5. Initial baseline

First paired evaluation result:

- input cases: 96
- paired comparisons: 384
- hard failures: 0
- daily-time route changed: 96 / 96
- low-budget route changed: 96 / 96
- low-maintenance route changed: 96 / 96
- light-makeup actions inspected: 232

This confirms that the current route-selection logic consumes these constraints and does not reverse their intended burden direction in the frozen synthetic cohort.

## 6. Manual execution

Constraint responsiveness only:

```bash
FACE_LAB_EVAL_COHORT=constraint-responsiveness npm run eval:face-lab-v2
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
- constraint responsiveness

## 7. Interpretation boundary

A clean result means tighter user constraints do not produce a heavier selected route within this deterministic test surface.

It does not establish real-user satisfaction, aesthetic correctness, population prevalence, fairness, or production calibration.
