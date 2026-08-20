# V2.1-9L Production SHADOW Organic Evidence Durability

## Status

- Stage: `V2.1-9L`
- Previous stages: `V2.1-9J` and `V2.1-9K` remain CLOSED.
- Frozen V2.1-9K outcome: `ORGANIC_SHADOW_EVIDENCE_INSUFFICIENT_FOR_ENFORCE_REASSESSMENT`
- Durability assessment: `DURABLE_ORGANIC_EVIDENCE_STORE_REQUIRED`
- Implementation path: `MINIMAL_DURABLE_AGGREGATE_OBSERVABILITY_IMPLEMENTATION`
- ENFORCE authorized: `NO`
- ENFORCE active: `NO`
- Product Fact semantic delta: `0`
- Recommendation semantic delta: `0`

## Existing Runtime Log durability audit

The V2.1-9J observer emits one aggregate normative-policy telemetry event per Recommendation execution through the production runtime log sink. This remains useful for immediate diagnostics and source-partition verification.

It is not accepted as the sole long-horizon governance evidence store because the governance requirement is stronger than short-window debugging:

- Runtime Logs are subject to a platform retention window rather than repository-owned durable retention.
- Long-term retention is documented as a Log Drain use case.
- Runtime-log retrieval is bounded and query-oriented rather than an append-only governance ledger.
- Deployment-scoped retrieval fragments the evidence window when Production is redeployed.
- Project-scoped reconstruction still depends on the underlying Runtime Log retention window.
- A future reassessment must be able to aggregate across Production deployments after the original runtime log window has expired.

Therefore V2.1-9L freezes:

`DURABLE_ORGANIC_EVIDENCE_STORE_REQUIRED`

This is an observability durability conclusion only. It does not reopen V2.1-9K and does not imply ENFORCE readiness.

## Storage authority

The durable store is a separate runtime observability domain hosted in Supabase because the application already has a server-only service-role authority boundary for controlled backend persistence and repository-owned migrations.

The implementation does not reuse or mutate Product Fact relations.

Dedicated relation:

`public.recommendation_shadow_evidence_daily_v1`

Dedicated controlled operation:

`public.record_recommendation_shadow_evidence_daily_v1(jsonb)`

Direct table mutation is not granted to `anon` or `authenticated`. The table has RLS enabled. The controlled RPC is granted only to `service_role`.

## Time aggregation

The durable time bucket is one UTC calendar day.

Daily granularity is sufficient for the governance question—whether meaningful real Production Recommendation conditions have accumulated across time—and avoids preserving unnecessary fine-grained timestamps that could enable reconstruction of individual sequences in low traffic.

No per-request timestamp is persisted.

## Provenance

The frozen V2.1-9J vocabulary remains authoritative and unchanged:

- `ORGANIC_PRODUCTION`
- `CONTROLLED_PRODUCTION_PROBE`
- `UNKNOWN_PRODUCTION_SOURCE`

Missing or malformed provenance fails closed to `UNKNOWN_PRODUCTION_SOURCE`. It never becomes organic evidence.

No new production source is introduced.

## Context diversity model

The context model is deliberately marginal rather than a multi-dimensional composite fingerprint.

Each Recommendation execution increments one daily `TOTAL` aggregate and one aggregate in each approved bounded dimension:

### `PRIMARY_CONCERN_CLASS`

- `barrier`
- `dehydration`
- `oiliness`
- `redness`
- `acne`
- `pores`
- `uneven_tone`
- `uv`
- `UNKNOWN`

This vocabulary comes directly from the canonical survey concern contract.

### `SENSITIVITY_RISK_CLASS`

- `LOW`
- `MEDIUM`
- `HIGH`
- `UNKNOWN`

This is derived from the canonical survey safety contract.

### `CONCERN_STRUCTURE_CLASS`

- `NONE`
- `SINGLE`
- `MULTI`

Only concern multiplicity is retained; the exact concern combination is not persisted.

### `SURVEY_COMPLETENESS_CLASS`

- `COMPLETE`
- `PARTIAL`

Only whether the canonical survey contract reports missing fields is retained. The missing field names are not persisted.

### `RECENT_INSTABILITY_CLASS`

- `PRESENT`
- `ABSENT`
- `UNKNOWN`

This is derived from the bounded `recentSkinChange` and `recentlyChangedProduct` safety flags. The two raw answers are not persisted.

### `STOP_REASON`

Only the existing fixed normative-policy stop-reason vocabulary may be aggregated. No free-form error message is persisted.

## Why dimensions are not cross-combined

V2.1-9L intentionally does not create a key such as:

`barrier + HIGH + MULTI + PARTIAL + PRESENT`

A composite bucket would become increasingly sparse and could function as a pseudo-identifier in a low-traffic service. Marginal distributions answer the governance coverage question without preserving a unique combination fingerprint.

## Persisted data contract

Every aggregate row contains only:

- day bucket
- evidence/context schema versions
- activation/policy/runtime versions
- frozen production provenance
- one bounded partition key/value
- execution count
- candidate evaluation count
- five policy-action counts
- fallback count
- runtime error count
- hypothetical exclusion count
- actual exclusion count
- stop-required count

Actual exclusion is constrained to zero in this SHADOW-only store.

The persistence payload contains no user, session, product identity, raw input, raw image, token, IP, free text, request body, or response body.

## Privacy validation

The application validator rejects normalized/nested variants of forbidden fields including:

- `userId`, `user_id`, `USER-ID`
- `sessionToken`, `session_token`
- `authToken`, `accessToken`, `refreshToken`
- `rawIp`, `ipAddress`
- `rawImage`, `photoData`
- `questionnairePayload`, `surveyPayload`
- `requestBody`, `responseBody`
- `identifyingFreeText`
- product identifiers/names/brands

The SQL operation also accepts an exact 21-field aggregate row shape and bounded partition vocabularies only.

## Concurrency

Concurrent Recommendation executions use a single PostgreSQL atomic UPSERT:

`INSERT ... ON CONFLICT (...) DO UPDATE SET count = existing + excluded`

There is no application-level read → increment → write sequence, so concurrent successful increments are not lost through that race pattern.

## Delivery and replay semantics

The writer is intentionally **at-least-once capable, not exactly-once guaranteed**.

Exactly-once persistence would require a durable high-cardinality request/idempotency identifier or another per-execution deduplication identity. V2.1-9L does not introduce such an identifier because it would weaken the privacy boundary and make user/request reconstruction more feasible.

The application performs one persistence scheduling attempt for each completed SHADOW observation and has no automatic retry loop. A platform-level invocation replay can therefore over-count an execution, while an unrecoverable storage failure can under-count it. Future governance must interpret aggregate counts with this delivery contract rather than treating them as cryptographic billing counters.

No numeric ENFORCE sufficiency threshold is introduced in V2.1-9L.

## Failure isolation

Canonical Recommendation authority is strictly higher than evidence persistence.

The completed SHADOW observation schedules persistence using the framework post-response lifecycle. Any scheduling, client, RPC, or write failure is caught and reduced to a fixed privacy-safe warning code.

Evidence persistence failure:

- does not fail the Recommendation response
- does not change score
- does not change ranking
- does not change eligibility
- does not change CandidatePolicy
- does not change public response schema
- does not mutate Product Fact
- does not authorize or activate ENFORCE

## Versioning

Evidence schema:

`exfoliation-normative-organic-shadow-evidence-daily-v1`

Context contract:

`privacy-safe-recommendation-context-bucket-v1`

A future bucket-definition change requires a new version. Historical rows are not silently reclassified.

## Verification contract

The dedicated V2.1-9L verifier covers T1–T18:

1. ORGANIC persists only ORGANIC.
2. CONTROLLED persists only CONTROLLED.
3. UNKNOWN remains UNKNOWN.
4. Missing/malformed provenance never becomes ORGANIC.
5. Context derivation is deterministic.
6. Raw questionnaire/input is not persisted.
7. Forbidden identity/token/IP/image/raw payload keys are rejected recursively.
8. Action vocabulary/count mapping is exact.
9. Candidate evaluation aggregation is exact.
10. Fallback/error aggregation is exact.
11. Non-zero SHADOW actual exclusion is rejected.
12. Persistence failure is Recommendation-safe.
13. Concurrent increments use atomic SQL UPSERT.
14. Replay/exactly-once limitation is explicit and no high-cardinality dedup key is introduced.
15. OFF creates no durable SHADOW evidence.
16. SHADOW evidence derivation does not mutate canonical input/observation.
17. 9L does not authorize or implement ENFORCE.
18. Product Fact authority is structurally untouched.

Historical V2.1-9J provenance and canonical Recommendation invariance gates remain required in CI.

## Production boundary

V2.1-9L must finish with:

- `requestedMode = SHADOW`
- `effectiveMode = SHADOW`
- `runtimeActive = true`
- `enforcementAllowed = false`
- `enforceActive = false`
- `restrictCanonicalExclusionActive = false`

No Production controlled probe is authorized for 9L.

No synthetic Production organic traffic is authorized for 9L.

## Terminal meaning

If migration, runtime wiring, privacy validation, regressions, merged-main CI, Hosted readback, and Production SHADOW readback all pass, the terminal outcome is:

`DURABLE_PRIVACY_SAFE_ORGANIC_SHADOW_EVIDENCE_COLLECTION_READY`

This means future naturally occurring SHADOW evidence has a durable privacy-safe aggregate collection path.

It does **not** mean:

`READY_FOR_ENFORCE_REASSESSMENT = YES`

That remains a separate future evidence-sufficiency audit.
