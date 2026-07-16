# Premium Route, Storage, and Reentry Verification v1

## Scope

This layer connects the canonical Premium Decision Bundle to temporary report sessions, current-product enrichment, saved report snapshots, saved-report reopening, and new-report rotation.

## Authorities

- `premium_report_sessions` is a short-lived mutable workspace.
- `saved_reports.premium_report` is an immutable historical snapshot for `source_type = 'premium_report_session'`.
- Saved-report reopening reads the stored snapshot without rebuilding policies or loading current product data.
- New-report rotation creates a new session and leaves the prior saved report unchanged.

## Authentication boundary

`resolvePremiumRouteContext()` resolves one account user and one matching user-scoped Supabase client. Server cookie authentication is preferred and bearer authentication remains a compatibility fallback. A mismatched principal fails closed.

## Snapshot contract

`premium-report-snapshot-v1` computes a deterministic SHA-256 fingerprint over stable report content. Timestamps, response-only gauges, saved IDs, and session identifiers are excluded.

- Same session and same fingerprint: return the existing saved report.
- Same session and different fingerprint: return `premium_snapshot_finalized` and keep the previous snapshot unchanged.
- Saved-report reopening ignores client-supplied report data and derives display gauges from the stored snapshot.

Database enforcement is provided by the partial unique index `saved_reports_premium_session_owner_uidx` over `(user_id, report_type, source_type, source_session_id)` for Premium session reports with a non-null session ID.

The authenticated UPDATE policy excludes `source_type = 'premium_report_session'`, so account users can still update other mutable saved-report types while finalized Premium session snapshots remain non-updatable through RLS.

## Current-product enrichment

The route builds product snapshots and verdicts, then calls `rebuildPremiumDecisionState()` to create a new report object. It no longer mutates the input report through `applyPremiumDecisionState()`.

## Failure contract

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

## Verification boundary

The verifier covers deterministic fingerprints, immutable storage architecture, request tampering resistance, authentication-principal alignment, pure current-product rebuilding, ownership filters, rotation cleanup, and the migration contract.

The schema and RLS changes were verified against the connected target Supabase project. Browser flow, Hosted Preview, and production user-journey execution remain separate gates.
