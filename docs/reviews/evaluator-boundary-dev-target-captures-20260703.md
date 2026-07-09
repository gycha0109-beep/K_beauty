# Evaluator Boundary Dev Target Captures - 2026-07-03

This document records the Phase 20 dev-only target scenario capture attempt. It is not runtime policy approval.

## Phase 18 Actual Coverage Baseline

- Complete/product_row fixtures: 10
- Candidate review rows: 1,640
- Boundary-applicable rows: 86
- `safe_low_risk hidden`: 50
- `safe_low_risk hidden` boundary result: 50 `downgrade_to_collapsed_candidate`
- High-risk collapsed count: 0
- Missing actual coverage gaps:
  - active-only profile
  - metadata-incomplete profile
  - serum category
  - strong caution metadata

## Phase 19 Target Capture Plan

Phase 19 proposed four SurveyInputContract-compatible target scenarios:

- `target_active_acne_recent_instability`
- `target_redness_barrier_recent_instability`
- `target_pores_tone_active_recent_instability`
- `target_serum_tone_acne_recent_instability`

The scenarios are designed to increase the chance of seeing active-only, serum-like, metadata-incomplete, or strong-caution candidates if those candidates are present in the existing candidate source.

## Phase 20 Purpose

Phase 20 attempted to execute those scenarios through the real dev-only `/api/analyze` capture path without changing runtime code, product data, evaluator behavior, CandidatePolicy, UI/API response, or existing fixture files.

## Dev-only Capture Conditions

The route contract inspection confirmed:

- Endpoint: `/api/analyze`
- Method: `POST`
- Payload: multipart form
- Image is required
- Test image exists at `public/test-assets/kakao-test-face.png`
- Capture gate requires `NODE_ENV=development` and `FUNCTIONAL_SHADOW_CAPTURE=1`
- Idempotency/analysis guard is active

## Execution Result

Status: `capture_run_not_executed_db_mutating_guard_path`

The target scenarios were not sent to `/api/analyze`. The current route path invokes analysis guard RPCs and premium report session store writes/prunes during successful analysis handling. Because this phase explicitly forbids DB/Supabase mutation, the runner skipped actual API execution instead of creating captures through a mutating path.

## Scenario Results

| Scenario | Status | Reason |
| --- | --- | --- |
| `target_active_acne_recent_instability` | not attempted | DB-mutating guard/session path detected |
| `target_redness_barrier_recent_instability` | not attempted | DB-mutating guard/session path detected |
| `target_pores_tone_active_recent_instability` | not attempted | DB-mutating guard/session path detected |
| `target_serum_tone_acne_recent_instability` | not attempted | DB-mutating guard/session path detected |

## Capture Delta

- Complete/product_row before: 10
- Complete/product_row after: 10
- New complete/product_row captures: 0

## Actual Coverage After Attempt

Coverage is unchanged from Phase 18:

- Total candidate rows: 1,640
- Boundary-applicable rows: 86
- active-only actual candidate: not observed
- metadata-incomplete actual candidate: not observed
- serum category actual candidate: not observed
- strong caution metadata actual candidate: not observed
- `safe_low_risk hidden`: 50, all `downgrade_to_collapsed_candidate`
- high-risk collapsed count: 0

## Required Conditions for a Future Run

A future approved task can run the four scenarios only after one of these is explicitly accepted:

- use an isolated local/dev database where analysis guard and premium session mutations are allowed
- provide an approved no-write dev route or guard bypass that does not change production behavior
- approve the existing dev-only `/api/analyze` path despite analysis guard/session store mutations

The runner must still verify that API responses do not leak shadow/debug fields.

## Runtime Non-Application

This phase did not modify:

- `/api/analyze`
- evaluator hard filters
- ranking score/weight
- CandidatePolicy runtime
- UI/API response
- DB/Supabase schema or product data
- existing capture fixture originals

## Remaining Conditions

Evaluator pass + collapsed hint integration remains blocked on actual evidence for the four missing gap classes or an approved isolated dev capture run. Synthetic coverage from Phase 17 remains useful branch validation, but it is not a substitute for actual complete/product_row evidence.
