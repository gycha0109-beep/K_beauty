# TRUST Phase 8I-1 — Fair Detector Runtime v2

## Scope

Phase 8I-1 removes the bounded-prefix starvation risk from the Phase 6-B intake scanner without changing detector semantics or Product Fact authority.

Production basis at design time:

- catalog_trust_intake rows: 165
- distinct created_at values: 8
- Phase 6-B v1 default limit: 100
- cursor in v1: none
- uncovered official-source records from Phase 8I-0: 2
- the uncovered Torriden product has zero catalog_trust_intake rows, so those records are explicitly outside the 8I-1 completion condition and remain an 8I-2 source-level monitoring concern.

## Runtime contract

`run_trust_reentry_detectors_v2(integer)` owns a private persistent scanner state row keyed by `PHASE6B_INTAKE_FLEET`.

A cycle freezes the maximum `(created_at,id)` tuple visible when the cycle starts. Each call scans only rows strictly after the persisted cursor and at or before the frozen upper bound.

The cursor is the composite tuple `(created_at,id)`; `created_at` alone is forbidden because Production currently has only eight distinct timestamps across 165 rows.

When no rows remain under the frozen upper bound, the cycle completes and cursor/upper-bound fields reset. Rows inserted beyond the upper bound and rows backfilled behind an already-advanced cursor are picked up on the next finite cycle.

The runtime-state row is locked `FOR UPDATE` for each invocation so concurrent service-role calls serialize rather than claim the same batch.

## Security and authority

- v1 remains present and is not redefined.
- runtime-state table has RLS enabled and no direct anon/authenticated/service_role grants.
- v2 is SECURITY DEFINER with `search_path=''`.
- v2 EXECUTE is service_role-only.
- Product Fact Current, Evidence Sources, confirmations, instances, and recommendations are outside this migration's mutation surface.
- no new detector key or event type is introduced.
- no automatic relocation, reaffirmation, or replacement occurs.

## Runtime proof

The isolated fixture must prove:

1. 205 same-timestamp intakes scan as 100 + 100 + 5.
2. distinct scanned intake IDs = 205, missing = 0, duplicates = 0.
3. a row added beyond the frozen upper bound is excluded until the next cycle.
4. a backfilled row inserted behind the advanced cursor is also recovered on the next cycle.
5. concurrent v2 calls return different first scanned intake IDs.
6. invalid limits and malformed cursor tuples fail closed.
7. governed Product Fact and recommendation authority cardinality is unchanged.
