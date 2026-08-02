# ADR 0021: Blind/Annotated Review and Immutable Report Revisions

## Status

Accepted for #T8 design.

## Context

T8 must provide practical visual review and human-readable reporting without altering canonical evidence or turning post-hoc review into a new judgment gate.

Two additional risks exist.

1. Showing condition, intent, and outcome on every image from the beginning can bias visual audit.
2. Regenerating a report in place after a renderer or wording correction destroys the audit trail.

## Decision

### Two review surfaces

T8 produces two separate contact sheets.

#### Blind contact sheet

Contains only:

- derived thumbnail
- campaign/run short token
- slot ID
- candidate ID or `no_candidate`

It excludes condition, prompt, generation intent, observation, consensus, alignment, and promotion outcome.

Its purpose is limited to detecting missing, duplicated, corrupted, or incorrectly rendered assets.

#### Annotated analytical sheet

Contains the blind fields plus:

- condition ID
- wave
- stage reached
- terminal outcome
- source-backed warnings
- unresolved hold indicator

It is an analytical display of existing outcomes, not a new review decision.

### Thumbnail derivation

Canonical images remain immutable and read-only.

Thumbnails may only:

- resize inside a fixed bounding box
- preserve aspect ratio
- avoid enlargement
- encode as PNG
- strip metadata

They may not crop, retouch, recolor, remove marks, edit faces, or replace backgrounds.

Every thumbnail is linked to its canonical SHA-256 and its own SHA-256 under a frozen transform policy.

### Report claims

Authoritative report prose is generated only from typed, source-linked interpretation claims.

Free-form operator commentary is non-authoritative and stored separately.

### Immutable revision chain

Reports and export manifests are content-addressed immutable objects.

A correction produces a new report with:

- the same source snapshot digest when only rendering or wording changes
- the predecessor report digest
- a new report digest

A different source snapshot starts a new report lineage.

Report revisions cannot fix upstream T3–T7 conflicts or change terminal/promotion outcomes.

### Current G4 time boundary

The main report always presents G4 as an `as-of-closeout` snapshot.

An optional appendix may re-read current T6 status and report revocations separately with a verification timestamp. It does not rewrite closeout metrics and does not replace T9 verification.

## Consequences

### Positive

- Visual audit can occur without immediate condition/outcome bias.
- Canonical evidence remains untouched.
- External marks and other warnings cannot be hidden by rendering.
- Report corrections remain fully traceable.
- Historical and current G4 status are not conflated.

### Negative

- Two contact sheets increase export size and renderer complexity.
- Typed claims are less flexible than unrestricted narrative.
- A minor wording correction creates a new immutable report object.

## Rejected alternatives

### One annotated contact sheet only

Rejected because it removes the option for a minimally blinded visual audit.

### Reuse canonical images directly in HTML without derived objects

Rejected because display behavior would vary by browser and would not have a frozen transform digest.

### Allow crop for uniform cards

Rejected because crop can hide marks or relevant visual context.

### Overwrite the latest report

Rejected because it destroys revision history and weakens provenance.

### Treat the latest T8 G4 appendix as split authority

Rejected because T9 must independently verify the current T6 status chain.

## Verification implications

Implementation tests must prove:

- blind sheets contain no condition/intent/outcome fields
- annotated sheets retain source-backed warnings
- thumbnails use only the frozen resize policy
- crop, retouch, recolor, and mark-removal paths are absent
- report revision chains are linear and cycle-free
- source snapshot changes start a new report root
- current-status appendices cannot mutate closeout counts or authorize T9 placement
