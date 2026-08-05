# SharedSkinDecisionContext v4

## Status

Authoritative current-main canonical decision context for Premium Functional, Routine, Condition, consistency, snapshot, and reentry processing.

## Producer and consumers

```text
survey + normalized Vision projection + current products
→ SharedSkinDecisionContext v4
→ FunctionalPolicy / RoutinePolicy / ConditionPolicy
→ CrossDomainConsistency
→ premium-decision-bundle-v5
→ Premium session / saved snapshot / reentry
```

`premium-decision-state.js` imports v4 directly. Raw provider responses are not context input and are never serialized into the bundle.

## Compatibility model

v4 is an additive completeness projection over the durable v3 normalization. Legacy reports are rebuilt into v4. A stored unsupported context version is not trusted as canonical input; durable report facts are normalized again and a new v4 hash is produced.

The version identifier is:

```text
shared-skin-decision-context-v4
```

## Unknown and boolean semantics

- Missing numeric concern evidence remains `null`, not zero.
- Missing booleans remain unknown where the source contract permits unknown.
- Explicit `false` is not treated as missing.
- `skinType=not_sure` becomes `unknown`.
- Texture burden is not inferred from pores.
- Product reaction and recent-product change remain unlinked unless product-specific evidence exists.

## Photo state

```ts
photo: {
  status:
    | "available"
    | "not_provided"
    | "unavailable"
    | "insufficient_evidence"
    | "ineligible"
    | "unknown",
  source,
  failureReason,
  failureClass:
    | "provider_unavailable"
    | "provider_failure"
    | "technical_failure"
    | "input_ineligible"
    | "input_insufficient"
    | "not_provided"
    | null,
  eligibility,
  analysisEligible: true | false | null,
  observations,
  evidenceAvailable,
  factsMayBeInferred: false
}
```

Provider unavailability, provider failure, technical failure, ineligible input, and insufficient evidence are distinct. None becomes a redness, blemish, or other skin-condition signal.

## Canonical completeness states

v4 adds or completes:

- `skinState`: skin type, sensitivity, and per-axis burdens;
- `concernState`: known/unknown axes and survey/photo alignment;
- `photo`: bounded evidence and failure taxonomy;
- `productExposureState`: selected, unknown, unused, unanswered, functional axes, unresolved linkage;
- `uncertaintyState`: explicit reasons and confidence ceiling;
- evidence-ledger rows for skin, concern, photo, exposure, reaction linkage, and uncertainty.

## Serialization and persistence

The v4 context, hash, and revision are stored inside the Premium decision bundle. The bounded `photoEvidenceState` and normalized `imageEligibility` survive Premium session, saved snapshot, and reentry. Provider raw response and original image bytes do not.

Anonymous free-result persistence keeps only the bounded state and normalized eligibility contract. Face Lab payload, analyze metadata, credentials, and provider artifacts remain outside that boundary.

## Determinism

The context hash covers canonical facts and evidence. Identical evidence preserves the prior revision. A material evidence change, legacy-to-v4 migration, or unsupported stored context produces a new hash/revision.

## Verification

The focused verifier covers valid, legacy, missing, explicit false, null, unknown, unsupported version, extra key, invalid enum, partial provider result, provider unavailable/failure, technical failure, ineligible input, insufficient evidence, current-product states, deterministic revision, and caller import authority.

## Non-targets

No recommendation score/eligibility activation, Admin schema, DB migration, catalog write, Provider call, or CandidateExposurePolicy activation is part of v4.
