# ADR 0016: Manual Generation Handoff and Single-Provider Runs

## Status

Accepted for #T7 design.

## Context

T2 currently exposes two active pilot generation profiles:

- `gemini-image-manual-v1`
- `gpt-image-manual-v1`

Both use `executionMode = manual_web`. T2 compiles prompts but intentionally does not execute a generation Provider. T3 imports a local candidate and independently verifies its asset/provenance boundary.

A campaign runner that automates browser interaction, searches for credentials, or infers Provider metadata from filenames would exceed the existing contract and create unverifiable provenance.

Mixing providers inside one 20-slot run would also confound condition-level interpretation because provider and condition would vary simultaneously.

## Decision

T7 v1 does not execute image generation.

It issues a `GenerationWorkPacketV1` containing:

- slot and attempt identity
- one frozen provider profile
- finalized spec digest
- compiled prompt digest and artifact reference
- expected image format and dimensions
- blind-boundary restrictions

A human operator returns a `GenerationHandoffV1` containing:

- exact slot and attempt
- provider profile identity
- compiled prompt digest
- safe relative asset path, or a no-asset failure outcome
- synthetic-only, real-person-reference, and import-rights attestations

The handoff stores no account, browser, token, raw response, transcript, or absolute-path information.

Each campaign run uses exactly one generation provider profile. Provider comparison uses separate run identities under an optional shared `comparisonGroupId`.

## Consequences

### Positive

- T7 remains compatible with existing T2 contracts.
- No browser automation or credential handling is introduced.
- Provider provenance is explicit and auditable.
- Provider comparison can be performed without mixing causal factors within a run.

### Negative

- Image generation remains operator-assisted.
- Exact reproduction is unavailable for manual profiles.
- Campaign throughput is lower than a fully automated generator.

## Rejected alternatives

### Browser automation against consumer generation interfaces

Rejected because it would add session/credential handling and brittle UI automation outside T2.

### Automatic Provider selection per slot

Rejected because it makes the campaign matrix non-comparable and hides provider drift.

### Filename-based Provider inference

Rejected because filenames are not authoritative provenance.

### Storing screenshots or chat transcripts

Rejected because they can contain account/session data and are unnecessary for T3 import authority.

## Verification implications

Implementation tests must prove:

- no generation Provider transport exists in T7
- one provider profile per run
- handoff profile and prompt digest match the work packet
- only safe relative asset paths are accepted
- sensitive account/session fields are rejected
- Provider changes require a new run identity
