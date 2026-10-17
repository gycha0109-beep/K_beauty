# Scoped technical graph validation — 2026-10-15

Watchtower-Track: security

## Authorization and truthful status

The user explicitly approved scoped patch candidate generation and isolated full-graph/Expo/Metro/Android technical validation, with original provenance/license/SHA mapping and original-identity advisory audit retained. A subsequent stop/handoff was respected; the user now requested continuation at the unchanged implementation point. Upload, paid usage, exception, final license approval, merge and production remain unauthorized. Verdaccio remains unapproved.

Implementation starts from #1299 `89db573a327ca8c278d3cac0abcc6936b68fd7fa`. Main last queried `1a82cf9961f4fbba30d1d59f1ec2de1a3c6dd7e2`. Root/product manifests and locks remain unchanged. DB/Auth/RLS/Storage/Provider/Payment/Production execution N; secret-interface design Y, actual secret access N.

Local25 admission/negative-control tests and syntax/diff checks PASS. Actual new scoped pack, direct npm aliases, graph overrides, full clean install, mobile/Android and independent replay are **CI_PENDING**, not yet PASS. Existing unscoped B4/B5 proof and carrier proof do not substitute for scoped graph execution.

## Candidate content and source binding

Target scoped names are @gycha0109-beep/braces3.0.3 and @gycha0109-beep/node-forge1.4.0. Versions stay unchanged; no fictitious fixed release. Original B6 tgz SHA and full file inventories are verified before repacking. Only package.json fields name, repository, publishConfig and bejewelyPatch change. Every other file including LICENSE, parser/RSA code and six browser distributions must remain byte-identical. Added/removed files or source/dist/license changes fail.

The scoped manifest records original and new identities/versions, original archive/installed/package-json SHA, new archive SHA256/SHA512, every file SHA, license SHA, immutable source evidence HEAD and vendor-manifest hashes. Separate NOTICE and CycloneDX SBOM map scoped components to original name/version/archive/LICENSE; their exact bytes are also bound by the scoped manifest. The original B6 archive and manifest remain unchanged. New scoped manifest/archive digests will be recorded from actual CI logs, not invented here.

Original braces archive d4f1219db19bfeb4e1c3f0354f9269569393f1b8c9f8c0295b80346926d4fa70; original full-browser forge archive 67a51b864d9e483417ff34425a5a09012d333a5184dcc39f966731935463db50; original inner B6 manifest ec607c669b4242ee163b9b23d67c323750646efe4989f324ed544dd4c1eb4deb.

## Actual resolver and full graph

The existing B4 harness is preserved unchanged. A separate scoped harness adapts its graph census, consumer tests and platform checks to the new identities. Full committed source and all workspaces are copied via git archive into a new temporary graph. Both root and workspace original bytes are verified. No environment file or user dirt is copied.

A temporary localhost-only read fixture serves exactly two verified scoped npm metadata/archive resources to real npm. It has no upload, external deployment, proxy, credential or audit endpoint. It is an installation experiment, not an approved GitHub registry or production endpoint. npmjs remains the default for ordinary dependencies and every advisory request.

Direct aliases install bare dependency keys using npm:@gycha0109-beep/name@version. The disposable full graph declares both target aliases explicitly at the root; overrides reference those root specs with $braces/$node-forge. npm install receives the explicit alias specs to force replacement of the same-version identity instead of retaining stale original lock integrity. The actual npm resolver updates the candidate lock. It must pin scoped names, expected versions and SHA512 at every target path and reject unrelated dependency drift. These two additional root edges are part of this technical candidate, not product manifest changes. No hand-edited target lock entries, permanent localhost URL or file path is committed.

Both npm ci --ignore-scripts and ordinary npm ci must preserve lock bytes and all scoped file hashes. Physical nested/workspace census detects original or scoped packages that escaped the lock. Every original consumer must resolve into inventoried patched paths. npm ls, original braces/RSA behavior, Expo signing and actual micromatch/fast-glob consumers are exercised.

Producer runs full mobile typecheck/lint/foundation/entry routing, Expo config, Metro/Android export, prebuild/native checks, Next production build/local public-page smoke and Android debug APK with JDK17. Android NOT_RUN fails this required technical attempt. Device/API/Auth remain NOT_RUN without approved targets. Independent clean runner re-packs and compares scoped manifest digest and repeats both full-graph installs and consumer/audit checks without repeating the expensive Android build.

Existing readiness workflow is extended rather than creating another workflow. Producer budget60min, replay25min. Exact HEAD is checked; source/root/workspace changes are forbidden. Independent replay requires both original and scoped expected digests. Producer failure remains a failure even when artifact replay can finish.

## Audit separation

Original root/workspace full and production audit JSON is preserved verbatim, with exit status, raw SHA and advisory leaves. The unchanged graph is the original-identity counterpart of the scoped experiment; unrelated versions/integrities cannot drift. Both original target advisory leaves must remain covered. An unexpected original audit status/coverage change requires investigation.

Scoped raw full/prod JSON is also preserved independently, using the original npmjs advisory service. If scoped names remove advisory detection, this is a scanner-coverage difference, not security resolution. Technical compatibility can PASS while security acceptance is FAIL. The unchanged canonical original-security-gate job stays mandatory and does not use an exception. Prior raw fullHIGH22/prodHIGH19/C0 are snapshots; actual new responses govern counts.

Official registry/advisories were rechecked on 2026-10-15: latest braces3.0.3/forge1.4.0, no fixed version for [braces GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) or [forge GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv). [npm alias/override specification](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/) explains the replacement mechanism; execution proof still requires the actual installed graph.

## Signature and readback boundary

Scoped approval has its own schema and BEJEWELY-SCA-SCOPED-v1 role domain; old unscoped signatures cannot authorize different bytes. Exact scoped manifest digest/registry/readback identity+version/expiry/license election and four roles with at least two named owners are verified. Valid Ed25519 keys, revocation, organization trust and maximum seven-day approval remain required. The CLI pins external organizational trust SHA before admitting real signature inputs. Ephemeral test keys have no legal/organizational authority.

GitHub private metadata must bind npm type, actual private visibility, owner, package identity and K_beauty repository. Anonymous denial alone is insufficient because public GitHub npm also needs authentication. Helpers verify authenticated archive SHA and exact original-to-scoped byte mapping, plus separate anonymous and authenticated-unprivileged deny controls. Redirects cannot carry credentials. Tests use only mock responses; actual GitHub ACL/readback/token operations are NOT_RUN.

The old unscoped publisher/stager still rejects GitHub npm. No scoped upload command, packages:write permission, token, paid service or production lock is introduced by this technical validation.

## Offline verifier and remaining approvals

With both original verified B6 bundle and the new scoped candidate in approved private scratch:

```sh
node scripts/security/verify-sca-release-scoped-candidate.mjs --original-bundle /private/scratch/original-b6 --candidate /private/scratch/scoped
# Only if real organizations supply approvals/signatures/trust, add:
# --approval /private/approval.json --signatures /private/signatures.json --trust /private/trust.json
# SCA_TRUST_POLICY_SHA256 must come from protected organization configuration.
```

This command never uploads or installs the product and does not accept an audit exception. Legal review/license election, real independent responsible owners/signatures, GitHub private ACL/no-spend budget/remaining allowance, credentials, exact upload, actual authenticated readback and subsequent product release remain separate decisions. Main protection API previously returned403; required-check rules remain unverified. No merge approval is inferred.

Rollback for this experiment is deletion of owned temporary graphs/fixtures; source locks stay unchanged. Future uploaded identities are immutable: quarantine a partial release rather than overwrite/unpublish automatically. Product/main/prod operations require their own approval and fresh actual-remote graph verification.

## CI waiting

First scoped implementation HEAD c593246378dd5fb64baf1d7f69916fe89e5b15fd / run38661347090: both clean runners packed identical scoped manifest20abd1ffde84467fa24e6cb2fd8643a7fbaf3d250f618640d9e531dcd0078cb7. Scoped braces SHA8a772917c9831cb9f82ee5e80f9bc8d7d2649778f8e547d1a0096d6be3f7d891; forge SHA4dc3ebe257c470726236135166d309147ef2c045ed7f170552b518c46084391a. Original code/browser/LICENSE and NOTICE/SBOM validation, direct alias installs, CodeQL and PIE PASS. Full-graph resolver retained old same-version target integrity and correctly failed before installation; Android NOT_RUN. The explicit root alias/install recipe repairs that optimizer path while every integrity check is retained. This is not an install PASS until new CI proves it. Actual original audits remain fullHIGH22/prodHIGH19/C0, both exit1.

Further admission review rejects malformed string role lists and owner identities differing only by case/whitespace; local26 tests PASS. No new real approval or signature is created.

Do not keep a session waiting. The previous equivalent Android producer took22min33sec (one observed sample, not a multi-run average). First scoped run should use that observation plus replay/buffer for scheduled continuation; adjust to observed new durations. Technical failures are repaired automatically and rechecked, never conditionally counted PASS.


## Final exact-HEAD technical evidence

Implementation HEAD f2f9280d182ff96c303e37eaeea0d7753bcb1ad2: [CI38662014291](https://github.com/gycha0109-beep/K_beauty/actions/runs/38662014291) producer116185255524 and independent116190877563 PASS.26 admission tests, Main Health, CodeQL, both lifecycle installations, full physical graph/69 files/4 consumers, all11 web/mobile/native checks including Android debug APK PASS. [PIE38662014502](https://github.com/gycha0109-beep/K_beauty/actions/runs/38662014502) PASS. Scoped manifest20abd1ffde84467fa24e6cb2fd8643a7fbaf3d250f618640d9e531dcd0078cb7 and both archive digests reproduced independently. APK33eeed814a946fc3ea34b25e3732fe23769655d157bb1cc1921c63a29a1aeb88; Hermes2f9105df11ec681b9f90c0e6f15f8a722decd13dfa288f4e19469e006db29f97. Installed SBOM683 components. Full receipt is versioned in sec-sca-20261015-scoped-graph-evidence.json.

Original full/prod audits HIGH22/19, MODERATE13/11, CRITICAL0,exit1 retain both target advisory leaves. Scoped raw full/prod audits HIGH0, MODERATE17/14, CRITICAL0,exit1 lack both target advisory leaves: **namespace coverage loss, not official vulnerability resolution**. The moderate increase is severity propagation reclassification in existing Expo/Metro/Tailwind nodes; no new advisory leaf was introduced. Mandatory original security gate FAIL remains, so the overall readiness workflow is FAILURE. Every raw response/exit/SHA and both coverage models are separately retained.

Actual GitHub private ACL, account quota/no-spend controls, tokens/readback and real private-URL product graph, device/API/Auth remain NOT_RUN. #1294/#1303 independent patches are unmerged; this is not their combined runtime proof. B0 organization choicesHOLD, B1~B3 previousPASS, new scoped B4/B5 technicalPASS, B6 technicalPASS/formal releaseHOLD, B7 gateFAIL/mergeHOLD. No upload, payment, final legal/exception/merge/production approval was inferred.

This closeout changes documentation only. The exact executed platform proof belongs to f2f9280d182ff96c303e37eaeea0d7753bcb1ad2; later documentation-head checks must not be described as a newly executed APK build before they finish.
