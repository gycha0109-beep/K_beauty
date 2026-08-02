# ADR 0014: Campaign Orchestration Without New Judgment Authority

## Status

Accepted for #T7 design.

## Context

T2–T6 already define distinct authorities:

- T2: generation intent and compiled prompt
- T3: candidate provenance and canonical asset
- T4: observed image facts
- T5: blind human consensus, alignment, G2/G3
- T6: purpose-scoped G4 and non-Gold disposition

A pilot campaign runner must repeat those stages over multiple candidates. A naïve batch runner could accidentally become a new authority by copying values, resolving disagreements, interpreting aggregate yield, or replacing failed candidates.

## Decision

T7 is an orchestration authority only.

It may authoritatively state:

- which immutable campaign plan is active
- which fixed slot a candidate belongs to
- which budget was consumed
- which checkpoint permits a later wave
- which T2–T6 artifact digest is linked
- which append-only slot/run event is current
- whether a run is active, paused, stopped, or closed

It may not authoritatively state:

- what the image contains
- what human reviewers agree on
- whether generation intent matched observation
- whether a candidate deserves G4
- whether the campaign succeeded scientifically
- where a candidate belongs in a dataset split

T7 stores references to T2–T6 artifacts rather than copying their semantic payloads.

## Consequences

### Positive

- Existing label and promotion boundaries remain intact.
- Resume and batch orchestration do not weaken blind review.
- A campaign can be audited without trusting a mutable status table.
- T8 and T9 retain clear downstream responsibilities.

### Negative

- T7 cannot automatically fill missing reviews or resolve holds.
- Campaign progress pauses at human or Provider authorization boundaries.
- Reporting requires a separate T8 consumer.

## Rejected alternatives

### One campaign result object containing copied observation and consensus values

Rejected because copied values can drift from their source objects and create a second authority.

### Aggregate campaign score

Rejected because mandatory failures could be hidden by unrelated successful slots.

### Runner-generated human review defaults

Rejected because it would fabricate human authority.

### T7-owned split assignment

Rejected because split leakage and G5 locking belong to T9.

## Verification implications

Implementation tests must prove:

- T7 projection contains references/counts, not copied semantic labels
- T4/T5/T6 tampering is detected by source digest verification
- no reviewer or promotion decision is synthesized
- no split or G5 contract is exported
- production code does not import T7
