# V2.1-9D — Normative Policy Activation Authorization & Runtime Safety

## Terminal

`NORMATIVE_PRODUCTION_POLICY_STAGED_SHADOW_ACTIVATION_AUTHORIZED`

This stage authorizes only a future, separately executed staged production `SHADOW` rollout. It does not execute activation and does not authorize `ENFORCE`.

## Frozen authorization

- `PRODUCTION_ACTIVATION_AUTHORIZED = YES`
- `AUTHORIZED_MODE = SHADOW`
- `ENFORCE_AUTHORIZED = NO`
- `ACTIVATION_EXECUTED = NO`
- `NORMATIVE_POLICY_RUNTIME_ACTIVE = NO`
- `RESTRICT_CANONICAL_EXCLUSION_ACTIVE = NO`

The runtime remains default `OFF`. A later stage must explicitly configure and execute the authorized SHADOW rollout.

## Runtime safety ownership

V2.1-9D adds a normative-policy-owned control plane rather than reusing generic CandidateExposurePolicy activation flags as authority. Existing generic evaluator-boundary/canary code is used only as an architectural precedent for aggregate telemetry, scope guards, and kill-switch behavior.

The dedicated gate requires trusted server-side configuration, exact activation/policy/runtime version pins, the frozen enforcement boundary, and no kill switch. Kill switch always overrides enable/mode. Invalid mode, version mismatch, unsupported scope, or ENFORCE request resolves to effective `OFF`.

## Failure / fallback

Frozen fallback is implemented as:

`FAIL_CLOSED_TO_POLICY_DEFER_PRESERVE_EXISTING_LEGACY_PRODUCTION_PATH`

Evaluator exceptions, malformed output, unsupported action, missing provenance, version mismatch, missing runtime prerequisites, invalid enforcement input, or eligibility materialization failure cannot create `ALLOW` or accidental `RESTRICT`. The policy side becomes `DEFER`/failure while the canonical legacy path remains untouched.

## Observability

Runtime telemetry is aggregate-only and validates its schema before emission. It tracks activation mode, executions/errors, five-action counts, RESTRICT observations, hypothetical/actual exclusion counts by mode, fallback count, kill-switch state, gate rejection, version mismatch, candidate counts, Top-K change count, rollback events, versions, reasons, stop state, and caller-supplied bounded latency.

Raw product identity, user/survey/skin/image payloads, request/response bodies, tokens, API keys, and secrets are forbidden.

## Enforcement adapter prerequisite

A dormant pure composition helper validates the frozen relationship:

`existing_eligibility AND normative_policy_eligibility`

Only `RESTRICT` makes normative policy eligibility false. Survivor order is preserved; no score recomputation or reranking occurs. The helper is not canonically wired in 9D and therefore cannot alter production behavior.

## Live SHADOW requirement

`LIVE_SHADOW_REQUIRED_BEFORE_ENFORCE`

V2.1-9D observes zero live production normative-policy traffic. No numeric traffic count, duration, divergence threshold, or rollout percentage is invented. Before any later ENFORCE authorization decision, an explicitly authorized staged SHADOW execution must produce authoritative production-context runtime evidence against the frozen stop conditions.

## Production invariance

9D does not import the new runtime into `SkinMatchDecisionEngine`. Default production remains legacy-only, and the canonical 164 × 12 replay must remain byte/behavior invariant for score, ranking, Top1, Top3, eligibility, public response, persistence, and CandidatePolicy canonical results.

## Next stage boundary

Only V2.1-9E may execute the authorized staged production SHADOW rollout and collect live runtime evidence. 9E must not interpret this authorization as ENFORCE permission.
