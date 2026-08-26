# BEJEWELY Mobile Architecture Foundation

## Baseline

MOBILE-0 starts from the live `main` architecture and adds a native client without replacing Web or moving server authority into the app.

```text
packages/shared (platform-neutral contracts)
        ├── Next.js Web (existing)
        └── Expo Mobile (apps/mobile)
                  │
                  └── existing BEJEWELY server APIs / Supabase authority
```

## Authority boundary

Mobile is a client. The following remain outside the native bundle:

- Recommendation Engine and candidate policy
- Product Fact / Product Decision Axis runtime
- Face Lab server analysis pipeline
- Premium generation
- product database and crawler
- admin and server-only decision logic

Existing Web platform code (`app/`, `components/`, server `lib/`) is not imported into `apps/mobile`.

## Shared boundary

`packages/shared` remains intentionally small. It contains only stable cross-client concepts that already have clear value: supported locales and the conceptual face-capture state contract. Survey and analyze DTO extraction are deferred until their current Web contracts are audited in their own implementation tracks.

`packages/face-contracts` already exists and is not folded into or duplicated by `packages/shared`.

## Environment boundary

Mobile source uses `EXPO_PUBLIC_*` names for values that are intentionally embedded in the client bundle. There is no automatic passthrough from Web `NEXT_PUBLIC_*` names.

Required future runtime values:

- `EXPO_PUBLIC_API_BASE_URL`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

`lib/env.ts` rejects a local-only API hostname in production. No secret value is committed by this foundation.

## Authentication boundary

Current Web server auth remains cookie-based and unchanged. Mobile Bearer access-token resolution is a separate MOBILE-2 server-auth adapter task and must preserve the existing Web cookie path.

## Navigation

The native shell uses one tab surface:

- Home
- Analyze
- My

Result and Premium routes remain deferred until those features exist. The `bejewely` scheme is reserved for future auth/share deep links, but no callback is implemented in MOBILE-1.

## MOBILE-1 native shell

MOBILE-1 closes the Android native-runtime gap left intentionally open by MOBILE-0.

The authoritative Android build path is generated, not committed:

```text
apps/mobile/app.json
        ↓ expo prebuild --platform android --clean
apps/mobile/android/        # generated + gitignored
        ↓ Gradle assembleDebug
app-debug.apk
        ↓ adb install + Metro + emulator
rendered Home / Analyze / My shell
```

The Android application id is currently `com.bejewely.mobile`. This is the native CI/runtime identifier for the pre-store product and must be reviewed before any public store listing becomes immutable.

MOBILE-1 also establishes:

- automatic Android light/dark behavior through `expo-system-ui`
- system-locale initialization through `expo-localization`
- explicit KO/EN runtime switching without changing Web i18n
- portrait orientation
- explicit Android keyboard resize behavior
- non-translucent Android status bar plus Safe Area shell
- generated native directories excluded from source control

The native CI gate must prove all of the following on the exact candidate SHA:

1. clean workspace install
2. existing platform/import/secret boundaries
3. TypeScript and public Expo config
4. clean Android prebuild
5. generated application id/orientation/keyboard contract
6. Gradle debug APK assembly
7. Android emulator boot
8. APK installation and MainActivity launch
9. rendered Home → Analyze → My navigation
10. EN → KO runtime copy switch
11. light → dark system appearance propagation
12. APK, screenshots, UI dump, Metro log, logcat, and activity evidence retained as CI artifacts

MOBILE-1 does not implement Auth, Camera, `/api/analyze`, Premium, push notifications, billing, native Recommendation logic, or native Face Lab analysis. Those remain separate later phases.

## Validation semantics

MOBILE-0 static validation proves workspace resolution, TypeScript, Expo config, Android JS export, and platform-import boundaries.

MOBILE-1 adds a real Android native gate. A passing MOBILE-1 run means an APK was generated and installed on an Android emulator and the rendered shell completed the bounded smoke flow. It does not claim physical-device coverage, iOS coverage, store signing, production push, or mobile Auth/API behavior.
