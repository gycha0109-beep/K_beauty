# OAEP / WebRSA redistribution evidence follow-up — corrected 2026-10-16

**Status: AUTHENTIC_ORIGINAL_ARCHIVE_VERIFIED; PRECISE_BSD_TERMS_UNRESOLVED; FORGE_PUBLICATION_HOLD.**

This corrects the earlier statement that the original archive had not been recovered. Prior recovery was already recorded in `docs/security/sec-sca-20261015-oaep-original-recovery.json`. Repeating “obtain the archive” as an unresolved task was stale. On 2026-10-16 a fresh download from the official netix SourceForge mirror again matched that exact original, before any inspection. Archive acquisition is resolved; complete applicable OAEP BSD conditions are not.

## Original release actually inspected

- [Official file listing](https://sourceforge.net/projects/webrsa/files/webrsa/webrsa-1.0/).
- [Official mirror bytes](https://netix.dl.sourceforge.net/project/webrsa/webrsa/webrsa-1.0/webrsa-1.0.tar.gz).
- Size **28,732 bytes**, SHA256 **d64c580201891195236a7942f16a86ee6bc7a053d23abef7d2ffeb63178e9343**.
- Gzip magic, pinned published digest, all nine regular-file sizes and SHA256 values match prior recovered evidence. HTML/nonmatching bytes cannot satisfy these checks. No source was executed or extracted onto the filesystem.
- `Client/RSAES-OAEP.js` credits Ellis Pritchard / Guardian Unlimited 2003 and states “Distributed under the BSD License.”
- `WebRSA-README` says “Distributed under BSD licence.” The original HTML README and project page have the same generic declaration.
- No standalone LICENSE/COPYING/NOTICE file occurs in the nine regular release files. OAEP header and README licence section do not contain the complete redistribution conditions or disclaimer. The associated historical category187 link is not a recovered operative license text.
- [Fresh file inventory and findings](../../docs/security/sec-sca-20261016-oaep-reinspection.json). The earlier official CVS evidence corroborates origin/grant but did not recover full conditions either.

## Findings, not assumptions

| Question | Result |
| --- | --- |
| Does the rightsholder declare BSD distribution? | Yes, original author/source/README establish a real BSD grant statement. This is stronger than a downstream label alone. |
| Which complete BSD variant/conditions apply? | **UNRESOLVED**. Do not invent BSD2/BSD3/BSD4 text as the recovered original. |
| Author attribution | Present in original/Forge source and frozen combined notice packet; retained inside the new npm tarballs and accompanying browser review kit. |
| Full conditions/disclaimer sufficiency | Cannot attest for OAEP from the incomplete declaration. Other complete MIT/BSD notices do not replace an embedded work's missing terms. |
| Missing notice material known today | All recovered text is retained. No further authenticated full OAEP license text was found to add. Adding guessed conditions would not resolve this finding. |
| Debian's BSD3 and Expat classification | Corroborating distributor interpretation, not the original 2003 operative conditions. |
| Exact historical jscrypto/TweetNaCl line mapping | Disclosed provenance assurance gaps, distinct from missing applicable OAEP terms. |
| Need an author's reply, second reviewer, paid counsel? | None is an observed condition in the examined permission texts. No such new prerequisite is imposed. No external inquiry is sent or awaited. |
| Can a user approval cure missing third-party terms? | No. Human permission to publish does not supply or waive unverified third-party obligations. |

Forge's project-level BSD3 review basis, braces MIT, DES author's complete BSD2 text, historical SJCL/OpenSSL component notices and TweetNaCl evidence remain preserved. No frozen LICENSE/NOTICE/SBOM resource, source/browser byte, candidate digest, rights flag or signed-admission predicate is changed by this correction.

## Current implementation and actual audit

Remote implementation HEAD `21a804623eb2b3ea5dedcb4b7a941740fd2b9a21`, [CI38724954981](https://github.com/gycha0109-beep/K_beauty/actions/runs/38724954981): **67 tests, CodeQL, producer and independent replay PASS**. Overall workflow FAIL comes from the unchanged original-name audit gate. Both runners retained notice-containing candidate **b2f6965a4d05a30790cbf3f0a954c27cd8261e6a1bddc19bd5f13f36eb27b816** and browser kit **94026dc9d62d8a48cdb80820568c1267d9bb2c4e83439ce5a27632d4e003f947**; original source/LICENSE/browser bytes and real root/workspace installation remain verified.

Fresh 2026-10-16 audits were run against package.json/lockfile bytes matching that exact remote tree: full **HIGH22/MODERATE13/CRITICAL0**, production **HIGH19/MODERATE11/CRITICAL0**, both exit1. This was a current original-name lockfile audit, **not a fresh npm ci or device build**. [Raw-response hashes and exact Git blobs](../../docs/security/sec-sca-20261016-original-audit-summary.json). Raw JSON is retained in the task outputs. Both latest npm versions remain braces3.0.3/Forge1.4.0; official advisories still list no patched release. Scoped scanner silence is not remediation.

## Owner authority and publication blockers

The owner's latest direct instruction authorizes actual **private GitHub Packages publication once license and executable release prerequisites are satisfied**. Do not request that same general publication approval again. It does not waive unverified terms, permit public visibility, paid services, global inheritance changes, audit exceptions, product dependency adoption, merge or production.

The current process has no provisioned publisher token, independent unprivileged token or pinned trust environment value; no real signed release material was supplied or admitted. Existing GitHub browser login is not an npm publishing credential. Account read-only inspection reconfirmed existing Packages paid-usage blocking and no published packages in the owner's package view; no setting was changed. Exact available shared-storage bytes remain unverified.

The two-package operator remains blocked by OAEP's unresolved applicable terms and unprovisioned executable credentials/trust. Nothing was uploaded; readback/anonymous and valid-unprivileged denial/post-link ACL/product-registry install remain NOT_RUN. Publication authority is acknowledged, but neither blocker is silently passed. Do not mint a “cleared” record, strip the OAEP header or publish a component-excised Forge package as if compatible. No rewrite is undertaken merely to relabel the review.

[Minimum credential setup and staged operations](../../docs/security/sec-sca-20261016-publication-prerequisites.md) are prepared for when applicable rights can be supported. No paid legal review or upstream response is a default gate; no additional general approval cycle is introduced.
