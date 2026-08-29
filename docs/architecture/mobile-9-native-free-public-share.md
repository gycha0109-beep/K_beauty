# MOBILE-9 — Native Free Saved Report Public Share

Status: implementation slice authority
Base authority: `docs/architecture/mobile-foundation.md`
Previous slice: `docs/architecture/mobile-8-saved-report-reentry.md`
Base main at discovery: `279b2e0dcae4e72f600c7f0813628bddcef96bba`

## Objective

MOBILE-9 lets an authenticated owner explicitly publish the latest saved **free** report through the existing server publication contract, then hand the canonical HTTPS web URL to the native OS share sheet.

```text
Saved report (free only)
→ explicit public-share disclosure + user tap
→ POST /api/results { share: true, shareId } with native owner Bearer
→ server owner-scoped analysis_results.is_public = true
→ canonical /r/{shareId}
→ React Native Share.share(...)
```

## Authority

Mobile owns:
- explicit publication disclosure and tap UX
- native owner Bearer transport to the existing publication endpoint
- strict validation of the returned share id/path
- derivation of the public URL from the configured server origin
- invocation of the OS share sheet
- publication/share-sheet error presentation

Server remains authoritative for:
- result ownership
- `analysis_results.is_public`
- public-read policy and rate limits
- share-id parsing and canonical path
- public result rendering
- all analysis, scoring, recommendation and Premium policy

## In scope

- latest saved free report only
- existing `POST /api/results` branch where `share === true && shareId`
- existing owner authentication / authorization semantics
- explicit disclosure that sharing makes the result public to anyone with the link
- canonical `/r/{shareId}` URL handed to `Share.share`
- deterministic verifier and dedicated CI gate
- preservation of MOBILE-5, MOBILE-7 and MOBILE-8 contracts

## Out of scope

- Premium report publication or sharing
- anonymous result creation/publication
- new report persistence
- unpublish UX (`PATCH /api/results/{shareId}` remains server-owned and unchanged)
- inbound app links / universal links / Android intent filters
- domain association files
- store submission/readiness
- payment, Premium unlock, DB schema, RLS, Auth, Storage or Provider changes
- analysis or recommendation recomputation

## Persistence boundary

MOBILE-9 introduces no mobile-owned persistence. The only mutation is an explicit call to the already-existing server owner publication contract. Mobile never writes the database directly.

## Auth boundary

The existing native Supabase session Bearer is reused. MOBILE-9 does not change login, token issuance, ownership semantics or RLS.

## Publication invariants

1. Publication is impossible from the MOBILE-9 UI unless the loaded saved report is `kind === "free"` and a native session exists.
2. The request body is limited to `{ share: true, shareId }`.
3. The server must return `success: true`, `publicShared: true`, the exact requested `shareId`, and a canonical `/r/{shareId}` path before the OS share sheet is invoked.
4. Production public URLs must be HTTPS and use the configured server origin.
5. A publication failure must not invoke the OS share sheet.
6. A share-sheet failure after publication is reported separately because the server result may already be public.
7. MOBILE-9 does not call `/api/analyze`, `/api/full-report`, payment endpoints, Premium creation, or recommendation engines.
8. MOBILE-8 reentry transport remains read-only; publication code lives in a separate client module.
9. The MOBILE-5 `onPhotoChange={setCapturedPhoto}` regression contract remains unchanged.

## Verification contract

Static/deterministic:
- publication client uses only the existing `/api/results` owner publication branch.
- native Bearer, `credentials: "include"`, exact body and response guards are present.
- server publication branch remains owner-scoped by `share_id` and `user_id` and writes only `is_public: true`.
- free-only UI condition, disclosure and `Share.share` invocation are present.
- Premium/public-link inbound/store surfaces remain outside this slice.
- MOBILE-8 verifier still passes, proving its read-only reentry client did not absorb the mutation.
- mobile typecheck, Expo config, Android prebuild and generated-native verification pass.

Runtime:
- existing native-shell signed-out route smoke remains a required regression gate.
- authenticated publication and the OS share sheet are reported as runtime PASS only if a non-production authenticated free-report fixture is actually exercised.
- automated CI must not manufacture or mutate production user data merely to obtain runtime evidence.

## Acceptance

MOBILE-9 may be CLOSED after candidate SHA/CI, PR/review/merge, exact-main push CI, native-shell regression artifact/logcat evidence and final remote-main readback are observed. Authenticated publication/share-sheet runtime remains explicitly `NOT OBSERVED` unless a safe fixture is available; it must never be inferred from static CI.
