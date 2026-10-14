# Official Next.js security patch — 2026-10-14

Watchtower-Track: security

Pin Next.js 15.5.26 to the officially fixed 15.5.27 and regenerate its normal registry lock entries through npm. This fixes [GHSA-4jqv-mc3x-m676](https://github.com/advisories/GHSA-4jqv-mc3x-m676) and [GHSA-mcj8-r9mp-w47p](https://github.com/advisories/GHSA-mcj8-r9mp-w47p). Ten Next/env/platform SWC entries change; no Expo, braces or forge versions change.

Raw npm audit after resolution: full HIGH 22 / CRITICAL 0 / MODERATE 12; production HIGH 19 / CRITICAL 0 / MODERATE 10; exit 1 for both. `next` is absent from both vulnerability objects. Original full moderate 13 and production moderate 11 included the two Next advisory leaves grouped into one vulnerable-package count.

The unchanged canonical vulnerability gate must still FAIL for genuine braces/forge findings and the expired braces exception. The framework production build runs as an independent verification even after this expected audit failure; it never changes audit outcome. No secret, auth, DB, production or deployment configuration is changed.

This official release patch is independent of the unreleased full-graph B4 experiment in [PR #1288](https://github.com/gycha0109-beep/K_beauty/pull/1288). Neither PR closes Issue #1208. Build and exact-head CI results are appended after verification. Merge is not authorized.

First exact-head verification at `94555471bf59d821f00c61eb90a27f1e70c6fdf3`: [Security #38511390089](https://github.com/gycha0109-beep/K_beauty/actions/runs/38511390089) framework production build PASS, 42 static pages. CodeQL, Security Boundary, Face Foundation and PIE PASS; Main Health failed on the pre-existing exact Next 15.5.26 constant. Updated that guard to exact 15.5.27 and added manifest/lock equality; unrelated contract checks are retained. Local rendered-page smoke is bounded to unauthenticated localhost /, /privacy, /support and makes no provider or device acceptance claim.
