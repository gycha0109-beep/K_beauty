# ADR 0019: Report Source Snapshot and Derived Metric Authority

## Status

Accepted for #T8 design.

## Context

T7 closeout intentionally contains machine-readable references and counts only. T8 must produce richer tables and reports without becoming a new observation, judgment, promotion, or mutable campaign authority.

There are three failure modes to avoid.

1. Copying T7 summary counts without reconstructing the underlying slot evidence can preserve a corrupted or stale projection.
2. Copying full T2–T6 payloads into a report creates duplicate authority and increases the tamper surface.
3. Letting a renderer assign new status labels can silently rewrite upstream decisions.

## Decision

T8 uses a three-layer model.

```text
verified upstream artifacts
→ immutable CampaignReportSourceSnapshotV1
→ deterministic slot rows and metric set
→ reviewed report and export renderings
```

### Source snapshot

The source snapshot binds:

- T7 plan, run, slots, ledger, final projection, and closeout digests
- verified T3–T6 artifact references
- canonical image integrity results
- the exact 20-row slot evidence digest
- report policy and exporter version

It does not copy or replace the authoritative contents of T2–T7 objects.

### Derived metric authority

T8 metric values are authoritative only as **deterministic descriptions of the frozen source snapshot**.

They are not authoritative for:

- image facts
- consensus values
- intent alignment
- promotion approval
- current G4 status
- dataset placement

Every metric is recomputed from validated slot evidence rows. Caller-supplied totals or percentages are never accepted.

### Report rendering

JSON, CSV, contact sheets, and HTML reports are projections from the same source snapshot and metric set. A renderer cannot introduce a new terminal outcome, stage result, or grade.

### Failure behavior

Any missing, conflicting, redirected, or invalid source artifact blocks authoritative report creation.

T8 cannot repair upstream evidence. Repair requires the owning track or a new campaign lineage.

## Consequences

### Positive

- T8 reports are reproducible from exact source digests.
- Upstream authority remains singular.
- Corrupt summary counts cannot bypass row-level reconstruction.
- Multiple render formats remain semantically aligned.

### Negative

- Report generation must reload and verify a substantial source graph.
- Missing historical objects block reporting rather than allowing a partial report.
- Renderer-only changes may require a new report revision even when metrics are unchanged.

## Rejected alternatives

### Trust T7 closeout counts directly

Rejected because a count does not prove the completeness or linkage of the 20 underlying slots.

### Embed every upstream object in report.json

Rejected because it duplicates authority and makes report artifacts excessively large and fragile.

### Allow manual correction of a report row

Rejected because a manually edited row would no longer be a deterministic projection of source evidence.

### Let report review approve or revoke G4

Rejected because promotion and status authority belong to T6.

## Verification implications

Implementation tests must prove:

- source snapshot fails when any required source digest or linkage is invalid
- counts are recomputed from exactly 20 rows
- caller-supplied summary values are ignored or rejected
- report and CSV share the same metric-set digest
- renderer cannot introduce an unsupported outcome or grade
- T8 performs no upstream write
