# CandidateExposurePolicy Temporary Synthetic Diagnostic Route Cleanup Design v1

## 1. Purpose

Stage 11L designs and independently reviews the mandatory removal of the temporary Preview-only CandidateExposurePolicy synthetic diagnostic route implemented in Stage 11K.

This stage is design-only. It does not delete runtime files, call the Hosted endpoint, modify `/api/analyze`, change dependencies, deploy or promote Production, authorize runtime filtering, or merge a stacked branch.

Cleanup design base:

```text
repository: gycha0109-beep/K_beauty
base branch: codex/candidate-exposure-policy-synthetic-diagnostic-route
base SHA: 51b186d21a0a6ece911fc2016985945c34ac7ee8
Draft PR: #122
```

Stage 11K evidence at that base:

```text
route checker: PASS, 63 assertions
execution checker: PASS, 110 assertions
security-closeout preparation: PASS, 16/16
security-closeout verifiers: PASS, 60/60
architecture guard: PASS
production build: PASS
Vercel Preview: READY
Hosted diagnostic POST requests: 0
Production changes: 0
```

Stage 11L retains that as historical implementation evidence. It does not reinterpret it as Hosted execution evidence.

## 2. Lifecycle authority

Stage 11J required the temporary route to be removed before CandidatePolicy integration toward `main`.

```text
Stage 11J route design
→ Stage 11K route implementation and validation
→ Stage 11L cleanup design and review
→ Stage 11M cleanup implementation and verification
→ only then consider integration toward main
```

Proposed implementation branch:

```text
codex/candidate-exposure-policy-synthetic-diagnostic-route-cleanup
```

Stage 11M must be a separate stacked Draft branch based on the final Stage 11K head. No direct cleanup commit is authorized on `main` or the Stage 11K branch.

## 3. Cleanup invariant

Cleanup is complete only when the temporary application-plane capability is absent and the pre-route Stage 11I fail-closed boundary is restored.

```text
temporary route path: absent
route-only HMAC module: absent
route-only request/envelope contract: absent
route-only fixture execution module: absent
route checker: absent
Hosted adapter: exact pre-route blob restored
Hosted execution v2: exact pre-route blob restored
Hosted execution checker: exact pre-route blob restored
/api/analyze: unchanged
Production changes: zero
```

The route must not be replaced by another endpoint, middleware hook, rewrite, server action, CLI, workflow trigger, compatibility alias, or renamed equivalent.

## 4. File classification

### 4.1 Delete completely

```text
app/api/internal/candidate-exposure-policy-diagnostic/route.js
lib/candidate-exposure-policy-hosted-diagnostic-auth.js
lib/candidate-exposure-policy-hosted-diagnostic-contract.js
lib/candidate-exposure-policy-hosted-diagnostic-execution.js
scripts/check-candidate-exposure-policy-hosted-diagnostic-route.mjs
```

These paths must be absent. Empty stubs, forwarding modules, tombstones, or renamed equivalents are prohibited.

### 4.2 Restore exact pre-route blobs

The following files existed before Stage 11K and must be restored byte-for-byte from Stage 11J base SHA `1aa3617a641a1650df2901346ccabcee32c95414`:

```text
lib/candidate-exposure-policy-hosted-execution-v2.js
Git blob: 3220b96a1e81e6c85eb12f05b3ce96b085cecb0b

lib/candidate-exposure-policy-read-only-hosted-adapter.js
Git blob: 12494938e141e2f74676444b8cbdf2f29edb812b

scripts/check-candidate-exposure-policy-hosted-execution.mjs
Git blob: 24baea33e998a9285ddbc65ffda54500a9d4c061
```

This restores:

```text
current route capability: /api/analyze
synthetic fixture injection: unsupported
Hosted diagnostic envelope: unsupported
execution plan: blocked_before_execution
blocker: diagnostic_route_contract_unsupported
```

A hand-edited semantic approximation is not acceptable; verification must compare Git blob identities.

### 4.3 Retain historical evidence

The Stage 11K implementation review and result documents remain unchanged as historical records:

```text
docs/reviews/candidate-exposure-policy-hosted-diagnostic-route-implementation-review.md
docs/verification/candidate-exposure-policy-hosted-diagnostic-route-implementation-result.md
```

Stage 11M adds separate cleanup evidence:

```text
docs/reviews/candidate-exposure-policy-hosted-diagnostic-route-cleanup-review.md
docs/verification/candidate-exposure-policy-hosted-diagnostic-route-cleanup-result.md
```

## 5. Stage 11M fixed diff boundary

The implementation diff is limited to exactly twelve files:

```text
D app/api/internal/candidate-exposure-policy-diagnostic/route.js
D lib/candidate-exposure-policy-hosted-diagnostic-auth.js
D lib/candidate-exposure-policy-hosted-diagnostic-contract.js
D lib/candidate-exposure-policy-hosted-diagnostic-execution.js
D scripts/check-candidate-exposure-policy-hosted-diagnostic-route.mjs
M lib/candidate-exposure-policy-hosted-execution-v2.js
M lib/candidate-exposure-policy-read-only-hosted-adapter.js
M scripts/check-candidate-exposure-policy-hosted-execution.mjs
A scripts/verify-candidate-exposure-policy-diagnostic-route-absence.mjs
M scripts/run-security-closeout-verifier-suite.mjs
A docs/reviews/candidate-exposure-policy-hosted-diagnostic-route-cleanup-review.md
A docs/verification/candidate-exposure-policy-hosted-diagnostic-route-cleanup-result.md
```

No package, lockfile, workflow, Vercel configuration, middleware, migration, UI, database, Auth, Payment, Storage, recommendation, or `/api/analyze` file may change.

## 6. Durable absence verifier

Stage 11M adds and retains:

```text
scripts/verify-candidate-exposure-policy-diagnostic-route-absence.mjs
```

It is registered in `run-security-closeout-verifier-suite.mjs`, increasing the expected verifier count from 60 to 61.

The verifier must prove all of the following.

### 6.1 Path absence

All five temporary paths are absent, and `app/api/internal/candidate-exposure-policy-diagnostic/` contains no route handler.

### 6.2 Exact restoration

The three restored files match the expected Git blobs exactly.

### 6.3 Temporary token absence

Outside documentation and the absence verifier itself, no source, script, package, workflow, or configuration file may contain:

```text
/api/internal/candidate-exposure-policy-diagnostic
x-bejewely-diagnostic-timestamp
x-bejewely-diagnostic-nonce
x-bejewely-diagnostic-signature
CANDIDATE_EXPOSURE_POLICY_DIAGNOSTIC_GRANT_DIGEST
CURRENT_CANDIDATE_POLICY_DIAGNOSTIC_ROUTE_CAPABILITY
postCandidatePolicyDiagnostic
probeCandidatePolicyDiagnostic
candidate-exposure-policy-hosted-diagnostic-plan-v2
```

Historical design/review/result documents may retain those strings.

### 6.4 Import closure

The verifier must reject direct imports, dynamic imports, `require`/`createRequire` references, package-root re-exports, computed path references, and renamed equivalents that preserve the deleted capability.

### 6.5 `/api/analyze` invariance

The `/api/analyze` blob at the Stage 11M head must equal the Stage 11K cleanup-base blob. Cleanup does not authorize synthetic fixture input, diagnostic envelopes, runtime filtering, or any product-route modification.

## 7. Restored checker expectations

The restored Hosted execution checker must again prove the pre-route blocked state:

```text
CURRENT_ANALYZE_ROUTE_CAPABILITY supportsSyntheticFixtureInjection === false
CURRENT_ANALYZE_ROUTE_CAPABILITY emitsHostedDiagnosticEnvelope === false
buildExecutionPlan status === blocked_before_execution
blockers include diagnostic_route_contract_unsupported
metadata reads before blocker === 0
application-plane probes before blocker === 0
Production authority === false
runtime-log reads === 0
mutation authority === 0
```

The deleted Stage 11K route checker remains historical evidence only and is not expected to run after cleanup.

## 8. Verification plan

Stage 11M runs against the exact implementation head with full Git history.

```text
1. exact 12-file diff boundary
2. durable route-absence verifier
3. restored Hosted execution checker
4. security-closeout preparation suite
5. security-closeout verifier suite: 61/61
6. architecture guard and ghost-code audit
7. changed retained-file syntax validation
8. Next.js production build
9. Vercel Preview READY inspection
10. final tree/path/import/blob recheck
```

Expected operation counters:

```text
Hosted diagnostic POST requests: 0
/api/analyze diagnostic requests: 0
Provider calls: 0
runtime-log reads: 0
environment mutations: 0
deployment mutations: 0
Production changes: 0
```

The Preview proves only that the cleaned application builds and the deleted route is absent from the route table. It does not authorize a diagnostic request.

## 9. Route-table evidence

The production build output must not contain:

```text
/api/internal/candidate-exposure-policy-diagnostic
```

The cleanup result records the exact source SHA, Preview deployment ID, build result, and route-table absence. Unrelated existing internal routes are outside this cleanup.

## 10. Failure handling

Stage 11M fails if:

- any temporary file remains;
- any restored file misses its expected blob;
- an equivalent route or authentication surface remains elsewhere;
- `/api/analyze` changes;
- the restored checker performs metadata or application-plane requests before blocking;
- security-closeout is not 61/61;
- architecture guard, build, or Preview fails;
- the diff is not exactly twelve files;
- any Hosted diagnostic request or Production operation occurs.

On failure, the branch remains Draft and unmerged. Partial cleanup and fallback compatibility paths are prohibited.

## 11. Dependency audit separation

Stage 11K reported four high-severity npm audit findings. Stage 11L does not classify or remediate them because cleanup must preserve package and lockfile identity.

No `npm audit fix`, dependency upgrade, or lockfile change is allowed in Stage 11M. Dependency security is a separate workstream.

## 12. Exit criteria

```text
temporary files absent: 5/5
exact base blobs restored: 3/3
absence verifier: PASS
security-closeout preparation: PASS
security-closeout verifiers: PASS, 61/61
architecture guard: PASS
ghost-code audit: PASS
production build: PASS
deleted route absent from route table: PASS
Vercel Preview: READY
/api/analyze unchanged: PASS
Hosted diagnostic requests: 0
Production changes: 0
```

Required machine status:

```text
temporary_synthetic_diagnostic_route_cleanup_verified_route_surface_absent
```

## 13. Independent design review

### Critical — deleting modified Stage 11I files would destroy the pre-route safety boundary

Resolution: restore the adapter, Hosted execution v2, and execution checker to exact pre-route blobs instead of deleting them.

Status: resolved.

### Important — deleting only the route would leave reusable hidden execution capability

Resolution: delete route authentication, contract, execution, and route-checker modules; scan for imports, markers, and renamed equivalents.

Status: resolved.

### Important — a one-shot cleanup check would not prevent reintroduction

Resolution: retain a durable absence verifier in the security-closeout suite.

Status: resolved.

### Important — rewriting implementation evidence would erase the audit trail

Resolution: retain Stage 11K evidence and add separate cleanup evidence.

Status: resolved.

### Minor — dependency findings could contaminate cleanup scope

Resolution: prohibit dependency and lockfile changes.

Status: resolved.

Final review:

```text
Critical unresolved: 0
Important unresolved: 0
Minor unresolved: 0
status: READY_FOR_CLEANUP_IMPLEMENTATION_REVIEW
```

## 14. Authorization boundary

This design authorizes only a later reviewed cleanup implementation on the proposed stacked branch.

It does not authorize Hosted execution, `/api/analyze` modification, runtime activation, public traffic, Production deployment/promotion, dependency remediation, or merge to `main`.
