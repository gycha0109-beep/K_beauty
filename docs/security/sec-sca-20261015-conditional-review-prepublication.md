# Conditional owner review and offline prepublication checks

The owner explicitly authorized conditional review, final checks and preparation of approval records on 2026-10-15. The owner also expressly said this is neither legal conformity confirmation nor actual redistribution permission. The exact instruction and SHA-bound evidence are recorded in `security/release/sca-b6-conditional-review-decision.json`. It is a human instruction transcript, not an Ed25519-signed release authorization.

The existing sole-owner policy decision and frozen license packet are unchanged. Final redistribution, package upload, costs, audit exceptions, merge, production and clearance of unknown rights remain false. No signing key, trust approval or execution authority is synthesized. Existing release admission still requires separate real approvals, pinned trust and all four role signatures.

## Checks implemented

`node scripts/security/sca-release-review-preflight.mjs` verifies the limited instruction, exact original-recovery/public-findings digests, frozen license packet and internal policy. It rejects changed evidence, unauthorized permissions, a closed OAEP finding, a new author-inquiry/reply requirement, or a claim that the chat record is cryptographically signed. Its successful output means `VALID_LIMITED_REVIEW_ONLY`; it always reports `executionReady:false`, `legalApproval:false` and `originalAudit:FAIL_NOT_WAIVED`.

With actual verified retained archives available in isolated scratch:

```sh
node scripts/security/prepare-sca-release-scoped-publication.mjs --original-bundle /private/scratch/release-candidate --candidate /private/scratch/scoped-candidate
```

This offline command reconstructs the existing original/scoped byte checks and emits exact package identities/SHA mappings, GitHub private-metadata targets and required readback prefixes. It accepts no token or upload option and makes no network calls. Both current-head CI producer and independent replay emit this same plan from actual verified tarballs. It does not call the legacy publisher. The legacy `publish-approved-sca-candidate.mjs` is for original unscoped identities and must not be directed to GitHub npm.

The separate dormant `publish-approved-sca-scoped-candidate.mjs` now implements the GitHub scoped operator. It requires exact original/scoped verification, independently pinned trust and actual final signed v2 upload/redistribution approval even for its dry-run. Signed `operationalChecks` must attest quota/stop-usage/no-charge controls, private ACL, notice-delivery review and provisioned credentials with an evidence digest. The current example leaves all false. The current conditional instruction cannot admit this operator. No workflow invokes it; CI imports only the orchestration with synthetic callbacks.

Actual execution additionally requires an explicit `--execute-approved-upload`, isolated Linux, publish/read credentials and a different valid authenticated unprivileged account. It checks both identities absent before upload, revalidates trust/signatures/bytes before each publish, forbids redirects, bounds responses, verifies private metadata/repository and exact original-to-scoped readback bytes, then requires anonymous and valid-unprivileged denial. Credentials are path-scoped in disposable npmrc/cache and deleted on exit; output excludes credentials and child private logs. Failure stops without overwriting, unpublishing, product changes or automatic retry. Offline tests cover missing operational authority, mutation ordering, changed candidate, existing version and partial readback failure. Live GitHub publication/readback and final notice delivery remain NOT_RUN; implementation is not proof of live behavior or fulfilled rights.

## Rights findings kept open

| Item | Evidence and current limit |
| --- | --- |
| braces | MIT review basis; original LICENSE and source notices preserved. Conditional review is not final distribution authorization. |
| Forge | BSD-3-Clause review basis; original dual-license file remains intact. This does not relicense third-party works. |
| OAEP | Authentic WebRSA1.0 release matches the published SHA on four HTTPS mirrors. Original source/README say BSD; nine files contain no separate full license and the historic category link is404. Exact variant/full conditions remain OPEN. These facts are not proof of infringement or legal clearance. |
| DES/SJCL/OpenSSL AES/TweetNaCl/jsjws | Previously recovered primary component grants and complete known notices remain preserved. Exact historical revision gaps are disclosed separately from external conditions. No new evidence resolves the OAEP variant. |
| Notice delivery | Local six-browser-file kit, full notice packet and SBOM integrity verified on independent runners. Actual registry artifact/recipient/readback notice delivery is NOT_RUN; adjacent local files are not evidence of recipient delivery. |

Additional public searches of the historic SourceForge category and jsjws lineage yielded no new authoritative full OAEP terms. No external inquiry was sent or required. The original package/source/browser/notice bytes and existing candidate digests remain unchanged by this approval record.

## Next actual execution boundary

Before any publication: obtain a distinct owner final redistribution decision addressing the open OAEP assessment; verify the account's private ACL, quota/billing/stop-usage controls and credential interfaces without incurring charges; review the dormant scoped operator with actual signed evidence and final notice delivery; then request separate upload approval binding the exact two identities, versions, final SHA, private target and rollback handling. Do not request secrets in chat. A conditional review record cannot satisfy any of these approvals.

After separately authorized publication: authenticate metadata/private visibility, validate downloaded exact bytes and original-source/license correspondence, require anonymous and unprivileged denial, and validate the actual approved-registry whole app graph on independent runners. Original full/production raw audits and required security acceptance remain separate and may still fail. Do not treat scoped advisory silence as remediation.

Conditional-review implementation HEAD3f92a11eb32c294226c4a0d4bc3c379c3857807d, CI38695726629:55 tests, producer, independent replay and CodeQL PASS. Both runners emitted limited-review/blocked-execution receipts and the exact unchanged candidate/notice-kit hashes. Scoped operator follow-up local tests59 PASS; new exact-head CI pending. Unchanged runtime proof is reused under the existing fail-closed scope resolver. No extra PIE/Main Health/crawler or document-only Android loop is added. No DB/Auth/RLS/Storage/Payment/Production execution or credential access occurs.
