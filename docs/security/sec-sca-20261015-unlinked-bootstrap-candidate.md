# Unlinked private npm bootstrap candidate — implementation and evidence

The owner adopted the package-specific path and authorized metadata-only candidate generation/verification. Actual publication, credentials, settings, fees, legal conformity, final redistribution, exception, merge and production remain unapproved. The account-wide inheritance default remains unchanged. `sca-b6-package-access-path-decision.json` records the instruction and its limits; the new candidate manifest pins its SHA.

## Candidate transformation

The original B6 archives and PRELINKED scoped candidate remain distinct historical references. `scopedMetadata(...,{linkage:'UNLINKED_BOOTSTRAP'})` removes top-level `repository` and retains K_beauty in `bejewelyPatch.sourceRepository` with an explicit bootstrap marker. Name, version, entrypoints, dependencies, browser fields, scripts and all other original metadata retain their prior meaning. No advisory-hiding version/name change is introduced by this step.

The archive verifier requires exact file inventory and every non-package.json byte equal to the already verified original patch tarball. Package.json must equal the precise mode-specific transformation; reintroduced automatic linkage, unexpected metadata or source/LICENSE/browser drift fails. PRELINKED remains the legacy default verifier mode; the full-graph candidate runner explicitly generates UNLINKED_BOOTSTRAP. Mode changes are manifest- and signature-bound; old candidate approvals cannot authorize new hashes.

`bootstrapLicenseReviewResources` first reconstructs the frozen reviewed packet against the original source/LICENSE/public extracts. It then derives the new archive-level review/SBOM identities, preserving complete third-party notice content. `bootstrap-license-lineage.json` records baseline resource hashes and old/new archive mappings. The original license packet stays frozen; the new candidate has its own license-packet SHA. This derivation is technical, not a legal clearance. The owner's conditional-review record remains limited and pinned to the frozen evidence; it is not silently promoted into approval of any new archive.

The browser notice kit uses the verified new candidate packet and its manifest hashes, including the derivation mapping. Its six browser files and original Forge LICENSE stay unchanged; report/SBOM/kit hashes may change because the candidate archive identities changed. Existing notice omission/same-size mutation checks and independent kit replay remain active.

## Installation and independent CI

Both producer and independent clean runners create the new real tarballs, verify NOTICE/SBOM substitution controls, install actual npm aliases/overrides in the root/workspace graph in ignore-scripts and ordinary lifecycle modes, inventory all installed target files, run consumer/RSA/Expo-signing regressions and preserve raw full/production audits. Producer exports new candidate/kit digests and replay requires exact equality. No original tarball hash is relaxed. A local attempt using previously downloaded upstream archives was correctly rejected by the original pinned patch-archive hash; no upstream archive was accepted as a patched source or relabeled success.

Web/Expo/Metro/Android proof is reused only under the existing runtime-input/runner-proof resolver. The code, entrypoints, dependencies and browser bytes are invariant in this metadata-only transformation; current full graph source/install/consumer tests still run. Reuse names the actually tested9427 reference; it is not a fresh Android build or device test. Other app/input/toolchain changes still require full runtime checks. PIE/Main Health/crawler installation are not reintroduced.

### Completed exact-head evidence

Implementation HEAD `640d607b0e48bbdb1488836e931efd0298d6cfe7`, [run 38703130197](https://github.com/gycha0109-beep/K_beauty/actions/runs/38703130197): admission **63 tests PASS**, CodeQL PASS, producer PASS and independent clean-runner replay PASS. The overall workflow remains FAIL because the original security audit gate correctly fails.

Both runners independently reconstructed and matched:

| Evidence | SHA256 |
| --- | --- |
| Candidate manifest | `615d90ccf1b35a36d7f02a974741789d7be164fa85236139920fb059e5a56bae` |
| Derived candidate license packet | `6855a6f1fd6cd2345a5a9e2e5a7171516051456428a4d2534965d1d1ffd85529` |
| Browser notice kit | `a6ead593b28ebe679493660973a907145384e0b0f49e09599c14ca5659903981` |
| @gycha0109-beep/braces@3.0.3 | `ed07c776e59fbdcd7cc8f73fa92c8559658f9f3280fe642dc95a59eeeb0a3333` |
| @gycha0109-beep/node-forge@1.4.0 | `5d6a76df10fec8d8d2f747ee76bd88828de17d7491e755b14070eb9aa19d9e8f` |
| Original B6 braces archive (unchanged) | `d4f1219db19bfeb4e1c3f0354f9269569393f1b8c9f8c0295b80346926d4fa70` |
| Original B6 node-forge archive (unchanged) | `67a51b864d9e483417ff34425a5a09012d333a5184dcc39f966731935463db50` |

Root/workspace alias and override installs passed with scripts ignored and with ordinary lifecycle execution. The installed census verified 69 target files (braces 10, Forge 59); Expo CLI, Expo code-signing, chokidar and micromatch resolved the expected patched root packages. Source/browser/LICENSE bytes and full notice text were preserved. Missing-notice and same-size notice-tampering negative controls passed, as did independent kit replay.

The scope resolver recorded `runtimeRequired:false` and authenticated runtime reference HEAD `9427fc637b8c26a231511671a5560acfe1963c05`, [run 38689645912](https://github.com/gycha0109-beep/K_beauty/actions/runs/38689645912), APK SHA256 `c24e9b83dafd2f2fac03e9240fca59c0a74b6b666811a0b15bfc87763f02175e`. This is reuse of unchanged web/Expo/Metro/Android build evidence, not a new APK or device test. PIE was skipped; unrelated Main Health/crawler installation was excluded.

Raw original audits remain **full HIGH22/MODERATE13/CRITICAL0, production HIGH19/MODERATE11/CRITICAL0; both exit 1**. Scoped audits reported HIGH0 with MODERATE17/full and MODERATE14/production, both exit 1; their advisory coverage excludes the original package identities. This is a namespace coverage gap, not remediation or authorization of an exception. Product lockfiles remain unchanged. Conditional review is `VALID_LIMITED_REVIEW_ONLY` with `executionReady:false`; OAEP exact BSD terms remain OPEN. Real registry readback, post-link private visibility/ACL/Actions grants, device and API/Auth smoke remain NOT_RUN.

## Staged live checks — NOT_RUN

The dormant operator requires separately signed final redistribution/upload and operational evidence, explicit bootstrap mode and the new candidate-license-packet SHA. An actual initial readback must be private and have no linked repository; unexpected pre-linkage fails. Completing initial upload can return only `PRIVATE_UNLINKED_ONLY` and `HOLD_OWNER_ACTION_NOT_RUN`, never product readiness or completed source/ACL setup.

After distinct owner approval for package settings: configure only those two package ACLs, connect K_beauty later without inheritance, and separately evaluate Actions access. The final proof requires private metadata linked to K_beauty and separate observed effective-ACL evidence: no inherited permissions, no unexpected repository grants, installation Read only, and explicit fork-isolation review. Metadata alone cannot prove ACLs; helper tests use synthetic evidence only. No live ACL evidence has been produced or cryptographically certified by this implementation. Final source linkage remains required before product use.

GitHub documentation supports this ordering, but actual post-link privacy/noninheritance and necessary Actions access cannot be verified against nonexistent packages without an approved publication. Read access in a public repository still permits downloading bytes and can reach forks; no broad public-repository grant is implied by adopting this path. No token, account default, package setting or repository permission is changed here. Existing LICENSE/NOTICE/SBOM/independent/readback/security-gate requirements remain intact.
