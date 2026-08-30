# MOBILE-12 — iOS Native Shell Runtime Foundation

- Base main: `2ec95f45b08f3ed1abe5f28129e583aa1c347278`
- Branch: `feature/mobile-12-ios-native-shell`
- Risk class: Medium
- Protected-surface mutation: none

## Intent

Close the repository's unobserved iOS native-runtime gap before hosted-link or store-release work. Keep iOS as a client and preserve server authority.

## Changes

- add deterministic pre-store iOS bundle configuration
- add clean Expo iOS CNG command
- add generated iOS contract verifier
- add hosted macOS/iPhone Simulator build-install-launch smoke
- retain Home / Analyze / My screenshots plus build/runtime/crash evidence
- add dedicated exact-SHA MOBILE-12 workflow
- freeze scope and runtime-honesty rules in architecture documentation

## Explicit exclusions

No Production, Payment, Secrets, DB/RLS/Storage, Auth-provider, hosted redirect allow-list, Provider dispatch, Apple signing, TestFlight, App Store, Universal Link, associated-domain, APNs or StoreKit mutation.

## Verification required before closeout

1. candidate static/type/config/prebuild gate
2. candidate unsigned iOS Simulator Release build
3. candidate install/direct-launch/custom-scheme route evidence
4. candidate artifact and screenshot inspection
5. candidate crash scan
6. PR/review/main-drift check
7. exact merged-main rerun
8. exact-main artifact/screenshots/crash scan
9. final remote-main readback

Physical-device iOS behavior and hosted/store surfaces remain NOT OBSERVED unless a later authorized slice exercises them.
