# SEC-SCA B4 — original lock/installed source preflight (2026-10-14)

**Watchtower-Track: security. Status: DRAFT / HOLD, not B4 remediation.**

## Goal and boundaries
Prepare B4's exact npm v3 lock/install inspection while B3 patched binaries remain quarantine-only and security signoff/private retention unresolved. Main `package.json`, `package-lock.json`, Expo consumers and canonical security audit remain unmodified.

- `lib/supply-chain-b4-preflight.mjs`: deterministic lock v3 graph and package target census. Detects `braces@3.0.3`, `node-forge@1.4.0`, nested copies, aliases/unknown versions, missing dependency edges and incomplete install paths; reports only bounded enum blockers. A version rename is never remediation.
- `scripts/security/verify-sca-b4-preflight.mjs`: synthetic vulnerable/nested/aliased/fake version/forged security approval fixtures plus current exact main lock; NEVER returns security approval.
- `scripts/security/report-sca-b4-preflight.mjs`: after existing `npm ci --ignore-scripts --no-audit --no-fund`, read only installed exact package paths and `lib/parse.js` / `lib/rsa.js` SHA256 fingerprints. Do not store package source, credentials, product or customer data. Digest alone does not prove patched provenance.
- Existing `.github/workflows/supply-chain-security.yml` receives two read-only diagnostic commands immediately before the *unchanged* `node scripts/verify-supply-chain-audit.mjs`. The original failed audit is neither skipped nor changed. No new workflow or dependency.

## Expected current lock result
Until B3 private release and B4 npm resolver replacement complete, **original vulnerable packages remain present** (one reachable `braces@3.0.3` and one reachable `node-forge@1.4.0` in the previous exact-main trace). Exact updated counts require the actual CI log. The 2026-10-10 expiry of `braces` exception remains a hard security gate failure.

The B4 scanner always returns:
- `B4_PREFLIGHT_HOLD` / `securityGatePassed=false`
- `patchedCodeAttested=false`
- `rawAuditHighZeroAttested=false`
- `privateDistributionApproved=false`
- `rootLockMutation=false`.

Tested fake versions or injected caller attestation cannot turn these into approval. The scanner is a preflight baseline, **not** a v2 independent post-remediation B4 final acceptance verifier. It must be extended/reviewed only after actual security-approved patched artifact availability.

## Actual B4 gates still unresolved
1. B3 patch/provenance, security owner and legal/licensing approval, durable private distribution.
2. Separate isolated resolver-generated candidate `package-lock.json`, full root+nested replacement; independent verified patched bytes. No hand-editing version/integrity.
3. Both unmodified **raw** `npm audit --json` and `npm audit --omit=dev --json`: HIGH=0, CRITICAL=0, moderate no regression. Existing expired exception must not be extended.
4. B1/B2 malicious/valid consumer tests against *physically installed* exact candidates, Expo/Metro compatibility, reviewed source digest and SBOM.
5. B5 Android APK/device smoke; B6 reviewed no-exception CI; B7 explicit merge.

**Never merge this draft as a production security fix or claim the audit passed.** It does not modify Production, Supabase, Subject, Fact, recommendations, or AI API.


## Actual exact-branch CI — 2026-10-14

- Tested implementation SHA `2a78517b0738a3f02324e98eda6c52e6cd5537cd`; [Supply Chain run #38504775157](https://github.com/gycha0109-beep/K_beauty/actions/runs/38504775157), job `115659705865`.
- `SEC_SCA_B4_PREFLIGHT` 9 fixture cases **PASS**. Current lock v3: 5 roots, **0 unresolved dependency edges**; vulnerable current reachable copy count **braces=1, node-forge=1**.
- Actual `npm ci` installed copies of both original locked packages were read and matched both exact lock paths. SHA256 of the two actual source files (metadata only): braces `e572166565f15fa6ad9865ae49d678218e32aabfd1b3720f6d0d43d39800d310`, node-forge `fd4740238145ec26470eb3f06a627c72039538ce1307dbdce40521f94dfd0a50`. These are **unapproved original source fingerprints**, not patched-source approvals.
- `SEC_SCA_B4_BASELINE.status=B4_PREFLIGHT_HOLD`, `securityGatePassed=false`, `rawAuditHighZeroAttested=false`; original canonical audit **FAIL** on expired `braces` exception `GHSA-vfj7-8cjw-p6xm` at 2026-10-10 UTC. The same CI step proceeded to raw audit and did NOT skip it.
- This is only baseline detection. Nothing was replaced, published, committed to the root lock, deployed, or marked remediated. B3 ownership/licensing/private artifact and B4 resolver replacement are still unresolved. B5–B7 all HOLD.

No automatic merge, exemption change, or security-release permission is implied by these isolated fixture PASS results.


## Disposable npm resolver / physical install shadow — 2026-10-14

- Experimental code HEAD `304db7776b868cd79e996091bb13d55f5e9ef6c8`; [Supply Chain Actions #38508075092](https://github.com/gycha0109-beep/K_beauty/actions/runs/38508075092), diagnostic job `115670046615`.
- Both original **unpatched** npm-ci package folders (`braces@3.0.3`, `node-forge@1.4.0`) were repacked without lifecycle hooks into **OS disposable temp**. Root `package.json` / `package-lock.json` and four workspace `package.json` manifests were copied into a separate temporary project; only those *copies* received npm `overrides` with `file:` tarball specs.
- npm `install --package-lock-only` initially converted **braces** to `file:` but retained **node-forge** as a registry dependency. After an explicit npm `update node-forge --package-lock-only` **in the temporary clone**, both resolved locations became `file:` (one installed lock path each). This is an observed npm resolver behavior; **never hand-edit** the real lock or assume the initial command is sufficient.
- A separate `npm ci --ignore-scripts --no-audit --no-fund` physically installed that shadow full-workspace graph; exact SHA256 of both installed `lib/parse.js` and `lib/rsa.js` matched the known vulnerable original input bytes. Root source manifests and original lock had identical SHA256 before/after, confirmed in the script; temporary tarballs and installation were deleted on exit.
- Unmodified raw **shadow** npm audit: full HIGH **22** / CRITICAL 0 / MODERATE 13, production HIGH **19** / CRITICAL 0 / MODERATE 11. Despite `file:` paths, known-vulnerable original code was **still detected** in this particular shadow experiment. This does **not** guarantee that future renamed artifacts cannot mask advisories: actual source/installed digests remain an independent required AND gate.
- Unchanged canonical audit immediately after the shadow experiment **FAIL** on original expired `braces` advisory at `2026-10-10T00:00:00Z`. Security approval remains `false`; B3 private package delivery, owner and legal approval, approved patched bytes, B4 audited remediation, B5 APK, B6 security review and B7 main merge are all **HOLD**.

**Technical outcome:** B4 npm resolver and isolated physical install *method* is feasible without mutating the actual repository. **Security outcome:** `HOLD`; this run intentionally used the original vulnerable bytes to validate npm resolver semantics. It never installed the proposed B3 patched tarballs, so it cannot support a remediation, security PASS, production deployment or HTML5 parser dependency approval.
