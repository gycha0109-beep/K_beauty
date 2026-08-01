# CandidateExposurePolicy Shadow Evaluation and Canary Eligibility Review

## 1. Scope

Stage 11C reviews the completed Stage 11B shadow implementation and defines a fail-closed eligibility gate for a future limited Preview canary plan. This stage does not connect CandidateExposurePolicy output to runtime candidate filtering, recommendations, API responses, saved payloads, UI, or Production configuration.

Base branch: `codex/candidate-exposure-policy-shadow-runtime`

Stage branch: `codex/candidate-exposure-policy-shadow-evaluation`

## 2. Design review

The Stage 11B responsibility boundary remains valid:

1. `rebuildPremiumDecisionState` creates the canonical decision state.
2. CandidateExposurePolicy reads canonical context, effective FunctionalPolicy, consistency, current-product findings, and the existing normalized candidate pool.
3. Shadow output is observed only and is not returned to recommendation assembly or persistence.
4. Production is intended to remain hard-disabled.

The Hosted Stage 11B closeout proved response, snapshot, and candidate-order invariance for the implementation SHA used by that run. It did not authorize runtime filtering or Production activation.

## 3. Implementation review findings

### 3.1 Self-hosted production environment classification

The prior control accepted an empty `VERCEL_ENV` as a valid non-Production environment. With the opt-in flag set, a non-Vercel process could enable shadow execution even when `NODE_ENV=production`.

Remediation:

- `VERCEL_ENV=preview` remains eligible even though Vercel runs Next.js with `NODE_ENV=production`.
- explicit `VERCEL_ENV=development` remains eligible.
- empty `VERCEL_ENV` is eligible only with `NODE_ENV=development`.
- empty `VERCEL_ENV` plus `NODE_ENV=production` is Production-hard-disabled.
- missing or unknown environment classification is disabled.
- kill switch precedence remains unchanged.

### 3.2 Aggregate telemetry validation

The prior validator checked top-level fields and numeric values but did not fully enforce nested count-map vocabularies, exact lane keys, or count totals.

Remediation:

- exposure, lane, reason, and divergence count-map keys are allowlisted.
- lane keys must be the exact five-lane set.
- exposure and divergence totals must equal `candidateCount`.
- lane counts cannot exceed `candidateCount`.
- mode, current-findings state, policy version, and bounded context version are validated.
- successful and failed execution state/count combinations are checked for contradictions.

### 3.3 Divergence classification precision

The prior broad classification could treat a changed exposure as expected without proving that the reason and target exposure were compatible.

Remediation:

- invalid-context hardening is expected only when the target is `insufficient_evidence`.
- same-product handling is expected only when the target is `hidden`.
- unknown or non-evaluable product context is expected only when the target is `insufficient_evidence`.
- strict safety reasons require their contracted `hidden` or `insufficient_evidence` target.
- canonical goal alignment uses an explicit transition allowlist.
- unexplained or reason-incompatible transitions are `unexpected_divergence`.

## 4. Eligibility gate

`reviewCandidateExposurePolicyShadowEligibility()` requires all of the following:

- Production and self-hosted Production hard-disable evidence.
- kill-switch precedence and malformed-environment disable evidence.
- strict telemetry and divergence contracts.
- runtime filter, response mutation, storage mutation, and Production configuration remain disconnected.
- focused verifier, security closeout, architecture guard, and Production build pass.
- actual catalog floor: 164 loaded and scorer-compatible rows, four scenarios, 656 candidate rows, high-risk collapsed zero.
- Hosted four-call KO/EN evidence with exact current implementation SHA.
- response, snapshot, and candidate-order matches for both shadow-on requests.
- unexpected divergence, unclassified divergence, exception, fallback, and invalid context all zero.

The gate can return only:

- `eligible_for_limited_preview_canary_plan`
- `blocked_pending_exact_sha_hosted_revalidation`
- `blocked_remediation_required`

Every status keeps runtime and Production activation unauthorized.

## 5. Current decision

The Stage 11B Hosted evidence belongs to the prior implementation SHA. Stage 11C changes environment classification and observability semantics, so the prior run cannot be reused as exact-SHA evidence for the changed implementation.

Current status:

```text
BLOCKED_PENDING_EXACT_SHA_HOSTED_REVALIDATION
RUNTIME_FILTER_NOT_CONNECTED
RESPONSE_MUTATION_NOT_CONNECTED
STORAGE_MUTATION_NOT_CONNECTED
PRODUCTION_NOT_CHANGED
```

After local and GitHub Actions validation passes, one exact-SHA Preview KO/EN off/on rerun is required. Only then may the gate return `eligible_for_limited_preview_canary_plan`. That status authorizes planning a limited Preview canary only; it does not authorize activation.
