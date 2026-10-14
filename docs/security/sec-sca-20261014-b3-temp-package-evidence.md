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
| B2 unpatched browser bundles quarantined in candidate | CODE_IMPLEMENTED / CI NOT_RUN |
| B3 two tarballs, double pack, per-file and archive hashes, scoped SBOM | CODE_IMPLEMENTED / CI NOT_RUN |
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

