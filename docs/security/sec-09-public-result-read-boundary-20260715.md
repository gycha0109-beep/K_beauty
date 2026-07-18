# SEC-09 public report identifier and durable read guard

## Scope

This remediation protects public result reads without changing the existing public DTO boundary. It covers opaque share identifiers, durable read quotas, generic access outcomes, cache control, page loading, and owner-only unpublish. It does not access hosted Supabase, Preview, Production, providers, or external services.

## Share identifiers

New share IDs use `randomBytes(16)` encoded as canonical unpadded base64url: 16 bytes, 22 characters, and at least 128 bits of entropy. Existing 8-character, 6-byte legacy IDs remain readable. The common parser rejects padding, control characters, noncanonical encodings, non-base64url characters, unsupported lengths, and oversized input before the result lookup.

## Durable guard

The SEC-01 rate-window backend has an additive `result-read` endpoint. A request first consumes base principal and IP buckets, then validates the token, then adds a valid-token repeat bucket and consumes the complete plan through one RPC call. Invalid tokens consume the four base buckets but never query a result row.

| Principal | Burst | Sustained |
| --- | ---: | ---: |
| Authenticated user | 30 / 60 seconds | 600 / 24 hours |
| Signed anonymous principal | 20 / 60 seconds | 200 / 24 hours |
| Trusted client IP ceiling | 60 / 60 seconds | 1,000 / 24 hours |
| Principal plus valid share ID repeat | 12 / 60 seconds | - |

Principal values are HMAC namespaced with `ANALYSIS_REQUEST_GUARD_SECRET`; raw user IDs, anonymous subjects, IPs, and share IDs are not stored in quota rows or logged. Missing secrets, unsupported hosted proxy state, or quota/RPC errors fail closed with `503 result_read_guard_unavailable`. Quota exhaustion returns `429 result_read_rate_limited` with `Retry-After`.

## Proxy, oracle, and cache contract

Hosted Vercel paths accept only one exact `x-vercel-forwarded-for` value. `x-forwarded-for`, `x-real-ip`, Cloudflare, and Fly headers are ignored. Addresses are normalized before hashing; malformed values or multi-hop chains are rejected. External reverse proxies are unsupported pending an explicit trusted-proxy contract.

Malformed, private, missing, deleted, and unpublished results return the same generic 404 body. Public responses always use the Public DTO, including an owner reading a public row. All 200, 404, 429, and 503 result responses are `private, no-store, max-age=0` with CDN no-store headers.

The shared page is dynamic and renders a client loader only. It has no result query or quota charge in metadata or server rendering. One loader fetch performs one public API request; it does not retry aggressively. `GET` and `HEAD` each charge once, while `OPTIONS` performs neither quota consumption nor result access.

## Owner unpublish

Only a verified permanent account owner can send the exact `{ "isPublic": false }` PATCH payload. The route authenticates before parsing the body, performs an owner-scoped update, leaves the share ID and row content intact, and returns no-store headers. The next anonymous read receives the generic 404 response.

## Migration and verification

Migration: `supabase/migrations/20260715000000_sec_09_result_read_rate_limit.sql`.

SHA-256: `3FF38B6E7DAD556908E7B9310502F968E86496614EBA47551DBF6C24507E795E`.

Apply the migration before the application. Rollback restores the prior application first, removes only `result-read` quota rows, then restores the earlier endpoint constraint and RPC body. Existing `analyze` and `face-reading` data and behavior are retained.

Local evidence:

- Frozen SEC-09 verifier manifest: 57/57, with omission mutations fail-closed.
- Isolated pgTAP: 24/24.
- Concurrent consume: 5 allowed, 7 denied at the configured limit.
- Corrective migration reapplication and project-scoped cleanup: PASS.
- Shared-page targeted smoke, full `@smoke`, and production build: PASS.

## Residual deployment work

This is not a hosted deployment verification. Before enabling the migration on a hosted target, confirm the Vercel-only proxy contract and a safe staging target. Distributed IP abuse/WAF policy and the small malformed-versus-missing timing difference remain deployment residuals.
