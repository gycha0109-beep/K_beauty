# V2.1-9B — Existing Eligibility / Candidate Availability Boundary Additional Shadow Evidence

Terminal: `EXISTING_ELIGIBILITY_CANDIDATE_AVAILABILITY_SHADOW_EVIDENCE_VALIDATED`

V2.1-9B is a bounded shadow-evidence stage. It does not implement or authorize production activation, normative enforcement, score changes, rank changes, or canonical candidate exclusion.

## 9A unknown root cause

Primary root cause: `COMPOSITE_ELIGIBILITY_NOT_MATERIALIZED`.

Manifestation: `COMPARATOR_SERIALIZATION_GAP`.

The canonical recommendation path does not expose one `eligible` boolean on every scored product. Existing eligibility is represented by survival through current pre-boundary filters and membership in the effective candidate pool. V2.1-9A inspected `scoredProduct.eligible` / `decision_meta.eligible`; those fields are not emitted by the canonical scored-product representation, so all 1968 rows serialized as unknown.

The actual current path is:

`recommendationProducts → existing pre-score filters → scoredProducts → stable sort → optional existing evaluator-boundary exposure resolution → exposureProducts → result assembly`.

The existing candidate-source diagnostic labels the scored pool `post_score_candidate_pool` and `complete`. In the frozen 164×12 comparator environment, evaluator-boundary runtime flags are unset, so `exposureProducts` is the unchanged `scoredProducts` pool. Therefore every one of the 1968 bounded rows is present and existing-eligible at the frozen 8Z hook.

This is a normalization of already-existing canonical state. It is not a new eligibility rule.

## Semantic separation

- `candidate_present != eligible` as a general rule.
- `eligible != selected`.
- `selected != Top1`.
- `ranked != available`.
- `existing_eligibility=false != candidate_absent` unless a specific existing canonical filter proves that relationship.
- CandidateExposurePolicy state is not a normative policy action.
- `RESTRICT` is not an intrinsic unsafe-product fact.
- `ALLOW` is not approval.
- `DEFER` is not ALLOW.

The 9B snapshot uses `CANONICAL_PRODUCTION_STATE_SNAPSHOT`. Hypothetical exclusion/refill outputs remain separately labeled `HYPOTHETICAL_ENFORCEMENT_ONLY`.

## Frozen 8Z boundary

The frozen boundary `POST_SCORE_POST_SORT_ELIGIBILITY_OVERLAY_BEFORE_RESULT_ASSEMBLY` is technically compatible with current architecture. Its precise placement is after the optional existing evaluator-boundary exposure step has produced `exposureProducts` and immediately before Top1/alternate/category/routine result assembly.

This is a technical placement confirmation only. 8Z semantics are not changed.

## Materialization contract

For the current bounded comparator only:

- candidate-source membership proves survival through the current pre-boundary filters;
- complete `post_score_candidate_pool` membership proves current scored-pool availability;
- default existing exposure path performs no removal;
- therefore the boundary snapshot normalizes each observed row to `PRESENT_AT_ENFORCEMENT_BOUNDARY` and `ELIGIBLE`.

Unknown is never coerced to false or true. If the current authoritative path cannot prove a state, a future snapshot must preserve `UNKNOWN`.

## Hypothetical RESTRICT overlay

The frozen formula remains:

`hypothetical_final_eligibility = existing_eligibility AND normative_policy_eligibility`.

Only a `RESTRICT` row receives hypothetical normative eligibility `false`. The simulation removes only `DEFINITE_NEW_EXCLUSION` rows, preserves all surviving score/sort order, and fills the current bounded Top-K (`K=3`) from the next existing ordered candidates. It never recomputes score or rank.

Current canonical outputs are not overwritten by the hypothetical result.

## Observation failure

The 9B materializer is an offline additive evidence script. It is not imported by production runtime. Materializer failure therefore cannot remove a production candidate, change a response, promote a policy action, or alter persistence.

## Production invariants

`PRODUCTION_ACTIVATION_AUTHORIZED=NO`

`ACTIVATION_EXECUTED=NO`

`RESTRICT_ENFORCEMENT_IMPLEMENTED=NO`

`EXISTING_ELIGIBILITY_RULE_CHANGED=NO`

`CANDIDATE_AVAILABILITY_RULE_CHANGED=NO`

`SCORE_RECOMPUTED_FOR_HYPOTHETICAL_ENFORCEMENT=NO`

`RANK_RECOMPUTED_FOR_HYPOTHETICAL_ENFORCEMENT=NO`

`HOSTED_PRODUCT_FACT_WRITES=0`

`REGISTRY_DEFINITION_DELTA=0`

`MIGRATION_DELTA=0`
