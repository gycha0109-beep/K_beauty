# ADR 0011: Promotion evidence snapshot and source revalidation

## Status

Accepted for Toolkit Track `#T6` design.

## Context

The T3 candidate identity digest covers generation and asset identity, but it does not cover every field relevant to promotion policy. In particular, operator attestation, operator hints, and duplicate references are stored in the candidate manifest but are not all part of `candidateDigest`.

T5 solves a similar problem for observation and alignment by re-reading stored source artifacts and verifying exact digests before deriving grades. T6 requires an equivalent boundary, but it must not falsely claim that a new digest proves the historical state of fields that were not identity-bound at T3 registration time.

## Decision

### 1. T6 assembles a full promotion evidence projection

The projection includes all policy-relevant data from:

- T3 candidate manifest and generation artifacts
- T4 run manifest and observation object
- T5 consensus, alignment, G2, and G3
- rights review
- leakage review
- promotion operator re-attestation
- exact promotion policy snapshot

The projection is canonicalized and assigned `bundleDigest`.

### 2. Source artifacts are revalidated from storage

T6 does not accept caller-supplied summaries as authoritative input. The assembler reconstructs content-addressed paths from validated IDs and digests, then verifies:

- candidate identity and canonical asset linkage
- finalized GenerationSpec and compiled prompt linkage
- T4 authority and observation source linkage
- T5 consensus/alignment/grade linkage
- exact required-axis and claim-value derivation

### 3. The full candidate projection receives a separate digest

`fullProjectionDigest` covers the current immutable candidate projection including:

- operator attestation
- operator hints
- duplicate references
- provider run provenance
- grouping and lineage

This digest binds T6 review and decision artifacts to the exact state reviewed.

### 4. Re-attestation is required

A `PromotionOperatorReattestationV1` confirms that the operator reviewed the current full projection and again asserts synthetic-only and no-real-person-reference conditions.

This is an operational attestation, not a cryptographic proof of the manifest’s historical state at T3 registration.

### 5. Historical limits remain explicit

T6 must not claim that fields outside T3 candidate identity were tamper-evident before the T6 evidence snapshot. The decision artifact records this limitation. A future T3 manifest v2 may add a full manifest digest, but T6 v1 does not silently retrofit that guarantee.

### 6. Policy changes invalidate prior review reuse

A promotion review is valid only for the exact combination of:

- evidence bundle digest
- policy digest
- rights review digest
- leakage review digest
- operator re-attestation digest

Any change requires a new review and decision.

## Consequences

### Positive

- Promotion is bound to the exact full evidence state seen by the reviewer.
- Caller-provided summaries cannot bypass source integrity checks.
- T3’s current identity limitation is neither ignored nor overstated.
- Policy and evidence upgrades produce auditable new decisions.

### Negative

- T6 evidence is larger and requires multiple immutable source reads.
- The operator must re-attest at promotion time.
- Historical integrity for non-identity T3 fields remains limited until a future manifest version.

## Implementation constraints

- Preflight reads stored artifacts; request JSON may identify candidate/alignment only.
- Full projection and claim arrays use deterministic sorting.
- Prompt prose, raw Provider response, image base64, account identifiers, secrets, and raw terms URLs are excluded.
- Missing source object, unsafe path, digest mismatch, or unknown field fails closed.
- Recomputed outer digests cannot legitimize semantically inconsistent inner references.
- Tests must mutate each policy-relevant source field and prove review reuse is rejected.
