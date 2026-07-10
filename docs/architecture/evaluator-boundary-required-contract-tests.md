# Evaluator Boundary Required Contract Tests

이 문서는 runtime 연결 전 필수 contract test 계획이며, runtime 정책 변경 또는 테스트 구현 완료 선언이 아니다.

## Purpose

These tests define the minimum contract coverage required before any evaluator pass, collapsed hint, CandidatePolicy hint receiver, or shadow runtime dry-run can move toward implementation.

The tests are design requirements only in Phase 30.

## Required Tests

### metadata_incomplete_routes_to_insufficient_evidence

Purpose:

- Prevent metadata gaps from becoming collapsed candidates by assumption.

Input conditions:

- boundary applies
- product metadata is incomplete
- irritation risk, sensitivity-safe, functional axes, or evaluability is missing

Expected result:

- boundary decision is metadata review
- hint is `insufficient_evidence_hint`
- receiver decision is `route_to_insufficient_evidence`
- future exposure group is `insufficient_evidence_candidate`

Failure blocks:

- runtime connection
- dry-run expansion
- CandidatePolicy receiver wiring

### strong_caution_preserves_hidden_or_hard_block

Purpose:

- Ensure strong caution overrides collapsed hint eligibility.

Input conditions:

- boundary applies
- strong caution signal exists
- candidate may otherwise look category-eligible

Expected result:

- hard block or hidden status is preserved
- collapsed receiver count stays zero

Failure blocks:

- runtime connection
- dry-run expansion

### active_only_safe_collapses_unsafe_preserves_hidden

Purpose:

- Preserve the safe versus unsafe split for active-only candidates.

Input conditions:

- active-only or active-leaning profile
- recent instability boundary applies
- one case has safe metadata
- one case has unsafe metadata

Expected result:

- safe metadata may resolve to collapsed candidate
- unsafe metadata preserves hidden or hard block

Failure blocks:

- runtime connection
- evaluator pass design expansion

### high_risk_or_sensitivity_unsafe_never_collapses

Purpose:

- Protect high-risk and sensitivity-unsafe candidates.

Input conditions:

- high irritation risk or sensitivitySafe false
- boundary applies
- collapsed hint path is otherwise possible

Expected result:

- candidate is not collapsed
- hidden or hard block is preserved
- high-risk collapsed receiver count remains zero

Failure blocks:

- runtime connection
- dry-run expansion
- acceptance status promotion

### serum_category_does_not_drive_exposure_by_itself

Purpose:

- Prevent category-only exposure decisions.

Input conditions:

- serum or serum-family category
- safe and unsafe metadata variants

Expected result:

- safe metadata still requires boundary downgrade and safe receiver guardrails
- unsafe or strong-caution metadata preserves hidden or hard block
- category alone does not decide collapsed or hidden exposure

Failure blocks:

- runtime connection
- CandidatePolicy receiver wiring

### actual_and_pure_replay_evidence_remain_separate

Purpose:

- Preserve evidence strength and provenance.

Input conditions:

- actual complete/product_row evidence exists
- pure replay evidence exists
- synthetic coverage exists

Expected result:

- actual evidence is labeled separately
- pure replay evidence is labeled separately
- synthetic coverage is not recorded as actual evidence

Failure blocks:

- review readiness promotion
- runtime integration planning

### no_api_response_shape_change

Purpose:

- Ensure shadow dry-run does not change public response contract.

Input conditions:

- dry-run disabled baseline
- dry-run enabled shadow mode

Expected result:

- no public field is added, removed, renamed, or type-changed
- full API response body is not dumped to artifacts

Failure blocks:

- dry-run expansion
- runtime connection

### no_recommendation_result_change_when_shadow_enabled

Purpose:

- Ensure shadow dry-run does not change existing recommendations.

Input conditions:

- dry-run disabled baseline
- dry-run enabled shadow mode

Expected result:

- `topPick` remains unchanged
- `supportingProducts` remains unchanged
- `budgetAlternatives` remains unchanged
- selected counts and order remain unchanged

Failure blocks:

- dry-run expansion
- runtime connection

### no_db_write_from_shadow_dry_run

Purpose:

- Ensure shadow diagnostics never mutate storage.

Input conditions:

- dry-run enabled shadow mode

Expected result:

- insert, update, delete, upsert, and mutation RPC counts remain zero
- Supabase write execution remains false

Failure blocks:

- dry-run expansion
- runtime connection

### no_forbidden_artifact_fields

Purpose:

- Ensure dry-run artifacts remain sanitized.

Input conditions:

- dry-run artifact generation

Expected result:

- no product display text
- no brand field values
- no purchase URLs
- no review text
- no raw form
- no image/base64 data
- no PII
- no env or secret values
- no full API response body dump

Failure blocks:

- artifact retention
- dry-run expansion
- runtime connection

## Coverage Summary

Metadata incomplete:

- Must route to insufficient evidence and must not collapse.

Strong caution:

- Must preserve hidden or hard block and must not collapse.

Active-only:

- Safe metadata may collapse; unsafe metadata must preserve hidden or hard block.

High-risk and sensitivity unsafe:

- Must never collapse.

Serum category:

- Must not determine exposure by itself.

Evidence separation:

- Actual, pure replay, and synthetic coverage remain separate.

API response shape:

- No public response contract changes.

Recommendation result:

- No selected recommendation changes.

DB write:

- No mutation attempts.

Forbidden artifact fields:

- Sanitized output only.
