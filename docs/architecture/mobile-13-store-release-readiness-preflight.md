# MOBILE-13 — Store Release Readiness Preflight

- Baseline `main`: `be08285f6fd1bac50f209a45634c250d7b5a533f`
- Baseline meaning: MOBILE-12 iOS native shell runtime foundation merged
- Scope: distribution **preflight**, not store submission
- Public identity candidate: `BEJEWELY` / `com.bejewely.mobile`

## 1. Why MOBILE-13

The live repository sequence is:

```text
MOBILE-8   saved report archive
MOBILE-9   native share publish
MOBILE-10  native custom input + share deep-link intake
MOBILE-11  native Premium beta entry
MOBILE-12  iOS native shell runtime foundation
MOBILE-13  store release readiness preflight
```

MOBILE-12 explicitly stopped before store signing/distribution. MOBILE-13 converts the native shell from a simulator/runtime foundation into a release-contract candidate without inventing external signing authority.

## 2. Frozen source contract

MOBILE-13 freezes these values for store registration work:

```text
App display name          BEJEWELY
Custom URL scheme         bejewely
iOS bundle identifier     com.bejewely.mobile
Android applicationId     com.bejewely.mobile
Marketing version         0.1.0
iOS build number          1
Android versionCode       1
iOS deployment target     16.4
Android target SDK        36 (generated Expo SDK 57 contract)
Android native page size  16 KB
```

Version policy:

- the marketing version is shared across both platforms;
- every submitted binary must monotonically increase the platform build number/version code;
- changing `com.bejewely.mobile` after store registration is treated as an identity migration, not a normal config edit.

## 3. Current 2026 platform floor

MOBILE-13 is intentionally aligned to the current external submission floor rather than the older simulator-only toolchain.

- Apple: uploads to App Store Connect require Xcode 26+ and the iOS 26 SDK+ since 2026-04-28.
- Google Play: from 2026-08-31, new apps and updates must target Android 16 / API 36+.
- Google Play: apps that contain native code must support 16 KB memory page sizes; BEJEWELY contains React Native/native libraries, so this is a release contract, not a Java/Kotlin-only exemption.
- Expo SDK 57: React Native 0.86, Android target/compile SDK 36, iOS 16.4+, Xcode 26.4+.

Authority references:

- https://developer.apple.com/news/upcoming-requirements/
- https://support.google.com/googleplay/android-developer/answer/11926878
- https://support.google.com/googleplay/android-developer/answer/17492799
- https://developer.android.com/guide/practices/page-sizes
- https://docs.expo.dev/versions/latest/

## 4. What CI proves

### Android

```text
exact candidate SHA
→ source identity/version/secret audit
→ Expo prebuild
→ generated Manifest/Gradle audit
→ release bundleRelease
→ resolved release Manifest targetSdk=36
→ pinned bundletool 1.18.3 digest check
→ AAB PAGE_ALIGNMENT_16K
→ packaged native ELF LOAD alignment >= 16 KB
→ non-empty app-release.aab
```

The bundletool binary is pinned by SHA-256 in `store-readiness.json` and verified before execution.

This proves release packaging viability and a bounded 16 KB page-size build contract. It does **not** prove Play upload signing because the production upload key is intentionally absent. The generated release build currently uses development signing material only as a build-time placeholder and must never be treated as the Play upload key.

### iOS

```text
exact candidate SHA
→ Xcode 26.6 + iPhoneOS 26.x attestation
→ source identity/version/secret audit
→ Expo prebuild
→ generated Info.plist/Xcode project audit
→ iOS 16.4 deployment target
→ CocoaPods
→ Release archive with CODE_SIGNING_ALLOWED=NO
→ non-empty .xcarchive
```

This separates code/archive viability from Apple Developer signing/provisioning authority.

## 5. Permission and secret boundary

Expected app capability in this slice:

```text
camera = allowed/required
microphone = forbidden
location = forbidden
contacts = forbidden
photo library read = forbidden
broad Android external storage = forbidden
```

`expo-camera` must explicitly set both Android audio recording off and iOS microphone permission injection off. Generated native files are checked again after Expo prebuild so a plugin default cannot silently broaden the permission surface.

Client config must not contain server secret tokens such as service-role keys, LLM provider API keys, payment secret keys, OAuth client secrets, or Apple private keys.

## 6. Store compliance inventory

A passing MOBILE-13 CI does **not** mean store-compliance completion.

Known repository blockers:

| Item | Status | Follow-up |
| --- | --- | --- |
| Public versioned privacy policy | BLOCKED | MOBILE-16 |
| In-app account deletion path | BLOCKED | MOBILE-16 |
| Google external account-deletion web resource | BLOCKED | MOBILE-16 |
| Apple required-reason Privacy Manifest audit | PENDING | MOBILE-16 |
| Google Play Data Safety answers | PENDING | MOBILE-16 |
| AI skin-analysis store-copy / medical-claim review | PENDING | MOBILE-16 |

Current policy relevance:

- Apple apps that support account creation must allow users to initiate account deletion.
- Google Play requires account deletion support for apps that allow account creation and requires an accurate Data Safety disclosure and privacy policy.
- The repository currently has authenticated My/account usage but no frozen account deletion path and no repository privacy-policy route.

Authority references:

- https://developer.apple.com/support/offering-account-deletion-in-your-app/
- https://support.google.com/googleplay/android-developer/answer/13327111
- https://support.google.com/googleplay/android-developer/answer/10144311

## 7. Explicit external blockers

These are not code failures and remain outside MOBILE-13:

```text
MOBILE-14
- hosted Supabase OAuth redirect allow-list
- Universal Links
- Android App Links
- apple-app-site-association
- assetlinks.json

MOBILE-15
- Apple Developer / App Store Connect authority
- Google Play Console authority
- iOS distribution certificates/provisioning
- Android upload signing key
- physical-device QA, including a real 16 KB Android environment where available
- TestFlight / Play Internal Testing

MOBILE-16
- privacy policy
- account deletion surfaces
- Apple privacy metadata / required-reason audit
- Google Data Safety
- store listing copy/assets
- AI skin-analysis claim review
- submission-readiness closeout
```

## 8. Non-goals

MOBILE-13 does not:

- register bundle/package identifiers in external consoles;
- add production signing credentials;
- add Universal Links/App Links;
- change hosted OAuth redirects;
- upload to TestFlight or Google Play;
- claim that privacy metadata is complete;
- substitute build-time 16 KB checks for physical-device/runtime validation;
- introduce a payment provider;
- change recommendation, Face Lab, Premium, report, or My domain behavior.

## 9. Closure rule

MOBILE-13 can close only when:

```text
SOURCE_IDENTITY = PASS
VERSION_POLICY = PASS
SECRET_BOUNDARY = PASS
ANDROID_GENERATED_RELEASE_CONTRACT = PASS
ANDROID_TARGET_API_36 = PASS
ANDROID_PAGE_ALIGNMENT_16K = PASS
ANDROID_NATIVE_ELF_ALIGNMENT_16K = PASS
ANDROID_RELEASE_AAB = PASS
IOS_GENERATED_RELEASE_CONTRACT = PASS
IOS_UNSIGNED_RELEASE_ARCHIVE = PASS
COMPLIANCE_INVENTORY = EXPLICIT
MOBILE_1_TO_12_REGRESSION = PASS
```

A CLOSED MOBILE-13 means **the repository has a verified release-preflight contract**. It does not mean the app is ready for public store submission.
