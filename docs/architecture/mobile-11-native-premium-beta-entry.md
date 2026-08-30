# MOBILE-11 — Native Premium Beta Entry + Private Report Finalization

- Task type: design → bounded execution → verification
- Base exact main: `8c0a0c533f87d55e64e960950f1276c485a5f2bb`
- Base authority: `docs/architecture/mobile-foundation.md`, `docs/architecture/premium-beta-flow-v1.md`
- Protected routing: Payment/entitlement/release-mode/DB/RLS/Auth/Storage/Provider/Secret authority mutation = N. The mobile client invokes only existing owner-authorized server contracts.

## Objective

MOBILE-11 adds a native entry from the server-returned free result into the existing Premium beta flow without moving Premium policy or report generation onto the device.

```text
native free result
→ hidden /premium route
→ native account session presence check
→ GET /api/premium/access with Bearer
→ server-authoritative access state
→ optional current-products context from existing product-list API
→ POST /api/full-report { locale, currentProducts }
   + Bearer
   + existing HTTP-only Premium session cookie from /api/analyze
→ server rechecks access and Premium session
→ server finalizes and privately persists saved Premium report
→ MOBILE-8 /saved-report reentry
```

## Authority

Mobile owns only:

- Premium entry navigation and state presentation
- loading / signed-out / unavailable / payment-required / retry UX
- optional current-products selection values
- transport to existing server contracts
- transition to the existing saved-report reentry after successful finalization

Server remains authoritative for:

- `PREMIUM_RELEASE_MODE`
- account and entitlement resolution
- Premium session preparation and verification
- Premium report generation/snapshot finalization
- current-product semantics and verdicts
- Premium save/persistence
- Recommendation, Product Fact, functional, condition, Face Lab and routine decisions
- payment/commercial policy

The mobile app must not infer `canCreatePremium` from local user metadata, release mode, plan labels or product state.

## Existing session continuity

`POST /api/analyze` already decides whether a Premium report session may be prepared through `canPreparePremiumReportSession(...)`. When allowed, it emits the existing HTTP-only `PREMIUM_REPORT_COOKIE`.

MOBILE-11 preserves that authority:

- native `/api/analyze` transport already uses `credentials: "include"`
- native `/api/full-report` transport also uses `credentials: "include"`
- the mobile client never reads, synthesizes, signs, rotates or persists the Premium session token itself
- a missing/expired session is rendered as a server error state and the user is sent back to Analyze

## Premium access

`GET /api/premium/access` is the only mobile authority for creation availability after an account session is present.

The client renders server-returned states such as:

- `premium_unavailable`
- `login_required`
- `payment_required`
- allowed states such as `beta_open`, `paid` or `admin_override`

The client does not implement its own release-mode or entitlement decision tree.

## Current-products contract

Current products are optional context. The native selector mirrors the existing bounded statuses:

- `selected`
- `not_in_db`
- `not_using`

Product choices come only from the existing read endpoint:

`GET /api/current-products/products?category=...`

The mobile client sends only the existing DTO fields required by the server:

- `category`
- `status`
- `productId` when `status = selected`

It does not calculate current-product verdicts or routine semantics.

## Finalization and persistence boundary

MOBILE-11 invokes the existing owner-authorized:

`POST /api/full-report`

with:

```json
{
  "locale": "ko | en",
  "currentProducts": []
}
```

plus the authenticated Bearer token and existing HTTP-only Premium session cookie.

The server must still:

1. resolve the authenticated principal,
2. recheck `access.canCreatePremium`,
3. verify `PREMIUM_REPORT_COOKIE`,
4. apply/sanitize optional current-products context,
5. finalize the immutable Premium snapshot,
6. privately persist/reuse the owner `saved_reports` row,
7. return `meta.source` and `meta.persistence.savedReportId`.

The mobile client never writes `saved_reports` or any database table directly.

## Out of scope

- payment provider integration or checkout CTA
- entitlement mutation
- release-mode mutation
- DB schema/migration/RLS changes
- Auth semantics/provider/redirect allowlist changes
- Premium engine logic on mobile
- current-product verdict logic on mobile
- public Premium sharing
- Premium publication/unpublication
- HTTPS App Links / Universal Links / domain association
- production deployment mutation
- store signing/listing/submission
- Face Lab generation changes
- recommendation/scoring/ranking changes

## Verification contract

Static/deterministic:

- `/premium` is a hidden native route.
- the free native result exposes a Premium entry CTA.
- signed-out users are stopped locally before Premium access/finalization network calls.
- signed-in access uses existing `GET /api/premium/access` with Bearer.
- current-product options use only the existing read endpoint.
- finalization uses existing `POST /api/full-report` with Bearer, `credentials: "include"`, locale and current-products only.
- successful finalization requires server `meta.persistence.savedReportId` and reenters MOBILE-8 saved report.
- mobile code contains no Premium release/entitlement policy, Supabase admin, payment, provider, DB or Premium-engine authority.
- MOBILE-5/7/8/9/10 regressions remain green.

Runtime:

- Android installed APK opens `bejewely://premium`.
- with the cleared native test profile, the signed-out state renders:
  `Sign in on My to create a premium report.`
- the smoke test does not call Premium finalization and therefore does not mutate server data.
- fatal/crash/ANR scan remains clean.

## Acceptance

MOBILE-11 may be CLOSED only after:

- exact candidate SHA
- dedicated CI and regression gates
- PR/review/merge
- exact merged-main CI
- Android APK/emulator Premium-route runtime evidence
- artifact digest and screenshot evidence
- fatal/crash scan
- final remote-main readback

Authenticated Premium finalization and private `saved_reports` creation are reported as `NOT OBSERVED` unless a safe non-production authenticated fixture is actually exercised. Automated CI must never manufacture or mutate production Premium/account data.
