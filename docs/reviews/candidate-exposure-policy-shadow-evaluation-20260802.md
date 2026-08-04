# CandidateExposurePolicy Shadow Evaluation and Canary Eligibility Review

## 1. Scope

Stage 11C reviews the completed Stage 11B shadow implementation, hardens the remaining control and observability boundaries, and applies a fail-closed eligibility gate for a future limited Preview canary plan.

Base branch: `codex/candidate-exposure-policy-shadow-runtime`

Stage branch: `codex/candidate-exposure-policy-shadow-evaluation`

This stage does not connect CandidateExposurePolicy output to runtime candidate filtering, recommendation assembly, API responses, saved payloads, UI, or Production configuration. Eligibility authorizes planning only.

## 2. Responsibility boundary review

The Stage 11B boundary remains valid:

1. `rebuildPremiumDecisionState` creates the canonical decision state.
2. CandidateExposurePolicy reads canonical context, effective FunctionalPolicy, CrossDomainConsistency, current-product findings, and the normalized candidate pool.
3. The policy executes after canonical rebuilding and only in disabled-by-default Preview shadow mode.
4. Shadow output is observed but is not returned to recommendation assembly or persistence.
5. Production remains hard-disabled.

## 3. Implementation review findings and remediation

### 3.1 Self-hosted Production classification

The prior control accepted an empty `VERCEL_ENV` as non-Production. A self-hosted process with `NODE_ENV=production` and the opt-in flag could therefore enable shadow execution.

Remediation:

- `VERCEL_ENV=preview` remains eligible for explicit shadow opt-in;
- explicit `VERCEL_ENV=development` remains eligible;
- empty `VERCEL_ENV` is eligible only when `NODE_ENV=development`;
- empty `VERCEL_ENV` with `NODE_ENV=production` is Production-hard-disabled;
- missing or unknown environment classifications fail closed;
- kill-switch precedence remains unchanged.

### 3.2 Aggregate telemetry validation

The prior validator did not fully enforce nested count-map vocabularies, exact lane keys, aggregate totals, or execution-status consistency.

Remediation:

- exposure, lane, reason, and divergence keys are allowlisted;
- the lane map requires the exact five-lane set;
- exposure and divergence totals must equal `candidateCount`;
- lane counts cannot exceed `candidateCount`;
- policy version, context version, mode, and current-findings state are validated;
- executed and failed states reject contradictory error, fallback, and exception counts.

### 3.3 Divergence classification precision

Broad transition rules could classify a changed exposure as expected without proving that the reason and target exposure were compatible.

Remediation:

- invalid-context hardening is expected only for `insufficient_evidence`;
- same-product handling is expected only for `hidden`;
- unknown or non-evaluable current-product context requires `insufficient_evidence`;
- strict safety reasons require their contracted target exposure;
- canonical goal alignment uses an explicit transition allowlist;
- unexplained or reason-incompatible transitions remain `unexpected_divergence`.

### 3.4 Canonical evaluator rebuild provenance

The first authoritative Stage 11C Hosted run produced ten reproducible `primary > hidden | canonical_goal_match` divergences in both KO and EN. Aggregate diagnostics showed that the policy did not independently turn primary candidates into hidden candidates. CandidateExposurePolicy rebuilt its internal evaluator from the current canonical context and obtained `hidden`, while the route-provided legacy execution used for comparison still exposed the same rows as `primary`.

The remediation does not globally allow `primary > hidden`.

Each decision now preserves `provenance.adapterExposure`. A divergence is classified as `expected_canonical_evaluator_rebuild` only when all of the following are true:

- route legacy exposure is `primary`;
- CandidateExposurePolicy output is `hidden`;
- canonical adapter provenance is exactly `hidden`;
- current-product relation is `none`;
- evidence state is `complete`;
- the exact reason list is only `canonical_goal_match`.

A missing or conflicting adapter provenance, an additional reason, incomplete evidence, current-product semantics, or safety semantics does not enter this category and remains subject to the stricter existing classifiers.

### 3.5 Stacked-stage verifier scope

The Stage 11A design-only verifier previously compared Stage 10 directly with the current descendant `HEAD`, causing legitimate Stage 11B and Stage 11C implementation files to appear as Stage 11A scope violations.

The verifier now audits the fixed Stage 10 to Stage 11A ref range. Stage 11C files were not added to the Stage 11A allowlist, so the original design-only boundary remains independently enforced.

## 4. Eligibility gate

`reviewCandidateExposurePolicyShadowEligibility()` requires:

- Production and self-hosted Production hard-disable evidence;
- kill-switch precedence and malformed-environment fail-closed evidence;
- strict telemetry and divergence contracts;
- runtime filter, response mutation, storage mutation, and Production configuration disconnected;
- focused verifier, security closeout, architecture guard, and Production build passing;
- actual catalog floor of 164 loaded and scorer-compatible rows, four scenarios, 656 candidate rows, and high-risk collapsed count zero;
- exact-SHA KO/EN default-off and shadow-on Hosted evidence;
- two shadow-on internal response, snapshot, and candidate-order fingerprint matches;
- unexpected divergence, unclassified divergence, exception, fallback, and invalid context all zero.

The gate returns only:

- `eligible_for_limited_preview_canary_plan`;
- `blocked_pending_exact_sha_hosted_revalidation`;
- `blocked_remediation_required`.

Every status keeps runtime and Production activation unauthorized.

## 5. Verification history

### 5.1 Local and GitHub Actions verification

The final remediation regression run `30715974099` passed:

- Stage 11B shadow verifier: 193 assertions;
- current-product fixtures: 12/12;
- safety fixtures: 13/13;
- Stage 11C evaluation verifier;
- aggregate divergence diagnostic positive and negative controls;
- security closeout verifier suite: 60/60;
- architecture guard;
- Production build;
- diff hygiene.

### 5.2 Original external blocker

The first Hosted closeout attempt, run `30710504707`, failed closed before deployment because the repository did not yet contain `VERCEL_TOKEN`.

No shadow-on deployment, analyze request, protection bypass, environment write, or Production change occurred. This historical blocker is retained and is not rewritten as a pass.

### 5.3 Initial Hosted divergence finding

After deployment authority was supplied, run `30715168863` completed four exact-SHA requests with HTTP 200, runtime SHA matches, S9 completion, candidate-order invariance, and temporary automation-bypass cleanup.

KO and EN shadow telemetry both reported ten `unexpected_divergence` rows. A subsequent aggregate-only diagnostic run isolated all ten rows to the single transition bucket:

```text
primary>hidden|canonical_goal_match = 10
```

No candidate ID, product ID, product name, brand, raw response, or user identifier was logged by the diagnostic.

### 5.4 Remediated exact-SHA Hosted verification

Runtime implementation SHA:

```text
1bc119347a2f8d3387a935163e24849ceebe349d
```

Deployments:

- default-off Preview: `dpl_2eueMeSRe72BNBu5tsVA7NscnDSp`;
- shadow-on Preview: `dpl_FUEVEGNzPpRNys6uZShi1k6cHYtJ`.

GitHub Actions run `30716127743` passed:

- KO default-off: HTTP 200;
- KO shadow-on: HTTP 200;
- EN default-off: HTTP 200;
- EN shadow-on: HTTP 200;
- runtime commit match: 4/4;
- premium final stage `S9_cookie_emission`: 4/4;
- candidate-order fingerprint match: KO and EN;
- candidate-reference count match: KO and EN;
- temporary automation bypass generated once and revoked successfully;
- default-off KO and EN logs contain no CandidateExposurePolicy shadow execution.

The independent off/on HTTP response body hashes differ because each request performs separate provider-backed text generation. Policy mutation is measured by the same shadow-on request before and after policy execution. For both KO and EN:

- `responseFingerprintMatch=true`;
- `snapshotFingerprintMatch=true`;
- `candidateOrderMatch=true`;
- `expected_canonical_evaluator_rebuild=10`;
- `expected_canonical_goal_alignment=68`;
- `expected_exposure_state_expansion=86`;
- `unexpected_divergence=0`;
- `unclassified_divergence=0`;
- `shadowExceptionCount=0`;
- `fallbackCount=0`;
- `invalidContextCount=0`.

## 6. Final decision

The machine-readable evidence in `docs/verification/candidate-exposure-policy-shadow-eligibility-evidence.json` is evaluated through the canonical eligibility function. The resulting status is:

```text
eligible_for_limited_preview_canary_plan
```

This authorizes only Stage 11D design and verification of a limited Preview canary plan. It does not authorize runtime filtering, recommendation mutation, response mutation, persistence changes, UI changes, Production configuration, or Production activation.

```text
CANDIDATE_EXPOSURE_POLICY_SHADOW_EVALUATION_PASS
HOSTED_KO_EN_REVALIDATION_PASS
CANARY_PLAN_ELIGIBLE
RUNTIME_ACTIVATION_NOT_AUTHORIZED
PRODUCTION_ACTIVATION_NOT_AUTHORIZED
RUNTIME_FILTER_NOT_CONNECTED
RESPONSE_MUTATION_NOT_CONNECTED
STORAGE_MUTATION_NOT_CONNECTED
PRODUCTION_NOT_CHANGED
PR_REMAINS_DRAFT
```
