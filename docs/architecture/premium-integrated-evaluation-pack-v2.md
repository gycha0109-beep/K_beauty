# Premium Integrated Decision Evaluation Pack v2

## Status

Current-main closeout verifier. It is a deterministic test artifact and is not imported by Production runtime.

## Authoritative entrypoint

Every canonical scenario starts at `buildPremiumDecisionState()` and exercises:

1. SharedSkinDecisionContext v4;
2. FunctionalPolicy;
3. RoutinePolicy;
4. ConditionPolicy;
5. CrossDomainConsistency and effective-policy selection;
6. Premium decision bundle v5;
7. snapshot, reentry, display, and current CandidateExposurePolicy shadow compatibility.

No scenario fabricates a successful provider or policy result.

## Coverage

The pack keeps the 21 logical scenario IDs from the historical #92 design and currently executes 31 explicit variants, 462 assertions, and six cross-domain negative cases.

Photo and Vision variants distinguish:

- no photo;
- provider unavailable;
- provider failure;
- technical failure;
- non-photo or otherwise ineligible input;
- eligible input with insufficient skin evidence;
- available evidence;
- survey/photo conflict.

A failure never becomes a negative skin-condition observation. `factsMayBeInferred` stays false when evidence is unavailable or ineligible.

## CandidateExposurePolicy lane

The historical #92 branch depended on superseded CandidatePolicy goal/safety/current-findings modules. Current main instead uses `evaluateCandidateExposurePolicy()` and the production-hard-disabled CandidateExposurePolicy shadow wrapper.

The v2 lane therefore verifies the current durable contract:

- canonical v4 context is accepted;
- populated and valid-empty current-product findings remain distinct;
- response, snapshot, and candidate order fingerprints remain unchanged;
- aggregate-only shadow telemetry succeeds;
- stable and stabilization scenarios produce bounded deterministic decisions;
- no runtime flag or ranking authority is activated.

## Sunscreen boundary

The partial-sunscreen scenario verifies Product Data Sufficiency audit and the `sunscreen_metadata_incomplete` context caution. It does not activate the #167 completeness eligibility gate. Current catalog gating remains an Admin-contract-dependent recommendation task.

## Snapshot and reentry

The pack verifies:

- deterministic context hash and revision;
- identical retry stability;
- new evidence creates a new snapshot;
- historical snapshots are immutable;
- transient identifiers do not change fingerprints;
- new-report rotation clears current-product state before canonical rebuild;
- legacy display uses the legacy adapter without recalculating policy in the UI.

## Security and privacy

Fixtures contain synthetic products and deterministic survey/photo states only. They contain no user image, provider raw response, credential, session token, or identity.

## Non-targets

- recommendation score, penalty, eligibility, or Top Pick changes;
- CandidateExposurePolicy activation;
- Admin contract or migration;
- Supabase write;
- Provider call;
- Production deployment.

## Exact-head gate

The closeout workflow runs this pack together with v4, Unified Vision, persistence/reentry, recommendation invariance, security closeout, syntax, and optimized build checks from the actual pull-request head SHA.
