# 2026-07-17 Premium route/storage/reentry integration

- Branch: `agent/premium-route-storage-reentry-verification`
- Base: `agent/premium-integrated-evaluation-pack` at `b2d89bc4009b2cc00b2ff2d0f0da08a4c9e37d77`
- Risk: security-sensitive route, authentication, session, persistence, RLS, and uniqueness boundary.
- Implemented deterministic Premium snapshot fingerprints and replay classification.
- Replaced hidden current-product report mutation with a pure canonical decision rebuild.
- Added cookie-first, bearer-fallback user/client principal alignment.
- Changed saved Premium persistence from update-or-insert to immutable insert, same-fingerprint replay, and conflicting-replay rejection.
- Saved-report reopening ignores request `topPick` and derives gauges from the stored snapshot.
- Session rotation returns explicit safe reason codes and does not expose tokens or session IDs.
- Added focused route/storage/reentry verification and updated the existing reentry and decision-state contract verifiers.
- Read-only target schema inspection found no duplicate Premium session tuples and no unique ownership index.
- Applied `premium_saved_report_snapshot_immutability` to the connected Supabase project.
- Added partial unique index `saved_reports_premium_session_owner_uidx` for Premium session ownership tuples.
- Replaced the broad authenticated UPDATE policy with `Users can update own mutable saved reports`, excluding `premium_report_session` snapshots.
- Post-migration metadata confirmed the intended index and RLS policy definitions.
- Controlled duplicate-insert verification produced `unique_violation`; the synthetic verification row was deleted in the same procedure.
- Supabase security advisor found no new `saved_reports` finding. Existing unrelated project-level INFO/WARN findings remain outside this change.
- Remaining gates: exact-head repository validation, browser flow, Hosted Preview, and production user-journey execution.
