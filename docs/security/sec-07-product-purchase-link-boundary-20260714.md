# SEC-07 product purchase-link boundary

## Scope

This remediation preserves existing `products.buy_link` data and evaluates it only at the application read boundary. It does not change product schema, migrations, crawler writers, link collection, link health checks, price collection, hosted Supabase, or external seller requests.

## Resolver contract

`lib/product-purchase-link.js` returns only one of these shapes:

- `direct`: an approved HTTPS product URL and a fixed registered source identifier.
- `fallback`: a deterministic Naver Shopping search URL built from normalized brand and product name.
- `none`: no direct URL and no usable search query.

The result has no raw input URL field. Direct URLs require a string below the length limit, no control characters, an absolute HTTPS URL, no userinfo, no non-default port, no trailing-dot hostname, and no localhost or IP literal. Hostname comparison uses the URL parser ASCII hostname and exact registered hosts only. A source hint can only narrow a matching registry entry.

## Registered direct links

- Olive Young: exact `oliveyoung.co.kr`, `www.oliveyoung.co.kr`, or `m.oliveyoung.co.kr` hosts and the product-detail path.
- Hwahae: exact `www.hwahae.co.kr` host and known `/goods/...` or `/products/<id>` product paths.
- Official stores: exact known product hosts for Anua, Beauty of Joseon, SKIN1004, Purito, Aestura, Dr.G, and Round Lab, bound to the normalized product brand.

Unregistered hosts, lookalikes, Unicode or punycode lookalikes, credential URLs, unsafe schemes, malformed URLs, and invalid direct paths do not render as direct links. CultBeauty, KoolSeoul, and `the-beautyofjoseon.store` are intentionally not registered.

## Fallback and response projection

Fallback uses the code-owned Naver Shopping base URL and a NFKC-normalized, trimmed, control-character-free, whitespace-collapsed brand plus product-name query. Empty brand and product names produce `none`. No lowest-price claim is used.

Product source normalization, `/api/analyze`, and `/api/full-report` all project direct links through the resolver. Before each analyze or full-report response leaves the server, a shared recursive serializer removes every purchase URL alias from every plain-object and array depth. It also rejects dangerous object keys, cycles, non-plain objects, and over-depth or oversized branches. Only explicitly recognized product-node paths are allowed to receive a resolver-owned canonical `buy_link`; unknown metadata, report-root, routine-step, and legacy fields never retain or promote a direct URL. The result pages use the same resolver at render time, so invalid or missing links fall back consistently. Purchase anchors use `target="_blank"` with `rel="noopener noreferrer"`. The public shared-result DTO does not expose `buy_link`.

## Verification and residual scope

`scripts/verify-sec07-product-link-boundary.mjs` executes the actual shared product, analyze, and premium-report projections. It exercises approved direct URLs, the attack matrix, source and brand mismatches, fallback encoding, `none`, nested and legacy raw-alias removal, unknown-location safe-URL removal, dangerous-key rejection, depth/size/cycle fail-closed behavior, API/page wiring, and public DTO omission. The related result-boundary verifier, JavaScript syntax checks, Playwright discovery and smoke tests, and production build are required before commit.

The SEC-07 verifier uses a frozen 42-ID required-case manifest and a separately fixed expected count. It validates the manifest and implemented ID catalog before execution, emits one machine-readable result per executed case, and validates the observed set after execution. Missing, duplicate, unknown, unobserved, or count-mismatched cases suppress the PASS marker and exit non-zero. Temporary omission controls cover a removed userinfo case, duplicate execution, unknown execution ID, an excluded defined case, expected-count mismatch, and a removed nested/legacy case.

No server-side fetch consumes a purchase URL in the current repository, so this change does not add an SSRF execution surface. Link liveness checks, seller inventory validation, automated ingestion validation, multi-seller selection, and periodic revalidation remain follow-up work. A separate commit gate is required before commit.

## Verifier source portability

The `response_wiring` case canonicalizes only source text used for multiline assertions, converting CRLF or lone CR line endings to LF. It still requires the concrete `getTrustedDirectPurchaseUrl({ buyLink: product.buy_link, ... })` projection rather than merely checking for a function name. The frozen 42-case manifest and expected count are unchanged. LF, CRLF, and indentation-only fixtures pass; removing that wiring call, deleting a required case, duplicate or unknown execution, a count mismatch, and an unobserved case all fail closed. Product resolver, serializer, routes, and registry data are unchanged.
