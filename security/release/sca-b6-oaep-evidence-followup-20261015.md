# OAEP / WebRSA redistribution evidence follow-up — 2026-10-15

**Status: PARTIAL_PUBLIC_EVIDENCE; THIRD_PARTY_TERMS_UNRESOLVED; RELEASE_HOLD.**
This is an evidence memo, not legal clearance, upload approval, a substitute for the immutable reviewed license packet, or a change to any admission predicate.

## Narrow question

The `node-forge/lib/pkcs1.js` source incorporates / derives from Ellis Pritchard's historical `WebRSA/Client/RSAES-OAEP.js`. The embedded source header credits "Copyright (C) Ellis Pritchard, Guardian Unlimited 2003" and says **"Distributed under the BSD License."** Which *complete* original BSD conditions apply, and have those conditions been delivered with a new binary/standalone-browser package?

## Evidence, independently located

| Class | Source | Observed | Limit |
| --- | --- | --- | --- |
| Primary project catalog | https://sourceforge.net/projects/webrsa/files/webrsa/webrsa-1.0/ | 2003-07-02 `webrsa-1.0.tar.gz` (28.7 kB) offered | Listing does not expose the embedded original copyright/license text. Historical downloads in the frozen research were HTML or failed archive SHA verification. |
| Project license declaration | https://sourceforge.net/projects/webrsa/ | WebRSA categorized as **BSD License** | Generic label does not establish 2-, 3-, or 4-clause variant, complete disclaimers, or attribution conditions. |
| Preserved derived source header | https://github.com/digitalbazaar/forge/blob/main/lib/pkcs1.js | Original author/date/contact and "Distributed under the BSD License" retained alongside jsjws MIT text | Header alone does not contain the complete original BSD conditions. |
| Upstream Forge license | https://github.com/digitalbazaar/forge/blob/main/LICENSE | Project offers BSD-3-Clause or GPL-2.0; full BSD-3 conditions present | Forge's license does not automatically replace an embedded third party's own terms. |
| Secondary distributor review | https://sources.debian.org/src/node-node-forge/0.8.1~dfsg-1%2Bdeb10u1/debian/copyright | Debian package's `Files: lib/pkcs1.js` section attributes Ellis Pritchard and labels the combined file **BSD-3-Clause and Expat~Intact** | Meaningful corroborating downstream assessment, **not** the original 2003 WebRSA license and not independent proof of precise original BSD variant. |
| Frozen BEJEWELY evidence | `security/release/sca-b6-public-license-findings.json`, `security/release/license-review/license-review.json`, `security/release/license-review/THIRD-PARTY-NOTICES.md` | Original SOURCE/LICENSE/NOTICE entries and SHA-reviewed packet are retained; OAEP marked `BSD_VARIANT_AND_COMPLETE_TERMS_REQUIRE_REVIEW` | Their hold is intentional; this memo does not change their content, checksums or legal status. |

### Differentiating rights from provenance

- The copyright owner's declaration of *BSD permission* is real evidence of permissive intent, corroborated by Forge redistribution and Debian's packaged assessment; it is **not** the original full grant/conditions text.
- Exact copied revisions and line-by-line historical mapping for other permissive components are disclosed as *provenance assurance gaps*; they do not automatically require an author email or paid legal counsel.
- The **OAEP full applicable terms** are an open external condition, distinct from those provenance gaps. Conservatively preserving BSD-3-Clause and the original author header is good hygiene but cannot truthfully be marked a proved substitute for terms that have not been recovered.
- No observed text requires individual author reply before redistribution, but absence of a reply requirement does not extinguish notice/conditions obligations.

## Controlled closure path (no new owner decision required just for research)

1. From an execution environment that can download actual SourceForge binary archives, obtain original `webrsa-1.0.tar.gz`, reject redirects/HTML, and compare with the previously recorded archive SHA-256 `d64c580201891195236a7942f16a86ee6bc7a053d23abef7d2ffeb63178e9343`. Never treat a project webpage as a tarball.
2. Inspect original `LICENSE`, `COPYING`, `README`, file headers, and preserved revision history for complete operative BSD conditions. Record exact bytes, source path, digests and excerpts only as permitted. If no operative text is found, keep hold; do not invent a 2-/3-/4-clause election.
3. If complete terms are recovered, compare them against the existing `THIRD-PARTY-NOTICES.md`, embedded source/header, browser standalone distribution policy and candidate tarball readback. Correct missing notices with a new reviewed **versioned candidate/packet**; never edit frozen packet in place or break pinned digests without re-review.
4. Re-run the actual rights evidence/notice audit and get the project's real signed upload approval/trust for the exact candidate. `CLEARED_BY_PROJECT_OWNER` and `rightsReview.unresolved=[]` must reflect supported facts, not flags set merely because the owner said "proceed".
5. If operative terms cannot be recovered or matched, retain `HOLD` and consider a different implementation/dependency that avoids the uncertain derived component. Do not publish the modified `node-forge` package as though its embedded-license risk disappeared.

## Scope of owner instruction

On 2026-10-15 the owner authorized proceeding with **private GitHub Packages publication** when executable prerequisites are satisfied, and declined paid counsel, author contact or an OAEP rewrite at this time. No payment, broad visibility change, source/NOTICE excision, license-policy waiver, merge, production release, or unresolved-rights falsification was authorized.

**Outcome of this follow-up: the public evidence is stronger because of the independently identified Debian review, but the original operative OAEP BSD conditions have still not been obtained. Retain the explicit legal hold.**
