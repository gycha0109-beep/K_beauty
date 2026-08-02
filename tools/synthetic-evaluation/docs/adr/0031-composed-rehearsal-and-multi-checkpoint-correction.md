# ADR 0031: Composed rehearsal and multi-checkpoint correction

## Status

Accepted after #T10 implementation review.

## Context

The design initially described rehearsal-only reviewer and promotion claims. T5 and T6 use strict artifact contracts and intentionally reject unknown fields. Adding a rehearsal marker to those authority artifacts would weaken or fork the production-independent evidence contracts solely for a test harness.

The full rehearsal also exposed that T7 could read one checkpoint but failed when a second valid checkpoint existed. The verifier accepted an optional projection parameter and was passed directly to `Array.prototype.every`, which supplied the array index as that parameter.

## Decision

### Composed authority domains

1. #T10 does not add rehearsal-only fields to T3–T9 authority contracts.
2. Test fixture factories and deterministic fake transport run only inside tracked OS temporary roots.
3. The T7 campaign drill uses authority-safe terminal placeholders rather than pretending isolated evidence probes belong to the same candidate lineage.
4. T3–T6, T8, and T9 are exercised as separate authority-domain probes.
5. The report must state `singleArtifactLineageEndToEnd: false`.
6. No rehearsal artifact may be retained or reused as pilot evidence.
7. Actual human review count and persistent authoritative G4/G5 counts remain zero.

### Multi-checkpoint validation

T7 bundle loading must invoke checkpoint verification with one argument explicitly:

```js
checkpoints.every((approval) => verifyPilotCheckpointApprovalIntegrity(approval))
```

Passing the verifier directly as the callback is prohibited because the callback index can be interpreted as the verifier's optional projection argument.

The three-wave T10 rehearsal is the regression boundary: it requires two stored checkpoint approvals and a final Wave 3 issue.

## Consequences

- The rehearsal validates operational composition without creating a fake authoritative lineage.
- Strict T3–T9 contracts remain unchanged.
- Two valid checkpoints can now coexist and be reloaded correctly.
- T10 reports are honest about what was and was not exercised end to end.
- Actual Pilot 20 still requires separate Provider and human-review authorization.
