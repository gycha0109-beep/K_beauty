# MOBILE-10 — Native Public Result Custom-Scheme Reentry

Status: implementation slice authority
Base authority: `docs/architecture/mobile-foundation.md`
Previous slice: `docs/architecture/mobile-9-native-free-public-share.md`
Base main at discovery: `93faf9828518521fd1065e50bd77a643de522aac`

## Objective

MOBILE-10 lets the installed native app open an existing server-published **free public result** through the already-registered BEJEWELY custom scheme without moving public-read authority into the client.

```text
bejewely://r/{shareId}
→ Expo Router hidden native route
→ strict local share-id shape check
→ GET /api/results/{shareId} without owner auth
→ server public-result guard / visibility / rate limit
→ server-projected public DTO
→ native read-only presentation
```

## Authority

Mobile owns:
- custom-scheme route acquisition through the existing `bejewely` scheme
- route parameter validation before transport
- anonymous public-result GET transport
- loading / invalid / not-found / rate-limit / unavailable UX
- read-only projection of the returned public DTO
- navigation back to the native Home surface

Server remains authoritative for:
- whether a result is public
- share-id canonical parsing
- anonymous/user public-read principal handling
- public-result rate limits
- public DTO projection and sensitive-field exclusion
- all analysis, recommendation, Product Fact, Face Lab and Premium policy

## In scope

- `bejewely://r/{shareId}` custom-scheme route
- existing `GET /api/results/{shareId}` public-read contract
- legacy 8-character and current 22-character share-id shapes already accepted by the server
- anonymous public-read cookie continuity through `credentials: "include"`
- free public result presentation only
- deterministic Android custom-scheme route smoke using a syntactically invalid id, so CI does not require or manufacture public production data
- dedicated MOBILE-10 verifier and CI gate
- MOBILE-5 / MOBILE-7 / MOBILE-8 / MOBILE-9 regression preservation

## Out of scope

- Android HTTPS App Links / `intentFilters`
- iOS Universal Links / `associatedDomains`
- `assetlinks.json` or `apple-app-site-association`
- production domain or deployment mutation
- store signing, listing or submission
- Premium public sharing/reentry
- owner-only unpublished result reentry
- publication or unpublish mutation
- Auth/provider/redirect allow-list changes
- DB schema, RLS, Storage, Payment or Provider changes
- analysis/recommendation recomputation

## Public-read invariants

1. The native client calls only `GET /api/results/{shareId}` for MOBILE-10 data.
2. No Authorization header is required or fabricated for public reentry.
3. `credentials: "include"` is retained so the existing anonymous principal cookie/rate-limit authority can function.
4. A successful response must be `success: true`, contain an object result, and return the exact requested `shareId` before rendering.
5. Invalid route ids fail locally without a network request.
6. 404, 429 and 503 remain distinct user-visible states.
7. The native client never checks or overrides `is_public`; server read authority decides whether a result exists for the viewer.
8. MOBILE-10 does not call `/api/analyze`, `/api/full-report`, publication, unpublish, Premium, payment or persistence endpoints.
9. MOBILE-9 outbound publication remains separated from MOBILE-10 inbound read transport.
10. The MOBILE-5 `onPhotoChange={setCapturedPhoto}` contract remains unchanged.

## Hosted-link boundary

The repository already registers `scheme: "bejewely"`, which is sufficient for this bounded custom-scheme slice. HTTPS Android App Links and iOS Universal Links require domain association and deployment configuration. Those surfaces are intentionally not changed here because they cross production/deployment authority and need their own explicit slice.

## Verification contract

Static/deterministic:
- app config still registers only the existing `bejewely` custom scheme; no `intentFilters` or `associatedDomains` are added.
- the hidden Expo Router path is `r/[shareId]`.
- public client uses only GET `/api/results/{shareId}`, no Bearer header and no mutation method/body.
- public server route still invokes `guardPublicResultRead` and `readAnalysisResultForShare`.
- public serializer still projects the bounded public DTO and excludes owner-only `isPublic`.
- native renderer displays server-returned fields only and imports no engine/server-only code.
- M5/M7/M8/M9 verifiers, mobile typecheck, Expo config, Android prebuild and generated-native verification pass.

Runtime:
- Native Shell launches `bejewely://r/invalid` through Android `ACTION_VIEW` scoped to `com.bejewely.mobile`.
- the installed APK must route to the MOBILE-10 screen and render `Invalid shared result link.` without requiring network/public data.
- a screenshot is retained as `public-result-deep-link-invalid-en.png`.
- a real valid public-result fetch is reported PASS only if a safe public fixture is actually exercised; it is otherwise `NOT OBSERVED`.

## Acceptance

MOBILE-10 may be CLOSED after exact candidate gates, PR/review/merge, exact-main push gates, Native Shell custom-scheme runtime evidence, artifact/logcat verification and final remote-main readback. HTTPS App/Universal Link coverage and real valid-public-result runtime must not be inferred from this custom-scheme smoke.
