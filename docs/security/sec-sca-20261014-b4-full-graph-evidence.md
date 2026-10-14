# B4 full-workspace candidate evidence and release HOLD

Watchtower-Track: security

## Authority and immutable inputs

- User explicitly authorized branch development, full dependency experiments, CI repairs, mobile/Android tests, documents and PR updates. Public package publication, production deployment and main merge are not authorized.
- Execution/diagnosis routing: dependency and CI security surface only. DB/Auth/RLS/Storage/Provider/Payment/Secret/Production execution = N; tests use disposable generated signing keys, never production services or credentials.
- Starting PR #1288 HEAD: `b9849abdbb287a6691c64b1f637fa3e23b38f33a`. Latest main at initial refresh: `1a82cf9961f4fbba30d1d59f1ec2de1a3c6dd7e2`; it is already an ancestor of the starting branch. No unrelated main changes overwritten.
- Existing B1/B2/B3 sources, pinned upstream patches and six rebuilt forge distribution files are reused. Original manifests remain release-unapproved. B3 evidence is preserved in [the prior ledger](sec-sca-20261014-b3-temp-package-evidence.md).
- Concurrent resolver/LF corrections `46e58ce`, `2d34899`, `dba50ec` were preserved through fast-forward descendants; rejected non-fast-forward ref writes were not forced.

## Official upgrade decision — refreshed 2026-10-14

| Package | Registry latest / locked | Official advisory | Patched release |
| --- | --- | --- | --- |
| braces | 3.0.3 / 3.0.3 | [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), affected <=3.0.3 | None |
| node-forge | 1.4.0 / 1.4.0 | [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv), affected <=1.4.0 | None |

`npm view <name> version dist --json` was executed against the official registry; original SHA512 agrees with the two source manifests. [braces PR #72](https://github.com/micromatch/braces/pull/72) remains closed/unmerged; [forge PR #1152](https://github.com/digitalbazaar/forge/pull/1152) is the pinned RSA patch source. An audit suggestion to downgrade Expo to 44 or migrate Tailwind to a new major does not establish compatible elimination of these vulnerabilities. No arbitrary downgrade or package alias is adopted.

## Original app graph and audit

- Full root plus four workspaces: mobile, shared, face-contracts, synthetic-evaluation. Lock path tracer resolves 653 reachable nodes, zero unresolved dependency edges.
- Root `node_modules/braces@3.0.3` and `node_modules/node-forge@1.4.0`: one lock path each, no additional original nested target entries.
- braces consumers include micromatch used by Expo/Metro/React Native and web build tools. Forge consumers include `@expo/cli` and `@expo/code-signing-certificates@0.0.6` (declared `^1.3.3`). B4 enumerates every direct consumer resolution from the candidate lock and physical install, rather than trusting these examples.
- Raw original full audit: HIGH 22 / CRITICAL 0 / MODERATE 13. Production: HIGH 19 / CRITICAL 0 / MODERATE 11. Both exit 1. HIGH leaf causes are the two advisories above; propagated HIGH package counts are not 22 distinct advisory root causes.
- Additional moderate leaves: decode-uri-component, uuid, postcss-selector-parser (full only), and two Next advisories requiring 15.5.27. These are retained in raw JSON; they are not allowlisted or silently excluded.
- Canonical `verify-supply-chain-audit.mjs` still fails on the expired braces exception (2026-10-10). Neither exception expiry, baseline, severity handling nor required check was weakened.
- Local Windows `npm ci --ignore-scripts` failed EPERM on workspace symlink creation. Local installation/build is not attested. Linux CI performs the actual clean physical install.

## B4 implementation and evidence contract

`scripts/security/run-sca-b4-full-graph-candidate.mjs` is invoked from the existing verified B3 browser producer while its private temporary forge tarball still exists. No archive is transferred to another runner or uploaded to public Actions artifacts.

1. Archive exact committed HEAD into OS temp, preserving every root/workspace source and manifest. Reject differing original lock digest.
2. Pack reviewed braces source; reuse the B3 full 59-file forge archive with six rebuilt browser outputs. Keep original package names and versions, licenses and source metadata.
3. Add two file overrides only in the disposable root manifest. Use npm's resolver to create the candidate lock; never edit lock entries by hand. Validate each target version, file resolution and SHA512 against the actual archive.
4. Reject unrelated dependency version/resolution/integrity drift. Run full `npm ci --ignore-scripts`; assert lock digest stable and every installed target file byte-identical to its packed inventory.
5. Census physical root/nested target packages and all consumers' actual module resolution. Require census to equal candidate lock target paths. Run `npm ls braces node-forge --all --json` without suppressing invalid/extraneous errors.
6. Run parser-depth/AST/cycle/glob, real micromatch/fast-glob and RSA/Expo signing consumer tests using the physically installed candidate graph. The original graph supplies the vulnerable negative control only.
7. Preserve verbatim full and production audit JSON and exit status for both baseline and candidate, plus exact stdout SHA256 and advisory leaves. Same-version file patch scanner gaps, if any, are recorded, never promoted to remediation.
8. Exercise ordinary lifecycle `npm ci`, then recheck lock/installed patched bytes and Expo signing. Run mobile TypeScript, architecture lint, entry routing, config, Metro Android export, Android prebuild/native shell and root Next build.
9. Where SDK/JDK are present, attempt Android `assembleDebug` with two workers, bounded 30-minute budget and 4 GiB Gradle heap; record raw logs, exact exit and APK SHA256 if produced. First clean build succeeded in 19m31s inside its original 20-minute limit. This is separate from device acceptance.
10. Delete all candidate sources, dependencies, archives and candidate lock in `finally`. Root product package/lock/mobile manifest unchanged. Never commit a temporary file path as a released dependency.

The experiment's install/compatibility status is separate from **B4 release acceptance HOLD**. An isolated experiment job can succeed while the mandatory original audit fails. No test failure is converted to success, and no claim of app remediation or audit HIGH0 follows from experiment completion alone.

### Resolver failure diagnosed

First B4 run at `e401a478` ([Security #38510062477](https://github.com/gycha0109-beep/K_beauty/actions/runs/38510062477)) correctly rejected node-forge's retained original registry integrity after `npm install --package-lock-only` with a same-version file override. Expected patched SHA512 differed from the old official tarball. Targeted `npm update` refresh through Arborist was added; byte/hash assertions were kept intact. B3 browser/pack tests had passed before this B4 rejection.

## Integrity, license and maintenance handoff

| Field | Evidence / release condition |
| --- | --- |
| braces upstream patch | `28d440b5dd449dbf1fe6f3506cf94ecca4d02660`; five reviewed library files only |
| forge upstream patch | `ceba34402e329f0365134f23fe19898756527d65`; patched RSA SHA256 `acc22e5d36e27832c34e02dd3933aad7977d45b047eead5016520735efedc9c5` |
| braces temp tarball | SHA256 `d4f1219db19bfeb4e1c3f0354f9269569393f1b8c9f8c0295b80346926d4fa70`; 10 files |
| forge full-dist temp tarball | SHA256 `67a51b864d9e483417ff34425a5a09012d333a5184dcc39f966731935463db50`; 59 files, 6 dist entries |
| build tools | upstream pinned webpack 4.44.1 / webpack-cli 3.3.12; exact Node/npm and webpack-config hash logged per run. Old build-tool dependencies remain confined to the disposable build harness, not the app graph |
| braces license | MIT; original LICENSE SHA256 `35bdd8a44339719441900fb50fbefc5e2dca1ca662cbaed7a687de842c8b70f2` |
| forge license | source offers BSD-3-Clause OR GPL-2.0; original LICENSE SHA256 `f63ff0e4e239244aa79280da2dd4811a0469e5e201caf5cbc0d97c3a1dff8e82`; keep copyright and distribution notices, including binary redistribution notices |
| NOTICE/source record | preserve all original licensed files and copyright headers; release NOTICE must identify original versions, upstream patch SHAs, changed files, rebuilt bundles, chosen license and local patch ownership |
| SBOM | B3 scoped archive SBOM retained. B4 emits candidate installed graph CycloneDX with lock paths, SRI-derived hex SHA512 and patched content fingerprints; it must label patch entries TEMP_PATCH_NOT_RELEASED |
| private destination | UNKNOWN / NOT_AUTHORIZED; no registry credential or approved retention endpoint available |
| owner/reviewer | maintainer, security reviewer and license/distribution approver have not been appointed; no invented approval |
| release versions | must identify a real maintained patched release, with upstream ancestry, exact bytes and changelog. Do not bump metadata merely to escape advisory ranges |
| monitoring | on dependency/toolchain/upstream change, rerun provenance, consumer, full graph, raw audits and Android checks. Replace with compatible official fixed releases when available; retain patch drift tests until migration verified |
| rollback | discard disposable candidate on failure; never automatically return a deployed remediated system to the vulnerable originals |

## Remaining external gate

App remediation requires an approved durable artifact distribution path and accountable maintainer/security/distribution review, or compatible official fixed releases. Private patched distribution must address unchanged-name/version audit findings through a reviewable release/advisory process; policy waiver or fake semver is not an acceptable substitute. A physical device/emulator with an isolated backend is also needed for camera/entry/result/Premium smoke. No production API is exercised by this experiment.

## Verified full graph and Android result

At exact code HEAD `7b3c77c31f3adf3d9af410b015ee22f771fdf091`, [Supply Chain #38510868609](https://github.com/gycha0109-beep/K_beauty/actions/runs/38510868609) B3 browser + B4 full graph experiment **PASS**. Canonical audit **FAIL** remains mandatory. [Main Health #38510868550](https://github.com/gycha0109-beep/K_beauty/actions/runs/38510868550), CodeQL, [PIE #38510869008](https://github.com/gycha0109-beep/K_beauty/actions/runs/38510869008) and both independent original/full-dist B3 replays PASS.

| Evidence | Actual result |
| --- | --- |
| Original lock SHA256 | `f6016eba1c16a5a67df894a389b4449a2723103b7c06824007a14ce9b190a23b` |
| Disposable candidate lock SHA256 | `10fefaa2f66093402bd57419b9dda6060168a6dc643f64fc223f9889693d94af`; generated by npm, not committed |
| Installed braces | 10 files, content inventory SHA256 `6b22eeb1da5bfb46a3911d9b59819962f6ad90eeb240e3345a6b0be6b4d32c6f` |
| Installed forge | 59 files, content inventory SHA256 `4151bdb83226bf167857f73d6888b065d581a2f56ff33a6ca8988a54be5da524`; six dist hashes match producer |
| Consumer closure | @expo/cli + @expo/code-signing-certificates resolve the same patched forge; chokidar + micromatch resolve the same patched braces; one physical path per target, no extra nested target |
| Installs | Full workspace npm ci without lifecycle PASS; ordinary lifecycle npm ci PASS; lock and patched bytes rechecked |
| Regression | Parser/AST/cycle, micromatch braces/braceExpand, fast-glob, malformed RSA negative control and actual Expo signing consumer PASS |
| Candidate full audit | exit 1, HIGH 22 / CRITICAL 0 / MODERATE 13; raw SHA256 `d22e604fffe283ccc07648e09eaa9cae6739eb59fda7b9dc79fa4a7c0d14387b` |
| Candidate production audit | exit 1, HIGH 19 / CRITICAL 0 / MODERATE 11; raw SHA256 `c55817a769347015a549836e4d94ffc46fa12aa0fd5ab147a3f1ea228b5e6ad6` |
| Baseline/candidate scanner | Verbatim JSON SHA is identical; both real target advisory leaves remain present. No scanner blind spot or audit HIGH0 claim |
| Mobile static/config | typecheck, architecture lint/foundation, entry routing and public Expo config PASS |
| Metro export | Android Hermes entry SHA256 `7686412dd872bd5f0215cf1cd9ddf9f2e4e1f30f98c9a1ce29a49fb6cfb6ff9f` |
| Native | Android prebuild and native shell assertions PASS; only disposable mobile manifest modified by prebuild |
| Root app | Production Next build PASS on the patched graph |
| Android debug | Gradle exit 0, BUILD SUCCESSFUL in 19m31s, JDK Temurin 17.0.20.1+1; APK SHA256 `9771d52c99d759a16ae7f84fcae742edc11d91dcb4d4f5bb222df14aec621205` |
| Device/API/Auth | NOT_RUN; no device smoke or approved isolated API/Auth configuration supplied. Mobile runtime requires EXPO_PUBLIC_API_BASE_URL and isolated Supabase public configuration; no production values are used |

This proves candidate build compatibility. A debug native APK and separate Metro export do not prove production/device behavior or that build-only signing dependencies are embedded in the APK. App source manifests and lock remain the original vulnerable targets; this is not released remediation.

The first SBOM emission enumerated 720 **lock catalogue** entries, including platform-optional packages not physically installed. Its SHA `04abeb03bec9b71c69a677a3dec958702b91d94bf4224abffff78d34acabee05` is historical lock-catalogue evidence, not an installed-all-platform attestation. The final implementation filters by actual package.json existence, verifies installed name/version and preserves original npm license metadata as descriptive license names (including legacy objects/arrays), without inventing SPDX validity or legal approval. No audit JSON or finding is changed by that correction.

Cache isolation is a release-boundary repair: file-tarball npm installs can leave byte copies in npm's content cache. The first job explicitly logged an original cache-key hit and **not saving cache**, so no private patch upload was observed. Final B3/B4 producers use their own disposable npm caches, deleted with temporary outputs; all four patch-producing/replay jobs disable setup-node package-manager caching. No Gradle/app-output cache is uploaded. Canonical original-only npm caching is unchanged.

The final delta also rechecks workspace-local target census after lifecycle install, rejects unrelated removals as well as upgrades, and adds bounded unauthenticated local page smoke. Final exact-head CI is required for those changes; previous APK/installed bytes evidence remains attached to its tested code SHA.

## Status and companion official remediation

- B0 input refresh/path/advisory/audit evidence PASS; owner/durable distribution decisions HOLD.
- B1/B2 source behavior PASS; B3 technical provenance/reproducibility PASS, formal redistribution/maintenance/security approval HOLD.
- B4 physical full graph/consumer/build experiment PASS; acceptance **HOLD** because raw full/prod audit still FAIL and no approved distributed release exists.
- B5 export/prebuild/debug APK PASS on the candidate; actual device/API/Auth smoke NOT_RUN, formal runtime acceptance HOLD.
- B6 merge-ready remediation/policy-v2/security sign-off HOLD; canonical policy is unchanged. B7 main merge/publication NOT_AUTHORIZED.
- Separate [PR #1294](https://github.com/gycha0109-beep/K_beauty/pull/1294) uses official Next 15.5.27, removes two moderate advisory leaves and lowers moderate vulnerable-package counts from 13/11 to 12/10. Build/local HTML smoke and ordinary CI PASS; genuine braces/forge HIGH 22/19 and mandatory audit FAIL remain. Do not confuse that official patch with private braces/forge release approval.

First-run closeout from concurrent commits `0213c94d` / `2eef0c66` is preserved in the verified table and gate dispositions above. The initial 720-component SBOM statement is explicitly corrected to a lock catalogue; no source/audit/APK evidence from that closeout is dropped. The original mandatory Security failure is solely its audit gate; compatible technical experiments do not authorize a distributed security release.

Native compiler setup uses the observed-compatible Temurin JDK 17; setup-java verifies downloaded signatures. No Gradle dependency/app-output cache is exported. Final exact-head verification covers the cache/privacy, physical-SBOM and local-smoke deltas; the immutable first-run Android/SCA proof above remains unchanged.
