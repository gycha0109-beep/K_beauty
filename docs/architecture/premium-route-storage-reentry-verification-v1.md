# Premium Route, Storage, and Reentry Verification v1

## Scope

This layer connects the canonical Premium Decision Bundle to temporary report sessions, current-product enrichment, saved report snapshots, saved-report reopening, and new-report rotation.

## Authorities

- `premium_report_sessions` is a short-lived mutable workspace.
- `saved_reports.premium_report` is an immutable historical snapshot.
- Saved-report reopening reads the stored snapshot without rebuilding policies or loading current product data.
- New-report rotation creates a new session and leaves the prior saved report unchanged.

## Authentication boundary

`resolvePremiumRouteContext()` resolves one account user and one matching user-scoped Supabase client. Server cookie authentication is preferred and bearer authentication remains a compatibility fallback. A mismatched principal fails closed.

## Snapshot contract

`premium-report-snapshot-v1` computes a deterministic SHA-256 fingerprint over stable report content. Timestamps, response-only gauges, saved IDs, and session identifiers are excluded.

- Same session and same fingerprint: return the existing saved report.
- Same session and different fingerprint: return `premium_snapshot_finalized` and keep the previous snapshot unchanged.
- Saved-report reopening ignores client-supplied report data and derives display gauges from the stored snapshot.

Database-level concurrency safety still depends on a unique constraint for the session ownership tuple. This branch does not claim that the constraint exists and does not apply a migration.

## Current-product enrichment

The route builds product snapshots and verdicts, then calls `rebuildPremiumDecisionState()` to create a new report object. It no longer mutates the input report through `applyPremiumDecisionState()`.

## Failure contract

- Snapshot conflict: HTTP 409, `premium_snapshot_finalized`
- Save or session-store failure: HTTP 503, `premium_save_unavailable`
- Session rotation returns explicit safe reasons and never returns session IDs or tokens.

## Verification boundary

The verifier covers deterministic fingerprints, immutable storage architecture, request tampering resistance, authentication-principal alignment, pure current-product rebuilding, ownership filters, and rotation cleanup.

Live database writes, database concurrency, constraint inspection, RLS metadata, browser flow, Hosted Preview, and production execution remain outside this branch.
