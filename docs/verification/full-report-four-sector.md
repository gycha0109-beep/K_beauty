# Four-sector Full Report verification

## Scope and result

Local implementation and focused verification of UI, read-only joins and additive condition projection. No production, database, policy engine, auth or Face Lab implementation change.

Overall status: **IMPLEMENTED_UNVERIFIED** for the complete requested acceptance gate. UI and focused contracts pass, but repository lint cannot run without an ESLint installation/configuration, and a pre-existing root-layout nonce hydration warning remains. Hosted authenticated persistence was not exercised; fixture replay is not claimed as hosted E2E.

## Executed checks

| Check | Result |
| --- | --- |
| `node scripts/verify-full-report-four-sector.mjs` | PASS: projection arrays, legacy carryover, unknown, suppression, two-/three-part verdict joins, identity isolation, four-sector order |
| `node scripts/verify-premium-integrated-evaluation-v2.mjs` | PASS: 462 assertions, 21 logical scenarios, 31 variants, 6 negative cases |
| `node scripts/verify-skin-decision-persistence-reentry.mjs` | PASS |
| `npm run build` | Completed successfully with existing import warnings described below |
| `npm run lint` | Not passed: opens ESLint setup prompt; no ESLint dependency or configuration exists |
| `node scripts/verify-full-report-four-sector-browser.mjs` | PASS for the explicit local fixture checks below; known root nonce warning recorded separately |

Browser command expects a local dev server, e.g. `npx --no-install next dev -p 3014`. The runner rejects non-local base URLs, intercepts report/API requests and external traffic, and creates no production data. Canonical fixture responses are built by the existing decision engine inside the test, not in the UI. The fixtures are clearly named test products and never enter application production payloads.

- 390px and 430px, both themes, all four sectors, no horizontal document overflow.
- AM/PM switch and product evidence disclosure.
- Scenario count equals the payload; scenario selection changes active guidance.
- Saved-report URL reload re-requests the same ID through the intercepted API.
- English section navigation, legacy response fallback, absent condition list, UNKNOWN preservation, canonical START preservation.
- Current-product not-in-database/not-using choices, usage metadata and skipped intake answers survive the actual Intake UI submission into the intercepted report request.
- The last CTA requests My (the existing unauthenticated redirect is preserved), and the separate Face Lab entry opens normally.
- No uncaught page errors or unexpected console errors. The known CSP nonce hydration console issue is recorded, not counted as a clean console.
- Screenshots hide only the Next development toolbar, which otherwise floats over the report. They do not hide application content or change payloads.

## Visual self-review

The supplied design was compared with actual browser screenshots. Routine uses compact numbered rows, end-aligned chips and AM/PM controls; investigation uses a signal list and ordered checks; the next-change page uses the four colored quadrants and a condition-based sequence; situational care uses horizontal scenario controls, a hero, three response groups and a two-column comparison.

During review, fixed the safe-image placeholder expanding to full width, wrapped two-digit row numbers, missing canonical two-part verdict joins and duplicated AM/PM matrix rows. Product/role counts and actual saved text determine density. Decorative flower/product imagery and the sample-specific dates, products and causal graphs are not reproduced as personalized facts.

| Sector | Light, 390px | Dark, 390px |
| --- | --- | --- |
| Routine | [Screenshot](../../artifacts/full-report-four-sector/390-light-1.png) | [Screenshot](../../artifacts/full-report-four-sector/390-dark-1.png) |
| Investigation | [Screenshot](../../artifacts/full-report-four-sector/390-light-2.png) | [Screenshot](../../artifacts/full-report-four-sector/390-dark-2.png) |
| Plan | [Screenshot](../../artifacts/full-report-four-sector/390-light-3.png) | [Screenshot](../../artifacts/full-report-four-sector/390-dark-3.png) |
| Conditions | [Screenshot](../../artifacts/full-report-four-sector/390-light-4.png) | [Screenshot](../../artifacts/full-report-four-sector/390-dark-4.png) |

The same directory contains 430px and full viewport captures plus `verification.json`.

## Remaining baseline/environment limitations

1. **Lint setup** — expected: non-interactive lint; observed: `next lint` asks to configure ESLint and exits without a lint result. Runtime: Node 24 / Next 15.5.22 on Windows. Stage: lint initialization. Classification: repository toolchain gap. Reproduce: `npm run lint`. No unrelated package/config change was made.
2. **Build warnings** — `buildSurveyInputContract` export warnings from unchanged analysis/product-evidence paths. The build exits zero; warnings are not claimed resolved. Reproduce: `npm run build`.
3. **Root CSP nonce hydration** — expected: matching server/client root attributes; observed: script `nonce` attribute mismatch on the unchanged root layout. Occurs even on the existing `/test-full-report` route. Stage: initial hydration. Classification: pre-existing protected root/security integration issue. Not corrected in this UI scope.
4. **Hosted persistence/auth** — local snapshot contract and intercepted reentry pass; real authenticated Intake → saved report → My reentry needs a separately available authenticated environment. No hosted success is claimed.

Self-review found no remaining Critical/High issue in the modified decision/display boundary. The complete acceptance gate remains open for the limitations above.

## Approved card overview — 2026-09-23

The latest supplied reference supersedes the sphere hub. The final overview has a centered brand, saved-data hero, 2×2 grid (routine/investigation/plan/conditions), report dock, and separate Face Lab banner. Shared light/dark layout uses muted sage, rose, blue and violet accents and decorative texture art. Counts, product previews, mode and scenario evidence are read from the actual saved report; unknowns do not borrow example values.

Local checks: build passed after fixing a CSS-module pure-selector compilation error; focused authority verifier passed; four-sector browser flows passed. The actual user route localhost:3001/test-full-report was checked at 320/390/430/1024 in Light/Dark. The layout verifier asserts exact card order, aligned rows, non-overlap, visible bounds and dock clearance. Self-review corrected narrow-screen dock wrapping and removed the hero texture's hard rectangular edge.

Screenshots in artifacts/full-report-four-sector: actual-test-hub-{width}-{theme}.png show the actual route; hub-{390|430}-{theme}.png show canonical fixture data. The four detailed-sector screenshot sets remain. Browser fixtures never write production data. Earlier lint/CSP/hosted-auth limitations remain; the overall full acceptance status is still IMPLEMENTED_UNVERIFIED, while the listed local UI checks pass.

[1024px light](../../artifacts/full-report-four-sector/actual-test-hub-1024-light.png) · [390px light](../../artifacts/full-report-four-sector/actual-test-hub-390-light.png) · [390px dark](../../artifacts/full-report-four-sector/actual-test-hub-390-dark.png)

[Generated texture and prompt](full-report-card-assets.md).
