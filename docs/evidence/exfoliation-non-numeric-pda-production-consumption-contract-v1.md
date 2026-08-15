# V2.1-8U — Exfoliation Non-Numeric PDA Production-Consumption Contract Design & Freeze

## Result

`PRODUCTION_CONSUMPTION_CONTRACT_FROZEN`

This freezes a **non-runtime production-consumption input contract** only. It does not implement production consumption, authorize activation, replace legacy heuristics, or map PDA/shadow categorical states to production allow/block behavior.

## Execution authority

- Repository: `gycha0109-beep/K_beauty`
- V2.1-8T merged main: `d988f33664e3086250e2595b55319aa18e127608`
- V2.1-8T terminal: `PRODUCTION_CONSUMPTION_CONTRACT_DESIGN_READY`
- V2.1-8S consumer: `exfoliation-non-numeric-pda-shadow-decision-consumer-v1`
- Contract version: `exfoliation-non-numeric-pda-production-consumption-contract-v1`

## Frozen contract boundary

The contract separates four authorities:

1. **Governed intrinsic PDA** — authoritative only for intrinsic exfoliation signal semantics: `signal_status`, governed `active_identities`, `multi_active_status`, product-specific context, coverage, uncertainty, and Product Fact/PDA provenance.
2. **External routine/user/safety context** — authoritative only for current product/candidate sets, routine windows, user sensitivity, recent change, reaction/instability, and safety state.
3. **Legacy heuristics** — current production behavior may continue unchanged, but `ingredient_signals.functional.count`, low/medium/high strength, and numeric ranking contribution are not governed PDA authority and cannot fill missing PDA data.
4. **Production decision policy** — remains a separate versioned authority. The 8U contract supplies inputs only and does not decide exposure, eligibility, score, rank, lane eligibility, or public response.

Authority is domain-scoped. There is no global rule that lets PDA override external user state or lets external/legacy state rewrite intrinsic Product Fact semantics.

## Intermediate production input

A future implementation may materialize the frozen envelope containing:

- governed intrinsic PDA;
- explicit external context and completeness;
- structural derived relations such as governed identity intersection and routine-window relation;
- a neutral consumption gate;
- full lineage, uncertainty, and reasons.

The only contract gate states are:

- `READY_FOR_SEPARATE_POLICY_EVALUATION`
- `DEFER_INSUFFICIENT_AUTHORITY`
- `DEFER_BLOCKED_AUTHORITY`
- `DEFER_CONTEXT_CONFLICT`
- `NOT_APPLICABLE`

`READY_FOR_SEPARATE_POLICY_EVALUATION` means only that the input envelope is structurally usable by a **separate versioned production policy**. It is not an allow, caution, score, rank, eligibility, or exposure decision.

## UNKNOWN / missing / blocked

The fail-safe order is:

1. `NOT_APPLICABLE`
2. blocked governed authority → `DEFER_BLOCKED_AUTHORITY`
3. unknown/missing governed authority or partial/unknown decision-relevant external context → `DEFER_INSUFFICIENT_AUTHORITY`
4. unresolved external semantic conflict → `DEFER_CONTEXT_CONFLICT`
5. otherwise → `READY_FOR_SEPARATE_POLICY_EVALUATION`

The following remain absolute:

- missing != zero
- unknown != false
- blocked/conflict != permissive default
- reviewed no-relevant-signal != explicit negative signal
- a deferred gate cannot produce PDA-driven promotion

## Multi-active and product context

- `multiple != stronger`
- identity count != potency
- identity ordering = `NONE`
- cross-product overlap may use only governed identity set intersection
- concentration is product-specific context only
- recommended frequency is usage-instruction context only
- concentration/frequency never create cross-active magnitude or potency ordering

## Legacy migration boundary

The existing legacy path remains unchanged:

`ingredient_signals.functional.count`
→ `low/medium/high strength`
→ legacy findings/caution tags
→ numeric `FunctionalRankingContract` contribution

8U does not remove or modify this path.

A later migration may replace a legacy dependency only after a shadow/dual-run implementation of the frozen envelope, governed-product replay, explicit dependency inventory, a separately versioned production policy, and activation-specific validation/rollback evidence. Migration may never reinterpret legacy strength or numeric fit as governed PDA potency.

RoutinePolicy, RecentInstabilityGuardPolicy, and CandidateExposurePolicy remain separate production policies. Their current behavior is not mutated by this contract.

## Provenance and explainability

A future materialized envelope must retain:

### Intrinsic lineage
- registry/version or equivalent governed authority
- proposition / fact-instance lineage
- semantic status
- authority ceiling
- PDA contract version
- PDA mapper version
- materialized PDA snapshot/checksum when applicable

### External lineage
- context version
- request/session/source authority
- routine/safety policy version where derived
- unknown/conflict reasons

### Consumption lineage
- production-consumption contract version
- gate state
- sorted reason codes
- uncertainty
- derived-relation provenance

Raw evidence bodies are not required in the envelope.

## Canonical examples

The frozen example set covers:

- complete single-active, no overlap
- complete unordered multi-active
- governed identity overlap
- high sensitivity external context
- reaction/instability external context
- missing product-specific context
- unknown governed signal
- blocked governed authority
- unknown external context
- external context conflict
- reviewed no-relevant-signal with complete authority
- non-applicable category

Every example keeps `production_decision = UNSPECIFIED`.

## Why terminal A is valid

No irreducible semantic contradiction was found, and a normative allow/block policy is **not required to finish this consumption contract** because the contract ends at a neutral, versioned input/gate boundary. Normative production behavior belongs to a later production-policy/activation stage.

Therefore:

`PRODUCTION_CONSUMPTION_CONTRACT_FROZEN`

does **not** mean:

- production consumption is implemented;
- production activation is ready;
- `CLEAR` is allow;
- `RESTRICT` is block;
- legacy heuristics are deprecated.

## Validation requirements

V2.1-8U dedicated CI must verify:

- canonical deterministic Build A/B for all four JSON artifacts;
- focused contract semantics and canonical examples;
- frozen 8S/8T authority;
- historical V2.1-8J through V2.1-8T replay;
- exact additive-only scope;
- no `app/`, `lib/`, package/lock, or migration changes;
- 164 × 12 production Recommendation invariance;
- Hosted/Registry remains read-only and zero-delta.

## Explicit NO

- `DECISION_AXIS_PRODUCTION_CONSUMPTION = NO`
- `RECOMMENDATION_SCORER_CHANGED = NO`
- `RECOMMENDATION_ACTIVATED = NO`
- `CANDIDATE_POLICY_PRODUCTION_CHANGED = NO`
- `LEGACY_HEURISTIC_REPLACED = NO`
- `SHADOW_CLEAR_PROMOTED_TO_ALLOW = NO`
- `SHADOW_RESTRICT_PROMOTED_TO_BLOCK = NO`
- `PRODUCTION_CONSUMPTION_RUNTIME_IMPLEMENTED = NO`
- `PRODUCTION_ACTIVATION_AUTHORIZED = NO`
- `NUMERIC_FITTING = 0`
- `POTENCY_ORDERING_CREATED = NO`
- `HOSTED_PRODUCT_FACT_WRITES = 0`
- `REGISTRY_DEFINITION_DELTA = 0`
- `MIGRATION_DELTA = 0`
