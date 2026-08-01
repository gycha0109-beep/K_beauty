# CandidateExposurePolicy Shadow Evaluation Result

## Final status

- Branch: `codex/candidate-exposure-policy-shadow-evaluation`
- Draft PR: #100
- Base: `codex/candidate-exposure-policy-shadow-runtime`
- Runtime implementation SHA: `1bc119347a2f8d3387a935163e24849ceebe349d`
- Status: `eligible_for_limited_preview_canary_plan`
- Runtime activation authorized: no
- Production activation authorized: no

## Design and implementation review

Stage 11C preserved the post-canonical shadow-only responsibility boundary and completed the following hardening:

- empty `VERCEL_ENV` with `NODE_ENV=production` is Production-hard-disabled;
- missing and unknown environment classifications fail closed;
- aggregate telemetry validates nested vocabularies, exact lane keys, count totals, and execution-state consistency;
- divergence classifiers require reason-compatible exposure transitions;
- canonical evaluator rebuild provenance is explicit and narrowly classified;
- generic `primary > hidden` remains unexpected unless exact adapter provenance and complete canonical conditions are present;
- the Stage 11A design verifier audits its fixed Stage 10 to Stage 11A range.

## Verification

### Local and GitHub Actions

Final remediation regression run: `30715974099`

- Stage 11B shadow verifier: 193 assertions PASS
- Current-product fixtures: 12/12 PASS
- Safety fixtures: 13/13 PASS
- Stage 11C verifier: PASS
- Aggregate divergence diagnostics: PASS
- Security closeout: 60/60 PASS
- Architecture guard: PASS
- Production build: PASS
- Diff hygiene: PASS

### Hosted history retained

Run `30710504707` failed closed before deployment because `VERCEL_TOKEN` was absent. No deployment, analyze call, bypass, environment write, or Production change occurred.

Run `30715168863` later completed four Hosted calls but exposed ten reproducible unexpected divergences in both KO and EN. Aggregate-only diagnostics identified the exact bucket as `primary>hidden|canonical_goal_match = 10`. This finding was remediated through explicit canonical adapter provenance rather than a broad transition allowlist.

### Remediated exact-SHA Hosted revalidation

GitHub Actions run: `30716127743`

Deployments:

- default-off Preview: `dpl_2eueMeSRe72BNBu5tsVA7NscnDSp`
- shadow-on Preview: `dpl_FUEVEGNzPpRNys6uZShi1k6cHYtJ`

Aggregate result:

- planned analyze calls: 4
- completed analyze calls: 4
- HTTP 200: 4/4
- runtime SHA match: 4/4
- `S9_cookie_emission`: 4/4
- KO candidate-order fingerprint match: true
- EN candidate-order fingerprint match: true
- KO candidate-reference count match: true
- EN candidate-reference count match: true
- temporary automation bypass created: true
- temporary automation bypass revoked: true
- workflow error category: none

Default-off behavior:

- KO shadow execution count: 0
- EN shadow execution count: 0

Shadow-on KO and EN telemetry:

- execution status: `executed`
- response pre/post fingerprint match: true
- snapshot pre/post fingerprint match: true
- candidate-order pre/post fingerprint match: true
- `expected_canonical_evaluator_rebuild`: 10 per locale
- `expected_canonical_goal_alignment`: 68 per locale
- `expected_exposure_state_expansion`: 86 per locale
- unexpected divergence: 0
- unclassified divergence: 0
- shadow exception: 0
- fallback: 0
- invalid context: 0

The independent default-off and shadow-on HTTP response body hashes are not required to match because each request independently performs provider-backed text generation. Mutation invariance is established by the same shadow-on request's pre/post fingerprints and unchanged candidate ordering.

## Eligibility gate

Machine-readable aggregate evidence:

`docs/verification/candidate-exposure-policy-shadow-eligibility-evidence.json`

Canonical gate result:

```text
eligible_for_limited_preview_canary_plan
```

Authorization remains bounded:

```text
limited Preview canary plan design: authorized
runtime activation: not authorized
Production activation: not authorized
```

## Verification markers

```text
CANDIDATE_EXPOSURE_POLICY_SHADOW_EVALUATION_PASS
HOSTED_KO_EN_REVALIDATION_PASS
EXACT_SHA_RUNTIME_MATCH
DEFAULT_OFF_SHADOW_NOT_EXECUTED
SHADOW_ON_EXECUTED
RESPONSE_FINGERPRINT_UNCHANGED
SNAPSHOT_FINGERPRINT_UNCHANGED
CANDIDATE_ORDER_UNCHANGED
EXPECTED_CANONICAL_EVALUATOR_REBUILD_CLASSIFIED
UNEXPECTED_DIVERGENCE_ZERO
UNCLASSIFIED_DIVERGENCE_ZERO
SHADOW_EXCEPTION_ZERO
FALLBACK_ZERO
INVALID_CONTEXT_ZERO
TEMPORARY_AUTOMATION_BYPASS_REVOKED
CANARY_PLAN_ELIGIBLE
RUNTIME_ACTIVATION_NOT_AUTHORIZED
PRODUCTION_ACTIVATION_NOT_AUTHORIZED
RUNTIME_FILTER_NOT_CONNECTED
RESPONSE_MUTATION_NOT_CONNECTED
STORAGE_MUTATION_NOT_CONNECTED
PRODUCTION_NOT_CHANGED
PR_REMAINS_DRAFT
```

## Next eligible stage

Stage 11D may design and verify a limited Preview canary plan. It must not activate CandidateExposurePolicy filtering or change recommendation output, API responses, persistence, UI, project-wide Preview configuration, or Production behavior.
