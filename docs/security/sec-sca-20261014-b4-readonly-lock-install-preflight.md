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
