# B6 license and redistribution review packet

Status: **TECHNICAL_REVIEW_ONLY_LEGAL_HOLD**. On 2026-10-15 the user authorized review of braces under MIT and node-forge under BSD-3-Clause. This is not final legal approval, an approved release license election, upload authorization, a security exception, cost authorization, merge permission or production permission.

## Source and artifact scope

The packet is generated from the independently verified original-name B6 archives, after their SHA256 and all installed source/browser/LICENSE bytes are verified. It preserves the original dual-license Forge LICENSE in full, including its GPL alternative; the review basis does not remove or rewrite that file or relicense embedded works. Existing original B6 manifest `ec607c669b4242ee163b9b23d67c323750646efe4989f324ed544dd4c1eb4deb` and its archives remain unchanged.

Scoped archives retain only the previously reviewed four package.json metadata changes. Their SHA256 values remain braces `8a772917c9831cb9f82ee5e80f9bc8d7d2649778f8e547d1a0096d6be3f7d891` and forge `4dc3ebe257c470726236135166d309147ef2c045ed7f170552b518c46084391a`. The scoped candidate manifest **must change** because three new licensing resources and the NOTICE cross-reference are now bound by its file hashes. Earlier scoped manifest `20abd1ffde84467fa24e6cb2fd8643a7fbaf3d250f618640d9e531dcd0078cb7` remains historical evidence, not the new licensing packet digest. Any eventual signatures must cover the final new digest; old signatures cannot authorize it.

`sca-release-license-review.mjs` creates `THIRD-PARTY-NOTICES.md`, `license-review.json` and `license-review-sbom.json`. It retains complete original LICENSEs, initial permission/disclaimer blocks, later copyright/license comments, and binds 49 notice-bearing source files to the frozen installed file inventory. Six embedded source groups receive explicit SBOM entries and review status. Both candidate producer and independent replay reconstruct these resources, rejecting altered bytes or omitted notices. There is no new upload operation, registry credential or permission grant.

## Obligations and open rights questions

| Material | Observed upstream statement | Required handling / pending review |
| --- | --- | --- |
| braces | MIT, Jon Schlinkert copyright | Preserve complete permission, copyright and disclaimer with copies/substantial portions. |
| Forge | BSD-3-Clause OR GPL-2.0 | Review BSD-3-Clause route; preserve copyright, conditions and disclaimer in source and materials for binary distribution; no implied endorsement. Preserve original LICENSE unchanged. |
| baseN/base-x | Complete MIT text in source | Reproduce entire embedded notice in accompanying materials. |
| Tom Wu JSBN | Custom permission and disclaimer, additional intact-notice condition | Preserve complete custom text and both copyright periods; do not silently normalize it to MIT. |
| PKCS#1 | Kenji Urushima/jsjws MIT; Ellis Pritchard/Guardian Unlimited “BSD” | Preserve both notices; exact BSD variant and complete conditions require independent rights review. |
| DES | Paul Tero “BSD”, Michael Hayworth attribution, Stefan Siegl and Digital Bazaar | Preserve all header text; complete BSD conditions and variant require independent rights review. |
| AES | jscrypto public-domain claim and OpenSSL-derived portions | Preserve attribution; identify originating OpenSSL code/version and applicable terms before clearance. Do not assume current OpenSSL Apache-2.0 terms apply retroactively. |
| Ed25519 | TweetNaCl public-domain claim | Preserve attribution; independently review the origin and rights claim. |

Additional Stefan Siegl, Lautaro Cozzani, shellac, Digital Bazaar and other source-header attributions are retained verbatim in the generated notice packet. This is an evidence inventory, not a legal opinion that all rights are cleared.

## Browser and dependency delivery

All six browser distribution files remain bound to B3 browser provenance. Minification and cheap-module source maps do not prove full notice retention or complete module inventory. The full notice packet and unchanged upstream LICENSEs must accompany every distributed browser bundle, including standalone copies; shipping only a minified JS file is not approved. Final publication packaging must demonstrate recipients can obtain those materials. No browser bytes are changed by this documentation operation.

Forge declares no runtime npm dependencies; braces declares fill-range ^7.1.1, installed separately. The embedded-code review SBOM supplements the existing two-package release SBOM and 683-component installed-graph SBOM; it does not replace either. Separately installed dependencies retain their own licenses. webpack 4.44.1 and webpack-cli 3.3.12 are build tools, not automatically redistributed runtime dependencies; the pinned build configuration disables the usual Buffer/process/crypto/setImmediate shims. A final legal review must still assess complete shipped content and any generated webpack runtime. No unobserved external package is claimed cleared.

## Approval checklist and handoff

- [x] User-selected review route recorded: braces MIT; Forge BSD-3-Clause.
- [x] Original LICENSE SHA256 pinned: braces `35bdd8a44339719441900fb50fbefc5e2dca1ca662cbaed7a687de842c8b70f2`; Forge `f63ff0e4e239244aa79280da2dd4811a0469e5e201caf5cbc0d97c3a1dff8e82`.
- [x] Full source notices, embedded SBOM entries and open terms questions prepared; omission/substitution checks implemented.
- [ ] Producer and independent replay on this new packet HEAD complete; record new candidate digest without replacing historical proof.
- [ ] Named independent legal/redistribution reviewer resolves OpenSSL, DES and OAEP origin/terms and public-domain claims; records scope, decision, evidence and identity.
- [ ] Reviewer verifies final browser/standalone notice delivery, complete shipped-content inventory and original license preservation.
- [ ] Four signed roles / at least two named owners, trusted external key digest, expiration and revocation satisfy existing admission checks; review-route approval alone cannot satisfy them.
- [ ] Actual GitHub plan/quota/budget/stop-usage, private granular ACL and CI credential access are confirmed without unapproved spending.
- [ ] Explicit exact-package/version/SHA/target upload approval; authenticated readback plus anonymous and unprivileged denial; no overwrite/unpublish rollback.
- [ ] Real private-registry product graph, raw original audit and platform checks completed. Device and API/Auth smoke remain NOT_RUN until an authorized environment exists.
- [ ] Separate security risk decision, protected-gate compliance, main merge and production approvals as applicable. No scanner exception is created here.

Original full audit HIGH22 / production HIGH19 / CRITICAL0 remains FAIL. Scoped HIGH0 reflects missing original-advisory namespace coverage and is not remediation. APK/Metro/Expo proof at f2f9280d remains source-runtime evidence; it is not an actual GitHub Packages installation or legal release approval.

## Verification commands

```sh
node --test scripts/security/sca-release-bundle.test.mjs scripts/security/sca-release-license-review.test.mjs
# After original B6 archives are independently generated; output must be a new directory:
node scripts/security/verify-sca-release-scoped-candidate.mjs --original-bundle /approved/local/b6 --candidate /isolated/scoped-candidate
```

The verifier only verifies an existing candidate; the producer builds the new packet through the existing scoped full-graph harness. No publication command is authorized by this document. The final signed approval inputs, registry endpoint and owner credentials must be supplied through the already defined approval interface, never in chat.

Primary sources: [Forge v1.4.0 LICENSE](https://raw.githubusercontent.com/digitalbazaar/forge/v1.4.0/LICENSE), [braces 3.0.3 LICENSE](https://raw.githubusercontent.com/micromatch/braces/3.0.3/LICENSE), [Forge JSBN](https://raw.githubusercontent.com/digitalbazaar/forge/v1.4.0/lib/jsbn.js), [PKCS#1](https://raw.githubusercontent.com/digitalbazaar/forge/v1.4.0/lib/pkcs1.js), [pinned webpack configuration](https://raw.githubusercontent.com/digitalbazaar/forge/ceba34402e329f0365134f23fe19898756527d65/webpack.config.js). Exact source bytes and hashes, rather than current branch prose, bind the packet.
