# ADR 0003 — Import Artifact Retention and Registration Outcomes

- Status: Accepted for Toolkit Track `#T3` design
- Date: 2026-08-02
- Scope: Synthetic Evaluation Toolkit only
- Supersedes: ambiguous artifact-reference, quarantine, and path wording in `candidate-import-provenance-v1.md`

## Context

The initial #T3 design correctly separated raw asset identity from candidate identity, but three operational gaps remained.

1. A candidate referenced only `specDigest` and `promptDigest`. A digest proves integrity but does not guarantee the corresponding #T2 artifact can be retrieved after the source file is moved.
2. The quarantine section mixed technical import with later content review. Canonical duplicates and visible platform marks are not technical corruption and must not create a hidden intermediate candidate state.
3. The source-path rules mentioned hard-link ownership, which is not a reliable cross-platform containment guarantee. The import contract should rely on checks that Node and the filesystem can enforce consistently.

## Decision 1 — #T2 artifacts are retained as immutable content-addressed objects

During confirm import, the validated finalized spec and compiled prompt are copied into the local object store.

```text
objects/generation/spec/sha256/<first2>/<specDigest>.json
objects/generation/prompt/sha256/<first2>/<promptDigest>.json
```

The importer must:

1. parse the source artifact;
2. validate its exact contract;
3. rebuild or verify its canonical JSON;
4. verify the declared digest;
5. write the canonical artifact bytes to staging;
6. publish them atomically if the object does not already exist.

Existing objects are never overwritten. Existing bytes must hash to the expected digest or the import fails with `generation_artifact_identity_conflict`.

The candidate manifest stores both digest and object reference.

```ts
type GenerationArtifactReferenceV1 = {
  spec: {
    digest: string;
    objectRelativePath: string;
  };
  compiledPrompt: {
    digest: string;
    objectRelativePath: string;
  };
};
```

This makes the candidate self-contained within the local synthetic data root without copying prompt intent into observed-label fields.

## Decision 2 — v1 has only two committed outcomes

```text
validation failure
→ no committed writes

validation success
→ registered G0 candidate
```

There is no committed `quarantined candidate` state in #T3 v1.

The following are warnings and remain visible in the manifest:

- platform mark present or unknown;
- Provider model label unknown;
- Provider generation ID unknown;
- exact canonical duplicate;
- perceptual neighbors.

They do not block technical registration. Later judgment and promotion policies decide whether the candidate is usable for a specific purpose.

The `quarantine/` directory is reserved only for operator-directed copies of rejected input or stale staging recovery. It is not authoritative and does not contain candidate manifests.

## Decision 3 — path safety uses enforceable containment checks

For the source image and #T2 artifact inputs:

1. the request contains paths relative to configured roots;
2. absolute paths and `..` segments are rejected before filesystem access;
3. the importer resolves the nearest existing parent and final real path;
4. the resolved path must remain inside the configured root;
5. symbolic links are rejected;
6. files are opened by filesystem API, never interpolated into shell commands.

The contract does not claim to determine where a hard-linked inode was originally created. A regular file reachable through an approved contained path is processed by its bytes and hash.

## Decision 4 — canonical orientation may swap axes but never resizes

`canonical-image-v1` applies metadata orientation before metadata removal.

For orientations that rotate by 90 or 270 degrees:

```text
raw width × raw height
→ canonical height × canonical width
```

This is not resizing. Pixel count is preserved. The canonical record stores its actual post-orientation dimensions.

## Decision 5 — T4 receives a blinded import projection

Candidate manifests retain provenance, campaign grouping, and condition metadata, but the default observation adapter must not receive them.

```ts
type BlindCandidateInputV1 = {
  candidateId: string;
  canonicalAsset: {
    sha256: string;
    objectRelativePath: string;
    transformPolicyVersion: "canonical-image-v1";
  };
};
```

Excluded from the T4 default input:

- prompt text;
- `specDigest` and `promptDigest` unless required only for audit after observation;
- `conditionId`;
- intended skin or face-feature targets;
- Provider/model label;
- platform-mark operator hint;
- campaign notes.

A separate post-observation alignment step may read generation provenance.

## Decision 6 — authoritative records are immutable per-object files

Authoritative records:

- raw asset bytes;
- canonical asset bytes;
- finalized spec artifact;
- compiled prompt artifact;
- asset record;
- candidate manifest.

Search indexes, CSV, JSONL, and reports are derivatives and may be rebuilt.

Candidate manifest publication remains the final atomic operation. A manifest must never reference an object that has not already been published.

## Consequences

### Positive

- prompt/spec artifacts remain retrievable after inbox cleanup;
- import state is binary and easy to reason about;
- duplicate and mark warnings cannot silently become quality judgments;
- path checks are cross-platform and implementable;
- T4 observation stays blind to generation intent;
- local registry recovery does not depend on an append-only global file.

### Cost

- more content-addressed object types;
- confirm import writes canonical generation artifact copies;
- implementation needs a reusable atomic object writer;
- observation and alignment require two different manifest projections.

## Verification requirements

1. deleting the original #T2 artifact input does not break an existing candidate;
2. existing generation object with mismatched bytes fails closed;
3. warnings never create a third committed candidate state;
4. platform mark and canonical duplicate warnings still produce `G0_GENERATED` candidates;
5. realpath escape and symbolic-link inputs fail closed;
6. orientation tests verify axis swap without pixel-count change;
7. blind projection contains no condition, prompt, intended target, or Provider fields;
8. manifest is published only after every referenced object exists.

## Non-goals

- deciding dataset eligibility;
- removing platform marks;
- human review workflow;
- near-duplicate rejection threshold;
- cloud storage;
- observation or intent alignment implementation.
