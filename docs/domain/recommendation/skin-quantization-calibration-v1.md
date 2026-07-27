# Skin Quantization Calibration V1

- Status: offline shadow governance
- Production authoritative: no
- Activation allowed: no
- Base: PR #74, `0acd4404df012ee72fb0e8a5691ba8db91d17c33`

## 1. Purpose

This phase evaluates candidate mappings from canonical visible Skin cue levels to the legacy `0~5` photo-signal scale.

```text
none / mild / moderate / high
→ candidate quantization policy
→ legacy 0~5 diagnostic signal
→ concern-score replay
→ downstream regression gate
→ approve one policy or reject all
```

The phase does not change the authoritative Skin Engine input. Existing direct Provider signals remain authoritative.

## 2. Predeclared policy candidates

```text
conservative_0123_v1
none 0 / mild 1 / moderate 2 / high 3

linear_0135_v1
none 0 / mild 1 / moderate 3 / high 5

capped_0124_v1
none 0 / mild 1 / moderate 2 / high 4
```

The mappings are fixed before fixture evaluation. Result-driven policy mutation is prohibited.

## 3. Approval gate

A policy can only become eligible for a separate activation review when all conditions pass.

```text
positive reference pairs >= 30
pairs per supported axis >= 3
all seven supported axes covered
reference provenance is consented real label or declared synthetic ground truth
full Skin Engine replay complete
product regression complete
routine regression complete
priority flip rate = 0
mean absolute error <= 1
```

Passing this gate still does not activate the policy. Activation requires a separate PR.

## 4. Current fixture corpus

The current corpus contains four contract fixtures:

1. one existing legacy Provider-output bundle with seven positive axis pairs;
2. one observable-absence fixture;
3. one unavailable fixture;
4. one unsupported-UV fixture.

The positive references are `legacy_provider_output`, not ground truth. They are diagnostic comparison data only.

```text
positive pairs: 7
required positive pairs: 30
minimum per axis: 3
product replay: missing
routine replay: missing
```

## 5. Diagnostic result

The existing contract fixture produces the following diagnostic ordering.

| Policy | MAE | Exact match | Priority flip rate | Approved |
|---|---:|---:|---:|---|
| `linear_0135_v1` | `5/7` | `3/7` | `1/4` | no |
| `capped_0124_v1` | `6/7` | `3/7` | `1/4` | no |
| `conservative_0123_v1` | `6/7` | `3/7` | `1/4` | no |

`linear_0135_v1` is the diagnostic best policy only. It is not approved because the governance gate fails.

## 6. Rejection reasons

```text
insufficient_positive_pair_count
insufficient_per_axis_coverage
reference_provenance_not_calibration_ground_truth
downstream_engine_replay_missing
product_regression_missing
routine_regression_missing
priority_flip_detected
```

The correct phase outcome is:

```text
NO_POLICY_APPROVED
```

## 7. Production boundary

The calibration module is not imported by:

- `lib/recommendation-feature-adapters.js`
- `lib/skin-match-decision-engine.js`

No policy candidate reaches current `applyPhotoWeights()`.

The following remain unchanged:

- direct Skin Provider signals;
- concern weighting;
- priority selection;
- product scoring;
- routine generation;
- Premium output;
- public API;
- saved snapshots;
- Face lifecycle.

## 8. Required next evidence

A future calibration pass requires:

1. at least 30 consented-real or declared-synthetic-ground-truth positive pairs;
2. at least three pairs for each supported legacy axis;
3. fixed canonical cue fields with explicit absence;
4. full Skin Engine replay with the same product corpus;
5. product ID and ordering regression;
6. routine mode and step regression;
7. zero priority flips against approved reference outputs;
8. a separate mapping-approval PR;
9. a separate production-activation PR.

Until those conditions exist, all non-zero canonical Skin observations remain shadow-only and unresolved for legacy numeric use.
