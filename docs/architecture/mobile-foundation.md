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

Required runtime values:

- `EXPO_PUBLIC_API_BASE_URL`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

`lib/env.ts` rejects a local-only API hostname in production. No secret value is committed by this foundation.

## Authentication boundary

Web remains cookie-based. MOBILE-2 adds a shared server authorization boundary that accepts either the existing Web cookie context or a Native Supabase Bearer access token and validates the token server-side before returning a user-bound Supabase client.

Native auth uses standalone `@supabase/auth-js` `GoTrueClient`, PKCE, `bejewely://auth/callback`, encrypted SecureStore persistence, bounded chunking, automatic refresh, and migration/deletion of the former plaintext FileSystem session payload. Service-role/admin/server secrets remain forbidden from the native bundle.

Hosted Google sign-in additionally requires `bejewely://auth/callback` in the Supabase redirect allow-list. Repository code cannot by itself attest that external hosted setting.

## Navigation

The native shell uses one tab surface:

- Home
- Analyze
- My

Result and Premium routes remain deferred until those features exist. The `bejewely` scheme is registered for the native auth callback and later bounded deep-link work.

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

### SDK 57 native compatibility pin

The Android runtime pair is intentionally pinned to `react-native-reanimated 4.5.1` and `react-native-worklets 0.10.1`. An earlier unpinned optional-peer resolution selected Reanimated 4.6.0 + Worklets 0.12.1 and failed native C++ compilation in `expo-modules-core` because the expected `WorkletRuntime::executeSync` API was absent. The root lockfile was regenerated after removing the stale pair, a clean plain `npm ci` validated the resulting graph, and the permanent native verifier rejects drift from the validated SDK 57 pair.

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

MOBILE-1 does not implement Auth, Camera, `/api/analyze`, Premium, push notifications, billing, native Recommendation logic, or native Face Lab analysis. Those are separate later phases.

## MOBILE-2 authentication

MOBILE-2 connects the native client to the existing Supabase user authority without replacing the Web cookie flow.

The server contract is:

```text
Web cookie session ─┐
                    ├─ resolveRouteSupabaseAuth → validated user-bound Supabase client
Native Bearer token ┘
```

The native client:

- uses Google OAuth + PKCE
- restores and refreshes the Supabase session on-device
- persists session material in Expo SecureStore with bounded chunking
- sends only normal-user Bearer access tokens to authenticated BEJEWELY APIs
- never embeds service-role/admin/server secrets
- keeps the standalone GoTrue dependency boundary required by the validated Hermes graph

## MOBILE-3 My / Skin Diary

MOBILE-3 does not create a second diary domain. It projects the existing Web/server My authority into the native client.

The native My surface reuses:

- `GET /api/my/dashboard` for active profile, today state, recent seven-day check-ins, selected-month diary entries, server-generated routine, and latest-report metadata
- `POST /api/my/check-in` for the existing five 0–4 condition levels, bounded event context, memo, and server-side daily routine generation
- `GET /api/my/diary-day` for historical check-in/routine snapshots

`/api/my/dashboard` and `/api/my/check-in` already supported the MOBILE-2 dual-auth resolver. MOBILE-3 extends only the missing `/api/my/diary-day` path so that its domain function can consume an injected validated auth context while preserving the original cookie fallback.

The native client may format and display returned profile/check-in/routine data, but it must not reproduce `generateDailyRoutine`, recommendation scoring, Product Fact logic, Face Lab analysis, or Premium generation.

MOBILE-3 intentionally leaves the following for later stages:

- MOBILE-4: shared survey contract extraction
- MOBILE-5: native camera
- MOBILE-6: face capture guidance
- MOBILE-7: analyze transport + result
- MOBILE-8+: Premium, share/deep-link expansion, store readiness

## Validation semantics

MOBILE-0 static validation proves workspace resolution, TypeScript, Expo config, Android JS export, and platform-import boundaries.

MOBILE-1 adds a real Android native gate. A passing native-shell run means an APK was generated and installed on an Android emulator and the rendered shell completed the bounded smoke flow. It does not claim physical-device coverage, iOS coverage, store signing, production push, or hosted OAuth behavior.

MOBILE-2 adds auth-specific static gates for cookie preservation, Bearer validation, standalone GoTrue, PKCE, encrypted session persistence, plaintext migration/deletion, and secret boundaries.

MOBILE-3 adds a My/Skin Diary contract gate proving that native reads/writes use existing authenticated APIs, diary-day preserves cookie + Bearer dual auth, and routine/Recommendation/Face Lab/Premium authority has not moved into the native client. The existing native-shell workflow remains the rendered Android regression gate for the exact candidate and merged-main SHA.
