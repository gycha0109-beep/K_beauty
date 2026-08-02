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
→ T4 authority re-verification
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
stored-alignment.js
alignment.js
grades.js
alignment-registrar.js
cli/align.js
```

The intent-aware process runs only after a sealed consensus artifact has been read and verified. `stored-alignment.js` then reloads the referenced T4 run and observation object, verifies their digests and authority, reconstructs the canonical blind handoff, and compares it with the sealed consensus before alignment or grade derivation.

## Implemented contracts

`@bejewely/face-contracts` now owns:

- judgment axis registry
- blind assignment and submission schema versions
- pseudonymous judge ID rules
- strict axis decision validation
- consensus shape and per-axis status
- intent alignment shape
- derived G2/G3 grade record shape

Unknown keys, free-text authoritative notes, direct purpose/condition fields, invalid enum values, and inconsistent skin absence/count/region combinations fail closed. An unreviewable submission cannot assert observed axis values.

## Consensus

- minimum two unique `human_reviewer` submissions
- reviewer submissions must reference the same assignment and observation
- model output is not counted as a reviewer
- fixture observation cannot create the authoritative T4 blind input
- per-axis result: `agreed | unresolved | unavailable | not_reviewed`
- region arrays are canonicalized as sets before agreement comparison
- disagreement remains `needs_adjudication`
- a separate `human_adjudicator` may resolve only an existing disagreement
- consensus identity excludes timestamps and contains no generation intent
- status and per-axis results are semantically cross-validated, not accepted by digest alone

## Alignment

Before alignment, the stored orchestrator re-verifies:

- T4 run manifest and observation object integrity
- `authority = observed_image`
- `execution.mode = provider_bounded`
- candidate ID, observation run ID, observation digest, and canonical image SHA linkage
- candidate schema/state and candidate identity digest
- finalized GenerationSpec identity and digest
- compiled prompt digest and spec reference
- Provider profile reference
- campaign and lineage linkage

The alignment engine then selects purpose-required gate and target axes. It does not use a numeric average. A required mismatch yields `misaligned`; a required unresolved/unavailable axis yields `unverifiable`.

Feature cue strength remains diagnostic and `unverifiable` in v1. `paired_skin_edit` cannot claim identity preservation and cannot become promotion-review eligible. `mixed_control_pilot` remains promotion blocked.

Alignment verification recomputes the sorted required-axis digest, rejects duplicate axis results, requires every required axis to have a gate or target result, cross-checks required-axis verdicts against the overall verdict, and validates promotion-review eligibility constraints.

## Derived grades

- `G2_OBSERVED`: re-verified authoritative, non-fixture T4 observation only
- `G3_CONSENSUS_VALIDATED`: purpose-scoped required axes all have agreed blind consensus values
- G3 does not mean the values match the generation intent
- promotion review requires both purpose-scoped G3 and `overallVerdict = aligned`
- alignment confirmation registers both G2 and G3 rather than creating G3 without its observation-grade source
- grade verification recomputes the required-axis digest and checks G2/G3 scope semantics
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

Stored relative paths are reconstructed from validated IDs and digests instead of trusted from manifests. Manifest extra fields, path redirection, and recomputed outer digests over semantically invalid artifacts fail closed. Consensus, alignment, and grade identities intentionally exclude timestamps; repeated writes with a different timestamp return the first valid immutable artifact rather than conflicting or replacing it.

## Review corrections applied during implementation

1. Assignment issue originally accepted a caller-supplied blind bundle. It now reconstructs the bundle only from verified T4 run/object artifacts.
2. A combined registrar caused blind commands to load intent-aware modules transitively. It was split into `blind-registrar.js` and `alignment-registrar.js`.
3. Missing generation artifact references now fail before safe-path resolution.
4. Architecture tests enforce that blind modules contain no purpose/spec/prompt/campaign/condition dependency.
5. Region arrays are normalized as unordered sets before consensus comparison.
6. Consensus status, required-axis scope, overall verdict, promotion eligibility, and G2/G3 scope are semantically checked in addition to digest verification.
7. Submission and alignment manifest object paths are reconstructed from validated identifiers and digests.
8. Timestamp-excluded identities preserve the first valid stored artifact on idempotent replay.
9. Unreviewable submissions are prohibited from retaining observed axis claims.
10. A sealed consensus originally could reach the pure alignment function without reloading its T4 source artifacts. The CLI and public package API now use only `prepareStoredJudgmentAlignment()`, which re-verifies T4 authority and returns both G2 and G3 sources.
11. Raw assignment, consensus, intent-resolution, alignment, and grade-derivation constructors were removed from the package root export; only authority-checked orchestration and integrity readers remain public.

## Verification scope

- contract validation and tamper rejection
- deterministic assignment/submission/consensus/alignment identities
- independent reviewer and adjudication policy
- partial consensus without purpose leakage
- region-order equivalence
- A/B/C/D skin alignment cases
- feature strength limitation
- visible-mark promotion hold
- manifest-last registration and orphan-claim blocking
- path-redirection rejection
- semantic idempotency across timestamp changes
- recomputed-digest semantic tamper rejection
- end-to-end stored T4 authority re-verification before alignment and G2/G3 derivation
- public API authority boundary
- production dependency boundary
- no Provider, browser, DB, shell, batch, G4, or G5 execution path
