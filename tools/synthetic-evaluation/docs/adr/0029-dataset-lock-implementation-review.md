# ADR 0029: Dataset-lock implementation review record

## Status

Accepted after Toolkit Track `#T9` implementation review.

## Context

The initial implementation passed most contract and architecture checks, but review identified several paths where syntactically valid artifacts were not yet sufficient to prove the intended dataset authority.

## Findings and decisions

### 1. Prior exposure required member-level reconstruction

An exposure claim identifies a component fingerprint and split. A later graph may merge that historical component with another component under a new edge. Fingerprint-only matching cannot detect every overlap.

Decision:

- prior dataset versions are resolved through their locked manifest and member index;
- historical member keys derive from canonical SHA plus claim-values digest;
- a new component overlapping historical components in multiple splits fails with `cross_split_leakage_conflict`.

### 2. Index files require semantic integrity

Fixed-path index files originally verified only selected entries.

Decision:

- exact key sets are required;
- entries must be sorted and unique;
- counts must match member cardinality;
- index digests are recomputed;
- existing index reuse is accepted only after full semantic verification.

### 3. Invalidation needed a supported append-only path

Verification detected inactive sources, but the implementation lacked a bounded API for recording dataset and G5 lifecycle changes.

Decision:

- dataset status supports append-only `retired`, `invalidated`, and `superseded` events;
- G5 status supports append-only `revoked` and `superseded` events;
- one successor claim per predecessor prevents branches;
- no event may follow an inactive terminal state;
- v1 has no reactivation path.

### 4. Activation remains the final commit point

Locking and activation remain separate operations. Current T6 authority and the exposure-registry digest are checked between them.

Decision:

- a crash or authority drift after lock leaves `locked_incomplete`;
- exposure, G5, status roots, and indexes are published before activation;
- the activation manifest is written last.

### 5. Baseline registration remains evidence-only

Decision:

- the baseline request contains only immutable dataset, G5, model, harness, metric-contract, and external result-package digests;
- explicit human confirmation is required;
- no model execution, scoring, threshold tuning, holdout enumeration, or network access occurs in the baseline module.

## Consequences

- Cross-version leakage checks require reading historical member indexes.
- Fixed-path indexes have stronger idempotency requirements.
- Inactive datasets and G5 records remain historically readable but are not current authority.
- Dataset lock, holdout use, and baseline evidence remain distinct identities.

## Final review result

- Critical: 0 open
- Important: 0 open
- Minor: 0 open
