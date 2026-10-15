# GitHub Packages account preflight — read-only results

## Authorized target and scope

On 2026-10-15 the owner selected GitHub Packages for BEJEWELY private patch distribution, scope `@gycha0109-beep`, source repository `gycha0109-beep/K_beauty`, and authorized read-only preflight. This selection is not authorization to change settings, issue tokens, pay, publish, redistribute, waive audit findings, merge or deploy. Previous conditional license review remains limited; OAEP exact BSD conditions remain OPEN.

## Authenticated follow-up — supersedes the initial access limitation

After the owner completed GitHub sign-in, the same browser session was reused and kept open. All subsequent actions were navigation/filtering only: no Save button, setting toggle, token creation, package publication or payment action was performed. Actual account billing details remain in the local owner receipt; they are not copied into the public PR.

- Current plan and included Packages storage/transfer entitlements are now verified in the authenticated billing UI. The current-month Packages usage filter returns `No usage found`; the owner Packages profile shows the getting-started screen with no packages. A live per-package private ACL, source linkage or Actions grant therefore cannot yet be validated. No placeholder package was created.
- The existing account Packages budget visibly reports enforced blocked paid usage. This was observed, not configured by Codex. The exact physical remaining shared storage is still not established by the monetary included-discount card; do not manufacture a remaining-byte value.
- The personal-account default **Inherit access from source repository** is ENABLED. The UI expressly applies it to **new Container, npm, rubygems and NuGet packages**. The proposed next action is to disable that default, subject to distinct owner approval, so new package access can be reviewed individually while preserving source linkage. This is an account-wide future-package setting, not a K_beauty-only switch. Existing packages are not changed by a default for new packages; no packages are listed currently.
- The current public-repository fork approval/token-default settings were read and recorded locally. Private package isolation has not been demonstrated. The earlier documented public-fork access risk remains a release preparation concern; do not automatically grant the public source repository package Actions access.
- Scoped installation, package-specific ACL and actual readback remain NOT_RUN. The owner has not approved turning off inheritance, issuing a credential, publishing, final redistribution or changing other repository controls. The browser remains open on the exact default-package setting for review.

## Initial unauthenticated observations (historical; see follow-up above)

| Requested check | Result | Evidence / limitation |
| --- | --- | --- |
| Target repository | VERIFIED PUBLIC; owner type User | Authenticated connector GET `/repos/gycha0109-beep/K_beauty`: `private:false`, `visibility:public`. Connector metadata reports admin/push/pull; this does not establish billing or package access. |
| Current plan / remaining free storage and transfer | UNKNOWN | Billing API blocked by the connector's allowed-endpoint restriction, not a zero-usage response. In-app browser billing page is unauthenticated and shows404/sign-in. No existing browser login was available; no login/token was created. GitHub CLI is not installed. |
| Budget / spending hard stop / payment-method presence | UNKNOWN | Same account access limitation. No budget or financial setting changed. |
| Actual package visibility / repository inheritance / Actions ACL | UNKNOWN | User packages list and two package metadata API requests blocked by connector endpoint restrictions. This does not prove packages absent or private. No package upload performed. |
| Current workflow credential exposure | VERIFIED STATIC | SCA preparation workflow has no `packages:write`, no private package token, and does not invoke the dormant publisher. Existing CI uses only local package fixtures. |
| Supported Actions authentication | DOCUMENTED, LIVE NOT_RUN | GitHub recommends repository `GITHUB_TOKEN` for authorized Actions installs, with job-level `packages:read` and package Actions access. Local/operator npm access uses PAT classic; no new token authorized or issued. |

The repository and package/account APIs are different permission surfaces. Repository metadata access cannot substitute for account billing, package ACL or a real authenticated readback.

## Owner checks: view only, do not create/save/change anything

1. Sign into the owning GitHub account in your own browser. Open [Settings → Billing & Licensing](https://github.com/settings/billing). Confirm `Current plan`; in `Current metered usage` / `By products`, inspect GitHub Packages storage/data transfer and shared Actions artifact storage. Record the current billing cycle and displayed included/used/remaining values with units. Gross dollars or GB-hours alone do not establish remaining storage capacity. Do not click Upgrade, add a card or change a plan.
2. From that billing page click **Budgets and alerts**. Inspect existing account-wide or package product/SKU budgets, their scope and amount, and whether **Stop usage when budget limit is reached** is enabled. An alert-only budget is not a hard stop. Check payment-method presence only as yes/no; do not provide card details. Do not click New budget/Create/Save or toggle settings. If the UI has no applicable stop control, report that fact instead of assuming costs are blocked.
3. Open [Your profile → Packages](https://github.com/gycha0109-beep?tab=packages). If the two packages exist, open each → **Package settings** and read visibility, connected repository, **Manage access / Inherited access**, and **Manage Actions access**. Record whether K_beauty is connected, inherits permissions, and has Actions access/read or write. If absent, report `NOT_CREATED`; there is no existing per-package ACL to inspect before publication. Do not publish a test package or change visibility/inheritance/access. Do not treat an unauthenticated404 as absence.
4. Open K_beauty → **Settings → Actions → General**, view **Workflow permissions** and **Approval for running fork pull request workflows from contributors**. Record current choices; do not change them. No credential values or secret-list contents are needed.

Reply with only non-secret facts: account plan, remaining Packages/shared storage, remaining monthly transfer, applicable budget amount/scope and stop-usage state, payment method present yes/no, package status/visibility/inheritance/Actions access, and fork approval mode. Existing owner authorization already covers this viewing; no new token or permission is required to report these facts.

## Private packages linked to a public source repository

[GitHub access documentation](https://docs.github.com/en/packages/learn-github-packages/configuring-a-packages-access-control-and-visibility#ensuring-workflow-access-to-your-package) explicitly warns that granting a public repository Actions access to private packages can let its forks access them. Repository linkage, package visibility, human ACL and Actions access are separate properties. Default-private publication or an anonymous401/404 alone does not prove fork isolation.

Do not automatically grant `K_beauty` broad Actions access or enable repository inheritance as a consequence of target selection. Before publication, inspect the actual inheritance/access model and fork settings. `publishConfig.access=restricted` is not a GitHub account ACL enforcement proof. The dormant operator's private metadata and anonymous/unprivileged readback checks remain necessary but do not by themselves prove fork token isolation.

Candidate authentication approaches to decide after these observations:

- **GITHUB_TOKEN, packages:read:** short-lived and GitHub-recommended for Actions; avoid persistent PAT and qualifying Actions downloads have no transfer charge. Requires actual package Actions access and a validated trust boundary. Do not expose a private-package token to unreviewed PR code, install lifecycle scripts or reusable workflows controlled by an untrusted actor.
- **Protected owner-triggered installer using read-only PAT classic:** can avoid broad public-repository package token grants if the actual package ACL/inheritance supports that arrangement. Keep the secret in a protected environment; run only reviewed immutable commits, never arbitrary fork checkout or `pull_request_target` execution of PR code. This is a possible later design, not a verified current configuration or token-issuance request. PAT authentication has different transfer charging rules.
- **Private installer repository:** another isolation option requiring separate creation/access approval. Not created or selected here.

No active workflow authentication is changed in this read-only task. The next access/secret/configuration action requires a concrete reviewed proposal and separate owner approval; if the observed public-repository inheritance cannot preserve privacy, resolve that before publication.

## Size-based operating estimate

Verified scoped archives total **450,440 bytes** (braces14,667 + forge435,773): about0.450MB per retained pair. Ten retained pairs are about4.504MB;1,000 complete external/local downloads are about450.44MB before metadata, notices, other artifacts, retries and caches. These are payload estimates, not GitHub billing-meter forecasts. Candidate notices/SBOM/source/build/APK retention also consumes storage where retained; the account's other projects may dominate usage.

[Official included usage](https://docs.github.com/en/billing/concepts/product-billing/github-packages): Free500MB storage/1GB monthly transfer; Pro2GB/10GB. Storage allowance is shared with Actions artifacts. Appropriate Actions `GITHUB_TOKEN` downloads do not count toward package transfer usage. A valid payment method can permit billable overage; no payment method blocks usage at exhausted quota. Budgets only block when the applicable stop-usage setting is actually enforced. Paid unit prices are not estimated from an unverified plan or historic price; use GitHub's current billing calculator if paid operation is later proposed.

Incremental cost could be **$0 only after confirming sufficient remaining allowance and enforced no-spend controls**. Current actual remaining allowance and cost exposure are UNKNOWN, so no $0 operating guarantee or paid release authority is given. No plan/server purchase, fee, settings change, token, upload or package installation occurred during this preflight. Verdaccio remains unapproved.

## Security / CI continuity

Last implementation HEAD12512c84bfeb43ed9d3fff22fcc7166baeae47b4, [CI38696879808](https://github.com/gycha0109-beep/K_beauty/actions/runs/38696879808):59 tests, CodeQL, producer/replay PASS with preserved package/notice hashes. Original full HIGH22/production HIGH19/CRITICAL0 gate FAIL remains; registry selection does not fix it. Device/API/Auth/live registry readback NOT_RUN. This read-only report changes documentation only; no repeat full graph/Android/PIE CI is warranted and the completed monitor remains PAUSED.

Primary references: [npm registry/authentication](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry), [billing](https://docs.github.com/en/billing/concepts/product-billing/github-packages), [view account usage](https://docs.github.com/en/billing/how-tos/products/estimate-spending), [budget stop versus alerts](https://docs.github.com/en/billing/how-tos/set-up-budgets), [package ACL/Actions/forks](https://docs.github.com/en/packages/learn-github-packages/configuring-a-packages-access-control-and-visibility).
