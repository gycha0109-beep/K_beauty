### 2026-08-02 / Toolkit Track #T7 Pilot Campaign Runner Design

- Task type: Medium bounded design. Production/build runtime, DB, Auth, RLS, Storage, Provider generation, human review, G4 execution, G5, split, and holdout execution were out of scope.
- Base and branch: `feature/T6-promotion-policy` at `0d8bca1d31616deb485c32c627cb99cf5b3ef337` → `design/T7-pilot-campaign-runner`.
- Design: fixed a 20-slot A/B/C/D skin-control pilot with 5 slots per condition, balanced 4/8/8 waves, one manual generation provider profile per run, technical-only retry reserve, registered-candidate replacement prohibition, explicit T4 Provider authorization, append-only run/slot events, source-version freeze, checkpoint, resume, stop, projection, and closeout contracts.
- Authority boundary: T7 orchestrates T2–T6 and records references/counts only. It does not generate images, synthesize human reviews, alter observation/consensus/alignment/promotion values, fill a G4 quota, interpret campaign success, export reports, assign splits, or create G5.
- Anti-selection rule: 20 is the primary slot denominator rather than a Gold target. Every successfully registered candidate keeps its slot and terminal outcome, including ineligible, misaligned, held, rejected, and non-Gold cases.
- Self-review corrections: expanded the source freeze to compiled-prompt schema/compiler/provider-template/profile and T4 adapter contracts; added explicit `generation_failed_no_asset` and `observation_valid_ineligible` terminal outcomes; defined checkpoint readiness at authoritative T4 or technical-terminal state; required T9 to revalidate current T6 G4 status rather than trusting the closeout snapshot.
- Downstream boundary: T8 owns review/export/report and interpretation. T9 owns leakage-aware split assignment, G5 lock, dataset versioning, and regression activation.
- Repository change: documentation and README only; no package, source, test, workflow, runtime, Provider, DB, API, UI, Auth, Payment, or production file changed.
- Design status: `READY_FOR_IMPLEMENTATION_REVIEW`; no implementation or campaign execution is claimed.
