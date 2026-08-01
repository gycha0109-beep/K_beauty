# ADR 0002 — Generation Compiler Implementation Resolution

- Status: Accepted and implemented for Toolkit Track `#T2`
- Date: 2026-08-02
- Scope: Synthetic Evaluation Toolkit only
- Depends on: ADR 0001

## Review findings before implementation

The design review found five points that required a concrete implementation decision rather than an implicit default.

1. The primary design document still showed the pre-ADR caller-owned `specId` and exclusion array shapes.
2. Several proposed face-feature axes were not exact observation-contract terms.
3. Decimal archetype weights had no exact representation rule.
4. Reference-edit capability had not been verified for any current Provider surface.
5. A compiler could accidentally hard-code the fixture subject instead of compiling subject fields from the spec.

## Decision 1 — Draft validation and finalization are executable boundaries

The implementation accepts only `DraftGenerationSpecV1` fields. Caller-supplied `specId`, `specDigest`, exclusions, prompt fragments, and Provider parameters are rejected by exact-shape validation.

Finalization performs:

```text
exact validation
→ semantic payload normalization
→ canonical JSON
→ SHA-256 digest
→ generated specId
→ deeply frozen finalized spec
```

`createdAt` and `notes` are retained in the finalized audit object but excluded from the semantic digest. Target fields and registry versions remain in the digest.

## Decision 2 — Feature cues use the observation-backed registry only

The v1 generation cue profile contains these exact visible axes:

- `eyeDirection`
- `eyeOpenness`
- `faceLengthBalance`
- `jawlineAngularity`
- `straightCurveBalance`
- `featureContrast`

A spec may request one to four cues at `subtle` or `moderate` strength. Free text, animal-type tokens, unsupported axes, and exaggerated strength are rejected.

The compiler does not infer an archetype from these cues and does not infer cues from an archetype.

## Decision 3 — Archetype taxonomy remains disabled

No final archetype taxonomy or scoring contract is approved in the current source basis. Therefore:

```text
ENABLED_ARCHETYPE_TAXONOMIES = {}
```

Any non-null `archetypeIntent` fails with `archetype_taxonomy_unavailable`.

This is intentional. The toolkit must not silently convert example labels or historical prompt language into an authoritative taxonomy.

When a taxonomy is approved later, its weights use integer basis points:

```text
10000 bps = 1.0
```

Declared weight keys must exactly match the declared archetype tokens and sum to 10,000. Floating-point normalization is not used.

## Decision 4 — Reference edit is fail-closed

The current profiles are:

- `gemini-image-manual-v1`
- `gpt-image-manual-v1`
- `sdxl-comfyui-reference-v1`

All currently declare `referenceImage: false` because no stable capability contract was verified for the exact execution surface. A valid paired-edit draft can be represented, but compilation fails with `reference_capability_required` for every current profile.

A future profile may enable reference input only after capability verification and a new profile version.

## Decision 5 — Subject fields compile dynamically

Age band, presentation, and the optional Korean appearance hint are compiled from the validated spec. Prompt snapshots use the A/B/C/D fixture subject, but the compiler does not hard-code that fixture.

## Implementation boundary

Implemented:

- exact GenerationSpec validation
- canonical semantic payload and SHA-256 identity
- frozen exclusion registry
- observation-backed feature cue registry
- disabled-until-approved archetype taxonomy boundary
- Gemini and GPT manual prose profiles
- SDXL reference-only profile with the previously tested parameter hints
- A/B/C/D skin-control fixtures
- frozen Gemini prompt snapshots
- deterministic prompt digest
- deep immutability
- architecture checks for production imports, network calls, browser automation, and image writes

Not implemented:

- Provider API or browser execution
- image generation
- candidate import
- reference-image transfer
- archetype taxonomy or scoring
- observation, judgment, consensus, or promotion
- database, API route, UI, or production integration

## Verification contract

```text
npm run synthetic:test
npm run synthetic:verify
npm run architecture:guard
npm run build
```

The synthetic suite covers validation failures, digest behavior, exact prompt snapshots, Provider capability failure, raw animal-token exclusion, deep immutability, and production dependency direction.
