# SEC-12 Error Response And Log Exposure Boundary

Date: 2026-07-17  
Branch: `feature/premium-beta-flow`  
Scope: local application implementation and verification. Preview, Production, remote Supabase, OAuth, and provider behavior are not verified.

## Finding And Scope

The original OWASP item was Low, but the implementation diagnosis found two Medium application findings and four Low findings:

- `/api/track` and `/api/my/save-report` could expose dependency or validation details in public JSON.
- server paths could log raw `Error` or Supabase objects, including `message`, `details`, `hint`, callback metadata, and identifiers.
- client code could emit raw caught objects to the browser console.
- nonproduction OpenAI diagnostics retained partial key fingerprints and user concern/safety diagnostics.
- sensitive response no-store behavior was inconsistent.
- log injection, hostile objects, and output size were not centrally bounded.

The implementation covered the 17 diagnosed production entry points and their shared server/client helpers. It did not add middleware, a global catch, a request ID, telemetry, a dependency, a schema change, or remote infrastructure.

## Data Classification

- **S0 public-safe:** frozen public codes, fixed generic copy, HTTP status, and fixed `Retry-After`.
- **S1 restricted operations:** frozen event, severity, operation, category, dependency, retryable flag, bounded status/duration/count, environment, provider, and model identifiers.
- **S2 identifiers and PII:** email, user/profile/report/share IDs, IP, user agent, Origin, Referer, callback URL, and URL query are excluded from public errors and application logs.
- **S3 credentials:** cookies, authorization, access/refresh/write-grant tokens, OAuth code, PKCE verifier, API/service-role/signing keys, signed URL credentials, and passwords are excluded in every environment.
- **S4 user and AI content:** images, base64/data URLs, prompts, completions, provider bodies, survey/concern/safety values, analysis/report/product payloads, and user text are excluded from error details and logs.
- **S5 implementation detail:** stacks, file paths, internal function/source text, SQL/schema/table/column/constraint details, Postgres details/hints, provider endpoints, framework digests, cause chains, and raw messages are excluded from public errors. Application logs retain fixed categories only.

## Central Boundary

`lib/security/error-redaction.js` is the pure authoritative boundary. It exports frozen public-code and structured-log registries plus:

- unknown-value classification that does not traverse or serialize the throwable;
- fixed public error creation and safe client-copy lookup;
- allowlisted structured event creation;
- CR/LF, Unicode separator, ANSI, C0, DEL, credential-pattern, email, IP, URL, and long base64/data-URL normalization;
- a 96-character text cap and 1,024-byte structured payload cap;
- hostile getter, hostile `toJSON`, circular value, nested cause, oversized input, Proxy-like access failure, and logger-sink isolation;
- exact sensitive no-store headers while preserving `Allow`, `Retry-After`, `Location`, `Set-Cookie`, and content type supplied by callers.

The structured logger accepts only fixed primitive fields. It never accepts a raw error, request, response, header collection, arbitrary metadata object, body, or cause. Development, test, Preview, and Production use the same content and credential restrictions.

The public-code registry is:

```text
analysis_unavailable, checkin_save_failed, forbidden, invalid_json,
invalid_payload, invalid_request, invalid_request_origin,
method_not_allowed, not_found, rate_limited, save_report_unavailable,
service_unavailable, signout_unavailable, tracking_unavailable,
unauthorized
```

The structured event/category registries contain only the fixed operations required by the audited callers. Unknown values become `client_operation_failed` and `internal_error` rather than being retained.

## Integration Changes

- `/api/track` now returns fixed validation/dependency codes, never raw validation or DB details, and logs only `tracking_failed` with a fixed category.
- `/api/my/save-report` returns fixed `save_report_unavailable` with generic copy on dependency failure and never returns or logs the Supabase error object.
- auth callback logs no user/profile ID, callback URL, redirect query, cookie inventory, OAuth metadata, or serialized error. Redirect status, location, and cookies are preserved.
- dashboard, premium-session, product-source, server/browser Supabase, profile, analysis, face-reading, full-report, result, check-in, and premium-access paths use fixed categorical events or fixed public responses.
- `lib/provider-runtime-log.js` is now a domain adapter over the central boundary. Provider and stage use exact registries; prompt, completion, image, request/response body, headers, endpoint, token, and nested error inputs cannot enter its descriptor or sink payload.
- OpenAI diagnostics now expose booleans or fixed categories only. Key prefix/suffix/fingerprint, source value, organization/project identifiers, and concern/safety diagnostic content are absent.
- the ten audited client entry points use generic copy and the central logger. Unknown server values are not rendered, logged, placed in URL query, or persisted to browser storage.

Sensitive responses in the audited route set carry exactly:

```text
Cache-Control: private, no-store, max-age=0
CDN-Cache-Control: no-store
Vercel-CDN-Cache-Control: no-store
```

SEC-09 oracle/cache behavior, SEC-10 CSP/nonce/headers, SEC-11 method/origin/cookie behavior, analysis quota/idempotency, image grants, and provider request payloads are unchanged.

## Verification

- Frozen SEC-12 manifest: `60/60 PASS` with exact catalog/manifest/observed sets and group counts `10/18/10/12/10`.
- Provider runtime-log verifier passed with hostile fields, CRLF, sink failure, and raw prompt/body/token rejection.
- OS TEMP mutation matrix: `28/28` rejected non-zero without the final PASS marker. During independent mutation work, three verifier gaps were found and fixed: provider descriptor prompt retention, one-level nested-cause access, and ANSI residual/partial route bypass detection.
- Local production SEC-12 targeted smoke passed `1/1`. A malformed track request returned only `{ success: false, error: "invalid_request" }`, status 400, exact no-store, and SEC-10 headers.
- A synthetic intercepted dependency response containing bearer, cookie, DB hint, prompt, and stack-path markers produced zero marker occurrences in result-page DOM, browser console, URL, localStorage, and sessionStorage. The browser emitted only an allowlisted security event.
- SEC-07 purchase-negative, SEC-10 header, SEC-10 image, and SEC-11 signout targeted tests each passed `1/1`; full `@smoke` passed `7/7`.
- The local production process log contained zero synthetic markers, bearer/cookie patterns, or stack/file-path patterns. The malformed request produced no server error event, so structured event shape and sink behavior are proven by the direct pure-helper and provider-adapter executions rather than claimed from that process log.
- SEC-07 `42/42`, SEC-08 `55/55`, SEC-09 `57/57`, SEC-10 image `44/44`, SEC-10 headers `60/60`, SEC-11 `40/40`, auth-origin, response, request-guard, RLS, premium, anonymous-write, provider-log, and analyze no-write verifiers passed.
- Next.js `15.5.18` production build and Playwright discovery passed. Remote services and external URLs were not contacted.

## Modified File Allowlist

The exact implementation set contains 36 files: three new SEC-12 files, work log, Playwright, five policy/verifier files, sixteen server/API files, and ten client files. Package files, DB/migrations, `middleware.js`, `next.config.js`, auth provider configuration, SEC-09 quota/oracle code, SEC-10 policies, and SEC-11 signout contracts are outside the diff.

## Residuals

- Vercel retention/access control, platform stack serialization, environment masking, source-map behavior, default hosted error pages, unhandled rejection formatting, Edge platform logs, and Preview log access require hosted verification.
- Actual provider SDK and remote Supabase stdout/stderr behavior were not exercised.
- The local Next startup banner prints local/network listener addresses; this is framework process output, not application structured logging, and hosted platform treatment remains unverified.
- No claim is made that Preview, Production, Vercel logs, remote Supabase, OAuth, provider execution, or every platform-level stack path is verified.

This document records local application implementation only. SEC-12 is not deployed or hosted-verified by this work.

## Model Credential And Analyze Stage Correction (2026-07-18)

An independent gate found two additional accuracy gaps in the local application boundary. The structured logger accepted any short model-like string, which could preserve an API key, JWT, bearer value, or an unregistered provider model in the `model` field. The analyze route also discarded raw payloads but mapped unrelated diagnostic and fallback stages to an undifferentiated failure event, making the sanitized logs inaccurate.

The correction keeps one authoritative exact model registry in `lib/security/error-redaction.js`: `gpt-4o` and `gpt-4o-mini`. Only an exact match is retained. Unknown, case-variant, custom, credential-shaped, oversized, control-character, CR/LF, and ANSI-bearing values are omitted by the central event builder. The provider adapter may expose the fixed descriptor value `unknown`, but its structured sink does not retain that adapter fallback as an approved model. There is no environment or caller hint that widens the registry.

The analyze logger now accepts only a stage key and resolves it through a frozen 14-stage policy registry. Non-blocking capture and environment diagnostics use fixed `analysis_diagnostic` events with `runtime_state` or `configuration_state`; provider fallbacks use fixed `analysis_failed/provider_unavailable`; response-shape diagnostics use `analysis_diagnostic/response_shape_invalid`; guard, product-source, and request failures retain their fixed failure categories and severities. Unknown stages fail closed to a fixed internal failure event. No reason, error object, response shape, environment diagnostic object, DB code, provider body, prompt, completion, concern, safety value, stack, path, or raw stage string is accepted by `logAnalyze`.

The frozen SEC-12 manifest was extended without removing the original 60 cases. It now passes `62/62` with two executed cases covering exact model credential rejection and the complete analyze stage/severity contract. The provider runtime-log verifier imports the same registry and independently rejects unregistered and credential-shaped model values. OS TEMP mutation verification passed `30/30` fail-closed: the original 28 controls plus a permissive model predicate and an inaccurate stage mapping. A mutation run exposed one verifier-only shorthand-property gap (`error,`); the logger-argument audit was tightened and the full matrix then passed. TEMP residue was removed.

Fresh local verification passed the SEC-12 `62/62` verifier, the provider runtime-log verifier, SEC-07 `42/42`, SEC-08 `55/55`, SEC-09 `57/57`, SEC-10 image `44/44`, SEC-10 headers `60/60`, SEC-11 `40/40`, and the related auth-origin, response, request-guard, RLS, premium, anonymous-write, and analyze no-write checks. Playwright discovery found 13 tests; SEC-12, SEC-11, SEC-10 headers, SEC-10 image, and SEC-07 purchase-negative targeted tests each passed `1/1`, and full `@smoke` passed `7/7`. Next.js `15.5.18` production build passed.

No provider, remote Supabase, OAuth, Preview, Production, or external URL was called. Hosted Vercel log serialization and retention, actual provider SDK output, remote Supabase errors, and platform-generated stack behavior remain deployment residuals. This correction does not claim SEC-12 deployment or hosted verification.

## No-Store Verifier Fail-Open Correction (2026-07-18)

An independent gate found that the prior `P09_NO_STORE_EXACT` assertion derived both expected and actual values from `SENSITIVE_NO_STORE_HEADERS`. Deleting all three entries therefore produced an empty loop while `P09`, `I10`, and the final `62/62` marker still passed. `I10` additionally proved only that route files contained a helper call string; it did not bind an independently known header contract to the actual response construction.

The verifier now owns an immutable expected contract that is independent from production code: exactly three entries, with `Cache-Control: private, no-store, max-age=0`, `CDN-Cache-Control: no-store`, and `Vercel-CDN-Cache-Control: no-store`. The expected count is the literal `3`; the expected registry is not derived from or aliased to the production registry or helper output. `P09` first enforces exact count, duplicate rejection, missing/extra exact-set equality, and exact values, then verifies both the production registry and the `Headers` instance returned by `createNoStoreHeaders()`.

The direct P09 matrix exercised 16 inputs. Only the exact three-entry contract passed. Empty object, empty array, null, undefined, each individual omission, all-three omission, extra entry, duplicate representation, key-case drift, value-whitespace drift, and each wrong value failed. Four additional TEMP wrong-value/extra-header mutations also exited non-zero without a final PASS marker.

`I10_SENSITIVE_ROUTE_NO_STORE` now discovers and verifies an exact 11-route integration inventory:

1. `app/api/analyze/route.js`
2. `app/api/face-reading/route.js`
3. `app/api/full-report/route.js`
4. `app/api/full-report/session/route.js`
5. `app/api/my/check-in/route.js`
6. `app/api/my/dashboard/route.js`
7. `app/api/my/save-report/route.js`
8. `app/api/premium/access/route.js`
9. `app/api/results/route.js`
10. `app/api/track/route.js`
11. `app/auth/callback/route.js`

Expected, recursively discovered, and response-integrated sets are `11/11/11`. Eight routes call a named JSON wrapper that is lexically tied to `NextResponse.json`; full-report session and premium access attach the helper to direct JSON responses; auth callback attaches it to its redirect helper. Import-only or dead helper text does not satisfy the integration assertion. Every verified integration is also checked against the independent three-header contract.

The frozen SEC-12 case manifest remains `62` with no case ID removed or renamed. Fresh execution passed `62/62`. The existing mutation matrix passed `30/30` fail-closed, and four new production-registry deletion mutations independently removed Cache-Control, CDN-Cache-Control, Vercel-CDN-Cache-Control, and all three; each exited non-zero without the final PASS marker. The authoritative combined result is `34/34 rejected`.

Local production runtime verified the exact three no-store headers on malformed track, invalid analyze, malformed results, malformed full-report, malformed face-reading, foreign-Origin signout, and missing-code auth callback responses while preserving their existing statuses, content types, redirect location, and SEC-10 headers. The SEC-12 Playwright targeted case passed `1/1` and directly asserted all three headers on the malformed track response. SEC-11, SEC-10 headers, SEC-10 image, and SEC-07 purchase targeted cases each passed `1/1`; full `@smoke` passed `7/7`; Next.js `15.5.18` production build and 30 JavaScript/MJS syntax checks passed.

Fresh SEC-07 `42/42`, SEC-08 `55/55`, SEC-09 `57/57`, SEC-10 image `44/44`, SEC-10 headers `60/60`, SEC-11 `40/40`, provider logging, auth-origin, response, request-guard, RLS, premium, anonymous-write, and analyze no-write verifiers passed. The legacy SEC-06 exact-string verifier failed identically at HEAD and in the working tree because it still requires `authoritativePremiumReport = updateResult.payload.premiumReport`; this is a pre-existing verifier residual, is outside this three-file correction, and is not counted as a SEC-12 pass.

No production source, Playwright spec, package, dependency, database, migration, middleware, Next configuration, `.gitignore`, or private fixture was changed by this correction. No remote Supabase, OAuth, provider, external URL, Preview, or Production target was used. Hosted platform logging and no-store behavior remain deployment residuals. No stage, commit, or push was performed.

## I10 Exported Handler Response-Path Binding Correction (2026-07-18)

An independent mutation disproved the preceding I10 claim that dead helper text could not satisfy the integration assertion. In an OS TEMP copy, `app/api/track/route.js` retained a standalone `createNoStoreHeaders();` call while the returned response used unverified `init.headers`; the previous verifier still printed `62/62 PASS`. Production responses remained correct, but the verifier did not bind helper use to the exported handler's terminal response path.

I10 now parses JavaScript with the parser bundled by the installed Next.js `15.5.18`; no dependency was added. It builds a bounded module and control-flow model from each frozen route, resolves the exported HTTP handler, follows local wrappers and response variables, and verifies the headers argument on every reachable terminal `NextResponse.json`, `NextResponse.redirect`, `Response.json`, or `new Response` path. Import-only calls, standalone calls, ignored wrapper results, unused assignments, post-return calls, constant-false branches, uncalled wrappers, overwritten headers, ambiguous spreads, dynamic wrappers, unresolved aliases, cycles, and mixed safe/unsafe paths fail closed. Imported helpers are not trusted generically: only the frozen analysis-guard response factory and its exact cookie pass-through wrapper are admitted after their source contracts are checked.

The frozen inventory is now measured at three levels: routes `11/11/11`, exported handler bindings `12/12/12`, and terminal response nodes `120/120/120`. Dead helper calls, unsafe response paths, and unresolved response paths are all zero. A direct pure matrix passed both positive forms and rejected all `16/16` negative forms. The SEC-12 required case IDs and count remain unchanged at `62`; fresh execution passed `62/62`.

The existing mutation set was re-executed and rejected `34/34`. Mutation 35 reproduced the exact dead-call bypass and was rejected non-zero without the final PASS marker, giving an authoritative combined result of `35/35 rejected`. Fresh related verifiers passed: provider logging, SEC-07 `42/42`, SEC-08 `55/55`, SEC-09 `57/57`, SEC-10 image `44/44`, SEC-10 headers `60/60`, SEC-11 `40/40`, auth-origin, response, request-guard, RLS, premium, anonymous-write, and analyze no-write. Changed JavaScript/MJS syntax checks passed `28/28`.

Local production runtime rechecked malformed track, invalid analyze, malformed results, malformed full-report, malformed face-reading, foreign-Origin signout, and missing-code auth callback responses. Their existing statuses were `400`, `500`, `400`, `400`, `500`, `403`, and `307`; all seven carried the exact three no-store headers and SEC-10 headers. Captured process output contained only fixed categorical security events for the intentional analyze and face-reading failures, with zero synthetic marker, bearer, JWT, cookie, service-role, API-key, or stack-path matches. SEC-12, SEC-11, SEC-10 headers, SEC-10 image, and SEC-07 purchase targeted Playwright cases each passed `1/1`; full `@smoke` passed `7/7`; the Next.js `15.5.18` production build passed.

The legacy SEC-06 exact-string verifier still fails identically at HEAD and in the working tree on its stale premium-persistence marker. It was not changed or counted as a SEC-12 pass. No production source, Playwright spec, package, dependency, database, migration, middleware, Next configuration, `.gitignore`, private fixture, remote service, external URL, stage, commit, or push was involved in this correction. Hosted platform behavior remains unverified.
