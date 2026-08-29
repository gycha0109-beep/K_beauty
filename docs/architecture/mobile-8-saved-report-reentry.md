# MOBILE-8 — Native Saved Report Reentry

Status: implementation slice authority
Base authority: `docs/architecture/mobile-foundation.md`
Base main at discovery: `4b742ed0dc95b0db649f3fa49433b21cbcb4d962`

## Objective

MOBILE-8 adds native Android reentry for the latest server-saved report from My without recomputing analysis or recommendation.

```text
My
→ latestSavedReport / latestSharePath from /api/my/dashboard
→ free: GET /api/results/{shareId}
→ premium: POST /api/full-report { savedReportId, locale }
→ native read-only presentation
```

## Authority

Mobile owns:
- My entry navigation
- loading / empty / error / retry UX
- native transport to existing read contracts
- read-only projection of server-returned report data

Server remains authoritative for:
- saved report ownership and persistence
- free result visibility / owner access
- Premium report snapshot
- Premium access and commercial policy
- analysis, scoring, recommendation, routine and condition decisions

## In scope

- latest saved report metadata from the existing My dashboard response
- native owner Bearer transport
- free saved-result reentry through the existing result-read guard
- premium saved-report reentry through the existing `savedReportId` branch
- free/premium discriminator and response-shape guards
- native saved-report route and read-only renderer
- deterministic static verifier and dedicated CI gate
- Android route/runtime evidence through the native shell gate

## Out of scope

- new report persistence or save mutation
- Premium report creation
- payment or Premium unlock changes
- DB, RLS, Auth, Storage or Provider authority changes
- recommendation or Face Lab engine changes
- generalized share sheet, universal links or app-store readiness
- free report publication/unpublication mutation

## Persistence boundary

MOBILE-8 is read-only. It does not write `saved_reports`, `analysis_results`, Premium sessions, or any other server persistence surface.

## Auth boundary

Existing native session Bearer transport is reused. MOBILE-8 does not change authentication semantics.

## Reentry invariants

1. Free reentry reads the server-projected result DTO from `/api/results/{shareId}`.
2. Premium reentry sends only `savedReportId` and locale to the existing saved-report branch of `/api/full-report`.
3. Mobile never calls `/api/analyze` during reentry.
4. Mobile never invokes Premium creation or payment/access mutation during reentry.
5. Mobile does not reconstruct recommendation, routine, functional or condition decisions.
6. The MOBILE-5 `onPhotoChange={setCapturedPhoto}` camera handoff remains unchanged.

## Verification contract

Static/deterministic:
- My entry is wired to the hidden saved-report route.
- My dashboard remains the metadata authority.
- free/premium endpoint and owner Bearer contracts are present.
- Premium response must identify `meta.source = saved-report`.
- forbidden analysis/save/payment/engine paths are absent from the native reentry client.
- mobile typecheck, Expo config, Android prebuild and generated native contract pass.

Runtime:
- Android native shell can enter My and open the saved-report route.
- signed-out/empty/error/loaded states render without a fatal crash.
- owner-backed server reentry is claimed only when an authenticated saved-report fixture is actually observed.

## Acceptance

MOBILE-8 may be CLOSED only after candidate SHA/CI, PR/review/merge, exact-main push CI, Android artifact/runtime evidence, fatal logcat scan, and final remote-main readback are observed. Unobserved owner-backed runtime reentry must not be reported as PASS.
