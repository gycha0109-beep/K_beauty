# ADR 0004 — Candidate Import Implementation Resolution

- Status: Accepted for Toolkit Track `#T3` implementation
- Date: 2026-08-02
- Scope: Synthetic Evaluation Toolkit only
- Supersedes: conflicting logical-digest, transaction, idempotency, mark-provenance, and batch wording in the primary #T3 design

## Context

Implementation review found five gaps that must be closed before code is written.

1. `specDigest` and `promptDigest` are logical digests calculated from selected canonical payloads. They are not byte hashes of the full finalized-spec or compiled-prompt JSON files.
2. Publishing multiple content objects and a manifest cannot be globally atomic across directories. Manifest-last publication can guarantee candidate visibility, while a crash may leave harmless orphan objects.
3. `registeredAt` changes on every attempt and therefore cannot participate in idempotency comparison.
4. The visible four-point mark seen in manual outputs has unverified provenance. Calling it a Provider platform mark would overstate what is known.
5. Multi-candidate batch confirm cannot honestly be all-or-nothing without a batch commit marker or transactional registry.

## Decisions

### 1. Generation artifacts are logical-digest-addressed envelopes

The importer stores canonical full-artifact JSON envelopes under paths keyed by the verified logical digest.

```text
objects/generation/spec/by-digest/<first2>/<specDigest>.json
objects/generation/prompt/by-digest/<first2>/<promptDigest>.json
```

Verification is semantic:

- strip `specId` and `specDigest` from the finalized spec;
- rerun the #T2 finalizer;
- compare the rebuilt logical digest and ID;
- remove `promptDigest` from the compiled prompt;
- stable-stringify and hash the remaining prompt payload;
- compare Provider profile and spec references.

Existing object bytes must equal the canonical full-envelope bytes. The filename is a verified logical digest key, not a claim that the complete envelope bytes hash to that value.

### 2. Candidate publication is atomic; object publication is idempotent

The importer writes immutable objects first and publishes the candidate manifest last with an exclusive create operation.

A crash before manifest publication may leave valid unreferenced objects. Those objects are not registered candidates and may be reported by a later recovery/GC tool.

The implementation must never publish a manifest before every referenced object and asset record exists.

### 3. Idempotency ignores registration time

Candidate identity excludes timestamps and notes. When a candidate manifest already exists:

- verify the immutable identity and object references;
- return `existing_candidate` with `writesPerformed: 0`;
- preserve the original `registeredAt`;
- never regenerate and compare a new timestamped manifest byte-for-byte.

Any immutable identity/reference mismatch is `candidate_identity_conflict`.

### 4. Visible mark provenance stays unverified

The operator hint uses:

```ts
type VisibleExternalMarkHintV1 = {
  status: "present" | "absent" | "unknown";
  location: "bottom_right" | "bottom_left" | "top_right" | "top_left" | "other" | null;
  provenanceStatus: "unverified";
};
```

The importer records only that a visible external mark was reported. It does not identify the source as Gemini, GPT, or another platform and never removes the mark.

### 5. #T3 v1 implements single-candidate confirm only

Single-candidate dry-run and confirm are implemented first.

Batch confirm is deferred until a versioned batch commit-marker contract exists. A future batch runner may provide validation-only dry-run, but it must not claim all-or-nothing confirm without that contract.

## Frozen technical limits

```text
maximum bytes: 25 MiB
minimum width and height: 512 px
maximum width and height: 4096 px
maximum pixels: 16,777,216
allowed decoded formats: PNG, JPEG, static WebP
page/frame count: exactly 1
canonical transform: orientation → sRGB → metadata strip → lossless PNG
```

The existing repository-pinned `sharp@0.35.3` is reused. No image dependency or version is added.

## Consequences

- digest verification matches the actual #T2 algorithms;
- candidate visibility has a precise atomic boundary;
- retries remain stable despite timestamps;
- mark provenance is not overstated;
- batch semantics are not falsely advertised;
- orphan objects are possible but cannot masquerade as registered candidates.

## Verification requirements

1. tampered finalized spec and prompt fail logical-digest verification;
2. existing generation object with different canonical envelope bytes fails closed;
3. a failure before manifest publication leaves no candidate manifest;
4. retry preserves the first `registeredAt` and writes nothing;
5. external mark warnings retain `provenanceStatus: unverified`;
6. no batch-confirm command is exposed in #T3 v1;
7. blind observation projection contains only candidate ID and canonical object reference.
