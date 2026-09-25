# TRUST Phase 8H-0 — Source Frontier Audit Snapshot

## Snapshot

Production readback at `2026-09-25T12:43:19.141738+09:00` identified 38 Product Evidence Sources. Two sources already have Phase 8G verification profiles; 36 sources form the current unprofiled frontier.

The committed JSON inventory contains those 36 rows and is a point-in-time evidence snapshot. The audit implementation is not coupled to that count.

## What this PR establishes

- A bounded, reusable frontier classifier built on the existing governed official-source fetch boundary.
- Explicit separation between transport state and relocation authority.
- Deterministic handling for same-locator success, redirects, terminal 404/410, transient failures, and blocked sources.
- A read-only contract: no Product Fact, Evidence Source, Source Binding, Recommendation, or revalidation mutation is permitted.
- A manual live-audit path can probe the committed frontier and upload the JSON result as a CI artifact without committing or writing Production state.

## What this PR intentionally does not do

- It does not patch any URL.
- It does not create a relocation.
- It does not infer same Product/Subject/formulation from a redirect.
- It does not create Phase 8G profiles for the 36 sources.
- It does not transition any Product Fact to re-review.
- It does not create Evidence Candidates.

The next slice consumes only transport signals that require investigation and adds exact identity qualification plus governed relocation lineage.
