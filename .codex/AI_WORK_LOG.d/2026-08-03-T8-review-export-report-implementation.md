# Synthetic Evaluation Toolkit #T8 — Review / Export / Report Implementation

## Status

- Track: `#T8`
- Branch: `feature/T8-review-export-report`
- Base: `design/T8-review-export-report`
- Exact base SHA: `9f00365cfcba403c663d2e6338baca9d75e2ee75`
- Draft PR: `#128`
- Merge: not performed
- Actual campaign/report execution: 0
- Actual human report review: 0
- Provider/browser/network/DB/shell execution: 0
- Public publishing: 0
- G5/split/holdout operation: 0
- Production integration: none

## Implemented flow

```text
stored T7 closeout
+ referenced T2–T6 artifacts
→ source preflight
→ immutable evidence snapshot
→ exact 20-row slot table
→ fixed-denominator metric set
→ blind / annotated review package
→ explicit human report review
→ immutable descriptive report
→ deterministic internal export
```

## Main implementation

- strict shared reporting contracts
- T7 projection and closeout re-derivation and linkage checks
- T3 canonical bytes and T4–T6 source-chain verification
- exact 20-per-run and five-per-condition denominators
- terminal outcome and failure-group preservation
- Provider-only comparison compatibility key
- blind review aliases separated from annotated identifiers and paths
- resize-only deterministic PNG thumbnails
- canonical JSON, flattened LF CSV, accessible HTML
- source-linked descriptive claim generation
- explicit reviewer checklist and pseudonymous reviewer identity
- immutable report/revision/export storage
- one successor per predecessor report
- manifest-last export publication and existing-file rehash
- authority-checked public package and CLI operations

## Self-review corrections

1. Replaced auto-approved report-review checks with explicit human-supplied checks.
2. Added stored projection, closeout head, checkpoint, G4, hold, and non-Gold reference verification.
3. Added canonical-image byte verification and complete referenced T3–T6 evidence checks.
4. Enforced exact run, condition, stage, terminal, and failure denominators.
5. Separated evidence snapshot, metric, review package, report-review, report, and export identities.
6. Rejected Provider comparison when any non-Provider frozen field differs.
7. Removed campaign run, slot, and candidate identifiers from blind HTML and blind thumbnail paths.
8. Added a stored thumbnail index and verified all review assets before export.
9. Added a single-successor claim to reject report revision branching.
10. Added staged manifest-last export, complete existing-export rehash, and incomplete-export rejection.
11. Rejected symbolic-link report roots and nested path components.
12. Restricted package-root exports to source-preflighted orchestration and integrity verification.

## Verification

Temporary GitHub Actions verifies:

- Node 20 install, full synthetic test, synthetic verify, architecture guard, production build
- Node 24 install, full synthetic test, synthetic verify

Final authoritative run and head are recorded in the implementation PR after the last review correction.
