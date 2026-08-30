# MOBILE-12 — iOS Native Shell Runtime Foundation

Status: implementation slice authority  
Base authority: `docs/architecture/mobile-foundation.md`  
Previous slice: MOBILE-11 Native Premium beta entry  
Base main at discovery: `2ec95f45b08f3ed1abe5f28129e583aa1c347278`

## Objective

MOBILE-12 closes the first iOS native-runtime evidence gap without moving any BEJEWELY server authority into the app and without entering App Store production surfaces.

```text
apps/mobile/app.json
→ Expo iOS Continuous Native Generation
→ generated Xcode project + CocoaPods workspace
→ unsigned Release build for iOS Simulator
→ simulator install + direct launch
→ Home / Analyze / My route acquisition
→ screenshots + build/runtime/crash evidence
```

This slice is runtime foundation only. It does not claim physical-device behavior, App Store readiness, hosted OAuth completion, Universal Links, production signing, TestFlight, or store submission.

## Authority

Mobile owns:
- iOS client bundle metadata needed to generate a simulator application
- generated-project boundary through Expo CNG
- simulator build/install/launch mechanics
- route acquisition and native presentation
- local runtime evidence collection

Server remains authoritative for:
- authentication validation and user-bound data access
- Analyze, Recommendation, Product Fact and Product Decision Axis behavior
- Face Lab server analysis
- Premium eligibility, session validation, generation and persistence
- Payment and entitlement policy
- DB/RLS/Storage and provider behavior

## In scope

- pre-store iOS bundle identifier `com.bejewely.mobile`
- `supportsTablet: false` for the initial phone-first simulator contract
- existing `bejewely` custom scheme
- clean `expo prebuild --platform ios --clean --no-install`
- generated Xcode project verification
- CocoaPods workspace generation
- unsigned `Release-iphonesimulator` build with code signing disabled
- available iPhone Simulator selection from the hosted macOS runner
- simulator boot, app install and direct bundle launch
- deterministic custom-scheme opens for `/analyze` and `/my`
- Home / Analyze / My screenshots
- Xcode build log, simulator metadata, launch evidence, runtime log and crash-report scan
- exact-SHA dedicated CI gate
- existing Android/mobile regressions remain independently authoritative

## Out of scope

- Apple Developer certificates or provisioning profiles
- App Store Connect, TestFlight, listing or submission
- production signing or distribution IPA
- changing the public store application identity after release
- iOS Universal Links / `associatedDomains`
- `apple-app-site-association`
- Android App Links / `assetlinks.json`
- production domain/deployment mutation
- hosted Supabase OAuth redirect allow-list changes
- production auth-provider changes
- push notifications and APNs credentials
- StoreKit or native billing
- Payment/entitlement mutation
- DB/RLS/Storage/Provider changes
- moving ML Kit face guidance to iOS
- authenticated production-data creation during CI

## iOS platform boundary

The current `bejewely-face-guide` Expo local module remains Android-only:

```json
{
  "platforms": ["android"]
}
```

MOBILE-12 does not invent an iOS face detector. The existing mobile guidance flow must remain fail-open when that Android-only native capability is absent.

## Bundle identity boundary

`com.bejewely.mobile` is frozen here only as the repository's **pre-store simulator identity** so generated iOS artifacts have a deterministic bundle identifier. MOBILE-12 does not represent Apple Developer registration or a public App Store identity commitment.

A future store-release slice must explicitly review bundle identity before signing/listing authority is exercised.

## Generated-native invariants

1. `ios/` remains generated and gitignored.
2. `PRODUCT_BUNDLE_IDENTIFIER` must equal `com.bejewely.mobile` in the generated project.
3. generated `Info.plist` must retain the `bejewely` URL scheme.
4. generated `Info.plist` must contain the camera usage disclosure supplied through the existing Expo Camera plugin.
5. no Universal Link entitlement or `applinks:` value may be introduced by MOBILE-12.
6. the Android-only ML Kit module must not become an iOS native dependency.
7. no server secret may appear in native app configuration.
8. the simulator build must explicitly disable code signing.

## Runtime verification contract

The dedicated macOS gate must:

1. check out and attest the exact candidate SHA;
2. install the monorepo dependency graph;
3. run existing mobile architecture/type/config gates;
4. generate a clean iOS project;
5. verify the generated iOS contract;
6. install CocoaPods dependencies;
7. select and boot an available iPhone Simulator;
8. build the exact source as an unsigned Release simulator `.app`;
9. install and directly launch `com.bejewely.mobile`;
10. retain a Home screenshot;
11. open `bejewely://analyze` and retain an Analyze screenshot;
12. open `bejewely://my` and retain a My screenshot;
13. retain simulator/toolchain/build/runtime evidence;
14. fail if a new BEJEWELY crash report or bounded fatal runtime signature is observed.

Screenshots are artifact evidence. Automated URL opening proves acquisition of the registered custom scheme, but rendered route contents are only claimed after the screenshots are actually inspected during candidate/exact-main closeout.

## Runtime honesty

A passing MOBILE-12 gate proves an unsigned BEJEWELY app was generated, built, installed and launched on a hosted iOS Simulator and that the registered custom scheme accepted the bounded route-open requests.

It does **not** prove:
- physical iPhone camera behavior;
- hosted Google OAuth completion;
- authenticated Premium production finalization;
- Universal Links;
- App Store signing or review acceptance;
- push notification delivery;
- store billing.

## Acceptance

MOBILE-12 may be CLOSED only after:

- exact candidate SHA is fixed;
- dedicated iOS gate and existing triggered regression gates pass;
- candidate iOS artifact is downloaded and independently inspected;
- Home / Analyze / My screenshots are visually checked;
- candidate crash evidence is clean;
- PR review/merge completes without main drift;
- the exact merged-main SHA reruns the dedicated iOS gate;
- exact-main iOS artifact/screenshots/crash evidence are independently checked;
- final remote `main` readback still equals the merged-main SHA.
