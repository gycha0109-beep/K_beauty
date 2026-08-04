# CandidateExposurePolicy Limited Preview Canary Plan v1

## 1. Purpose

This document defines the bounded plan for a future isolated Preview canary harness after Stage 11C returned `eligible_for_limited_preview_canary_plan`.

The plan is not an activation mechanism. It does not connect CandidateExposurePolicy decisions to the recommendation response, saved payloads, UI, public Preview traffic, or Production.

## 2. Authorized boundary

The Stage 11D plan may define and verify only:

- two Preview deployments built from one exact runtime implementation SHA;
- one default-off control and one deployment-scoped opt-in canary;
- approved synthetic or explicitly authorized diagnostic fixtures;
- an isolated candidate projection that is not consumed by recommendation assembly;
- aggregate telemetry and fail-closed stop conditions;
- a future Stage 11E isolated harness implementation contract.

Stage 11D does not authorize:

- importing the canary plan into `/api/analyze`, the decision engine, or full-report routes;
- connecting CandidateExposurePolicy output to the canonical recommendation candidate pool;
- mutating response, snapshot, recommendation, storage, or UI state;
- public or organic Preview traffic;
- project-wide Preview environment variables;
- Production deployment or configuration changes.

## 3. Canary matrix

The complete bounded matrix is:

- locales: `ko`, `en`;
- scenarios:
  - `standard_goal_alignment`;
  - `stabilization_active_block`;
  - `current_product_semantics`;
  - `metadata_incomplete`;
- modes per scenario: default-off control and deployment-scoped isolated canary;
- paired requests per scenario and locale: 2;
- maximum analyze requests: 16;
- maximum wall-clock duration: 60 minutes.

The request budget is exact:

```text
2 locales × 4 scenarios × 2 paired modes = 16 analyze requests
```

No warm-up, quota test, automatic retry, or additional exploratory analyze request is part of the plan.

## 4. Deployment contract

The future harness must use:

1. one default-off Preview deployment;
2. one canary Preview deployment with deployment-scoped opt-in only;
3. the same exact runtime implementation SHA for both deployments;
4. no project environment mutation;
5. no Production target, alias, domain, or configuration change;
6. a temporary automation bypass only when deployment protection requires it;
7. confirmed bypass revocation in a `finally` path.

A SHA mismatch, non-Preview target, unexpected actor, project environment write, or failed bypass cleanup stops the canary before further analyze calls.

## 5. Isolated candidate projection

The future Stage 11E harness may calculate a candidate projection from CandidateExposurePolicy decisions for comparison purposes only.

The isolated projection must:

- be constructed after the existing canonical decision state;
- retain stable candidate references internally without logging them;
- remain separate from the response-producing recommendation candidate pool;
- never replace, filter, reorder, or enrich the response candidate set;
- never enter persistence or UI projection;
- expose only aggregate comparison counts and fingerprints.

`runtimeConnectionMode` is therefore fixed to:

```text
isolated_candidate_projection_only
```

Any direct recommendation-runtime connection is a contract violation rather than a canary variation.

## 6. Telemetry contract

Only aggregate telemetry is authorized.

Permitted evidence includes:

- request count and HTTP status count;
- runtime SHA match count;
- final diagnostic-stage count;
- aggregate exposure-state counts;
- aggregate divergence-category counts;
- aggregate lane-eligibility counts;
- response, snapshot, candidate-order, and isolated-projection fingerprints;
- exception, fallback, invalid-context, and cleanup counts.

Forbidden evidence includes:

- candidate IDs or references;
- product IDs, names, brands, or URLs;
- user, account, session, report, cookie, token, or email identifiers;
- raw request or response bodies;
- raw provider prompts or output;
- per-candidate reason records.

## 7. Stop conditions

The canary stops immediately when any of the following becomes true:

- runtime SHA mismatch;
- default-off shadow execution;
- unexpected divergence;
- unclassified divergence;
- shadow exception;
- fallback;
- invalid canonical context;
- response fingerprint mismatch inside one canary request;
- snapshot fingerprint mismatch inside one canary request;
- candidate-order mismatch inside one canary request;
- candidate-level telemetry detection;
- Production or project-level configuration change.

After a stop condition, remaining analyze calls are not executed and no retry occurs within the same run.

## 8. Success evidence for a future harness

Stage 11E may claim its isolated harness passed only when all 16 planned requests complete and all of the following hold:

- HTTP 200 count: 16;
- runtime SHA match count: 16;
- final diagnostic stage count: 16;
- default-off execution count: 0;
- canary isolated-projection execution count: 8;
- response pre/post fingerprint matches: 8;
- snapshot pre/post fingerprint matches: 8;
- candidate-order pre/post fingerprint matches: 8;
- unexpected divergence: 0;
- unclassified divergence: 0;
- exception: 0;
- fallback: 0;
- invalid context: 0;
- candidate-level telemetry incidents: 0;
- temporary bypass residue: 0;
- project/Production changes: 0.

This evidence would authorize an evaluation of the next integration decision. It would still not authorize public traffic or Production.

## 9. Machine contract

The machine-readable plan is stored at:

`docs/verification/candidate-exposure-policy-limited-preview-canary-plan.json`

The pure validator is:

`reviewCandidateExposurePolicyLimitedPreviewCanaryPlan()`

The validator can return only:

- `plan_ready`;
- `blocked_evidence_stale`;
- `blocked_contract_violation`.

Every result returns:

- `runtimeActivationAuthorized=false`;
- `productionActivationAuthorized=false`;
- `publicTrafficAuthorized=false`.

## 10. Stage boundary

A `plan_ready` result authorizes only:

```text
stage_11e_isolated_preview_canary_harness
```

It does not authorize implementation of runtime filtering, response mutation, recommendation mutation, persistence, UI integration, public traffic, or Production activation.
