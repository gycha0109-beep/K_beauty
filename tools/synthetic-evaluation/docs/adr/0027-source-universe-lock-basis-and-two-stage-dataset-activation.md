# ADR 0027: Source universe, lock basis, and two-stage dataset activation

## Status

Accepted for Toolkit Track `#T9` design after independent self-review.

This ADR is normative and supersedes conflicting wording in:

- `leakage-aware-dataset-lock-v1.md` sections 5.1, 13–17, and 20;
- ADR 0025 wording that places exposure/G5 indexes directly inside the first dataset manifest;
- ADR 0026 wording that can be read as creating active G5 before a final dataset activation boundary.

## Context

The initial T9 design had two important defects.

First, an explicit candidate/G4 digest list in the source request could permit candidate-level cherry-picking even though T7 campaigns have fixed denominators.

Second, the initial object graph was circular:

- dataset member records referenced `datasetVersionDigest` while the dataset manifest included the member-index digest;
- exposure claims and G5 records referenced `datasetVersionDigest` while the same manifest included exposure/G5 index digests.

No stable content-addressed identity can satisfy those cycles. The design also needed one final authority boundary so that a crash cannot leave an apparently active dataset with only some exposure or G5 records published.

## Decision

### 1. V1 source selection is universe-based, not candidate-list-based

```ts
type DatasetSourceRequestV1 = {
  schemaVersion: "dataset-source-request-v1";
  datasetId: string;
  datasetLineageId: string;
  purpose: string;
  useScope: "internal_evaluation_only";
  sourceUniverse:
    | {
        selectionMode: "single_closed_run";
        campaignRunId: string;
        includeAllCurrentActiveG4: true;
      }
    | {
        selectionMode: "all_closed_runs_in_comparison_group_as_of_cutoff";
        comparisonGroupId: string;
        cutoffAt: string;
        includeAllCurrentActiveG4: true;
      };
  requestedAt: string;
};
```

V1 does not accept an arbitrary candidate or G4 digest allowlist.

For comparison-group mode, T9 verifies that every locally stored closed run in the group at or before the cutoff is included. For single-run mode, every current active purpose-compatible G4 from that closed run is considered.

Invalid, inactive, incompatible, or unresolved records are retained in explicit exclusion/quarantine rows. They are not silently omitted by the caller.

### 2. Review submission has semantic and full-object digests

```ts
type DatasetLockReviewSubmissionV1 = {
  schemaVersion: "dataset-lock-review-submission-v1";
  sourceSnapshotDigest: string;
  leakageGraphDigest: string;
  splitPlanDigest: string;
  assignmentDigest: string;
  reviewer: {
    reviewerId: string;
    role: "dataset_lock_reviewer";
    roleSeparationAttested: true;
  };
  confirmations: {
    currentG4StatusReviewed: true;
    leakageComponentsReviewed: true;
    priorExposureReviewed: true;
    splitFeasibilityReviewed: true;
    holdoutIsolationReviewed: true;
    labelSchemaReviewed: true;
  };
  decision: "approve_lock" | "reject_lock";
  reasonCodes: string[];
  reviewDecisionDigest: string;
  completedAt: string;
  submissionDigest: string;
};
```

`reviewDecisionDigest` excludes `completedAt` and binds the semantic review decision. `submissionDigest` binds the complete immutable object. Dataset semantic identity uses the decision digest; audit references retain the full submission digest.

### 3. Member objects are dataset-independent evidence projections

`DatasetMemberRecordV1` must not reference a future dataset digest.

```ts
type DatasetMemberRecordV1 = {
  schemaVersion: "dataset-member-record-v1";
  sourceSnapshotDigest: string;
  assignmentDigest: string;
  candidateId: string;
  g4GradeRecordDigest: string;
  g4StatusHeadDigest: string;
  componentDigest: string;
  split: "train" | "development" | "validation" | "test" | "holdout";
  claimValuesDigest: string;
  canonicalSha256: string;
  memberDigest: string;
};
```

The member index is computed from these records before the dataset version exists.

### 4. Dataset lock basis breaks the identity cycle

```ts
type DatasetLockBasisV1 = {
  schemaVersion: "dataset-lock-basis-v1";
  datasetId: string;
  datasetLineageId: string;
  predecessorDatasetVersionDigest: string | null;
  sourceSnapshotDigest: string;
  leakageGraphDigest: string;
  splitPlanDigest: string;
  assignmentDigest: string;
  lockReviewDecisionDigest: string;
  lockReviewSubmissionDigest: string;
  labelSchemaDigest: string;
  memberIndexDigest: string;
  lockPolicy: {
    id: "bejewely-dataset-lock-policy-v1";
    version: "1.0.0";
    digest: string;
  };
  lockBasisDigest: string;
};
```

`datasetVersionId` is derived from `lockBasisDigest`.

### 5. The locked version is published before exposure and G5 authority

```ts
type DatasetVersionManifestV1 = {
  schemaVersion: "dataset-version-manifest-v1";
  datasetId: string;
  datasetLineageId: string;
  datasetVersionId: string;
  predecessorDatasetVersionDigest: string | null;
  lockBasisDigest: string;
  sourceSnapshotDigest: string;
  leakageGraphDigest: string;
  splitPlanDigest: string;
  assignmentDigest: string;
  lockReviewDecisionDigest: string;
  lockReviewSubmissionDigest: string;
  labelSchemaDigest: string;
  memberIndexDigest: string;
  lockedAt: string;
  datasetVersionDigest: string;
};
```

This manifest means “the exact version is locked.” It does not yet mean “the version is active for use.”

### 6. Exposure claims and G5 records reference the final version digest

After `DatasetVersionManifestV1` exists, T9 can create:

- exposure claims referencing `datasetVersionDigest`;
- holdout-only G5 records referencing `datasetVersionDigest` and exact member digests;
- initial dataset/G5 `activated` status events.

This direction is acyclic.

### 7. One activation manifest is the active-authority commit point

```ts
type DatasetActivationManifestV1 = {
  schemaVersion: "dataset-activation-manifest-v1";
  datasetVersionDigest: string;
  datasetStatusHeadDigest: string;
  exposureClaimIndexDigest: string;
  g5IndexDigest: string;
  g5StatusHeadIndexDigest: string;
  activationPolicyDigest: string;
  activatedAt: string;
  activationDigest: string;
};
```

A dataset is current-active only when:

- the locked version manifest is valid;
- every exposure claim and G5 object is valid;
- initial status chains are valid;
- the activation manifest is valid and published last.

A locked version without an activation manifest is `locked_incomplete`, not active.

### 8. Correct write order

```text
source snapshot
→ leakage graph
→ split plan / feasibility / assignment
→ full lock-review submission
→ member objects and member index
→ dataset lock basis
→ dataset version manifest
→ exposure claims and exposure index
→ G5 records and G5 index
→ dataset/G5 initial activation events and status indexes
→ dataset activation manifest last
```

### 9. Retry and crash semantics

- orphan objects are immutable and may be reused after full digest verification;
- an existing locked version without activation cannot be silently treated as active;
- retry must reconstruct the exact same exposure/G5/status indexes;
- a conflicting orphan claim blocks hidden alternate assignment or activation;
- the same lock basis cannot produce two different activation manifests.

## Consequences

### Positive

- Candidate-level source cherry-picking is removed from v1.
- All content-addressed identities are acyclic.
- Partial publication cannot masquerade as an active dataset.
- G5 can safely bind the final dataset version.
- Semantic review identity is stable across timestamp-only transport retries while the full audit object remains immutable.

### Negative

- Dataset publication becomes explicitly two-stage: locked then activated.
- Recovery must handle incomplete locked versions and orphan claims.
- Comparison-group source selection requires scanning the local closed-run universe.

## Rejected alternatives

### Keep explicit G4 allowlists with a reviewer confirmation

Rejected because the contract would still normalize candidate-level selection as a routine operation.

### Put datasetVersionDigest into pre-manifest member records

Rejected because it creates an identity cycle.

### Exclude G5 from the manifest and treat any existing G5 file as active

Rejected because partial G5 publication would have no single authoritative boundary.

### Make the first dataset manifest active immediately

Rejected because exposure claims and G5 records are not yet addressable until the final dataset digest exists.

## Verification implications

Implementation tests must prove:

- arbitrary candidate/G4 allowlists are rejected;
- comparison-group scope cannot omit a closed run before the cutoff;
- member-index construction requires no future dataset digest;
- lock basis and version manifest identities are acyclic and deterministic;
- G5 records reference the final dataset version digest;
- no dataset is active without one valid activation manifest;
- crash after version lock but before activation returns `locked_incomplete`;
- retry produces one exact activation manifest and no alternate assignment;
- semantic review decision is timestamp-independent while the full submission remains auditable.
