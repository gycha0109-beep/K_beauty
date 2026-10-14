# Separate crawler dependency remediation — 2026-10-14

Watchtower-Track: security

An additional audit of the canonical Main Health crawler toolchain found HIGH1/LOW1/CRITICAL0 outside the root/four-workspace application lock. Root HIGH22/19 still originate from the two braces/forge advisories; this additional ws finding must not be hidden inside those counts.

`@supabase/realtime-js@2.102.1` requests ws ^8.18.2. Its old ws has [HIGH GHSA-96hv-2xvq-fx4p](https://github.com/advisories/GHSA-96hv-2xvq-fx4p) and [MODERATE GHSA-58qx-3vcg-4xpx](https://github.com/advisories/GHSA-58qx-3vcg-4xpx). Published fixed minima are ws8.21.0 and8.20.1 respectively. `tsx@4.21.0` pins esbuild ~0.27.0, affected by [LOW GHSA-g7r4-m6w7-qqqr](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr), fixed0.28.1. These have normal official upgrade paths and need no private redistribution.

Real `npm --prefix crawler update ws tsx --package-lock-only --ignore-scripts --no-audit --no-fund` resolves official ws8.22.0, tsx4.23.15 and esbuild0.28.2 plus matching platform binaries. No crawler/package.json, root manifest/lock, Supabase SDK version, Auth/DB code or product/provider behavior is changed. Unrelated installed versions/resolved/integrity are compared against main; only ws/tsx/esbuild and @esbuild platform entries change.

The new official tsx no longer requires get-tsconfig; its former get-tsconfig/resolve-pkg-maps nodes are removed by npm. No unrelated nodes are upgraded or removed. Existing tsx-based consumers and TypeScript tests are exercised rather than retaining unused compiler dependencies artificially.

Official integrity pins: ws `sha512-Ydggc987+RO0AnWtZ/7Wq9FtNvcrL1b/RO0ud9mWjUPgDrsAAwQSF51sm2hm1XofbU/4jkpGEsLFsZZxU+1DOg==`; tsx `sha512-Yiex1Ovn8z2xPpOWckIiysV1SSyRMY9BkLF++q0yKiDxCqRhosKfMg3janKkiLBwZ5c/YryloKwGZcrEmtwxKw==`; esbuild `sha512-HKVLS8dvII+xoKW9kmqxbRKrnWEXfJJr/FZhhJmiqIB0e053QNYFqOBouTMO/k5sID4MvCiUCvv8b9M4h32wIA==`. npm ci verifies the actual official archives; names/versions are not fabricated.

Local clean crawler npm ci PASS. Actual realtime consumer resolves ws8.22.0; localhost ordinary echo PASS and excessive tiny fragmented messages are rejected with close1008 before message delivery, without high-memory input. TypeScript, legacy-offer classifier/migration and identity-resolution/adoption/key-repair-plan fixture tests PASS. No live crawl, Supabase/API/Auth/DB operation or data write is performed.

Raw crawler full and production npm audit both return exit0 with ALL severities0. This is **crawler-only** HIGH0, not application HIGH0. Root application audit remains HIGH22/19 and FAIL; Next official patch is independent #1294 and private release readiness is independent #1299 stacked on #1288. Original application security gate is unchanged. The existing supply-chain workflow adds a separate crawler install/real-consumer/raw-audit job and crawler path triggers; it removes no required check and registers no new workflow.

No main merge or deployment is authorized. Rollback is a normal reviewed revert of this independent lock/workflow/test change, followed by npm ci and raw audits; old ws/esbuild vulnerabilities would return and must be reported. Final exact-HEAD CI and cross-PR conflict checks are recorded in the PR after completion.
