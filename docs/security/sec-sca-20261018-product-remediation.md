# BEJEWELY product dependency remediation — 2026-10-18

Status: **Product fixes VERIFIED on `cb1d9379`; production installation IMPLEMENTED_UNVERIFIED**. That exact HEAD passed hosted security, CodeQL, Current Main Health, DB authority, Android, iOS Simulator and GitGuardian checks. The separately approved production-only Secret registration and repository install-command connection below require fresh CI for their new HEAD. Actual Vercel installation, main merge and deployment have not run.

Source baseline: `main@1a82cf9961f4fbba30d1d59f1ec2de1a3c6dd7e2`.
Product branch: `codex/security/sca-product-remediation-20261017`.
PR #1299 remains the separate B6 publication record; publication was not repeated.
Initial local verification snapshot, before hosted CI: [`product-remediation-verification.json`](../../security/product-remediation-verification.json). Current exact-HEAD CI results are maintained in PR #1343 rather than generating result-only commits.

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

Local installs use an owner-controlled environment/secret bridge, never a committed token. Outside Actions, any build service must explicitly provide an owner read-only secret and run `node scripts/security/install-product-dependencies.mjs`; default unauthenticated `npm ci` will fail closed. The user separately authorized the production-only Vercel Secret registration and repository install-command connection below. A future production rollout still requires an actual authorized Vercel build to verify this path. Fork PRs without repository secrets cannot install these private dependencies; access is not broadened to bypass that boundary.

### Approved production installation connection

Read-only preflight identified the repository's Vercel project, a default/null install command and no package-read credential in production. The connector's environment-metadata query was denied (403); the existing authenticated CLI confirmed the same project/scope and read the metadata successfully. No credential or environment value was fetched.

The owner entered the existing classic PAT through a local hidden prompt. A direct GitHub identity/scope/expiry check confirmed owner `gycha0109-beep`, exactly `read:packages`, and expiry **2026-10-24T15:17:16Z**. Vercel accepted `SCA_PACKAGES_READ_TOKEN` as a **production-only Secret**, and a subsequent metadata-only listing confirmed the key, target and Secret type. It was not added to preview/development or Git; no existing secret was overwritten. No PAT/private key/DPAPI credential file was read by the agent.

`vercel.json` now adds only `installCommand: node scripts/security/install-product-dependencies.mjs`; all previous Git deployment, runtime-flag and cron settings are unchanged. This versioned setting becomes active when this source is built. The hosted project-wide install command remains unchanged, so the old main source is not told to run a file it may lack. Non-main automatic deployments remain denied. Node `22.x` in `package.json` takes precedence over the project's default `24.x`, per the [Vercel version contract](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions); no hosted Node setting was changed. The actual build's Node/npm versions must still be checked before rollout.

Vercel supplies environment Secrets to build and runtime; removal from the installer process does not remove a platform-provided runtime variable. The key is not public-prefixed or deliberately copied into outputs. This bounded setup does not establish that a new Vercel deployment is free of embedded credentials: actual hosted build/output verification is **NOT_RUN**. Existing artifact scans belong to the earlier builds.

Actual production/private installation and preview/production deployment remain **NOT_RUN**. The two settings were explicitly approved; main merge and deployment were excluded. Revocation/renewal before expiry and actual hosted installation remain rollout conditions. A rollback, if later authorized before deployment, restores only the added JSON field and removes the newly registered Secret; no rollback or secret removal has run.

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

## Approved DB migration filename reconciliation

The first product HEAD `d0474bfb` ended with 53 successful checks and one failure: two pre-existing repository migration filenames shared `20261012190000`. No dependency-security check failed. The user separately approved reconciling only these filenames and one verifier reference, including commit/push/CI; no hosted DB mutation was approved.

Read-only metadata and SQL-digest queries on the project matching the configured local public URL confirmed both migrations were already applied. Each stored SQL SHA256 exactly matched its Git source. This establishes the connected project's history, not the production deployment's project identity.

| Source filename | Correct applied-history filename |
| --- | --- |
| `20261012190000_taxonomy_ai_r16i_d8d_transactional_apply_v1.sql` | `20261012181320_taxonomy_ai_r16i_d8d_transactional_apply_v1.sql` |
| `20261012190000_trust_p2c_visible_identity_dispositions_v1.sql` | `20261012181544_trust_p2c_visible_identity_dispositions_v1.sql` |

The SQL bytes remain identical (Git and working-file comparisons); each predecessor still sorts before its dependent migration. The R16I verifier's source filename reference changes. Final consumer scanning additionally found two direct `psql -f` references in the existing isolated database CI workflow; those literals are updated to the same approved filenames so runtime tests can open the renamed sources. No command, database target, job topology or execution authority changes. Database authority verification, all 57 R16I guards, workflow semantic comparison and SQL fixture-path existence checks pass. A separate-copy negative control proves a newly introduced version collision still fails; the initial proposed patch also passed `git apply --check` before approval.

No authority expectation, known legacy collision, schema, permission, production record or hosted migration ledger was changed. No migration apply/repair command was run. `fullRepositoryReplayReady=false` remains in force. Existing historical `20260824` collisions and unrelated historical timestamp mappings are not expanded or waived. The new filename-only commit requires fresh exact-HEAD CI; earlier passes are not attributed to it.
