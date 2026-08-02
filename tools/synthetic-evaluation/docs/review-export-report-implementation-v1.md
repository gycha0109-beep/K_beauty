# Synthetic Evaluation Toolkit #T8

# Review / Export / Report Implementation v1

## Status

- Toolkit Track: `#T8`
- Branch: `feature/T8-review-export-report`
- Base: `design/T8-review-export-report`
- Production integration: none
- Actual campaign execution: none
- Actual human report review: none
- Public publishing: excluded
- Split, holdout, and G5 authority: excluded

## Runtime flow

```text
stored T7 plan / run / slots / ledger / projection / closeout
+ referenced T2–T6 evidence
→ source preflight
→ immutable evidence snapshot
→ exact slot rows
→ fixed-denominator metrics
→ blind and annotated review package
→ explicit human report review
→ immutable descriptive report
→ deterministic internal export
```

## Source authority

T8 does not trust caller-supplied counts or labels. Source preflight:

1. reloads the T7 campaign bundle;
2. re-derives the event projection;
3. requires a closed run and exactly 20 terminal slots;
4. compares the stored projection byte-semantically with the re-derived projection;
5. verifies closeout event heads, checkpoints, active G4 references, holds, and non-Gold decisions;
6. reloads every referenced T2–T6 artifact;
7. verifies canonical image bytes against the T3 SHA-256;
8. verifies T4 observation authority, T5 consensus/alignment, and the complete T6 promotion evidence chain.

Technical terminal slots without downstream artifacts remain valid evidence rows. T8 does not invent missing T3–T6 evidence.

## Identity layering

```text
CampaignEvidenceSnapshotV1
→ CampaignMetricSetV1
→ CampaignReviewPackageV1
→ ReportReviewSubmissionV1
→ CampaignReportV1
→ CampaignExportManifestV1
```

- evidence snapshot identity excludes `capturedAt`;
- report-review identity excludes `reviewedAt`;
- report identity has no generation timestamp;
- export identity excludes `generatedAt` but includes every file descriptor;
- renderer or exporter version changes do not rewrite upstream evidence identity.

## Exact denominator

Each run must contain:

```text
20 primary slots
A = 5
B = 5
C = 5
D = 5
```

Rates use the planned primary denominator. Technical failures, valid-ineligible observations, incomplete judgments, non-Gold retention, holds, rejections, and cancellations remain in the table and denominator.

T8 produces no adjusted yield, filtered denominator, aggregate score, winner, rank, significance test, or causal conclusion.

## Provider comparison

A two-run comparison is accepted only when:

- `comparisonGroupId` is identical and non-null;
- generation Provider profile differs;
- objective, matrix, campaign policy, and every non-Provider source-freeze field are identical.

Output is limited to counts, rates, count deltas, and percentage-point deltas. Ranking, significance, and causal attribution remain `null`.

## Review package

### Blind view

The blind contact sheet omits:

- condition and generation intent;
- observed values and eligibility;
- consensus and alignment;
- promotion outcome;
- campaign run ID, slot ID, and candidate ID;
- source artifact paths.

It uses a deterministic `blind_<digest>` review-item ID and a separate blind thumbnail alias.

### Annotated view

The annotated sheet displays the slot, condition, wave, stage, terminal outcome, mark hint, row digest prefix, and warnings for evidence audit.

### Images

- source canonical bytes are never copied into the export;
- canonical SHA-256 is checked before rendering;
- thumbnails use pinned `sharp`;
- EXIF orientation is applied;
- resize uses `inside` and `withoutEnlargement`;
- no crop, retouch, compositing, color correction, sharpening, or mark removal;
- deterministic PNG output is used;
- blind and annotated thumbnail paths are separate.

## Report review and claims

Report confirmation requires a pseudonymous reviewer and five explicit `true` checks:

- source integrity reviewed;
- denominator reviewed;
- claims reviewed;
- unresolved holds visible;
- contact sheets reviewed.

The runtime does not auto-fill these approvals.

Authoritative report text is generated only from typed metric references. Unsupported adjectives, causal wording, clinical interpretation, and identity or demographic inference are prohibited. Free-form commentary is not part of the authoritative report artifact.

## Storage and revision

- content-addressed immutable JSON objects;
- immutable review assets;
- source snapshot, artifact index, slot table, metric set, thumbnail index, and review package are cross-checked before storage;
- writer claims serialize multi-object operations;
- a predecessor report may have exactly one successor claim;
- revisions never overwrite historical reports;
- export files are staged, renamed, and receive the manifest last;
- existing exports are re-hashed before idempotent reuse;
- incomplete or path-conflicting exports fail closed;
- symbolic-link path components are rejected.

## G4 time boundary

T8 reports G4 only as `as_of_closeout`. It does not claim current activation status and does not provide split or G5 authority. T9 must reload the current T6 status chain before dataset placement or lock.

## Review corrections applied

1. Required explicit human review checks instead of auto-asserting review completion.
2. Added full stored T7 projection and closeout linkage checks.
3. Re-verified canonical bytes and the complete referenced T3–T6 chain.
4. Added exact row, condition, and run denominators.
5. Separated evidence, metric, review, report, and export identities.
6. Added strict Provider-only comparison compatibility.
7. Removed actual run, slot, and candidate identifiers from the blind package and its asset paths.
8. Stored a separate immutable thumbnail index and verified every review asset before export.
9. Added a single-successor claim to prevent report-revision branching.
10. Added manifest-last export publication, full existing-file rehash, and incomplete-export rejection.
11. Rejected symbolic-link report roots and nested path components.
12. Kept all public package exports on authority-checked orchestration paths.

## Verification scope

- exact 20-slot and A/B/C/D denominators;
- terminal-outcome preservation;
- evidence and metric tamper rejection;
- Provider comparison drift rejection;
- explicit human review checks;
- source-linked deterministic claims;
- blind identifier leakage regression;
- resize-only thumbnail policy;
- canonical JSON, LF CSV, and accessible HTML;
- timestamp-excluded identities;
- immutable storage and idempotent export;
- single-successor report revisions;
- T7 closeout source preflight;
- no Provider, browser, database, shell, public upload, split, holdout, G5, or production path.
