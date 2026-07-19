# Unified Vision Provider Smoke Final Revalidation - 2026-07-19

## 1. Previous FAIL

- Repository: `gycha0109-beep/K_beauty`
- PR: `#50`
- Branch: `design/unified-vision-observation-pipeline`
- Base: `codex/survey-input-contract-refactor`
- Previous smoke record: `b02bc15bd45f5be6c2530d8554a03217aa0db9df`
- Previous image-bearing Provider attempts: 1
- Previous blockers: missing predecessor `public.products`, Provider HTTP 401, Lane A not run, Lane B projections not verified
- The previous FAIL record remains in `unified-vision-provider-smoke-20260719.md`.

## 2. Execution HEAD

- Start HEAD: `b02bc15bd45f5be6c2530d8554a03217aa0db9df`
- Runtime changes after the previous smoke at start: none
- Code verification HEAD before this record: `06fcd26`
- PR state at start: open, Draft, mergeable, unmerged

## 3. Provider Gate

**PASS**

The development resolver selected `OPENAI_API_KEY` from `.env.local`. The configured value had no surrounding whitespace, quotes, or embedded line break, matched the OpenAI credential shape, and was not confused with the OpenRouter variable. The runtime endpoint was `https://api.openai.com/v1/chat/completions`, the model was `gpt-4o-mini`, and the local shadow Provider stub was disabled.

A single text-only request used the same endpoint, model, and resolver result:

| provider | model | HTTP | duration | classification | retry |
| --- | --- | ---: | ---: | --- | ---: |
| OpenAI | `gpt-4o-mini` | 200 | 2,090 ms | `authenticated` | 0 |

No image was attached. The response body and usage body were not retained, so token counts are not available for this probe. No key, key prefix, Authorization header, response body, or credential fingerprint was logged. The development diagnostics were hardened to remove key-prefix fields and fully redact key-shaped text.

## 4. DB Gate

**FAIL - `BLOCKED_BY_SCHEMA_UNCERTAINTY`**

An unlinked temporary Supabase workdir applied the 24 repository production migrations to a fresh local stack. No linked project reference, remote URL, remote mutation, shadow bootstrap, or synthetic product table was used.

`supabase start` failed in `20260410_safe_review_and_promotion_layer.sql` because `public.products` does not exist. The failure reproduced the previous smoke result.

Repository evidence confirms that the migration chain also assumes predecessor `product_candidates`, `source_rankings`, and later `recommendation_logs`. `supabase/local-shadow-test` is explicitly `SHADOW_TEST_STUB_ONLY`: its products types, simplified guard RPCs, RLS, seed, and missing objects do not match the production predecessor contract. The current predecessor design remains blocked because exact historical types, constraints, RLS/ACL, and untracked DDL provenance are unresolved.

Therefore no baseline migration, fake products table, reduced-column table, migration rewrite, or remote schema mutation was made. `supabase db reset`, relation/RPC SQL checks, and clean-reset replay cannot pass until an authoritative predecessor baseline exists.

## 5. Environment Changes

- Updated the analysis guard verifier to check the shared `analyzeVisionObservation()` call instead of removed direct Provider call markers.
- Removed OpenAI/OpenRouter key-prefix fields from development diagnostics.
- Changed diagnostic key masking to full redaction.
- Updated the Provider log verifier for the shared Provider service and removed a false-positive direct-log pattern.
- No migration, Supabase config, environment file, fixture, runtime Vision contract, projector, product logic, or deployment setting changed.

## 6. Static Validation

| command | result |
| --- | --- |
| `npm ci` | PASS; 2 existing audit findings reported (1 moderate, 1 high) |
| `npm run verify:unified-vision-pipeline` | PASS |
| `npm run face-lab:eval:verify` | PASS |
| `npm run architecture:guard` | PASS |
| `node scripts/verify-analysis-request-guard.mjs` | PASS after stale marker alignment |
| `node scripts/verify-provider-runtime-log-sanitization.mjs` | PASS |
| `node scripts/verify-anonymous-write-grant-v2.mjs` | PASS |
| `node scripts/verify-analysis-rls-contract.mjs` | PASS; deployment metadata checks remain separate |
| `npm run build` | PASS |
| `git diff --check` | PASS |

Validation ran in an isolated detached worktree at the same code HEAD. The temporary validation worktree was removed.

## 7. Lane B

**NOT RUN**

Phase C requires both Provider Gate and DB Gate to pass. DB Gate failed, so no fixture was read or transmitted and no canonical bundle, Skin KO/EN projection, Face Lab KO/EN projection, runtime quality, or cross-contamination judgment was produced.

## 8. Lane A

**NOT RUN**

The local database cannot provide the full analysis guard, anonymous write-grant, products, and route persistence contract on a clean reset. `/api/analyze` was not called and `/api/face-reading` was not called.

## 9. Token And Latency

- Text-only authentication probe: 2,090 ms; token counts unavailable because the response body was not retained.
- Image-bearing Provider calls in this revalidation: 0
- Image token/latency metrics in this revalidation: not applicable

## 10. Quality Review

Runtime Skin, Face Lab, KO/EN parity, partial evidence, and cross-contamination review were not performed because no image-bearing call was allowed. Static contract and projector verifiers passed but do not replace Provider runtime evidence.

## 11. Security And Privacy

- Production deployment and remote Supabase were not accessed or changed.
- No image, crop, base64, data URL, raw evidence, request body, response body, user identifier, credential, or Provider error body was persisted.
- Text-only and image-bearing calls were counted separately.
- Automatic, 429, timeout, network, and schema retries were all 0.
- Temporary Supabase logs/workdir and validation worktree were removed; local Supabase containers were stopped.

## 12. Cumulative Image Attempts

| execution | unique images | image-bearing attempts | retry |
| --- | ---: | ---: | ---: |
| Previous smoke | 1 | 1 | 0 |
| This revalidation | 0 | 0 | 0 |
| Cumulative | 1 | 1 | 0 |

## 13. Final Status

**BLOCKED**

Provider authentication is repaired, but the DB Gate remains blocked by the missing authoritative predecessor baseline. The final Provider smoke was correctly not started.

## 14. PR #50 Status

- Open: yes
- Draft: yes
- Merged: no
- Ready for review: no

## 15. Merge Decision

**Do not merge.** The required Lane B and Lane A runtime evidence is still absent.

## 16. Remaining Risks

1. Exact predecessor schema and migration chronology remain unresolved for a clean local reset.
2. Successful canonical JSON size, truncation behavior, image token usage, and success latency remain unverified against the real Provider.
3. Lane A's single-image Skin/Face Lab response, anonymous write-grant, guard completion, and sessionStorage compatibility remain runtime-unverified.
4. Lane B's KO/EN semantic parity, partial evidence quality, and cross-contamination remain runtime-unverified.

