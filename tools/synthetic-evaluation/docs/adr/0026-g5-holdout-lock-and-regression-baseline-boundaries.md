# ADR 0026: G5 holdout lock and regression baseline boundaries

## Status

Accepted for Toolkit Track `#T9` design.

## Context

T6 reserves G5 and dataset split authority for T9. Without a narrow definition, G5 could be misread as a stronger label-quality grade than G4, or be created for train/validation/test members. A locked holdout can also be accidentally exposed through ordinary exports or conflated with a model-specific regression result.

Dataset identity, holdout usage authority, and regression baseline identity change for different reasons and must remain separate.

## Decision

### 1. V1 G5 has one meaning

The only v1 G5 grade is:

```text
G5_LEAKAGE_LOCKED_HOLDOUT
```

It means that an active G4 member belongs to a locked holdout component in an active dataset version and had no prior non-holdout exposure.

G5 is a usage/split lock. It is not a stronger observation, consensus, label, accuracy, representativeness, clinical, or production-readiness grade.

### 2. G4 remains the label source

A G5 record references the exact active G4 grade and current T6 status head. It cannot change purpose, claim axes, claim values, excluded claims, or canonical asset identity.

If the source G4 is revoked or superseded, the G5 current authority is revoked through an append-only status event.

### 3. G5 is holdout-only

Train, development, validation, and test members do not receive G5.

A holdout member receives G5 only after:

- dataset version lock and human approval;
- component-wide holdout placement;
- current active G4 verification;
- prior exposure verification;
- holdout policy verification.

### 4. Dataset, G5, and baseline identities are separate

```text
DatasetVersionManifestV1
≠ G5HoldoutRecordV1
≠ RegressionBaselineV1
```

A model or metric change creates a new baseline, not a new dataset version. A dataset source, graph, split, or member change creates a new dataset version. A G5 record changes only through its append-only status chain.

### 5. Holdout is isolated from default exports

Default train/development/validation/test exports omit holdout member IDs, asset paths, and images.

Holdout materialization requires an explicit request and authorization for either:

- `regression_evaluation`
- `integrity_review`

Materialization references existing canonical assets and does not copy images by default. V1 provides local access isolation and explicit intent, not a claim of cryptographic secrecy.

### 6. T9 does not execute models

Regression baseline activation consumes an externally produced, integrity-verifiable result package. T9 verifies binding to:

- the active dataset version;
- the exact holdout G5 index;
- one model artifact digest;
- one evaluation harness digest;
- one metric contract digest;
- one result package digest;
- one explicit reviewer approval.

T9 does not train, infer, tune, or compute model scores in v1.

### 7. Baseline authority is current-status dependent

A baseline cannot remain active when:

- the dataset version is invalidated, retired, or superseded;
- any holdout G5 becomes inactive;
- a cross-split leakage conflict is discovered;
- model/result/harness/metric integrity fails.

Historical baseline artifacts remain immutable and readable.

## Consequences

### Positive

- G5 cannot be mistaken for improved label quality.
- Holdout authority is narrow and traceable to active G4 and dataset state.
- Ordinary exports do not casually expose holdout membership.
- Model-specific baselines can evolve without changing dataset identity.
- T9 remains free of model execution and Provider runtime.

### Negative

- Holdout operations require explicit authorization and separate manifests.
- G4 revocation can cascade to G5, dataset, and baseline status.
- V1 does not provide encrypted or remote access-control infrastructure.

## Rejected alternatives

### Use G5 for every member of a locked dataset

Rejected because G5 is specifically the holdout leakage lock, not general membership.

### Treat G5 as higher-confidence Gold

Rejected because label truth remains G4/T4/T5/T6-owned.

### Include holdout rows in the normal dataset export with a flag

Rejected because ordinary export handling would expose the very membership T9 is intended to isolate.

### Store model results inside the dataset manifest

Rejected because model and metric changes would mutate dataset identity.

### Let T9 run the model automatically

Rejected because T9 v1 owns locking and activation contracts, not training or inference execution.

## Verification implications

Implementation tests must prove:

- only holdout members can receive G5;
- G5 fields cannot alter G4 label scope or values;
- prior non-holdout exposure blocks G5;
- default exports contain no holdout identity or asset reference;
- explicit materialization creates no image copy by default;
- model/result changes do not alter dataset-version identity;
- inactive dataset or G5 blocks baseline activation;
- source revocation cascades through append-only status without deleting history.
