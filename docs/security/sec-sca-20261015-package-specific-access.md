# Package-specific GitHub npm access without a global change

The owner declined the account-wide default inheritance change. It was not performed. The observed checkbox remains enabled; do not request that global change again unless a package-specific route is demonstrated insufficient. Official documentation supports a package-specific route, so a global change is not established as necessary.

Subsequent owner instruction adopted this ordering and authorized actual metadata-only candidate generation. The new [bootstrap implementation](sec-sca-20261015-unlinked-bootstrap-candidate.md) preserves the historical PRELINKED reference and creates a distinct UNLINKED_BOOTSTRAP candidate with derived report/SBOM identities. New exact-head CI/digests are pending; no live publication/ACL/linkage verification or setting change has occurred. The original investigation below remains the basis, not a claim that the later real candidate is still merely synthetic.

## Four separate properties

| Property | Meaning / evidence |
| --- | --- |
| Visibility | Initial personal npm publication defaults to private. Public source linkage does not automatically make the package public; access inheritance is a separate matter. Verify the actual server `visibility` after an authorized upload. |
| Source repository link | Identifies K_beauty as source; can be added after publication in the package UI. It is not itself a request for workflow read/write permissions. |
| Permission inheritance | Pre-publication source linkage can auto-inherit human and workflow access. A later UI connection retains the package's existing ACL unless inheritance is explicitly selected. Keep inheritance disabled for these two packages only. |
| Actions access | Separate package `Manage Actions access` repository grant. An install normally needs Read, not Write/Admin, plus a job token with `packages:read`. Public-repository grants still require fork/trust review. |

Sources: [GitHub granular access and inheritance](https://docs.github.com/en/packages/learn-github-packages/configuring-a-packages-access-control-and-visibility#about-inheritance-of-access-permissions), [post-publication source connection](https://docs.github.com/en/packages/learn-github-packages/connecting-a-repository-to-a-package#connecting-a-repository-to-a-user-scoped-package-on-github), [npm registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry#publishing-a-package).

## Proposed staged sequence, not executed

1. Prepare a distinct reviewed bootstrap candidate that does not send a top-level `repository` value during initial publication. Preserve K_beauty source provenance in a non-linking custom provenance field and the signed manifest, alongside original sources/LICENSE/SHA. Publish only after separate final redistribution/upload authority and all operational checks. Use a separately authorized owner operator, not an Actions publication that would implicitly introduce an unreviewed repository grant.
2. Before any consumer uses it, verify actual private visibility, owner identity, no inherited access and no unexpected Actions/Codespaces grants. Check anonymous and valid-unprivileged denial; anonymous denial alone is not proof of GitHub npm privacy. Do not switch the app on partial success.
3. Package page → **Connect repository** → choose K_beauty. Retain current ACL; leave inheritance off for that package. Recheck private visibility, link and effective access after connection. Repeat independently for the second package. No account-wide default change.
4. Decide install access separately. If owner authorizes a K_beauty Actions grant, give only Read and job-level `packages:read`; never Write/Admin for installation. Read still allows copying private package bytes. GitHub warns public-repository Actions grants may permit forks to access a private package. A repository-only grant is not evidence of fork isolation. Do not enable it automatically.
5. For strict fork exclusion, evaluate a credential-gated owner-triggered job on an approved immutable commit, with no private package credential in untrusted PR code. A read-only PAT classic/protected environment or separate private installer is a possible separately approved design, not an already provisioned or proven configuration. No token issued, repository created or access changed here. Revalidate actual effective permissions before product installation.

This uses a documented publish-unlinked/connect-later ordering rather than publishing pre-linked and racing to remove inherited access afterwards. Live service behavior remains NOT_RUN because actual publication is not authorized. If initial privacy/linkage proof fails, quarantine immutable published versions and stop; do not overwrite, auto-delete, weaken audit or promote the product.

## Existing candidate compatibility and limits

The currently verified scoped candidate has top-level `repository:{type:git,url:https://github.com/gycha0109-beep/K_beauty.git}`. It is therefore pre-linked metadata and must not be called an unlinked bootstrap candidate. Existing verification explicitly pins that field and the final repository metadata. No production candidate, frozen archive or upload verifier was silently altered in this investigation.

A real bootstrap variant would require explicit new candidate hashes, tight metadata-only validation, source/browser/LICENSE equality, equivalent notice/SBOM/provenance evidence and producer/replay installation proof. Its admission/readback must distinguish initial `UNLINKED_PRIVATE_OWNER_ONLY` from final `LINKED_PRIVATE_NONINHERITED` without admitting missing final source linkage. Final source linkage is still required before product use. Every changed approval/candidate digest must be reviewed; old signatures cannot authorize new bytes. Original-name audit remains HIGH22/production HIGH19/C0 FAIL, independent of visibility or package naming.

## Offline experiment actually executed

A synthetic, deliberately non-publishable npm package was packed locally using `npm pack --ignore-scripts --offline`. Its top-level repository field was absent, its source URL survived in a custom provenance field, and JavaScript bytes were unchanged after inspecting the tarball. `private:true` deliberately prevents publishing this probe. Receipt: `outputs/unlinked-npm-metadata-probe.json`, archive SHA256 `c4af055208f21026e55d174534b4fb53e7852ab91a5e7a88733342b94c47a0ce`,913bytes. This proves local npm packaging capability only; it does not establish GitHub visibility/ACL, actual patch packaging or live installation.

No global/package setting, token, fee, upload, legal clearance, audit exception, merge or deployment was performed. The logged-in browser remains open. No CI/full-graph/Android repetition was warranted for this documentation and synthetic metadata investigation; last actual implementation proof remains HEAD12512c84bfeb43ed9d3fff22fcc7166baeae47b4 CI38696879808 (59tests/CodeQL/producer/replayPASS; original audit gate FAIL).
