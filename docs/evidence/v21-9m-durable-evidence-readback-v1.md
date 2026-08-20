# V2.1-9M Production SHADOW Durable Evidence Readback

## Status

Stage: `V2.1-9M`

Purpose:

- read the V2.1-9L durable privacy-safe SHADOW evidence store through one bounded aggregate contract;
- aggregate `ORGANIC_PRODUCTION`, `CONTROLLED_PRODUCTION_PROBE`, and `UNKNOWN_PRODUCTION_SOURCE` directly;
- evaluate reproducible readiness dimensions;
- determine whether a separate ENFORCE reassessment Stage is eligible to open;
- never authorize or activate ENFORCE.

This Stage does not reopen V2.1-9J, V2.1-9K, or V2.1-9L.

## Starting authority

Repository baseline:

`62ce5b20ac1b9ad19bf159e40a0c59eca9b5b38a`

Production baseline:

- deployment: `dpl_GJoTwrKovKFGeVV1ySjcc3H77nZa`
- ref: `main`
- target: `production`
- state: `READY`
- SHA: `62ce5b20ac1b9ad19bf159e40a0c59eca9b5b38a`
- requested mode: `SHADOW`
- effective mode: `SHADOW`
- runtime active: `true`
- enforcement allowed: `false`
- enforce active: `false`
- canonical restriction active: `false`

Hosted durable store baseline:

- table: `public.recommendation_shadow_evidence_daily_v1`
- rows: `0`
- observed days: `0`
- organic executions: `0`
- controlled executions: `0`
- unknown executions: `0`
- actual exclusion total: `0`

Product Fact baseline:

```text
164 / 1 / 20 / 16 / 16 / 16 /
41 / 41 / 41 / 41 / 180 / 41 / 41
```

Adopted distinct products: `16`

Populated Current Fact keys: `12`

## Read contract

RPC:

`public.read_recommendation_shadow_evidence_v1(date, date)`

Readback schema:

`recommendation-shadow-evidence-readback-v1`

Storage schema:

`exfoliation-normative-organic-shadow-evidence-daily-v1`

Context bucket schema:

`privacy-safe-recommendation-context-bucket-v1`

The RPC is aggregate-only and `STABLE` / `SECURITY INVOKER`.

Execute grants:

- `anon`: denied
- `authenticated`: denied
- `service_role`: allowed

The function does not mutate evidence.

## Window contract

The evidence window is explicit:

```text
[start_inclusive, end_exclusive)
```

The first durable collection date is `2026-08-20` UTC.

A requested start before that date is rejected rather than being presented as if durable evidence existed before the V2.1-9L store.

No vague `recent` or `meaningful enough` duration is encoded.

## Provenance aggregation

Frozen source vocabulary:

```text
ORGANIC_PRODUCTION
CONTROLLED_PRODUCTION_PROBE
UNKNOWN_PRODUCTION_SOURCE
```

Each source is aggregated directly from its own `TOTAL / ALL` rows.

Never derive organic traffic by subtraction.

Missing provenance never becomes organic.

## Returned facts

For every source partition:

- execution count
- candidate evaluation count
- ALLOW count
- CAUTION count
- RESTRICT count
- DEFER count
- NOT_APPLICABLE count
- fallback count
- runtime error count
- hypothetical exclusion count
- actual exclusion count
- stopRequired count

Window-level output also returns:

- observed days
- first/last observed day inside the window
- explicit version groups
- independent context marginals
- stop reason distribution

Multiple version groups are never silently merged into one readiness authority.

## Context privacy contract

Only the frozen marginal dimensions are returned:

- `PRIMARY_CONCERN_CLASS`
- `SENSITIVITY_RISK_CLASS`
- `CONCERN_STRUCTURE_CLASS`
- `SURVEY_COMPLETENESS_CLASS`
- `RECENT_INSTABILITY_CLASS`

`STOP_REASON` remains a separate distribution.

The readback does not join these dimensions into a composite person-like fingerprint.

Forbidden output includes user/session/product identity, IP, email, token, device fingerprint, raw image, raw questionnaire, raw request, and free text.

## Readiness dimensions

The deterministic evaluator freezes these dimensions:

- `R1_ORGANIC_TRAFFIC_PRESENT`
- `R2_PROVENANCE_INTEGRITY`
- `R3_UNKNOWN_SOURCE_INTEGRITY`
- `R4_ORGANIC_ACTION_EVIDENCE`
- `R5_ORGANIC_CONTEXT_DIVERSITY_EVIDENCE`
- `R6_FALLBACK_BEHAVIOR_EVIDENCE`
- `R7_RUNTIME_ERROR_BEHAVIOR_EVIDENCE`
- `R8_SHADOW_ACTUAL_EXCLUSION_INVARIANT`
- `R9_CANONICAL_RECOMMENDATION_INVARIANCE_REFERENCE`
- `R10_PRODUCTION_VERSION_SCOPE_STABILITY`
- `R11_HOSTED_PRODUCT_FACT_STABILITY`
- `R12_OBSERVATION_WINDOW_EVIDENCE`

No invented numeric traffic, user, execution, context, confidence, or day threshold is embedded.

## Trigger states

The evaluator can return:

```text
NOT_READY
BLOCKED_INTEGRITY_FAILURE
ENFORCE_REASSESSMENT_SUFFICIENCY_POLICY_REQUIRED
```

The vocabulary also reserves:

`READY_FOR_SEPARATE_ENFORCE_REASSESSMENT`

but V2.1-9M does not produce READY from an invented sufficiency rule.

### NOT_READY

Used when a required evidence category is objectively absent, including current zero organic traffic.

### BLOCKED_INTEGRITY_FAILURE

Used for integrity failures such as:

- Production SHADOW inactive;
- ENFORCE not inactive;
- actual exclusion observed in SHADOW;
- stopRequired evidence observed;
- incompatible version groups in one readiness window;
- canonical Recommendation invariance not verified;
- Production version/scope instability;
- Hosted Product Fact instability;
- invalid/privacy-leaking readback.

### SUFFICIENCY POLICY REQUIRED

If organic traffic, action evidence, required marginal categories, provenance integrity, and runtime safety evidence are present, the remaining question is evidence sufficiency.

No current governed contract defines how much natural operation is sufficient to distinguish thin evidence from adequate evidence. V2.1-9M therefore must not convert one execution, one day, or any invented N into READY.

The evaluator returns:

`ENFORCE_REASSESSMENT_SUFFICIENCY_POLICY_REQUIRED`

until a separate governance contract defines that boundary.

## Current readiness result

At the audited Stage start:

```text
ORGANIC_PRODUCTION = 0
CONTROLLED_PRODUCTION_PROBE = 0
UNKNOWN_PRODUCTION_SOURCE = 0
OBSERVED_DAYS = 0
```

Therefore:

```text
CURRENT_REASSESSMENT_TRIGGER = NOT_READY
REASON = organic_traffic_absent
```

This is expected and valid. No Production evidence is generated to change this result.

## Sufficiency governance decision

Intermediate governance decision:

`ENFORCE_REASSESSMENT_SUFFICIENCY_POLICY_REQUIRED`

This is not a request to activate ENFORCE. It means the durable read path is technically capable of reporting evidence categories, but the later transition from category-complete evidence to reassessment eligibility requires its own governed sufficiency policy.

## Primary V2.1-9M outcome

Exactly one primary outcome is frozen:

`ENFORCE_REASSESSMENT_SUFFICIENCY_POLICY_REQUIRED`

## ENFORCE boundary

Always:

```text
ENFORCE_AUTHORIZED = NO
ENFORCE_ACTIVE = NO
```

A future sufficiency policy may allow the trigger contract to return `READY_FOR_SEPARATE_ENFORCE_REASSESSMENT`. That state would authorize only opening a separate reassessment Stage, not ENFORCE itself.
