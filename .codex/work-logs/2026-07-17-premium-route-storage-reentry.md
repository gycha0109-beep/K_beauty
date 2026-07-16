# 2026-07-17 Premium route/storage/reentry integration

- Branch: `agent/premium-route-storage-reentry-verification`
- Base: `agent/premium-integrated-evaluation-pack` at `b2d89bc4009b2cc00b2ff2d0f0da08a4c9e37d77`
- Risk: security-sensitive route, authentication, session, and persistence boundary.
- Implemented deterministic Premium snapshot fingerprints and replay classification.
- Replaced hidden current-product report mutation with a pure canonical decision rebuild.
- Added cookie-first, bearer-fallback user/client principal alignment.
- Changed saved Premium persistence from update-or-insert to immutable insert, same-fingerprint replay, and conflicting-replay rejection.
- Saved-report reopening now ignores request `topPick` and derives gauges from the stored snapshot.
- Session rotation returns explicit safe reason codes and does not expose tokens or session IDs.
- Added focused route/storage/reentry verification and updated the existing reentry contract verifier.
- No migration, live Supabase write, RLS metadata inspection, browser execution, Hosted Preview, or production execution was performed.
- Remaining external gate: database-level concurrency and uniqueness require read-only schema verification and, if absent, separately approved migration work.
