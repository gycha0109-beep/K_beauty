# 2026-07-17 Premium browser journey verification

- Branch: `agent/premium-browser-journey-verification`
- Base: `agent/premium-route-storage-reentry-verification` at `d88ad5075d9f4faab201e0d819b4f7c952d16867`
- Risk: authenticated browser lifecycle and persistence verification.
- Added a Chromium verifier for analyze, first save, identical retry, saved reopen, locale authority, current-session lookup, rotation, and new-session save.
- Added optional finalized-snapshot conflict coverage without hardcoding environment-specific product data.
- Added checks that rotation JSON exposes no session identifiers or tokens and that rotation replaces the Premium cookie.
- Kept environment-specific authentication values outside source control and ordinary CI.
- Added execution, data-retention, and promotion rules.
- No database change, deployment, merge, or local-worktree operation was performed.
- Remaining gate: execute against Hosted Preview with a dedicated Premium test account, then run the separately approved production journey.
