# B6 release preparation and B7 merge rehearsal — 2026-10-14

Watchtower-Track: security

This is executable release preparation, not release/security/legal approval. Original audit policy and product lock remain unchanged. No upload, production change, security exception or main merge is authorized. The new readiness PR is stacked on #1288; #1294 remains an independent official Next patch.

## Decision and current evidence

Latest queried main: `1a82cf9961f4fbba30d1d59f1ec2de1a3c6dd7e2`. #1288 source: `c8153c359c545141c9176254feb638f3844ba5f1`, [completed B3/B4/B5 CI](https://github.com/gycha0109-beep/K_beauty/actions/runs/38514455251). Full/prod raw audit HIGH22/19, CRITICAL0, MODERATE13/11, exit1. Installed patch bytes, two lifecycle install modes, all consumers, eleven compatibility checks, Android debug APK and independent browser tarballs PASS. Device/API/authenticated smoke NOT_RUN.

The complete immutable receipt is `security/release/sca-b6-validated-source.json`. It is reused only after a git diff proves product code, all workspaces, manifest/lock, pinned patch sources and prior behavior verifiers unchanged. New preparation code receives its own CodeQL, negative admission tests and two clean-runner candidate builds. B4/B5 are not run from scratch merely to test packaging/approval tools. This does not claim B4/B5 validated a future private registry or product lock.

Registry refresh on 2026-10-14:

| Package/path | Latest official | Consequence |
| --- | --- | --- |
| braces | 3.0.3 | [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) still <=3.0.3, no fixed version |
| node-forge | 1.4.0 | [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv) still <=1.4.0, no fixed version |
| @expo/cli | 57.0.29 | Still requires forge ^1.3.3 and code-signing-certificates ^0.0.6 |
| @expo/code-signing-certificates | 0.0.7 | Still requires forge ^1.4.0 |
| micromatch | 4.0.8 | Still requires braces ^3.0.3 |
| chokidar | 5.0.0 | Removes braces, but current Tailwind3.4.19 requires chokidar3.6.0; overriding across two majors changes watcher compatibility and leaves other braces paths |
| @expo/metro-file-map | 57.0.4 | Removes its direct micromatch dependency; ordinary metro-file-map paths and Tailwind/fast-glob still retain micromatch |
| metro-file-map | 0.87.1 | Still requires micromatch ^4.0.4; RN/Expo's pinned Metro graph cannot be assumed compatible with an arbitrary newer minor |
| tailwindcss | 4.3.3 (v3-lts3.4.19) | Major CSS/toolchain migration would still leave Metro micromatch; does not solve all paths |

Primary registry evidence is the published metadata at `https://registry.npmjs.org/<package>`. These dependencies support declared Expo build/export/code signing and Tailwind/Metro consumption. Removing them from the lock alone breaks their consumers; no unused top-level declaration of either target exists. Forge code signing cannot be replaced by pruning a transitive dependency without a maintained Expo consumer change. A consumer fork replacing cryptography/glob semantics needs new upstream maintenance and broader compatibility work, so it does not provide a shorter verified route today.

Route A remains preferred whenever an official fix or compatible complete removal appears. Today Route B can distribute the **already verified actual code fix**, with original identities and durable provenance. It cannot make raw npm audit pass: **registry/redistribution approval alone does not resolve the advisory or remove HIGH22/19**. Upstream corrected release/advisory coverage or an explicitly governed separate exception decision remains necessary for release acceptance. This implementation neither requests nor applies an exception.

#1294 official Next15.5.27 removes two moderate advisory leaves (full/prod moderate12/10) without affecting HIGH22/19. Main Health/Admin/Boundary/Face/PIE/CodeQL/build/public smoke PASS at `87ab4579de574303f36a81a6a76d0e88033ac697`. A merge-tree rehearsal found a work-log-only conflict with #1288; the complete Next entry was moved above older records with original EOF preserved. No package or verifier code changed in that repair; its final exact HEAD CI is checked separately. Supply-chain workflow changes merge together with the original mandatory audit intact.

## Implemented release structure

`prepare-sca-release-candidate.mjs` takes both tarballs and a NEW isolated output folder. It creates eight files: original braces/forge tgz, validated-source.json, upstream-provenance.json, browser-build-provenance.json, sbom.json, NOTICE.md and release-candidate.json. Tarballs remain unchanged. No new package name or version is created. The manifest binds every resource's hash/size; organizational signatures bind the exact manifest digest. Frozen browser provenance includes upstream commit ceba34402e329f0365134f23fe19898756527d65, webpack4.44.1/webpack-cli3.3.12, actual Node22.23.3, six distribution hashes, Chromium RSA and npm/Expo signing proof; B4 reference records npm10.9.9. This historical builder is isolated and does not change app build tools.

`sca-release-bundle.mjs` verifies archive SHA256/SHA512, all 69 file hashes, original LICENSE bytes, patched RSA/parser and six browser distribution files, metadata identity/version, removed lifecycle scripts, pinned vendor provenance, NOTICE and two-component CycloneDX SBOM. This release-package SBOM is distinct from B4's 683-component installed-app SBOM. Both versions/license text and source/installed/tarball hashes are retained. The original packages have no expected separate NOTICE entry; additional release NOTICE is external to immutable tarballs, and existing LICENSE/README entries are preserved byte-for-byte. Tar inspection avoids disk extraction and rejects links, traversal, duplicate entries, devices, invalid checksums, extended headers, and bounded-size violations.

`verify-sca-release-candidate.mjs` distinguishes code/provenance PASS from raw audit FAIL and organizational approval PENDING. It never turns audit failures into success or reads the repository's expired exception as a release approval.

Four signature roles are required: security, license-redistribution, maintenance, distribution. At least two named owners must sign. Approval uses role-prefixed exact-document Ed25519 signatures; changed digest, registry, readback URLs, scope or expiry invalidate signatures. Revoked keys, missing roles, unauthorized roles, invalid keys, unsigned templates and approvals lasting over seven days fail closed. Organization-selected trust keys are external; real upload/staging additionally requires their fingerprint in `SCA_TRUST_POLICY_SHA256` from protected organizational configuration. Test-generated ephemeral keys exist only inside tests and are never organizational approval.

The license reviewer must explicitly record the forge dual-license election in the signed approval; the template leaves it undecided. Authenticated readback is followed by a credential-free read that must return 401/403/404 for that same verified archive URL. Public readback or unexpected server response blocks product promotion; organization-wide ACL configuration still requires a real operator review.

Private product staging pins full/prod audit and the unchanged canonical verifier to the original npmjs advisory service. A private registry's missing or empty advisory endpoint cannot substitute for the official audit. Network/service errors remain failures.

`publish-approved-sca-candidate.mjs` defaults to signed dry-run. Actual upload additionally requires `--execute-approved-upload`. It forbids public npm/placeholder registries, preflights BOTH names/versions for E404, refuses overwriting existing versions, writes path-scoped credentials to a mode0600 disposable npmrc, uses a disposable cache, ignores lifecycle scripts, and checks downloaded archive bytes from each approved URL after upload. Redirects cannot forward credentials. It deletes credentials/cache on exit and never unpublishes or switches the app automatically. The upload routine is implemented but **NOT_RUN** without real organizational approvals and registry access.

`stage-approved-sca-product-graph.mjs` implements the subsequent private readback/full-graph rehearsal. It requires the same verified approvals and a read-scoped credential, a committed source checkout and a NEW output outside that checkout. It validates remote bytes before resolver updates; creates a candidate lock through npm; rejects unrelated dependency drift; installs both lifecycle modes; inventories root/workspace/nested/aliased target paths and real consumer resolution; verifies exact bytes; runs behavior tests, Next build/public smoke, mobile/static/Metro/export/prebuild/native and Android debug if SDK exists. It preserves raw full/prod JSON and runs the unchanged official verifier. A failing audit yields failing process status. Auth/cache files are deleted before app build or on exit. The source checkout is never changed. This network-dependent workflow is **NOT_RUN** until a registry is approved; prior B4 proves file-based installation only.

## Minimal decisions requiring real authority

| Decision | Choices and required permissions | Approval boundary |
| --- | --- | --- |
| Private immutable distribution | Existing dedicated Nexus/Artifactory-compatible npm repository; organization-owned Verdaccio with private ACL and immutable versions; another reviewed compatible private npm endpoint | Select durable registry/repository and readback URLs; no upstream mirror shadowing. Same name/version cannot overwrite a mirrored official archive. Organization must enforce private ACL, backup and immutable storage |
| Package format | Keep verified unscoped original names/versions in isolated private repository | GitHub npm Packages requires scoped identities and is not selected here; renaming to avoid audit is forbidden |
| Distribution legal review | Review braces MIT; forge BSD-3-Clause OR GPL-2.0 choice, modifications, notices and redistribution obligations | Authorized legal/license reviewer signs exact candidate; no automated legal conclusion |
| Responsible owners | Named patch maintainer and security reviewer, plus distribution operator | Own upstream tracking, incident response, key rotation, revalidation and rollback |
| Credential access | Time-limited publish/read token only for dedicated repository; independent CI receives separate read-only token | Provision outside git/logs. Store trusted policy/fingerprint in protected configuration; no token or signing private key is committed |
| Actual upload | Signed exact manifest digest + registry + two archive URLs, all four roles | Operator explicitly executes guarded upload. This approval does not authorize product/prod/main changes |
| Product candidate/acceptance | Private clean-runner staging and a reviewable real lock diff after upload/readback | Raw audit stays FAIL while advisory ranges remain; no unapproved exception/extension |
| Production/main | Separate product smoke, release decision and merge/deployment authority | Not covered by this bundle's upload approval |

## Operator commands after approval

Run from the reviewed B6 checkout in an isolated Linux environment. Keep private files outside the checkout; commands below contain only paths/placeholders, never secret values. The current CI deliberately deletes packages and uploads none. An operator can generate a retained candidate with the following explicit private scratch path; it creates a new folder outside the checkout and uploads nothing. CI does not set this retention option. All archives must exactly match the immutable reference; no repack/identity change is accepted.

```sh
npm ci --ignore-scripts --no-audit --no-fund
SCA_B6_VERIFY_CANDIDATE=1 SCA_B6_CANDIDATE_OUTPUT=/private/scratch/release-candidate node scripts/security/run-sca-b3-forge-browser-dist-rebuild-probe.mjs
# Alternatively, when both verified archives already exist:
node scripts/security/prepare-sca-release-candidate.mjs --braces /private/scratch/braces-3.0.3.tgz --forge /private/scratch/node-forge-1.4.0.tgz --output /private/scratch/release-candidate
node scripts/security/verify-sca-release-candidate.mjs --bundle /private/scratch/release-candidate
```

Fill `security/release/sca-b6-approval.example.json` in private scratch with the candidateSha256, selected registry/private repository claims, approved exact readback URLs, and expiry. Each designated reviewer signs `UTF8("BEJEWELY-SCA-UPLOAD-v1:" + role + "\n") || exact approval.json bytes` with their organization's Ed25519 private key. Provide signatures JSON `[ {"role":"security","keyId":"organization-key-id","signature":"base64 signature"}, ... ]`. Trust file follows the example schema but has organizationApproved=true and approved public keys: `{id, owner, roles, publicKeyPem, notBefore, notAfter}` plus revokedKeyIds. Private signing keys never enter npm/GitHub runners. A human must review trust policy provenance and pin its SHA256; filling booleans is not approval.

```sh
node scripts/security/verify-sca-release-candidate.mjs --bundle /private/scratch/release-candidate --approval /private/approvals/approval.json --signatures /private/approvals/signatures.json --trust /private/approvals/trust.json
# SCA_TRUST_POLICY_SHA256 is organization-pinned; NODE_AUTH_TOKEN is injected by the approved secret manager.
node scripts/security/publish-approved-sca-candidate.mjs --bundle /private/scratch/release-candidate --approval /private/approvals/approval.json --signatures /private/approvals/signatures.json --trust /private/approvals/trust.json
# Only after explicit upload authorization, repeat with --execute-approved-upload.
node scripts/security/stage-approved-sca-product-graph.mjs --source /private/checkouts/product-candidate --bundle /private/scratch/release-candidate --approval /private/approvals/approval.json --signatures /private/approvals/signatures.json --trust /private/approvals/trust.json --output /private/scratch/installed-candidate
```

The final command is expected to return audit failure while current advisories remain. Keep its actual candidate graph, raw audits and receipt for review, not a success claim. Only a subsequently authorized product PR should incorporate durable URLs/integrities. Run a second independently authenticated clean runner against exactly that approved product lock; compare all target bytes and require all platform checks. No personal paths/temporary URLs belong in product lockfiles.

## Maintenance, key rotation and rollback

The appointed maintainer checks original advisory/upstream patch status before each release and at least weekly while it is held, records reviewed upstream commits, compares official tarball integrity, and rebuilds/tests source and all browser distributions. No unattended scheduler is configured. Changes to patch, npm packing, toolchain, product graph or approved registry invalidate the relevant proof and require fresh exact-HEAD runs. An official corrected release takes priority over maintaining the private patch; preserve historical evidence while replacing every installed path through npm.

For key rotation: appoint new role-authorized Ed25519 public keys with explicit validity and owner, review/pin the new trust file through protected configuration, revoke lost/old key IDs, expire old approvals, issue a newly signed exact-candidate approval and independently test negative/revocation paths. Do not distribute signing private keys to installation runners. Rotate publish and read tokens separately, revoke compromised tokens at the registry and verify private ACL; do not log token values. No real rotation/recovery operation is performed here.

For failed/partial upload: stop, leave immutable uploaded versions quarantined, do not overwrite/unpublish, do not switch product, revoke credentials if incident suspected, and have the distribution owner decide remediation. A different archive cannot reuse a reviewed identity/version in the same immutable repository. Do not invent version numbers merely to suppress audit.

For failed installation/build/runtime: retain raw failure evidence, stop product promotion, restore the previously reviewed manifest/lock via an ordinary reviewed revert commit (never reset/force push), run npm ci and required tests on exact revert HEAD. The prior original graph is vulnerable; rollback restores availability only and is **not** a security resolution. Keep canonical audit FAIL, record exposure and seek an official corrected release or separately approved safe alternative. Private archive/key revocation and production rollback need their respective operators' explicit authority.

## Acceptance checklist and boundaries

- [ ] Organization has selected durable private registry, private ACL/immutability and readback locations.
- [ ] License/redistribution reviewer, security reviewer, maintainer and distribution owner are actually appointed and have signed exact candidate bytes.
- [ ] Trusted key policy and fingerprint are protected; publish/read credentials are least-privilege and independently provisioned.
- [ ] Approved upload and private readback pass; both independent clean full-graph installs verify all target paths/bytes.
- [ ] Real product lock diff, build/platform and raw audit reports are reviewed; advisory limitations are explicitly retained.
- [ ] Required security gate passes through a genuine upstream fix/removal, or a separate explicitly approved organizational exception process governs a still-failing raw report. This PR implements no exception.
- [ ] Isolated API/Auth target and test identities are approved; device/emulator smoke is performed on the actual application candidate.
- [ ] Production/main changes receive separate approval; no approval is inferred from a packaging test.

DB/Auth/RLS/Storage/Provider/Payment/Production execution N. Secret interface design Y, actual credential access N. Linux CI supplies SDK/JDK for prior native build, but local Windows has no JDK/ADB/emulator/default Android SDK and no approved isolated mobile API/Auth environment established from current repository evidence. WSL has only docker-desktop; it does not establish a mobile test target. Device/emulator/API/Auth checks remain NOT_RUN. Existing hosted web e2e scripts do not establish authorization for mobile testing against production, so they are not invoked.

Current B0 technical distribution interface is prepared; organizational choices HOLD. B1/B2/B3 and B4/B5 source-compatible evidence retained. B6 implementation/provenance/negative controls are validated by the exact new readiness HEAD; formal release/security acceptance HOLD. B7 offline merge compatibility is checked; merge remains unapproved and the mandatory security defect remains blocking.

CI integration repair: the readiness lane installs the same crawler toolchain required by canonical Main Health. It registers exactly one new workflow in the per-workflow responsibility fragment and Phase B inventory with explicit unique-coverage/overlap review; existing workflows and required checks remain intact. The R16D source verifier's unrelated literal total70 was replaced by equality with the actual workflow inventory, preserving its strict Phase B count comparison and every taxonomy/source assertion. This is a minimal inventory compatibility repair, with no product-data/runtime change or security threshold relaxation.
