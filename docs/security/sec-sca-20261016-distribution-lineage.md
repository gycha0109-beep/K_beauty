# Actual distribution lineage review — 2026-10-16

Status: final source validation at ba12b646f89f2f5eab610b4ed79c2cd45a4758ee/run38869911393 COMPLETE:86 admission tests, CodeQL, producer, independent replay and fresh web/Expo/Metro/Android PASS; original security gate and overall workflow FAIL. **No final legal/release approval, publication, product adoption or audit waiver.** This supersedes the old broad request to clear historical copying gaps by owner acknowledgment. A missing historical revision is not itself a new legal obligation.

## Actual input and coverage

Inspected the owner's genuinely decrypted archive, SHA256 `64d60bd25154243605f306852030a2373a10c1e1ea885fb6b9ed9da101207c01`, from HEAD `720566f486ee0ba5f5e747cb94bb6826100eb47b`, run38861514640 attempt2. Existing bundle, scoped-publication and browser-kit verifiers all pass. Candidate `800e6663b937d4f7ba8908e1c4e52bba3313bed9862eb9b0f85449680205548b` remains an immutable historical input.

[Machine-readable evidence](sec-sca-20261016-distribution-lineage.json) lists every file in the actual scoped archives (12 braces + 63 Forge). All six baseline browser files were independently rebuilt with the pinned webpack4.44.1 configuration and matched actual archive bytes. Compiler closure identified 50 modules in forge.all, 44 in forge, and 3 in prime.worker; external production runtime was limited to webpack's global shim/generated bootstrap. This is stronger than searching minified text for names. Source maps do not contain original sourcesContent and are not misrepresented as original-source proof. Runtime modules retain their own underlying classifications below.

The opaque SWF was separately decompressed: CWS14, 21,162 compressed bytes, 38,503 declared uncompressed bytes, embedded Adobe Flex4 Application metadata (2016-12-23) and mx.utils.Base64Encoder/Base64Decoder, mx.resources and mx.modules names. Its presence was not discoverable through JS module closure alone.

## Component decisions

A = source/grant/required notices established; B = use grant and notice obligations sufficiently supported but exact copied revision unknown; C = applicable use grant/required conditions not established; D = absent from the new candidate. These are technical assessments, not a legal opinion or owner approval.

| Component actually found | Before → new classification | Evidence and action |
| --- | --- | --- |
| Forge own code | A → A | Original BSD-3-Clause alternative elected; original dual LICENSE and copyright intact. Includes Siegl/Cozzani/SSH contributions under explicit Forge grant. |
| braces | A → A | Original complete MIT, patched parser/AST unchanged. |
| AES jscrypto/SJCL | B → B | Same authors/public-domain attribution already in Forge first2010 commit521fd6018d350a54c5f3b5ab5258a145bcc613e0. Frozen primary SJCL COPYRIGHT136512284d923390c115a735746b965c12f39fd0 contains original-public-domain statement and full BSD2 terms; retain both. Exact copied revision unknown, no crypto replacement. |
| OpenSSL-derived AES component | B → B | Frozen primary OpenSSL1.0.0 AES component public-domain grant/disclaimer retained, no whole-toolkit license inference. |
| TweetNaCl-derived Ed25519 | B → B | Primary v0.14.5 public-domain source/full Unlicense and Forge introduction470793c0ac7217e512ba3775cd75d106e7fb2b64 attribution. Seven complete function token streams match (add, pack, crypto_verify_32, scalarmult, scalarbase, S, M). Shared code across tags prevents a unique-version assertion. Unchanged. |
| DES | B → B | Existing primary author BSD2 permission/full conditions and Hayworth/Siegl/Forge attributions retained. Exact copied version remains unknown; unchanged. |
| base-x | A → A | Original full MIT embedded in source and distribution notices. |
| Tom Wu JSBN/RSA | A → A | Full custom license/intact-copy requirement, all copyright notices retained. |
| Park-Miller-Carta fallback | B → B | Forge expressly marks optimization public domain. [Primary Robin Whittle implementation](https://www.firstpr.com.au/dsp/rand31/rand31-park-miller-carta.cc.txt) publishes the mathematical method as public domain with a comment-retention request. Complete primary file pinned and attribution/comment evidence appended; no unique copying lineage claimed. Does not upgrade this fallback to a cryptographically secure entropy source. |
| PHP.js number formatter | Notice gap → B | Actual five contributor names match pinned php.js1.3.2 source458e595f90a82e8d80105c4784defd380222306b. Add its full primary MIT copyright/permission/disclaimer to both tarballs/browser kit/SBOM. Formatter function remains byte-for-byte equivalent. Exact copied revision unknown. |
| webpack runtime | Notice gap → A | Actual compiler closure and pinned webpack4.44.1 shim; add full primary MIT license to Forge and full combined notices in both packages/browser kit. No Babel/jQuery runtime silently inferred: jQuery is only a browser test harness. |
| Historical WebRSA OAEP | D → D | Entire old implementation already absent; unchanged pinned node-rsa MIT implementation remains. Historical exact BSD terms still unestablished, never marked cleared. |
| node-rsa OAEP replacement | A → A | Pinned commit54798624ba5b15521763c6d1ca69b93115a61d67, full MIT, mechanical TS5.9.3 reconstruction, existing API and interoperability verification retained. |
| Opaque Flash/Flex binary | C → D | Exact linked SDK/runtime/version/conditions not established. Upstream build statically links unpinned flex-sdk. No BEJEWELY source consumer found. Remove SocketPool.swf SHA2560ebae322dc751e77e18ceef4960bcda1d1634f53a49e7030fb640cf90f1d8839. **Legacy Flash integration NOT_SHIPPED**; do not claim Flash compatibility. Browser/Node JS APIs otherwise unchanged. |
| Copied StackOverflow isEmpty helper | C → D | Source answer attribution did not demonstrate applicable CC conditions. Replace whole helper with standard Object.keys(Object(value)); no algorithm invention. |
| Copied Snipplr formatSize helper | C → D | Snippet-specific terms unestablished. Replace entire helper with a new binary-unit-table implementation, retain separately licensed number formatter. |
| New native utility helpers | New → A | Project-authored standard operations and presentation table; strict before/after SHA/hunks prevent silent source drift. Non-cryptographic changes. |

C means evidence was insufficient, **not an infringement finding**. D is tied to strict source/archive inventories and rebuilt bundles, not a renamed file. The compiled Flash runtime is intentionally not redistributed; its JavaScript integration API remains for source compatibility but cannot use the omitted Flash asset. Full browser kit is the required companion for any future raw bundle distribution; actual delivery is NOT_RUN.

## Implementation and controls

- Primary source evidence and exact hashes: `security/vendor/node-forge-license-cleanup/manifest.json` (9 resources, byte-pinned). Existing frozen B6 review packet and original archives were not edited.
- `sca-release-lineage.mjs` applies exact original-util hash + two exact source ranges (hashes, offsets and new bodies; old unreviewed snippet bodies are not newly copied into evidence), checks final hash, removes only the pinned SWF, adds full webpack MIT, validates compiler runtime closure, compares complete primary TweetNaCl functions, and generates A/B/D report and supplemental notices.
- OAEP builder preserves RSA security patch, original LICENSE, every unrelated original source file, both OAEP MIT files, entrypoints/dependency metadata, then rebuilds all six browser files. Only util.js, historical OAEP replacement, approved browser outputs and explicitly identified added/removed files differ from the original B6 inputs.
- New scoped manifests carry a source-lineage profile and Flash NOT_SHIPPED marker. Both tarballs include full notices, SBOM and `BEJEWELY-SOURCE-LINEAGE.json`; browser kit includes full notices, both added MIT grants and source-lineage report. Same-size changes and omissions must fail.
- Whole root/workspace npm alias and overrides fixture remains an isolated local registry. Both npm lifecycle modes verify all installed source/notice bytes; installed utility regressions supplement OAEP/consumers/Expo signing. No product lockfile change.
- New vendor inputs force fresh web/Expo/Metro/Android checks; old APK is not reused for this source change. Producer/replay must agree on new digests. Owner-only encrypted retention remains the sole CI artifact upload; no plaintext tgz or private key upload.

## New candidate and verification

LOCAL proof only until independent CI finishes:

| Identity | SHA256 |
| --- | --- |
| Original scoped candidate before this change | 800e6663b937d4f7ba8908e1c4e52bba3313bed9862eb9b0f85449680205548b |
| New unscoped Forge archive | d091230a8bf8d2e870ace165f7ad2cf5afa5fd7f1abdd9012c8de12767dc8683 |
| New scoped candidate manifest | 9feebf170ea61e9b4950ba5f762246602744e1c0ea5421ef0703a79906788a2e |
| New review packet | 859448143dbd676ad549f0abb9e1e63a4439c12ee58859b75dd12f2382ac7e87 |
| New browser kit | 8960ac2ffb0a693819fbf86d8e6313713b65e82bb754c83a96bbc9e22bbeef42 |
| New scoped braces archive (13 files) | b95adba98ca7e06ac9a320d3877503b5cc19beb307e6ca595ba7aa32e1e87939 |
| New scoped Forge archive (64 files) | 76e9688cb72d105026e5bd48df62b54e49abd2fa46bacc0687f0f309cadb3201 |

Local: **86 admission/negative-control tests PASS**, OAEP480 assertions PASS, real Chromium+jQuery both forge/forge.all **32 checks each PASS**, native utility157 assertions PASS, seven complete TweetNaCl function correspondences PASS, two npm pack outputs identical, eight actual packet/kit tamper/omission controls PASS. Old candidate800e, old packet and kit still verify unchanged.

New exact-head CI/CodeQL/full graph/fresh Android/independent replay: **PENDING**. Baseline fullHIGH22/prodHIGH19/CRITICAL0 original-name audit FAIL remains; fresh raw responses are required, no audit PASS inferred from scoped HIGH0. Device/API/Auth/live registry readback/ACL remain NOT_RUN.

## Remaining execution boundary

B-level exact version/line-by-line gaps remain disclosed; no evidence-based C component is intentionally shipped in this new profile. This does not prove a universal negative or confer legal clearance. After fresh CI, the owner can review the **new exact** rights packet; old pending/signed templates cannot authorize a new digest. Do not introduce author replies, paid legal engagement or a second human as mandatory gates.

Actual publication still requires genuine owner rights/release records and signatures/pinned trust, credentials and independent denied-access identity, current quota/no-charge evidence and private-unlinked readback checks. No secrets requested in chat, no new general publication permission requested. User's current instruction forbids unapproved upload/ACL/payment/product/main/production changes. Existing security gates remain intact and unrelated feature development may proceed in isolation.

## Linux CI follow-up

Exact HEAD6367e5cb8d245ceadd624c93920e69fb2cd3dbb6/run38868077216: CodeQL and85 admission tests PASS; producer failed before the new candidate/full graph/Android at module-inventory normalization: Linux names the byte-pinned webpack global shim as ../webpack-harness/node_modules/webpack/buildin/global.js instead of (webpack)/buildin/global.js. Independent replay SKIPPED. Original audit gate raw fullHIGH22/prodHIGH19/C0 FAIL. This was a verifier portability failure, not an unreviewed dependency or source/license failure.

Normalize only the exact webpack/global path suffix; require actual package version4.44.1 and the unchanged primary shim SHA before accepting it. Added Linux layout acceptance plus wrong-byte/wrong-version rejection regression; full local86 tests PASS. Normalized inventory, candidate/archive/packet/kit bytes are unchanged. Fresh exact-head CI/full runtime/independent replay remains required; no earlier PASS is substituted.

## Final exact-source CI proof — 2026-10-16

[Run38869911393](https://github.com/gycha0109-beep/K_beauty/actions/runs/38869911393), source HEAD **ba12b646f89f2f5eab610b4ed79c2cd45a4758ee**. Producer116871316799, independent116878120553, admission116871316840 (**86 tests**) and CodeQL116871316781 PASS. Originalgate116871316567 FAIL; overall workflow FAIL. PIE38869911831 SKIPPED. The pending statuses above describe historical/local stages and are superseded by this source validation. [Complete receipts](sec-sca-20261016-distribution-lineage-final-ci.json).

Fresh production web build/page smoke, mobile TypeScript/lint/structure/config, Metro/Android export/prebuild/native checks and Android debug APK PASS. Runtime required=true; no old APK reuse. APK SHA256 **5f5db368829e91214a0c1a8cb8234a822a9b959dd75ace2428e1a1b7a002ec41**, Node22.23.3/npm10.9.9, Temurin17.0.20.1. Root/workspace alias+overrides install both lifecycle modes and all77 files/consumers/Expo signing PASS on both clean runners. OAEP480, Chromium2x32, native utility157 per installed lifecycle, seven complete TweetNaCl functions, source/LICENSE/NOTICE/SBOM/module inventory and missing/tamper controls PASS.

Canonical retained Linux candidate: **17119d9a264faba07951e8db3519a8ef23452504e30212b6a18c34994980621d**; review packet **859448143dbd676ad549f0abb9e1e63a4439c12ee58859b75dd12f2382ac7e87**; browser kit **2330e347ff66295865cb056237a6157d8a55b303c1100cdef01b2ff566e802e9**; unscoped Forge **d514b22708d7602f845df8492f86bb5300419a265a46aed9eddaf047deb635e1**. Scoped braces **37d2604f280a0274cc26b7251e059111d36819430bc5bad578c2bdcba718b351**; Forge **353690e06c92704162c7b622fca9a2e0d4007c6bdbec6603f6906b58a02dae34**. All digests match independent Linux replay. The earlier9fee candidate/table is LOCAL Windows/Node24/npm11 evidence, not this release candidate. All61 unpacked Forge file hashes and complete normalized build records match between Windows and Linux, and the review packet matches. Tarball bytes differ across the two OS/toolchains; the precise tar-header cause is not asserted without plaintext CI comparison. Cross-OS tarball determinism is not claimed.

Original-name raw audit fullHIGH22/MODERATE13/C0 and productionHIGH19/MODERATE11/C0 both exit1. Scoped audit still exits1 (17/14 MODERATE); scopedHIGH0 reflects lost original-advisory namespace coverage, not original audit acceptance. No security gate/exception changed.

Actual encrypted artifact12033259971 (sca-b6-owner-encrypted-38869911393-1) downloaded: exact candidate.tar.gz.enc2129546bytes and receipt.json1386bytes only. ZIP SHA **6bc2aeed1ee203c3e51d46be3e4fed57566542e702bd3b97666ac3ec12cff092**; cipher **f4915edebce74e8dd967860518f568181be058531e448f4b5bf0dbc6c37e76df**; trusted-log receipt SHA **9330b0522ea248a3de1e671ea8aae33952ddf06d6917356f4c2033d1107e5a1f**. Actual cipher/receipt digests match trusted producer logs and registered owner-public fingerprint. No plaintext tarball or private key uploaded/accessed. New-candidate owner decryption remains NOT_RUN; prior800e owner decryption stays PASS and is not reused as a new-candidate claim.

No identified C code is intentionally retained after this remediation; six B component histories remain disclosed and grants/notices are supported by recorded primary evidence. Final exact-candidate owner rights review remains PENDING, never auto-cleared. Genuine release signing/trust, registry credentials/current no-charge/ACL/readback and actual publication/product adoption are NOT_RUN. Device/API/Auth remain NOT_RUN. No merge/production/issue closure. The source changes are now complete; this final receipt update changes only documentation and does not justify another APK cycle.
