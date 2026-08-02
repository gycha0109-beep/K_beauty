# Synthetic Evaluation Toolkit #T9

# Leakage-aware Dataset Lock Implementation v1

## Status

- Toolkit Track: `#T9`
- Branch: `feature/T9-leakage-aware-dataset-lock`
- Base: `design/T9-leakage-aware-dataset-lock`
- Production integration: none
- Actual dataset lock: none
- Actual G5/holdout materialization: none
- Model training, inference, scoring: none

## Runtime flow

```text
stored closed-run universe
→ current T6 G4 and canonical-byte revalidation
→ immutable source snapshot
→ leakage connected components
→ prior-exposure registry
→ deterministic component split
→ explicit human lock review
→ locked-incomplete dataset version
→ second current-authority check
→ exposure / G5 / status publication
→ activation manifest last
```

## Implemented boundaries

- caller cannot submit a candidate or G4 allowlist;
- comparison-group selection enumerates locally stored closed runs;
- T7/T8 closeout-time G4 counts are not current authority;
- each current source G4 is revalidated through its T6 status chain and stored evidence;
- canonical image bytes are rehashed before source admission;
- T9 never changes G4 claims or labels;
- dHash or embedding distance alone creates no authoritative edge or identity claim;
- connected components, not candidates, are split units;
- caller-supplied randomness is absent;
- human lock review requires six explicit confirmations;
- activation is impossible without the final activation manifest;
- G5 means holdout usage lock, not higher label quality;
- holdout references require a separate authorization artifact;
- baseline registration stores immutable external evidence references and executes no model.

## Artifact layering

```text
DatasetSourceSnapshotV1
→ LeakageGraphV1
→ DatasetSplitPlanV1
→ DatasetSplitAssignmentV1
→ DatasetLockReviewSubmissionV1
→ DatasetMemberRecordV1[]
→ DatasetLockBasisV1
→ DatasetVersionManifestV1
→ DatasetExposureClaimV1[]
→ G5HoldoutRecordV1[]
→ Dataset/G5 status events
→ DatasetActivationManifestV1
```

The dataset version identity is acyclic. Exposure and G5 records reference the already locked version. The activation manifest is published after every required downstream object and index.

## Leakage and exposure policy

Authoritative coupling inputs include:

- canonical SHA-256;
- campaign-series relation;
- reference or edit lineage;
- reviewed visual-similarity relation;
- active representative/alias relation.

Historical exposure membership is recovered from prior locked member indexes. When a new edge joins components previously exposed in different splits, assignment fails with `cross_split_leakage_conflict`. Quota satisfaction never overrides a coupling edge.

## Split policy

- fixed split order: holdout, test, validation, development, train;
- assignment entropy derives from source, graph, and plan digests;
- exact target and allowed-deviation constraints are explicit;
- minimum component counts for validation/test/holdout are explicit;
- search is bounded and fails closed as `split_infeasible` or `split_search_exhausted`;
- the same source and plan produce the same semantic assignment identity.

## Publication and lifecycle

1. a lineage-successor claim prevents parallel dataset versions from the same predecessor;
2. source, graph, plan, assignment, review, members, lock basis, and locked manifest are stored;
3. state is `locked_incomplete`;
4. T6 authority and exposure registry are rechecked;
5. exposure-successor claims, G5 records, status roots, and indexes are stored;
6. activation claim and activation manifest are written last;
7. state becomes `active`.

Dataset and G5 deactivation use append-only successor claims. An inactive chain cannot be extended or reactivated in v1.

## Post-implementation review corrections

1. corrected an invalid asynchronous test expression that prevented the first CI run from parsing;
2. reconstructed prior component membership from locked member indexes so newly discovered cross-version leakage edges cannot bypass sticky split checks;
3. hardened member, exposure, G5, G5-status, and dataset-status indexes with exact shapes, sorted unique entries, count checks, and digest recomputation;
4. added append-only dataset retirement/invalidation/supersession and G5 revocation/supersession paths;
5. prohibited a second transition after a dataset or G5 record becomes inactive;
6. added evidence-only regression-baseline contract tests;
7. kept public exports limited to authority-checked orchestration, lifecycle actions, and integrity verification.

## Verification scope

- strict contract and unknown-field rejection;
- source snapshot tamper rejection;
- transitive leakage components without identity inference;
- deterministic assignment;
- infeasible quota rejection;
- cross-split historical exposure conflict;
- explicit human-review confirmations;
- dataset/G5 identity separation;
- manifest-last two-stage publication;
- idempotent artifact registration;
- append-only status lifecycle;
- baseline evidence-only boundary;
- no Provider, network, browser, database, shell, training, inference, or scoring execution;
- production dependency isolation.
