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

`packages/shared` is intentionally small in MOBILE-0. It contains only stable cross-client concepts that already have clear value: supported locales and the conceptual face-capture state contract. Survey and analyze DTO extraction are deferred until their current Web contracts are audited in their own implementation tracks.

`packages/face-contracts` already exists and is not folded into or duplicated by `packages/shared` in this stage.

## Environment boundary

Mobile source uses `EXPO_PUBLIC_*` names for values that are intentionally embedded in the client bundle. There is no automatic passthrough from Web `NEXT_PUBLIC_*` names.

Required future runtime values:

- `EXPO_PUBLIC_API_BASE_URL`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

`lib/env.ts` rejects a local-only API hostname in production. No secret value is committed by this foundation.

## Authentication boundary

Current Web server auth remains cookie-based and unchanged in MOBILE-0. Mobile Bearer access-token resolution is a separate MOBILE-2 server-auth adapter task and must preserve the existing Web cookie path.

## Navigation

MOBILE-0 uses one native tab shell:

- Home
- Analyze
- My

Result and Premium routes are deferred until those features exist. The `bejewely` scheme is reserved for future auth/share deep links, but no callback is implemented now.

## Validation semantics

MOBILE-0 static/CI validation can prove workspace resolution, TypeScript, Expo config, Android JS export, and platform-import boundaries. It cannot prove emulator/device launch or installable native binaries. Those are MOBILE-1 gates.
