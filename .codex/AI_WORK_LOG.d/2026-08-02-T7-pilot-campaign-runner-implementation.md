### 2026-08-02 / Toolkit Track #T7 Pilot Campaign Runner Implementation

- Branch: `feature/T7-pilot-campaign-runner`, stacked on `design/T7-pilot-campaign-runner`.
- Implemented the fixed 20-slot A/B/C/D pilot runner, 4/8/8 waves, deterministic identities, manual generation handoff, technical-only retry budgets, explicit observation authorization, append-only event ledger, projection, checkpoint, pause/stop/resume, closeout, immutable storage, and CLI.
- Added strict T7 contracts to `@bejewely/face-contracts` and kept the production application independent of the toolkit.
- Bound T3 candidate registration to the exact slot packet and asset-ready handoff, then bound T4/T5/T6 records to the current candidate and preceding digests.
- Separated historical source-freeze integrity from current-source drift and added preflight before wave, checkpoint continuation, and resume writes.
- Preserved all primary denominators and terminal outcomes; no low-yield replacement, quota filling, report interpretation, split, G5, or holdout behavior was added.
- No generation Provider, browser automation, automatic human review, automatic promotion, database, API, UI, Auth, Payment, or production runtime execution was performed.
- Verification and final post-implementation review are recorded in Draft PR #125; merge was not performed.
