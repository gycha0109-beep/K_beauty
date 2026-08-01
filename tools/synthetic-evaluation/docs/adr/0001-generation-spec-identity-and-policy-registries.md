# ADR 0001 — GenerationSpec Identity and Policy Registries

- Status: Accepted for Toolkit Track `#T2` design
- Date: 2026-08-02
- Scope: Synthetic Evaluation Toolkit only
- Supersedes: ambiguous identity and caller-owned policy wording in `generation-contract-prompt-compiler-v1.md`

## Context

The initial #T2 design placed `specId` inside `GenerationSpecV1` while also deriving `specId` from the canonical semantic payload. If `specId` participates in that payload, the contract becomes circular.

The same design represented required exclusions as a caller-supplied tuple and archetype identifiers as generic strings. Validation could enforce those values, but the shape leaves unnecessary caller-controlled policy surface.

## Decision 1 — Draft and finalized specifications are separate

```ts
type DraftGenerationSpecV1 = {
  schemaVersion: "generation-spec-v1";
  purpose: GenerationPurpose;
  subject: SubjectIntent;
  capture: CaptureIntent;
  appearance: AppearanceIntent;
  featureIntent: FaceFeatureIntent | null;
  archetypeIntent: ArchetypeIntentMetadata | null;
  skinIntent: SkinIntent;
  variation: VariationIntent;
  exclusionPolicyVersion: "reference-portrait-exclusions-v1";
  provenance: SpecProvenance;
};

type FinalizedGenerationSpecV1 = DraftGenerationSpecV1 & {
  specId: string;
  specDigest: string;
};
```

Finalization order is fixed.

```text
DraftGenerationSpecV1
→ validate exact contract
→ construct semantic payload
→ canonical JSON
→ SHA-256 digest
→ derive specId
→ FinalizedGenerationSpecV1
```

The semantic payload excludes:

- `specId`
- `specDigest`
- `provenance.createdAt`
- `provenance.notes`

All target-bearing and policy-version fields remain included.

Recommended ID form:

```text
gen_<first 24 lowercase hex characters of specDigest>
```

A supplied `specId` or `specDigest` is not trusted during draft validation. The finalizer owns both values.

## Decision 2 — Required exclusions are registry-owned

The caller does not submit or modify an exclusions array.

`DraftGenerationSpecV1` contains only:

```ts
exclusionPolicyVersion: "reference-portrait-exclusions-v1";
```

The compiler resolves the exact frozen registry for that version. It fails closed when the version is unknown, disabled, incomplete, or incompatible with the Provider profile.

The v1 registry contains:

- beauty filter
- airbrushed skin
- heavy retouching
- glam makeup
- dramatic lighting
- smile
- head tilt
- side view
- hair occlusion
- stylized rendering
- illustration
- text
- labels
- logo
- watermark
- symbol
- bare shoulders

No `extraPrompt`, `customNegative`, `removeExclusion`, or raw Provider override is allowed.

## Decision 3 — Archetype identifiers are registry-bound metadata

`primary` and `secondary` are taxonomy tokens, not unrestricted free text.

```ts
type ArchetypeIntentMetadata = {
  taxonomyVersion: string;
  primary: RegisteredArchetypeToken;
  secondary: RegisteredArchetypeToken | null;
  intendedWeights: Partial<Record<RegisteredArchetypeToken, number>>;
  compilationMode: "metadata_only";
};
```

Validation requires:

- the taxonomy version exists and is enabled;
- every token belongs to that exact taxonomy version;
- the weight key set equals the declared primary/secondary token set;
- all weights are finite and greater than zero;
- the sum is exactly `1.0` under the contract's decimal representation rule;
- no taxonomy token is emitted directly into the image prompt.

The compiler does not invent archetype-to-feature mappings. `face_feature_control` requires a separately approved cue profile or mapping artifact.

## Decision 4 — Registry versions participate in determinism

The following values are part of prompt identity:

- GenerationSpec schema version
- compiler version
- prompt template version
- ProviderProfile version
- exclusion policy version
- feature cue registry/profile version when used
- archetype taxonomy version when metadata is present

Changing any target-relevant registry requires a new version and a new digest.

## Consequences

### Positive

- no circular `specId` derivation;
- caller cannot weaken mandatory exclusions;
- unregistered taxonomy strings fail closed;
- prompt artifacts remain reproducible and attributable;
- future taxonomy or policy changes do not silently rewrite prior intent.

### Cost

- draft and finalized types must be distinct;
- registries need explicit versioned modules and fixtures;
- an approved feature-cue registry is required before archetype-directed compilation can be implemented.

## Verification requirements for implementation

1. same draft produces byte-identical canonical JSON, digest, ID, and prompt;
2. supplied fake ID/digest is rejected or ignored by the finalizer contract, never trusted;
3. changing only `createdAt` or `notes` preserves semantic digest;
4. changing any target or registry version changes semantic digest;
5. unknown exclusion/taxonomy/cue registry versions fail closed;
6. attempts to remove an exclusion or add free-text prompt fragments fail closed;
7. prompt snapshots contain no raw archetype taxonomy token unless a future explicitly versioned policy authorizes it.

## Non-goals

- implementing the registries;
- defining the final archetype taxonomy;
- defining archetype scoring weights;
- Provider execution;
- image generation;
- observation, judgment, or promotion.
