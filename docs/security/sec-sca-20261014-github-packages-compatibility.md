# GitHub Packages compatibility and no-spend preparation — 2026-10-14

Watchtower-Track: security

## Decision and scope

The user explicitly **did not approve Verdaccio** and requested GitHub Packages first. This supersedes the earlier registry recommendation in the [approval closeout](sec-sca-20261014-release-closeout-and-approvals.md). GitHub-first technical review/preparation is authorized; purchase, hosting, paid usage, credential access, package upload, exception, main merge and production remain unauthorized. No selection is recorded as a legal/distribution/security approval.

Current source parent is #1299 `51fce053ec2f705e8f120e41b64a9e70c0666b73`; main remains `1a82cf9961f4fbba30d1d59f1ec2de1a3c6dd7e2`. #1294 and #1303 remain independent, open/unmerged. Prior root HIGH22 / production HIGH19 / CRITICAL0 and original gate FAIL are retained. Device/API/Auth NOT_RUN. The new prototype is **transport-only and not a product installation solution**.

## Hard compatibility result

[GitHub npm documentation](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry) requires lowercase scoped npm identities and offers GITHUB_TOKEN workflow authentication. Existing B6 artifacts are unscoped `braces@3.0.3` / `node-forge@1.4.0`, frozen to exact tarball SHA256 and package.json bytes. They **cannot be published unchanged** to npm.pkg.github.com. Changing only .npmrc or registry URL does not solve this.

| Requirement | Existing B6 | GitHub npm consequence |
|---|---|---|
| Package identity | Original unscoped names/version frozen | Direct upload incompatible; scoped fork would change package.json |
| Tarball and installed integrity | 69 exact files, original LICENSE, all six browser bundles | Repacking scoped forks changes tarball/metadata/inventory hashes; prior digest cannot authorize them |
| Approval signatures | Exact inner manifest/registry/readback URL/expiry + four roles/two owners | Crypto design reusable, actual approvals require new signed transport schema and exact outer digest |
| Readback URL | Same registry origin/repository path and original tgz suffix | GitHub transport metadata URL must be reviewed separately; reject redirects carrying credentials |
| Privacy | Credential-free read must deny access | GitHub npm requires auth for public packages too: anonymous 401/403/404 alone does not prove private visibility |
| Product lock | Original identities + approved stable remote tgz URL | An npm carrier is not an original package endpoint; embedded files have no demonstrated durable npm-resolvable URL |
| Official audit | Original npmjs raw audit + unchanged verifier | Hosting cannot remove HIGH22/19; no name/version-based detection evasion |

The existing signed private upload/staging admission now rejects npm.pkg.github.com with an explicit scoped-identity error before credentials or network operations. This does not approve another registry. No signature, source fingerprint, license election, alias policy or security gate is relaxed.

## Implemented safe transport prototype

`scripts/security/sca-release-github-carrier.mjs` prepares a **review-only scoped carrier** `@gycha0109-beep/bejewely-sca-artifacts`, with candidate version bound to the original manifest digest. It contains the eight original B6 bundle files byte-for-byte plus two preserved LICENSE copies and explanatory metadata. Original packages are not renamed/repacked or installed under alternate identities. The carrier is NOT a dependency replacement and has no runtime exports/dependencies/install hooks.

`private:true` deliberately blocks npm publish. Its own metadata says UNLICENSED/pending redistribution review; this does not change or extinguish the payloads' upstream license terms. The candidate version identifies the independent transport envelope, not an invented braces/forge fixed release. Inner manifest SHA remains `ec607c669b4242ee163b9b23d67c323750646efe4989f324ed544dd4c1eb4deb`.

Actual npm pack runs offline with --ignore-scripts inside each existing clean B6 producer/replay, not a new workflow. The verifier checks the exact outer inventory, every inner byte, original package names/versions and LICENSE SHA, and rejects corrupted archives. It emits separate outer SHA/size and inner SHA receipts; the original B6 candidate digest stays unchanged. Temp carrier files are deleted with the existing probe cleanup, and never uploaded or cached as package artifacts. Signed B6 admission cannot admit this different outer archive.

Local 19 offline tests PASS, including namespace validation, review-only status, original identity preservation and rejection of direct GitHub registry substitution. New real carrier pack/replay checks are **CI_PENDING until the exact new HEAD completes**; prior B4/B5 evidence is not substituted for them.

## Product integration alternatives and remaining technical boundary

1. **Carrier for evidence/transport (implemented prototype):** preserves exact original names/archives. Still needs an approved durable original-tgz installation transport or a formally designed build/install input pipeline. Downloading to a local file and committing that path to the product lock is prohibited. Postinstall mutation and expired Actions artifacts are not solutions. No product installation adapter is implemented or claimed validated.
2. **Scoped maintained forks:** a larger design change, not selected or implemented. It requires explicit upstream identity mappings, fresh provenance/SBOM/LICENSE hashes/outer signatures, full npm alias/override resolver validation, every nested consumer and Android checks. An original-identity advisory audit/projection must remain independently mandatory alongside the raw scoped graph audit; apparent HIGH0 caused by scope changes is not remediation. This path may conflict with the current original-name requirement and must be decided before actual fork release.
3. **Original identity with another managed private npm endpoint:** avoids self-hosting but requires a separate user choice/contract and access/billing review; Verdaccio remains unapproved.

Recommendation after this review: retain original identity constraints and use the GitHub carrier only for offline transport proof for now. Do not call GitHub npm a drop-in production distribution solution. If GitHub-only installation is essential, resolve the product identity/transport decision explicitly before release, without weakening audit or treating envelope installation as an app patch.

## Permissions, readback and provenance preparation

[GitHub permissions documentation](https://docs.github.com/en/packages/learn-github-packages/about-permissions-for-github-packages) supports granular npm package visibility/ACL. A future approved upload should use an explicitly private package with independently checked inheritance (K_beauty is public), not rely on linked-repository defaults. Use publisher packages:write only in a separately approved workflow/environment, reader packages:read in installation jobs; minimum contents:read. Grant only reviewed repository Actions access. No new publishing workflow, elevated token permissions or secrets are configured here.

For local access, provision a classic PAT with read:packages only when needed; no broad repo/delete scopes by default. Prefer GITHUB_TOKEN in Actions. No secret value is requested in chat or committed. Protected approvals/signing private keys remain outside runners; the trust SHA is pinned by the organization. Independent two-owner/four-role review remains mandatory even for a one-person project.

After explicit upload authorization, require: signed exact outer SHA+original inner SHA+approved endpoint; private visibility via authenticated package metadata/ACL read; successful authorized readback; failure by an authenticated account/repository with no granted access; credential-free deny; outer/inner hashes; fresh clean-runner installation proof on actual approved graph. GitHub npm authenticated public reads make metadata and unprivileged checks necessary. Existing anonymous-only test is retained but is insufficient for a new GitHub adapter. Real visibility/ACL/token/readback/upload checks are NOT_RUN.

Rollback: do not overwrite/reuse an uploaded version or delete/re-publish automatically. Quarantine a partial release, stop product promotion, revoke compromised credentials, and request authorized operator action. An ordinary reviewed lock revert requires full audit/testing and restores a vulnerable original graph unless separately fixed. Carrier failure changes no app because no product switch occurs.

## Operating cost comparison and no-spend gate

[GitHub Packages billing](https://docs.github.com/en/billing/concepts/product-billing/github-packages) and [included usage](https://docs.github.com/en/billing/reference/product-usage-included) currently list:

| Plan | Private package storage | Monthly transfer allowance |
|---|---:|---:|
| Free / Free organizations | 500 MB | 1 GB |
| Pro / Team | 2 GB | 10 GB |
| Enterprise Cloud | 50 GB | 100 GB |

Storage is shared with Actions artifacts; download via Actions GITHUB_TOKEN has free package transfer. Packages beyond included quota may be billed with an existing payment method. A budget alert alone is not a spend block: review the account's stop-usage setting. Container registry currently has different billing but is not an npm-compatible substitution and is not selected.

| Option | Incremental cost | Operations |
|---|---|---|
| GitHub npm carrier | Potentially $0 within **confirmed** remaining quota + enforced no-spend block | No server; permissions/token/retention/signatures and actual-install design still needed |
| GitHub scoped forks | Same quota model plus engineering/maintenance work | No server; new identity/graph/audit/provenance validation |
| Verdaccio | Software free; server/storage/backup/TLS operating cost unknown | Separate server operations; user did not approve |
| Existing managed private npm / new SaaS | Existing contract or provider quote | Managed infrastructure, independent registry/ACL/billing approval |

Actual account plan, remaining shared storage/transfer, paid usage, payment method and stop-usage budget are **UNKNOWN**, not zero. GitHub connector repository permissions cannot inspect owner billing and no billing setting is changed. Estimate storage from the real outerBytes receipt times retained versions plus other shared artifacts; estimate billable external transfer from outerBytes times local/external installs. Account for separate source/build artifacts and retained versions. Do not infer total budget from small package size. Without confirmed allowance/no-spend controls, any actual publication remains blocked. No paid plan, token, package or hosting was purchased/created.

## Approval record

- Verdaccio: NOT_APPROVED (explicit user response).
- GitHub-first review and offline preparation: AUTHORIZED.
- Real registry acceptance/namespace fork decision: PENDING.
- Payment/paid usage, license review/election, actual owners/signatures, credential access, upload, security exception, main/prod/issue close: PENDING.
- Required branch protection: API 403; cannot request bypass or claim merge acceptance.

Before a payment or package publication, call the user with one exact decision and show actual target identity/version/SHA, billing/privacy controls and rollback. No current approval is inferred from review authorization.
