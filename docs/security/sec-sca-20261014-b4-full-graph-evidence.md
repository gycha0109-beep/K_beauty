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
9. Where SDK/JDK are present, attempt Android `assembleDebug` with two workers, bounded 20-minute budget and 4 GiB Gradle heap; record raw logs, exact exit and APK SHA256 if produced. This is separate from device acceptance.
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

Final exact-head run results and candidate audits are appended after execution. Until then compatibility/Android completion is NOT_ATTESTED, B4 acceptance HOLD, B6 remediation/merge readiness HOLD and B7 NOT_AUTHORIZED.
