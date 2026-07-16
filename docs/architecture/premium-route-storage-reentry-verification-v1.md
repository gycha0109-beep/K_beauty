# Premium Route, Storage, and Reentry Verification v1

## Scope

This layer connects the canonical Premium Decision Bundle to temporary report sessions, current-product enrichment, saved report snapshots, saved-report reopening, and new-report rotation.

## Authorities

- `premium_report_sessions` is a short-lived mutable workspace only until its Premium report is finalized.
- `saved_reports.premium_report` is an immutable historical snapshot for `source_type = 'premium_report_session'`.
- Once a saved snapshot exists for a session, candidate enrichment is compared without updating the mutable session.
- Saved-report reopening reads the stored snapshot without rebuilding policies or loading current product data.
- New-report rotation creates a new session and leaves the prior saved report unchanged.

## Authentication boundary

`resolvePremiumRouteContext()` resolves cookie and bearer identities independently. Cookie authentication is preferred when both identities are the same, bearer authentication remains a compatibility fallback when no cookie identity exists, and different simultaneous principals fail closed with `premium_principal_conflict`.

## Snapshot contract

`premium-report-snapshot-v1` computes a deterministic SHA-256 fingerprint over stable report content. Timestamps, response-only gauges, saved IDs, and session identifiers are excluded.

- Same session and same fingerprint: return the existing saved report.
- Same session and different fingerprint: return `premium_snapshot_finalized` and do not update the session or saved report.
- Saved-report reopening ignores client-supplied report data and derives display gauges and locale from the stored snapshot.
- New snapshots persist their locale inside `premium_report`.

The version authorities are separate:

- `saved_reports.report_version`: `premium-v2`
- snapshot fingerprint contract: `premium-report-snapshot-v1`
- decision engine contract: `decisionBundle.version`

Database enforcement is provided by the partial unique index `saved_reports_premium_session_owner_uidx` over `(user_id, report_type, source_type, source_session_id)` for Premium session reports with a non-null session ID.

The authenticated UPDATE policy excludes `source_type = 'premium_report_session'`, so account users can still update other mutable saved-report types while finalized Premium session snapshots remain non-updatable through RLS.

## Current-product enrichment

The route builds product snapshots and verdicts, then calls `rebuildPremiumDecisionState()` to create a new report object. It does not mutate the input report through `applyPremiumDecisionState()`.

For finalized sessions, this enrichment is evaluated only as a candidate for replay classification. No session write occurs before the finalized comparison returns.

## Failure contract

- Principal conflict: HTTP 401, `premium_principal_conflict`
- Snapshot conflict: HTTP 409, `premium_snapshot_finalized`
- Save or session-store failure: HTTP 503, `premium_save_unavailable`
- Session rotation returns explicit safe reasons and never returns session IDs or tokens.

## Database verification

The target Supabase project was inspected before migration.

- No duplicate Premium session ownership tuples existed.
- No pre-existing unique index covered the ownership tuple.
- RLS was enabled and owner-scoped SELECT/INSERT/UPDATE/DELETE policies existed.
- The migration added the partial unique index and narrowed authenticated UPDATE access.
- A controlled insert-conflict-cleanup verification confirmed that a duplicate Premium session tuple raises `unique_violation` and leaves no verification row behind.
- Post-migration metadata confirmed the intended index and policy definitions.
- The repository migration filename matches the applied Supabase migration version: `20260717031925`.

## Verification boundary

The verifier executes deterministic fingerprint, version separation, locale, dual-principal selection, and finalized-session replay classification. It also checks route ordering, immutable storage architecture, request tampering resistance, pure current-product rebuilding, ownership filters, rotation cleanup, and the migration contract.

The schema and RLS changes were verified against the connected target Supabase project. Browser flow, Hosted Preview, and production user-journey execution remain separate gates.
