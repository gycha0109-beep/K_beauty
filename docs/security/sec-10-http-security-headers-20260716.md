# SEC-10 HTTP Security Headers And Nonce CSP

Date: 2026-07-16
Branch: `feature/premium-beta-flow`
Scope: local application implementation and verification; hosted deployment is not verified.

## Prior State

The application had route-specific cache and CORS behavior but no repository-wide browser security header registry or document CSP. The root layout included one inline theme initialization script, product images used the completed SEC-10 exact-origin policy, and browser Supabase clients used `NEXT_PUBLIC_SUPABASE_URL`. OAuth uses a full-page redirect; no popup, iframe embed, browser realtime subscription, worker, external script, or external stylesheet path was found.

## Responsibility Split

- `lib/security/security-headers.js` is the pure source of truth for global headers, nonce generation, document request classification, Supabase origin parsing, and deterministic CSP construction.
- `next.config.js` applies non-document global headers to `/:path*`, including API and static assets.
- `middleware.js` creates one fresh document nonce, overwrites untrusted incoming nonce/CSP request headers, forwards the trusted values to rendering, and applies the same CSP to the final page or redirect response.
- `lib/supabase/middleware.js` accepts optional forwarded request headers while preserving refreshed request cookies and response `Set-Cookie` values.
- `app/layout.js` uses the async Next.js 15 `headers()` API and gives the validated request nonce to the existing theme script.
- Existing route-specific cache, CDN cache, CORS, `Retry-After`, `Content-Type`, and `Allow` headers remain route-owned. SEC-09 no-store behavior was not absorbed into this registry.

## Global Headers

The following values apply to all repository routes through `next.config.js`:

```text
Cross-Origin-Opener-Policy: same-origin
Origin-Agent-Cluster: ?1
Referrer-Policy: same-origin
X-Content-Type-Options: nosniff
X-DNS-Prefetch-Control: off
X-Frame-Options: DENY
X-Permitted-Cross-Domain-Policies: none
Permissions-Policy: accelerometer=(), bluetooth=(), browsing-topics=(), camera=(self), clipboard-read=(), clipboard-write=(self), fullscreen=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), picture-in-picture=(), publickey-credentials-get=(), serial=(), usb=()
```

Camera and clipboard write remain available only to the same origin for the existing capture and share-copy flows. Unused capabilities are denied. No wildcard CORS, COEP, global CORP, or application HSTS was added.

## Nonce And Document Boundary

Each GET or HEAD HTML document navigation receives 16 random bytes from Web Crypto, encoded as a 24-character base64 nonce. Nonces are not derived from a timestamp, path, identity, or process-global value and are not stored in a cookie, browser storage, or log.

The document classifier excludes `/api`, `/_next`, direct static files, RSC requests, and prefetch requests. A browser document destination is authoritative; when it is absent, `Accept: text/html` is required. Incoming `x-nonce` and request CSP values are overwritten. The response exposes CSP but not a separate `x-nonce` header.

Canonical redirects and auth redirects retain their status, `Location`, cookies, global headers, and document CSP. A missing or malformed Supabase connect origin produces a generic local policy-unavailable 503 rather than a wildcard or development fallback.

## Production CSP

For the current local environment, the exact production policy is:

```text
default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'nonce-<request-nonce>' 'strict-dynamic'; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://img.hwahae.co.kr; font-src 'self'; connect-src 'self' https://bygrczggxfuisupcevaz.supabase.co; frame-src 'none'; worker-src 'none'; media-src 'self' blob:; manifest-src 'self'; upgrade-insecure-requests;
```

Production `script-src` contains neither `unsafe-inline` nor `unsafe-eval`. The exact image sources match `PRODUCT_IMAGE_CSP_DIRECTIVE`. The browser connect policy contains only self and the parsed origin of `NEXT_PUBLIC_SUPABASE_URL`; no browser realtime caller was found, so no production WebSocket origin is allowed.

Development adds only `unsafe-eval` for React/Next diagnostics and an exact local `ws://localhost:<port>` or `ws://127.0.0.1:<port>` HMR origin. It does not add broad `https:`, `wss:`, or wildcard sources and does not use `upgrade-insecure-requests` on local HTTP.

## Compatibility Decisions

- `style-src 'unsafe-inline'` remains because the repository uses JSX style attributes, styled-jsx, and inline style blocks. This is a documented Low residual and is not a script exception.
- `media-src 'self' blob:` preserves local camera/media preview behavior. `worker-src 'none'` reflects the absence of a worker or service-worker caller.
- Clickjacking is blocked by both `frame-ancestors 'none'` and `X-Frame-Options: DENY`, including shared reports.
- The initial `Referrer-Policy: no-referrer` blocked SEC-11's JavaScript-independent native logout form: local Chromium serialized its same-origin POST as `Origin: null`, which the mandatory Origin policy correctly rejected. The global policy is now `same-origin`, allowing same-origin navigation context while continuing to suppress every cross-origin Referer. SEC-07 purchase links retain `rel="noreferrer"`, and SEC-10 product images retain `referrerPolicy="no-referrer"` as component-level defense in depth.
- COOP `same-origin` is compatible with the current full-page Google OAuth redirect. COEP and global CORP remain excluded because cross-origin isolation is not required.
- HSTS scope is deferred to hosted verification. No `includeSubDomains` or `preload` commitment is made.

## Rendering Impact

Next.js is pinned at `15.5.18`. Reading request headers in the root layout makes application documents dynamically rendered. The production build lists all application page routes as `ƒ`; only generated metadata images remain static. No ISR or static-export requirement was found. This changes page caching and server-rendering cost and must be observed after deployment.

## Local Runtime Evidence

The fresh production server showed:

- `/`, `/result`, `/result/full-report`, `/r/<synthetic-id>`, and an HTML 404 returned document CSP and all global headers.
- Three root responses had three distinct nonces.
- The root theme script, Next framework runtime, page bundles, and Next inline scripts all carried the response CSP nonce.
- An incoming valid-shape fake `x-nonce` was ignored, and no response `x-nonce` debug header was emitted.
- `/auth/callback` without a code retained its 307 `Location` and document CSP.
- `/api/analyze` GET returned its existing 405 and global headers without document CSP.
- `/icon.png` retained its image content type and immutable asset behavior plus global headers, without document CSP.
- Browser security-policy violation and hydration-error collectors observed zero events in the targeted production test.
- Local Chromium confirmed that the native signout form sends the exact local serialized Origin under `same-origin`. A controlled `no-referrer` response produced `Origin: null` and was rejected by the signout route with 403.
- Intercepted browser requests to the configured Supabase origin, the approved product-image origin, and the external purchase-link fixture contained no Referer. No external request was sent.

## Verification

- Frozen SEC-10 header manifest: `60/60 PASS`.
- Omission and integrity mutations: required-header, nonce, CSP, duplicate, unknown, count, and unobserved cases all exited non-zero without the PASS marker.
- Weakening mutations: production script `unsafe-inline`, production `unsafe-eval`, broad image `https:`, wildcard Supabase, removed `frame-ancestors`, removed theme nonce, removed redirect CSP, and trusted incoming nonce all exited non-zero without the PASS marker.
- Production header Playwright: `1/1 PASS`.
- SEC-10 image-origin Playwright: `1/1 PASS`.
- Referrer weakening mutations for `no-referrer`, `strict-origin-when-cross-origin`, and `unsafe-url` failed the exact SEC-10 policy verifier. Removing product-image `no-referrer` failed SEC-10 image verification, and removing purchase-link `noreferrer` failed SEC-07 verification.
- Full `@smoke`: `6/6 PASS`; non-live browser Supabase, product-image, and purchase-link requests were intercepted locally.
- SEC-10 image origin `44/44`, SEC-09 `57/57`, SEC-08 `55/55`, SEC-07 `42/42`, and related response/request/RLS/premium/provider/anonymous verifiers passed.
- `npm run build`, syntax checks, Playwright discovery, and `git diff --check` passed.

The first production Playwright attempt read nonce attributes with `getAttribute()`, which browsers intentionally hide as an empty string. The test was corrected to use `HTMLScriptElement.nonce`; no production policy was relaxed.

## Deployment Residuals

- Preview and Production CSP values, nonce uniqueness, redirect cookies, and browser console behavior remain unverified.
- Hosted HSTS values on the Vercel domain and custom domain remain unverified. Subdomain HTTPS readiness must precede any `includeSubDomains` or preload decision.
- A real hosted Google OAuth round trip and Supabase session refresh remain unverified.
- Preview and Production native-form Origin serialization under hosted routing remains unverified.
- External reverse proxies remain outside the trusted deployment contract.
- Inline style compatibility remains a Low residual until style attributes and runtime style blocks are removed or nonce/hash protected.
- Dynamic rendering latency, function cost, and cache behavior require hosted observation.

This document records local SEC-10 application implementation only. It does not claim SEC-10 deployed, hosted CSP verified, hosted HSTS verified, or Production verified.

## 2026-07-17 Purchase-Anchor Verification Follow-Up

The first combined SEC-10/SEC-11 commit gate exposed a verifier coverage gap rather than a production-header regression. In an OS TEMP copy, removing only `noreferrer` from `TopPickHeroCard::top-pick` still let the prior HEAD SEC-07 verifier emit its PASS marker. The prior check proved only that each file contained a safe-looking anchor string; it did not bind attributes and resolver provenance to every opening anchor node.

The shared source-only purchase-anchor contract now freezes these seven production-source implementations:

1. `app/result/page.js::ProductDecisionCard::featured-top-pick`
2. `app/result/page.js::ProductDecisionCard::category-card`
3. `app/result/page.js::ProductDecisionCard::category-modal`
4. `app/result/full-report/page.js::TopPickHeroCard::top-pick`
5. `app/result/full-report/page.js::SupportingProductCard::supporting-product`
6. `app/result/full-report/page.js::BudgetAlternativeCard::budget-alternative`
7. `app/result/full-report/page.js::ProductUsageCard::product-usage`

For each source anchor, the contract binds `purchaseLink.href`, authoritative resolver provenance, `_blank`, `noopener`, and `noreferrer` to the same opening tag. Expected, discovered, and verified source sets are all `7/7`. The current active route graph reaches none of these legacy purchase components: runtime reachable is `0`, runtime unreachable is `7`, with an exact disjoint partition. Reconnecting any of the inactive components makes the verifier fail until the reachability manifest and real renderer coverage are reviewed together.

Fresh OS TEMP results were:

- per-anchor `noreferrer` removal: `7/7` rejected by both SEC-07 and SEC-10;
- per-anchor `noopener` removal: `7/7` rejected by SEC-07;
- per-anchor target weakening: `7/7` rejected by SEC-07;
- source exact-set/provenance mutations: `10/10` rejected;
- reachability mutations: `7/7` rejected;
- global Referrer-Policy weakening: `3/3` rejected;
- removal of `SafeProductImage` no-referrer: `1/1` rejected.

Local production Playwright confirmed that active `/result` and `/result/full-report` render exactly zero purchase anchors and issue zero seller/search requests (`runtime expected/rendered/covered = 0/0/0`). This is a negative reachability assertion, not a claim that the seven inactive renderers were exercised. An actual production purchase-anchor click and its outbound Referer were not runtime-tested because no purchase anchor is reachable. The source `noreferrer` contract, all seven per-anchor mutations, the synthetic external-link privacy fixture, the approved-image interception, and intercepted Supabase traffic remain the available local evidence. Hosted purchase navigation remains pending.
