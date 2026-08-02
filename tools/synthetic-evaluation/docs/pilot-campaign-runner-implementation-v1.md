# Synthetic Evaluation Toolkit #T7

# Pilot Campaign Runner Implementation v1

## Status

- Toolkit Track: `#T7`
- Branch: `feature/T7-pilot-campaign-runner`
- Base: `design/T7-pilot-campaign-runner`
- Production integration: none
- Actual campaign execution: none
- Generation Provider execution: none
- Automatic human review or promotion: none
- T8 report and T9 split/G5 authority: excluded

## Runtime flow

```text
fixed campaign plan
→ source freeze
→ deterministic 20 slots
→ 4/8/8 wave issue
→ manual generation handoff
→ T3 candidate registration
→ explicit T4 authorization and observation registration
→ T5 judgment / consensus / alignment registration
→ T6 evidence and decision registration
→ append-only projection and closeout
```

## Implemented boundaries

### Fixed denominator

- A/B/C/D each have five primary slots.
- The primary denominator is exactly 20.
- Retry reserve cannot create new primary slots.
- Every registered candidate and terminal outcome remains attached to its original slot.
- Low G4 yield, misalignment, valid ineligibility, hold, and rejection cannot trigger replacement.

### Source freeze

The run freezes:

- T2 fixture object and finalized spec digests
- compiled-prompt schema and compiler version
- generation Provider profile, version, digest, and template
- T3 import contract
- T4 observation contract and adapter profile
- T5 judgment and alignment policy versions
- T6 promotion policy ID and version

Stored source freezes have two checks:

1. intrinsic digest integrity for historical readability;
2. comparison with the current implementation before wave issue, checkpoint continuation, or resume.

This prevents later code changes from making old evidence unreadable while still blocking new work on a drifted run.

### Manual generation boundary

T7 compiles one work packet per slot attempt but does not call an image Provider. A handoff may contain only a safe relative asset path, fixed outcome enum, pseudonymous operator ID, and required synthetic/rights attestations. Account IDs, email, cookies, authorization headers, tokens, raw responses, chat transcripts, prompt screenshots, and absolute paths are prohibited.

### Retry and observation recovery

- generation: maximum two attempts per slot;
- campaign generation attempts: maximum 30;
- generation retry reserve: maximum 10;
- retry allowed only for technical no-output/transfer/import-format failures before candidate registration;
- authoritative or valid-ineligible T4 results cannot be retried;
- T4 technical failures require a new explicit authorization and consume recovery budget;
- authoritative observation objects and technical failure run manifests remain distinct.

### Cross-stage binding

T3 registration must match the exact T7 slot work packet and successful handoff:

- condition ID
- finalized spec digest
- compiled prompt digest
- Provider profile ID/version

Subsequent stages are bound to the current slot evidence:

- candidate ID and canonical image SHA
- T4 run ID, run digest, and observation object digest
- T5 assignment, consensus, and alignment references
- T6 source snapshot, evidence bundle, policy reviews, promotion review, decision, G4 record, and status event

T6 decisions are re-derived from their verified evidence before T7 records them.

### Event ledger and storage

- one linear run chain;
- one linear chain per slot;
- branch, cycle, duplicate digest, disconnected predecessor, and event-after-terminal are invalid;
- immutable content-addressed JSON storage;
- deterministic projection rather than mutable progress rows;
- single writer claim for multi-file operations;
- stale claim recovery requires an explicit expected digest and recovery artifact.

### Checkpoints and closeout

- Wave 1: 4 slots;
- Wave 2: 8 slots;
- Wave 3: 8 slots;
- Wave 2/3 require exactly one prior `continue` checkpoint;
- checkpoint readiness ends at authoritative T4 or an allowed technical terminal;
- T5/T6 completion is not required to issue the next wave;
- `stop` explicitly terminates every unissued future slot;
- closeout requires all 20 slots to be terminal;
- active G4 references are an as-of snapshot only; T9 must revalidate current T6 status.

## Review corrections applied

1. Replaced serialization-order-dependent budget validation with exact named-field validation.
2. Split source-freeze integrity from current-source drift detection.
3. Added source preflight before any wave event, checkpoint continuation, or resume write.
4. Corrected T4 valid-ineligible detection to use the normalized eligibility status.
5. Separated technical T4 failure runs from authoritative observation objects and recovery accounting.
6. Required two exhausted generation attempts before `generation_failed_no_asset`.
7. Bound T3 candidates to the exact slot packet, handoff, condition, spec, prompt, and Provider.
8. Bound T4/T5/T6 registrations to the current candidate and preceding artifact digests.
9. Re-derived T6 promotion decisions from the full verified evidence set before registration.
10. Reconstructed campaign state only from validated immutable artifacts and linear event chains.
11. Made idempotent wave issue report the number of newly written packets rather than planned slots.
12. Allowed checkpoints for technically complete waves while preserving the T4-or-technical-terminal boundary.
13. Routed the public package and CLI through source-preflighted and slot-bound operations.

## Verification scope

- fixed 20-slot plan and 4/8/8 wave allocation
- deterministic identities with timestamps excluded
- Provider-profile freeze and reference-only profile rejection
- safe generation handoff and sensitive-data rejection
- branch/disconnection/cycle and illegal transition rejection
- candidate replacement and cross-condition registration rejection
- two-attempt retry cap and reserve accounting
- valid-ineligible versus technical observation failure separation
- exact checkpoint gating, pause/stop, future-slot cancellation, and closeout
- immutable storage and writer-claim behavior
- public CLI/API authority paths
- no Provider, browser, database, shell, image transformation, automatic review, automatic promotion, G5, split, or holdout path
