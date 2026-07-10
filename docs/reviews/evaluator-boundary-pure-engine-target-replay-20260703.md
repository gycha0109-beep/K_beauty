# Evaluator Boundary Pure Engine Target Replay - 2026-07-03

This document records pure engine replay evidence. It is not actual `/api/analyze` capture and is not runtime policy approval.

이 문서는 pure engine replay evidence 문서이며, actual `/api/analyze` capture 또는 runtime 정책 변경 승인이 아니다.

## Phase 20 Skip Reason

Phase 20 did not execute the four target scenarios through `/api/analyze` because the route enters DB/session mutation paths:

- analysis guard idempotency/rate-limit RPCs
- analysis guard completion/failure RPCs
- premium report store insert
- premium report store prune

The skip reason was `capture_run_not_executed_db_mutating_guard_path`.

## Phase 21 Boundary Conclusion

Phase 21 identified `Option 2: Pure engine replay runner` as the safest no-write next step. The key tradeoff is that replay evidence avoids route/session/guard writes but is not exact route execution.

## Phase 22 Purpose

Phase 22 attempted to run the Phase 19 target scenarios outside `/api/analyze` by calling the shared decision engine path and enabling candidate source diagnostics.

The runner explicitly records:

- `evidenceType: pure_engine_replay`
- `routeInvoked: false`
- `supabaseWriteExecuted: false`
- `runtimeMutation: false`

## Actual Capture vs Pure Engine Replay

Actual capture means the `/api/analyze` route successfully executes and dev-only shadow capture writes a sanitized fixture.

Pure engine replay means a script calls shared engine functions directly and writes a separate replay artifact. Replay can help isolate no-write behavior, but it must not be counted as an actual complete/product_row capture.

## Why the Route Was Not Called

The route was not called because Phase 21 confirmed mutation boundaries before and after recommendation generation. Calling it unchanged would violate the no-write requirement.

## Scenario Results

| Scenario | Replay status | Candidate rows | Reason |
| --- | --- | ---: | --- |
| `target_active_acne_recent_instability` | failed | 0 | `candidate_source_empty_after_pure_engine_replay` |
| `target_redness_barrier_recent_instability` | failed | 0 | `candidate_source_empty_after_pure_engine_replay` |
| `target_pores_tone_active_recent_instability` | failed | 0 | `candidate_source_empty_after_pure_engine_replay` |
| `target_serum_tone_acne_recent_instability` | failed | 0 | `candidate_source_empty_after_pure_engine_replay` |

The live read-only product source returned the existing product-source unavailable condition in this environment. The runner then used existing complete capture product rows as a read-only replay fallback, but those sanitized rows are not sufficient for the legacy decision engine's required product-field filter, so no scored candidate rows were produced.

This is a replay-source limitation, not a runtime policy conclusion.

## Gap Results

| Gap | Status | Rows | Boundary-applicable rows |
| --- | --- | ---: | ---: |
| active_leaning only | not observed in pure engine replay | 0 | 0 |
| metadata_incomplete | not observed in pure engine replay | 0 | 0 |
| serum category | not observed in pure engine replay | 0 | 0 |
| strong caution metadata | not observed in pure engine replay | 0 | 0 |
| safe_low_risk hidden | not observed in pure engine replay | 0 | 0 |

Because no replay candidate rows were produced, this phase does not expand boundary evidence.

## High-risk Protection

High-risk collapsed count: 0

This is neutral rather than affirmative evidence, because no candidate rows were produced in the replay artifact.

## Limitations

- Pure engine replay is not actual `/api/analyze` capture.
- Route guard/session/premium store boundaries were not exercised.
- Product source availability is environment-dependent.
- Existing complete capture rows are sanitized and cannot fully stand in for product source rows required by the legacy scorer.
- The four Phase 18 coverage gaps remain unobserved.
- The result must not be used as approval for evaluator or CandidatePolicy runtime changes.

## Runtime Non-application

This phase did not modify:

- `/api/analyze`
- evaluator hard filters
- ranking score/weight
- CandidatePolicy runtime
- UI/API response
- DB/Supabase schema or product data
- existing capture fixture originals

## Remaining Conditions

Before evaluator pass + collapsed hint integration can be considered, evidence still needs one of the following:

- a read-only product source path that returns full product rows for pure engine replay
- an approved isolated dev DB route execution
- an approved dev-only no-write route mode

Until then, actual Phase 18 captures remain the stronger evidence source, and replay evidence from this phase does not expand coverage.
