# Face Lab V2 Recommendation Evaluation Contract v8

> Track: Face Lab 16J / Deterministic Property Fuzz
> Status: Property fuzz and minimized counterexample gate
> Supersedes: recommendation evaluation contract v7 for current suite semantics
> Authority ceiling: synthetic structured-face evaluation only

## 1. Question

Fixed cohorts prove known cases. This stage asks whether the same Face Lab E1/E2 contracts survive a broader deterministic input search outside those frozen cohorts.

The fuzz evaluator must use the exact same case-level recommendation authority as locked, coverage, and adversarial evaluation. It must not maintain a second set of contract rules.

## 2. Search surface

Official CI uses four deterministic seeds:

- `face-lab-v2-fuzz-a`
- `face-lab-v2-fuzz-b`
- `face-lab-v2-fuzz-c`
- `face-lab-v2-fuzz-d`

Each seed generates 128 valid structured-face cases through the existing Face Lab evaluation cohort generator.

Total official fuzz cases:

```text
4 × 128 = 512
```

Each case is evaluated by the shared case-level authority:

- E1 hard recommendation contracts
- FL-MR-001 presentation semantic invariance
- FL-MR-002 target-edit current-face invariance
- FL-MR-003 hard-exclusion monotonicity
- FL-MR-004 minimal-change cap
- no-route classification and unexpected route-gap detection

## 3. Deterministic replay

Each fuzz seed records its generated cohort hash.

The verifier independently regenerates every official seed and requires an exact hash match within the current generator contract.

The frozen Locked Regression cohort hash remains the authority that prevents accidental in-place generator drift.

## 4. Failure manifest

Every fuzz failure records:

- seed
- case index
- case id
- evaluator id
- optional metamorphic relation id
- stable failure fingerprint
- original failure payload

A failure is reproducible from seed + case index.

## 5. Minimal counterexample reduction

For the first bounded set of failures, the reducer greedily simplifies visible survey state while preserving the same:

```text
evaluatorId + relationId
```

Current shrink dimensions:

- multiple target selections → one target
- presentation preference → neutral examples
- styling scope → single-domain, then two-domain subsets
- hard exclusions → none or one
- change tolerance → light
- makeup intensity → medium
- daily time → 15 minutes
- budget → standard
- maintenance → medium
- hair length change → small
- hair dye → no

The face observation is intentionally not shrunk in v1. The exact original case remains reproducible from seed and case index.

## 6. Shrinker self-test

CI injects a deterministic invalid target-authority probe and requires the reducer to:

- preserve `E1-target-authority`
- simplify at least one survey dimension
- return the minimized failure with the same identity

This keeps the reducer exercised even when the official fuzz set has zero failures.

## 7. Initial baseline

First official run:

- seeds: 4
- total cases: 512
- actionable cases: 424
- no-route cases: 88
- hard failures: 0
- unique failure fingerprints: 0
- minimized counterexamples from official fuzz: 0

These counts are stress-test diagnostics, not population prevalence.

## 8. Manual execution

Property fuzz only:

```bash
FACE_LAB_EVAL_COHORT=property-fuzz npm run eval:face-lab-v2
```

Full suite:

```bash
FACE_LAB_EVAL_COHORT=all npm run eval:face-lab-v2
```

The full CLI suite includes the fixed cohorts, target responsiveness, axis consumption, recommendation lineage, parameter translation, constraint responsiveness, and property fuzz.

## 9. Interpretation boundary

A clean fuzz run means no current deterministic E1/E2 contract violation was found across the official synthetic search surface.

It does not establish:

- aesthetic correctness
- image-analysis accuracy
- real-user preference
- population representativeness
- fairness
- production calibration
