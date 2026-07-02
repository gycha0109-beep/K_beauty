# AI_WORK_LOG.md

### 2026-07-02 / survey input contract UI supplement v1

- Branch: codex/survey-input-contract-refactor
- Task type: execution / Medium survey UI and form contract supplement
- Routing decision: User requested the first UI refactor to address runtime-audit contract gaps: explicit `primaryConcern`, `recentSkinChange`, `recentlyChangedProduct`, and sunscreen answered/skipped metadata. DB/schema/migration, recommendation ranking, Functional Plan UI, premium/currentProducts storage, product recommendation logic, API response exposure, raw dev audit storage, and photo analysis were out of scope.
- Goal: Add contract-only survey inputs, include them in the form payload and `/api/analyze` normalized form, update `SurveyInputContract` normalization, and extend verifier/audit fixtures while keeping legacy response/storage behavior intact.
- Changed files: components/onboarding/SurveyFlow.js, components/onboarding/constants.js, app/page.js, app/api/analyze/route.js, lib/survey-input-contract.js, scripts/verify-survey-input-contract.mjs, scripts/audit-survey-input-contract-against-free-result.mjs, docs/architecture/survey-input-contract.md, tmp/survey-input-contract-audit/summary.json, tmp/survey-input-contract-audit/summary.md, .codex/AI_WORK_LOG.md
- Protected areas: No DB/schema/migration/policy, recommendation ranking engine implementation, Functional Plan UI wiring, premium report storage structure, currentProducts storage structure, product recommendation logic, API response `surveyInputContract` exposure, dev audit raw form/image/gender storage, photo analysis logic, auth/payment/deploy/env, or production data changes.
- Validation: `node scripts/verify-survey-input-contract.mjs` passed with the existing Node MODULE_TYPELESS_PACKAGE_JSON warning. `node scripts/audit-survey-input-contract-against-free-result.mjs` passed and rewrote fixture audit summaries. `npm run build` passed. `git diff --check` passed with LF-to-CRLF warnings only.
- Issues/risks: New fields are now included in the submitted survey form and session survey snapshot for compatibility with future contract work, but API response and recommendation output remain unchanged. Runtime audit should be rerun next to confirm fallback/ambiguity rates drop in real UI submissions.
- Context promotion candidate: Keep legacy free-result `mainConcern` compatibility separate from contract `primaryConcern` until ranking is explicitly migrated.

### 2026-07-02 / survey input contract runtime audit sample fill

- Branch: codex/survey-input-contract-refactor
- Task type: verification / Medium runtime audit sampling
- Routing decision: User requested development-only E2E/API sampling to fill `SurveyInputContract` runtime audit data through real `/api/analyze` calls, with no UI, API response, storage payload, DB/schema, ranking, Functional Plan, free-result logic, or premium storage changes.
- Goal: Start the local dev server, use browser automation/Playwright to load localhost, submit 10 distinct multipart `/api/analyze` survey scenarios with the project test image, verify response success, generate runtime audit summaries, and analyze contract/runtime mismatches.
- Changed files: tmp/survey-input-contract-runtime-audit/events.jsonl, tmp/survey-input-contract-runtime-audit/e2e-run-results.json, tmp/survey-input-contract-runtime-audit/summary.json, tmp/survey-input-contract-runtime-audit/summary.md, .codex/AI_WORK_LOG.md
- Protected areas: No UI, survey question additions/deletions, API response field names, saved payload structure, DB/schema/migration/policy, recommendation ranking, Functional Plan UI, premium report storage, production runtime file write, raw form storage, image data storage, or gender preference audit storage.
- Validation: Dev server ran on `http://localhost:3001`. `agent-browser` CLI was unavailable on PATH, so Playwright was used. All 10 `/api/analyze` calls returned 200. Runtime audit `events.jsonl` contains 10 events. `node scripts/summarize-survey-input-contract-runtime-audit.mjs` passed and wrote summary JSON/MD. API responses contained no `surveyInputContract`, `contract`, or `debugContract` fields. `git diff --check` passed with LF-to-CRLF warnings only.
- Findings: `unresolvedPrimaryConcern` was 10/10 because `/api/analyze` still passes no explicit `primaryConcern` into the contract and falls back to `mainConcerns[0]`. Warnings were `primaryConcern_missing_fallback_used` 10/10 and `sunscreen_boolean_false_ambiguous` 10/10. Missing fields were `recentSkinChange` 10/10 and `recentlyChangedProduct` 10/10. Primary concern and existing priority diverged in `pores_oil_outdoor_whitecast` and `acne_redness_sensitive`, both due to scoring/safety signals overriding the first selected concern.
- Context promotion candidate: Before wiring the contract into ranking, add an explicit primary concern/goal input and answered-state metadata for sunscreen booleans; keep safety risks separate from user-stated concerns because scoring can legitimately promote redness/barrier/UV/oiliness beyond selected concerns.

### 2026-07-02 / survey input contract dev runtime audit collector

- Branch: codex/survey-input-contract-refactor
- Task type: execution / Medium development-only API audit collector
- Routing decision: User requested a scoped development-only collector for `SurveyInputContract` summaries generated inside `/api/analyze`. UI changes, survey question changes, API response changes, saved payload changes, DB/schema work, ranking integration, Functional Plan UI wiring, free-result logic changes, premium storage changes, and production file writes were explicitly out of scope.
- Goal: Append sanitized contract summary events to `tmp/survey-input-contract-runtime-audit/events.jsonl` during development, provide a local summary script, and keep production as no-op.
- Changed files: app/api/analyze/route.js, lib/survey-input-contract-dev-audit.js, scripts/verify-survey-input-contract.mjs, scripts/summarize-survey-input-contract-runtime-audit.mjs, docs/architecture/survey-input-contract.md, tmp/survey-input-contract-runtime-audit/summary.json, tmp/survey-input-contract-runtime-audit/summary.md, .codex/AI_WORK_LOG.md
- Protected areas: No UI, survey question additions/deletions, API response field names, stored payload structure, DB/schema/migration/policy, recommendation ranking, Functional Plan UI, premium report storage, auth/payment/deploy/env, production data, raw form storage, image data storage, or gender preference audit storage.
- Validation: `node scripts/verify-survey-input-contract.mjs` passed with the existing Node MODULE_TYPELESS_PACKAGE_JSON warning. `node scripts/audit-survey-input-contract-against-free-result.mjs` passed and rewrote the fixture audit summaries. `node scripts/summarize-survey-input-contract-runtime-audit.mjs` passed with zero runtime events and wrote summary JSON/MD. `npm run build` passed. `git diff --check` passed with LF-to-CRLF warnings only.
- Issues/risks: Runtime audit summaries remain local tmp artifacts only. The summary report is empty until real development `/api/analyze` requests append events. Existing route logs outside the new collector were not changed.
- Context promotion candidate: Development audit collectors for survey contracts must store sanitized summary-only JSONL, no raw form/image/profile data, and must no-op in production.

### 2026-07-02 / survey input contract api analyze parallel generation

- Branch: codex/survey-input-contract-refactor
- Task type: execution / Medium API-internal survey contract audit hook
- Routing decision: User requested a runtime validation-only step inside `/api/analyze` that builds `SurveyInputContract` from the normalized form without UI changes, survey question changes, API response changes, saved payload changes, DB/schema work, ranking integration, Functional Plan UI wiring, free-result logic changes, or premium storage changes.
- Goal: Generate `SurveyInputContract` beside the existing free analysis path for development-only audit logging, while preserving the existing `freeResult`, premium session report, cookies, headers, and response JSON shape.
- Changed files: app/api/analyze/route.js, scripts/verify-survey-input-contract.mjs, docs/architecture/survey-input-contract.md, .codex/AI_WORK_LOG.md
- Protected areas: No API response field names, stored payload structure, DB/schema/migration/policy, UI, survey questions, recommendation ranking, Functional Plan UI, premium report storage, auth/payment/deploy/env, or production data were changed.
- Validation: `node scripts/verify-survey-input-contract.mjs` passed with the existing Node MODULE_TYPELESS_PACKAGE_JSON warning. `node scripts/audit-survey-input-contract-against-free-result.mjs` passed and rewrote the tmp audit summaries. `npm run build` passed. `git diff --check` passed with LF-to-CRLF warnings only.
- Issues/risks: The audit hook intentionally runs only when `NODE_ENV === "development"` and logs a summary rather than the raw contract. Production does not create or log this dev-only contract. Existing `/api/analyze` logs outside this hook were not changed.
- Context promotion candidate: Runtime contract validation should stay summary-only and response/storage-neutral until a separate task explicitly wires the contract into ranking or premium policy.

### 2026-07-02 / survey input contract parallel audit

- Branch: codex/survey-input-contract-refactor
- Task type: verification / Medium survey contract parallel audit
- Routing decision: User requested a validation-only step that generates `SurveyInputContract` from local fixture forms and audits it against existing free-result priority/scoring expectations without UI wiring, ranking integration, API response changes, saved payload changes, or DB/schema work.
- Goal: Add a local audit script that compares current form fixtures, `buildSurveyInputContract(form)`, legacy-style freeResult priority/scoring, contract primary/secondary concerns, safety risks, warnings, and missing fields.
- Changed files: scripts/audit-survey-input-contract-against-free-result.mjs, tmp/survey-input-contract-audit/summary.json, tmp/survey-input-contract-audit/summary.md, lib/survey-input-contract.js, .codex/AI_WORK_LOG.md
- Protected areas: No UI, survey question additions/deletions, API response or request payload shape, stored payload structure, DB/schema/migration/policy, ranking implementation, Functional Plan UI connection, premium save structure, external API call, image analysis call, or Supabase write.
- Validation: `node scripts/verify-survey-input-contract.mjs` passed with the existing Node MODULE_TYPELESS_PACKAGE_JSON warning. `node scripts/audit-survey-input-contract-against-free-result.mjs` passed and wrote summary JSON/MD. `npm run build` passed. `git diff --check` passed with LF-to-CRLF warnings only, including ignored tmp summaries via forced intent-to-add.
- Issues/risks: The audit did not import the live free-result engine because that path is tied to app alias/product-source imports; instead it uses a local survey/environment scoring mirror copied from `lib/skin-match-decision-engine.js` rules with photo score fixed at zero. The dry/dehydration fixture shows barrier as a high secondary score not present in contract concerns, which is expected from skinType/post-wash weighting and should be considered when later mapping safety/supporting goals.
- Context promotion candidate: Before runtime integration, compare contract goals against both priority axis and high secondary concern scores; high safety/supporting axes can be absent from explicit concerns and still matter.

### 2026-07-02 / survey input contract adapter

- Branch: codex/survey-input-contract-refactor
- Task type: execution / Medium pure survey contract adapter
- Routing decision: User requested only a pure current-form-to-`SurveyInputContract` adapter plus Node verification script. UI changes, survey question changes, `app/page.js`, `SurveyFlow`, API payload changes, DB/schema/migration changes, recommendation ranking, Functional Plan UI wiring, premium saved payload changes, and package config changes were out of scope.
- Goal: Add `buildSurveyInputContract(form, options)` that normalizes current survey fields into `skinState`, `goals`, `safety`, `behavior`, `preferences`, `sunscreen`, `profile`, and `metadata` without connecting it to runtime flows.
- Changed files: lib/survey-input-contract.js, scripts/verify-survey-input-contract.mjs, .codex/AI_WORK_LOG.md
- Protected areas: No UI, API response/request shape, stored payload structure, DB/schema/migration/policy, ranking engine behavior, Functional Plan UI, premium report storage, auth/payment/deploy/env, or package changes.
- Validation: `node scripts/verify-survey-input-contract.mjs` passed with the existing Node MODULE_TYPELESS_PACKAGE_JSON warning for ESM `.js` imports. `npm run build` passed. `git diff --check` passed with LF-to-CRLF warnings only.
- Issues/risks: The adapter can only warn about current optional default ambiguity; it cannot know whether default-looking optional values were skipped or explicitly selected until the UI supplies answered/skipped metadata.
- Context promotion candidate: Keep `genderPreference` profile/eligibility-only and keep sunscreen false booleans marked ambiguous until the survey captures explicit answered state.

### 2026-07-02 / survey input contract audit

- Branch: codex/survey-input-contract-refactor
- Task type: design / Medium survey input contract audit
- Routing decision: User requested a pre-UI-refactor investigation and contract draft only. UI changes, DB/schema/migration changes, ranking implementation, Functional Plan UI wiring, saved payload shape changes, and question add/delete implementation were out of scope.
- Goal: Audit the current 11-question survey field/value inventory, free/premium payload flow, scoring/priority generation, sunscreen and gender field handling, photo/no-photo behavior, and currentProducts premium entry linkage; propose a future `SurveyInputContract` split into skinState, goals, safety, behavior, preferences, sunscreen, profile, and metadata.
- Changed files: docs/architecture/survey-input-contract.md, .codex/AI_WORK_LOG.md
- Protected areas: No UI, API response field names, DB/schema/migration/policy, storage payload structure, recommendation ranking, current-products policy, premium UI connection, auth/payment/deploy/env, or package changes.
- Validation: `git diff --check` passed with LF-to-CRLF warnings only. Build was not run because this is a documentation-only change.
- Issues/risks: Current optional survey defaults erase skipped/unknown state; current free result does not expose `answers`, so premium current-products verdicts entered after free analysis lose full survey context; no-photo analysis is not currently implemented.
- Context promotion candidate: Survey contracts should preserve skipped/unknown state separately from legacy defaults before feeding ranking, functional decisions, or premium current-product policy.

### 2026-06-30 / premium beta flow

- Branch: feature/premium-beta-flow
- Task type: execution / High premium access, private save, and My reopen flow
- Routing decision: User requested implementation after a read-only audit of free CTA -> premium route -> login/access -> current products -> full-report API -> saved_reports -> My latest reopen, while excluding payment integration, DB migrations, public premium sharing, Face Lab generation, scoring/ranking, My diary/check-in, and protected production data.
- Goal: Let beta-open account users create a premium report from the free result, choose current products before opening it, save the premium snapshot privately, and reopen the latest premium report from My without requiring creation entitlement for existing reports.
- Changed files: app/api/full-report/route.js, app/api/premium/access/route.js, app/result/full-report/page.js, app/result/page.js, components/my/MyDashboard.jsx, components/result/free-v2/FreeResultV2PremiumPreviewStep.jsx, docs/architecture/premium-beta-flow-v1.md, lib/my/dashboard.js, lib/premium-access.js, lib/premium-current-products.js, .codex/AI_WORK_LOG.md
- Protected areas: No payment provider integration, DB schema/migration, public premium share route, Face Lab algorithm/prompt/input contract, recommendation scoring/ranking, current-products verdict policy, My diary/check-in/trend feature, auth callback policy, or product metadata rewrite.
- Validation results: `npm run build` passed. `git diff --check` passed with LF-to-CRLF warnings only. Local dev smoke on port 3002 verified `/result/full-report` at 390px shows the current-products premium entry with horizontal overflow false, `/result/full-report?access=payment_required` shows the official-open notice, and console/page errors were 0 in the smoke. `/api/premium/access` unauthenticated returned `login_required` with default `beta_open`; a separate dev server with `PREMIUM_RELEASE_MODE=paid_only` returned `login_required` and `paid_only`. Free `/api/analyze` returned 200 without public `premiumReport`, `faceLabSummary`, or `faceLab`.
- Notes/risks: Premium creation access is server-enforced in `/api/full-report`; saved premium reopen is owner-only through `saved_reports.user_id` and does not call the creation access resolver. Entitlement currently uses trusted Supabase `app_metadata` because no existing paid entitlement table was found. Full account-login E2E save/reopen and paid/admin entitlement E2E were not completed because no non-anonymous test account/session was available in this workspace.
- Context promotion candidate: Premium creation gating and saved premium reopen permission are separate: release mode blocks new generation only, while owner saved reports remain reopenable.

### 2026-06-30 / premium beta preview copy follow-up

- Branch: feature/premium-beta-flow
- Task type: execution / Medium premium preview UI state correction
- Routing decision: User requested a scoped preview UI correction on the existing premium beta branch. Access resolver, premium save, currentProducts verdict logic, payment, DB schema, and stored premium reopen permission were out of scope except for reusing the existing route.
- Goal: Remove the stale coming-soon/disabled paid-report preview state from the free result and show an active Premium Beta CTA that enters the existing premium route.
- Changed files: app/result/full-report/page.js, components/result/free-v2/FreeResultV2PremiumPreviewStep.jsx, .codex/AI_WORK_LOG.md
- Protected areas: No payment integration, DB migration, access resolver rewrite, premium save rewrite, currentProducts verdict policy, Face Lab logic, recommendation/scoring, or My saved-report reopen logic changes.
- Validation results: Initial `npm run build` failed because `useSearchParams()` in `app/result/full-report/page.js` needed a Suspense boundary after the previous branch implementation. Added a Suspense fallback around `FullReportPageContent`; rerun `npm run build` passed. `git diff --check` passed with LF-to-CRLF warnings only. Fresh dev server on port 3005 verified actual `/result` after seeding a real result session: step 5 shows `PREMIUM BETA`, active `이 결과를 루틴으로 정리하기`, no `곧 공개 예정` / `준비 중입니다` / `Coming soon`, disabled button count 0, horizontal overflow false, console/page errors 0. CTA click while logged out opens Google OAuth with `next=/result/full-report`; direct `/result/full-report` at 390px shows currentProducts entry, overflow false, console/page errors 0. `/result/full-report?access=payment_required` shows the paid-only beta-ended copy.
- Notes/risks: Non-anonymous login E2E remains unverified in this workspace, as noted in the parent premium beta flow log.
- Context promotion candidate: NULL

### 2026-06-30 / local auth redirect origin guard

- Branch: feature/premium-beta-flow
- Task type: diagnostic execution / auth redirect origin consistency
- Routing decision: User reported that logged-in local flows were ending on the Vercel deployment origin. The task was scoped to diagnosis and minimum code changes, with Supabase Dashboard, Google OAuth settings, DB migrations, premium access policy, and payment out of scope.
- Goal: Ensure client-started Google OAuth redirects are built only from the current browser origin so localhost flows do not fall back to `NEXT_PUBLIC_SITE_URL`.
- Changed files: app/result/page.js, components/auth/LoginButtons.jsx, components/result/SaveReportCTA.jsx, .codex/AI_WORK_LOG.md
- Protected areas: No Supabase URL configuration, Google OAuth configuration, DB schema/migration, premium access resolver, currentProducts, saved report, or API response contract changes.
- Validation results: `npm run build` passed. `git diff --check` passed with LF-to-CRLF warnings only. Static search now shows client OAuth helpers no longer read `NEXT_PUBLIC_SITE_URL`; only `app/layout.js` uses it for metadata. A direct Supabase OAuth URL generated from local env includes `redirect_to=http://localhost:3001/auth/callback?next=%2Fresult` and does not include the Vercel host. However, actual in-app browser login from `http://localhost:3001/result` still returns to `https://k-beauty-two.vercel.app/?code=...`, which indicates Supabase Auth is rewriting/rejecting the localhost callback outside app code.
- Notes/risks: Code now removes the `NEXT_PUBLIC_SITE_URL` fallback from client OAuth redirect origin helpers. The remaining localhost-to-Vercel redirect is not fixed by code because the app is already sending `redirect_to=http://localhost:3001/auth/callback`; Supabase must allow that callback URL for local login E2E to complete.
- Context promotion candidate: NULL

### 2026-06-29 / free analysis loading layout

- Branch: feature/free-analysis-loading-layout
- Task type: execution / Medium onboarding loading layout fix
- Routing decision: User requested a scoped loading-only layout adjustment after clean main sync and branch creation. Survey flow, analysis API, result rendering, Face Lab, premium report, My Skin, auth, recommendation logic, score formula, DB, and migrations were out of scope.
- Goal: Center the free analysis loading card in the header-adjusted viewport, remove the nested card visual from the spinner, and keep spinner, loading title, helper text, and progress dots in one clear waiting panel.
- Changed files: app/page.js, components/onboarding/LoadingStep.js, .codex/AI_WORK_LOG.md
- Protected areas: No API route, SurveyFlow, free result, full report, My Skin, auth, recommendation engine, DB/schema, Face Lab, or analysis state/response logic changes.
- Validation results: `npm run build` passed. `git diff --check` passed with LF-to-CRLF warnings only. Playwright verified the `/en` onboarding flow at 390px and desktop widths: loading card sits near viewport center below the header, spinner/title/body/dots render, nested loading card count is 0, horizontal overflow false, console/page errors 0, and mocked analysis completion navigates to the result page. A real local `/api/analyze` POST returned 200 and preserved the expected free result response shape.
- Notes/risks: Loading viewport uses `100svh` plus a loading-only flex wrapper so mobile browser chrome changes are less jumpy than fixed margins.
- Context promotion candidate: NULL

### 2026-06-29 / premium Face Lab section

- Branch: feature/premium-face-lab-section
- Task type: execution / Medium premium report companion-section connection
- Routing decision: User requested a scoped paid full-report Face Lab section and data contract while explicitly excluding `/api/face-reading` algorithm/prompt/input changes, Skin Match survey/result calculation changes, recommendation/product/payment changes, and DB schema migration.
- Goal: Add a premium-safe Face Lab adapter and full-report section that renders existing image + locale based Face Lab results when available and shows a quiet fallback for missing or legacy premium reports.
- Changed files: app/api/analyze/route.js, app/api/full-report/route.js, app/result/full-report/page.js, components/full-report/PremiumFaceLabSection.jsx, docs/architecture/premium-face-lab-contract-v1.md, lib/premium-face-lab.js, .codex/AI_WORK_LOG.md
- Protected areas: No `/api/face-reading` algorithm, prompt, or input contract changes. No Skin Match survey, priority/score generation, recommendation scoring/ranking, Top Pick/supportingProducts, sunscreen scoring, currentProductVerdicts, functionalDecisions, conditionResponses, payment flow, DB schema/migration, image upload flow, or free result UI changes.
- Validation results: `npm run build` passed. `git diff --check` passed with existing LF-to-CRLF warnings only. Playwright at 390px verified `/en/test-full-report` Face Lab available fixture renders image, title/summary, 4 keywords max, 3 style directions max, no horizontal overflow, no undefined text, no purchase/price/store copy, no banned medical/fortune/personality words, console errors 0, page errors 0. Playwright at 390px verified an `/en/result/full-report` legacy/missing Face Lab fixture shows the quiet unavailable fallback, no broken images, no undefined text, other full-report shell still renders, no horizontal overflow, console errors 0, page errors 0. Free `/api/analyze` POST returned 200 without `premiumReport`, `faceLabSummary`, `faceLab`, or paid-only decision fields in the public JSON.
- Notes/risks: Saved premium report requery was verified by code path: `premium_report_sessions.premium_report.faceLabSummary` is sanitized when present, old `faceLab` payloads can be adapted, and missing legacy fields fall back to unavailable. Current authenticated E2E save/requery was not run. Initial Playwright scripts failed from local script encoding/selector timing, then were corrected and passed.
- Context promotion candidate: Paid Face Lab should remain an image + locale companion section and must not consume Skin Match survey, score, priority axis, current products, or recommendation outputs as Face Lab generation input.

### 2026-06-29 / premium Face Lab P2 audit fixes

- Branch: feature/premium-face-lab-section
- Task type: focused execution / P2 audit follow-up
- Routing decision: User requested only the two read-only audit P2 fixes: prevent empty raw Face Lab objects from becoming available, and persist newly derived valid `faceLabSummary` into the existing premium report session when authorized.
- Goal: Require a real display signal before `available`, and merge a sanitized available `faceLabSummary` into `premium_report_sessions.premium_report` without changing Face Lab generation, Skin Match, recommendation, payment, or DB schema.
- Changed files: lib/premium-face-lab.js, app/api/full-report/route.js, lib/premium-report-session.js, docs/architecture/premium-face-lab-contract-v1.md, .codex/AI_WORK_LOG.md
- Protected areas: No `/api/face-reading`, app/page.js, SurveyFlow, free result UI, recommendation engine, score formula, DB schema/migration, image upload, Face Lab prompt, currentProductVerdicts, functionalDecisions, conditionResponses, or payment flow changes.
- Validation results: `npm run build` passed. `git diff --check` passed with LF-to-CRLF warnings only. Adapter-level checks confirmed `{}`, `{ base_data: {} }`, `{ features: {} }`, `{ base_data: {}, features: {} }`, and image-only return `unavailable`; non-empty `base_data.impressionTitle`, keyword, styleDirection, and legacy raw Face Lab text return `available`. 390px Playwright verified `/test-full-report` available and custom unavailable, legacy-missing, and legacy-faceLab cases with no broken images, no overflow, console errors 0, page errors 0. Free `/api/analyze` 200 response did not include `faceLabSummary`, `faceLab`, or `premiumReport`.
- Notes/risks: Persist behavior was verified by code path, not live authenticated E2E. The update helper reuses the signed premium report cookie, re-verifies the session id, and updates only the merged `premium_report` JSON. Stored available summaries are not overwritten; invalid request Face Lab does not write unavailable over stored data.
- Context promotion candidate: Persist derived premium Face Lab summaries only after signed premium session verification, and only when the stored summary is missing/unavailable and the derived summary is available.

### 2026-06-28 / premium current products verdicts

- Branch: feature/premium-current-products-verdicts
- Task type: execution / High premium report data-contract addition
- Routing decision: User requested a scoped paid full-report feature that adds usage verdicts for current products without changing free result, survey, recommendation ranking, score formula, product DB, currentProducts input, Face Lab, payment, or DB schema.
- Goal: Add paid-report-only current product verdict data and render small verdict summaries near existing routine consult current product slot notes while preserving currentProducts registration status semantics.
- Changed files: app/api/analyze/route.js, app/result/full-report/page.js, components/full-report/PremiumRoutineConsultSection.jsx, components/result/premium/CurrentProductSlotNote.jsx, docs/architecture/current-products-verdict-contract-v1.md, lib/current-product-verdicts.js, lib/skin-match-decision-engine.js, lib/test-result-fixture.js, .codex/AI_WORK_LOG.md
- Protected areas: No Top Pick, supportingProducts, product ranking, score formula, product-source, category semantics, review-signals definitions, sunscreen hard filter/score, currentProducts input or slot-building logic, free result, SurveyFlow, Face Lab, payment, DB/schema, or replacement-product CTA changes.
- Validation results: `npm run build` passed. `git diff --check` passed. Helper-level fixtures produced `keep`, `adjust`, conservative `hold`, `check_needed` for selected snapshot null, `check_needed` for `not_in_db`, and no verdict for `not_using`. Korean 390px Playwright `/test-full-report` opened the paid report, navigated to routine consult, switched AM/PM, verified sunscreen `not_in_db` remains in the protection step with `check_needed`, cleanser selected shows `adjust`, moisturizer `not_using` keeps the empty slot with no verdict badge, horizontal overflow false, console errors 0, page errors 0.
- Notes/risks: The verdict engine intentionally uses only premium-report-available current product fields plus survey/priority context. Strong `hold` is conservative; missing DB or snapshot information falls back to `check_needed`. A selected `productSnapshot: null` visible-slot fallback was verified by helper code path because treatment visible-slot rendering still requires existing product form semantics, and that slot-building rule was intentionally left unchanged.
- Context promotion candidate: NULL

### 2026-06-28 / premium current products verdict safety follow-up

- Branch: feature/premium-current-products-verdicts
- Task type: execution / focused verdict safety fix
- Routing decision: User requested only two fixes after read-only audit: remove product name/brand based `hold` triggers and make verdict slot resolution reuse the existing currentProducts semantics without changing slot-building rules.
- Goal: Restrict `hold` to structured active metadata/signals plus barrier/redness/acne conflict, and avoid orphan verdicts by generating verdicts only for slots resolved by `lib/current-products.js`.
- Changed files: lib/current-product-verdicts.js, lib/current-products.js, lib/test-result-fixture.js, docs/architecture/current-products-verdict-contract-v1.md, .codex/AI_WORK_LOG.md
- Protected areas: No app/api/analyze, full-report UI components, skin-match decision engine call site, recommendation scoring, Top Pick, supportingProducts, sunscreen scoring, free result, SurveyFlow, DB/schema, or currentProducts slot-building rule changes.
- Validation results: `npm run build` passed. `git diff --check` passed. Helper-level checks confirmed product name-only `Retinol Cream` and `AHA Toner` do not produce `hold`; structured `key_ingredients: ["retinol"]` plus barrier priority still produces `hold`; barrier priority without structured active signal produces `adjust`, not `hold`; visible cleanser/moisturizer/sunscreen slot keys match UI slot keys; treatment with missing `product_form` produces no verdict; `not_in_db` and sunscreen `not_in_db` produce `check_needed`; `not_using` and sunscreen `not_using` produce no verdict. Korean 390px Playwright `/test-full-report` verified AM/PM switch, 3 cards per mode, existing sunscreen `check_needed` and cleanser `adjust` displays, moisturizer `not_using` without verdict, overflow false, console errors 0, page errors 0.
- Notes/risks: Node helper checks use the existing local alias loader because the verdict module imports app aliases. The test fixture keeps the missing-form treatment current product input but no longer has active slot verdicts for it.
- Context promotion candidate: NULL

### 2026-06-28 / premium routine section refactor

- Branch: feature/premium-routine-section-refactor
- Task type: execution / Medium premium full report structure refactor
- Routing decision: User requested a scoped structural split of only the paid full report routine consult section. Recommendation engine, currentProducts verdict logic, premium payload shape, saved report flow, free result, survey, Face Lab, DB/schema, and unrelated sections were left untouched.
- Goal: Move routine consult AM/PM state, step cards, current product slot notes, and CTA rendering out of `app/result/full-report/page.js` into a premium-specific component while keeping the existing UI result and data preparation path.
- Changed files: app/result/full-report/page.js, components/full-report/PremiumRoutineConsultSection.jsx, .codex/AI_WORK_LOG.md
- Protected areas: No Top Pick, supportingProducts, score formula, product ranking, routineStructure generation, currentProducts slot-building rules, premium report shape, saved-report schema, payment flow, functional judgment, condition response, Face Lab, free result, survey, or DB/schema changes.
- Validation results: `npm run build` passed. `git diff --check` passed. 390px Playwright full report flow opened `/test-full-report`, entered routine consult, verified AM/PM tab switch, 3 routine cards per mode, no horizontal overflow, console errors 0, page errors 0. Fixture covered `sunscreen not_in_db`, `moisturizer not_using`, `cleanser selected`, and `serum selected` with null `productSnapshot`; rendered text confirmed sunscreen `not_in_db` stays in the protection step as currently using and moisturizer `not_using` renders as an empty moisture finish step.
- Notes/risks: In-app browser viewport override bottomed out at 520px, so the 390px verification was completed with local Playwright against the same dev server. Direct Node import of `buildCurrentProductRoutineSlots` was blocked by the app `@/` alias outside Next runtime, so `productSnapshot` fallback was checked by code path plus rendered fixture behavior rather than standalone function import.
- Context promotion candidate: NULL

### 2026-06-28 / survey contract cleanup v1

- Branch: feature/survey-contract-cleanup-v1
- Task type: execution / Medium survey contract cleanup
- Routing decision: User requested a scoped cleanup of free Skin Match survey UI, payload, recommendation gender scoring, legacy compatibility, cleansingFrequency contract confirmation, and a new architecture contract doc. Existing crawler/ranking and previous branch changes were present before this task and were left untouched.
- Goal: Remove 신규 무료 설문의 `fragranced`, 일반 `pilling`, and gender question; stop sending/using `genderPreference` in new free analysis requests; remove gender-based product score adjustment; preserve legacy payload tolerance and sunscreen `makeupUse` + `pilling_risk`; document the survey contract.
- Changed files: app/api/analyze/route.js, app/page.js, app/result/page.js, components/onboarding/BasicSurveyStep.js, components/onboarding/SurveyFlow.js, components/onboarding/constants.js, docs/architecture/survey-contract-v1.md, lib/recommendation-scoring.ts, lib/skin-match-decision-engine.js, lib/skin-profile-summary.js, .codex/AI_WORK_LOG.md
- Protected areas: No product-source, product-category-normalizer, review-signals, category semantics, product DB/schema, Face Lab API/calculation, premium report UI, routineStructure generation, or sunscreen hard filter/score changes.
- Validation results: `npm run build` passed. `git diff --check` passed. Korean 390px Playwright survey flow completed without the gender question, without `fragranced` or general `pilling` options, with no horizontal overflow and console/page errors 0. New free analyze FormData did not include `genderPreference`. `/api/analyze` returned 200 for new no-gender payload and legacy `genderPreference`, `mostDislikedFeel: fragranced`, and `mostDislikedFeel: pilling` payloads. `cleansingFrequency: 3_plus` preserved the existing barrier +3 and dehydration +2 score delta. Function-level scoring check confirmed female/male/unspecified scores are identical and sunscreen `makeupUse` + high `pilling_risk` remains rejected.
- Notes/risks: `review-signals.js` still has its pre-existing legacy `mostDislikedFeel: pilling` path and was intentionally not edited because the user marked review-signals out of scope.
- Context promotion candidate: NULL

### 2026-06-28 / free result Decision Bundle display audit fixes

- Branch: feature/free-result-decision-bundle-alignment
- Task type: execution / small scoped display and payload fix
- Routing decision: User requested edits only in the free-result Decision Bundle display scope. Existing recommendation/category semantics changes were explicitly out of scope and were not modified, staged, restored, stashed, reset, or committed.
- Goal: Make Top 1 priority title prefer API `priority.label`, minimize free API `scoring` payload to `concernScores[axis].total`, and make incomplete AM/PM routine preview data fall back per time period instead of rendering empty cards.
- Changed files: app/api/analyze/route.js, app/result/page.js, lib/result/free-result-v2-static-builders.js, .codex/AI_WORK_LOG.md
- Protected areas: No recommendation score formula, Top Pick, supportingProducts, product candidate pool, routineStructure generation, premium report shape, currentProducts, survey, Face Lab, DB/schema, or category/review-signal files were edited.
- Validation results: `npm run build` passed. `git diff --check` passed. Korean 390px Playwright verification passed with API `priority.label` visible as the Top 1 title, free API `scoring` containing only `concernScores` and per-axis `total`, AM/PM routine preview showing 3 cards each, incomplete AM routineStructure falling back only on the morning side, overflow false, console errors 0, page errors 0.
- Notes/risks: Per-period routine fallback uses legacy static preview only for the incomplete AM or PM side; valid API-derived side remains intact.
- Context promotion candidate: NULL

### 2026-06-27 / free result Decision Bundle display alignment

- Branch: feature/free-result-decision-bundle-alignment
- Task type: execution / Medium result display data-source alignment
- Routing decision: User requested a scoped free-result display change after a clean main sync and feature branch creation. API generation logic, recommendation scoring, Top Pick, supportingProducts, premium report structure, currentProducts, survey questions, Face Lab, DB, env, auth, payment, deployment config, and `docs/architecture/survey-calculation-audit.md` were out of scope.
- Goal: Make free-result priority TOP 3, skin radar/status tags, and routine preview prefer the actual `/api/analyze` Decision Bundle source fields: `priority`, `scoring.concernScores`, and `routineStructure`.
- Changed files: app/api/analyze/route.js, app/result/page.js, components/result/free-v2/FreeResultV2DiagnosisStep.jsx, lib/result/free-result-v2-static-builders.js, .codex/AI_WORK_LOG.md
- Protected areas: No env, DB schema/migration/policy, auth, payment, production data, deployment config, product DB, recommendation formula, Top Pick/supportingProducts selection, premium report shape, currentProducts, survey copy/options, Face Lab, or routineStructure generation edits. API response pass-through was limited to exposing already-computed `decision.scoring.concernScores` because the requested UI source-of-truth requires that field.
- Validation results: `npm run build` passed. 390px Playwright verification passed on `/en/result` for 8 API-generated survey combinations with TOP 3 labels matched to API `priority` + sorted `scoring.concernScores`, radar labels present from API scores, AM/PM routine preview matched `routineStructure.am/pm.label` and `strategyLine`, horizontal overflow false, console errors 0, page errors 0. `git diff --check` passed.
- Notes/risks: Free radar maps API scores into five display axes; sensitivity uses the higher of API redness/acne totals. Legacy saved results without `scoring.concernScores`, `priority`, or `routineStructure` still use existing local/static fallbacks.
- Context promotion candidate: NULL

### 2026-06-27 / free result routine preview step-card restore

- Branch: feature/free-result-decision-bundle-alignment
- Task type: execution / Medium free-result UI display fix
- Routing decision: User requested the browser comment fix first, scoped to the free result routine preview UI. Recommendation engine, score formula, Top Pick, supportingProducts, routineStructure generation, API analyze calculation, premium report shape, currentProducts, survey payload/questions, Face Lab, DB, and broad design changes were out of scope.
- Goal: Keep API `routineStructure` as the source for AM/PM mode and strategy, but restore 2-3 user-facing routine step cards instead of rendering internal labels such as `아침 전략` as a single card.
- Changed files: lib/result/free-result-v2-static-builders.js, .codex/AI_WORK_LOG.md
- Protected areas: No API calculation, routineStructure generation, recommendation, product ranking, premium report, currentProducts, DB, auth, env, deployment, or survey changes.
- Validation results: `npm run build` passed; `git diff --check` passed. Korean 390px `/test-result` legacy fallback showed morning steps `가볍게 정돈 / 수분 유지 / 자외선 차단` and night steps `순한 세안 / 수분 보충 / 장벽 안정`, overflow false, console/page errors 0. Korean 390px `/result` with a fresh `/api/analyze` result showed API routine modes `fresh_control / pore_texture_care`, morning steps `가볍게 정돈 / 유분 조절 / 답답함 줄이기`, night steps `순하게 정리 / 모공·결 정돈 / 진정 보습`, overflow false, console/page errors 0.
- Notes/risks: Current public `routineStructure` does not expose detailed step arrays, so the free preview uses explicit step intent/purpose arrays when present and otherwise maps API AM/PM `mode` into short action labels. Insufficient legacy structures fall back to the existing static preview.
- Context promotion candidate: NULL

### 2026-06-22 / Hwahae ranking Top 50 gateway collector

- Branch: main
- Task type: execution / Medium crawler collector change
- Routing decision: User requested investigation and implementation for extending verified Hwahae ranking collection from JSON-LD Top 20 to Top 50. No DB schema change was needed; existing migrations and products data were not modified.
- Goal: Reuse the `review_prepare` Chrome/CDP profile approach for investigation, verify Korean Hwahae ranking pagination for essence/ampoule/serum All and Trouble, then enable only those verified Top 50 jobs.
- Changed files: crawler/hwahae.ts, crawler/config/ranking-jobs.json, .codex/AI_WORK_LOG.md
- Protected areas: No .env edits, no migration edits, no auth/payment/policy/deployment edits, no products insert/update/delete path added, no promotion/enrich execution.
- Validation results: Korean `.co.kr` page opened through `npm run review_prepare` Chrome remote debugging profile. Scroll triggered `https://gateway.hwahae.co.kr/v14/rankings/{themeId}/details?page=2..5&page_size=20`. Direct normal browser dry-runs and `--cdp-url=http://127.0.0.1:9222` dry-run collected 50/50 for verified jobs. Top 50 snapshots had contiguous ranks 1-50 and duplicate product count 0. JSON-LD first 20 matched gateway page 1 order by product/goods URL id. `npm run test:ranking-ingest` passed, `npm run typecheck` passed, `npm run crawl -- --dry-run` passed, `git diff --check` passed. products count stayed 164 before/after.
- Error log: Initial investigation incorrectly used English `/en` page; corrected to Korean `.co.kr` after user feedback because locale can affect DOM/URL/payload. Initial implementation used `page.evaluate(fetch(...))` and dry-run failed with `TypeError: Failed to fetch` from Hwahae browser fetch wrappers; collector was changed to `page.request.get(...)` with referer while still using the browser context.
- Notes/risks: The Top 50 collector depends on Hwahae gateway `v14/rankings/{themeId}/details` response shape. Existing JSON-LD Top 20 remains fallback for jobs with requested_limit <= 20 or pages where JSON-LD already satisfies the requested limit.
- Context promotion candidate: For Hwahae rankings, Korean `.co.kr` should be the source of truth for URL/pagination verification unless a task explicitly targets global `/en` pages.

### 2026-06-22 / Hwahae category concern job matrix

- Branch: main
- Task type: execution / Medium crawler config and validation change
- Routing decision: User explicitly requested a fixed Hwahae ranking job matrix and validation, with no products writes and no existing migration edits. DB schema/migration changes were not needed.
- Goal: Replace ad hoc Hwahae ranking jobs with a 9 category x 9 ranking context matrix, preserve essence/ampoule/serum as one source category, and keep jobs disabled unless URL/filter/pagination/parser verification is complete.
- Changed files: crawler/config/ranking-jobs.json, crawler/lib/supabase.ts, crawler/lib/review.ts, crawler/test-ranking-ingest.ts, .codex/AI_WORK_LOG.md
- Protected areas: No .env edits, no migration edits, no auth/payment/policy/deployment edits, no production data writes, no products insert/update/delete path added, no promotion/enrich execution.
- Validation results: `npm run test:ranking-ingest` passed, `npm run typecheck` passed after one test-only null narrowing fix, `git diff --check` passed, `npm run crawl -- --dry-run` passed with products writes 0 and 0 enabled jobs, products count stayed 164 before/after. Playwright checks for essence/ampoule/serum All theme_id 4174 and Blemishes theme_id 4181 returned HTTP 200 twice, page H1/category matched, JSON-LD ItemList had rank positions 1-20 only.
- Error log: Initial Playwright verification waited for JSON-LD scripts with default visible state and timed out even though locator resolved to 3 script tags; rerun used `state: attached` and passed. Initial products-write rg command had a PowerShell quoting regex parse error; rerun with fixed patterns returned no matches. Initial typecheck failed with `test-ranking-ingest.ts(340,15): 'config.disabledReason' is possibly 'null'`; fixed test assertion with optional chaining.
- Notes/risks: Hwahae Next data reports pagination metadata but page=2 URL and Next data URL still returned page 1 / first 20, so Top 50/100 pagination remains unverified. Gel, balm, and sunscreen do not expose all requested concern themeIds in the observed rankingsCategories tree, so those matrix jobs are retained disabled with explicit reasons.
- Context promotion candidate: Ranking jobs may preserve source_product_form as source observation metadata even when service_category already encodes the form; review/enrichment should decide product_form finalization separately from ranking collection.

### 2026-06-21 / Hwahae ranking Phase 1 snapshot pipeline

- Branch: redesign-bejewely-first-screen
- Task type: limited implementation
- Routing decision: High DB schema/data-flow change with explicit user approval for a forward-only migration. Existing migration files, promotion RPC behavior, products data, auth, payment, policies, and deployment config were not modified.
- Goal: Implement Phase 1 ranking collection so Hwahae ranking results accumulate through ranking_snapshots -> source_rankings -> product_candidates without direct products writes.
- Changed files: supabase/migrations/20260621030000_phase1_ranking_snapshot_pipeline.sql, crawler/hwahae.ts, crawler/lib/supabase.ts, crawler/lib/ranking-config.ts, crawler/lib/snapshot.ts, crawler/lib/ranking-ingest.ts, crawler/config/ranking-jobs.json, crawler/test-ranking-ingest.ts, crawler/package.json, crawler/README.md, data/hwahae/README.md, docs/ranking-pipeline.md, .gitignore, .codex/AI_WORK_LOG.md
- Protected areas: No .env edits, no auth/payment/policy/deployment edits, no production data write, no products insert/update path added, no promotion RPC change, no automatic promotion or automatic product tag finalization.
- Validation plan: crawler ranking ingest smoke test, crawler typecheck, SQL/code search for products writes in the Phase 1 crawler path, and dry-run command if browser/network dependencies allow it.
- Notes/risks: Existing source_rankings/product_candidates base table creation migration is not present in the repo, so the Phase 1 migration extends existing deployed tables with if-not-exists DDL. Fallback candidate identity without external_id remains non-unique by design and unresolved multiple matches are reported as pending identity collisions.
- Context promotion candidate: Candidate rule to keep rankingFilter as source observation metadata, not product concern/tag metadata.

## 목적

이 문서는 AI 에이전트 작업 이력을 단순 보관하지 않고, 성공한 작업 패턴과 에러·실패·회귀에서 얻은 교훈을 함께 수집해 재사용 가능한 운영 규칙과 상위 문서 승격 후보를 추출하기 위한 로그다.

작업 유형의 판단 기준은 `.codex/AI_ROUTER.md`를 따른다.

---

## 기록 대상

Medium 이상 작업 또는 문제가 발생한 작업만 기록한다.

기록 대상:
- 라우팅 판단
- 변경 범위
- 보호 구역
- 검증 결과
- 문제/주의점
- 재사용할 규칙
- 규칙 승격 후보
- Context 반영 후보

---

## 작업 로그 형식

### YYYY-MM-DD / 작업명

- 브랜치:
- 작업 유형:
- 라우팅 판단:
- 목표:
- 변경 파일:
- 보호 구역:
- 검증 결과:
- 문제/주의점:
- 다음 작업:
- 재사용할 규칙:
- 규칙 승격 후보:

### 2026-06-20 / Bejewely first screen design guide application

- 브랜치: redesign-bejewely-first-screen
- 작업 유형: 실행형
- 라우팅 판단: 첨부 디자인 가이드의 시스템을 기존 첫 화면에 적용하는 Medium UI 작업. API, DB, 저장 데이터 구조, 인증, 결제, 배포 설정은 범위에서 제외.
- 목표: 첫 화면에서 피부 분석 서비스, 촬영 필요, 맞춤 제품 추천 제공을 3초 안에 이해하도록 제목/얼굴 가이드/CTA/보조 버튼/스텝/촬영 조건의 시각 우선순위를 재정렬.
- 변경 파일: app/globals.css, app/page.js, components/onboarding/PhotoUploadStep.js, .codex/AI_WORK_LOG.md
- 보호 구역: .env, 인증/권한/리다이렉트, DB schema/migration/policy, 결제, 개인정보/production data, API response field names, 저장 데이터 구조, 배포 설정, 패키지 대규모 변경은 수정하지 않음.
- 검증 결과: `npm run build` 성공. `npm run lint`는 프로젝트 ESLint 설정 부재로 Next 대화형 설정 프롬프트가 떠서 중단됨. 로컬 dev 서버 `http://localhost:3001` 200 확인. Playwright 390px 검증에서 라이트/다크 모두 BEJEWELY, 제목, 촬영 CTA, 사진 선택, Step 1-3, 촬영 조건 노출 확인, Next 오류 오버레이 0, console error 0. 스크린샷 `.codex/light-first-screen.png`, `.codex/dark-first-screen.png` 확인.
- 문제/주의점: Playwright MCP REPL은 다른 Playwright 캐시를 참조해 브라우저 실행에 실패하여 프로젝트 `node` 컨텍스트에서 검증 스크립트를 실행함. `.codex/first-screen-verify.json`은 검증 산출물.
- 다음 작업: 실제 기기 카메라 권한 플로우는 브라우저 보안 정책/디바이스 권한에 따라 별도 수동 확인 필요.
- 재사용할 규칙: 첫 화면 CTA는 촬영/사진 선택을 주 행동으로 두고, 다음 단계 CTA는 사진 선택 후에만 노출한다.
- 규칙 승격 후보: Candidates

### 2026-06-20 / Bejewely first screen brand reinforcement

- 브랜치: redesign-bejewely-first-screen
- 작업 유형: 실행형
- 라우팅 판단: 기존 첫 화면 레이아웃과 CTA 우선순위는 유지하고 브랜드 컬러 체감만 높이는 Medium UI 미세 조정. API, DB, 저장 로직, 인증, 결제, 배포 설정은 범위에서 제외.
- 목표: 가독성 90과 CTA 존재감을 유지하면서 Light Mode의 브랜드성 부족을 보완.
- 변경 파일: app/globals.css, components/onboarding/PhotoUploadStep.js, .codex/AI_WORK_LOG.md
- 보호 구역: .env, 인증/권한/리다이렉트, DB schema/migration/policy, 결제, 개인정보/production data, API response field names, 저장 데이터 구조, 배포 설정, 패키지 대규모 변경은 수정하지 않음.
- 검증 결과: 첫 `npm run build`는 실행 중인 Next dev/build 산출물 충돌로 `.next/server/pages-manifest.json` ENOENT 발생. 프로젝트 Next 프로세스만 종료하고 `.next` 생성물을 정리한 뒤 `npm run build` 성공. `git diff --check -- app/globals.css components/onboarding/PhotoUploadStep.js` 통과. dev 서버는 3001 대신 3125 포트로 기동되어 `http://127.0.0.1:3125` 200 확인. Playwright 390px 검증에서 라이트/다크 모두 브랜드명, 제목, 촬영 CTA, 사진 선택, Step, 촬영 조건 노출 확인, Next 오류 오버레이 0, console error 0. 스크린샷 `.codex/light-first-screen-brand-v2.png`, `.codex/dark-first-screen-brand-v2.png` 확인.
- 문제/주의점: 다크 전환 시 Light background-image가 남는 문제가 한 차례 확인되어 `ui-page-shell`의 dark 배경도 gradient로 명시해 수정함.
- 다음 작업: 실제 기기 카메라 권한 플로우는 별도 수동 확인 필요.
- 재사용할 규칙: Light Mode 브랜드 강화는 배경/링/스텝 라인/브랜드명 강도만 올리고, CTA 크기와 정보 구조는 유지한다.
- 규칙 승격 후보: Candidates

### 2026-06-21 / survey flow architecture split and optional result path

- 브랜치: redesign-bejewely-first-screen
- 작업 유형: 실행형
- 라우팅 판단: 설문 화면의 기존 디자인 톤과 흐름은 유지하고 컴포넌트 경계, required helper, optional result action, current products wrapper를 추가하는 Medium UI/architecture 작업. 첫 화면 PhotoUploadStep, 추천 로직, API 응답, DB, 인증, 결제, 저장 데이터 구조는 범위에서 제외.
- 목표: 설문 질문 카드/선택지/진행률/팁/푸터 액션을 분리 가능한 컴포넌트 단위로 정리하고, 필수 질문 완료 후 선택 질문에서 결과 보기 흐름을 지원할 수 있게 준비.
- 변경 파일: components/onboarding/SurveyFlow.js, components/onboarding/SurveyCurrentProducts.jsx, app/page.js, .codex/AI_WORK_LOG.md
- 보호 구역: .env, 인증/권한/리다이렉트, DB schema/migration/policy, 결제, 개인정보/production data, API response field names, 저장 데이터 구조, 배포 설정, 추천 로직은 수정하지 않음.
- 검증 결과: `npm run build` 성공. `git diff --check -- components/onboarding/SurveyFlow.js components/onboarding/SurveyCurrentProducts.jsx app/page.js` 통과. dev 서버 `http://localhost:3001` 200 확인. Playwright 390px에서 사진 업로드 -> 설문 진입 -> 필수 질문 3개 선택 -> 선택 질문 진입 확인. 필수 완료 전 `결과 보기` 미노출, 필수 완료 후 선택 질문에서 `결과 보기` 노출 확인. 이전 버튼으로 필수 질문 복귀 확인. progress bar width 증가 확인. Current products 영역 렌더링 확인. Light/Dark screenshot 확인, Next error overlay 0, console error 0.
- 문제/주의점: 현재 사용 중 제품 API/추천 반영 로직은 건드리지 않고 래퍼 컴포넌트로만 분리함. `preferredTexture`는 현재 추천 normalize 기본값이 있어 이번 작업에서는 required로 승격하지 않음.
- 다음 작업: 선택 질문 그룹을 실제 유료/프리미엄 설문으로 옮길 때는 `SurveyCurrentProducts` 렌더 위치와 `PREMIUM_REPORT_ENABLED` 정책만 조정하면 됨.
- 재사용할 규칙: 설문 필수/선택 분리는 질문 데이터의 `required` 플래그와 `areRequiredQuestionsComplete` helper를 기준으로 처리하고, UI 흐름은 `SurveyFooterActions`에서만 분기한다.
- 규칙 승격 후보: Candidates

### 2026-06-18 / paid full-report release gate and Step5 coming-soon lock

- 브랜치: feature/premium-report-flow-v1
- 작업 유형: 실행형
- 라우팅 판단: 유료 리포트 상세 구현을 삭제하지 않고 production 진입만 잠그며 무료 결과 Step5 문구/UI를 준비 중 상태로 바꾸는 Medium UI/flow guard 작업. 추천 알고리즘, 제품 DB, 결제, 저장 로직, DB schema, API 응답 필드는 범위에서 제외.
- 목표: development에서는 기존 유료 리포트 접근을 유지하고, production 기본값에서는 Step5와 `/result/full-report` 직접 접근을 준비 중 안내로 차단한다.
- 변경 파일: app/result/page.js, app/result/full-report/page.js, components/result/free-v2/FreeResultV2PremiumPreviewStep.jsx, .codex/AI_WORK_LOG.md
- 보호 구역: 추천 알고리즘, 제품 점수식, 제품 DB, 결제, 저장 로직, DB schema/migration/policy, API response field names는 수정하지 않음.
- 검증 결과: 시작 전 working tree clean 확인 후 `git fetch origin --prune`, `git merge origin/main` 실행 결과 `Already up to date`. merge 후 `npm run build` 성공. 변경 후 `npm run build` 성공. production `next start -p 3002`에서 `/result/full-report` 직접 접근 시 준비 중 안내 표시, 개발자 버튼 미노출, 로딩 브리지 미노출, `/api/full-report` resource 요청 없음, console error 0, overflow 없음 확인. development `http://localhost:3001/result/full-report` 직접 접근은 기존 로딩 브리지로 진입 가능하고 준비 중 gate가 아님을 확인.
- 문제/주의점: `/test-result`의 Step 이동 UI가 텍스트 없는 dot 중심이라 자동 브라우저 클릭으로 Step5까지 안정적으로 접근하지 못했다. Step5 컴포넌트 코드와 production direct gate는 검증했으며, 실제 Step5 화면은 후속 눈검수 여지가 있다.
- 다음 작업: 유료 리포트 공개 시 `NEXT_PUBLIC_PREMIUM_REPORT_ENABLED=true`, 결제/권한 확인, 준비 중 카피 제거, 개발자용 진입 버튼 제거, `/result/full-report` 직접 접근 권한 검증을 순서대로 처리.
- 재사용할 규칙: release 전 숨김 처리는 CSS hidden이 아니라 조건부 렌더링으로 production DOM에서 제거하고, route gate는 hook 순서가 깨지지 않도록 wrapper/content 구조로 나눈다.
- 규칙 승격 후보: Candidates

### 2026-06-18 / paid Skin Match 루틴 상담 스크롤 플로우 애니메이션

- 브랜치: feature/premium-report-flow-v1
- 작업 유형: 실행형
- 라우팅 판단: 유료 Skin Match `루틴 상담` 내부 카드 표시 방식만 조정하는 Medium UI 작업. 메인 꽃잎 허브, 기능성 판단/컨디션 대응/Face Lab, 추천 알고리즘, DB, 결제, 저장 로직은 범위에서 제외.
- 목표: AM/PM 스위치 구조와 상단/하단 CTA는 유지하면서 루틴 단계 카드가 스크롤 진입 시 좌우 번갈아 부드럽게 등장하는 루틴 플로우처럼 보이게 정리.
- 변경 파일: app/result/full-report/page.js, .codex/AI_WORK_LOG.md
- 보호 구역: 추천 알고리즘, 제품 점수식, DB schema/migration/policy, 결제, 인증, 저장 로직, API 응답 필드, 메인 꽃잎 허브 구조는 수정하지 않음.
- 검증 결과: `npm run build` 성공. `git diff --check -- app/result/full-report/page.js .codex/AI_WORK_LOG.md` 통과(CRLF warning만 있음). in-app Browser 390px에서 루틴 화면 AM 카드 좌/우 방향 속성, 3단계 스크롤 진입 상태, PM 전환 후 카드 리셋 상태, 기능성 판단 CTA, 가로 overflow 없음, console error 0을 확인. 자동 좌표 검수 중 버튼 위치가 반복적으로 변해 일부 클릭 재시도가 있었음.
- 문제/주의점: in-app Browser 백그라운드 상태에서 Framer `whileInView`와 `useInView`가 PM 전환 후 관찰을 안정적으로 다시 걸지 못해, 카드 내부에 `IntersectionObserver`와 즉시 viewport 계산 fallback을 함께 적용했다. 중간 수정 과정에서 제거한 `scheduleCheck` 참조가 cleanup에 남아 `ReferenceError: scheduleCheck is not defined` 런타임 에러가 발생했고, 이 에러가 full-report error boundary로 전달되어 “분석을 완료하지 못했어요” 화면이 표시됐다. 남은 참조를 `revealIfVisible`로 교체하고 `Select-String scheduleCheck`, `npm run build`, reload로 복구를 확인했다.
- 다음 작업: 실제 사용자 세션에서 스크롤 감도와 카드 등장 타이밍을 눈검수하고, 필요하면 카드 간 여백/상단 고정 영역 위치만 미세 조정.
- 재사용할 규칙: 스크롤 진입 애니메이션은 reduced motion 대응과 observer fallback을 같이 두고, 제품 정보는 단계 카드 안의 낮은 위계로 유지한다.
- 규칙 승격 후보: NULL

### 2026-06-18 / paid Skin Match 루틴 상담 AM-PM 전환 2차 리팩토링

- 브랜치: feature/premium-report-flow-v1
- 작업 유형: 실행형
- 라우팅 판단: 유료 Skin Match의 `루틴 상담` 내부 화면만 정보 구조와 UI 위계를 조정하는 Medium UI 작업. 메인 꽃잎 허브, 기능성 판단/컨디션 대응/Face Lab 상세, 추천 알고리즘, 제품 점수식, DB schema, 결제, 저장 로직은 범위에서 제외.
- 목표: 루틴 상담을 제품 추천 목록이 아니라 오늘 기준 기본 루틴 상담 화면으로 보이게 하고, AM/PM을 한 페이지 안에서 전환하도록 정리.
- 변경 파일: app/result/full-report/page.js, .codex/AI_WORK_LOG.md
- 보호 구역: 추천 알고리즘, 제품 DB/점수식, DB schema/migration/policy, 결제, 인증, 저장 로직, API 응답 필드, 메인 꽃잎 허브 구조는 수정하지 않음.
- 검증 결과: `npm run build` 성공. `git diff --check -- app/result/full-report/page.js` 통과(CRLF warning만 있음). in-app Browser 390px `/test-full-report`에서 AM 기본 상태, PM 전환, PM CTA의 기능성 판단 이동, 상태 뱃지, 보조 제품 표시, 판매처 CTA 미노출, 가로 overflow 없음, console/page error 0 확인.
- 문제/주의점: PM 전환 직후 짧은 fade/slide 애니메이션 동안 자동 계측이 카드 렌더를 너무 빨리 읽을 수 있어 1초 대기 후 DOM으로 재확인함. 실제 화면/DOM에서는 PM 단계 카드가 정상 표시됨.
- 다음 작업: 기능성 판단, 컨디션 대응, Face Lab 상세 화면을 같은 상담형 위계로 단계적으로 정리. 루틴 상담의 실제 로그인/저장 데이터 케이스에서도 제품 이미지 누락과 긴 제품명 표시를 추가 확인.
- 재사용할 규칙: 유료 Skin Match 상세 섹션은 제품 카드보다 상담 단계와 행동 기준을 상위 위계로 두고, 제품은 단계 안의 보조 정보로 표시한다.
- 규칙 승격 후보: NULL

### 2026-06-15 / paid Skin Match hub 상담 맵 1차 리팩토링

- 브랜치: feature/premium-report-flow-v1
- 작업 유형: 실행형
- 라우팅 판단: 유료 Skin Match 메인 허브의 카피/정보 구조/라우팅만 조정하는 Medium UI 작업. 내부 상세 섹션, 추천/점수식, DB schema, 결제, 저장/세션, API 응답 필드, Face Lab 분석 로직은 범위에서 제외.
- 목표: 기존 꽃잎형 프리미엄 허브를 유지하면서 제품 추천 메뉴가 아니라 퍼스널 피부 상담 맵으로 보이도록 중앙 카피와 4개 섹터명을 정리.
- 변경 파일: app/result/full-report/page.js, components/full-report/TodayStartPlanStep.jsx, jsconfig.json, .codex/AI_WORK_LOG.md
- 보호 구역: 추천 알고리즘, 제품 DB/점수식, DB schema/migration/policy, 결제, 인증, 저장 로직, API 응답 필드, 저장 데이터 구조는 수정하지 않음.
- 검증 결과: 첫 `npm run build`는 `jsconfig.json`의 `@/* -> ./src/*` alias 때문에 기존 import인 `@/app/result/full-report/page`, `@/app/result/page`, `@/components/full-report/TodayStartPlanStep` 등을 찾지 못해 실패. `jsconfig.json`을 `baseUrl: "."`, `@/*: ["./*"]`로 복구한 뒤 `npm run build` 성공. `git diff --check -- app/result/full-report/page.js components/full-report/TodayStartPlanStep.jsx jsconfig.json`은 CRLF warning만 있고 통과. Playwright 390px `/test-full-report` 검증에서 가로 overflow 없음, 필수 허브 문구 표시, 금지 허브 표현 없음, console/page error 0. Face Lab 꽃잎은 Face Lab 탭으로 전환되고, 루틴 상담 꽃잎은 기존 아침 루틴 섹션으로 연결됨.
- 문제/주의점: Browser plugin screenshot capture가 1회 timeout되어 로컬 Playwright screenshot(`tmp-skin-match-hub-390.png`, `tmp-skin-match-hub-390-full.png`)으로 시각 검수함. 내부 상세 페이지는 이번 범위 밖이라 기존 제품/루틴 문구와 step indicator가 남아 있음.
- 다음 작업: 내부 상세 섹션을 루틴 상담, 기능성 판단, 컨디션 대응, Face Lab 기준으로 단계적으로 재정리하되 추천/저장/DB 로직은 계속 분리.
- 재사용할 규칙: 빌드에서 광범위한 `@/` module-not-found가 발생하면 앱 import를 바꾸기 전에 `jsconfig.json` alias를 먼저 확인한다.
- 규칙 승격 후보: NULL

### 2026-06-12 / 유료 리포트 Skin Match 첫 화면 허브형 구조 전환
- 브랜치: feature/premium-report-flow-v1
- 작업 유형: 실행형
- 라우팅 판단: `app/result/full-report/page.js` 안의 유료 리포트 첫 화면/상단 Skin Match 흐름을 허브형 UI로 재배치하는 작업이며, 추천/API/DB/결제/인증/저장 로직은 보호 구역으로 제외했다.
- 목표: 기존 숫자형 첫 화면 대신 중앙 `오늘 시작` 허브 카드와 `루틴 / 제품 / 주의 / 조정` 빠른 진입 카드를 제공하고, 기존 아침/저녁 루틴, 피해야 할 것, 조정법, 제품 콘텐츠는 유지한다.
- 변경 파일: app/result/full-report/page.js, .codex/AI_WORK_LOG.md
- 보호 구역: 추천 로직, 제품 데이터, API 응답 필드, DB schema/migration/policy, 결제, 인증/리다이렉트, 저장 로직, 무료 결과 페이지, Step5 유료 전환 로직, Face Lab 데이터/분석 로직은 수정하지 않았다.
- 검증 결과: `npm run build` 성공, `git diff --check -- app/result/full-report/page.js` 성공(CRLF warning만 있음), in-app Browser에서 CSS 390px 모바일 다크/라이트 모두 허브/빠른 진입 카드/CTA 표시 및 가로 오버플로 없음 확인, CSS 1440px 데스크톱 다크 확인, 라이트 모드 CTA가 코랄-피치 그라데이션으로 표시됨 확인, 브라우저 콘솔 에러 없음 확인, 빠른 진입 카드 4개 클릭 시 루틴 2/6, 제품 6/6, 주의 4/6, 조정 5/6 콘텐츠로 이동 확인.
- 문제/주의점: 브라우저 스크린샷 저장 시 `Page.captureScreenshot` timeout이 발생해 파일 저장은 하지 못했다. DOM/스타일/클릭 동작 기반 검증은 완료했다.
- 다음 작업: 실제 사용자 세션에서 제품 카드 이미지 로딩 상태와 저장/재확인 안내 카드의 문구 톤을 최종 눈검수하면 좋다.
- 재사용할 규칙: 유료 리포트 첫 화면은 숫자형 진행보다 `오늘 먼저 볼 것` 중심의 허브로 두고, 상세 콘텐츠는 빠른 진입 카드와 기존 단계 CTA로 연결한다.
- 규칙 승격 후보: `NULL`

### 2026-06-12 / 유료 리포트 전용 물방울 로딩 화면 추가
- 브랜치: feature/premium-report-flow-v1
- 작업 유형: 실행형
- 라우팅 판단: 유료 리포트 진입 전용 `/result/full-report/loading` UI 라우트 추가와 무료 결과의 전체 리포트 CTA 목적지만 변경하는 작업이며, 추천/API/DB/결제/인증/저장 로직은 보호 구역으로 제외했다.
- 목표: Skin Match 유료 플랜 생성 과정을 물방울 게이지, 단계 문구, 완료 상태, 물방울 터치 후 파문 전환으로 보여주고 완료 후 기존 허브형 `/result/full-report`로 이동시킨다.
- 변경 파일: app/result/full-report/loading/page.js, app/en/result/full-report/loading/page.js, app/result/page.js, .codex/AI_WORK_LOG.md
- 보호 구역: 추천 로직, 제품 데이터, API 응답 필드, DB schema/migration/policy, 결제, 인증/리다이렉트, 저장 로직, 무료 결과 로딩 페이지, Face Lab 분석 로직은 수정하지 않았다. 무료 결과 페이지는 전체 리포트 CTA 목적지만 `/result/full-report/loading`으로 변경했다.
- 검증 결과: `npm run build` 성공 및 `/result/full-report/loading`, `/en/result/full-report/loading` 라우트 생성 확인. Playwright로 390px 모바일 다크/라이트, 1440px 데스크톱 라이트 확인, 진행률 증가와 단계 문구 표시 확인, 완료 문구/터치 안내/보조 CTA 표시 확인, 물방울 클릭 후 ripple class 적용 및 `/result/full-report` 이동 확인, 로딩 화면 가로 오버플로 없음과 콘솔 에러 없음 확인. 이동 후 `/result/full-report`에서 세션 부재로 401 리소스 에러가 찍히는 것은 테스트 환경의 프리미엄 세션 없음 때문이며 로딩 라우트 에러는 아니었다.
- 문제/주의점: 첫 Playwright 검증은 PowerShell 파이프 인코딩으로 한국어 selector가 깨져 실패했고, 다음 검증은 Node 실행 옵션 오류로 실패했다. 검증 스크립트만 수정해 재검증 성공. 파문 전환 중 일시 가로 오버플로가 확인되어 로딩 페이지에 `overflow-x: hidden`을 추가했다.
- 다음 작업: 실제 결제 완료 세션에서 로딩 후 `/result/full-report`가 세션 에러 없이 허브로 이어지는지 최종 확인하면 좋다.
- 재사용할 규칙: 유료 리포트 전용 진입 연출은 데이터 생성 스토리를 보여주되, 실제 결과 조회/API/결제 흐름과 분리하고 완료 후 기존 리포트 화면으로만 넘긴다.
- 규칙 승격 후보: `NULL`

### 2026-06-11 / 유료 리포트 Skin Match 5단계 루틴 리포트 전환
- 브랜치: feature/premium-report-flow-v1
- 작업 유형: 실행형
- 라우팅 판단: 유료 리포트 `app/result/full-report/page.js` 내부의 정보 구조, 화면 흐름, 카피, 컴포넌트 배치 변경이며 추천/API/DB/결제/저장 로직은 보호 구역으로 제외했다.
- 목표: 기존 Skin Match 6단계 흐름을 `현재 피부 기준 -> 하루 루틴 가이드 -> 제품별 사용 가이드 -> 상황별 조정법 -> 최종 요약` 5단계 루틴 리포트로 재정렬한다.
- 변경 파일: app/result/full-report/page.js, .codex/AI_WORK_LOG.md
- 보호 구역: 추천 알고리즘, 제품 점수식, 제품 DB, API 응답 필드, DB schema/migration/policy, 결제, 인증/리다이렉트, 저장 로직, production data는 수정하지 않았다.
- 검증 결과: `npm run build` 성공, `git diff --check -- app/result/full-report/page.js` 성공(CRLF warning만 있음), in-app Browser CSS 390px 기준 1/5~5/5 순서/라벨/콘텐츠 전환 확인, AM/PM이 2/5 한 화면에 함께 표시됨 확인, 3/5 제품 사용 기준과 보조 판매처 링크 확인, 4/5 상황별 조정 기준 확인, 5/5 저장 CTA와 안전 문구 확인, 가로 오버플로 없음, 콘솔 에러 없음, 금지 카피(14일/실행 플랜/처방/치료/개선 보장 계열) 화면 노출 없음 확인.
- 문제/주의점: 초기 브라우저 검증에서 step header는 바뀌지만 본문이 1단계에 머무는 전환 문제가 있어 `AnimatePresence mode="wait"` 래퍼를 제거하고 keyed `motion.div`로 전환했다. 재검증에서 1/5~5/5 본문 전환이 정상 동작했다.
- 다음 작업: 실제 로그인/저장 세션에서 `내 루틴 저장하기`가 현재 프로젝트의 My 페이지 경험과 자연스럽게 이어지는지 확인하면 좋다.
- 재사용할 규칙: 유료 Skin Match는 제품 구매보다 루틴 순서, 사용량, 생략/축소 기준을 먼저 보여주고, 구매 링크는 제품별 사용 가이드 안의 보조 액션으로 둔다.
- 규칙 승격 후보: `NULL`

### 2026-06-11 / 유료 리포트 Skin Match 첫 장 색감 보정
- 브랜치: feature/premium-report-flow-v1
- 작업 유형: 실행형
- 라우팅 판단: `app/result/full-report/page.js`의 Skin Match 첫 장 색상 토큰과 보조 포인트만 조정하는 UI 작업이며, 정보 구조와 추천/API/DB/결제/저장 로직은 범위에서 제외했다.
- 목표: 이미지 시안에서 따라온 보라색 네온 톤을 낮추고, Be Jewely 스킨케어 리포트 톤에 맞춰 코랄, 피치, 로즈 브라운 중심으로 색감을 보정한다.
- 변경 파일: app/result/full-report/page.js, .codex/AI_WORK_LOG.md
- 보호 구역: 추천 알고리즘, 제품 DB, API 응답 필드, DB schema/migration/policy, 결제, 인증/리다이렉트, 저장 로직, Step5/무료 결과 로직은 수정하지 않았다.
- 검증 결과: `npm run build` 성공, `git diff --check -- app/result/full-report/page.js` 성공(CRLF warning만 있음). 첫 장의 섹션 제목, 히어로 강조 텍스트, 중심 제품 카드 하이라이트, 우선 실행 배지, 상세 버튼, 체크 포인트 아이콘, AI 판단 장식 그래픽에서 보라색 계열을 코랄/피치/로즈 계열로 교체했다.
- 문제/주의점: in-app Browser가 `http://localhost:3001/result/full-report` 검증 중 URL policy 차단을 반환해 모바일 390px 다크/라이트 화면, 콘솔 에러, 가로 오버플로는 이번 턴에서 직접 확인하지 못했다. 이 실패는 코드 문제가 아니라 브라우저 검증 도구 접근 차단으로 기록한다.
- 다음 작업: 브라우저 접근이 가능해지면 390px 다크/라이트에서 첫 장 색감과 CTA 코랄/피치 유지 여부를 눈으로 최종 확인한다.
- 재사용할 규칙: 유료 리포트 첫 장에서 보라색은 주조색으로 쓰지 않고, 필요한 경우 탭/작은 보조 포인트 수준으로 제한한다.
- 규칙 승격 후보: `NULL`

### 2026-06-11 / 유료 리포트 Skin Match 1-6 첫 장 재배치 및 레이아웃 고도화

- 브랜치: feature/premium-report-flow-v1
- 작업 유형: 실행형
- 라우팅 판단: 수정 대상이 `app/result/full-report/page.js`의 Skin Match 1/6 UI와 문구로 한정되고, 추천/API/DB/결제/인증 변경 없이 정보 배치와 카드 위계만 조정하는 Medium UI 작업이므로 실행형으로 처리
- 목표: 1/6 `오늘 시작 플랜`을 현재 피부 기준 → 중심 제품 → AI 판단 → 우선 실행 3가지 → 체크 포인트 → 다음 루틴 CTA 흐름으로 재배치하고, 참고 이미지 톤에 맞춰 큰 히어로/2열 상단/강조 AI 판단/3카드 실행/체크 포인트 레이아웃으로 고도화
- 변경 파일: app/result/full-report/page.js, .codex/AI_WORK_LOG.md
- 보호 구역: 추천 로직, API, DB schema/migration/policy, 결제, 인증/리다이렉트, 제품 데이터, Skin Match 2/6~6/6 순서, Face Lab 구조 미수정
- 검증 결과: npm run build 성공, git diff --check 성공(CRLF warning만 있음), in-app Browser에서 390px 기준 1/6 표시/섹션 순서/가로 오버플로 없음/콘솔 에러 없음 확인, 진행 점 클릭으로 1/6~6/6 순서 유지 확인
- 문제/주의점: 초기 `npm run build`가 `ENOENT: no such file or directory, open '.next\server\app\_not-found\page.js.nft.json'`로 2회 실패했다. `.next` 삭제만으로는 해결되지 않았고, 남아 있던 build 관련 node 프로세스 종료 후 재실행하자 성공했다. in-app Browser viewport override는 장치 배율 영향이 있어 CSS innerWidth 390px가 되도록 보정해 확인함
- 다음 작업: 실제 유료 데이터 세션에서 제품 이미지가 있는 경우 중심 제품 카드의 시각 밀도를 최종 확인
- 재사용할 규칙: 유료 리포트 첫 장은 무료 진단을 반복하지 않고 현재 기준, 플랜 앵커, 판단, 실행, 체크 기준, 다음 CTA 순서로 연결한다.
- 규칙 승격 후보: `NULL`

### 2026-06-11 / my page i18n route completion

- 브랜치: feature/premium-report-flow-v1
- 작업 유형: 진단형 후 실행형
- 라우팅 판단: `/my`의 locale route와 UI copy 누락 원인 확인이 먼저 필요해 진단형으로 시작했고, 원인이 `/en/my` route 부재와 `components/my` 하드코딩 문구로 좁혀져 실행형으로 전환
- 목표: `/my`, `/ko/my`, `/en/my`와 check-in 하위 흐름에서 ko/en UI copy를 동일 key 구조로 제공하고, `/my` 하위 컴포넌트의 한국어 하드코딩을 제거
- 변경 파일: lib/my/i18n.js, app/my/page.js, app/my/check-in/page.js, app/en/my/page.js, app/en/my/check-in/page.js, app/ko/my/page.js, app/ko/my/check-in/page.js, components/my/MyDashboard.jsx, components/my/MyDashboardMenu.jsx, components/my/TodayCheckInPrompt.jsx, components/my/TodayRoutineCard.jsx, components/my/SkinProfileSummaryCard.jsx, components/my/DailyCheckInForm.jsx, components/auth/AuthNav.jsx, .codex/AI_WORK_LOG.md
- 보호 구역: DB schema/migration/policy, 저장 데이터 구조, API 응답 필드, 추천 로직, 결제 로직은 수정하지 않음. 인증/리다이렉트 로직은 직접 변경하지 않고 UI 링크와 route wrapper의 기존 미인증 redirect 대상만 locale copy로 연결
- 검증 결과: npm run build 성공, `/en/my`, `/en/my/check-in`, `/ko/my`, `/ko/my/check-in` route 생성 확인, `ko/en` copy key/type shape 일치 확인, `/my` import 경로의 한국어 하드코딩 검색 결과 없음, 비로그인 브라우저에서 `/my`/`/ko/my`는 `/`, `/en/my`는 `/en`으로 이동 확인
- 문제/주의점: 첫 빌드는 실행 중인 Next dev/start 프로세스와 `.next` 산출물 충돌로 `/opengraph-image.png`의 `webpack-runtime.js` 누락, 이후 `_not-found/page.js.nft.json` 누락 에러가 발생함. 프로젝트 Next 프로세스를 종료하고 `.next`를 정리한 뒤 재빌드 성공. 현재 브라우저에 로그인 세션과 저장된 테스트 데이터가 없어 실제 저장 결과 없음/있음 대시보드 상태는 UI 코드 경로와 build로만 확인했고, DB 원문 데이터는 이번 작업 범위상 번역하지 않음
- 다음 작업: 실제 로그인 세션에서 저장 결과 없음, 저장 결과 있음, today check-in 완료/미완료 상태를 `/my`와 `/en/my`에서 최종 화면 확인
- 재사용할 규칙: locale route를 추가할 때 page route만 만들지 말고 해당 화면의 menu/auth link/check-in 하위 경로까지 같은 copy source로 연결한다.
- 규칙 승격 후보: `NULL`
- Context 반영 후보: `NULL`

### 2026-06-11 / my locale route policy cleanup

- 브랜치: feature/premium-report-flow-v1
- 작업 유형: 진단형 후 제한 실행형
- 라우팅 판단: `/en/my`를 공식 경로로 유지하면서 `/ko/my` alias와 인증 보호 경로를 정리하는 작업이며, 인증 middleware의 리다이렉트 조건을 포함하므로 기존 구조 확인 후 제한 실행
- 목표: `/ko/my`와 `/ko/my/check-in`은 공식 한국어 경로로 redirect하고, `/en/my`와 `/en/my/check-in`을 보호 경로에 포함하며, 내부 `/my` 링크가 locale 정책을 따르도록 정리
- 변경 파일: app/ko/my/page.js, app/ko/my/check-in/page.js, lib/supabase/middleware.js, components/result/SaveReportCTA.jsx, app/result/page.js, .codex/AI_WORK_LOG.md
- 보호 구역: 인증 middleware는 사용자 명시 요청 범위 안에서 보호 경로와 미인증 redirect 대상만 변경. DB schema/migration/policy, 저장 데이터 구조, API 응답 필드, 결제, 추천 로직은 수정하지 않음
- Locale routing policy: Korean uses unprefixed routes (`/my`, `/result`). English uses `/en` prefixed routes (`/en/my`, `/en/result`). `/ko` prefixed routes are not official public routes. If `/ko` aliases exist, they should redirect to the unprefixed Korean route.
- 검증 결과: `npm run build` 성공. `git diff --check` 성공(CRLF warning만 있음). `/ko/my` 내부 링크 검색 결과 없음. 비로그인 redirect 확인: `/my` -> `/`, `/my/check-in` -> `/`, `/en/my` -> `/en`, `/en/my/check-in` -> `/en`, `/ko/my` -> `/my`, `/ko/my/check-in` -> `/my/check-in`
- 문제/주의점: `/ko`는 공식 public route가 아니므로 wrapper 구현을 유지하지 않고 redirect만 수행. 첫 `npm run build`는 실행 중인 Next 서버가 `.next` 산출물을 사용 중인 상태에서 `ENOENT: no such file or directory, open '.next\server\pages-manifest.json'`로 실패했고, 프로젝트 Next 서버를 종료한 뒤 `.next`를 삭제하고 재실행해 성공
- 다음 작업: 실제 로그인 세션에서 `/en/my`와 `/en/my/check-in` 진입 시 공통 구현이 영어 UI로 유지되는지 최종 화면 확인
- 재사용할 규칙: locale 정책이 unprefixed ko + `/en` prefix라면 `/ko` 구현을 만들지 말고 필요한 경우 redirect alias로만 둔다.
- 규칙 승격 후보: Locale routing policy 항목은 `.codex/AI_CONTEXT.md` Bridge 후보
- Context 반영 후보: Bridge

### 2026-06-11 / my check-in local date alignment

- 브랜치: feature/premium-report-flow-v1
- 작업 유형: 진단형 후 실행형
- 라우팅 판단: 현재 브랜치 목적 불일치로 1차 중단했으나, 사용자가 현재 브랜치 작업을 명시 승인했고, DB schema/migration 없이 `/my` check-in/routine 날짜 조회 기준만 맞추는 제한 작업으로 실행
- 목표: daily check-in 저장 날짜와 `/my` 대시보드 조회 날짜를 사용자 브라우저 local date 기준으로 맞추고, Asia/Seoul 고정 today 계산을 제거
- 변경 파일: components/my/DailyCheckInForm.jsx, components/my/MyDashboard.jsx, app/api/my/check-in/route.js, app/api/my/dashboard/route.js, lib/my/dashboard.js, lib/my/local-date.js, .codex/AI_WORK_LOG.md
- 보호 구역: DB schema/migration/policy, 저장 테이블 구조, API 기존 응답 필드, 인증/권한/결제/추천 로직은 수정하지 않음. check-in API 저장 경로는 사용자 승인 범위 안에서 형식/범위 검증만 추가
- 검증 결과: npm run build 성공, git diff --check 통과(CRLF warning만 있음), app/components/lib 내 Asia/Seoul 고정 조회 코드 없음 확인, in-app Browser로 `/my` 접근 시 미인증 상태에서 `/` redirect 및 런타임 표시 확인
- 문제/주의점: 인증 세션이 없어 실제 `/my` 대시보드의 todayCheckin/todayRoutine DB 조회 결과는 브라우저에서 직접 확인하지 못함
- 다음 작업: 실제 로그인 세션에서 다른 timezone 브라우저 기준으로 `/my/check-in` 저장 후 `/my` today check-in/routine 노출을 확인
- 재사용할 규칙: 사용자 달력 날짜와 UTC 이벤트 타임스탬프는 역할을 분리하고, 저장/조회 날짜 컬럼은 같은 local date context를 사용한다.
- 규칙 승격 후보: `NULL`
- Context 반영 후보: `NULL`

### 2026-06-11 / my check-in local date self-review

- 브랜치: feature/premium-report-flow-v1
- 작업 유형: 리뷰형 후 제한 실행형
- 라우팅 판단: 직전 daily check-in localDate 변경 결과의 자체 점검 요청이며, source of truth와 fallback 주석만 최소 보강
- 목표: `/my` 서버 props와 클라이언트 재조회 데이터 흐름, localDate fallback, UTC 기준 ±2일 검증, 날짜 역할 문서화를 점검
- 변경 파일: components/my/MyDashboard.jsx, lib/my/local-date.js, .codex/AI_WORK_LOG.md
- 보호 구역: DB schema/migration/policy, API 응답 필드, UI 구조, 인증/권한/결제/추천 로직 미수정
- 검증 결과: npm run build 성공, git diff --check 통과(CRLF warning만 있음), `rg "Asia/Seoul|getKoreaDateString" app components lib -n` 결과 없음. `npm run lint`는 ESLint 미설정 프로젝트라 Next.js가 설정 프롬프트를 띄우며 종료되어 수행 불가
- 문제/주의점: `/my` 첫 서버 렌더는 UTC fallback payload를 쓰고, 클라이언트 refresh 성공 후 브라우저 localDate payload가 source of truth가 된다. 이 흐름을 코드 주석으로 명확히 함
- 다음 작업: 실제 로그인 세션에서 `/my/check-in` 저장 후 `/my` 클라이언트 재조회 payload가 같은 localDate를 쓰는지 확인
- 재사용할 규칙: 서버 렌더 fallback과 클라이언트 보정 payload가 공존할 때는 어떤 payload가 최종 source of truth인지 코드에 남긴다.
- 규칙 승격 후보: `NULL`
- Context 반영 후보: `NULL`

### 2026-05-22 / result 저장 CTA 위치 조정

- 브랜치: feature/revisit-core-db
- 작업 유형: 실행형
- 라우팅 판단: 수정 대상과 목표가 명확하고, 저장 CTA 표시 위치 중심의 제한된 UI 작업이므로 실행형으로 처리
- 목표: /result 저장 CTA를 무료 결과 마지막 step 아래 1회만 노출하고, 공유 액션은 최하단 compact group으로 유지
- 변경 파일: app/result/page.js, components/result/ResultOverviewStep.jsx, components/result/SaveReportCTA.jsx
- 보호 구역: 저장 API 로직, 저장 데이터 구조, 공유 액션 로직, 기존 워킹트리의 무관한 변경 파일
- 검증 결과: npm run build 성공, git diff --check 성공, /test-result 390px overflow 없음, 마지막 step에서 저장 CTA 1회 노출 확인, 저장 후 ✓ 저장됨 및 My skin 링크 확인
- 문제/주의점: 기존 워킹트리에 이전 변경 파일이 남아 있어 해당 파일은 되돌리지 않음
- 다음 작업: 필요 시 최종 모바일 스크린샷 기준으로 spacing만 추가 조정
- 재사용할 규칙: CTA 위치 조정 작업은 저장/API 로직과 분리하고, 표시 조건과 레이아웃만 수정한다.
- 규칙 승격 후보: UI 작업에서 기존 워킹트리 변경 파일이 있으면 되돌리지 않고 작업 범위 밖으로 명시한다.
- Context 반영 후보: `NULL`

### 2026-05-22 / result 저장 후 floating nudge

- 브랜치: feature/revisit-core-db
- 작업 유형: 실행형
- 라우팅 판단: 저장 완료 이후의 안내 UI 표시 조건 조정이며, 저장/API 로직 변경 없이 상태 기반 UI만 수정하므로 실행형으로 처리
- 목표: 저장 완료 후 마지막 step이 아닌 화면에서만 My skin 이동 floating nudge를 제공
- 변경 파일: app/result/page.js, components/result/SaveReportCTA.jsx
- 보호 구역: 저장 API 로직, 저장 성공 판정 로직, 결과 데이터 구조, 라우팅 목적지
- 검증 결과: npm run build 성공, git diff --check 성공, /test-result 390px overflow 없음, 저장 전 floating 없음 확인, 저장 후 마지막 step [이전]/[저장된 결과 보러가기] 확인, 이전 step floating nudge 확인, floating 클릭 시 /my 이동 확인
- 문제/주의점: 저장 성공 alert는 기존 저장 완료 상태 전환 직후 노출되며 저장/API 로직은 변경하지 않음
- 다음 작업: 실제 모바일 화면에서 floating 위치가 하단 OS UI와 겹치면 bottom spacing만 추가 조정
- 재사용할 규칙: 상태 기반 안내 UI는 저장 전, 저장 중, 저장 후, 현재 화면 위치 조건을 분리해서 처리한다.
- 규칙 승격 후보: 저장 이후 안내 UI는 핵심 저장 로직과 분리하고, 상태값과 화면 위치 조건만으로 제어한다.
- Context 반영 후보: `NULL`

### 2026-05-26 / 비주얼리 에러 빈 상태 UI 정리

- 브랜치: main
- 작업 유형: 실행형
- 라우팅 판단: 공통 에러/빈 상태 컴포넌트와 관련 화면 교체가 목표로 명확하고, 저장/API/인증/결제 로직을 건드리지 않는 UI 중심 작업이므로 실행형으로 처리
- 목표: Next.js 기본 에러 느낌을 제거하고 light/dark 브랜드 로고를 사용하는 에러/빈 상태 UI로 통일
- 변경 파일: components/common/ErrorState.jsx, app/error.js, app/not-found.js, app/result/page.js, app/result/full-report/page.js, public/images/brand/bejewely-icon-light.png, public/images/brand/bejewely-icon-dark.png
- 보호 구역: 인증/권한, DB schema/migration/policy, 결제 로직, API response field names, 저장 데이터 구조, 배포 설정
- 검증 결과: npm run build 성공, git diff --check 성공, 390px Playwright 확인에서 404/result empty/analysis failed/full-report empty/error boundary 화면 overflow 없음, light 로고와 dark 로고 분기 확인, 버튼 href 확인
- 문제/주의점: 요청은 main 작업이었지만 기존 feature 브랜치에 미커밋 변경이 있어 `codex-preserve-before-main-error-state` stash로 보존 후 main으로 전환함. `/my` 라우트는 main에 없어 새 화면을 만들지 않고 기존 결과 없음 상태만 교체함.
- 다음 작업: 저장 결과 목록 화면이 추가되면 result_empty 보조 액션을 `/my`로 연결할 수 있음
- 재사용할 규칙: 공통 에러 UI는 개발자용 에러 문자열을 직접 노출하지 않고, 행동 가능한 CTA와 브랜드 로고를 우선한다.
- 규칙 승격 후보: `NULL`
- Context 반영 후보: `NULL`

### 2026-05-26 / feature 브랜치 main merge 반영

- 브랜치: feature/revisit-core-db
- 작업 유형: 실행형
- 라우팅 판단: 사용자가 main 반영 방식을 merge로 명확히 지정했고, commit/push 없이 병합 결과와 검증만 수행하는 제한 작업이므로 실행형으로 처리
- 목표: feature/revisit-core-db에 main 최신 변경사항을 반영하되 merge commit은 만들지 않고 build/diff 검증까지 확인
- 변경 파일: main merge 반영 파일 전체, 기존 stash 복원 파일(.gitignore, AGENTS.md, components/result/SaveReportCTA.jsx, img/Bejewely_icon.png, img/bejewely-icon-dark.png, img/bejewely-icon-light.png), data/hwahae-review-signals/categories/moisturizer/balm/.gitkeep, data/hwahae-review-signals/categories/moisturizer/gel/.gitkeep
- 보호 구역: commit/push 미수행, merge commit 생성 방지를 위해 --no-commit --no-ff 사용, 인증/DB/결제/배포 설정 수동 수정 없음
- 검증 결과: git merge --no-commit --no-ff main 충돌 없음, git stash pop 충돌 없음, npm run build 성공, git diff --check 성공, git diff --cached --check 성공, git diff HEAD --check 성공
- 문제/주의점: main에서 들어온 .gitkeep 두 파일에 trailing whitespace가 있어 제거 후 staging함. 현재 MERGE_HEAD가 남아 있어 사용자가 commit 또는 merge abort로 마무리해야 함.
- 다음 작업: 수동 리뷰 대상 파일 확인 후 문제가 없으면 merge commit 생성, 문제가 있으면 git merge --abort 또는 필요한 파일만 조정
- 재사용할 규칙: commit 금지 조건이 있는 merge 작업은 --no-commit --no-ff로 병합 결과만 만들고 검증한다.
- 규칙 승격 후보: `NULL`
- Context 반영 후보: `NULL`

### 2026-05-26 / my 햄버거 메뉴 연결

- 브랜치: feature/revisit-core-db
- 작업 유형: 실행형
- 라우팅 판단: /my 헤더 UI에서 로그아웃 버튼 노출 위치만 변경하는 요청이며, 인증/로그아웃 로직과 라우트는 그대로 유지하므로 실행형으로 처리
- 목표: /my 상단의 노출된 로그아웃 버튼을 제거하고 햄버거 메뉴 안으로 이동
- 변경 파일: components/my/MyDashboard.jsx, components/my/MyDashboardMenu.jsx
- 보호 구역: /api/auth/signout 라우트, 인증 세션 처리, dashboard payload, DB/API 로직
- 검증 결과: npm run build 성공, git diff --check 성공, /my에서 헤더 로그아웃 버튼 미노출 확인, 햄버거 메뉴 open 시 로그아웃 href가 /api/auth/signout인 것 확인
- 문제/주의점: 로그아웃 동작 자체는 기존 href를 그대로 사용하며 직접 클릭 검증은 세션 종료를 유발하므로 수행하지 않음
- 다음 작업: /my 메뉴에 추가 항목이 필요하면 result/full-report 메뉴와 항목 체계를 맞춰 확장
- 재사용할 규칙: 계정 액션은 화면 주요 CTA처럼 노출하지 않고, 필요 시 compact menu 안으로 이동한다.
- 규칙 승격 후보: `NULL`
- Context 반영 후보: `NULL`

### 2026-05-26 / 공용 햄버거 메뉴 컴포넌트 정리

- 브랜치: feature/revisit-core-db
- 작업 유형: 실행형
- 라우팅 판단: result/full-report/my 헤더 메뉴 UI의 중복 구현을 공용 컴포넌트로 묶는 제한된 UI 구조 정리이며, 인증/저장/API 로직 변경 없이 표시 컴포넌트만 조정하므로 실행형으로 처리
- 목표: 화면별로 달라진 햄버거 메뉴 구성을 언어, 계정, 화면 모드, 보조 액션 구조로 통일
- 변경 파일: components/navigation/AppHamburgerMenu.jsx, components/my/MyDashboardMenu.jsx, components/my/MyDashboard.jsx, app/result/page.js, app/result/full-report/page.js
- 보호 구역: 인증 세션 처리, /api/auth/signout 라우트, 저장/공유/full-report 데이터 로직, DB/API 로직
- 검증 결과: npm run build 성공, git diff --check 성공, /my 헤더에서 노출 로그아웃 제거 확인, /my 메뉴 open 시 언어/계정/화면 모드/무료 진단 시작하기 확인, /test-result 메뉴 open 시 언어/계정/화면 모드/다시 테스트하기 확인, /test-full-report 메뉴 open 시 언어/계정/화면 모드/무료 결과로 돌아가기/다시 테스트하기 확인, 425px viewport overflow 없음 확인
- 문제/주의점: /my는 영어 전용 대시보드 라우트가 없어 English 메뉴는 /en 랜딩으로 보낸다.
- 다음 작업: /en/my가 생기면 MyDashboardMenu의 English href를 /en/my로 교체
- 재사용할 규칙: 동일 헤더 메뉴는 화면마다 직접 복사하지 말고 공용 컴포넌트로 구성만 주입한다.
- 규칙 승격 후보: 공통 메뉴/헤더 UI는 한 컴포넌트에 모으고 화면별 액션만 props로 분리한다.
- Context 반영 후보: Candidates

### 2026-05-27 / result UX main merge 전 최종 점검

- 브랜치: feature/revisit-core-db
- 작업 유형: 진단형
- 라우팅 판단: main merge 전 변경 범위, 빌드, diff, 모바일 회귀를 확인하는 점검 작업이며 새 기능/UI 변경 없이 검증 중심으로 처리
- 목표: revisit/result UX 변경이 main 병합 가능한 상태인지 확인
- 변경 파일: docs/Bejewely-revisit-db-erd-v0.2.md, docs/Bejewely-revisit-implementation-plan-v0.2-fixed.md, docs/Bejewely-revisit-usecase-v0.2.md, .codex/AI_WORK_LOG.md
- 보호 구역: result/auth/save/share/full-report 로직 및 UI 재배치 미수정, DB schema 미수정
- 검증 결과: npm run build 성공, git diff --check 성공(CRLF warning만 남음), main 기준 diff-check trailing whitespace 3건 제거, /result 390px overflow 없음, hamburger/language/theme/save/floating/full-report/share page/image save 수동 확인, build 성공 후 /result smoke 재확인
- 문제/주의점: 최초 npm run build는 dev server가 살아있는 상태에서 Next.js 15.5.14 초기 출력 이후 9분 이상 추가 로그 없이 멈췄다. dev server와 build 프로세스를 모두 종료한 뒤 재실행하자 17.8초에 정상 완료되어, 코드 정적 렌더 hang이 아니라 concurrent dev/build 실행 영향으로 판단한다.
- 다음 작업: merge 전 build를 다시 실행할 때는 dev server를 먼저 종료한다.
- 재사용할 규칙: main merge 전 점검은 작업 브랜치 diff뿐 아니라 origin/main 기준 diff-check도 함께 확인한다.
- 규칙 승격 후보: `NULL`
- Context 반영 후보: `NULL`

### 2026-05-31 / Supabase anonymous user data policy hardening

- Branch: main
- Task type: diagnostic with limited execution
- Routing decision: Supabase RLS/auth policy work is High risk, but user explicitly requested applying only the anonymous-user policy restriction and committing/pushing it.
- Goal: Block Supabase anonymous-auth users from owner-scoped My Skin data policies while preserving permanent authenticated-user access.
- Changed files: supabase/migrations/20260531123349_restrict_anonymous_user_data_policies.sql
- Protected areas: DB policy touched with explicit user instruction; no env/auth redirect/deployment config changes.
- Validation: Applied SQL to linked Supabase project with `supabase db query --linked --file ...`; verified affected policies include `is_anonymous = false`; `supabase db advisors --linked --type security --level warn -o json` now reports only `auth_leaked_password_protection`.
- Notes/risks: Existing unrelated working-tree changes were not staged or modified. Leaked password protection remains a dashboard/plan-dependent Auth setting.
- Reusable rule: When anonymous Supabase sign-in is enabled, `to authenticated` RLS policies for account-owned data should explicitly exclude anonymous users with the JWT `is_anonymous` claim.
- Context promotion candidate: Bridge

### 2026-05-31 / 무료 결과 v2 흐름 실험

- 브랜치: feature/free-result-flow-v2
- 작업 유형: 실행형
- 라우팅 판단: 무료 결과 페이지의 UI/UX 흐름 조정이며, 수정 대상과 목표가 명확하고 API/DB/유료 리포트 구조를 건드리지 않는 제한된 UI 작업이므로 실행형으로 처리
- 목표: 무료 결과를 핵심 진단, 판단 근거, 우선순위, 추천 방향, Top Pick 미리보기, 루틴 방향, Face Lab 프리뷰, Full Report CTA 순서로 펼쳐 실제 화면 검토가 가능하게 만들기
- 변경 파일: app/result/page.js, .codex/AI_WORK_LOG.md
- 보호 구역: 유료 리포트 페이지, 추천 알고리즘, DB/API 응답 구조, 저장 데이터 구조, 인증/권한, 배포 설정 미수정
- 검증 결과: npm run build 성공, git diff --check 성공(CRLF warning만 있음), Browser로 /test-result 1/5~5/5 이동 확인, 390px Playwright 확인에서 5개 step 모두 가로 overflow 없음 및 console/page error 없음
- 문제/주의점: 기존 워킹트리에 데이터/스크립트/package.json 관련 사용자 변경이 있어 건드리지 않음. 사진/설문/Face Lab 구조화 값이 부족한 경우 무료 UI 표시용 fallback과 TODO 주석으로 처리함.
- 다음 작업: 실제 사용자 결과 화면 기준으로 카드 병합/삭제, 문구 압축, 모바일 첫 화면 정보량 조정
- 재사용할 규칙: 무료 결과 UI 실험은 API 응답 구조와 유료 리포트 구조를 바꾸지 않고, 기존 결과 데이터와 표시용 fallback helper만으로 먼저 검증한다.
- 규칙 승격 후보: `NULL`
- Context 반영 후보: `NULL`

### 2026-05-31 / 무료 결과 v2 문구 직관화

- 브랜치: feature/free-result-flow-v2
- 작업 유형: 실행형
- 라우팅 판단: 무료 결과 v2 화면의 1/5, 2/5, 4/5 문구와 표시 방식만 조정하는 UI 작업이며, 기능 로직/API/DB/유료 리포트 구조 변경이 없으므로 실행형으로 처리
- 목표: 핵심 진단은 체감 묘사를 먼저 보여주고, 판단 근거는 사진/설문 신호를 해석 문장으로 연결하며, 루틴 방향은 긴 설명 대신 AM/PM 단계형 흐름으로 압축
- 변경 파일: app/result/page.js, .codex/AI_WORK_LOG.md
- 보호 구역: 추천 알고리즘, API 응답 구조, DB/저장 데이터, Full Report 페이지, 인증/권한, 배포 설정 미수정
- 검증 결과: npm run build 성공, git diff --check 성공(CRLF warning만 있음), /test-result 390px Playwright 확인에서 1/5 체감 문장/진단명, 2/5 해석 문장/종합 해석, 4/5 AM/PM pill 흐름과 gate 문구 확인, 가로 overflow 없음, console/page error 없음
- 문제/주의점: 기존 5단계 시퀀스와 카드 구성은 유지하고 텍스트 밀도만 낮춤
- 다음 작업: 실제 결과 데이터별로 1/5 체감 문장의 분기 문구가 과하게 일반적이지 않은지 샘플별로 비교
- 재사용할 규칙: 무료 결과 첫 문장은 분류명보다 사용자가 체감할 상태 묘사를 우선하고, 분류명은 보조 태그로 낮춘다.
- 규칙 승격 후보: `NULL`
- Context 반영 후보: `NULL`

### 2026-06-01 / 무료 결과 v2 AI 리포트감 보강

- 브랜치: feature/free-result-flow-v2
- 작업 유형: 실행형
- 라우팅 판단: 2/5, 4/5, 5/5 무료 결과 화면의 시각 표현 보강이며, API/추천 로직/Step 수/저장 구조 변경 없이 단일 결과 UI 파일 중심으로 제한되는 작업이라 실행형으로 처리
- 목표: 판단 근거 사진에 AI 분석 오버레이를 추가하고, 루틴 방향을 미니 흐름 다이어그램으로 보강하며, 전체 리포트 프리뷰 항목에 썸네일 미리보기를 추가
- 변경 파일: app/result/page.js, .codex/AI_WORK_LOG.md
- 보호 구역: API 응답 필드, 추천 로직, Step 수, 저장 데이터 구조, 인증/권한, DB/배포 설정 미수정
- 검증 결과: git diff --check 통과(CRLF warning만 있음), npm run build 성공, Browser로 390px 모바일 폭에서 2/5·4/5·5/5 진행 확인, Playwright 390px dark screenshot 3장 생성, 2/5·4/5·5/5 scrollWidth 390 및 console/page error 없음 확인
- 문제/주의점: in-app Browser fullPage screenshot은 CDP capture timeout이 발생해, Browser 상태 검증 후 별도 Playwright로 동일 localhost 390px 스크린샷을 생성함
- 다음 작업: 실제 사용자 사진 비율이 다양한 경우 오버레이 라벨 위치가 얼굴을 과하게 가리지 않는지 샘플별로 미세 조정
- 재사용할 규칙: 무료 결과의 리포트감 강화는 분석/추천 데이터 구조를 바꾸지 않고, 기존 표시 데이터 위에 시각적 근거와 미리보기 레이어를 얹어 먼저 검증한다.
- 규칙 승격 후보: `NULL`
- Context 반영 후보: `NULL`
### 2026-06-01 / free result v2 step 1 summary cleanup

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 1 UI/UX cleanup in `app/result/page.js` only; API, DB, recommendation logic, storage, auth, and full-report routes were out of scope.
- Goal: Refocus 1/5 on the skin summary by removing repeated Face Lab and recommendation direction content from Step 1, then moving those sections to Step 4.
- Changed files: app/result/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check` passed with CRLF warnings only; `npm run build` passed; `/test-result` 390px Playwright smoke passed for 1/5 through 4/5; Step 1 scrollWidth/clientWidth stayed 390/390, console/page errors were empty, and Step 1 scrollHeight reduced from the prior 1842px check to 1272px.
- Notes/risks: Existing unrelated dirty files remained untouched. Step 4 is longer because it now carries the moved recommendation direction and Face Lab preview.
- Reusable rule: The free result first step should remain a summary page; recommendation direction and style/mood previews belong later in the flow.
- Context promotion candidate: Candidates

### 2026-06-01 / free result v2 step 3 recommendation guide merge

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 1 and Step 3/4 UI structure cleanup in `app/result/page.js` only; API, DB, recommendation logic, storage, auth, and full-report routes were out of scope.
- Goal: Move the Face Lab summary back into Step 1 as secondary information, merge Top Pick and routine usage into a new Step 3 recommendation/use guide, and leave Step 4 as an expected-change placeholder.
- Changed files: app/result/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check` passed with CRLF warnings only; `npm run build` passed; `/test-result` 390px Playwright smoke passed for 1/5 through 4/5; Step 1/3/4 scrollWidth/clientWidth stayed 390/390, console/page errors were empty.
- Notes/risks: Step 4 is intentionally a placeholder for the next expected-change task. Existing unrelated dirty files remained untouched.
- Reusable rule: Free result v2 should keep roles separated by step: 1 summary, 2 evidence, 3 recommendation plus use direction, 4 expected change, 5 premium continuation.
- Context promotion candidate: Candidates

### 2026-06-01 / free result v2 step 3 density refinement

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 3 UI density and copy refinement in `app/result/page.js` only; API, DB, recommendation logic, step count, and other result steps were out of scope.
- Goal: Improve the Step 3 recommendation/use guide layout using the reference for hierarchy and density while preserving the current information structure.
- Changed files: app/result/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check` passed with CRLF warnings only; `npm run build` passed; `/test-result` 390px Playwright check passed on Step 3 with scrollWidth/clientWidth 390/390 and no console/page errors.
- Notes/risks: The in-app browser control path had a click-runtime issue, so the 390px verification used Playwright directly against the same localhost page.
- Reusable rule: Step 3 should keep Top Pick compact, make the use routine the visual focus, and phrase locked cards as decisions the user can resolve.
- Context promotion candidate: Candidates

### 2026-06-02 / free result v2 step 3 mobile readability cleanup

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 3 UI-only cleanup in `app/result/page.js`; recommendation logic, API, DB, data fields, step structure, and other steps were out of scope.
- Goal: Make Step 3 easier to scan on mobile by emphasizing the core product role, changing AM/PM routines to a clearer vertical flow, and compressing locked cards.
- Changed files: app/result/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check` passed with CRLF warnings only; `npm run build` passed; `/test-result` 390px Playwright check passed on Step 3 with scrollWidth/clientWidth 390/390 and no console/page errors.
- Notes/risks: Verification used Playwright directly against localhost:3001; no API/DB/recommendation code was changed.
- Reusable rule: On mobile, Step 3 roles should distinguish core vs supporting roles, routines should read vertically, and locked cards should use compact decision-oriented rows.
- Context promotion candidate: Candidates

### 2026-06-02 / free result v2 step 4 management checkpoints

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 4 UI role rebuild in `app/result/page.js`; API, DB, recommendation logic, data fields, payment, and full-report pages were out of scope.
- Goal: Replace the temporary routine/expected-change Step 4 with a management checkpoint page focused on observation, maintenance, and caution signals after applying the recommendation.
- Changed files: app/result/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check` passed with CRLF warnings only; `npm run build` passed; `/test-result` 390px Playwright check passed on Step 4 with scrollWidth/clientWidth 390/390, no console/page errors, required checkpoint sections present, and forbidden Step 3 repeats absent.
- Notes/risks: Step 4 now has a clearer management role, but the final flow still needs the next UX decision for whether Step 4 should become expected-change content later or keep the checkpoint role.
- Reusable rule: Step 4 should avoid Top Pick, AM/PM routine, Face Lab, current-priority, and recommendation-direction repeats; it should focus on management, observation, and caution.
- Context promotion candidate: Candidates

### 2026-06-02 / free result v2 step 4 recommendation validation

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 4 UI-only role change in `app/result/page.js`; API, DB, recommendation logic, data fields, payment, and full-report pages were out of scope.
- Goal: Reframe Step 4 from management checkpoints into a recommendation validation page that helps the user judge whether the recommended routine fits their skin.
- Changed files: app/result/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check` passed with CRLF warnings only; `npm run build` passed; `/test-result` 390px Playwright check passed on Step 4 with scrollWidth/clientWidth 390/390, no console/page errors, required validation sections present, and Step 3 repeats absent.
- Notes/risks: Section 1 uses four fit signals, so Step 4 is slightly longer than the reference. The hierarchy is clearer, but the Step 4-to-Step 5 CTA wording may still need tuning after Step 5 is finalized.
- Reusable rule: Step 4 should answer "how do I know this recommendation fits?" with positive fit signals and adjustment signals, not repeat recommendation product, AM/PM routine, Face Lab, or priority content.
- Context promotion candidate: Candidates

### 2026-06-02 / free result v2 step 3 structure compression

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 3 UI structure refactor in `app/result/page.js`; API, DB, recommendation logic, data fields, payment, and full-report pages were out of scope.
- Goal: Compress Step 3 by merging product tags and role information, switching AM/PM routine display to a single tabbed routine card, and consolidating paid prompts into one preview list.
- Changed files: app/result/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check` passed with CRLF warnings only; `npm run build` passed; `/test-result` 390px Playwright check passed on Step 3 with scrollWidth/clientWidth 390/390, no console/page errors, default morning tab visible, night tab switch working, and Step 4 validation content absent from Step 3.
- Notes/risks: Step 3 is shorter and less lock-heavy, but the product image placeholder still limits the visual polish until a real product image is available.
- Reusable rule: Step 3 should show one recommendation, one active routine view, and one consolidated premium preview box; avoid separate lock cards and repeated fit/role tags.
- Context promotion candidate: Candidates

### 2026-06-02 / free result v2 step 4 signal toggle compression

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 4 UI-only refactor in `app/result/page.js`; API, DB, recommendation logic, data fields, payment, and other result steps were out of scope.
- Goal: Compress Step 4 into the same toggle pattern as Step 3, showing either fit signals or adjustment signals while consolidating the full-report preview into one list box.
- Changed files: app/result/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check` passed with CRLF warnings only; `npm run build` passed; `/test-result` 390px Playwright check passed on Step 4 with scrollWidth/clientWidth 390/390, no console/page errors, fit tab default active, adjustment tab switching correctly, and full-report items rendered as one list box.
- Notes/risks: Step 4 is now much shorter, but the visual balance depends on whether the full-report CTA remains below this step or moves into Step 5 copy later.
- Reusable rule: Step 4 validation signals should use one toggle card and one consolidated full-report preview; do not show fit and adjustment groups simultaneously.
- Context promotion candidate: Candidates

### 2026-06-02 / free result v2 step 5 execution guide conversion

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 5 UI-only premium conversion refactor in `app/result/page.js`, with display-label support in `components/result/SaveReportCTA.jsx`; API, DB, payment, recommendation logic, Full Report, and Step 1-4 content were out of scope.
- Goal: Replace the final locked-card list with a compact "my skin execution guide" conversion screen focused on order, frequency, avoided combinations, and alternatives.
- Changed files: app/result/page.js, components/result/SaveReportCTA.jsx, .codex/AI_WORK_LOG.md
- Protected areas: Auth/save behavior was not changed; `SaveReportCTA` only received optional label/helper text overrides for the final free-save presentation.
- Validation: `git diff --check` passed with CRLF warnings only; `npm run build` passed; `/test-result` 390px in-app browser check passed on localhost:3002 with scrollWidth/clientWidth 390/390, required Step 5 copy present, old large AM/PM cards absent, no new console/page errors, and a clean Playwright screenshot saved.
- Notes/risks: localhost:3001 was an older long-running Next server, so latest UI verification used a separate localhost:3002 dev server. Production `next start` cannot verify `/test-result` because that route redirects in production mode.
- Reusable rule: Step 5 should close the free flow with one execution-guide card, one blurred routine preview, one compact included-items list, and one primary action-oriented CTA.
- Context promotion candidate: Candidates

### 2026-06-04 / free result v2 step 2 evidence signal flip toggle

- 브랜치: feature/free-result-flow-v2
- 작업 유형: 실행형
- 라우팅 판단: /test-result Step 2의 판단 근거 카드 표시 방식만 바꾸는 제한된 UI 작업이며, API/DB/추천 로직/저장 구조/결제/Full Report는 범위 밖이므로 실행형으로 처리
- 목표: Step 3 루틴 카드처럼 사진/설문 신호를 토글로 전환하고, 신호 카드 영역 클릭 시 뒤집히는 애니메이션으로 두 신호 묶음을 확인하게 만들기
- 변경 파일: app/result/page.js, .codex/AI_WORK_LOG.md
- 보호 구역: API 응답 필드, 저장 데이터 구조, 인증/권한, DB schema/migration/policy, 결제, 배포 설정 미수정
- 검증 결과: `git diff --check` 통과(CRLF warning만 있음), `npm run build` 성공, in-app Browser에서 `/test-result` Step 2 진입 후 사진/설문 탭 각각 1개 노출 확인, 설문 탭 전환과 카드 클릭 후 사진 탭 복귀 확인, scrollWidth/clientWidth 380/380, console error 없음
- 문제/주의점: in-app Browser viewport screenshot 캡처는 CDP timeout으로 실패했지만, DOM/상태/폭/콘솔 검증은 완료함
- 다음 작업: 실제 모바일 화면에서 flip 전환이 너무 빠르거나 느리면 duration만 미세 조정
- 재사용할 규칙: 무료 결과의 병렬 근거 정보는 한 화면에 모두 펼치기보다 탭과 단일 active card로 압축해 텍스트 밀도를 낮춘다.
- 규칙 승격 후보: `NULL`
- Context 반영 후보: `NULL`

### 2026-06-04 / free result v2 step 2 photo cue reveal animation

- 브랜치: feature/free-result-flow-v2
- 작업 유형: 실행형
- 라우팅 판단: /test-result Step 2 사진 분석 카드의 설명 노출 방식만 조정하는 제한된 UI 작업이며, API/DB/추천 로직/저장 구조/인증/결제/Full Report는 범위 밖이므로 실행형으로 처리
- 목표: 사진 분석 설명 텍스트를 기본 숨김 상태로 두고, 사진을 누르면 유도 문구가 사라지며 설명 callout들이 튀어나오는 애니메이션을 적용
- 변경 파일: app/result/page.js, .codex/AI_WORK_LOG.md
- 보호 구역: API 응답 필드, 저장 데이터 구조, 인증/권한, DB schema/migration/policy, 결제, 배포 설정 미수정
- 검증 결과: `git diff --check` 통과(CRLF warning만 있음), `npm run build` 성공, Playwright 390px에서 Step 2 진입 확인, 사진 CTA `눌러보세요!` 기본 노출 확인, 사진 클릭 후 `aria-expanded=true` 및 유도 문구 제거 확인, scrollWidth/clientWidth 390/390, console/page error 없음
- 문제/주의점: in-app Browser 현재 탭에서는 하단 CTA 클릭이 step을 이동시키지 않아, 동일 localhost에 대해 별도 Playwright로 상호작용 검증함
- 다음 작업: 실제 모바일 화면에서 callout 튀어나오는 강도가 과하면 spring stiffness/damping만 미세 조정
- 재사용할 규칙: 사진 위 분석 설명은 처음부터 전부 노출하지 않고, 클릭 유도와 reveal 애니메이션으로 단계적으로 열어 모바일 밀도를 낮춘다.
- 규칙 승격 후보: `NULL`
- Context 반영 후보: `NULL`

### 2026-06-04 / free result v2 step 2 photo cue persistence

- 브랜치: feature/free-result-flow-v2
- 작업 유형: 실행형
- 라우팅 판단: Step 2 사진 분석 카드의 reveal 상태와 점선 오버레이 노출만 조정하는 UI 상태 작업이며, API/DB/추천 로직/저장 데이터/인증/결제/Full Report는 범위 밖이므로 실행형으로 처리
- 목표: 사진을 한 번 누른 뒤 다른 step이나 새로고침 후 돌아와도 분석 설명이 펼쳐진 상태로 유지되고, 점선 동그라미도 설명과 함께 나타나도록 조정
- 변경 파일: app/result/page.js, .codex/AI_WORK_LOG.md
- 보호 구역: API 응답 필드, 저장 데이터 구조, 인증/권한, DB schema/migration/policy, 결제, 배포 설정 미수정. UI reveal 여부만 sessionStorage에 저장
- 검증 결과: `git diff --check` 통과(CRLF warning만 있음), `npm run build` 성공, Playwright 390px에서 기본 상태 `aria-expanded=false`, CTA 노출, 점선 오버레이 `aria-hidden=true`/opacity 0 확인. 클릭 후 `aria-expanded=true`, CTA 제거, 점선 오버레이 `aria-hidden=false`/opacity 1 확인. Step 3 이동 후 이전 및 새로고침 후 Step 2 재진입에서도 펼쳐진 상태 유지 확인. scrollWidth/clientWidth 390/390, console/page error 없음
- 문제/주의점: 없음
- 다음 작업: 실제 모바일 화면에서 sessionStorage 유지 범위가 과하면 브라우저 세션 한정 대신 parent state로 좁힐 수 있음
- 재사용할 규칙: 인터랙션으로 한 번 연 분석 보조 정보는 같은 결과 확인 세션 안에서는 다시 접히지 않게 유지해 반복 클릭 부담을 줄인다.
- 규칙 승격 후보: `NULL`
- Context 반영 후보: `NULL`

### 2026-06-04 / free result v2 step 2 bridge CTA lead-in

- 브랜치: feature/free-result-flow-v2
- 작업 유형: 실행형
- 라우팅 판단: Step 2 마지막에 Step 3 CTA를 연결하는 단일 UI 요소를 추가하는 작업이며, API/DB/추천 로직/저장 데이터/인증/결제/Full Report는 범위 밖이므로 실행형으로 처리
- 목표: CTA 직전에 정보 카드보다 가벼운 bridge 영역을 추가해 "이 분석을 바탕으로 가장 적합한 제품과 활용 방법을 정리했습니다." 문구로 Step 2에서 Step 3로 자연스럽게 연결
- 변경 파일: app/result/page.js, .codex/AI_WORK_LOG.md
- 보호 구역: API 응답 필드, 저장 데이터 구조, 인증/권한, DB schema/migration/policy, 결제, 배포 설정 미수정
- 검증 결과: `git diff --check` 통과(CRLF warning만 있음), `npm run build` 성공, Playwright 390px에서 bridge 문구 노출, `종합 해석` 미노출 유지, bridge가 CTA 바로 위에 배치됨 확인, bridge 높이 66px, scrollWidth/clientWidth 390/390, console/page error 없음
- 문제/주의점: 없음
- 다음 작업: 실제 기기에서 CTA보다 bridge가 강하게 보이면 border/background opacity만 낮춰 조정
- 재사용할 규칙: Step 간 연결 문구는 독립 정보 카드가 아니라 CTA 직전의 낮은 무게 bridge로 처리해 다음 행동을 방해하지 않는다.
- 규칙 승격 후보: `NULL`
- Context 반영 후보: `NULL`

### 2026-06-04 / free result v2 step 1 diagnosis structure polish

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 1 UI-only polish in `app/result/page.js`; API, DB, recommendation logic, payment, result step count, and Step 2-5 structures were out of scope.
- Goal: Promote the one-line diagnosis, combine photo and compact pentagon parameters, reduce Face Lab into an auxiliary chip strip, and tighten priority TOP 3 with a subtle core badge.
- Changed files: app/result/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check` passed with CRLF warning only; `npm run build` passed; in-app Browser `/test-result` reload confirmed required Step 1 texts and no console errors; Playwright 390px checks passed for light and dark themes with scrollWidth/clientWidth 390/390 and required Step 1 labels/CTA present.
- Notes/risks: The top global result header still sits above Step 1, so the CTA is not guaranteed to be in the first viewport from absolute page top at 390px. Step 1 itself keeps the diagnosis first within the step and does not change data/recommendation behavior.
- Reusable rule: Step 1 should prioritize a large diagnosis statement, keep the photo plus pentagon as one compact visual summary, keep Face Lab as auxiliary chips, and show priority TOP 3 as the execution order.
- Context promotion candidate: NULL

### 2026-06-04 / free result v2 step 1 radar help modal

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 1 i-button copy and popover behavior in `app/result/page.js`; API, DB, recommendation logic, saved data, payment, and result step count were out of scope.
- Goal: Make the skin-state pentagon understandable by renaming axes to care-attention terms and connecting the i button to a compact explanatory modal.
- Changed files: app/result/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check` passed with CRLF warning only; `npm run build` passed; Playwright 390px light/dark checks confirmed the renamed axes, help modal title/body/axis list/footer copy, close button, outside-click close, scrollWidth/clientWidth 390/390, and no console/page errors.
- Notes/risks: The radar values remain display-only derived UI values. They should continue to be framed as care-priority signals, not exact skin scores.
- Reusable rule: When a visual summary uses derived skin axes, axis names and help copy should make the direction explicit: farther outward means stronger current care signal, not a medical measurement.
- Context promotion candidate: NULL

### 2026-06-04 / free result v2 step 1 mobile compression polish

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 1 UI compression and interaction polish in `app/result/page.js`; API, DB, recommendation logic, payment, saved data, and result step count were out of scope.
- Goal: Shorten radar labels, make the i button more discoverable without competing with CTA, organize Face Lab as grouped auxiliary info, remove the priority helper link, and collapse priority descriptions behind a simple accordion.
- Changed files: app/result/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check` passed with CRLF warning only; `npm run build` passed; in-app Browser `/test-result` reload confirmed short radar labels, Face Lab groups, removed priority helper link, and no browser errors; Playwright 390px light/dark checks confirmed short labels, help modal, grouped Face Lab, collapsed priority descriptions, first priority accordion open, scrollWidth/clientWidth 390/390, and no console/page errors.
- Notes/risks: The priority accordion defaults to all rows collapsed, so users must tap a priority row to read the short description.
- Reusable rule: Step 1 should keep derived radar labels short on the graph and move explanatory detail into help; priority text should default to title-first and reveal short detail only on tap.
- Context promotion candidate: NULL

### 2026-06-04 / free result v2 step 1 photo and radar structure split

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 1 UI-only structure rearrangement in `app/result/page.js`; API, DB, recommendation logic, payment, saved data, result step count, and Step 2-5 flow were out of scope.
- Goal: Keep the Step 1 information set while moving Face Lab beside a larger photo, separating the skin radar into its own card, and keeping priority TOP 3 below the radar.
- Changed files: app/result/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check` passed with CRLF warning only; `npm run build` passed; Playwright 390px checks confirmed the larger photo, standalone radar with legend, unclipped/non-overlapping radar labels, collapsed priority list, CTA visibility path, and scrollWidth/clientWidth parity.
- Notes/risks: Step 1 becomes taller because the photo/mood card and radar card are split. This improves photo and radar readability at the cost of slightly more vertical scroll.
- Reusable rule: When Step 1 has both face mood and skin-state visualization, keep Face Lab attached to the photo as auxiliary face mood context and keep the pentagon as a separate skin snapshot card.
- Context promotion candidate: NULL

### 2026-06-05 / free result v2 step 1 conclusion card experiment

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 1 UI-only experiment in `app/result/page.js`; recommendation logic, API, DB, payment, Face Lab, radar structure, result step count, and Step 2-5 flow were out of scope.
- Goal: Replace the free-form one-line diagnosis block with a compact conclusion card that makes the core result easier to notice without modal/position/absorption animation.
- Changed files: app/result/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check` passed with CRLF warning only; `npm run build` passed; in-app Browser 390-ish dark viewport confirmed conclusion card, photo/radar/priority order, no horizontal overflow, and no radar label clipping/overlap.
- Notes/risks: The conclusion card improves first-read clarity while reducing the large headline height, but it is visually less dramatic than the previous oversized text treatment by design.
- Reusable rule: Step 1 conclusion emphasis should use a lightweight static card plus one-time opacity/Y entrance only; avoid central popups, position movement, repeated animation, scale, and CTA-level visual weight.
- Context promotion candidate: NULL

### 2026-06-05 / free result v2 loading reveal test flow

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Development-only test route addition in `app/loading/page.js`; recommendation logic, API response shape, DB, payment, saved data, and existing Step 1-5 result flow were out of scope.
- Goal: Add a 15-second forced loading UX that changes analysis-stage copy, then reveals a one-line diagnosis completion screen with CTA into the existing `/test-result` Step 1 flow.
- Changed files: app/loading/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check` passed with CRLF warning only; `npm run build` passed and generated `/loading`; Playwright 390px light flow confirmed 0-5s/5-10s/10-15s active loading details, 15s completion reveal, CTA click to `/test-result`, Step 1 `RESULT STEP` 1/5, and no horizontal overflow; Playwright 390px dark completion screen confirmed completion copy, diagnosis, CTA, and no horizontal overflow; in-app Browser `/loading` flow confirmed 15s reveal and CTA navigation to `/test-result`.
- Notes/risks: `/loading` is a development verification route and redirects to `/` in production via client effect. It does not call analysis APIs or seed/write result data directly; `/test-result` continues to handle fixture seeding.
- Reusable rule: Result-entry experiments should be isolated on development routes first, use fixture-backed navigation, and avoid modifying production analysis or result data flow.
- Context promotion candidate: NULL

### 2026-06-05 / free result v2 step 1 radar dashboard polish

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 1 skin-state radar card internal UI polish in `app/result/page.js`; Step 1 overall structure, Face Lab, priority TOP 3, recommendation logic, API, DB, payment, saved data, and result step count were out of scope.
- Goal: Make the pentagon card read as an interpretable skin-state dashboard by adding a concise interpretation sentence, status sublabels, compact TOP3 signal chips, a slightly larger chart, and a quieter guide legend.
- Changed files: app/result/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check` passed with CRLF warning only; `npm run build` passed; in-app Browser `/test-result` reload confirmed the new radar interpretation and TOP3 chips with no label clipping/overlap; Playwright 390px light/dark checks confirmed interpretation text, signal chips, legend, SVG size 247x242, scrollWidth/clientWidth 390/390, no SVG label overlap/clipping, and no console/page errors.
- Notes/risks: The radar card is taller because it now includes interpretation and signal chips, but the chart remains below hero scale and the priority card remains the action-order section.
- Reusable rule: Radar cards should separate current-state signals from management priority: chart/chips summarize current signal strength, while priority TOP 3 remains the care order.
- Context promotion candidate: NULL

### 2026-06-05 / free result v2 step 1 radar card final spacing

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 1 internal UI polish and selected conclusion-card removal in `app/result/page.js`; Face Lab, priority TOP 3, recommendation logic, API, DB, payment, saved data, and result step count were out of scope.
- Goal: Finish the skin-state radar card by removing the strong divider, removing the repeated `핵심 신호 TOP3` label, moving the legend directly under the graph, keeping the chips lightweight, and removing the selected `AI 진단 결과` conclusion card.
- Changed files: app/result/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check` passed with CRLF warning only; `npm run build` passed; Playwright 390px light/dark checks confirmed the conclusion card and `핵심 신호 TOP3` label are removed, legend appears before chips, chips remain visible, SVG size remains 247x242, scrollWidth/clientWidth 390/390, no SVG label overlap/clipping, and no console/page errors; in-app Browser `/test-result` reload confirmed the same with scrollWidth/clientWidth 380/380.
- Notes/risks: Removing the conclusion card reduces repeated messaging and shortens Step 1, but the one-line diagnosis no longer appears as a separate card inside Step 1.
- Reusable rule: If Step 1 already has a clear heading and radar interpretation, avoid adding a separate conclusion card that competes with the photo/radar flow.
- Context promotion candidate: NULL

### 2026-06-05 / free result v2 step 1 face lab card polish

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 1 photo plus Face Lab card internal UI polish in `app/result/page.js`; Step 1 overall structure, skin radar card, priority TOP 3, recommendation logic, API, DB, payment, saved data, and result step count were out of scope.
- Goal: Make Face Lab read more clearly as a photo-derived face mood summary by renaming the title to `Face Lab · 얼굴 분위기` and changing the rows into icon, label, and value mini-list items.
- Changed files: app/result/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check` passed with CRLF warning only; `npm run build` passed; Playwright 390px light/dark checks confirmed the new title, `대표 무드`/`톤/컬러`/`스타일 방향` labels, values, preserved photo size at 156x195, scrollWidth/clientWidth 390/390, and no console/page errors; in-app Browser `/test-result` reload confirmed Face Lab, radar, priority, and no horizontal overflow at the current viewport.
- Notes/risks: The longer style value wraps naturally to multiple lines on 390px, which increases the Face Lab side panel height slightly without shrinking the photo.
- Reusable rule: Face Lab should stay tied to the photo as face-mood context, using compact icon rows for scanability while avoiding skin-state terminology and new interactions.
- Context promotion candidate: NULL

### 2026-06-05 / free result v2 step 1 face lab vertical carousel

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 1 photo plus Face Lab card internal interaction polish in `app/result/page.js`; Step 1 overall structure, skin radar card, priority TOP 3, recommendation logic, API, DB, payment, saved data, and result step count were out of scope.
- Goal: Replace the side-by-side Face Lab panel with one large photo followed by a single Face Lab lens value that advances by mobile swipe, desktop arrows, or dots.
- Changed files: app/result/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check -- app/result/page.js` passed with CRLF warning only; `npm run build` passed; Playwright checks confirmed 390px dark photo size 251x314, no horizontal overflow, mobile arrows hidden, mobile swipe 1/3 -> 2/3 -> 3/3, 390px light no horizontal overflow, desktop 900px arrows visible, desktop next arrow 1/3 -> 2/3, and no console/page errors.
- Notes/risks: The larger photo makes the Face Lab card taller. This matches the requested photo-first direction but pushes the priority card lower on 390px screens.
- Reusable rule: Face Lab interaction should stay inside the photo card, with the photo as the primary object and only one face-mood lens value visible at a time; use mobile swipe and desktop arrows without turning Step 1 into a full carousel.
- Context promotion candidate: NULL

### 2026-06-05 / free result v2 step 1 face lab carousel final polish

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 1 Face Lab card and priority rank circle UI-only polish in `app/result/page.js`; skin radar, recommendation logic, API, DB, payment, saved data, and result step count were out of scope.
- Goal: Reduce the Face Lab photo by 10%, remove the visible `1 / 3` counter, move desktop arrows beside the value text, remove the Face Lab icon, enlarge Face Lab text, move the one-time hint animation from the photo to the text, and shrink priority rank circles by about 15%.
- Changed files: app/result/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check -- app/result/page.js` passed with CRLF warning only; `npm run build` passed; Playwright 390px dark check confirmed no horizontal overflow, no visible `1 / 3`, no Face Lab icon, photo 225x282, mobile arrows hidden, priority circle 27x27, and mobile swipe advanced the active Face Lab dot; Playwright 703px dark check confirmed desktop arrows visible beside the value text and next arrow advanced the active dot; 390px light screenshot confirmed no layout break.
- Notes/risks: The Face Lab card remains taller than the pre-carousel design, but the latest photo reduction shortens it while keeping the photo visually dominant.
- Reusable rule: For this Face Lab carousel, keep visible progress in dots only, keep mobile swipe hint on the text area, and keep desktop arrows adjacent to the value text rather than in the card header.
- Context promotion candidate: NULL

### 2026-06-07 / free result v2 final step main handoff

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Result final-step UI handoff from `main` into `feature/free-result-flow-v2`; v2 Steps 1-4, API, DB, payment, saved data shape, auth/redirect logic, and branch merge/delete/create operations were out of scope.
- Goal: Replace the v2 final premium-preview step with the `main` result final step structure and restore the final save CTA wording to the `main` behavior.
- Changed files: app/result/page.js, components/result/SaveReportCTA.jsx, .codex/AI_WORK_LOG.md
- Protected areas: No API, DB, payment, stored data, env, or auth/redirect logic changed. `SaveReportCTA` was limited to removing v2-only UI override props and restoring existing default labels/helper copy.
- Validation: `git diff --check -- app/result/page.js components/result/SaveReportCTA.jsx` passed with CRLF warnings only; `npm run build` passed; in-app Browser `/test-result` confirmed Step 5 shows the `main` full-report preview copy/items, `전체 리포트 보기`, default save CTA, and share area; CTA navigated to `/result/full-report`; `/en/test-result` confirmed the English final step and `See Full Report` navigated to `/en/result/full-report`.
- Notes/risks: Branch merge, feature branch deletion, and `feature/premium-report-flow-v1` creation were intentionally not performed until the user completes visual confirmation.
- Reusable rule: When free-result v2 borrows a result step from `main`, copy the step data, wrapper, card component behavior, and final CTA copy together so the step does not mix v2-specific and main-specific messaging.
- Context promotion candidate: NULL

### 2026-06-07 / premium report Skin Match action-plan restructure

- Branch: feature/premium-report-flow-v1
- Task type: diagnostic -> execution
- Routing decision: Medium UI refactor after diagnosis. The paid Skin Match report surface, section order, copy, CTA strength, and Face Lab entry hierarchy were in scope; recommendation logic, API, DB, payment, saved data, and free result steps were protected.
- Goal: Reorder paid Skin Match from a detail-heavy report into a 6-step post-payment action plan: start today, morning routine, evening routine, avoid list, adjustment guide, and alternative/budget plan.
- Changed files: app/result/full-report/page.js, .codex/AI_WORK_LOG.md
- Protected areas: No recommendation engine, API route, DB schema/migration/policy, payment, auth/redirect, env, product data, saved-data structure, free Step1-4, or Step5 file changes.
- Validation: `npm run build` passed; in-app Browser `/test-full-report` confirmed Skin Match opens first at 390px CSS width, `1/6` today-start plan is first, 2/6 through 6/6 advance in the requested order, no horizontal overflow, 1/6 has no `판매처 보기`, 6/6 includes store CTA and Face Lab ready handoff, Face Lab handoff opens the Face Lab report, and browser console errors were 0; `git diff --check` passed with CRLF warning only.
- Notes/risks: The UI additions are concentrated in `app/result/full-report/page.js`, which already owns this screen. No production payment/API flow was exercised because this was verified through the development fixture route.
- Reusable rule: Paid report CTAs should follow the user value sequence: decision and routine first, purchase links as light support inside routine steps, and the strongest store CTAs in the final alternative/budget section.
- Context promotion candidate: NULL

### 2026-06-07 / premium report Skin Match micro polish

- Branch: feature/premium-report-flow-v1
- Task type: execution
- Routing decision: Second-pass paid report UI polish with the existing 6-step Skin Match structure preserved. Only copy, card hierarchy, routine display text, final CTA grouping, and Face Lab handoff copy were in scope.
- Goal: Make the paid Skin Match report feel more immediately actionable after payment without adding new product, recommendation, API, DB, payment, auth, free-result, or Step5 behavior.
- Changed files: app/result/full-report/page.js, .codex/AI_WORK_LOG.md
- Protected areas: This task did not edit recommendation/API/DB/payment/auth/free result files. During final verification, separate dirty files were detected in `lib/product-source.js`, `lib/recommendation-scoring.ts`, `lib/skin-match-decision-engine.js`, `lib/product-category-utils.js`, and `supabase/migrations/*.sql`; those were not modified or reverted in this task.
- Validation: `npm run build` passed; in-app Browser `/test-full-report` at CSS `innerWidth: 390` confirmed Skin Match opens first, 1/6 dashboard summaries are visible with no store CTA, 2/6 and 3/6 show compressed action-first routine copy, 4/6 has a clear `가장 먼저 피할 것` card, 5/6 common safe boundary uses adjustment-guide wording, 6/6 has store links plus `추천 제품 모아보기`, Face Lab handoff copy is strengthened, no horizontal overflow, and console errors were 0; `git diff --check` passed with CRLF warnings only.
- Notes/risks: The final worktree includes protected-area dirty files from outside this UI task, so final review should separate the paid-report UI diff from those existing recommendation/DB changes before commit.
- Reusable rule: Second-pass paid-report polish should tighten hierarchy and copy inside existing sections rather than adding new report structure or new purchase behavior.
- Context promotion candidate: NULL

### 2026-06-07 / moisturizer subcategory recommendation and DB insert

- Branch: feature/premium-report-flow-v1
- Task type: diagnostic -> execution
- Routing decision: User explicitly approved protected DB/migration work after backup-branch diagnosis. Scope was limited to Supabase moisturizer subcategory migrations, the 15-item lotion/emulsion insert, recommendation slot support for moisturizer subcategories, and local backup branch cleanup.
- Goal: Preserve the useful `codex/local-leftovers-backup` changes for moisturizer subcategories, apply the missing Supabase insert, avoid risky package changes, and remove the backup branch.
- Changed files: lib/product-category-utils.js, lib/product-source.js, lib/recommendation-scoring.ts, lib/skin-match-decision-engine.js, supabase/migrations/20260524054039_split_moisturizer_categories.sql, supabase/migrations/20260524054049_reclassify_existing_moisturizers.sql, supabase/migrations/20260526_moisturizer_lotion_emulsion_insert.sql, .codex/AI_WORK_LOG.md
- Protected areas: DB/migration changes were performed only after explicit user approval. No package, auth, payment, env, API response field, or saved-data structure changes were made.
- Validation: `npm run build` passed; `git diff --check` passed for the changed recommendation/migration files; Supabase insert target count returned 15/15; `moisturizer_lotion_emulsion` product count increased to 20; `supabase migration repair 20260526 --status applied --linked --yes` marked the executed data migration as applied remotely.
- Notes/risks: Existing unrelated dirty files were present before this task: `app/result/full-report/page.js` and prior `.codex/AI_WORK_LOG.md` edits. Older local-only Supabase migrations still appear in `supabase migration list`; they were not touched.
- Reusable rule: When a data migration is executed directly with `supabase db query --linked --file`, repair the remote migration history for that exact migration only after verifying the target rows exist.
- Context promotion candidate: NULL

### 2026-06-12 / premium report main hub ripple redesign

- Branch: feature/premium-report-flow-v1
- Task type: execution
- Routing decision: Medium UI layout refactor limited to the paid report main hub in `app/result/full-report/page.js`; loading core, recommendation logic, product data, API, DB, payment, auth, free result, Step5, and Face Lab logic were out of scope.
- Goal: Replace the ordinary central-card plus 2x2 quick-card menu with a ripple/circular hub where `Start Today` is the central node and Routine/Product/Caution/Adjust are surrounding action areas.
- Changed files: app/result/full-report/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `npm run build` passed; Playwright `/test-full-report` checks passed for 390px light/dark and 1440px light/dark with no horizontal overflow, no console/page errors, 4 accessible hub action buttons, no ordinary grid button structure, no same-column card overlap, and preserved click navigation for routine/product/caution/adjust.
- Notes/risks: Verification used the fixture route `/test-full-report` because the real `/result/full-report` route requires a premium session.
- Reusable rule: Paid report entry hubs should keep the central decision/first-action as the strongest visual node, with secondary destinations arranged around it and wired to existing step navigation rather than new routes or API calls.
- Context promotion candidate: NULL

### 2026-06-12 / premium report main hub final polish

- Branch: feature/premium-report-flow-v1
- Task type: execution
- Routing decision: Low/Medium UI polish limited to the paid report main hub in `app/result/full-report/page.js`; the central hub plus surrounding 4-action structure was preserved.
- Goal: Remove the repeated top `Start Today` title, reduce hub/card visual crowding, soften light/dark borders and ripple lines, and change the central CTA copy.
- Changed files: app/result/full-report/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Loading core, recommendation logic, product data, API, DB schema, payment, auth, free result, Step5, Face Lab logic, and detailed paid report content were not touched.
- Validation: `npm run build` passed; Playwright `/test-full-report` checks passed for 390px light/dark and 1440px light/dark with no horizontal overflow, no console/page errors, top title changed to `Skin Match 플랜`, central `오늘 시작` kept, CTA changed to `오늘 할 일 먼저 보기`, 4 accessible action buttons preserved, and routine/product/caution/adjust plus central CTA navigation still moved off the hub.
- Notes/risks: Visual verification used the fixture route `/test-full-report` because the production full-report route requires a premium session.
- Reusable rule: For paid report hub polish, adjust hierarchy, spacing, opacity, and copy inside the existing hub layout before considering structural changes.
- Context promotion candidate: NULL

### 2026-06-12 / premium report loading flow history cleanup

- Branch: feature/premium-report-flow-v1
- Task type: execution
- Routing decision: Medium UI/navigation bug fix limited to full-report loading transition. Recommendation logic, API response shape, DB, payment, auth, env, and saved-data structure were out of scope.
- Goal: Keep the full-report URL on `/result/full-report`, show the original droplet loading process until 100%, reveal the existing tap-to-open state, and show the existing ripple transition before rendering the report. Prevent `/result/full-report/loading` from remaining in browser history.
- Changed files: app/result/page.js, app/result/full-report/page.js, app/result/full-report/loading/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `npm run build` passed.
- Notes/risks: The existing droplet loading route remains available, but normal result CTA now goes directly to `/result/full-report`; direct loading-route open uses `router.replace` when moving to the report.
- Reusable rule: Full-report loading animation should be rendered as a transient UI state on the report route, not as a history-visible intermediate route in the normal CTA flow.
- Context promotion candidate: NULL

### 2026-06-15 / Hwahae review signal treatment folder split

- Branch: feature/premium-report-flow-v1
- Task type: execution
- Routing decision: Medium filesystem/script path update scoped to `data/hwahae-review-signals` treatment raw structure and review-signals script path resolution. Supabase, SQL, tag values, DB writes, API fields, and other category structures were out of scope.
- Goal: Move applied treatment product raw JSON files from `categories/treatment/raw/` into product-form `raw/` folders, create the requested `concerns` folder shells, keep treatment batch files at the treatment category root, and keep `npm run review_in_supabase` from writing treatment raw output to the old path. Follow-ups in the same scope made treatment batches accept mixed serum/ampoule/essence rows, use live `products.product_form` first when choosing the product-form raw folder, and made newly generated non-treatment product raw JSON write into each category's `raw/` folder while keeping batch/plan/fixture files at category roots.
- Changed files: data/hwahae-review-signals/categories product raw JSON locations, data/hwahae-review-signals/README.md, scripts/review-signals/review-in-supabase.mjs, scripts/review-signals/prepare-hwahae-review-raw-batch.mjs, .codex/AI_WORK_LOG.md
- Protected areas: No `.env*`, auth, DB schema/migration/policy, payment, production data, API response field names, stored JSON content, deployment config, or package changes were touched.
- Validation: Confirmed `data/hwahae-review-signals/categories/treatment/raw` was removed after becoming empty; confirmed treatment root still contains `hwahae-serum-essence-ampoule-review-signals.batch.json`, `.jsonl`, and `notes.md`; confirmed existing non-treatment product JSON files that were outside `raw/` remain outside `raw/` because they are not known applied outputs; confirmed the 8 moved treatment product JSON blobs match their previous HEAD content hashes; `node --check` passed for both touched review-signals scripts; `git diff --check` passed with existing LF-to-CRLF warnings only; a temp `prepare-hwahae-review-raw-batch.mjs --no-verify-supabase` plan-only run confirmed mixed serum/ampoule/essence treatment rows output to `categories/treatment/{serum,ampoule,essence}/raw`; a temp `review-in-supabase.mjs --plan-only --category treatment` run confirmed the wrapper includes all 3 mixed rows in the treatment plan, then the generated temp plan was removed; a temp cleanser plan-only run confirmed newly generated non-treatment output resolves to `categories/cleanser/raw`.
- Notes/risks: Empty folders such as `concerns/*` and `treatment/unknown/raw` exist in the working tree but are not represented by Git unless placeholder files are added later. Full `npm run review_in_supabase` was not run because it can reach browser extraction and Supabase import stages.
- Reusable rule: When a category folder changes from `category/raw` to `category/product-form/raw`, keep generated batch/fixture files at the category root and route only per-product raw extraction output into the product-form raw folders.
- Context promotion candidate: NULL

### 2026-06-13 / premium report TodayStartPlanStep extraction

- Branch: feature/premium-report-flow-v1
- Task type: execution
- Routing decision: Medium refactor/move-only task limited to extracting the TodayStartPlanStep UI bundle from `app/result/full-report/page.js`; UI copy, class names, navigation step order, router/session/API/tracking logic, other Step UI, and protected areas were out of scope.
- Goal: Move `SkinMatchHubIcon`, `SkinMatchHubQuickCard`, and `TodayStartPlanStep` into `components/full-report/TodayStartPlanStep.jsx`, with page-level data helpers remaining in `page.js` and values/callbacks passed as props.
- Changed files: app/result/full-report/page.js, components/full-report/TodayStartPlanStep.jsx, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: Normalized source comparison confirmed the moved block matches the original except for exports, removed internal data computations, and prop passing; `git diff --check -- app/result/full-report/page.js components/full-report/TodayStartPlanStep.jsx` passed with a CRLF warning only; `npm run lint` could not run because `next lint` opened the ESLint configuration prompt; `npm run build` passed.
- Notes/risks: `SkinMatchHubQuickCard` is named-exported from the new component file so the existing `LegacyTodayStartPlanStep` reference in `page.js` keeps the same runtime target if that legacy path is ever invoked.
- Reusable rule: When extracting a full-report UI subcomponent, keep shared data helpers in the page and pass computed values/callbacks as props unless the helper is private to the extracted UI bundle.
- Context promotion candidate: NULL

### 2026-06-13 / free result V2 primitives extraction

- Branch: feature/premium-report-flow-v1
- Task type: execution
- Routing decision: Medium move-only refactor limited to free result V2 primitive UI and pure icon components in `app/result/page.js`; step structure, data builders, recommendation logic, tracking/API/sessionStorage/auth/save/share logic, and legacy components were out of scope.
- Goal: Move `FreeResultV2StepFrame`, `FreeResultV2Card`, `FreeResultV2Pill`, `FreeResultV2LockIcon`, and pure V2 icon components into `components/result/free-v2/FreeResultV2Primitives.jsx`.
- Changed files: app/result/page.js, components/result/free-v2/FreeResultV2Primitives.jsx, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --stat` showed `app/result/page.js` reduced by 343 deleted lines with 13 import lines added; the new untracked primitive file is 308 lines and listed separately by `git status`; `git diff --check -- app/result/page.js components/result/free-v2/FreeResultV2Primitives.jsx` passed with a CRLF warning only; `npm run build` passed.
- Notes/risks: `FreeResultV2FaceLabMoodIcon` was moved into the primitive file but not imported back into `page.js` because the current page does not call it. No browser visual verification was run for this move-only task.
- Reusable rule: For free result V2 extraction, move primitive UI and pure SVG icons before step components, and leave step assembly plus display-data builders in `page.js` until they are targeted explicitly.
- Context promotion candidate: NULL

### 2026-06-13 / free result V2 diagnosis step extraction

- Branch: feature/premium-report-flow-v1
- Task type: execution
- Routing decision: Medium move-only refactor limited to `FreeResultV2DiagnosisStep` and its Step 1-only photo, Face Lab carousel, radar, and priority display UI; step assembly, `currentResultStep`, data builders, recommendation logic, tracking/API/sessionStorage/auth/save/share logic, copy maps, and legacy components were out of scope.
- Goal: Move `FreeResultV2DiagnosisStep` and Step 1-only pure display helpers into `components/result/free-v2/FreeResultV2DiagnosisStep.jsx`, importing shared primitives from `FreeResultV2Primitives.jsx`.
- Changed files: app/result/page.js, components/result/free-v2/FreeResultV2DiagnosisStep.jsx, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: Normalized source comparison confirmed the moved Step 1 block matches the original except for module imports, local `uniqueItems` helper copy, and default export; `git diff --check -- app/result/page.js components/result/free-v2/FreeResultV2DiagnosisStep.jsx` passed with a CRLF warning only; `npm run build` passed.
- Notes/risks: `git diff --stat` reports `app/result/page.js` only while the new file is untracked; no browser visual verification was run for this move-only task.
- Reusable rule: When extracting free result V2 step components, keep the step's props contract and result step assembly unchanged, and only copy tiny local helpers when the shared helper remains in `page.js` for other code.
- Context promotion candidate: NULL

### 2026-06-13 / free result V2 evidence step extraction

- Branch: feature/premium-report-flow-v1
- Task type: execution
- Routing decision: Medium move-only refactor limited to `FreeResultV2EvidenceStep` and its Step 2-only evidence photo card, signal card, reason note helper, and bridge UI; step assembly, `currentResultStep`, data builders, recommendation logic, tracking/API/auth/save/share logic, copy maps, and legacy components were out of scope.
- Goal: Move `FreeResultV2EvidenceStep` and Step 2-only pure display helpers into `components/result/free-v2/FreeResultV2EvidenceStep.jsx`, importing shared primitives from `FreeResultV2Primitives.jsx`.
- Changed files: app/result/page.js, components/result/free-v2/FreeResultV2EvidenceStep.jsx, .codex/AI_WORK_LOG.md
- Protected areas: Tracking/API/auth/save/share logic was not touched; the Step 2 reveal `sessionStorage` behavior was moved unchanged with its UI card.
- Validation: Normalized source comparison confirmed the moved Step 2 block matches the original except for module imports and default export; `git diff --check -- app/result/page.js components/result/free-v2/FreeResultV2EvidenceStep.jsx` passed with a CRLF warning only; `npm run build` passed; in-app Browser `/test-result` reloaded successfully with main content rendered, no horizontal overflow, and console error logs 0.
- Notes/risks: `git diff --stat` reports `app/result/page.js` only while the new file is untracked.
- Reusable rule: When extracting free result V2 step components, keep props contract and step assembly unchanged, and move UI-local browser state only with the UI block it belongs to.
- Context promotion candidate: NULL

### 2026-06-13 / free result V2 recommendation guide step extraction

- Branch: feature/premium-report-flow-v1
- Task type: execution
- Routing decision: Medium move-only refactor limited to `FreeResultV2RecommendationGuideStep` and its Step 3-only top pick, role pill, tabbed routine preview, premium preview, and fallback UI; step assembly, `currentResultStep`, recommendation logic, product normalization, data builders, tracking/API/sessionStorage/auth/save/share logic, purchase CTA behavior, and legacy components were out of scope.
- Goal: Move the free result V2 Step 3 recommendation guide UI into `components/result/free-v2/FreeResultV2RecommendationGuideStep.jsx`, importing shared primitives from `FreeResultV2Primitives.jsx`.
- Changed files: app/result/page.js, components/result/free-v2/FreeResultV2RecommendationGuideStep.jsx, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: Normalized source comparison confirmed the moved Step 3 block matches the original except for module imports, default export, and a private Step 3 product thumbnail helper needed because shared `SmallProductThumb` remains in `page.js`; `git diff --check -- app/result/page.js components/result/free-v2/FreeResultV2RecommendationGuideStep.jsx` passed with a CRLF warning only; `npm run build` passed; in-app Browser `/test-result` reached Step 3 with guide title, TOP PICK card, routine tabs, no horizontal overflow, and console error logs 0.
- Notes/risks: The new file duplicates the display-only product thumbnail markup for Step 3 so the shared page-level `SmallProductThumb` is not moved away from other legacy/current product cards.
- Reusable rule: When an extracted free result V2 step depends on a page-local helper that is shared with other sections, keep the shared helper in `page.js` and use a private display-only duplicate only when it avoids changing step props or broader file ownership.
- Context promotion candidate: NULL

### 2026-06-13 / free result V2 recommendation validation step extraction

- Branch: feature/premium-report-flow-v1
- Task type: execution
- Routing decision: Medium move-only refactor limited to `FreeResultV2RecommendationValidationStep` and its Step 4-only tabbed signal UI and locked full-report preview card; step assembly, `currentResultStep`, recommendation logic, data builders, copy maps, tracking/API/sessionStorage/auth/save/share logic, and CTA behavior were out of scope.
- Goal: Move the free result V2 Step 4 recommendation validation UI into `components/result/free-v2/FreeResultV2RecommendationValidationStep.jsx`, importing shared primitives from `FreeResultV2Primitives.jsx`.
- Changed files: app/result/page.js, components/result/free-v2/FreeResultV2RecommendationValidationStep.jsx, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: Normalized source comparison confirmed the moved Step 4 block matches the original except for module imports and default export; `git diff --check -- app/result/page.js components/result/free-v2/FreeResultV2RecommendationValidationStep.jsx` passed with a CRLF warning only; `npm run build` passed after restoring one adjacent legacy lock-row line affected during extraction; in-app Browser `/test-result` reached Step 4 with validation title, fit/adjust signal tabs, no horizontal overflow, and console error logs 0.
- Notes/risks: The extraction briefly broke an adjacent legacy `FreeResultV2RoutineFaceLabStep` lock row during block removal, then restored it before final validation.
- Reusable rule: For move-only extraction near legacy unused blocks, verify the adjacent before/after function boundaries after deletion because older blocks may remain interleaved around the active V2 steps.
- Context promotion candidate: NULL

### 2026-06-19 / premium current products MVP-A

- Branch: feature/premium-current-products-mvp
- Task type: execution
- Routing decision: Medium feature addition with a protected API/data boundary. DB schema/migration, free result shape, payment, auth, recommendation topPick/supportingProducts/routine recalculation, Face Lab, and saved DB schema were out of scope.
- Goal: Add first-pass current product selection context for paid Skin Match reports, pass sanitized `currentProducts` through `/api/analyze`, store it only inside `premiumReport`, and show a current-products summary block in `/result/full-report`.
- Changed files: app/api/current-products/products/route.js, components/current-products/CurrentProductsSelector.jsx, lib/current-products.js, lib/product-source.js, app/page.js, app/api/analyze/route.js, lib/skin-match-decision-engine.js, app/result/full-report/page.js, lib/test-result-fixture.js, .codex/AI_WORK_LOG.md
- Protected areas: No DB schema/migration/policy, payment, auth, free result payload shape, topPick selection, supportingProducts, full routine recalculation, AM/PM automatic rebalance, condition response, functional decision, or Face Lab behavior changed.
- Validation: `npm run build` passed; `GET /api/current-products/products?category=sunscreen` returned only `id, brand, name, category, product_form, image_url`; unsupported category returned 400; Playwright 390px `/test-full-report` confirmed `scrollWidth=390`, current-products block visible, selected product visible, sunscreen `not_in_db` copy visible, `not_using` copy visible, and console error logs 0.
- Issues/risks: The selector is a compact MVP section on the existing survey screen, not a polished separate onboarding step. Product display names in PowerShell output can look mojibake because of terminal encoding, while browser rendering is UTF-8. Product details in premium report are resolved from the recommendation product catalog; if a selected product id is not in that catalog, the report can still show the product id but not brand/name.
- Context promotion candidate: NULL

### 2026-06-19 / premium current products snapshot stabilization

- Branch: feature/premium-current-products-mvp
- Task type: execution
- Routing decision: Medium stabilization scoped to the paid full-report current-products summary block and its premium-only payload. Recommendation ranking, supporting products, routine structure, AM/PM slot placement, DB schema, and free-result shape were out of scope.
- Goal: Ensure selected current products display from a minimal Supabase productSnapshot instead of depending on the recommendation catalog.
- Changed files: lib/product-source.js, lib/current-products.js, lib/skin-match-decision-engine.js, app/api/analyze/route.js, app/result/full-report/page.js, lib/test-result-fixture.js, .codex/AI_WORK_LOG.md
- Protected areas: No DB schema/migration/policy, auth, payment, environment, topPick/supportingProducts/routineStructure, AM/PM rebalance, or free-result payload changes.
- Validation: `npm run build` passed. Playwright mobile verification on `/en/test-full-report` at 390px confirmed the current-products block renders, selected productSnapshot brand/name displays, productSnapshot null fallback displays, not_in_db and not_using stay distinct, sunscreen not_in_db copy stays distinct, document/body scrollWidth remained 390, and console error count was 0.
- Notes/risks: productSnapshot fetch uses the same minimal current-product field set as the selector API; lookup failure is intentionally represented as productSnapshot null.
- Context promotion candidate: NULL

### 2026-06-19 / premium current products feature gate safety check

- Branch: feature/premium-current-products-mvp
- Task type: diagnostic with minimal execution
- Routing decision: Medium gate/payload stabilization scoped to `CurrentProductsSelector` exposure and `/api/analyze` currentProducts submission. DB schema, recommendation logic, routine slots, paid report rendering, and free result shape were out of scope.
- Goal: Align current-products selector exposure and currentProducts FormData submission with the existing premium report gate before merge.
- Changed files: app/page.js, .codex/AI_WORK_LOG.md
- Protected areas: No DB schema/migration/policy, auth/payment, recommendation topPick/supportingProducts/routineStructure, full-report feature gate, or free-result payload shape changes.
- Validation: Production flag-off build with `NEXT_PUBLIC_PREMIUM_REPORT_ENABLED=false npm run build` passed; production `next start` at 390px confirmed selector absent on the survey step, `/api/analyze` multipart body did not include `currentProducts`, scrollWidth remained 390, and console error count was 0. Development `next dev` at 390px confirmed selector present, selected/not_in_db/not_using controls visible, selecting `not_in_db` sent `currentProducts` JSON to `/api/analyze`, scrollWidth remained 390, and console error count was 0. `/api/current-products/products?category=sunscreen` returned only `id, brand, name, category, product_form, image_url`; `git diff --check` passed with CRLF warnings only.
- Notes/risks: The current-products API remains callable in production, but it exposes only the agreed minimal public product fields. Selector UI and analyze payload are now gated behind the same premium flag as the paid report.
- Context promotion candidate: NULL

### 2026-06-13 / free result V2 premium preview step extraction

- Branch: feature/premium-report-flow-v1
- Task type: execution
- Routing decision: Medium move-only refactor limited to the free result V2 Step 5 premium-preview display UI; `goToFullReport`, step assembly, `currentResultStep`, `ResultBottomCTA`, `SaveReportCTA`, data builders, copy maps, tracking/API/sessionStorage/auth/save/share logic, and legacy preview helpers were out of scope.
- Goal: Move the active Step 5 wrapper, premium preview lead display, `ResultPreviewMaskCard`, and its internal CTA button JSX into `components/result/free-v2/FreeResultV2PremiumPreviewStep.jsx`.
- Changed files: app/result/page.js, components/result/free-v2/FreeResultV2PremiumPreviewStep.jsx, .codex/AI_WORK_LOG.md
- Protected areas: Not touched; the full-report CTA still receives the page-level `goToFullReport` callback via `onFullReportClick`.
- Validation: Normalized comparison confirmed `ResultPreviewMaskCard` matches the original and the Step 5 wrapper/callback contract is preserved; `git diff --check -- app/result/page.js components/result/free-v2/FreeResultV2PremiumPreviewStep.jsx` passed with a CRLF warning only; `npm run build` passed; in-app Browser `/test-result` reached Step 5 with premium preview text and CTA, no horizontal overflow, console error logs 0; clicking `전체 리포트 보기` navigated to `/result/full-report` and rendered the premium report handoff state.
- Notes/risks: `FreeResultV2PremiumPreviewLead` keeps the active Step 5 rendered output without moving `resultCopy`; legacy preview helpers (`ResultPreviewThumb`, `ResultPreviewLargeVisual`, `ResultPreviewHighlightCard`, `ResultPreviewLockedRow`) remain in `page.js`.
- Reusable rule: For final-step extraction, pass page-owned navigation/tracking callbacks down as props and keep save/login/session behavior at the page or dedicated CTA component boundary.
- Context promotion candidate: NULL

### 2026-06-13 / free result legacy UI quarantine

- Branch: feature/premium-report-flow-v1
- Task type: execution
- Routing decision: Medium move-only refactor limited to legacy/inactive UI components that are not directly used by the active free result V2 Step 1-5 `resultSteps` path; step structure, active Step components, display data builders, copy maps, sessionStorage/auth/API/tracking/save/share logic, and deletion were out of scope.
- Goal: Move inactive legacy UI groups into `components/result/legacy/ResultLegacySections.jsx` as named exports while leaving active free result V2 rendering untouched.
- Changed files: app/result/page.js, components/result/legacy/ResultLegacySections.jsx, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `rg` confirmed moved legacy components now live only in `ResultLegacySections.jsx`; normalized source comparison confirmed the moved legacy UI block matches the original except for module imports and named exports; `git diff --check -- app/result/page.js components/result/legacy/ResultLegacySections.jsx` passed with a CRLF warning only; `npm run build` passed; in-app Browser `/test-result` confirmed Steps 1-5 render with no horizontal overflow and console error logs 0.
- Notes/risks: `PhotoObservationCard`, `CategoryCarousel`, and `ProductDecisionCard` stayed in `page.js` because they depend on page-level display builders, product helpers, and tracking. Smaller legacy helpers `FreeResultV2RoleCard`, `FreeResultV2CompactRoutineFlow`, and `FreeResultV2Step3LockCard` also stayed because they were outside the confirmed move group.
- Reusable rule: Legacy UI quarantine should move only self-contained inactive UI bundles; leave candidates with display-builder or tracking dependencies in `page.js` until their helper contracts are explicitly extracted.
- Context promotion candidate: NULL

### 2026-06-13 / free result V2 static display builder extraction

- Branch: feature/premium-report-flow-v1
- Task type: execution
- Routing decision: Medium move-only refactor limited to three self-contained free result V2 display builders; copy maps, product/evidence/diagnosis helpers, step assembly, recommendation logic, sessionStorage/auth/API/tracking/save/share logic, and CTA behavior were out of scope.
- Goal: Move `buildFreeResultV2RoutinePreview`, `buildFreeResultV2FaceLabPreview`, and `buildFinalReportPreviewSections` into `lib/result/free-result-v2-static-builders.js`, then import them from `app/result/page.js` without changing call sites.
- Changed files: app/result/page.js, lib/result/free-result-v2-static-builders.js, .codex/AI_WORK_LOG.md
- Protected areas: `resultCopy`, `displayMap`, `topPickHeadlineMap`, Diagnosis/Evidence/Top Pick builders/helpers, `currentResultStep`, `resultSteps`, sessionStorage/auth/API/tracking/save/share, and recommendation logic were not changed.
- Validation: Normalized source comparison reported all three moved functions as `same`; `git diff --check -- app/result/page.js` passed with a CRLF warning only; new-file whitespace check passed; `npm run build` passed; in-app Browser verified `/test-result` Step 1-5 rendering, Step 3 night routine tab, Step 5 premium preview, no horizontal overflow, and console error logs 0.
- Notes/risks: The dev server was initially not running, so Browser first saw connection refused. Started `npm run dev` on port 3001 and verified via `http://127.0.0.1:3001/test-result`. Step 5 showed the previous animated body immediately after advancing, then settled to the premium preview after the transition completed.
- Reusable rule: For display builder move-only work, compare normalized moved function bodies against the original before relying on build/browser checks.
- Context promotion candidate: NULL

### 2026-06-13 / products treatment category migration draft

- Branch: feature/premium-report-flow-v1
- Task type: diagnostic to limited execution
- Routing decision: High DB schema/data migration task. Protected production data was not modified directly; work was limited to local migration files and read-only linked Supabase checks.
- Goal: Add `treatment` as the high-level category for serum/ampoule/essence products, preserve the original form in `product_form`, and provide verification SQL without touching recommendation, crawler, tagging, or duplicate-key logic.
- Changed files: supabase/migrations/20260613025816_add_treatment_product_form.sql, supabase/migrations/20260613030023_migrate_treatment_product_forms.sql, data/hwahae/products_schema(SQL 생성시 참조 파일).csv, .codex/AI_WORK_LOG.md
- Protected areas: No `.env*`, auth, RLS policy, payment, API response field names, recommendation logic, crawler logic, product tagging logic, or normalized brand/name unique index changes.
- Validation: Confirmed linked Supabase `products.category` is `USER-DEFINED product_category`; confirmed `product_form` does not yet exist; confirmed current enum values do not include `treatment`; confirmed current target rows are exactly 9 (`serum` 3, `ampoule` 3, `essence` 3) and listed their ids/names; `git diff --check` passed for changed files with only the existing LF-to-CRLF warning on the CSV.
- Issues/risks: Supabase MCP failed to handshake, so CLI was used for read-only checks. Local Supabase DB could not be started because Docker is not installed. `supabase db push --dry-run` did not validate pending migrations because remote migration history contains versions missing locally (`20260506070849`, `20260506092454`); do not push until migration history is reconciled.
- Next work: Reconcile remote/local migration history, then apply migrations and run the verification queries in the migration comment block.
- Reusable rule: For Postgres enum migrations that add and then use a new enum value, split enum DDL and data updates into separate migration files to avoid same-transaction enum visibility problems.
- Context promotion candidate: NULL

### 2026-06-13 / treatment category local safety patch

- Branch: feature/premium-report-flow-v1
- Task type: limited execution
- Routing decision: High DB-related change limited to local migration SQL and app interpretation helpers. No remote DB write, migration push, repair, crawler edit, or broad recommendation redesign was performed.
- Goal: Preserve the remote `map_product_category()` search_path attribute in the local migration and make app/result/analyze category interpretation treat `treatment` plus legacy `serum`/`ampoule`/`essence` as the serum/ampoule routine family.
- Changed files: supabase/migrations/20260613030023_migrate_treatment_product_forms.sql, lib/product-category-utils.js, lib/recommendation-scoring.ts, app/result/page.js, app/result/full-report/page.js, app/api/analyze/route.js, .codex/AI_WORK_LOG.md
- Protected areas: Remote DB, migration history, Python import scripts, crawler logic, auth, payment, policy, and large scoring formula changes were not touched.
- Validation: `git diff --check` passed for touched migration/app files with CRLF warnings only; `npm run build` passed. Search confirmed requested app-scope serum-family branches include `treatment` and legacy `essence`.
- Issues/risks: `lib/review-signals.js`, crawler, and Hwahae import scripts still contain serum/ampoule/essence assumptions and remain intentionally unchanged for a later step. Remote migration history still has missing local versions `20260506070849` and `20260506092454`.
- Next work: Resolve migration history mismatch before any push, then apply migrations only after approval and run verification SELECTs.
- Reusable rule: When category enum semantics shift, update all display/slot/LLM category-family normalizers before applying the data migration.
- Context promotion candidate: NULL

### 2026-06-13 / Hwahae treatment import product_form inference

- Branch: feature/premium-report-flow-v1
- Task type: limited execution
- Routing decision: Medium pipeline change scoped to Hwahae import preparation and final candidate field passthrough. Remote DB, migration files, app recommendation logic, and crawler/Python outside the import package were out of scope.
- Goal: Route treatment category files through `category=treatment`, stop emitting serum/ampoule/essence as categories from the batch wrapper, and infer `product_form` from product names for treatment candidates.
- Changed files: scripts/hwahae-import/prepare_hwahae_batch.py, scripts/hwahae-import/build_hwahae_import_package.py, .codex/AI_WORK_LOG.md
- Protected areas: No remote DB write, migration edit, app code edit, recommendation scoring change, or crawler change.
- Validation: `python -m py_compile scripts/hwahae-import/prepare_hwahae_batch.py scripts/hwahae-import/build_hwahae_import_package.py` passed; `python -X utf8 scripts/hwahae-import/prepare_hwahae_batch.py --dry-run` mapped current `각질.json` to `treatment` and printed product_form counts `ampoule=2, essence=1, peeling_solution=1, serum=6`; temporary `treatment.json` dry-run produced the same treatment mapping and counts; temporary `클렌저.json` dry-run still mapped to `cleanser`; local temp build confirmed final new candidates preserve `category`, `inferredCategory`, `product_form`, and `productForm`.
- Issues/risks: The repo currently has `data/hwahae/각질.json`, not `data/hwahae/treatment.json`; `treatment.json` behavior was verified with a temporary copy. Product form inference follows the requested keyword order, so names containing both an ampoule/serum word and acid keywords resolve to the earlier form keyword.
- Context promotion candidate: NULL

### 2026-06-19 / premium current products routine slots MVP-B

- Branch: feature/premium-current-products-slots
- Task type: limited execution
- Routing decision: Medium UI/data-display change scoped to paid full-report routine consultation and currentProducts display model. Recommendation scoring, topPick/supportingProducts selection, routineStructure generation, free result payload/UI, DB schema/migration, payment, and saved data structure were out of scope.
- Goal: Show `premiumReport.currentProducts` selections as compact current-product rows inside the paid Skin Match routine consultation AM/PM slots without changing recommendation logic.
- Changed files: app/result/full-report/page.js, lib/current-products.js, .codex/AI_WORK_LOG.md
- Protected areas: Recommendation algorithms, product DB, API response field names, DB schema/migrations, payment/session structure, free result payload/UI, main flower hub, active judgment, condition response, and Face Lab structure were not changed.
- Validation: `buildCurrentProductRoutineSlots` direct check confirmed `sunscreen not_in_db` appears as currently using in protect and `sunscreen not_using` appears as an empty morning protection slot; `git diff --check` passed with CRLF warnings only; `npm run build` passed; Playwright 390px `/test-full-report` flow opened the paid report, entered routine consultation, confirmed selected fallback/current product, sunscreen not-in-DB, moisturizer not-using, PM functional note, no horizontal overflow, and console/page errors 0.
- Follow-up: Compact UI cleanup changed the existing routine product label to `이 단계 추천 제품`, lowered currentProducts rows to thin border-left helper rows, and reduced the bottom `현재 제품 반영` block to short guidance plus status counts. User-facing MVP/development copy was removed.
- Follow-up: currentProducts rows were raised from border-left helper text to small inset status boxes with muted background/border, still smaller than the recommendation product card. The bottom summary count was condensed to a single `DB 제품 2 · DB 미등록 1 · 사용 안 함 1` line.
- Follow-up: Moved currentProducts display JSX out of `app/result/full-report/page.js` into `components/result/premium/CurrentProductSlotNote.jsx` and `components/result/premium/CurrentProductsSummaryCard.jsx`. Page-level responsibility is now limited to building slot data and rendering the two components.
- Follow-up: Full-report loading handoff now uses `fullReportOpenedAt`, written only when `내 플랜 열기` is clicked. First generated entry still shows the water-drop handoff after loading; later entries with that key skip the handoff and render the report body directly.
- Follow-up: Replaced the top `Skin Match / Face Lab` segmented control with a single `메인 허브로 이동` button. The button switches back to the Skin Match tab and resets the Skin Match stepper to the main hub; Face Lab remains reachable from the existing hub/CTA path.
- Notes/risks: The in-app Browser plugin could not open local URLs, so verification used local Playwright. `/test-full-report` starts from the existing premium loading handoff on first open and requires clicking `내 플랜 열기` once before later direct entry.
- Context promotion candidate: NULL

### 2026-06-20 / current-products legacy group removal

- Branch: main
- Task type: execution
- Routing decision: Medium current-products UI/API cleanup. Read-only live Supabase category check was required before editing; DB schema, migrations, production data, auth, payment, API response field names, and saved data structure were not modified.
- Goal: Remove the legacy current-products group after confirming no live `products.category` rows use the legacy group key, `spot`, or `mask`, while keeping `treatment` as a real selectable category in the serum/treatment group.
- Changed files: lib/current-products.js, components/current-products/CurrentProductsSelector.jsx, lib/product-source.js, .codex/AI_WORK_LOG.md
- Protected areas: No `.env*` edits, DB writes, schema/migration edits, policy changes, auth/payment changes, or API response field-name changes.
- Validation: Read-only Supabase anon query found no rows for the legacy group key, `spot`, or `mask`, and found `treatment=18` across 164 products. `npm run build` passed. Local current-products API returned categories without the legacy group key and with `treatment`; requesting the removed category returned 400 Unsupported category; requesting `treatment` returned 18 treatment products. Search confirmed no legacy group references remain in current-products selector/source/API files; remaining hits are unrelated English copy, migration/normalizer option-word filters, or an unrelated local `Select-String` artifact.
- Notes/risks: Production build has premium report selector hidden unless the premium flag is enabled; selector-specific verification therefore relied on source-level group inspection plus API checks instead of completing the photo upload flow in-browser.
- Context promotion candidate: NULL

### 2026-06-22 / Hwahae ranking all-jobs and matrix audit

- Branch: main
- Task type: execution
- Routing decision: Medium crawler operation change scoped to explicit all-enabled ranking selection, Korean browser context, and config matrix audit. DB schema/migrations, products table writes, promotion/enrich commands, and unrelated app files were out of scope.
- Goal: Add `npm run crawl -- --all` as an explicit all-enabled job mode, add `npm run jobs:matrix` for 9 category x 9 context audit, and confirm `essence_ampoule_serum` snapshots persist as `service_category=treatment`.
- Changed files: crawler/hwahae.ts, crawler/jobs-matrix.ts, crawler/package.json, .codex/AI_WORK_LOG.md
- Protected areas: No `.env*`, DB schema/migration/policy, auth/payment/deploy config, products INSERT/UPDATE/DELETE, promotion/enrich execution, or API response field-name changes.
- Validation: `npm run test:ranking-ingest` passed; `npm run typecheck` passed; `npm run jobs:matrix` passed with total=81, enabled=5, disabled=76; `npm run crawl -- --all --job-ids=hwahae-skincare-toner-category-all --dry-run` failed closed with the expected conflict error; `npm run crawl -- --all --dry-run --delay-ms=1000` passed for 5 enabled jobs with 160 prepared ranking observations and products writes 0; `npm run crawl -- --all --delay-ms=1000` passed for 5 enabled jobs with 5 snapshots, 160 source_rankings rows, 0 new candidates, 160 reobserved candidates, review refresh inserted 50, products writes 0. Products row count stayed 164 before and after. Latest DB `ranking_snapshots` rows for both essence jobs show `source_category_key=essence_ampoule_serum`, `service_category=treatment`, `source_product_form=null`.
- Issues/risks: Two intermediate `rg` proof commands failed from PowerShell quoting/regex escaping, then products direct write checks were rerun with fixed-string searches and returned no matches. Crawl still depends on live Hwahae availability and the configured Top 50 gateway behavior.
- Context promotion candidate: NULL

### 2026-06-22 / review queue same-day rerun diagnosis and migration draft

- Branch: main
- Task type: diagnostic to limited execution
- Routing decision: High DB/RPC queue-rule change. User approved local implementation and read-only expected-impact analysis, but not DB migration application, queue refresh, or commit.
- Goal: Draft a forward-only repair so repeated same-concern evidence requires distinct KST observed dates >= 2, latest concern rank <= 15 drives top-15 evidence, and same-day rerun-only queued/reviewing rows are retained with priority 0 and explicit ineligible evidence.
- Changed files: supabase/migrations/20260622093000_repair_review_queue_distinct_observed_dates.sql, crawler/test-ranking-review-rules.ts, crawler/reviews-pending.ts, crawler/package.json, .codex/AI_WORK_LOG.md
- Protected areas: Existing migrations were not edited. No DB migration was applied, no queue refresh was executed, no products INSERT/UPDATE/DELETE was added, and no commit was created.
- Validation: `npm run test:ranking-review-rules` passed; `npm run typecheck` passed; `git diff --check` passed. Read-only DB simulation predicted 50 queued/reviewing rows remain status-kept, 15 remain eligible by latest Top 15, 35 become priority 0, 0 qualify by distinct-date same-concern persistence, products count before remains 164.
- Follow-up: After approval, applied the migration to linked Supabase with MCP `apply_migration`, then ran `refresh_candidate_promotion_reviews('ranking-review-v2')`. Result: 50 queued rows retained, 15 remain priority > 0, 35 changed to priority 0 with `currently below queue threshold under ranking-review-v2`, products stayed 164, and RPC returned `products_written=0`.
- Validation follow-up: `npm run reviews:pending` showed Top 1-15 priority retained and rank 16-50 same-day rerun rows marked ineligible with observations/observed_dates/first_date/last_date. `npm run test:ranking-review-rules`, `npm run test:ranking-ingest`, `npm run typecheck`, and `git diff --check` passed.
- Issues/risks: Supabase CLI is not installed on this PC, so the forward-only migration file was created manually instead of with `supabase migration new`.
- Context promotion candidate: Same-day ranking reruns must never count as persistence evidence; persistence requires KST distinct observed dates.

### 2026-06-29 / premium functional decision section

- Branch: feature/premium-functional-decision
- Task type: limited execution
- Routing decision: Medium premium report data/UI addition scoped to the paid Skin Match full report functional decision section. Free result, recommendation ranking, Top Pick, supportingProducts, score formula, currentProducts input/slot building, routineStructure generation, payment, Face Lab, DB schema, and product DB were out of scope.
- Goal: Add paid-report-only `premiumReport.functionalDecisions` so the full report explains which functional skin goals are appropriate now, later, or temporarily paused.
- Changed files: app/api/analyze/route.js, app/result/full-report/page.js, components/full-report/PremiumFunctionalDecisionSection.jsx, lib/premium-functional-decisions.js, lib/skin-match-decision-engine.js, lib/test-result-fixture.js, docs/architecture/premium-functional-decision-contract-v1.md, .codex/AI_WORK_LOG.md
- Protected areas: No DB schema/migration, storage API schema, product ranking algorithm, score formula, Top Pick/supportingProducts selection, sunscreen scoring, currentProducts input, free result UI, SurveyFlow, payment, or Face Lab changes.
- Validation: `npm run build` passed; `git diff --check` passed with CRLF warnings only; helper-level cases confirmed barrier without active burden produces now/later but no pause, barrier plus current-product hold can pause texture/exfoliation, and pores with low sensitivity can mark sebum/pore now. 390px `/test-full-report` verified functional section entry, 3 cards with now/later/pause fixture states, no horizontal overflow, next CTA to adjustment/condition guide, no purchase/price text, console/page errors 0. Free `/api/analyze` 200 response did not include `functionalDecisions`, `currentProductVerdicts`, or `premiumReport`.
- Issues/risks: The exact 390px browser verification used local Playwright because the in-app browser viewport override reported a 500px client width. Saved premium report requery was verified by code path through existing `premium_report_sessions.premium_report` storage and `/api/full-report` spread behavior, not with a live authenticated session.
- Follow-up: Tightened `sanitizeFunctionalDecisionsForPremium` so `title` and `summary` must be non-empty strings, `nextAction` only keeps a non-empty string or null, and `reasons` keeps only non-empty string entries. No helper, UI, free response, or storage path change.
- Context promotion candidate: Paid functional goal decisions should remain goal-level, premium-only, and separate from product recommendation or current-product verdict logic.

### 2026-06-29 / premium condition response section

- Branch: feature/premium-condition-response
- Task type: limited execution
- Routing decision: Medium premium report data/UI addition scoped to the paid Skin Match full report condition response section. Free result, SurveyFlow, recommendation ranking, score formula, Top Pick/supportingProducts, sunscreen scoring, currentProducts input/slot building, currentProductVerdicts rules, functionalDecisions rules, payment, Face Lab calculation, DB schema, and product DB were out of scope.
- Goal: Add paid-report-only `premiumReport.conditionResponses` so the full report explains temporary routine adjustments for unstable skin days.
- Changed files: app/api/analyze/route.js, app/result/full-report/page.js, components/full-report/PremiumConditionResponseSection.jsx, lib/premium-condition-responses.js, lib/skin-match-decision-engine.js, lib/test-result-fixture.js, docs/architecture/premium-condition-response-contract-v1.md, .codex/AI_WORK_LOG.md
- Protected areas: No DB schema/migration, storage API route, product ranking algorithm, score formula, Top Pick/supportingProducts selection, sunscreen hard filter/score, currentProducts input/slot building, free result UI, SurveyFlow, payment, or Face Lab calculation changes.
- Validation: `npm run build` passed; `git diff --check` passed with CRLF warnings only; helper-level cases confirmed barrier without active burden keeps hydration/barrier maintain and active/texture reduce without avoid_for_now, barrier/redness plus hold/pause allows active_load avoid_for_now without making every card avoid_for_now, pores with low sensitive risk keeps texture maintain, cleansingFrequency 3_plus plus tight makes cleansing_load reduce, environment heat/mask makes environment_recovery reduce, and missing currentProductVerdicts/functionalDecisions does not crash. 390px `/test-full-report` verified condition section entry, 3 fixture cards with maintain/reduce/avoid_for_now, no horizontal overflow, no purchase or banned medical words, Face Lab CTA reaches the Face Lab content, and console/page errors 0. Free `/api/analyze` 200 response did not include `conditionResponses`, `functionalDecisions`, `currentProductVerdicts`, or `premiumReport`.
- Issues/risks: Exact 390px verification used local Playwright because the in-app browser viewport override reported a 500px client width. Saved premium report requery was verified by code path through existing `premium_report_sessions.premium_report` storage and `/api/full-report` spread behavior, not with a live authenticated session.
- Context promotion candidate: Paid condition responses should remain temporary routine-adjustment guidance, premium-only, non-medical, and separate from product verdicts and functional goal decisions.

### 2026-06-29 / is_mens female hard filter

- Branch: fix/is-mens-female-hard-filter
- Task type: limited execution
- Routing decision: Medium survey/recommendation eligibility change scoped to free Skin Match `genderPreference` restoration and pre-scoring product candidate filtering. Premium report, Face Lab, My Skin, DB schema/migration, auth, payment, currentProducts, and score formula changes were out of scope.
- Goal: Restore the free survey product-profile question and exclude `is_mens === true` products from all recommendation candidates only when `genderPreference === "female"`.
- Changed files: app/page.js, app/api/analyze/route.js, components/onboarding/SurveyFlow.js, components/onboarding/constants.js, lib/recommendation-scoring.ts, lib/skin-match-decision-engine.js, docs/architecture/survey-contract-v1.md, .codex/AI_WORK_LOG.md
- Protected areas: No product data deletion, DB migration, API response expansion, premium report, Face Lab, My Skin, auth, payment, currentProducts, Top Pick formula, supportingProducts formula, ranking comparator, or score-weight changes.
- Validation: `npm run build` passed; `git diff --check` passed with CRLF warnings only; static path checks confirmed `genderPreference` defaults, payload append, API normalization, normalized recommendation answers, and pre-scoring `is_mens` eligibility filtering. Local `/api/analyze` multipart calls for `female`, `male`, `unspecified`, and missing `genderPreference` all returned 200 and did not expose `genderPreference` or `premiumReport` in the public response. 390px Playwright verified the gender question renders, female selection persists, no horizontal overflow, mocked analysis reaches result route, and console/page errors 0.
- Issues/risks: Korean source text displays garbled in PowerShell, so the restored Korean gender question was added as a small separate preference screen to avoid broad rewrites of existing encoded copy.
- Context promotion candidate: `genderPreference` should remain a pre-scoring eligibility filter only; never reintroduce `is_mens` score bonuses or penalties.

### 2026-06-29 / My daily care simplification

- Branch: feature/my-daily-care-simplification
- Task type: limited execution
- Routing decision: Medium My Skin UI/data display change scoped to daily check-in, memo visibility, and routine-log presentation. Premium report, full-report components, Face Lab, free result, SurveyFlow, recommendation scoring, current product verdicts, functional decisions, condition responses, DB schema, auth, and payment were out of scope.
- Goal: Make My Skin a daily execution surface by compressing today routine guidance and surfacing saved check-in memo as a user record.
- Changed files: components/my/MyDashboard.jsx, components/my/TodayRoutineCard.jsx, lib/my/dashboard.js, lib/my/i18n.js, docs/architecture/my-daily-care-contract-v1.md, .codex/AI_WORK_LOG.md
- Protected areas: No premium report/full-report file edits, no Face Lab edits, no free result edits, no recommendation or decision-engine edits, no DB migration/RLS/auth/payment changes.
- Validation: `npm run build` passed; `git diff --check` passed with CRLF warnings only. Helper-level low/high check-in comparison showed existing high-intensity routine arrays can expand to keep=14, reduce=6, avoid=7 while the compressed display is limited to two adjustments plus one caution. Logged-in browser session saved a check-in memo through `/my/check-in`, returned to `/my`, and displayed the memo with date in the dashboard. My page showed today's care, today's adjustments, no current-product verdict or functional-decision labels, horizontal overflow false in the authenticated browser session, and console error logs 0 during the save check.
- Issues/risks: Authenticated in-app browser viewport override reported 500px+ client width, so exact 390px My dashboard verification was not completed. Slider high-intensity browser input could not be set through the in-app browser automation; high-intensity compression was verified helper-level instead.
- Follow-up: Extended the My home toward the diary architecture reference. AM/PM routine details are no longer repeated on the home; the card keeps only compressed care actions plus a check-in/routine logging link. Dashboard payload now includes latest 7 user-scoped daily check-ins, and the home renders a single-metric SVG trend preview plus the latest 2-3 diary rows with date, state label, makeup/outdoor tags, and memo preview. The contract doc now states that My is a record/trend/diary home, not a free-result routine replay or premium reasoning surface.
- Follow-up: Removed the standalone recent memo card because the same note is already visible in the diary preview. Memo remains stored in `daily_checkins.memo` and shown only in dated diary rows.
- Follow-up: Tightened three My home UI details. The today care footer now uses a user-facing basic-routine reminder with no fake CTA because the My payload has no safe saved-result route. Diary rows now show up to two highest non-zero check-in values using irritation/redness/breakout/dryness/oiliness tie priority. The analysis baseline card now omits long skin/photo summaries and keeps only skin type, sensitivity, concerns, and a real saved/profile date.
- Context promotion candidate: My Skin should remain daily check-in and execution guidance only; premium reasoning and product/functionality verdicts should stay in the paid full report.

### 2026-06-30 / My check-in event tags

- Branch: feature/my-checkin-event-tags
- Task type: limited execution
- Routing decision: Medium My Skin check-in/data-display extension scoped to `daily_checkins.context.checkinEvents`, check-in form toggles, and diary preview tags. Premium report, full-report components, Face Lab, free result, SurveyFlow, recommendation scoring, DB schema/migration/RLS, auth, and payment were out of scope.
- Goal: Let users record lightweight daily events alongside skin sliders and memo, then show those events in My diary rows without causal interpretation.
- Changed files: app/my/check-in/page.js, app/api/my/check-in/route.js, components/my/DailyCheckInForm.jsx, components/my/MyDashboard.jsx, lib/my/checkin-events.js, lib/my/i18n.js, docs/architecture/my-daily-care-contract-v1.md, .codex/AI_WORK_LOG.md
- Protected areas: No premium/full-report, Face Lab, free result, SurveyFlow, recommendation engine, DB migration/RLS, auth, payment, or product DB changes.
- Validation: `npm run build` passed; `git diff --check` passed with CRLF warnings only. Helper-level checks confirmed null/empty/unexpected context normalizes missing or invalid event keys to false, and context merge preserves unrelated object keys while replacing only `checkinEvents` plus source. Authenticated browser verified the check-in form renders six new event toggles with no sensitive health tags, multiple-event save shows three diary tags plus `+1`, zero-event save removes event chips without rendering an empty memo label, one-event save shows only `새 제품 사용`, re-entry restores that single event, and console/page errors 0. Browser viewport checks reported no horizontal overflow, though the in-app viewport override reported 520px when set to 390px.
- Follow-up: Unified makeup/outdoor with the six context events into one compact two-column check-in event chip grid. This was UI-only: `makeup_today`, `outdoor_today`, and `context.checkinEvents` storage contracts were not changed.
- Follow-up fix: Stabilized the My trend default metric so it is selected from the latest 7-day aggregate instead of the latest single check-in, with a fixed redness fallback when all recent values are zero. Also hardened `context.checkinEvents` normalization for object/null/stringified JSON inputs so dashboard diary tags and check-in form restore share the same parsing contract.
- Browser-comment follow-up: Removed the My home latest-report card and routine footer reminder, moved the latest report action to a top header button when a public `/r/{shareId}` result exists, changed trend preview to metric tabs with the latest 7-day aggregate metric selected by default, converted diary preview to a compact calendar with memo markers/tooltips, and localized profile baseline values through My i18n maps.
- Follow-up: Changed saved free reports to create a private `analysis_results.share_id` at save time and link `saved_reports.source_type/source_session_id` to that share id. `/r/{shareId}` now allows owner access when private and external access only after `is_public=true`; result share/copy actions publish the existing share id instead of creating a duplicate row when one is already cached for the current result.
- Follow-up fix: Unified `/r/{shareId}` and `/api/results/{shareId}` access through a shared analysis-result owner/public helper. `/api/results` publish now resolves the owner from bearer or server cookies for existing `shareId` rows, and ResultShareActions can publish an existing share id without requiring the old analysis write session. E2E verified private owner page/API 200, anonymous private page/API 404, publish keeps the same share id and flips the single row to public, and anonymous public page/API 200.
- Issues/risks: Exact authenticated 390px measurement is limited by the in-app browser viewport override reporting 520px inner width. Check-in page initial restore uses the latest user check-in and applies it only when it matches the browser-local date after mount.
- Context promotion candidate: My check-in events are observation tags only and must not become causal claims or premium-style product/functionality judgments in My.
