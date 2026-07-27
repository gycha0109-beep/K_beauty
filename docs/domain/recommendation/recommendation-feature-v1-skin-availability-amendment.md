# Recommendation Feature V1 — Skin Availability Amendment

- Status: authoritative clarification for PR #74 shadow contract
- Scope: Skin legacy shadow adapter only
- Supersedes: the unqualified `availability` wording in section 8 of `recommendation-feature-contract-v1.md`

## 1. Problem

The canonical observation may be available even when a legacy numeric `0~5` signal cannot yet be produced.

```text
visible redness = mild
→ observation exists
→ non-zero quantisation is unresolved
→ legacy numeric signal is not available
```

A single `availability` boolean cannot represent all three facts safely.

## 2. Required axis state

Each legacy Skin axis exposes three independent booleans.

```ts
type SkinLegacyShadowAxisState = {
  observationAvailable: boolean;
  quantizationResolved: boolean;
  legacySignalAvailable: boolean;
};
```

Meaning:

- `observationAvailable`: canonical visible-cue support has `status === "available"`.
- `quantizationResolved`: the observed level has an approved mapping to the legacy numeric range.
- `legacySignalAvailable`: the shadow numeric signal may be compared with or supplied to a legacy consumer.

The existing top-level `availability` map is retained only as a compatibility alias for `legacySignalAvailability`.

```text
availability
=
legacy numeric signal availability
≠
canonical observation availability
```

The adapter emits `metadata.availabilityMeaning = "legacy_numeric_signal_available"` so the alias cannot be interpreted as observation availability.

## 3. State matrix

| Canonical source | Observation available | Quantisation resolved | Legacy signal available | Signal | Quantisation status |
|---|---:|---:|---:|---:|---|
| observed `none` | true | true | true | 0 | `resolved_absence` |
| observed `mild` | true | false | false | 0 | `unresolved_non_zero` |
| observed `moderate` | true | false | false | 0 | `unresolved_non_zero` |
| observed `high` | true | false | false | 0 | `unresolved_non_zero` |
| `insufficient_evidence` | false | false | false | 0 | `unavailable` |
| `unavailable` | false | false | false | 0 | `unavailable` |
| `unsupported` | false | false | false | 0 | `unsupported` |

A compatibility zero never implies observable absence unless all of the following are true:

```text
observationAvailable = true
quantizationResolved = true
legacySignalAvailable = true
quantizationStatus = resolved_absence
```

## 4. Comparison contract

Shadow comparison uses `legacySignalAvailable`, not observation availability.

```text
comparable
=
legacySignalAvailable
AND direct legacy signal exists
```

For an observed non-zero cue:

```text
shadowObservationAvailable = true
shadowQuantizationResolved = false
shadowLegacySignalAvailable = false
comparable = false
```

This prevents an unresolved compatibility zero from being compared as if it were a real predicted zero.

## 5. Production boundary

This amendment does not activate the adapter.

- Existing Provider direct Skin signals remain authoritative.
- Existing concern, product, routine, Premium, and saved-report outputs remain unchanged.
- Non-zero quantisation remains unresolved.
- The alias `availability` remains shadow-only and means legacy numeric availability.
- No API response, persistence, analytics, or log field is added.

## 6. Regression requirements

The adapter verifier must separately assert:

1. observed non-zero cue: observation true, quantisation false, legacy signal false;
2. observed absence: all three true with signal zero;
3. unavailable cue: all three false with compatibility zero;
4. unsupported UV: all three false;
5. comparison is false unless the legacy signal is available;
6. Face held lifecycle and production invariance remain unchanged.
