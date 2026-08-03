# ADR 0033 — Target-Withheld Screening Before Intent Reveal

- Status: Accepted for #T11 design
- Date: 2026-08-03
- Scope: Solo Pilot assessment ordering

## Context

The solo operator manually generates the image and may remember the intended A/B/C/D condition. Therefore a true blind review cannot be claimed. Showing the target again before image assessment would still increase confirmation bias and would make it easy to enter the intended value rather than the observed value.

The system can reduce, but not eliminate, this risk by withholding target fields in the assessment surface until the operator seals an image-based screening.

## Decision

Use a two-stage process:

```text
target-withheld review item
→ immutable screening
→ verified intent reveal
→ deterministic target relation
→ operational assessment
```

The first-stage projection excludes:

- slot ID
- condition ID
- fixture ID
- finalized GenerationSpec
- compiled prompt
- intended skin cue
- generation Provider metadata

The projection uses a non-semantic `reviewItemId` whose private mapping to the actual slot is stored separately.

The screening records capture quality, reviewability, structured skin observation, and artifact flags. It must also record:

```text
priorTargetKnowledgePossible = true
priorTargetKnowledgeAcknowledged = true
```

After the screening artifact is saved and verified, the intent resolver reads the T2/T3 source directly. Caller-provided target values are prohibited.

## Correction policy

- Before intent reveal: one linear predecessor-linked screening correction is allowed.
- After intent reveal: screening replacement is prohibited.
- A later discovered mistake is stored as `post_reveal_annotation`; it does not change the primary target-withheld screening.
- Intent assessment revisions are append-only and cannot rewrite an already linked T7 checkpoint.

## Consequences

### Positive

- The operator must record what appears in the image before seeing the target in the tool.
- Target relation is derived rather than manually asserted.
- The artifact honestly states that prior memory may still exist.
- Intent data cannot leak through caller-controlled fields.

### Negative

- This is not a scientific blind review.
- More than one command or UI phase is required per image.
- Post-reveal mistakes cannot be silently corrected.

## Rejected alternatives

### Call the process blind

Rejected because the generator and reviewer are the same person.

### Show condition and ask for a pass/fail

Rejected because it collapses observation and intent comparison and encourages confirmation bias.

### Let the operator type the intended cue

Rejected because the target must come from verified T2 artifacts.

### Allow rewriting screening after reveal

Rejected because it destroys the ordering evidence.

## Verification requirements

- static contract test rejects forbidden target fields in screening projection
- reveal operation fails without a valid screening digest
- reveal operation resolves T2/T3 intent from storage
- screening update after reveal fails closed
- private review map is excluded from exported brief
- review item identifier does not expose condition or slot identity
