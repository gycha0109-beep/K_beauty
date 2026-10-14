# SEC-SCA B3 — temporary private patched package validation (2026-10-14)

> Track: security · Watchtower-Track: security
> Baseline main `f67b10b5b05a8c69097b6019a972aa2b7c1dbcd5`
> B1 source PR #1270 `4f086760ebe46daa5b3ff6a4dbdadf4090db4fb7`; B2 source PR #1271 `bcd9d4f6895d463d01e3fcd1ba02a5dd4ed5e509`.
> Candidate only; owner/distribution/security approval **HOLD**. No main merge, registry publish, app dependency replacement or policy exception.

## Scope and execution design

1. New security-only branch from the above `main`, copying **17 pinned files** (source manifests, source materializers, tested probes, upstream suite scripts and historical records) from the independent B1/B2 branches, without merging their ancestry.
2. `scripts/security/run-sca-b3-temp-package-repro.mjs` uses only a disposable OS temporary directory. It materializes each patched candidate independently from the original `npm ci` graph, packs each source **twice** with `npm pack --ignore-scripts --offline --json`, validates the actual contents, archive SHA-256/SHA-512, and per-file SHA-256, and compares both builds byte-for-byte. No tarball is committed or published.
3. B1: only the five pinned library source files may differ from original. B2: take the complete original npm package and replace only the upstream blob-verified `lib/rsa.js`. **Quarantine all six unpatched prebuilt `dist/*.min.js[.map]` files** rather than shipping vulnerable browser bundles unmodified. Any new `dist/` entry in an output archive is a failure. This is an isolation packaging policy, **NOT evidence of browser consumer compatibility**.
4. Verify source license file(s) remain byte-identical, archive member paths are safe, no symlink, secret-like filename or private key block is included. For B2, remove the known original `prepublish` lifecycle hook from disposable metadata and fail on any unexpected lifecycle hook; original source files and application manifest remain untouched.
5. Print machine-readable artifact + file hash + source lineage + scoped CycloneDX evidence directly to the exact SHA CI log. Because this is a **public GitHub repository**, do not upload the private experimental tarballs as downloadable workflow artifacts. They are deleted on runner exit. Retained release artifacts require a separately approved private storage destination.
6. Add an **independent** B3 job to the existing Supply Chain Security workflow. Do not modify or bypass the canonical vulnerability audit, whose FAIL continues to block promotion.

## Exact source tests previously observed (historical)

| Item | Evidence | Scope |
| --- | --- | --- |
| braces upstream tests | 904 passing, run #38356625466 | isolated patched original source |
| node-forge upstream Node tests | 829 passing, 4 pending, 0 failures, run #38356973781 | isolated patched original source |
| B1 exact HEAD | `4f086760`, run #38357086324 | Main Health/PIE/CodeQL PASS; canonical audit FAIL |
| B2 exact HEAD | `bcd9d4f`, run #38356973781 | Main Health/PIE/CodeQL PASS; canonical audit FAIL |

## Gate status and constraints

| Gate | Status at creation |
| --- | --- |
| B0 complete consumer / owner / redistributable license review | PARTIAL / HOLD |
| B1 B2 patch source and original tarball integrity | PASS (historical exact HEAD) |
| B2 unpatched browser bundles quarantined in candidate | PASS_TEMP_ARTIFACT — 0 dist entries; browser compatibility HOLD |
| B3 two tarballs, double pack, per-file and archive hashes, scoped SBOM | PASS_TWO_CLEAN_RUNNERS — exact `b02ec8f`, run #38496534583, two independent npm-ci installations |
| B3 legal/security maintainer approval and durable private store | HOLD |
| B4 candidate installed across root/nested consumers, raw full/prod HIGH 0 | NOT_RUN |
| B5 Android APK, device and Expo consumer regression | NOT_RUN |
| B6 no-exception audit v2 / security review | HOLD |
| B7 explicit merge/production maintenance approval | HOLD |

**Important distribution limitation:** This temporary candidate retains the original package names and versions to avoid scanner-name masking. It is not an approved fix for `npm audit`. B4 cannot pass merely by installing renamed versions; it must independently establish source patch, complete consumers, raw audit and security approval. If the scanner still reports the advisories for the patched local package, preserve FAIL and HOLD.

## Evidence to append after exact SHA run

- Candidate SHA and job URL; `SCA_B3_TEMP_PACKAGE_EVIDENCE` hash ledger and actual exit code.
- License/NOTICE names and SHA; original six browser dist file names.
- Browser consumer inventory and compatibility coverage.
- Retained artifact location only once an approved private destination exists.
- Security reviewer and maintenance owner identity/decision (currently UNKNOWN).


## Exact first B3 run — 2026-10-14

- Tested HEAD: `fa74135858214635243bc96160e9e96cb45a936e`; [Supply Chain run #38495602311](https://github.com/gycha0109-beep/K_beauty/actions/runs/38495602311), job `B3 isolated private tarball provenance` **SUCCESS**.
- Original official tarball lock SHA512, B1/B2 isolated behavior, double `npm pack`, extracted per-file SHA256, tarball SHA256/SHA512, license, script and forbidden path checks **PASS**. Artifacts automatically deleted from temporary runner storage; no package uploaded, published or applied to dependency graph.
- `braces@3.0.3`: 10 packaged files, 14,421 bytes; SHA256 `d4f1219db19bfeb4e1c3f0354f9269569393f1b8c9f8c0295b80346926d4fa70`; SHA512 `sha512-VJc9xsVPUMkE4+y8i4KhDtDZx5ypP8nDElPwDH+jhFpCJpkSrFGL78JUMyQfcn5KFoTEK38DluBkFJKvXkZmGw==`; `LICENSE` preserved, 0 hooks removed.
- `node-forge@1.4.0`: 53 packaged files, 271,579 bytes; SHA256 `ed30cf67cfa87f097c9f6b9ceadd4187fa3efb9399fd166380fc5ea36f8915e5`; SHA512 `sha512-76xW81/A7o+I1/OLw7ZFhOKABqRgD9UbgUAibJM4Tm1GUh1Lzi4oqZDMKXx2bOrQZ9F+XO0TSzweqBAF5H6BKg==`; `LICENSE` preserved, known `prepublish` hook removed from isolated package metadata; 6 original `dist` entries excluded, **0 output dist entries**.
- The B3 run did **not** prove actual Expo browser bundle consumption, root/nested replacement, Android compatibility or legal/security approval. Retaining original names/versions is intentionally not a scanner bypass or audit remediation.
- At the same first HEAD, mandatory canonical audit **FAIL** (unresolved advisories) and Main Health **FAIL** because `main` advanced after branch creation: PR base `e05da389` was not yet an ancestor. This is a branch ancestry failure, not a B3 source test failure. Later merge-parent update `f7ed1dbc` includes `main@68225ad2` without overwriting independent TRUST changes. Its CI must be evaluated separately.

## Independent clean-runner reproducibility closeout — 2026-10-14

- Exact combined-code HEAD: `b02ec8f941c17e6b179aebe407b5c2d670e421e2` / [Actions #38496534583](https://github.com/gycha0109-beep/K_beauty/actions/runs/38496534583).
- Initial job `B3 isolated private tarball provenance`: **PASS**, exports braces/node-forge SHA256 from the actual packed tarballs.
- Separate job `B3 independent clean npm-ci runner replay`: **PASS**, runs on a **different GitHub-hosted Ubuntu 24.04 runner**, independently checks out the same HEAD, runs fresh `npm ci --ignore-scripts --no-audit --no-fund`, materializes both patched sources, and runs two packs per package, with strict equality to first runner's SHA256 outputs. This resolves the previous same-install-only reproducibility limitation.
- This verifies **two independent runner installs, four temp source builds per package total** in that run. It does not establish reproducibility across different Node/npm/toolchain versions; Node 22 was used in both jobs.
- B3 tarballs remain runner-temporary and erased; package owner/redistribution approval and durable *private* distribution still **HOLD**. Dist output zero is not browser entrypoint compatibility proof. B4 root/nested graph or Android acceptance cannot be promoted.
- Mandatory canonical audit still **FAIL** on original vulnerable package lock, intentionally. No scanner bypass. Exact-head Main Health, PIE and CodeQL are tracked separately and must not be inferred from these two jobs.

## Consumer/license and actual tarball regression — 2026-10-14

- [B3 source/pack validation job](https://github.com/gycha0109-beep/K_beauty/actions/runs/38498280175): isolated actual unpacked **node-forge tarball** `lib/rsa.js` Git blob pinned to `43090545115be1b1ffc484a2a27ecf31f840437e`. Valid RSA, wrong message and malformed nested ASN.1 RSA, Expo `@expo/code-signing-certificates@0.0.6` integration **PASS**. This extends the earlier B2 source-only probe to real packed bytes.
- `report-sca-b3-forge-consumer-boundary.mjs` scans current lock and 1,105 scoped source files. Direct declarative consumers are `@expo/cli@57.0.23` and `@expo/code-signing-certificates@0.0.6`. Literal `node-forge/dist` references detected: **0 in scanned scope**; dynamic references/external/CDN consumers remain **UNKNOWN**.
- Official original LICENSE source hashes: braces MIT `35bdd8a44339719441900fb50fbefc5e2dca1ca662cbaed7a687de842c8b70f2`; forge dual `(BSD-3-Clause OR GPL-2.0)` `f63ff0e4e239244aa79280da2dd4811a0469e5e201caf5cbc0d97c3a1dff8e82`. Source LICENSE preserved in both packed tarballs. This is provenance, **not a final legal clearance** or selected license policy approval.
- CycloneDX scope-only SBOM SHA-512 serialization corrected to **hex** (distinct from npm's base64 `sha512-` integrity). B3 temporary packet keeps original names/versions, avoids misleading scanner bypass, and is deleted on completion.

## Upstream-pinned node-forge browser bundle investigation — 2026-10-14

- Isolated script: `scripts/security/run-sca-b3-forge-browser-dist-rebuild-probe.mjs`. Fetches exact upstream review commit `ceba34402e329f0365134f23fe19898756527d65`, copies its webpack configuration, regenerates in disposable temp using webpack `4.44.1` / webpack-cli `3.3.12` and only the independently pinned patched `lib/rsa.js`. No output is published or injected into B3 npm package.
- [Actions #38499853956](https://github.com/gycha0109-beep/K_beauty/actions/runs/38499853956): browser-build diagnostic job **PASS for its scoped technical probe**. All original 6 `*.min.js[.map]` output names generated, with SHA256 inventory. `forge.min.js` UMD in browser-like VM: valid signature accepted, wrong message rejected, malformed nested DigestAlgorithm rejected; original upstream npm browser bundle **accepts the same malformed signature** (negative control).
- **Residual blocker:** `forge.all.min.js` includes real jQuery/form/XHR runtime dependencies; a fake jQuery does **not** establish browser compatibility. Its real-browser RSA and broader consumer behavior remain **HOLD**. `prime.worker` does not implement the same RSA verification surface. Upstream webpack 4 cheap-module maps lack original RSA source text, so maps are not treated as independent code provenance. Original pinned `lib/rsa.js` blob plus observed minified UMD behavior are separate evidence.
- The current B3 pack still deliberately excludes all 6 original stale `dist` files; a rebuilt-`dist` package has **NOT** been packaged, cross-run attested or approved. B3 **reproducible temporary package evidence PASS; redistribution/owner/legal/browser-full gate HOLD**. B4 full installation, double raw audit, Android and policy-v2 checks remain **NOT_RUN**.

## B3 full-browser-distribution *temporary* package candidate — 2026-10-14

- [Exact-head Actions #38504941021](https://github.com/gycha0109-beep/K_beauty/actions/runs/38504941021) rebuilt and independently replayed a second **complete node-forge browser-dist temporary candidate**, in addition to the earlier `dist`-excluded candidate. Primary `b3-browser-bundle-rebuild-isolation` and secondary `b3-browser-full-dist-independent-replay` both **PASS**. Each job performs original npm-ci, exact reviewed source commit + webpack build, real Chromium browser checks, and **two separate npm packs** in OS temp.
- Browser smoke runs real Chromium with integrity-pinned **jQuery 3.7.1** (`sha512-m4avr8yL8kmFN8psrbFFFmB/If14iN5o9nw/NgnnM+kybDJpRsAynV2BsfpTYrTRysYUdADVD7CkUUizgkpLfg==`), against both original and newly built `forge.all.min.js`. Original: valid RSA true, wrong message false, **malformed ASN.1 true (vulnerable negative control)**. Patched: valid RSA true, wrong message false, **malformed ASN.1 false**. Earlier `forge.min.js` VM RSA checks also PASS.
- Original `node-forge@1.4.0` archive surface is 59 files. Exactly 6 browser dist files and the pinned `lib/rsa.js` are retained in this rebuilt candidate. Only 2 RSA-bearing minified JS bundles changed vs original; browser source maps and prime worker remain byte-identical after rebuilding. Upstream lifecycle `prepublish` removed **in disposable package metadata only**; original LICENSE SHA preserved.
- **Independent same-SHA double-build tarball SHA256 on two fresh runners**: `67a51b864d9e483417ff34425a5a09012d333a5184dcc39f966731935463db50`. SHA512 integrity: `sha512-RFeII25Mu0v0m7RRnbLjsBNezNRR5xmPQxNCCxlFVhY4RKluZlh+z2W/QLD5+NDeUht3J2uh3zMiX1LDkx6+TA==`. Tested package was **not uploaded, published, retained, installed into the actual app graph, or made public**, and is deleted after execution.
- This supersedes the earlier **forge.all RSA runtime HOLD** only for the narrow real-browser RSA negative/positive test. General browser API behavior, form/XHR, CDN consumers, Android and installed-graph compatibility remain **UNKNOWN/NOT_ATTESTED**.
- Existing original `dist`-excluded B3 candidate is unchanged; this is **not** a distribution decision. Neither artifact has security-owner, maintainer, license redistribution policy, storage/location, or final release approval. B3 formal distribution gate **HOLD**. Original mandatory `npm audit` job **FAIL** (unpatched installed graph); B4+ **NOT_RUN**. No CI bypass or package identity alias allowed.

## B3.5 disposable `npm ci` consumer acceptance — 2026-10-14

- [GitHub Actions #38508164715](https://github.com/gycha0109-beep/K_beauty/actions/runs/38508164715) first isolated B3 job: offline local tarball **braces@3.0.3 physical `npm ci` install PASS**, 10 installed files byte-identical to reviewed tarball (SHA256 `d4f1219db19bfeb4e1c3f0354f9269569393f1b8c9f8c0295b80346926d4fa70`), root/fixture lockfile v3 verified. Child regression PASS: positive glob, parser depth, AST compile/expand/stringify, parent cycle, fractional bound. Dependencies `fill-range`, `to-regex-range`, `is-number` are original-root-lock pinned **local source links** solely for offline fixture resolution, not newly built independently released transitive packages. This is **not** an all-consumers closure test.
- Same B3 full-browser-rebuild job: offline local `node-forge@1.4.0` 59-file **physical `npm ci` install PASS** from fully rebuilt private source SHA256 `67a51b864d9e483417ff34425a5a09012d333a5184dcc39f966731935463db50`; exact npm lock integrity and each installed patched RSA / all six browser dist file digests verified. Actual installed module exercised via Expo `@expo/code-signing-certificates@0.0.6` isolated code-signing consumer: normal/wrong-message/malformed ASN.1, PEM roundtrip, wrong key and expired cert **PASS**. Direct Expo declared range is `node-forge@^1.3.3`.
- Both fixture lockfiles, physical installations and all tarballs live only in OS temp; root application `package.json`/`package-lock.json`/mobile manifests **unchanged**, no private artifact upload or GitHub package publication, no audit policy alteration. npm install operates `--offline --ignore-scripts`, never a real app dependency replacement.
- **B3.5 scope-only diagnostic PASS is not B4.** The root/nested app graph and Android build still run the original vulnerable dependencies; raw full and production audit HIGH0, owner/license/release approval, real app mobile/device compatibility and B6/B7 **NOT_ATTESTED/HOLD**.
