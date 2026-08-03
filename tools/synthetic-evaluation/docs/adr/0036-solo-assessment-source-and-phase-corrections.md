# ADR 0036 — Solo Assessment Source and Phase Corrections

- Status: Accepted; supersedes conflicting #T11 main-design wording
- Date: 2026-08-03
- Scope: #T11 source readiness, screening schema, and target relation

## Context

The first #T11 draft contained four design problems.

1. `singleAdultSyntheticPerson` implied that a human could confirm synthetic origin from pixels.
2. R-03 required a T4 support/dispute relation, but the screening schema did not model it and could expose T4 values before the operator recorded an independent image assessment.
3. A terminal T4 technical failure was classified as technical-only even when a valid T3 canonical image existed and remained visually assessable.
4. `contradictory` target relation allowed source-contract conflicts to survive into a report instead of failing source preflight.

A fifth boundary was also underspecified: a new T11 session should not be created after a sealed T5 consensus already exists for the slot.

## Decision

### 1. Synthetic origin remains source authority

Replace the human field:

```text
singleAdultSyntheticPerson
```

with:

```ts
apparentSingleAdultPerson: "confirmed" | "rejected" | "uncertain";
```

Synthetic provenance is not a pixel judgment. It is derived from verified T3 attestation and represented separately:

```ts
syntheticBoundarySourceVerified: true;
realPersonReferenceAttestation: "absent";
```

If the T3 synthetic boundary is invalid or missing, session preparation fails before human screening.

### 2. Use three ordered phases

The authoritative order becomes:

```text
image-only target-withheld screening
→ T4 observation reveal and comparison
→ T2 intent reveal and target relation
```

The first screening projection contains only the canonical image and non-semantic review item ID. It excludes both target intent and T4 structured observation values.

After screening is sealed, the system may create:

```ts
type SoloObservationRevealReceiptV1 = {
  schemaVersion: "solo-observation-reveal-receipt-v1";
  sessionDigest: string;
  reviewItemId: string;
  screeningDigest: string;
  observationRunId: string | null;
  observationObjectDigest: string | null;
  availability:
    | "authoritative_observed"
    | "authoritative_valid_ineligible"
    | "technical_failure_no_observation";
  revealedAt: string;
  revealDigest: string;
};
```

When an authoritative T4 object exists, the operator records a separate comparison:

```ts
type SoloObservationComparisonV1 = {
  schemaVersion: "solo-observation-comparison-v1";
  observationRevealDigest: string;
  operatorId: string;
  eligibilityRelation: "supports" | "disputes" | "uncertain";
  rednessRelation: "supports" | "disputes" | "uncertain" | "not_available";
  blemishRelation: "supports" | "disputes" | "uncertain" | "not_available";
  comparisonDigest: string;
};
```

The comparison never mutates T4.

### 3. Terminal observation failure can remain visually assessable

Replace readiness class `technical_observation_failure` with two explicit classes:

```ts
| "assessable_observation_failed"
| "technical_observation_failure_no_candidate"
```

`assessable_observation_failed` requires:

- valid T3 candidate manifest
- canonical image SHA verified
- legal T7 terminal `observation_failed`
- no authoritative T4 observation object

The operator may perform image-only screening and intent assessment. T4 comparison is `not_available`. The Wave brief preserves both facts:

```text
human exploratory image assessment present
T4 authoritative observation unavailable
```

### 4. Source conflict fails closed

Remove `contradictory` from target relation values.

Allowed relation:

```ts
"exact_match" | "under_target" | "over_target" | "unverifiable"
```

A mismatch among condition ID, fixture ID, finalized GenerationSpec, compiled prompt, T7 packet, or T3 manifest is not an assessment outcome. It is:

```text
solo_intent_source_conflict
```

and prevents intent reveal and Wave brief confirmation.

### 5. Do not start new solo assessment over sealed T5 consensus

Session preparation requires no sealed T5 consensus for the selected slot.

```text
T5 consensus absent → T11 session may start
T5 consensus appears later → existing T11 history remains, new revision prohibited
T5 consensus already present → new T11 session rejected
```

This avoids creating a weaker parallel judgment after stronger authority exists.

## Supersession map

This ADR supersedes conflicting wording in `solo-pilot-assessment-v1.md`:

- R-03 and screening phase order
- `singleAdultSyntheticPerson` field in section 9.5
- `technical_observation_failure` readiness treatment in sections 8 and 9
- `contradictory` target relation in sections 9.7 and 10
- any implication that T4 values appear before image-only screening is sealed

All other main-design decisions remain active.

## Consequences

### Positive

- Synthetic provenance is grounded in T3 rather than visual guesswork.
- Human image observation is not anchored by T4 output.
- A usable image is still learnable when T4 has a terminal technical failure.
- Source corruption cannot be misreported as a target mismatch.
- T11 cannot compete with an existing T5 consensus.

### Negative

- One additional reveal/comparison phase is required when T4 observation exists.
- More artifact types and ordering tests are needed.
- `observation_failed` slots require careful dual reporting.

## Verification requirements

- image-only screening projection contains no T4 or T2 values
- synthetic boundary derives only from verified T3 source
- T4 reveal is impossible before screening seal
- T2 intent reveal is impossible before screening and any applicable T4 comparison are sealed
- observation-failed slot with canonical image is assessable and labeled T4-unavailable
- source intent conflict fails preflight rather than producing a relation
- existing T5 consensus blocks new T11 session
