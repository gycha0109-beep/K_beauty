# ADR 0009: Axis-level blind consensus and purpose-scoped G3

## Status

Accepted after post-design review of Toolkit Track `#T5`.

This ADR supersedes any wording in `judgment-intent-alignment-v1.md` that makes the blind consensus engine depend on purpose-specific “critical axes” or requires a single all-or-nothing `consensus_reached` state before intent join.

## Context

The first #T5 design draft correctly separated judgment from generation intent, but its consensus section still referred to agreement on “critical axes.” Critical gate and target axes are selected by `GenerationSpec.purpose`, so a blind consensus engine cannot know them without receiving intent metadata. That would reintroduce the exact intent leak the design is intended to prevent.

Requiring exact agreement on every axis in the full registry is also unnecessarily restrictive. Reviewers may disagree on a diagnostic axis that is irrelevant to the candidate’s later purpose while agreeing on every axis required for that purpose.

## Decision

### 1. Consensus is computed per axis

The blind consensus engine receives only:

- candidate and observation references
- immutable judgment submission digests
- the intent-free judgment axis registry
- the intent-free consensus policy

For every registry axis it emits one of:

```text
agreed
unresolved
unavailable
not_reviewed
```

It does not label an axis as gate, target, diagnostic, or critical.

### 2. Partial consensus may be sealed

```ts
type JudgmentConsensusStatusV1 =
  | "sealed_complete"
  | "sealed_partial"
  | "needs_adjudication"
  | "unreviewable";
```

- `sealed_complete`: every required registry axis has an agreed or valid unavailable result under the intent-free registry policy.
- `sealed_partial`: at least one axis is agreed, while one or more axes remain unresolved or unavailable.
- `needs_adjudication`: conflicting submissions require an explicit intent-blind adjudicator.
- `unreviewable`: the image cannot support a valid review.

A sealed artifact is immutable. Adjudication creates a new consensus artifact referencing the prior submissions and adjudicator submission; it does not overwrite the earlier artifact.

### 3. Intent join selects purpose-required axes only after sealing

After a `sealed_complete` or `sealed_partial` consensus exists, the intent resolver verifies the canonical `GenerationSpec`. The alignment policy then selects:

- purpose-required gate axes
- purpose-target axes
- diagnostic axes

An unresolved or unavailable purpose-required gate/target axis yields `unverifiable`. A disagreement on an irrelevant diagnostic axis does not block otherwise valid alignment.

### 4. G3 is purpose-scoped

`G3_CONSENSUS_VALIDATED` is not a candidate-global claim. It is a derived record scoped to the axes required by a specific validated purpose policy.

```ts
type DerivedGradeRecordV1 = {
  schemaVersion: "derived-grade-record-v1";
  gradeRecordId: string;
  candidateId: string;
  grade: "G2_OBSERVED" | "G3_CONSENSUS_VALIDATED";
  scope: {
    purpose: string | null;
    policyId: string;
    policyVersion: string;
    requiredAxes: string[];
    requiredAxesDigest: string;
  };
  sourceDigests: string[];
  recordedAt: string;
  gradeRecordDigest: string;
};
```

- G2 uses `purpose = null` and the authoritative T4 observation scope.
- G3 is created only when every gate/target axis required by the resolved purpose policy has an agreed blind consensus value.
- G3 does not mean the values match the intended target. A purpose-scoped G3 may coexist with `misaligned`.
- Promotion review eligibility requires both purpose-scoped G3 and `overallVerdict = aligned`.

### 5. Terminology corrections

- The capture axis is `capture.apparentAdultSinglePhotorealisticHuman`, not `capture.photorealisticSingleAdult`, to avoid claiming exact age verification from appearance.
- The paired-edit mismatch state is the canonical overall verdict `misaligned`, not an undeclared `target_mismatch` token.

## Consequences

### Positive

- Blind consensus remains structurally independent from generation intent.
- Irrelevant diagnostic disagreements do not block target evaluation.
- The G3 claim has an explicit, auditable scope.
- A consensus-valid but intentionally misaligned candidate can be retained as a negative/control example without being promoted.

### Negative

- Consensus artifacts and grade records require per-axis scope metadata.
- Alignment cannot use a single boolean consensus state.
- Implementations must distinguish unresolved, unavailable, and not-reviewed axes precisely.

## Implementation constraints

- Consensus modules must not import generation, candidate-manifest, or alignment-policy modules.
- Consensus schema must contain per-axis results and no purpose/spec/condition fields.
- Alignment accepts only immutable `sealed_complete` or `sealed_partial` artifacts.
- Required-axis selection occurs only after verified intent join.
- G3 grade identity includes the sorted required-axis list and its digest.
- Tests must prove that changing purpose changes the G3 scope but never changes the sealed blind consensus artifact.
