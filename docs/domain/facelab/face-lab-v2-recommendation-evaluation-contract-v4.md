# Face Lab V2 Recommendation Evaluation Contract v4

> Track: Face Lab 16F / Style Axis Consumption
> Status: Deterministic axis-consumption gate
> Supersedes: recommendation evaluation contract v3 for current suite semantics
> Authority ceiling: synthetic structured-face evaluation only

## 1. Question

Every style axis advertised by the current target-style model must be consumed by at least one executable recommendation path when that axis is isolated and the relevant styling domains are available.

Current axes:

- softSharp
- naturalPolished
- playfulMature
- minimalStatement
- warmCool
- classicTrendy

## 2. Isolation method

The evaluator holds a valid structured Current Face Profile and all visible execution domains available.

For each axis:

- all other axes are fixed at 0.5
- low probe = 0.15
- high probe = 0.85
- no hard exclusions
- moderate change tolerance
- medium makeup intensity
- 30 minute daily time
- standard budget
- medium maintenance

The evaluator calls Style Delta directly and inspects active priorities.

## 3. Hard gate

For both low and high probes, at least one executable priority must preserve:

```text
evidence = target_axis:<axis>
```

A style axis that only creates a hidden or non-executable domain is treated as unconsumed and fails CI.

## 4. First defect found

The first v1 evaluator run found exactly two failures:

```text
classicTrendy low  → no executable priority
classicTrendy high → no executable priority
```

Cause:

```text
classicTrendy
→ face_adjacent_style:trendSignal
→ face_adjacent_style is not a current execution domain
→ action filtered before canonical Style Delta output
```

## 5. Remediation

`classicTrendy` now maps to the current visible `accessories` domain using the `trendSignal` parameter.

High/trendy direction:

- selectively use one face-adjacent accessory with a current trend signal

Low/classic direction:

- prefer restrained, durable face-adjacent accessory choices over strongly trend-dependent details

This preserves user scope authority: if accessories are not requested, the action may still be blocked by scope.

## 6. Version changes

- Style Delta: v2 → v3
- Accessories execution engine: v2 → v3
- Recommendation evaluation contract: v3 → v4
- Recommendation evaluation harness: v3 → v4

## 7. Evaluation result after remediation

Required current invariant:

```text
fullyConsumedAxisCount = 6
styleAxisCount = 6
hardFailureCount = 0
```

Target-sweep diversity remains diagnostic rather than a universal quality score.

## 8. Manual execution

```bash
FACE_LAB_EVAL_COHORT=axis-consumption npm run eval:face-lab-v2
```

The `all` suite includes this evaluator.
