# TRUST Phase 8I-0 — Fleet Authority Audit & Re-entry Runtime Security Hardening

## Purpose

Phase 8I-0 starts the operational bridge from the existing Phase 6 re-entry detectors to the completed Phase 8H relocation/revalidation lifecycle. This slice does not add transport monitoring, change detector semantics, or mutate Product Fact authority.

## Production snapshot

The read-only fleet audit currently identifies **35** official Evidence Sources. 3 have verification profiles, 3 are comparable, 32 remain unprofiled, and 35 participate in Product Fact Current propositions.

Re-entry checkpoint coverage reaches 33 of 35 sources through their linked Product scope. 2 sources are currently outside Phase 6 checkpoint coverage.

## Security hardening

The existing Phase 6 functions keep their current behavior and EXECUTE authority. Phase 8I-0 only pins function name resolution to an empty search path and reasserts least-privilege ACLs.

Service-role callable:
- `request_trust_reentry_v1`
- `process_trust_reentry_event_v1`
- `run_trust_reentry_detectors_v1`

Internal-only:
- `hash_trust_reentry_signal_v1`
- `observe_trust_reentry_signal_v1`

No function is made callable by `anon`, `authenticated`, or `PUBLIC`.

## Known runtime gap

`run_trust_reentry_detectors_v1(integer)` orders intakes by `created_at, id` and applies `LIMIT p_limit` without a cursor. Production has 165 intake-scoped checkpoint baselines while the default limit is 100. This creates a deterministic starvation risk for later intakes under repeated default runs.

Phase 8I-0 records this as a locked regression fixture. It does **not** alter scanner semantics. The next runtime slice must implement stable keyset pagination/cursor behavior and prove eventual full-fleet coverage.

## Non-negotiable invariants

- Historical Product Evidence Sources are immutable.
- Re-entry checkpoints/events are operational state, not Product Fact authority.
- Product Fact Current is not invalidated by this slice.
- No relocation is confirmed automatically.
- No external network fetch is added to required PR CI.
- Phase 8I-0 introduces no new detector event type.
