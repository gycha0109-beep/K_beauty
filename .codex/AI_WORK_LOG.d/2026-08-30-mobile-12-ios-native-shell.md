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
- add a fail-closed Xcode 26.2 compatibility shim for the exact `expo-modules-jsi@57.0.5` RuntimeScheduler source used by the current lockfile

## Xcode 26.2 / expo-modules-jsi compatibility boundary

The first hosted iOS candidate reached Expo prebuild and CocoaPods successfully, then failed while building the `ExpoModulesJSI` xcframework under Xcode 26.2 / Swift 6.2.3. The failure is the upstream `expo-modules-jsi@57.0.5` regression tracked by Expo issue #49214: both `RuntimeScheduler` constructors are annotated with `SWIFT_RETURNS_RETAINED`, which Swift 6.2 rejects on constructors.

MOBILE-12 does not carry an unbounded dependency patch and does not mutate `package-lock.json` by hand. The temporary compatibility step is intentionally fail-closed:

1. installed package version must equal `57.0.5`;
2. `RuntimeScheduler.h` must match upstream attested SHA-1 `708aeaf33190ec55694e2677da0e7c565f61adfe`;
3. exactly the two invalid constructor annotations are removed;
4. the resulting file must match attested SHA-1 `4f90cc098a33df83d0734fd1c80d549b72a90619`;
5. any version/source/result drift aborts the gate instead of attempting a broader patch.

Once the lockfile is safely regenerated onto an upstream fixed package, this compatibility step must be removed rather than widened.

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
