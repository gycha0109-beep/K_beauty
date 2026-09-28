# Face Lab V2 Recommendation Evaluation Contract v10

> Track: Face Lab 16L / Recommendation Specificity & Distribution
> Status: deterministic diagnostic baseline
> Supersedes: recommendation evaluation contract v9 for current suite semantics
> Authority ceiling: synthetic structured-face evaluation only

## 1. Question

This stage asks whether Face Lab recommendations are structurally diverse enough to reflect Target and face differences, or whether a small number of routes, parameters, action signatures, and wording patterns dominate the output.

The fixed surface is the existing Target Sweep cohort:

~~~text
8 structured faces
× 12 confirmed Targets
= 96 cases
~~~

Every face is evaluated against every Target with the same broad Styling Scope and controlled constraints.

## 2. Why this is separate from Target Responsiveness and Face Responsiveness

Target Responsiveness proves that changing Target can change recommendation semantics.

Face Responsiveness proves that current explicit face modifiers fire end-to-end.

Specificity & Distribution measures the aggregate consequence:

- route concentration
- domain concentration
- parameter concentration
- action signature concentration
- wording concentration
- same-Target repetition across faces
- same-face repetition across Targets
- signatures that reach many Targets or faces

A system can pass local responsiveness tests and still repeat the same recommendations too often.

## 3. Signatures

### Action signature

~~~text
domain
+ parameter
+ direction
+ strength
+ reason
~~~

for every selected-route action, sorted into one case-level signature.

### Parameter signature

~~~text
domain + parameter
~~~

for every selected-route action.

### Wording signature

Exact selected-route action explanation strings, sorted into one case-level signature.

## 4. Grouped diagnostics

### Target-specific repetition

For each Target, compare the eight different faces.

Record:

- unique action signatures
- unique parameter signatures
- route concentration
- action-signature concentration
- wording concentration

A Target with one action signature across all eight faces is reported as fully collapsed for this synthetic surface.

### Face-specific repetition

For each face, compare all twelve Targets.

The same distribution fields are recorded separately.

## 5. Cross-group reach

For every exact action signature, record:

- total case count
- number of distinct Targets using it
- number of distinct faces using it

This surfaces generic-recommendation candidates without declaring them incorrect.

## 6. Hard gates in the first baseline

The first 16L baseline does not hard-code arbitrary aesthetic diversity thresholds.

Hard failures are limited to deterministic accounting integrity:

- every cohort case must be evaluated,
- target grouping must account for every case,
- face grouping must account for every case.

Concentration values are diagnostics in v10.

After the baseline is observed, any promotion of a concentration threshold must be separately justified and versioned.

## 7. Manual execution

~~~bash
FACE_LAB_EVAL_COHORT=specificity-distribution npm run eval:face-lab-v2
~~~

The full suite includes this diagnostic report under the same deterministic evaluation command.

## 8. Interpretation boundary

These metrics describe the current synthetic Target Sweep surface.

They do not establish:

- real-user recommendation diversity,
- aesthetic quality,
- user satisfaction,
- population prevalence,
- fairness,
- production calibration.

A high repetition measurement is a recommendation-quality finding to investigate, not a real-world prevalence claim.
