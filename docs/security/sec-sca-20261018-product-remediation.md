# BEJEWELY product dependency remediation — 2026-10-18

Status: **IMPLEMENTED_UNVERIFIED for hosted CI / production rollout**. Required local Windows/Linux checks, Android x86_64 debug/release builds and device smoke passed. New-head GitHub CI, iOS native verification, merge and deployment have not run.

Source baseline: `main@1a82cf9961f4fbba30d1d59f1ec2de1a3c6dd7e2`.
Product branch: `codex/security/sca-product-remediation-20261017`.
PR #1299 remains the separate B6 publication record; publication was not repeated.
Condensed observed results: [`product-remediation-verification.json`](../../security/product-remediation-verification.json).

## Actual causes and changes

The original root audit contained **22 high + 13 moderate = 35 findings** (production: 19 high + 11 moderate = 30). These are dependency propagation counts, not 35 independent flaws: seven leaf advisories affect six packages. Investigation of the separately installed crawler, required by the canonical product verifier, found another **one high + one low = two findings**, covering three leaf advisories.

| Package / advisory | Actual consumer and exposure | Product fix |
| --- | --- | --- |
| braces / GHSA-vfj7-8cjw-p6xm | Transitive micromatch/chokidar tooling; npm production classification also includes mobile build tooling | Approved private `@gycha0109-beep/braces@3.0.3`; depth-limited parser and AST walkers |
| node-forge / GHSA-86w9-cpqp-85rv | Expo CLI/code-signing tooling, not a direct browser cryptography import | Approved private `@gycha0109-beep/node-forge@1.4.0`; malformed nested DigestAlgorithm rejected |
| decode-uri-component / GHSA-vcc3-ghjq-m6fr | query-string used by Expo Router navigation/deep links; relevant to mobile runtime | Existing CommonJS `safe-decode-uri-component@1.2.1`, pinned source hashes and linear decoder |
| next / GHSA-4jqv-mc3x-m676, GHSA-mcj8-r9mp-w47p | Direct web framework/server | Official 15.5.28 |
| postcss-selector-parser / GHSA-rj75-hqrm-r3gf | Tailwind/postcss-nested CSS build | Official 7.1.6 |
| uuid / GHSA-w5hq-g745-h8pq | xcode/Expo native tooling | Official 11.1.1, retaining callable CommonJS compatibility |
| crawler ws / GHSA-58qx-3vcg-4xpx, GHSA-96hv-2xvq-fx4p | Puppeteer crawler transport, separate lockfile | Official ws 8.22.0 through its existing compatible range |
| crawler esbuild / GHSA-g7r4-m6w7-qqqr | tsx developer runner, separate lockfile | tsx 4.23.15 / esbuild 0.28.2 |

All high findings in the original root graph trace to braces/forge; the moderate findings do not. npm `--omit=dev` is an installation classification, not proof that every flagged tool ships inside a web/mobile application. Expo Router's query-string import was checked directly. The inspected Next build traces contain none of braces/forge/decoder/uuid/selector-parser; this observation does not replace graph-wide verification.

Official decode-uri-component 0.5.0 is ESM-only and breaks the callable CommonJS consumer. The selected existing replacement preserves valid Unicode/query roundtrips; malformed UTF-8 remains literal rather than undergoing the legacy replacement-character behavior. No new package was published. Root exact dependency references plus `$` overrides ensure npm 10 also replaces workspace transitive copies. Node 22 / npm 10.9.9 are the verified installation toolchain.

## Proof beyond package names

[`security/product-installed-patches.json`](../../security/product-installed-patches.json) binds the approved B6 candidate `17119d9a264faba07951e8db3519a8ef23452504e30212b6a18c34994980621d`, archive integrity and installed source/license inventories: braces 13 files, forge 64 files, decoder three files. It contains no private package contents or credentials.

`verify-product-installed-security.mjs` verifies the actual installed bytes, every lockfile consumer's resolution, and a physical nested-package census. Its child probe checks valid patterns, excessive parser/AST depth, valid/invalid RSA signatures, malformed ASN.1 rejection, Expo certificate compatibility, 1,024 Unicode/query-string roundtrips, a 600 KB malformed decoder input, large selectors and UUID buffer bounds. Separate negative controls rejected a changed expected source hash, changed lock integrity and an unverified hidden original-package copy.

Fresh standard npm audits are **zero for root full/production and crawler full/production**. The immutable pre-change baseline remains FAIL. An additional disposable metadata-only lock restores original identities for advisory lookup and installs nothing: its **raw full audit remains FAIL (22 high / three moderate / total 25)** and **raw production audit remains FAIL (19 high / three moderate / total 22)**. These remaining original-identity advisories are exactly the three byte/behavior-verified replacement targets. Raw failures are neither rewritten nor subtracted into a fabricated PASS. Any new original-name advisory without verified remediation fails the product gate. Namespace scanner silence alone is explicitly insufficient.

## Installation and trust flow

The source `.npmrc` contains public registry routing only. `install-product-dependencies.mjs` obtains `SCA_PACKAGES_READ_TOKEN` from the execution environment, creates a user-protected temporary npm configuration/cache, installs the pinned lock with all lifecycle scripts disabled, deletes that configuration/cache, verifies installed content and only then optionally rebuilds dependencies. Raw registry diagnostics and credentials are never printed. Missing authentication fails before touching an existing installation; there is no vulnerable upstream fallback.

The owner read-only classic credential is stored in the repository Actions secret `SCA_PACKAGES_READ_TOKEN`; only its existence/expiry metadata was checked. It expires **2026-10-24T15:17:16Z**. Forty-three root install sites in 31 semantically changed workflows use the authenticated installer; six standalone crawler installs retain their original independent install flow. Job IDs, job-level topology/needs, action references and step counts were checked unchanged. Security workflow triggers additionally cover the inventory, registry routing and crawler locks; its audit step runs the three credential-isolation tests.

Local installs use an owner-controlled environment/secret bridge, never a committed token. Outside Actions, any build service must explicitly provide the same owner read-only secret and run `node scripts/security/install-product-dependencies.mjs`; default unauthenticated `npm ci` will fail closed. No production build-service secret or install setting was changed. A future production rollout is blocked until its authorized operator configures and verifies this install path. Fork PRs without repository secrets cannot install these private dependencies; access is not broadened to bypass that boundary.

Architecture Check:

* Docs updated: yes
* Ghost-code risk: passed; existing install consumers were connected, no parallel auth fallback
* Notes: private installation now has an explicit credential-removal/content-verification boundary and a single approved content inventory. Existing API/DB/domain/storage contracts are unchanged. Decoder malformed-input compatibility is described above.

## Verified and unperformed work

* Windows installed-content/adversarial verification and three installer isolation tests: PASS.
* Clean Linux Node 22.23.3 / npm 10.9.9 installation, targeted security checks and installer tests: PASS.
* Canonical `npm run verify:current`, including production Next build and its nested product/contracts/CI responsibility checks: PASS on Linux. Recommendation deterministic replay (164 cases × 12 repetitions), mobile type/lint/contracts and Android Metro/Hermes export also passed.
* Web public pages: HTTP 200. Anonymous/invalid bearer protected reads: HTTP 401. Premium access remains denied. Actual owner Google login, authenticated dashboard and existing saved-report reads: PASS. Public Supabase health/settings: HTTP 200. No paid analysis or record mutation was performed.
* Final Android x86_64 debug/release native builds: PASS from a disposable short build path with the full 669-node installed dependency census checked. Both embedded release and original-template debug APK device smoke: PASS for capture/retake/survey, signed-out saved-report and premium guards, invalid shared link, Home, Korean locale and theme. Initial Windows long-path native builds and IPv6-only Metro connections failed; those attempts are not passing results. The final unchanged app template connected to IPv4 Metro and passed the complete smoke; no app developer-support change remains.
* Changed-file credential/owner-path scan and final Next/Expo/debug/release artifact scan: PASS, zero detections across 3,214 artifact files. Patterns covered GitHub PATs, actual private PEM material, secret Supabase/provider prefixes and privileged Supabase JWTs; this bounded scan does not substitute for hosted GitGuardian/CodeQL.
* iOS native/device execution, Android ARM native builds, authenticated mobile-provider login and paid/provider analysis: NOT_RUN. Windows has no Apple native toolchain; no real mobile/provider credentials or paid execution were introduced.
* GitHub checks on a new product commit: NOT_RUN at the local proof snapshot. The user subsequently explicitly authorized product commit/push/PR creation and hosted CI. No main merge, production deploy, package republish or ACL/billing change occurred.

GitGuardian incident **38321889** was formally reviewed as **Not a secret / false positive** in its incident UI. The matched value is a SHA-256 inventory entry for a source file in B6's initial/recovery execution snapshots (193/198 relative file entries), not a token. The exact source-file hash and `privateKeysIncluded=false` / `credentialsIncluded=false` declarations were checked, and the review reason was recorded. Scanning remains enabled. The old GitHub check **117394847341 remains failure**; incident disposition does not retroactively make that check PASS.

Bounded device diagnosis found Windows Metro listening only on IPv6 `::1`: localhost/IPv6 health returned 200 while IPv4 returned connection refused. The disposable Windows harness selects IPv4 DNS order for the existing adb-reverse path. An initially suspected Expo template change was removed after this evidence; no app debug-mode or developer-support override is retained. Android prebuild's unrelated start-script rewrites were discarded. Windows native release building additionally required the official Ninja 1.13.2 executable (verified release archive digest) in a disposable build harness; the SDK and repository toolchain settings were not overwritten. Upstream release: <https://github.com/ninja-build/ninja/releases/tag/v1.13.2>.

## Next gate

Local verification and final diff/content review are complete. The user explicitly authorized product commit/push/PR creation and hosted CI after reviewing this scope, satisfying `.codex/AI_EXECUTION_RULES.md`. Run new-head CI before merge consideration. Deployment and main merge remain separate unapproved actions. Credential expiry and production installer configuration remain rollout prerequisites.
