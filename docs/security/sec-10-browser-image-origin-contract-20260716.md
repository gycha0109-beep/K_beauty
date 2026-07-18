# SEC-10 Browser Image-Origin Contract

Date: 2026-07-16
Branch: `feature/premium-beta-flow`
Scope: browser image-origin boundary only; CSP and global HTTP security headers are not implemented in this step.

## Finding

`products.image_url` and OAuth `user_metadata.avatar_url` / `picture` could previously reach browser `<img>` elements without an exact origin contract. This prevented a strict CSP `img-src` policy and allowed unreviewed third parties to receive browser image requests, client IP addresses, and potentially referrer paths.

Repository fixtures and enrichment payloads showed one approved catalog image origin and five deliberately rejected origins:

- Approved: `img.hwahae.co.kr`
- Rejected: `shop.ideaseller.kr`
- Rejected: `manyo.us`
- Rejected: `cutipop.com`
- Rejected: `d1flfk77wl2xk4.cloudfront.net`
- Rejected: `d2c3d01lcpw2ui.cloudfront.net`

No external image, DNS, remote Supabase, Preview, Production, OAuth, or provider request was made during implementation or verification.

## Product Image Contract

The pure policy in `lib/security/image-source-policy.js` approves only canonical URLs satisfying every condition below:

- Input is an unchanged string of at most 2,048 characters with no control character or surrounding whitespace.
- URL is absolute, exact `https:`, has no username/password, explicit port, query, or fragment.
- Parsed ASCII hostname is exact `img.hwahae.co.kr`; wildcard, suffix, substring, lookalike, trailing-dot, localhost, and IP forms do not pass.
- Path matches `^/products/([0-9]+)/\1_[0-9]{14}\.jpg$`.
- Directory and filename product IDs match.
- Percent-encoded, double-slash, traversal-like, alternate-extension, and noncanonical serialized forms do not pass.

The resolver returns only a canonical approved URL or `null`. It never returns the rejected raw input, a debug URL, or a fallback external origin.

## Projection And Persistence

Product source normalization, current-product snapshots, anonymous result persistence, analyze responses, premium sessions, full-report responses, and saved-report persistence use the shared policy. Recursive payload sanitization removes fixed image URL aliases at unknown locations and reintroduces `image_url` only at recognized product-node paths.

Legacy unapproved product URLs therefore remain in existing database rows but are not newly projected, persisted, or rendered. Unknown metadata containing even an otherwise approved Hwahae URL is not promoted into a product image. The Public Result DTO remains unchanged and continues to omit product images.

SEC-08 face images are a separate contract. The premium sanitizer explicitly preserves only the canonical `faceLabSummary.imageUrl` data URL and does not treat it as a catalog product image.

## Browser And Avatar Boundary

All four product renderers use `SafeProductImage`. It resolves the product again before assigning `src`, applies `referrerPolicy="no-referrer"`, and transitions to a stable local placeholder after a load error without retry loops. Rejected URLs do not enter the DOM or trigger a browser request.

External avatar image approval is intentionally empty. `AuthNav` does not render `avatar_url`, `picture`, or `profiles.avatar_url`; it renders normalized initials or a local generic icon. Profile upsert no longer copies new external avatar metadata into `profiles.avatar_url`. Existing stored values were not backfilled or deleted.

## Writer Boundary

The controlled enrichment writer validates `image_url` before product DB access or update. An unapproved value raises the generic `PRODUCT_IMAGE_SOURCE_REJECTED` error without including the raw URL, preventing a partial update of other enrichment fields. Candidate promotion converts an unapproved inherited image to `null`.

Direct SQL remains outside the application writer contract, so reader and render fail-closed checks remain authoritative. No DB constraint or migration was added.

## Excluded Designs

- No image proxy or server-side image fetch was added; current SEC-10 image handling introduces no SSRF path.
- No first-party rehosting, Storage bucket, backfill, or lifecycle policy was added.
- No Next Image external optimizer or dependency was added.
- No CSP, nonce middleware, layout change, or global security header was added in this step.

## CSP Contract For The Next Step

The code registry exports this exact candidate:

```text
img-src 'self' data: blob: https://img.hwahae.co.kr;
```

- `'self'`: application assets and local placeholders.
- `data:`: SEC-08 canonical face images and result/full-report previews.
- `blob:`: the existing local upload preview created with `URL.createObjectURL()`.
- `https://img.hwahae.co.kr`: the one approved browser-direct product image origin.

The candidate excludes broad `https:`, wildcard sources, Google avatar hosts, CloudFront, seller hosts, Supabase, and server-only provider origins.

## Verification

- SEC-10 verifier: frozen exact manifest, `44/44 PASS`.
- Omission controls: removed approved-host, lookalike, legacy, writer, and broad-HTTPS cases all exited non-zero without a PASS marker.
- Integrity controls: duplicate, unknown, count mismatch, and unobserved mutations exited non-zero.
- Weakening controls: suffix matching, removed path predicate, restored arbitrary avatar `src`, and restored raw product `src` all exited non-zero.
- SEC-09: `57/57 PASS`.
- SEC-08: `55/55 PASS`.
- SEC-07: `42/42 PASS`.
- Existing response-boundary, analysis request guard, analysis RLS, premium release, premium reentry, provider-log sanitization, anonymous grant, syntax, and crawler typecheck checks passed.
- SEC-10 targeted Playwright: `1/1 PASS` with all external image requests intercepted locally.
- Full Playwright `@smoke`: `5/5 PASS`.
- `npm run build`: PASS with Next.js 15.5.18.
- `git diff --check`: PASS.

The first targeted Playwright attempt used stale result-step button labels and timed out before any image assertion. The test navigation was aligned to the current five-step UI and the full targeted test then passed; no production contract was relaxed.

## Residuals

- The approved external host still receives the browser IP address; `no-referrer` prevents route/share-path referrer disclosure but does not provide first-party privacy.
- Host availability and path evolution are operational risks; no liveness monitor or automatic registry expansion exists.
- Existing DB/profile values are not rewritten. Reader/render policy is the compatibility boundary.
- CSP/nonce/global header enforcement and hosted browser verification remain the next SEC-10 phase.

This document records completion of the Browser Image-Origin Contract only. It does not claim SEC-10 CLOSED, CSP deployed, or Production verified.
