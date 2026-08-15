# V2.1-8S Exfoliation Non-Numeric PDA Shadow Decision Consumer Evaluation

## Result

`SHADOW_DECISION_CONSUMER_VALIDATED`

## Authority

- Repository base: `053a963a14bf00d7deb731a2c5427a97f3172b9f`
- V2.1-8R terminal: `SHADOW_RECOMMENDATION_ADAPTER_IMPLEMENTATION_VALIDATED`
- Adapter: `exfoliation-non-numeric-pda-shadow-recommendation-adapter-v1`
- Consumer: `exfoliation-non-numeric-pda-shadow-decision-consumer-v1`

## Boundary

`shadow_decision_input -> shadow_consumer_decision`

The consumer does not re-derive exfoliation policy from product metadata, identity count, concentration, legacy strength, or canonical CandidateExposurePolicy. The only decision authority is the adapter's categorical `caution_restriction_shadow_input`, with a conservative uncertainty guard over adapter-preserved coverage and external-context uncertainty.

## Decision semantics

- `CLEAR`: no caution/restriction is established and no decision-blocking missing or external uncertainty remains. It is not approval, eligibility, or a production safety claim.
- `CAUTION`: exact projection of adapter state `caution`.
- `RESTRICT`: exact shadow projection of adapter state `restriction_candidate`. It does not mutate production eligibility or ranking.
- `UNKNOWN`: upstream missing/unknown/blocked state, or an otherwise-clear projection with decision-blocking missing context / external-context uncertainty.
- `NOT_APPLICABLE`: adapter/PDA state is not applicable.

`RESTRICT` is never inferred from active identity count, multi-active status, concentration, or a stronger/weaker ordering.

## Runtime integration

The existing runtime shadow path remains:

`app/api/analyze/route.js -> runCandidateExposurePolicyShadow`

Within `runCandidateExposurePolicyShadow`:

1. build the V2.1-8R exfoliation PDA `shadow_decision_input`;
2. run the V2.1-8S consumer against that adapter result;
3. run the existing canonical CandidateExposurePolicy evaluator with the unchanged `{ canonicalState, candidates }` input;
4. return the consumer only as `exfoliationPdaShadowConsumer` on the internal shadow result.

The telemetry schema, public response, persistence payload, CandidatePolicy canonical result, score, rank and eligibility are unchanged. Adapter or consumer failure is isolated from the existing evaluator path.

## Replay

The focused verifier covers 13 cases:

single active/no overlap; single active/overlap; multi-active; duplicate exfoliation; routine stacking; same-window conflict; sensitivity interaction; recent reaction/instability; unknown authority; missing context; no relevant active established; not applicable; conflicting caution signals.

Every case verifies `PDA + external context -> adapter output -> consumer decision` lineage, reason preservation, coverage/uncertainty preservation, provenance preservation, and absence of potency ordering.

## Invariants

- `identity_set_has_no_potency_order`
- `missing != zero`
- `unknown != false`
- `multiple != stronger`
- `active_concentration != cross-active magnitude`
- legacy strength/count is not governed PDA authority
- Product Fact/PDA never absorbs routine or reaction context
- Production Recommendation activation remains disabled

## Production / Hosted

The canonical `164 x 12 = 1968` invariance suite must remain zero-delta for score, ranking, Top1, Top3, eligibility, public response, persistence and CandidatePolicy canonical result.

Hosted Product Fact / Registry is READ ONLY. Expected writes, Registry definition delta and migration delta are all zero.
