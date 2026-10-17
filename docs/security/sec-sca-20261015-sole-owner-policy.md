# B6 sole project owner approval policy v2

> Public-source update: sec-sca-20261015-public-license-research.md supersedes earlier unknown-DES and reply-dependent investigation notes. DES BSD2 and historical AES/SJCL/TweetNaCl permission evidence are recovered; exact lineage gaps are disclosed internal assurance issues, while actual unmet external conditions remain separate. No upstream communication is authorized or awaited.

The project owner explicitly authorized the internal policy change: one human owner assumes security, license-redistribution, maintenance and distribution responsibility. The decision is recorded in `security/release/sca-b6-owner-policy-decision.json`. This replaces the assumption that B6 needed a second human as an external license obligation; the original two-person rule was self-designed in e6caa3fd63bcbe7107f22fd933ef0ce9702bdc76. No examined upstream license or GitHub Packages public terms requires that second person; unprovided special contracts or jurisdiction-specific duties are not assessed.

## Implemented boundary

Both original-name and scoped admission support explicit v2 approval schemas with `bejewely.sca-release-trust.v2`. v1 remains a two-person legacy mode and cannot consume v2 trust or signatures. The scoped path remains the GitHub-compatible path; unscoped original-name packages are still rejected for GitHub npm publication.

The v2 trust file names one responsible owner and pins the exact SHA256 of the user's policy decision record. Approval repeats that identity and policy hash, binds the complete license packet hash and candidate SHA, and contains four role-specific signatures. One owner and one Ed25519 key may sign all four roles if that externally trusted key is authorized for each. Owner comparison trims whitespace and folds case consistently. No additional human is required by this internal mode; independent clean-runner CI remains required.

Signing bytes are `UTF8("BEJEWELY-SCA-OWNER-v2:" + purpose + ":" + role + "\n") || exact approval.json bytes`. The new domain binds purpose and role. Both v1 domains and cross-version trust are rejected. Unknown/repeated/missing roles, untrusted/revoked keys, invalid key type/signature, expired keys, approvals lasting over seven days, wrong owner, changed candidate/license/policy digest or unsafe readback targets fail closed. The existing CLI still requires externally pinned `SCA_TRUST_POLICY_SHA256`; filling a template is not trust provisioning.

The internal policy record explicitly grants **no** actual redistribution, upload, cost, exception, merge or production approval. Consequently v2 additionally requires a separate signed upload decision and final redistribution decision hash, plus a rights-review evidence hash and an empty unresolved-rights list before admission. These are accountable human attestations bound to exact signed bytes, not automated proof that third-party rights exist. The operator and project owner must review the actual evidence represented by those hashes; invented hashes/checkboxes are not legal clearance. Current real examples keep all relevant grants false and rights HOLD; no such live approvals or trusted signing keys were generated.

## Requirements retained

Original licenses and all 49 notice-bearing sources, complete NOTICE/SBOM, original/scoped source-to-archive provenance, 69 installed file hashes, all six browser distribution hashes, patch/RSA/Expo regressions, independent CI, immutable publication rules, authenticated readback, private metadata and anonymous/unprivileged-reader denial remain unchanged. Original npm audit stays mandatory and FAIL while HIGH22/prodHIGH19/C0 remain. Owner approval is not a security exception and cannot change required checks, branch protection or protected production authorization.

The supplemental license packet changes only its internal human-approval responsibility wording; original licenses, source notices and embedded-code SBOM remain unchanged. The approved policy record is separate from historical source and package manifests; it does not rewrite either. Candidate archive bytes and the prior licensing candidate digest `503087431929a5041515d5f61002e32d8294475d90c7285d46eec3f14c699254` are historical evidence. The new packet wording changes the candidate manifest digest; archive bytes must remain unchanged, subject to exact-HEAD producer/replay confirmation.

## Operator preparation, without publication

1. Review the actual owner policy record and proposed external trust file; assign the explicit human owner ID and role-authorized public key outside git. No private key/token belongs in chat, repo, runner or logs.
2. Obtain the exact policy and license packet hashes from the checked-out implementation:

```sh
node --input-type=module -e 'import {ownerPolicyDecisionSha256,licensePacketSha256} from "./scripts/security/sca-release-owner-policy.mjs"; console.log({ownerPolicyDecisionSha256,licensePacketSha256});'
node --test scripts/security/sca-release-bundle.test.mjs scripts/security/sca-release-license-review.test.mjs scripts/security/sca-release-owner-policy.test.mjs
```

3. `sca-b6-owner-trust.example.json` and `sca-b6-scoped-owner-approval.example.json` are deliberately non-admissible templates. They contain neither organizational trust nor final rights/upload authorization. Pin a reviewed real trust file through protected configuration only after the corresponding owner decision; do not merely flip example booleans.
4. After rights evidence exists, request the owner's final redistribution decision. After registry/billing/ACL/credential evidence exists, separately request exact-package/version/SHA/target upload approval. The current scoped verifier is offline admission; no new scoped uploader is introduced by this policy change.
5. Use the existing offline scoped verifier with `--original-bundle`, `--candidate`, and the complete `--approval --signatures --trust` set. It checks source bytes and pinned trust before accepting actual signatures. Admission cannot merge/deploy or suppress the audit result.

## Open rights investigation

- AES/DES history was followed through the lib directory move (d89547c89fc3b67683460e97ee456f74e19f6e07) to the older js paths. [AES first check-in 521fd6018d350a54c5f3b5ab5258a145bcc613e0](https://raw.githubusercontent.com/digitalbazaar/forge/521fd6018d350a54c5f3b5ab5258a145bcc613e0/js/aes.js) is dated 2010-07-12 and already states jscrypto public-domain and OpenSSL derivation without the original OpenSSL version/file. [DES introduction 0998bd93337d227be7b30db4b426f05d2e33f5e1](https://raw.githubusercontent.com/digitalbazaar/forge/0998bd93337d227be7b30db4b426f05d2e33f5e1/js/des.js) is dated 2012-03-29 and already contains the Paul Tero/Michael Hayworth attribution and disclaimer without full BSD conditions. This locates the ambiguity historically; it does not clear the missing terms.
- Ed25519 entry is 470793c0ac7217e512ba3775cd75d106e7fb2b64 (2018-03-05, Add ED25519 support). The current upstream TweetNaCl Unlicense is supporting evidence, not proof of the exact revision copied in 2018. Inspect the introducing diff and historical source/license before a clearance decision.
- The introducing Ed25519 diff explicitly credits TweetNaCl; [TweetNaCl v0.14.5 LICENSE](https://raw.githubusercontent.com/dchest/tweetnacl-js/v0.14.5/LICENSE) also contains the Unlicense permission/public-domain dedication. This adds versioned supporting evidence, while the exact copied revision remains unproven. No source or license is relabeled to imply clearance.
- DES original URL returned 403 and the historical jsjws rsa.js URL returned 404. Failed retrieval proves neither permission nor a violation. OAEP BSD variant/full conditions and jscrypto historical public-domain origin remain unresolved.
- Historic OpenSSL/SSLeay conditions can include attribution/advertising/redistribution acknowledgments. Do not assume modern OpenSSL Apache licensing applies to unidentified older derived code.
- Browser standalone notice delivery and full final shipped-content inventory still need proof. No ownership policy may waive any actually applicable third-party conditions.

## Verification and real status

Local tests: 39 PASS (29 existing plus 10 new v2 cryptographic/boundary tests). Positive tests use explicitly labeled ephemeral synthetic approvals, never real human approval or rights clearance. Negatives cover missing real grants, rights HOLD, changed digests, owner/schema/domain substitution, absent/repeated roles, revoked/expired keys, audit exceptions, unsafe targets, purpose/merge/production expansion and exact-byte tampering. Exact-HEAD clean CI is pending until its actual run finishes; prior source runtime proof remains linked to its tested SHA.

No package upload, fee, credential provisioning, risk exception, main merge or production action was performed.
