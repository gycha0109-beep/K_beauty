# ADR 0025: Deterministic component splitting and immutable dataset versions

## Status

Accepted for Toolkit Track `#T9` design.

## Context

Leakage-aware components can have uneven sizes and label distributions. Exact train/development/validation/test/holdout targets may therefore be infeasible. A naive allocator can hide exclusions, split components, or repeatedly change a random seed until a preferred holdout appears.

Dataset versions must also remain reproducible and auditable. Timestamp-only retries or output-path changes must not create new semantic versions, while source, policy, assignment, or review changes must.

## Decision

### 1. Split plans bind exact sources and policies

`DatasetSplitPlanV1` references the exact source snapshot and leakage graph. It declares:

- the five allowed split names;
- exact target member counts;
- minimum validation/test/holdout component counts;
- label-balance hard minimums;
- allowed absolute deviation;
- the exact assignment policy digest.

Target counts must sum to the eligible source member count.

### 2. Caller-provided random seeds are forbidden

Assignment entropy is derived from:

```text
SHA-256(
  "bejewely-t9-assignment-v1"
  + sourceSnapshotDigest
  + leakageGraphDigest
  + splitPlanDigest
)
```

The same source, graph, and plan therefore produce the same assignment.

### 3. Assignment is constraint-first

Hard constraints are evaluated before balance objectives:

1. one component, one split;
2. sticky prior split claims;
3. exposure monotonicity;
4. validation/test/holdout component minimums;
5. label hard minimums;
6. complete, non-duplicated member coverage;
7. no component break.

### 4. Feasible alternatives use one deterministic objective

If multiple assignments satisfy all hard constraints, T9 applies this lexicographic objective:

1. minimize total absolute target deviation;
2. minimize per-label deviation;
3. minimize split component-count imbalance;
4. break ties by canonical hash order derived from assignment entropy, component digest, and split.

The implementation may use exact search or another solver only if its output is independently verifiable against this objective.

### 5. Infeasibility is a valid terminal result

T9 does not force a lock when constraints cannot be satisfied. It emits a deterministic `DatasetSplitFeasibilityV1` with explicit reason codes and performs no dataset-version publication.

### 6. Human review remains mandatory

A feasible assignment does not become a dataset automatically. A pseudonymous `dataset_lock_reviewer` must explicitly confirm current G4 status, leakage components, exposure history, split feasibility, holdout isolation, and label schema.

Confirmations are never auto-filled.

### 7. Dataset versions are immutable and manifest-last

`DatasetVersionManifestV1` binds:

- source snapshot;
- leakage graph;
- split plan;
- assignment;
- human lock review;
- label schema;
- member index;
- exposure registry head;
- G5 index.

Objects and indexes are written and reverified before the manifest. The manifest is the registration commit point.

### 8. Version lineage is linear by default

Within one `datasetLineageId`, one predecessor may have only one immutable successor. A deliberate branch requires a new lineage ID.

This prevents ambiguous “current dataset” authority while still permitting explicit experimental lineages.

## Consequences

### Positive

- Seed grinding and post-hoc holdout selection are blocked.
- Same inputs produce the same assignment and dataset identity.
- Leakage integrity outranks cosmetic ratio targets.
- Infeasible small datasets fail transparently.
- Human approval and immutable artifacts remain auditable.

### Negative

- Exact constraint solving can be more complex than random splitting.
- Some source pools cannot produce a valid five-way split.
- Linear lineage requires explicit new IDs for experimental branches.

## Rejected alternatives

### Random split with a caller-supplied seed

Rejected because the seed can be repeatedly changed to influence holdout membership.

### Greedy placement without an exact objective

Rejected because implementation order can change results and hide avoidable imbalance.

### Always place oversized components in train

Rejected because it silently changes declared targets and may conflict with prior exposure.

### Publish a provisional dataset before human review

Rejected because provisional split artifacts are easily consumed as authority.

### Rewrite a dataset manifest in place

Rejected because it destroys source, assignment, and review history.

## Verification implications

Implementation tests must prove:

- caller seed fields are rejected;
- identical source/graph/plan yield byte-identical assignments;
- hard constraints outrank target balance;
- infeasible plans produce no dataset manifest;
- review confirmations are explicit and source-bound;
- manifest publication is last and idempotent;
- timestamp-only retries do not change semantic identity;
- a second successor in the same lineage is rejected.
