# ADR 0035 — T7 Terminal Compatibility and Observation-Failure Checkpoint

- Status: Accepted for #T11 design
- Date: 2026-08-03
- Scope: T7 compatibility required for a solo exploratory Pilot

## Context

A T11 solo assessment must not become a new T7 terminal outcome. T7 already has truthful outcomes for a run that reaches T4 but does not complete independent T5 review:

```text
judgment_incomplete
```

Technical outcomes also exist for generation, import, and observation failure. However the current T7 projection treats only generation/import/cancellation terminals as checkpoint-ready technical outcomes. `observation_failed` is a legal terminal transition but is omitted from `TECHNICAL_TERMINALS`.

This creates an inconsistent state:

```text
observation recovery exhausted
→ slot terminal = observation_failed
→ checkpointReady = false
→ Wave can never reach awaiting_checkpoint
```

## Decision

### Solo assessment remains outside the T7 event ledger

T11 artifacts do not add a T7 event type or terminal outcome.

For an assessable slot without real T5 review, the operator may explicitly terminate it through existing T7 authority as:

```text
T7 terminal = judgment_incomplete
T11 assessment = operator_exploratory_assessment
```

This preserves the distinction between no authoritative T5 consensus and the presence of a solo exploratory assessment.

### Observation failure correction

The T11 implementation PR may make one narrow T7 correction:

```text
TECHNICAL_TERMINALS += observation_failed
```

The correction applies only when all existing T7 state-machine conditions for `observation_failed` are already satisfied:

- at least one observation run occurred
- no authoritative observation object exists
- allowed recovery was exhausted or the operator explicitly terminalized the slot under T7 policy
- the terminal event is valid and immutable

No new retry, terminal, or Provider authority is introduced.

## Consequences

### Positive

- A Wave containing a terminal observation failure can progress to a checkpoint.
- Solo assessment does not pollute T7 event semantics.
- T8 later reports `judgment_incomplete` and `observation_failed` truthfully.
- Existing T7/T8 schemas remain backward compatible.

### Negative

- T11 must coordinate with separate T7 terminal commands.
- `judgment_incomplete` may look harsh in the T8 report unless the optional T11 appendix is read alongside it.
- The implementation touches one pre-existing T7 source file and requires full regression verification.

## Rejected alternatives

### Add `solo_assessed` as a T7 terminal outcome

Rejected because T7 terminals represent the T2–T6 authoritative pipeline, while T11 is a separate exploratory authority.

### Treat solo assessment as sealed consensus

Rejected because one operator cannot create independence.

### Leave `observation_failed` non-checkpoint-ready

Rejected because a valid terminal state must not permanently block the Wave.

### Auto-terminal slots after T11 submission

Rejected because T7 terminalization can foreclose later real T5 review and must remain an explicit operator action.

## Verification requirements

- 3 observed + 1 terminal `observation_failed` Wave 1 reaches `awaiting_checkpoint`
- non-terminal observation transport failure remains not ready
- recovery-authorized pending observation remains not ready
- observed bundle remains ready as before
- T11 does not append any T7 event
- `judgment_incomplete` remains the only truthful T7 terminal for observed slots without T5 consensus
