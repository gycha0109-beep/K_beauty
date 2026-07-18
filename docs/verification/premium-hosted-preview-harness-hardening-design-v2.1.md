# Premium Hosted Preview Harness Hardening Design v2.1

## 1. Status

- Repository: `gycha0109-beep/K_beauty`
- Base PR: #38
- Design PR: #44
- Base implementation SHA: `5dd2c469d223c878a2139d8276b2c4a04c2f6bf3`
- Scope: verification harness only
- Runtime/API/UI/DB/Auth/RLS/Vercel/Production changes: prohibited

This revision replaces v2. The previous design required `uncertaintyState` and a Top Pick absence reason as direct canonical fields, but those fields do not exist in the current response or saved snapshot contract. v2.1 defines only observable direct fields and explicitly versioned deterministic derived fields.

## 2. Review findings resolved

1. `uncertaintyState` is not a direct runtime field.
   - Resolution: introduce verifier-only `evidenceStateV1`, derived from fixed source paths.
2. Top Pick absence has no dedicated reason field.
   - Resolution: compare nullable Top Pick identity and policy/consistency reason codes separately. Do not invent a null reason.
3. Existing immutable snapshot fingerprint includes locale.
   - Resolution: keep it for same-report immutability only; use a separate locale-neutral semantic fingerprint for KO/EN comparison.
4. UI does not expose the expected canonical `data-*` attributes.
   - Resolution: canonical meaning comes from the correlated `/api/full-report` response and saved snapshot; UI is checked only through accessible visibility markers.
5. Fixture-controlled `requiredEvidence` permits false passes.
   - Resolution: mandatory evidence is code-owned and cannot be changed by fixtures.

## 3. Canonical evidence inventory

### 3.1 Required direct fields

All paths are relative to the successful `/api/full-report` response body and the stored `saved_reports.premium_report` object.

| Canonical key | Network path | Saved snapshot path | Type |
|---|---|---|---|
| bundleVersion | `decisionBundle.version` | `decisionBundle.version` | non-empty string |
| functionalStatus | `decisionBundle.functionalPolicy.status` | same | non-empty string |
| functionalReasonCodes | `decisionBundle.functionalPolicy.reasonCodes` | same | unique string array |
| routineStatus | `decisionBundle.routinePolicy.status` | same | non-empty string |
| routineReasonCodes | `decisionBundle.routinePolicy.reasonCodes` | same | unique string array |
| routineConfidence | `decisionBundle.routinePolicy.confidence` | same | `low\|medium\|high` |
| conditionStatus | `decisionBundle.conditionPolicy.status` | same | non-empty string |
| conditionReasonCodes | `decisionBundle.conditionPolicy.reasonCodes` | same | unique string array |
| conditionConfidence | `decisionBundle.conditionPolicy.confidence` | same | `low\|medium\|high` |
| consistencyVerdict | `decisionBundle.consistency.verdict` | same | non-empty string |
| consistencyReasonCodes | `decisionBundle.consistency.reasonCodes` | same | unique string array |
| consistencyConfidence | `decisionBundle.consistency.confidence` | same | `low\|medium\|high` |
| effectivePolicySource | `decisionBundle.effectivePolicySource` | same | non-empty string |
| productActions | `decisionBundle.routinePolicy.productActions` | same | array |
| locale | `decisionBundle.locale` | same | `ko\|en` |
| immutableFingerprint | `meta.snapshot.fingerprint` | recomputed with `buildPremiumReportSnapshot()` | 64-char hex |

### 3.2 Nullable Top Pick

Top Pick is nullable. The contract accepts exactly one of these explicit object ID paths when `freeResult.topPick` is present:

- `freeResult.topPick.id`
- `freeResult.topPick.productId`
- `freeResult.topPick.product_id`

Rules:

- `freeResult.topPick == null` -> `topPickPresence = "absent"`, `topPickProductId = null`.
- Present object -> exactly one supported ID path must contain a non-empty scalar identifier.
- Multiple conflicting IDs or a present object without a supported ID -> canonical projection failure.
- No synthetic `topPickNullReason` is created.

### 3.3 Deterministic derived field: evidenceStateV1

`evidenceStateV1` is verifier-owned and derived only from the direct fields above.

- `insufficient_context` when consistency verdict is `insufficient_context` or any policy status is `insufficient_context`.
- `partial` when any policy status is `partial`, any confidence is not `high`, or any product action has `sourceState` in `not_in_db|unanswered` or action `check_needed`.
- `complete` otherwise.

The derivation is versioned, pure, and fail-closed. Missing or invalid source fields are projection failures, not defaults.

## 4. Locale-neutral semantic fingerprint

A verifier-only SHA-256 fingerprint is computed from stable JSON containing:

- bundleVersion
- functional/routine/condition statuses
- sorted unique reason-code arrays
- routine/condition/consistency confidence
- consistency verdict
- effectivePolicySource
- normalized product actions: `productId|null`, `sourceState`, `action`, sorted reason codes
- topPickPresence and nullable topPickProductId
- evidenceStateV1

Excluded:

- locale
- translated text
- generated timestamps
- savedReportId/session/source-session IDs
- immutable snapshot fingerprint
- image URLs and UI copy

KO/EN pass requires equal semantic fingerprints and equal catalog binding. Immutable fingerprints may differ by locale and are not compared across locales.

## 5. UI evidence model

Each UI lane must provide two evidence layers:

1. Browser interaction and visibility
   - fixture actions use an allowlisted accessible locator DSL only: role, label, heading, visible text.
   - absolute URLs, CSS/XPath selectors, script evaluation, arbitrary file paths, destructive actions, and fixture-owned pass rules are rejected.
2. Correlated canonical response
   - capture the POST `/api/full-report` response associated with the lane.
   - project the raw response immediately to the canonical allowlist DTO.
   - raw response bodies are never written to logs or artifacts.

A lane cannot pass from UI text alone or from fixture metadata alone.

## 6. Auth and deployment trust boundary

Before reading storage state or credentials:

- verify PR #38 exact head from GitHub metadata;
- verify GitHub/Vercel deployment metadata points to that head;
- require Preview target, READY state, approved project ID, and immutable deployment URL;
- reject Production or unexpected redirects;
- do not forward credentials across redirects.

Login evidence must bind:

- account key;
- approved user ID hash;
- permanent non-anonymous user;
- Google provider;
- deployment ID/SHA/host;
- storage-state hash and expiry.

Actual account registry data remains outside the repository.

## 7. Artifact and credential safety

- credentials live only in an OS temp directory outside the repository;
- enforce restrictive permissions, TTL, cleanup handlers, and per-account/deployment run locks;
- artifact writer accepts only schema-validated allowlist DTOs;
- HAR, trace, video, and full-page screenshots are disabled by default;
- reject tokens, cookies, authorization headers, emails, raw UUIDs, data URLs, raw photos, full reports, and raw source-session IDs.

## 8. Gate behavior

The final gate remains fail-closed. Missing, failed, blocked, unknown, unconfirmed, partial, or not-run required lanes cannot produce PASS.

The harness contract verifier must include negative tests for:

- missing canonical fields and wrong types;
- duplicate/empty reason codes;
- conflicting Top Pick IDs and valid Top Pick absence;
- direct vs derived evidence-state behavior;
- KO/EN translation-only equality and semantic mismatch;
- fixture `requiredEvidence`/selector/script injection;
- raw response or credential material entering artifacts;
- deployment attestation and redirect failures;
- required lane omission and non-passed states.

## 9. Implementation boundary

Implementation may change only verification scripts, package commands, documentation, and work logs. If an exact required direct path above is absent in the actual implementation, stop and revise this design. Do not modify runtime/API/UI/DB contracts to satisfy the harness.

## 10. Acceptance criteria

- design inventory matches current runtime source paths;
- no fabricated canonical field remains;
- nullable Top Pick is handled explicitly;
- `evidenceStateV1` is deterministic and versioned;
- KO/EN uses locale-neutral semantics;
- UI canonical state is derived from correlated network/snapshot evidence;
- fixture cannot weaken mandatory evidence;
- credential and artifact controls remain fail-closed;
- Critical 0, Important 0 after implementation review;
- independent exact-head validation passes;
- live Hosted Preview execution remains a separate gate.
