# ADR 0013: Two-stage promotion evidence and explicit visual policy review

## Status

Accepted after post-design review of Toolkit Track `#T6`.

This ADR supersedes sections 6 through 11 of `promotion-policy-v1.md` where a single `PromotionEvidenceBundleV1` appears to exist before the re-attestation, rights, leakage, and visual-mark reviews that it must bind.

## Context

The first T6 design correctly required source revalidation and separate policy reviews, but the artifact ordering contained a circular dependency:

1. operator re-attestation needs the full candidate projection digest;
2. the final promotion evidence must include the re-attestation digest;
3. the original single bundle shape did not distinguish those two stages.

The first draft also relied too heavily on the T3 operator hint for visible external marks. A promotion decision requires an explicit visual policy review of the canonical image. Finally, role separation cannot be checked unless the T5 reviewer/adjudicator actor set is reconstructed from the referenced immutable submissions.

## Decision

### 1. Source snapshot is assembled first

```ts
type PromotionSourceSnapshotV1 = {
  schemaVersion: "promotion-source-snapshot-v1";
  promotionKey: string;
  candidate: {
    candidateId: string;
    candidateDigest: string;
    fullProjectionDigest: string;
    canonicalSha256: string;
    canonicalObjectRelativePath: string;
  };
  generation: {
    purpose: string;
    specDigest: string;
    promptDigest: string;
    providerProfileId: string;
    providerProfileVersion: string;
    exactReproductionAvailable: boolean;
  };
  observation: {
    runId: string;
    observationDigest: string;
    g2RecordDigest: string;
  };
  judgment: {
    consensusDigest: string;
    alignmentDigest: string;
    g3RecordDigest: string;
    submissionDigests: string[];
    judgmentActorIds: string[];
    judgmentActorSetDigest: string;
  };
  claims: {
    requiredAxes: string[];
    claimValues: Array<{ axis: string; value: unknown }>;
    claimValuesDigest: string;
    excludedClaims: string[];
  };
  provenanceProjection: unknown;
  leakageInputs: unknown;
  policy: {
    id: "bejewely-promotion-policy-v1";
    version: "1.0.0";
    policyDigest: string;
  };
  assembledAt: string;
  sourceSnapshotDigest: string;
};
```

The source snapshot is derived only from stored T3/T4/T5 artifacts. It contains no promotion reviewer decision.

### 2. Every policy review references the exact source snapshot

The following artifacts include `sourceSnapshotDigest`:

- `PromotionOperatorReattestationV1`
- `UsageRightsReviewV1`
- `PromotionAssetPolicyReviewV1`
- `PromotionLeakageReviewV1`

A review created for one source snapshot cannot be reused after any source field changes.

### 3. Visible-mark status requires explicit visual policy review

```ts
type PromotionAssetPolicyReviewV1 = {
  schemaVersion: "promotion-asset-policy-review-v1";
  candidateId: string;
  sourceSnapshotDigest: string;
  canonicalSha256: string;
  reviewerId: string;
  visibleExternalMark: "absent" | "present" | "uncertain";
  prohibitedTransformationDetected: boolean;
  canonicalImageReviewed: true;
  reviewedAt: string;
  reviewDigest: string;
};
```

Rules:

- only `absent` can proceed to G4 review;
- `present` blocks G4;
- `uncertain` holds;
- the T3 operator hint is compared for consistency but is not the final visual authority;
- no crop, cleanup, watermark removal, retouch, or replacement is allowed.

### 4. Rights evidence uses a digest, not a raw URL

`UsageRightsReviewV1` stores:

- `sourceSnapshotDigest`
- internal policy reference ID/version
- `sourcePolicyEvidenceDigest`
- review scope and status

It does not store raw terms-page URLs, account identifiers, cookies, or session information.

### 5. Role separation uses reconstructed T5 actor IDs

The source assembler reads every submission digest referenced by the consensus and reconstructs the sorted pseudonymous T5 actor set. Promotion review validation requires:

```text
promotionReviewerId not in judgmentActorIds
```

This is an operational role-separation check. It does not prove distinct physical identity.

### 6. Final evidence bundle is assembled after policy reviews

```ts
type PromotionEvidenceBundleV1 = {
  schemaVersion: "promotion-evidence-bundle-v1";
  promotionKey: string;
  sourceSnapshotDigest: string;
  operatorReattestationDigest: string;
  rightsReviewDigest: string;
  assetPolicyReviewDigest: string;
  leakageReviewDigest: string;
  policyDigest: string;
  assembledAt: string;
  bundleDigest: string;
};
```

The final promotion review and decision bind this `bundleDigest`.

### 7. Preflight is split into two deterministic stages

```text
source_preflight
→ source snapshot, write 0

policy_review_preflight
→ verify exact re-attestation / rights / asset / leakage reviews
→ final evidence bundle, write 0

promotion_confirm
→ immutable review submission
→ decision
→ optional G4 + activation event
```

No stage silently generates a human review result.

## Consequences

### Positive

- Circular evidence ordering is removed.
- Visible-mark status is visually reviewed instead of inferred from an operator hint.
- Promotion role separation is verifiable from stored T5 submission artifacts.
- Rights, leakage, and re-attestation artifacts cannot be replayed across changed source evidence.
- Final review and decision bind one compact, complete bundle digest.

### Negative

- T6 requires two preflight layers and one additional visual-policy artifact.
- Source assembly must read T5 judgment submissions, not only the consensus summary.
- More immutable artifacts must be registered before promotion confirmation.

## Implementation constraints

- The package root exposes authority-checked orchestration, not raw bundle constructors.
- `source_preflight` and `policy_review_preflight` perform zero writes.
- Every policy review rejects a mismatched source snapshot or candidate ID.
- Visual review accepts only enum values and no authoritative free text.
- Tests must prove that changing the operator hint, canonical SHA, T5 actor set, rights evidence, asset review, or leakage review invalidates bundle reuse.
