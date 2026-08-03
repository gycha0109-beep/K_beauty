# ADR 0034 — Fixed Wave Denominator and Checkpoint Link

- Status: Accepted for #T11 design
- Date: 2026-08-03
- Scope: T11 Wave brief and T7 checkpoint relationship

## Context

A solo operator needs an immediate Wave 1 result after four images, while T8 only creates an authoritative report for a closed 20-slot T7 run. A success-only Wave summary would hide no-asset, import, observation, and valid-ineligible outcomes. Automatically applying a solo recommendation to T7 would also make T11 a new campaign authority.

## Decision

Every T11 Wave brief uses the issued T7 Wave as its exact denominator.

```text
Wave 1 = 4 rows = A/B/C/D each 1
Wave 2 = 8 rows = A/B/C/D each 2
Wave 3 = 8 rows = A/B/C/D each 2
```

Every issued slot appears exactly once as either:

- assessable observed
- assessable valid-ineligible
- technical no-asset
- technical import failure
- technical observation failure
- cancelled

A row without an assessable image contains verified technical source evidence only. It never fabricates a human assessment.

The Wave brief records counts, fractions, direct target relations, artifact flags, usability, and limitations. It does not produce a score, winner, significance result, or automatic go/no-go.

The operator enters a T11 decision of `continue | pause | stop`. T7 checkpoint approval remains a separate T7 command and artifact. After the T7 approval exists, T11 may create:

```text
SoloCheckpointLinkV1
```

The link verifies:

- same campaign run
- same completed Wave
- exact T11 Wave brief digest
- exact T7 checkpoint approval digest
- matching decision token

It does not create, mutate, or authorize the T7 checkpoint.

## Consequences

### Positive

- Wave 1 can be reviewed before the 20-slot run closes.
- Failed and unavailable slots remain visible.
- T7 retains exclusive checkpoint authority.
- Later audits can prove which solo brief preceded the operator decision.

### Negative

- Two explicit records are required: T11 decision and T7 checkpoint.
- A Wave brief is not a T8 campaign report.
- The link is created after the checkpoint, not as an input field inside T7 v1.

## Rejected alternatives

### Use only successful images as denominator

Rejected because it changes yield and hides failure modes.

### Extend T8 to report active Waves

Rejected because T8 explicitly prohibits authoritative preview reports and owns closed-run reporting.

### Let T11 append T7 checkpoint events

Rejected because it creates a second campaign authority and bypasses T7 checklist validation.

### Add T11 digest to T7 checkpoint v1 schema

Rejected for v1 because it would change existing T7 semantic identity and backward compatibility. The separate link provides evidence without mutating T7.

## Verification requirements

- exact Wave slot count and condition count checks
- duplicate and missing row rejection
- technical source row verification
- filtered success-only brief rejection
- no T7 write in T11 Wave brief operation
- checkpoint link rejects run, Wave, digest, or decision mismatch
- T11 brief labels itself non-authoritative for campaign reporting
