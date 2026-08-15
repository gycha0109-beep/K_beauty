# V2.1-8Q — Exfoliation Non-Numeric PDA Shadow Recommendation Consumption Audit

## Terminal outcome

`SHADOW_RECOMMENDATION_CONSUMPTION_REQUIRES_ADAPTER_CONTRACT`

Exactly one terminal outcome is frozen. This stage does not implement or activate the adapter.

## Repository authority

- Repository: `gycha0109-beep/K_beauty`
- Frozen base main: `a73ca3261b5c713f908a8010a47737a7072ff5e4`
- Upstream 8O: `NON_NUMERIC_EXFOLIATION_PDA_CONTRACT_FROZEN`
- Upstream 8P: `NON_NUMERIC_EXFOLIATION_PDA_OFFLINE_SHADOW_REPLAY_VALIDATED`

## Downstream trace result

The repository contains safe shadow infrastructure, but no existing runtime or offline consumer directly accepts the 8O/8P structured-categorical exfoliation PDA contract.

Actual runtime shadow chain:

`app/api/analyze/route.js`
→ `runCandidateExposurePolicyShadow`
→ `evaluateCandidateExposurePolicy`
→ `runCandidateExposureEvaluatorAdapter`
→ evaluator-boundary shadow execution.

The caller supplies canonical premium state, candidate rows and legacy evaluator shadow output. There is no structured-categorical exfoliation PDA argument.

The older offline PDA comparator `product-decision-axis-shadow-recommendation-v1.mjs` keeps numeric contribution, shadow score and shadow rank null, but its generic axis-record shape predates 8O and does not consume `active_identities`, `multi_active_status`, or the 8O contextual fields.

## Intrinsic vs derived vs legacy authority

Intrinsic PDA may supply, without potency inference:

- signal state
- active identity set
- multi-active state/cardinality
- product-specific context
- coverage
- uncertainty
- provenance

Adapter/downstream logic must derive, using separate routine/user context:

- cross-product identity overlap
- duplicate exfoliation
- routine stacking
- same-window conflict
- sensitivity interaction
- reaction/instability interaction
- caution/restriction decision inputs

Legacy-only authority remains isolated:

- `product-functional-profile.js::strengthFromCount` converts functional counts to none/low/medium/high and applies category caps.
- `current-product-findings.js` requires legacy strength/confidence thresholds for direct support and duplicate-axis findings.
- `skin-match-decision-engine.js` converts ingredient functional counts into tiered numeric recommendation bonuses.
- `current-product-verdicts.js` uses a structured-metadata regex heuristic labelled as a strong-active signal.

None of those legacy mechanisms becomes governed PDA potency authority.

## Adapter boundary

Frozen contract boundary:

`non_numeric_exfoliation_pda + routine_user_context -> shadow_decision_input`

The adapter must preserve missing/unknown states and identity-set semantics. It may derive overlap by identity intersection, but must not produce numeric/ordinal potency, stronger/weaker, count-derived magnitude, `multiple -> stronger`, concentration-derived cross-active magnitude, `unknown -> false`, or `missing -> zero`.

## Why B, not A or C

A is rejected because direct structured-categorical PDA consumption is not implemented in the existing shadow contracts.

C is rejected because the required downstream information can be formed from the frozen PDA plus separately authoritative routine/user context without creating potency semantics. Legacy strength/count dependencies can be bypassed in a future shadow adapter while remaining unchanged in production.

## Verification boundary

The focused verifier freezes:

- exact 8O and 8P hashes
- exact traced production/source Git blob fingerprints
- the complete 17-row consumer ledger
- exactly one terminal outcome
- semantic prohibitions and missing/unknown preservation
- deterministic Build A/B serialization equality
- exact additive stage scope
- historical V2.1-8J → V2.1-8P replay through dedicated CI
- 164 catalog products × 12 production-impact dimensions = 1968 zero-delta evaluations

No production Recommendation, scorer/ranker, CandidateExposurePolicy, legacy heuristic, Hosted Product Facts, Registry definition, or migration is changed by V2.1-8Q.
