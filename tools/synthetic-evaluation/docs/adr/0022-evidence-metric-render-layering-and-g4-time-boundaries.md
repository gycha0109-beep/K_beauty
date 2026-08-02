# ADR 0022: Evidence/Metric/Render Layering and G4 Time Boundaries

## Status

Accepted after independent self-review of the initial #T8 design.

This ADR supersedes `review-export-report-v1.md` where the main document places exporter/report-policy fields inside the source snapshot or leaves timestamp identity ambiguous.

## Context

The initial T8 design correctly separates reporting from T2–T7 authority, but self-review found three precision gaps.

1. An exporter or renderer version inside the source snapshot would make the same upstream evidence acquire a new source identity after a rendering change.
2. A later T6 revocation must not invalidate the historical integrity of a report that explicitly describes the closeout time boundary.
3. Review and generation timestamps inside semantic digests would break idempotent retry without adding evidence authority.

## Decision

### 1. Three immutable layers

T8 uses three distinct identities.

```text
CampaignEvidenceSnapshotV1
→ CampaignMetricSetV1
→ CampaignReportV1 / CampaignExportManifestV1
```

#### CampaignEvidenceSnapshotV1

Contains only verified upstream evidence identity:

- T7 plan/run/slot/ledger/projection/closeout digests
- T3–T6 referenced artifact digests
- canonical asset verification index
- comparison key when applicable

It excludes:

- report policy
- metric-engine version
- exporter version
- renderer version
- review identity
- output paths
- timestamps

The same upstream evidence therefore retains the same evidence snapshot digest across renderer or wording revisions.

#### CampaignMetricSetV1

Binds:

- evidence snapshot digest
- exact 20 slot rows
- metric policy ID/version/digest
- metric-engine version
- condition and terminal summaries

A metric policy or engine change creates a new metric-set digest without changing the evidence snapshot.

#### CampaignReportV1 and CampaignExportManifestV1

Bind:

- evidence snapshot digest
- metric-set digest
- typed claim set
- review submission digest
- exporter/renderer versions
- predecessor report digest when revising

Rendering changes create a new report/export object under the same evidence snapshot and, when metrics are unchanged, the same metric-set digest.

### 2. Historical T6 verification

The baseline report verifies that the T6 decision, G4 grade record, and activation/status artifact referenced by T7 were intrinsically valid at the T7 closeout boundary.

A later valid revocation:

- does not invalidate the historical evidence snapshot
- does not rewrite the closeout G4 count
- appears only in an optional current-status appendix

A malformed or missing historical activation artifact still blocks the report.

### 3. Current-status appendix

The optional appendix has a separate digest and `verifiedAt` timestamp.

It is not part of the immutable closeout metric set and cannot authorize T9 placement.

### 4. Timestamp identity

The following timestamps are metadata excluded from semantic identity digests:

- source capture time
- metric generation time
- review submission time
- report render time
- export generation time

Identity is determined by source digests, policy/version, reviewer identity and decisions, claims, and predecessor relationships.

Timestamp format and presence are still validated.

### 5. Review submission

Report review is a separate immutable `CampaignReportReviewSubmissionV1` artifact.

It binds:

- evidence snapshot digest
- metric-set digest
- claim-set digest
- reviewer ID
- required checklist decisions

The report references the review submission digest rather than embedding mutable review state.

## Consequences

### Positive

- Upstream evidence identity is stable across renderer changes.
- Metric-policy changes are visible without pretending the source changed.
- Historical closeout reports remain valid after later revocation.
- Idempotent retries do not create new semantic objects because clocks differ.
- Report review has an explicit immutable provenance object.

### Negative

- T8 implementation has more artifact types.
- Current G4 status requires a separate appendix and cannot be folded into the baseline metric set.
- Report storage and revision logic must distinguish evidence, metrics, claims, review, and rendering layers.

## Rejected alternatives

### Keep exporter version in the source snapshot

Rejected because rendering software is not upstream campaign evidence.

### Treat later revocation as historical report corruption

Rejected because revocation changes current status, not the truth of the earlier closeout snapshot.

### Include timestamps in every semantic digest

Rejected because harmless retries would create different identities.

### Embed review directly in report state

Rejected because it weakens content-addressed review provenance and complicates revision lineage.

## Verification implications

Implementation tests must prove:

- renderer/exporter changes do not change evidence snapshot digest
- metric-policy changes change metric-set digest only
- report wording/render revisions preserve evidence snapshot digest
- valid later revocation preserves historical report integrity
- malformed historical T6 activation blocks report creation
- timestamp-only changes preserve semantic identities
- report cannot publish without a valid immutable review submission
