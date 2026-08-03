# ADR 0032 — Solo Assessment Authority Without Fake Consensus

- Status: Accepted for #T11 design
- Date: 2026-08-03
- Scope: Synthetic Evaluation Toolkit only

## Context

T5 requires at least two independent reviewers and an intent-blind adjudicator when necessary. T6 additionally requires role-separated policy and promotion review. The current project is operated by one person, so those requirements cannot be honestly satisfied during the first Pilot.

Creating multiple pseudonymous IDs for the same person would preserve schema shape but falsify independence. Weakening T5/T6 would contaminate all later G3/G4/G5 claims.

## Decision

Create a distinct authority domain:

```text
operator_exploratory_assessment
```

This domain:

- requires exactly one pseudonymous operator
- records structured image and cue assessment
- can produce Wave-level descriptive briefs
- cannot produce T5 submission, consensus, G2/G3, T6 decision, G4, G5, or dataset membership
- cannot be converted into a T5 submission later
- remains useful even when T7 slot terminal outcome is `judgment_incomplete`

The implementation must not import or invoke T5 consensus builders, T5 grade derivation, T6 promotion orchestration, or T9 dataset lock APIs.

## Consequences

### Positive

- A solo operator can execute and learn from the Pilot now.
- Existing Gold and dataset authority remains intact.
- Reports can state exactly what was and was not reviewed.
- Future independent review can be added without pretending the earlier solo assessment was consensus.

### Negative

- Solo results cannot be called validated Gold data.
- T7 closeout will preserve `judgment_incomplete` for assessable slots unless real T5 review is later performed.
- T11 and T8 outputs remain separate authority layers.

## Rejected alternatives

### Multiple IDs for one operator

Rejected because identity aliases do not create independence.

### Reduce T5 minimum reviewers to one

Rejected because it changes the meaning of sealed consensus and G3.

### Auto-promote solo-aligned candidates

Rejected because alignment and promotion require separate evidence and role boundaries.

### Treat T4 Provider observation as the second reviewer

Rejected because T4 is a model observation, not an independent human judgment.

## Verification requirements

- schema enforces `actorCount = 1`
- no T5/T6/T9 artifact constructor accepts a T11 artifact
- package root exports no solo-to-consensus conversion
- architecture test proves production and Gold paths do not import T11
- reports always include `single_operator` and `not_gold_evidence`
