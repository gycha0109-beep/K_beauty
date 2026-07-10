# Evaluator Boundary Target Capture Plan - 2026-07-03

This document records the Phase 19 target capture plan and current actual-capture availability. It is not a runtime policy approval.

## Phase 18 Baseline

Phase 18 used the current complete/product_row shadow captures only.

- Complete/product_row fixtures used: 10
- Candidate review rows: 1,640
- Boundary-applicable rows: 86
- `safe_low_risk hidden` rows: 50
- `safe_low_risk hidden` virtual boundary result: 50 `downgrade_to_collapsed_candidate`
- High-risk protection failures: 0
- Not observed in actual complete captures: active-only profile, metadata-incomplete profile, serum category, strong caution metadata

## Phase 19 Purpose

Phase 19 asks whether the four missing coverage gaps can be observed through targeted actual dev capture scenarios without mutating runtime code, product records, or existing capture fixtures.

This phase does not create synthetic product/profile fixtures and does not count synthetic validation as actual evidence.

## Actual Capture vs Synthetic Validation

Actual capture means the existing `/api/analyze` flow and existing product candidate source produce a complete/product_row fixture through the dev-only shadow capture gate.

Synthetic validation means a verifier constructs product/profile inputs in code. Synthetic validation is useful for policy branch coverage, but it is not evidence that the current product distribution or existing candidate source can produce that case.

## Current Product/Candidate Distribution

The target capture planner inspected the current candidate exposure artifact from complete/product_row captures.

- Candidate rows inspected: 1,640
- Unique candidate products inspected: 164
- Categories observed:
  - cleanser: 260 rows
  - essence: 240 rows
  - moisturizer: 610 rows
  - sunscreen: 110 rows
  - toner_pad: 240 rows
  - treatment: 180 rows
- Functional profiles observed:
  - mixed: 860 rows
  - stabilizing_leaning: 780 rows
- Safety metadata profiles observed:
  - safe_low_risk: 1,180 rows
  - safe_medium_risk: 20 rows
  - mixed_or_uncertain: 430 rows
  - unsafe_high_risk: 10 rows

## Gap Availability

| Gap | Current actual availability | Candidate rows | Boundary-applicable rows | Interpretation |
| --- | --- | ---: | ---: | --- |
| active_leaning only | not available in current complete candidate rows | 0 | 0 | Current actual captures only contain mixed or stabilizing profiles. |
| metadata_incomplete | not available in current complete candidate rows | 0 | 0 | Current actual candidate rows have sufficient safety/profile metadata for this policy branch. |
| serum category | not available in current complete candidate rows | 0 | 0 | Current complete candidate source does not expose serum/ampoule rows. |
| strong caution metadata | not available in current complete candidate rows | 0 | 0 | Current candidate rows do not contain strong caution reason keys used by the boundary policy. |

These missing gaps are current product/candidate distribution limitations, not test failures.

## Proposed Target Scenarios

The planner produced four SurveyInputContract-compatible scenario forms. They are intended to increase the chance that the existing engine includes active, serum-like, or strong-caution candidates if those candidates exist in the real source.

| Scenario | Primary concern | Safety state | Expected gap target |
| --- | --- | --- | --- |
| `target_active_acne_recent_instability` | acne | high sensitivity + recent change + changed product | active-only, strong caution |
| `target_redness_barrier_recent_instability` | redness | high sensitivity + recent change + changed product | metadata-incomplete, strong caution |
| `target_pores_tone_active_recent_instability` | pores_texture | high sensitivity + recent change + changed product | active-only, serum category |
| `target_serum_tone_acne_recent_instability` | uneven_tone | high sensitivity + recent change + changed product | serum category, strong caution |

All proposed fields stay within the survey contract. The plan does not add hidden API-only inputs.

## Dev Capture Execution

Status: `capture_run_not_executed`

No additional dev-only `/api/analyze` capture was executed in this phase. The planner generated the scenario set and confirmed current actual availability, but it did not start a dev server or create new captures.

Required conditions before executing the scenarios:

- `NODE_ENV=development`
- `FUNCTIONAL_SHADOW_CAPTURE=1`
- existing `/api/analyze` path only
- no product data mutation
- no fixture editing
- response leak check for shadow/debug fields
- explicit acceptance that the run may call the existing analysis path and any configured local/external dependencies

New complete/product_row captures from this phase: 0

## Coverage Change

Because no new dev capture was executed, actual coverage is unchanged from Phase 18.

- active-only actual candidate: still not observed
- metadata-incomplete actual candidate: still not observed
- serum actual candidate: still not observed
- strong caution actual candidate: still not observed
- safe_low_risk hidden boundary behavior: unchanged

## Runtime Non-Application

This phase did not modify:

- `/api/analyze`
- evaluator hard filters
- ranking score/weight
- CandidatePolicy runtime
- UI/API response
- DB/Supabase
- product data
- existing capture fixtures

## Remaining Conditions

Before evaluator pass + collapsed hint integration can be considered, one of the following must happen in a separate approved task:

- run the proposed scenarios through a confirmed safe dev-only capture path and re-run actual coverage collection
- confirm that the current product/candidate source truly lacks serum, active-only, metadata-incomplete, and strong-caution candidates
- collect high-confidence complete/product_row captures that include at least one of the missing gap classes

The current document is a target capture plan and current actual distribution record, not approval to change runtime evaluator behavior.
