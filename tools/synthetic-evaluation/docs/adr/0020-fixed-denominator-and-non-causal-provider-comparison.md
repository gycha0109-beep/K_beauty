# ADR 0020: Fixed Denominator and Non-Causal Provider Comparison

## Status

Accepted for #T8 design.

## Context

The T7 pilot fixes 20 primary generation slots, A/B/C/D five each. Technical failure, valid ineligibility, judgment incompleteness, non-Gold disposition, hold, and rejection are part of the experimental result.

A report can distort that result by:

- dropping failed rows
- changing denominators per stage without disclosure
- presenting percentages without fractions
- treating a small descriptive difference as statistical or causal evidence
- ranking Providers from separate, unpaired runs

## Decision

### Primary denominator

Every single-run report uses exactly 20 primary slots as the primary denominator.

Every condition report uses exactly five slots for A, B, C, and D.

All terminal outcomes, including zero-count outcomes, remain visible.

### Stage metrics

Each stage metric publishes:

- numerator
- denominator
- fraction label
- percentage
- exact metric definition

A filtered table may be generated for review convenience, but it cannot replace the primary denominator or be presented as the campaign yield.

### No aggregate score

T8 v1 defines no weighted score, adjusted yield, quality index, or combined Provider score.

One successful stage cannot numerically offset a failure at another stage.

### Provider comparison gate

Provider comparison requires two closed T7 runs with:

- identical non-null comparison group
- identical objective and A/B/C/D matrix
- identical T2 fixture/spec/compiler surface except Provider profile fields
- identical T3–T6 policies and adapter versions
- identical campaign budget/retry/checkpoint/stop/output policies

Only Provider profile identity/version/digest/template, run identity, operator, and timestamps may differ.

### Descriptive output only

Comparison output may contain:

- exact counts and fractions per Provider
- condition-level counts and fractions
- count deltas
- percentage-point deltas

It may not contain:

- winner or loser
- rank
- significance or confidence interval
- causal explanation
- paired-sample claim
- population generalization
- cost or latency claim without a separate authoritative source

## Consequences

### Positive

- Cherry-picking and denominator drift remain visible.
- Small pilot results are not overstated.
- Provider comparisons remain auditable and narrowly descriptive.
- A/B/C/D balance is preserved throughout reporting.

### Negative

- Reports may appear less decisive.
- Provider comparison cannot produce an automatic selection recommendation.
- Some readers may need explicit explanation for overlapping metrics such as authoritative and valid-ineligible observations.

## Rejected alternatives

### Use only registered candidates as denominator

Rejected because it hides generation and import failures.

### Use only promotion-reviewed candidates as denominator

Rejected because it hides upstream attrition and valid negative outcomes.

### Normalize every stage to its preceding stage

Rejected as the primary presentation because it obscures the fixed 20-slot experiment. Conditional rates may appear only as secondary, explicitly labeled metrics in a later policy version.

### Rank Providers by G4 yield

Rejected because separate pilot runs are small, unpaired, and affected by multiple downstream human and policy gates.

### Add statistical significance tests

Rejected for v1 because the pilot was not designed or powered for inferential comparison.

## Verification implications

Implementation tests must prove:

- every run export contains exactly 20 slot rows
- every condition contains exactly five rows
- all terminal outcomes are retained, including zero counts
- percentages always preserve numerator and denominator
- comparison rejects any non-Provider source drift
- comparison contracts contain no rank, winner, p-value, confidence, or causal field
