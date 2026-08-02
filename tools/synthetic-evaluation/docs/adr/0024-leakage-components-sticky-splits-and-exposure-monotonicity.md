# ADR 0024: Leakage components, sticky splits, and exposure monotonicity

## Status

Accepted for Toolkit Track `#T9` design.

## Context

Synthetic candidates can share exact canonical bytes, campaign lineage, reference/edit lineage, or manually reviewed visual similarity. Splitting records independently can place coupled samples into optimization and evaluation sets, producing leakage without proving that the images depict the same person.

Leakage also persists across dataset versions. A record previously exposed to training or model selection cannot later become a meaningful sealed holdout merely because a new version assigns it differently.

A further risk is retroactive discovery: a new reviewed coupling edge can connect components that were previously placed in different splits.

## Decision

### 1. Leakage is represented as an undirected graph

Nodes are active G4 candidate-grade records. Edges are typed, source-linked coupling relations.

Allowed v1 coupling kinds are:

- `canonical_sha256`
- `campaign_series`
- `reference_lineage`
- `paired_edit_lineage`
- `reviewed_visual_similarity`
- `active_representative_alias`

A coupling key means “must not be separated across dataset splits.” It does not mean same identity, same person, or biological equivalence.

### 2. Connected component is the split unit

The graph's transitive connected components are computed deterministically. Every node in a component receives one exact split assignment.

No quota, class-balance target, or convenience export may break a component.

### 3. Perceptual similarity is not automatically authoritative

Unreviewed dHash or embedding distance is diagnostic only. It cannot create an authoritative edge unless a separately approved calibrated policy exists.

Until then, only explicit reviewed visual-similarity relations enter the graph.

### 4. Split exposure is append-only

Every assigned component creates a `DatasetExposureClaimV1` containing:

- dataset lineage;
- component fingerprint;
- exact split;
- exposure class;
- first exposure time;
- source dataset version.

The exact split is sticky within a dataset lineage.

### 5. Exposure cannot become stricter after use

The strictness order is:

```text
holdout > test > validation > development > train
```

A component exposed in a lower-strictness split cannot later move to a higher-strictness split.

Examples:

- train to holdout: forbidden
- development to test: forbidden
- validation to holdout: forbidden

### 6. Retroactive cross-split coupling fails closed

If a new edge joins prior components with different split claims, T9 emits `cross_split_leakage_conflict`.

It does not choose a preferred prior split automatically.

The affected active dataset and regression baseline are invalidated or superseded through append-only status events. If the merged component contains optimization-exposed material, it cannot regain holdout/test status in the same lineage.

## Consequences

### Positive

- Exact, lineage, and reviewed similarity leakage are handled uniformly.
- Transitive leakage cannot be bypassed by pairwise-only checks.
- Dataset-version changes cannot launder exposed samples into stricter evaluation sets.
- Retroactive leakage discoveries remain auditable.

### Negative

- Large components can make target ratios infeasible.
- New coupling evidence can invalidate active datasets and baselines.
- Sticky split claims reduce flexibility for later rebalancing.

## Rejected alternatives

### Candidate-level random split

Rejected because it ignores coupling relations.

### Exact SHA duplicate grouping only

Rejected because campaign/reference/edit leakage remains.

### Automatic dHash threshold clustering

Rejected because the current fingerprint is not calibrated for authoritative grouping and must not imply identity.

### Reassign old samples in each dataset version

Rejected because prior optimization or evaluation exposure cannot be undone.

### Resolve cross-split conflicts by always choosing train

Rejected because it would silently invalidate prior evaluation semantics and hide the conflict.

## Verification implications

Implementation tests must prove:

- graph closure is deterministic and transitive;
- one component never spans multiple splits;
- unknown or unreviewed coupling inputs fail closed or remain diagnostic;
- prior exact split claims are inherited;
- lower-strictness exposure blocks stricter reassignment;
- newly merged prior components with different splits produce an explicit conflict;
- conflicts invalidate active authority without deleting historical artifacts.
