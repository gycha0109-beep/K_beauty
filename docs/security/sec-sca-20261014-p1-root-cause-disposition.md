# SEC-SCA P1 — Advisory Root Cause and Reachability Ledger (2026-10-14)

Watchtower-Track: security

**Purpose:** distinguish concrete advisory leaves from npm audit's propagated `vulnerabilities` node counts without claiming a cleared security gate. This record concerns the dependency graph and official public advisories, **not** exploit reachability in a deployed environment.

## Grounded baseline

Source: unmodified full/production `npm audit --json --registry=https://registry.npmjs.org/` on P0 exact HEAD `e3b86b337654034ff9097f670bf401d9f70afe5b`, [CI #38525576549](https://github.com/gycha0109-beep/K_beauty/actions/runs/38525576549), persistent [SCA issue #1208](https://github.com/gycha0109-beep/K_beauty/issues/1208). **Raw npm audit exits 1** in both scopes; mandatory `node scripts/verify-supply-chain-audit.mjs` fails on the expired GHSA-vfj7-8cjw-p6xm exception (2026-10-10). This is an unresolved release blocker, not a false alert.

| Scope | npm vulnerable package nodes | HIGH nodes | MODERATE nodes | CRITICAL | Concrete distinct HIGH advisory roots |
| --- | ---: | ---: | ---: | ---: | ---: |
| Full | 35 | 22 | 13 | 0 | 2 |
| `--omit=dev` | 30 | 19 | 11 | 0 | 2 |

The full audit's **braces** advisory reaches 20 named package nodes; **node-forge** reaches 4. The production audit's braces advisory reaches 17; forge reaches 4. Their sets overlap (e.g., `expo` and `@expo/cli`), so **20+4 ≠ 22 separate vulnerabilities**. Counts are properties of npm audit's transitive advisories, not the number of independent exploitable code flaws, installed package copies, or risk acceptance.

## Reviewed upstream advisory roots (as-of 2026-10-14)

| Root | Source/affected versions | Public fixed version | Project position / authorization |
| --- | --- | --- | --- |
| `GHSA-vfj7-8cjw-p6xm` | [GitHub reviewed advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) — `braces <=3.0.3` | **None** in GitHub advisory | B1 patched bytes + behavior/source/consumer checks proven only as private temporary candidate; lasting maintenance, redistribution and security acceptance HOLD |
| `GHSA-86w9-cpqp-85rv` | [GitHub reviewed advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv) — `node-forge <=1.4.0` | **None** in GitHub advisory | B2 RSA/ASN.1 patch + verified browser distribution and full graph proven only as temporary candidate; durable approval HOLD |

Upstream `braces` maintainers have disputed the report's exploitability in public discussion. That is a **contested upstream position**, not removal of the current GitHub-reviewed GHSA; do not replace official audit evidence with either view. Security reviewers must evaluate app exposure and public advisory status separately.

The public `node-forge` advisory also references [upstream PR #1152](https://github.com/digitalbazaar/forge/pull/1152); a source-level PR is **not** a released npm package. Neither GitHub advisory presently advertises a fixed version. Package-version, fork, alias or registry name renaming cannot be used to manufacture audit PASS.

The remaining MODERATE roots are handled separately: `decode-uri-component`, `next` (two advisories on original Next), `postcss-selector-parser`, `uuid`. The [official Next 15.5.27 remediation Draft #1294](https://github.com/gycha0109-beep/K_beauty/pull/1294) reduces MODERATE by one affected-package count per scope after the two Next leaves; HIGH counts remain 22/full and 19/production. No merge implied.

## P1 implemented read-only analysis

- `scripts/security/sca-audit-root-causes.mjs` derives a concrete GHSA root set for each `npm audit` vulnerability node via monotonic fixed-point closure. It handles cyclic `via` edges without recursive memoization undercounting (Metro / React Native).
- Pinned as-of-2026-10-14 official advisory snapshot for the two HIGH roots. Unexpected HIGH GHSA or changed affected range yields **`REVIEW_NEW_HIGH_SOURCE`**, never silently inherits historical signoff.
- `scripts/security/sca-audit-root-causes.test.mjs` checks overlapping reachability, cycles, wrong upstream root, missing graph, service errors, changed GHSA/range, severity mismatch and non-HIGH separation.
- Existing B6 original-security-gate still runs the unchanged mandatory audit. `run-sca-readiness-evidence.mjs` attaches P1 `p1RootCauseAnalysis` to diagnostic `readiness.json` and asserts node counts equal official raw audit metadata; mismatches cause diagnostic failure.
- This is **not** proof of exploit reachability, vulnerability remediation, a patched product lock, approved private npm distribution or main/production release. The required audit continues to fail closed.

## Next dependency-ordered execution

1. **P1 technical complete after exact-HEAD verification:** tests, CodeQL, full+production raw audit root attribution and seven-day diagnostic artifact. If graph drift occurs, new-source review HOLD.
2. **P2 external:** security, license-redistribution, maintenance and distribution owners; immutable non-public repository, pinned Ed25519 approvals, verified readback and token scope. No real secrets or private upload without those decisions.
3. **P3 only after P2:** disposable candidate product lock + exact installed bytes through all consumers; official audit outcome must be respected. Do not substitute a changed registry audit endpoint for npmjs.
4. **P4 only after P3 and required gate authorization:** existing Android build pipeline APK, isolated API/Auth and actual device. Avoid unpatched/alternate test APK.
5. **P5:** monitor official upstream release, advisory revisions, key rotation, publisher maintenance and security-preserving rollback.

**Explicit stop:** P2 signed authority, approved private registry, security audit acceptance and isolated device/backend evidence remain absent. PRs #1288/#1299 and this P1 change remain Draft/HOLD; package-lock, app runtime, DB and production must not change.
