# Skin Track S0 → S2 / Photo-State Consistency Fix — 2026-10-14

> Status: Draft PR, **NOT** Production activation. Base `main@1a82cf9961f4fbba30d1d59f1ec2de1a3c6dd7e2`. Owning track: `face-lab-skin`. Investigating the S0 audit `SKIN-S0-03` and `SKIN-S0-04`. No Style Track changes.

## Problem and minimal repair

1. When the provider fails, `app/api/analyze/route.js` supplies explicit `photoEvidenceState.status=unavailable` and a non-null survey-only `photoObservations` fallback. Before this repair, `buildPhotoState` used truthy observations to override explicit `unavailable` with `available`, and `evidenceAvailable` was also true. **Fix:** explicitly declared recognized photo status takes precedence over the observation-object presence; `evidenceAvailable` requires `available` and an object.
2. `projectSkinObservation` reports photo/survey `mixed` when the selected concern score is 2, but `SharedSkinDecisionContext v4` recognizes `partial`, not `mixed`. **Fix:** normalize that specific token to canonical `partial`, preserve aligned/conflict/unknown paths.

## Contracts and regression matrix

- Updated `lib/shared-skin-decision-context-v4.js`, no API property rename, no DB migration, no photo bytes nor Provider call, no recommendation scoring or weights.
- Updated `scripts/verify-shared-skin-decision-context-v4.mjs`: Provider failure plus object-shaped fallback (status/eligibility/uncertainty), no-photo plus stale fallback, available photo with partial/mixed, legacy observation without explicit status, and v4 hash/revision re-entry idempotency.
- Existing `verify:premium-integrated-evaluation-v2`, `verify:skin-decision-persistence-reentry`, 164×12 current Recommendation semantic gate and root health remain required.

## Limits and release gate

This fixes v4 interpretation for **available explicit evidence states** without retroactively rewriting historical persisted snapshots. An old snapshot containing only erroneously promoted `photo.status=available` and no original failure marker cannot be repaired from guessed evidence. This is a separate migration/re-entry authority decision, not authorized here.

The underlying S0 P0 **axis-level missing=zero / low-confidence score** remains unresolved and is **not** modified. Real-photo reliability, cue calibration, professional review and user consent are S1/S5 HOLD. Security #1208 stays BLOCKED. Approval is required before merge/deployment if canonical output and saved replay impact is material.

## Validation ledger

Exact-head CI PASS/FAIL must be recorded from GitHub after PR creation; no synthetic PASS may be stated as Human/real-photo accuracy.

Watchtower-Track: face-lab-skin
