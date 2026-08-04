# CandidateExposurePolicy Limited Preview Canary Plan Review

## Scope

Stage 11D converts the Stage 11C `eligible_for_limited_preview_canary_plan` result into a machine-validated Preview-only canary plan. It does not implement or activate a canary harness.

## Design review

The plan uses an exact 16-request matrix:

- two locales: KO and EN;
- four scenarios: standard goal alignment, stabilization active block, current-product semantics, and metadata incomplete;
- two modes: default-off control and deployment-scoped isolated canary.

The matrix is sufficient to exercise the canonical goal, safety, current-product, and evidence-completeness responsibilities that caused prior policy divergence. It avoids organic traffic and does not create an open-ended percentage rollout.

## Boundary review

The plan is valid only when:

- both deployments are Preview and use one exact runtime SHA;
- canary opt-in is deployment-scoped;
- inputs are synthetic or explicitly authorized diagnostic fixtures;
- CandidateExposurePolicy output is consumed only by an isolated candidate projection;
- no recommendation, response, persistence, UI, project environment, or Production mutation is allowed;
- telemetry remains aggregate-only;
- all stop conditions are fail-closed.

The plan validator always returns runtime, Production, and public-traffic authorization as false.

## Implementation review

`reviewCandidateExposurePolicyLimitedPreviewCanaryPlan()` separates stale evidence from plan-contract violations:

- stale Stage 11C eligibility or an implementation SHA mismatch returns `blocked_evidence_stale`;
- unsafe environment, traffic, request budget, scenario matrix, stop condition, or mutation permission returns `blocked_contract_violation`;
- only the exact contract returns `plan_ready`.

The implementation is pure and is not imported by `/api/analyze`, `skin-match-decision-engine`, or `/api/full-report`.

## Verification strategy

The Stage 11D check includes:

- the canonical valid plan;
- stale eligibility and stale SHA controls;
- 30 contract negative controls;
- explicit runtime, Production, and public-traffic non-authorization assertions;
- static guards against route and decision-engine consumption;
- sensitive identifier and bypass-token pattern checks.

The Stage 11D workflow also runs the existing security closeout suite, architecture guard, Production build, and diff hygiene.

## Decision

```text
LIMITED_PREVIEW_CANARY_PLAN_READY
ISOLATED_HARNESS_NOT_IMPLEMENTED
RUNTIME_FILTER_NOT_CONNECTED
PUBLIC_TRAFFIC_NOT_AUTHORIZED
PRODUCTION_NOT_AUTHORIZED
```

The next possible stage is Stage 11E, an isolated Preview canary harness. Stage 11D does not authorize that harness to affect recommendation output or public traffic.
