# BEJEWELY Mobile

`apps/mobile` is the native Expo client inside the existing BEJEWELY monorepo. It does not replace the Next.js Web application.

## MOBILE-0 scope

- Expo + React Native + Expo Router + TypeScript
- Native Home / Analyze / My tab navigation
- public environment-variable contract
- shared domain package consumption
- static platform-boundary verification

Not implemented in MOBILE-0: Supabase mobile auth, camera capture, face guidance, `/api/analyze` calls, Recommendation logic, Premium, push notifications, or store billing.

## Commands

Run from the repository root after `npm ci`:

```bash
npm run mobile:start
npm run mobile:android
npm run mobile:typecheck
npm run mobile:config
```

`mobile:android` is the Android launch path for Expo development. MOBILE-1 must still verify an actual emulator/device launch and a native build artifact; a Metro/JS bundle alone is not reported as native-build success.

## Public environment contract

The mobile bundle may read only client-exposed values:

- `EXPO_PUBLIC_API_BASE_URL`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Do not put service-role, admin, database, provider, Vercel, crawler, or other server credentials into Expo public environment variables.

The `bejewely` URL scheme is reserved now so later auth/share deep-link contracts can use one stable application scheme. No auth callback is wired in MOBILE-0.
