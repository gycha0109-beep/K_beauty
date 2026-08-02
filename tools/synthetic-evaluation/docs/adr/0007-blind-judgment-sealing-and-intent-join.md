# ADR 0007: Blind judgment sealing before intent join

## Status

Accepted for Toolkit Track `#T5` design.

## Context

#T4 emits a verified `BlindJudgmentInputV1` containing only the canonical image reference and structured observation. #T2/#T3 retain the intended generation targets and campaign provenance.

If a reviewer or consensus engine sees the intended target before judging the image, the result is vulnerable to confirmation bias. Passing a full candidate manifest and asking code or operators to ignore intent is not a process-level blind boundary.

T4 observation is also not human consensus. It is an authoritative model observation run suitable for G2 evidence, but it must not be silently treated as Gold or as one of the independent human reviewers.

## Decision

1. Blind judgment, consensus, and intent alignment are separate modules and commands.
2. Blind judgment input schemas reject purpose, spec, prompt, campaign, condition, grouping, operator hint, and intended-label fields.
3. Judgment and consensus storage domains do not read generation artifacts.
4. A consensus artifact must be immutable and sealed before the intent resolver can run.
5. The intent resolver reads only the finalized `GenerationSpec` referenced by the verified candidate manifest.
6. Compiled prompt prose, filenames, condition IDs, and operator hints are not target sources.
7. Fixture observation authority is rejected before assignment creation.
8. A T4 observation run may derive `G2_OBSERVED`; only independent human consensus may derive `G3_CONSENSUS_VALIDATED`.
9. Candidate and observation artifacts remain unchanged. Judgment, consensus, alignment, and grade records are append-only domains.

## Consequences

### Positive

- Confirmation bias is controlled structurally rather than by convention.
- The distinction between intended, observed, judged, and consensus values is auditable.
- Intent cannot leak through prompt text, filenames, or campaign metadata.
- T4 fixture and Provider-backed authority remain distinguishable.
- A failed or disputed candidate remains useful for campaign diagnostics without becoming Gold.

### Negative

- The workflow requires at least two phases and separate artifacts.
- Reviewers cannot use intended targets to resolve ambiguity.
- More storage and integrity checks are required.
- Crash recovery must preserve claims without silently allowing a second submission.

## Rejected alternatives

### Full manifest passed to the judge with a policy to ignore intent

Rejected because the blind boundary would depend on discipline rather than process isolation.

### Intent displayed after the reviewer opens the image but before submission

Rejected because the final judgment could still be changed to fit the target.

### T4 model observation counted as one reviewer

Rejected because model observation and independent human adjudication have different authority and error modes.

### Prompt text parsed as the intended target

Rejected because prompt wording is Provider-specific output, while `GenerationSpec` is the canonical semantic contract.

### Consensus and alignment written into the candidate manifest

Rejected because it would mutate G0 provenance and couple independent domains.

## Implementation constraints

- Architecture tests must reject generation/import runtime imports from blind judgment and consensus modules.
- Judgment request validation must fail on unknown intent-bearing fields.
- Consensus input must contain submission digests and observation references only.
- Intent alignment must verify consensus digest, candidate identity, spec digest, and observation integrity before comparison.
- No network, Provider, browser, database, production route, or batch execution is introduced by #T5 v1.
