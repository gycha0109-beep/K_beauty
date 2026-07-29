# Current-product snapshot transport v1

## Scope and stacked baseline

This repair is stacked on CandidatePolicy runtime safety hardening commit
`3dcd1f847a2a6ab309681a41eeb96cdf19a7d2f6`, which includes verifier baseline
commit `f0505b804313ee5ffbe1fbb84971487f5c81c5f1`. It changes only the
current-product snapshot projection and the verification surfaces that describe
that projection.

It does not change CandidatePolicy, FunctionalPolicy, GoalPolicy, ranking,
`currentProductFindings` callers, runtime flags, product rows, database schema,
migrations, backfills, UI, or deployment behavior. No database, Supabase,
network, Preview, Hosted, or Production request is required.

## Reproduced adapter loss

An ignored read-only runner imported the exact stacked production modules and
read the preserved 164-row catalog export. Before the repair, source-present
metadata was removed by both current-product snapshot mappers:

- affected products: `41/164`;
- source-present field/product instances dropped: `104`;
- current-product transport complete: `123/164`;
- sunscreen dropped field instances: `74`.

The drops were `spf_value` 11, `uva_label` 10, `uv_filter_type` 11,
`tone_up` 41, `white_cast` 11, `eye_sting` 11, and `pilling_risk` 9.
Recommendation transport was already complete. The loss occurred before the
Premium report, session, saved-report, and immutable snapshot boundaries.

## Transport call graph

The analyze path reads selected product rows through
`fetchCurrentProductSnapshotsByIds()`, whose `mapCurrentProductSnapshot()`
builds the catalog-backed snapshot. The engine's local current-product report
path uses `buildCurrentProductsReport()` and its selected-product mapper.

Both mappers now call the same
`buildCurrentProductSnapshotProtectionMetadata()` projection. The resulting
`productSnapshot` is embedded in `currentProducts.selections`, read by the
SharedSkinDecisionContext and Premium projections, and included by
`buildPremiumReportSnapshot()`'s recursive canonicalization.

Premium session storage and `saved_reports.premium_report` persist the
authoritative report object as JSON. Their readers return that stored object;
the saved-report response applies only the existing boundary sanitizer and
then spreads the report. No later writer or reader maintains a second
field allowlist, so the seven projected values survive JSON serialization,
session readback, saved-report readback, fingerprinting, and immutable
reentry.

## Authoritative contract

The current-product protection metadata contract is exactly:

- `spf_value`
- `uva_label`
- `uv_filter_type`
- `tone_up`
- `white_cast`
- `eye_sting`
- `pilling_risk`

The contract preserves valid source values without string/number coercion.
`false` remains `false`. Explicit `null`, absent fields, and invalid values use
canonical unavailable `null` in new snapshots; no protection or preference
value is inferred. Existing enum allowlists match the recommendation mapper.
The input row is never mutated, and no unrelated product field or full product
row is copied.

The Product Data Sufficiency Audit criteria remain unchanged: every
source-present relevant field must reach each declared destination. Its
current-snapshot destination capability set now consumes the production
contract instead of retaining the stale seven-field omission. Dropped,
defaulted, and coerced classifications are unchanged.

## Versioning and legacy compatibility

`premium-report-snapshot-v1` is an additive, recursive JSON contract rather
than an exact current-product field schema. The saved-report/session readers
also accept additive object fields. The report snapshot version therefore does
not change.

The projection has its own code-level capability version,
`current-product-snapshot-protection-metadata-v1`, for verifier provenance; it
is not injected into every persisted product. Legacy snapshots without the
seven fields continue to parse and reenter with those properties absent. No
legacy report is rewritten and no fake metadata is added.

The deterministic fixture measures 141 JSON bytes for the seven-field
projection. Current-product input permits at most one selection per canonical
category, so the bounded worst-case addition is approximately 1,410 bytes for
ten selected categories, excluding existing object delimiters. The session
cookie remains a signed server-side session reference rather than the report.

## Verification

`verify-current-product-snapshot-transport.mjs` runs 16 anonymous scenarios,
608 assertions, 12 negative controls, and two independent deterministic
materializations. It covers all fields, false/null/missing distinctions,
complete and source-incomplete sunscreen metadata, non-sunscreen input, legacy
snapshots, JSON/persistence/session/reentry, input immutability, unrelated
field stability, malformed versions, stale artifacts, and semantic hashes.

The post-change 164-row replay reports `164/164` transport complete, zero
dropped/defaulted/coerced/inaccessible instances, zero input mutations, and
zero sunscreen transport drops. The unchanged audit reports dataset hash
`f346d90ed722432dd1e1367a50939954ec5030abb9a7ea72fdef61bb1dc93e2f`,
transport gaps `0`, critical gaps `0`, important source gaps `3`, and quality
gaps `0`. Source UVA remains present for `10/11` sunscreens and source
`pilling_risk` remains present for `9/11`.

CandidatePolicy runtime safety, recovered shadow/hint verifiers, Premium
decision/snapshot/reentry/session verifiers, and the CandidatePolicy bundle
remain unchanged and pass. Security closeout freezes 54 entries and passes
53; the only failure is the unchanged SEC-06 `negative control 5 was not
rejected` baseline.

## Remaining findings

The source UVA gap, source pilling-risk gaps, missing
`currentProductFindings` runtime caller, FunctionalPolicy/GoalPolicy divergence,
Production canary behavior, and actual Production runtime remain out of scope
and unverified.
