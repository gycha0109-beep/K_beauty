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

## Orbital hub follow-up — 2026-09-22

The latest reference replaces the petal overview with four glass/water planets and copper orbital paths. Routine and functional plan occupy the upper corners; condition response and investigation occupy the lower corners. The Face Lab implementation and separate end-of-report entry are preserved, but it is no longer a hub sector.

The hub uses saved functional-plan text and mode. The fixture shown in the screenshots is START, so the reference image's HOLD/stabilization wording is deliberately not copied. No date, saved/privacy assertion, cause attribution or skin condition is invented. The reference landscape is interpreted with quiet contour lines; the dock contains two real actions rather than an unsupported save-status claim.

Re-executed: focused four-sector verifier, production build, architecture guard, browser flows, and lint attempt. Lint still exits at the pre-existing ESLint setup prompt; existing build warnings and root nonce warning remain as documented above. A second browser run timed out on the existing port 3014 dev server before entering the report; a fresh dev server on 3015 was used for final verification, without changing application behavior or weakening assertions.

Visual self-review: compared the actual 390/430px Light/Dark hub renders with the supplied reference, checked corner order, central summary hierarchy, thin orbits, serif labels, input dock, keyboard focus and touch targets. Removed neighboring-tile bleed at the decorative sphere edges. Both themes use the same layout and data. Four hub destinations and both dock actions are exercised by the browser verifier. All earlier detailed-sector interactions remain covered.

| Hub | Light | Dark |
| --- | --- | --- |
| 390px | [Screenshot](../../artifacts/full-report-four-sector/hub-390-light.png) | [Screenshot](../../artifacts/full-report-four-sector/hub-390-dark.png) |
| 430px | [Screenshot](../../artifacts/full-report-four-sector/hub-430-light.png) | [Screenshot](../../artifacts/full-report-four-sector/hub-430-dark.png) |

Generated art and exact prompt: [asset record](full-report-orb-assets.md). Overall status remains IMPLEMENTED_UNVERIFIED for repository-wide lint and hosted authenticated persistence; the local UI checks are separately reported as passing.

## Layout correction after user review — 2026-09-22

The user rejected the previous visual result: small detached spheres, scattered labels, excessive orbital curves and bottom contour lines. Removed all decorative orbit/contour paths, redundant English labels, floating arrows and signoff ornament. Enlarged the Korean sector labels, gave the center sphere a restrained material texture, and tied the composition to its actual container width. Narrow screens have explicit label clearance; missing canonical text remains neutral rather than an invented diagnosis.

Verified the actual user route `http://localhost:3001/test-full-report`, in addition to intercepted canonical fixtures. `node scripts/verify-full-report-hub-layout.mjs` checks 320/390/430px in both themes, visible control bounds (not merely document overflow), minimum label size, separated controls and clearance above the dock. Full-page captures: `artifacts/full-report-four-sector/actual-test-hub-{width}-{theme}.png`. Self-review caught and corrected the 320px aspect-ratio/min-height width expansion; controls now remain inside the visible frame.

Production build and existing four-sector browser flows pass. Previously documented lint/CSP/hosted-auth limitations remain. No decision, persistence or Face Lab behavior was changed.
