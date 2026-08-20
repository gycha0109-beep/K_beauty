# V2.1-9J Production SHADOW Organic Evidence Attribution

## Status

- Stage: `V2.1-9J`
- Frozen attribution decision: `CURRENT_PRODUCTION_PROVENANCE_ATTRIBUTION_INSUFFICIENT`
- Remediation type: observability/provenance only
- Recommendation semantic delta: `0`
- ENFORCE authorized: `NO`
- ENFORCE active: `NO`

## Frozen reason for remediation

V2.1-9F and V2.1-9G controlled verification used the ordinary production `POST /api/analyze` path. Controlled and ordinary public Recommendation executions therefore converged into the same SkinMatch orchestration, normative SHADOW observer, runtime, and `normative_policy_runtime_aggregate` telemetry. The pre-9J runtime had no execution-time server-authoritative source distinction and no structural isolation between those evidence classes.

## Provenance contract

The only accepted production evidence sources are:

- `ORGANIC_PRODUCTION`
- `CONTROLLED_PRODUCTION_PROBE`
- `UNKNOWN_PRODUCTION_SOURCE`

Missing or malformed provenance resolves to `UNKNOWN_PRODUCTION_SOURCE`. Environment metadata such as `NODE_ENV=production` or `VERCEL_ENV=production` is not evidence provenance.

The ordinary `/api/analyze` path assigns `ORGANIC_PRODUCTION` at its trusted request-guard fingerprint boundary. The exact `formInput` object is marked with a non-enumerable server-owned Symbol capability before Recommendation orchestration. Public body, query, and header values cannot manufacture that Symbol and therefore cannot select the controlled evidence class.

The controlled path is `POST /api/internal/exfoliation-normative-policy-controlled-production-probe`. It accepts no caller-supplied Recommendation/provenance payload. After GitHub Actions OIDC verification it creates the fixed privacy-safe synthetic CTX-001-style input, assigns `CONTROLLED_PRODUCTION_PROBE`, and invokes the same `buildSkinMatchDecisionBundle` production Recommendation orchestration.

## GitHub Actions OIDC authority

Controlled production verification is authorized only by a cryptographically verified GitHub Actions OIDC token.

The verifier requires:

- issuer: `https://token.actions.githubusercontent.com`
- audience: `urn:bejewely:v21-9j:controlled-production-probe`
- repository: `gycha0109-beep/K_beauty`
- repository ID: `1205065704`
- ref: `refs/heads/main`
- ref type: `branch`
- event: `workflow_dispatch`
- workflow ref: `gycha0109-beep/K_beauty/.github/workflows/v21-9j-controlled-production-probe.yml@refs/heads/main`
- workflow SHA and triggering SHA: exact current Vercel production deployment SHA
- run ID: present and numeric
- run attempt: `1`
- runner environment: `github-hosted`
- valid `iat`/`nbf`/`exp`
- RS256 signature against GitHub's published OIDC JWKS

The implementation intentionally does not bind authorization to one textual `sub` format because GitHub supports immutable repository-ID-based subjects. Stable repository/workflow/ref/event claims plus signature and exact deployment SHA are the trust boundary.

The controlled workflow has only the `workflow_dispatch` trigger and requests `id-token: write`. PR CI, merged-main push CI, scheduled CI, and unrelated future main pushes cannot automatically invoke the controlled production probe.

## Telemetry

The existing telemetry schema version remains:

`exfoliation-normative-production-policy-runtime-telemetry-v1`

The change is additive. Each observer aggregate carries an independently assigned `productionSource` and direct source partitions including:

- `organicRecommendationExecutionCount`
- `controlledProductionProbeExecutionCount`
- `unknownProductionSourceExecutionCount`
- organic/controlled/unknown action counts
- source-partitioned fallback counts
- source-partitioned runtime error counts
- source-partitioned hypothetical exclusion counts
- source-partitioned actual normative exclusion counts
- source-partitioned stop reasons

Organic evidence is never inferred as overall telemetry minus guessed controlled telemetry.

## Privacy boundary

Normative telemetry remains aggregate-only. The validator rejects normalized variants of user/session identifiers, raw IP, email/name, authentication/session/access tokens, secrets/credentials, raw images/photos, questionnaire/survey payloads, request/response bodies, and identifying free-form text. In particular `sessionToken`, `session_token`, `SESSION-TOKEN`, `authToken`, `auth_token`, and `AUTH-TOKEN` are explicitly covered.

No raw user input is added to normative telemetry.

## Semantic invariants

V2.1-9J does not change:

- Product Fact or Registry semantics
- Product Decision Axis semantics
- normative mapper/action semantics
- `RESTRICT > DEFER > CAUTION > NONE` precedence
- Recommendation scoring
- Recommendation ranking
- canonical eligibility
- CandidatePolicy behavior
- activation authorization
- ENFORCE authorization

The SHADOW observer remains post-score/post-sort and pre-result-assembly, applies no canonical mutation, and performs zero actual normative exclusion.

## Verification

Dedicated 9J CI requires:

- focused T1-T14 provenance validation
- OIDC signature and bounded-claim validation
- privacy forbidden-key validation
- historical V2.1-9I full verifier
- V2.1-9I-SR source-scale verifier
- V2.1-9E production SHADOW wiring verifier
- V2.1-9D activation-safety verifier
- CandidatePolicy shadow regressions
- canonical OFF 164 x 12 invariance
- canonical SHADOW 164 x 12 invariance
- production build

Successful 9J collection readiness does not authorize ENFORCE and does not establish sufficient organic evidence for ENFORCE.
