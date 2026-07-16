# SEC-11 POST-Only Signout Boundary

Date: 2026-07-16  
Branch: `feature/premium-beta-flow`  
Scope: local application implementation and verification; hosted OAuth and Supabase are not verified.

## Prior Defect

`AuthNav` linked directly to `GET /api/auth/signout`, and both GET and POST invoked the same mutation. Next.js also derived HEAD from GET, so links, crawlers, scanners, prefetch-like probes, and cross-site top-level navigation could sign a user out. The route used implicit global Supabase signout, ignored ordinary signout errors, and returned a default 307 redirect that could replay POST to `/`. Middleware refreshed the session before the signout route wrote deletion cookies.

The first POST-only implementation exposed a compatibility conflict: the then-global `Referrer-Policy: no-referrer` made Chromium serialize a same-origin native form POST with `Origin: null`. Allowing null, trusting Referer, or requiring JavaScript would weaken the boundary. SEC-10 therefore moved narrowly to `Referrer-Policy: same-origin`; cross-origin Referer suppression remains in force.

## HTTP Contract

- `AuthNav` uses one native `<form method="post" action="/api/auth/signout">` and a submit button. There is no signout anchor, Next Link, router navigation, browser Supabase signout, or prefetch transport.
- GET and explicit HEAD return 405 with `Allow: POST, OPTIONS`; neither creates an auth client, writes cookies, or redirects. HEAD has no body.
- OPTIONS returns 204 with the same Allow header, no auth work, and no CORS grant.
- POST requires an exact single Origin and, when present, exact `Sec-Fetch-Site: same-origin`. Origin is authoritative; Referer is never a fallback.
- Hosted Production, identified only by `VERCEL_ENV=production`, requires canonical production origin, request URL origin, and source Origin to match exactly. Preview and local execution require source and request origins to match exactly.
- Missing, null, malformed, credentialed, path/query/fragment-bearing, multiple, lookalike, protocol-mismatched, or unexpected-port origins return generic 403 before Supabase client creation.
- A valid POST calls `signOut({ scope: "local" })` exactly once. It logs out only the current browser application session, not the Google provider session or other devices.
- Success and an already-missing local session are idempotent 303 responses with fixed `Location: /`. Query redirect parameters are ignored, preventing open redirects and POST replay.
- Unexpected returned or thrown Supabase errors become generic 503 with `Retry-After: 60`; they are not presented as success. The installed SDK synthetic failure path produced no partial cookie deletion.

Every 303, 403, 405, 503, HEAD, and OPTIONS response includes:

```text
Cache-Control: private, no-store, max-age=0
CDN-Cache-Control: no-store
Vercel-CDN-Cache-Control: no-store
```

The SEC-10 global headers remain independently applied. The route adds no Access-Control-Allow-Origin or Access-Control-Allow-Credentials header.

## Session And Middleware Contract

`lib/supabase/middleware.js` bypasses refresh and `getClaims()` only for exact `/api/auth/signout`, before creating its Supabase client. Query strings do not affect the pathname match; prefix and nested lookalikes do not bypass refresh. The existing exact `/auth/callback` bypass and every other route's refresh behavior remain unchanged. This makes the route the only auth-cookie writer for signout and prevents refreshed cookies from restoring the deleted session.

Installed `@supabase/ssr` synthetic verification confirmed that local-scope signout calls `/auth/v1/logout?scope=local` once and emits the auth-cookie deletion with `maxAge=0`. With no session, the SDK returns a successful no-op without a network call. A synthetic 500 returned an error and emitted no cookie write.

## Verification

- Frozen SEC-11 manifest: `40/40 PASS`.
- OS TEMP matrix: original verifier passed; 17 omission and weakening mutations failed non-zero without the PASS marker (`18/18` matrix).
- SEC-10 Referrer matrix: three unsafe global alternatives plus removed image and purchase-link suppression all failed closed (`5/5`).
- Local production Chromium: SEC-11 targeted `1/1`, SEC-10 header targeted `1/1`, SEC-10 image-origin targeted `1/1`, and full `@smoke` `6/6` passed.
- Native form POST carried the exact local Origin and did not replay POST after the synthetic 303. A controlled `no-referrer` document emitted `Origin: null` and the real route returned 403.
- GET 405, explicit HEAD 405, OPTIONS 204, invalid-origin 403, no-store headers, no CORS grant, initials avatar, My link, CSP console, and hydration boundaries passed.
- SEC-10 headers `60/60`, SEC-10 image origin `44/44`, SEC-09 `57/57`, SEC-08 `55/55`, SEC-07 `42/42`, auth-origin, response, request-guard, RLS, premium, provider-log, and anonymous-write verifiers passed.
- Production build and `git diff --check` passed. Browser Supabase and external image/link requests were intercepted; no remote service was contacted.

## Residuals

- Preview and Production Origin serialization, canonical hosted origin, cookie deletion, and middleware behavior require hosted verification.
- A real OAuth round trip and remote Supabase signout were not executed.
- Google provider login is not terminated. Previously issued access JWTs may remain usable until their normal expiry; no global revocation is claimed.
- Multi-tab synchronization and provider-global logout are outside this boundary.

This document records local SEC-11 implementation only. It does not claim Preview, Production, remote Supabase, or actual OAuth verification.

## 2026-07-17 Combined-Gate Re-entry

The previous combined commit gate stopped on purchase-anchor verifier coverage, not on a new SEC-11 production defect. An initial `2 reachable / 5 unreachable` purchase-UI assumption was disproved by the active route graph: all seven source purchase anchors are currently unreachable. The authoritative partition is now `0 reachable / 7 unreachable`; no inactive purchase UI was reconnected or deleted to make SEC-11 pass.

Fresh local-production Chromium verification re-exercised the actual AuthNav native POST form. Its request carried the exact local serialized Origin, never `null`; present `Sec-Fetch-Site` was `same-origin`; the intercepted 303 continued with GET `/` and did not replay POST. GET and explicit HEAD remained 405, OPTIONS remained 204, missing/null/foreign/Referer-only/invalid-fetch-site requests remained 403, and all route outcomes retained no-store and SEC-10 global headers. CSP and hydration collectors remained empty.

The fresh verifier and runtime matrix passed: SEC-11 `40/40`, SEC-11 mutations `18/18` rejected, SEC-10 headers `60/60`, SEC-07 `42/42`, all four targeted browser checks `1/1`, full `@smoke` `6/6`, and production build. The purchase-anchor Playwright check is explicitly negative (`0/0/0`); it does not claim an actual purchase click. Hosted Origin/canonical-domain/cookie behavior, actual OAuth, and remote Supabase signout remain pending.
