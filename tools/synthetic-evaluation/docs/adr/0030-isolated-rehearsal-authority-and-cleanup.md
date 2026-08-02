# ADR 0030: Isolated rehearsal authority and cleanup

## Status

Accepted for #T10 implementation.

## Context

A full operational rehearsal must exercise the real T2–T9 orchestration without making fixture observations, synthetic reviewer submissions, or temporary G4/G5 artifacts appear authoritative.

Running the drill inside `.synthetic-local/` would mix rehearsal evidence with real pilot evidence. Calling Providers would also turn an operational drill into a paid execution.

## Decision

1. #T10 runs only in a newly created OS temporary directory.
2. The harness rejects `.synthetic-local/`, its descendants, and symbolic-link roots.
3. All outbound network paths are disabled for the rehearsal process.
4. T4 uses the provider-bounded normalization path with an in-process deterministic fake transport; `fixture_replay` is not upgraded.
5. Rehearsal reviewer and promotion decisions carry an explicit `rehearsal_only` execution claim and are accepted only by the harness.
6. T6/T9 artifacts created during the drill are operational test artifacts, not authoritative G4/G5 records.
7. Only a canonical report without images, raw review payloads, or holdout material may leave the temporary root.
8. Cleanup is part of the pass condition. Failure to delete the temporary root fails the rehearsal.
9. `.synthetic-local/` state is measured before and after the run; any change fails the rehearsal.
10. The report must state Provider calls, network attempts, production writes, authoritative human reviews, authoritative G4 records, and authoritative G5 records as exact zero.

## Consequences

- The rehearsal validates workflow and invariants, not model or image quality.
- Actual Pilot 20 execution still requires separate explicit authorization.
- Rehearsal artifacts cannot be reused as campaign evidence.
- The same harness can be rerun in CI without credentials or external services.
