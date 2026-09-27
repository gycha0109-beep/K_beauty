# Face Lab V2 Recommendation Evaluation Contract v2

> Track: Face Lab 16D / Coverage, Adversarial, and No-Route Diagnostics
> Status: Deterministic evaluation expansion
> Supersedes: recommendation evaluation contract v1 for current harness semantics
> Authority ceiling: synthetic structured-face evaluation only; not real-user truth or production calibration authority

## 1. Cohort separation

Face Lab evaluation must not collapse all synthetic cases into one population.

### LOCKED_REGRESSION

Purpose:

- exact engine version replay
- regression detection
- stable baseline comparison

Contract:

- version: `face-lab-v2-locked-regression-cohort-v1`
- seed: `face-lab-v2-eval-v1`
- size: 96
- frozen SHA-256 hash:
  `41753671c096f134dffdbbea7af27b7bb5c1267d7358dc32ee65ceddbe697723`

The v1 locked cohort must not mutate in place. If its generator semantics must change, create a new locked cohort version.

### COVERAGE

Purpose:

- systematically cross target labels with scope profiles
- exercise visible change tolerance, makeup intensity, time, budget, maintenance, and exclusions
- expose under-covered styling domains

Contract:

- version: `face-lab-v2-coverage-cohort-v1`
- size: 96
- all current target-style registry keys are exercised
- eight designed scope/exclusion profiles are exercised

Coverage frequency is not population prevalence.

### ADVERSARIAL

Purpose:

- intentionally bounded requests
- mutually restrictive constraints
- partial grooming exclusions
- whole-domain disabled states
- extreme low-effort constraints
- high-change expressive states

Contract:

- version: `face-lab-v2-adversarial-cohort-v1`
- size: 32

Adversarial failure/no-route rate must not be interpreted as expected real-user failure prevalence.

## 2. No-route classification

A missing route is not automatically a recommendation failure.

### EXPECTED_CONSTRAINT_BOUNDED_NO_ROUTE

Use when:

- style priorities exist
- all actionable priorities were explicitly blocked by scope or hard exclusions

This is valid abstention caused by user constraints.

### EXPECTED_NO_ACTIONABLE_STYLE_DELTA

Use when:

- no actionable style priorities exist
- there are no blocked priorities explaining the absence

This is a bounded style-delta outcome, not automatically a route-generator defect.

### UNEXPECTED_ROUTE_GENERATION_GAP

Use when:

- one or more actionable priorities exist
- no route is emitted

This is a hard evaluation failure assigned to the route-generator layer.

Every no-route case must receive exactly one classification.

## 3. CI authority

The Face Lab verifier runs all three cohort families.

Blocking conditions:

- hard contract failure > 0
- metamorphic failure > 0
- unexpected route-generation gap > 0
- locked cohort hash drift
- unclassified no-route state

Non-blocking diagnostics in v2:

- route-strategy concentration
- action-signature concentration
- action-domain distribution
- expected bounded no-route count
- canonical status distribution

No arbitrary concentration threshold is promoted to a hard gate in v2.

## 4. Manual execution

Default locked cohort:

```bash
npm run eval:face-lab-v2
```

Coverage:

```bash
FACE_LAB_EVAL_COHORT=coverage npm run eval:face-lab-v2
```

Adversarial:

```bash
FACE_LAB_EVAL_COHORT=adversarial npm run eval:face-lab-v2
```

All cohorts:

```bash
FACE_LAB_EVAL_COHORT=all npm run eval:face-lab-v2
```

Optional seed/case-count overrides are diagnostic-only. Official CI uses the frozen contract defaults.

## 5. Interpretation boundary

The following remain prohibited:

- treating synthetic cohort rates as market prevalence
- declaring user satisfaction from synthetic output
- using one aggregate quality score as production truth
- treating generation intent as observed facial truth
- promoting LLM Judge output to deterministic contract authority

Real-photo end-to-end validation and Human calibration remain separate later stages.
