# Synthetic Evaluation Toolkit #T5

# Judgment & Intent Alignment Implementation v1

## Status

- Toolkit Track: `#T5`
- Branch: `feature/T5-judgment-intent-alignment`
- Base: `design/T5-judgment-intent-alignment`
- Production integration: none
- Provider execution: none
- Actual human judgments: none
- G4/G5 promotion: excluded

## Runtime flow

```text
authoritative T4 observation artifacts
→ blind assignment
→ pseudonymous human submission claim
→ immutable submission
→ intent-free per-axis consensus
→ sealed complete or partial consensus
→ verified T3 candidate + finalized T2 GenerationSpec
→ purpose-specific alignment
→ G2/G3 derived records
```

## Process separation

Blind runtime modules:

```text
assignment.js
submission.js
consensus.js
blind-registrar.js
prepare-assignment.js
cli/judge.js
cli/consensus.js
```

These modules do not import generation contracts, candidate intent resolvers, alignment policy, or grade derivation.

Intent-aware runtime modules:

```text
intent-resolver.js
read-intent-artifacts.js
alignment.js
grades.js
alignment-registrar.js
cli/align.js
```

The intent-aware process runs only after a sealed consensus artifact has been read and verified.

## Implemented contracts

`@bejewely/face-contracts` now owns:

- judgment axis registry
- blind assignment and submission schema versions
- pseudonymous judge ID rules
- strict axis decision validation
- consensus shape and per-axis status
- intent alignment shape
- derived G2/G3 grade record shape

Unknown keys, free-text authoritative notes, direct purpose/condition fields, invalid enum values, and inconsistent skin absence/count/region combinations fail closed.

## Consensus

- minimum two unique `human_reviewer` submissions
- reviewer submissions must reference the same assignment and observation
- model output is not counted as a reviewer
- fixture observation cannot create the authoritative T4 blind input
- per-axis result: `agreed | unresolved | unavailable | not_reviewed`
- disagreement remains `needs_adjudication`
- a separate `human_adjudicator` may resolve only an existing disagreement
- consensus identity excludes timestamps and contains no generation intent

## Alignment

The intent resolver verifies:

- candidate schema/state and candidate identity digest
- canonical image SHA reference
- finalized GenerationSpec identity and digest
- compiled prompt digest and spec reference
- Provider profile reference
- campaign and lineage linkage

The alignment engine then selects purpose-required gate and target axes. It does not use a numeric average. A required mismatch yields `misaligned`; a required unresolved/unavailable axis yields `unverifiable`.

Feature cue strength remains diagnostic and `unverifiable` in v1. `paired_skin_edit` cannot claim identity preservation and cannot become promotion-review eligible. `mixed_control_pilot` remains promotion blocked.

## Derived grades

- `G2_OBSERVED`: authoritative, non-fixture T4 observation only
- `G3_CONSENSUS_VALIDATED`: purpose-scoped required axes all have agreed blind consensus values
- G3 does not mean the values match the generation intent
- promotion review requires both purpose-scoped G3 and `overallVerdict = aligned`
- no G4/G5 command exists

## Storage

```text
.synthetic-local/
  judgment/
    claims/
    submissions/
    manifests/
    consensus/
  alignment/
    objects/
    manifests/
  grades/
```

Claims are written before submissions. Submission objects are content addressed and manifests are published last. Existing claims without a valid manifest block hidden resubmission. Candidate and observation artifacts remain unchanged.

## Review corrections applied during implementation

1. Assignment issue originally accepted a caller-supplied blind bundle. It now reconstructs the bundle only from verified T4 run/object artifacts.
2. A combined registrar caused blind commands to load intent-aware modules transitively. It was split into `blind-registrar.js` and `alignment-registrar.js`.
3. Missing generation artifact references now fail before safe-path resolution.
4. Architecture tests enforce that blind modules contain no purpose/spec/prompt/campaign/condition dependency.

## Verification scope

- contract validation and tamper rejection
- deterministic assignment/submission/consensus/alignment identities
- independent reviewer and adjudication policy
- partial consensus without purpose leakage
- A/B/C/D skin alignment cases
- feature strength limitation
- visible-mark promotion hold
- manifest-last registration and orphan-claim blocking
- production dependency boundary
- no Provider, browser, DB, shell, batch, G4, or G5 execution path
