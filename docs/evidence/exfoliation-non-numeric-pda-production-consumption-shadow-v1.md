# V2.1-8V — Exfoliation Non-Numeric PDA Production-Consumption Shadow

Terminal: `PRODUCTION_CONSUMPTION_CONTRACT_SHADOW_IMPLEMENTATION_VALIDATED`

## Boundary

V2.1-8V materializes the frozen V2.1-8U production-consumption contract as a runtime-callable **shadow-only** envelope and a standalone dual-run observer. Neither module is imported by the canonical CandidateExposurePolicy, Recommendation scorer/ranker, eligibility, public response, or persistence path.

`READY_FOR_SEPARATE_POLICY_EVALUATION != allow` and is not caution, block, eligibility, score, rank, or activation. The envelope always has `production_decision = UNSPECIFIED` and `production_authority = false`.

## Runtime integration point

The dual-run observer reuses the existing V2.1-8R external-context adapter to read current request/routine/user/safety state. It evaluates current CandidateExposurePolicy before and after shadow materialization only for comparison, while leaving the canonical inputs, response value, snapshot value, candidate order, and production result untouched.

## Frozen semantic guards

- missing != zero; unknown != false; blocked/conflict != permissive default
- multiple != stronger; identity count != potency; semantic ordering = NONE
- cross-product overlap = governed identity-set intersection only
- concentration/frequency remain context, not potency
- legacy count/strength are not governed PDA potency
- external routine/user/safety context is never promoted into intrinsic PDA authority
- V2.1-8S CLEAR/CAUTION/RESTRICT are not V2.1-8U neutral gates

For `GOVERNED_SIGNAL_NOT_ESTABLISHED`, product context that would only describe an established exfoliating active is retained in provenance/coverage but is not treated as decision-relevant missing potency context. This preserves the frozen 8U reviewed-no-relevant-signal semantics without asserting a negative signal.

## Validation corpus

The focused verifier replays all 12 frozen V2.1-8U canonical examples and four governed V2.1-8O Product Fact examples through the runtime-callable implementation. Governed expected gates are:

1. `0b88019a-9eb2-4be9-842d-f1e60e42cf51` → `READY_FOR_SEPARATE_POLICY_EVALUATION`
2. `c4a5f510-8d9e-46bd-a31c-3c0a34fee331` → `DEFER_INSUFFICIENT_AUTHORITY`
3. `230f1c9c-cbf8-4458-aaac-ea1010a21e8c` → `DEFER_INSUFFICIENT_AUTHORITY`
4. `24a339bf-f380-493f-88b5-68e6be887c30` → `READY_FOR_SEPARATE_POLICY_EVALUATION`

Every governed dual-run row records governed PDA input, external context, generated envelope, neutral gate, current canonical production result, legacy-comparable state, reason codes, uncertainty, and provenance. Runtime fingerprints are compared before/after for canonical CandidatePolicy result, response, snapshot, and candidate order.

## Activation boundary

Production policy implementation, canonical production consumption, production activation, scorer/ranker changes, CandidatePolicy production behavior changes, legacy replacement, numeric fitting, and potency ordering remain explicitly unauthorized.
