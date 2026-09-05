# MOBILE-20C — Google Play Feature Graphic Verification

## Scope

MOBILE-20C owns the repository-qualified Google Play feature graphic at:

`apps/mobile/assets/store/bejewely-google-play-feature-graphic-1024x500.png`

This slice does **not** own App Store screenshot submission packaging, public support-contact configuration, App Store Connect metadata submission, or Google Play Console metadata submission.

## Deterministic contract

The repository asset must be reproducible from `scripts/mobile-20c-feature-graphic.mjs` and must satisfy all of the following:

- PNG
- exactly 1024 × 500 pixels
- 24-bit RGB / three color channels
- no alpha channel
- raw rendered pixels exactly match the deterministic renderer
- `docs/store/mobile-store-listing-final.json` records MOBILE-20C repository asset approval
- `apps/mobile/store-readiness.json` records the MOBILE-20C contract and no longer lists `google_play_feature_graphic` as a repository blocker
- `app_store_screenshot_submission_packaging` remains explicitly pending

## Integration remediation

MOBILE-20C also keeps existing store-release verifiers aligned with the current canonical repository structure without reverting production code to historical layouts:

- MOBILE-18 validates the approved Google Play feature graphic and no longer expects `google_play_feature_graphic` in `repositoryPending`.
- MOBILE-13 recognizes `EXPO_PUBLIC_STORE_CAPTURE_MODE` as a debug/store-capture public environment key while preserving the `serverSecretsAllowed = false` boundary.
- My Skin Diary verification follows the `my.tsx` → `NativeMyDiaryView.tsx` presentation split introduced by MOBILE-20B while keeping `dashboard.todayRoutine` on the owning My screen.
- Production icon assets remain unchanged; `store_listing_assets` stays pending because App Store screenshot submission packaging is still repository-pending and store-console/support-contact work remains external.

## Visual acceptance

Direct human review of the exact-head workflow artifact must confirm:

- the BEJEWELY wordmark is readable
- the composition is not cropped or visually broken
- the skin-profile motif is legible
- the personalized product-pick motif is legible
- AM/PM routine and diary-continuity motifs are legible
- there is no medical, diagnostic, clinical-accuracy, guaranteed-improvement, or guaranteed-efficacy claim
- there is no transparency artifact or debug/development content

## Authority rule

A CI success marker alone is insufficient for visual approval. Final candidate authority requires a workflow artifact whose manifest `exactSha` equals the current candidate head plus direct visual review of the PNG in that artifact. After squash merge, merged-main must produce a fresh artifact tied to the merged main SHA and the PNG must be directly reviewed again before MOBILE-20C can be closed.

The exact run IDs, artifact IDs, and candidate SHA are recorded in the pull request/release evidence rather than frozen in this document, so this file does not become stale whenever a verification-only commit changes the candidate head.
