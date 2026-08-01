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
4. Production remains hard-disabled.

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

### 3.4 Stacked-stage verifier scope

The Stage 11A design-only verifier previously compared Stage 10 directly with the current descendant `HEAD`. That caused every legitimate Stage 11B/11C implementation file to look like a Stage 11A design-scope violation.

Remediation:

- the verifier now audits the fixed Stage 10 to Stage 11A ref range;
- Stage 11C files were not added to the Stage 11A design allowlist;
- the original Stage 11A design-only boundary remains enforced independently from later stacked stages.

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

## 5. Verification result

### 5.1 Focused verification

- Stage 11B shadow verifier: 193 assertions PASS.
- Current-product fixtures: 12/12 PASS.
- Safety fixtures: 13/13 PASS.
- Stage 11C evaluation verifier: 54 assertions PASS.
- Telemetry negative controls: 12/12 rejected as required.
- Divergence transition fixtures: 10/10 PASS.

### 5.2 Full regression verification

GitHub Actions run `30710205166` completed successfully after two verifier-environment corrections and one documentation whitespace correction:

- security closeout verifier suite: 60/60 PASS;
- architecture guard: PASS;
- Production build: PASS;
- diff hygiene: PASS.

The two earlier security-closeout failures were verifier execution-environment defects, not CandidateExposurePolicy product defects:

1. shallow checkout did not contain the Stage 10 baseline ref;
2. the Stage 11A verifier audited descendant-stage changes instead of its own fixed stage range.

Both were corrected without weakening the Stage 11A design-only allowlist.

### 5.3 Hosted exact-SHA attempt

The exact-SHA automatic default-off Preview for implementation SHA `3d697efd3b7b90137c68e988d42487c7a58a92a2` reached READY as deployment `dpl_FBndGs9izVGgC32FUoRLJngcm5Dh`.

GitHub Actions run `30710504707` then attempted to create a second exact-SHA deployment with deployment-scoped shadow opt-in. It failed closed at the first authority gate because the repository secret `VERCEL_TOKEN` was absent.

Observed boundary:

```text
STAGE11C_HOSTED_REVALIDATION_BLOCKED: VERCEL_TOKEN secret unavailable
```

Consequences:

- Vercel CLI installation did not run;
- no shadow-on deployment was created;
- no `/api/analyze` request was sent;
- no protection bypass was created;
- no project or branch environment variable was created, updated, or deleted;
- no Production deployment, alias, domain, or configuration was changed;
- no Hosted PASS is inferred.

The temporary Hosted workflow is removed after recording this evidence. A future rerun may use the same exact-SHA contract only after a repository-scoped `VERCEL_TOKEN` secret with Preview deployment authority is deliberately configured.

## 6. Final decision

The implementation, design review, focused verification, complete security suite, architecture guard, Production build, and diff hygiene passed. Hosted exact-SHA shadow-on evidence remains externally blocked by missing deployment authority.

Current status:

```text
CANDIDATE_EXPOSURE_POLICY_SHADOW_EVALUATION_BLOCKED_EXTERNAL
BLOCKED_PENDING_EXACT_SHA_HOSTED_REVALIDATION
LOCAL_AND_CI_VERIFICATION_PASS
SECURITY_CLOSEOUT_60_OF_60_PASS
RUNTIME_FILTER_NOT_CONNECTED
RESPONSE_MUTATION_NOT_CONNECTED
STORAGE_MUTATION_NOT_CONNECTED
PRODUCTION_NOT_CHANGED
PR_REMAINS_DRAFT
```

The next eligible action is not Stage 11D. It is a bounded rerun of Stage 11C exact-SHA Hosted verification after the Vercel deployment authority prerequisite is supplied. Runtime and Production activation remain unauthorized.
