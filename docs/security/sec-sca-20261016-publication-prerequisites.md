# Private publication prerequisites — 2026-10-16

The owner has authorized private publication once actual prerequisites are met. Do not ask for that same general approval again. **OAEP full applicable BSD conditions remain unresolved**; this document is an execution guide, not their waiver. No token needs to be created merely to repeat research while this remains a blocker.

## Minimum credential action when the license blocker is resolved

GitHub → profile avatar → **Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token → Generate new token (classic)**. Direct viewing path: https://github.com/settings/tokens . Use a short expiry appropriate to the release window and an owner publisher token with **write:packages / read:packages**. Do not add delete:packages, administration or broad repository scopes for these public-source, granular private packages. Review the actual selected scopes before creating. The operator uses separate, disposable npm configuration; do not paste a token into chat, commit a token or add it to the public project .npmrc.

A genuinely different unprivileged GitHub identity with a valid token and no package grant is needed for the existing authenticated-denial check. A second owner token or an invalid token does not prove denial to a valid unauthorized user. This identity is a technical access probe, not an independent legal reviewer. Do not create an account/token or grant access automatically.

Inject credentials only through an approved secret mechanism into the isolated Linux operator as NODE_AUTH_TOKEN and SCA_UNPRIVILEGED_TOKEN. Trust policy, owner-held Ed25519 signing material and externally pinned SCA_TRUST_POLICY_SHA256 must be real, not synthetic test keys. Preserve the one-owner/four-responsibility policy. A human instruction recorded in a document is not a cryptographic signature.

Official scope/authentication references: [GitHub npm registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry), [Packages permissions](https://docs.github.com/en/packages/learn-github-packages/about-permissions-for-github-packages). Classic tokens have broader account reach than a package-specific credential: keep expiry short and revoke the publisher credential after the operation. No token is issued or credential stored by this change.

## Already implemented operator; no new publisher

Use scripts/security/publish-approved-sca-scoped-candidate.mjs, not the legacy unscoped publisher. Supply --original-bundle, --candidate, --approval, --signatures and --trust using reconstructed exact verified artifacts and real signed final material. The default is signed offline dry-run; --execute-approved-upload is the deliberate live boundary. Do not execute either path by replacing rightsReview.unresolved with an empty list while OAEP terms remain unsupported.

The existing bootstrap operator requires both names absent before first upload, exact candidate/derived-license-packet binding, in-tarball complete notices, expiry/trust/signature/operational controls, immutable versions and a no-charge decision. It publishes owner-private/unlinked, reads back exact bytes and server private metadata, checks anonymous and valid-unprivileged denial and stops on any failure. Partial success does not promote the app, overwrite versions or automatically delete packages. Initial success is only PRIVATE_UNLINKED_ONLY / HOLD_OWNER_ACTION_NOT_RUN.

## Account controls and final access

Read-only UI on 2026-10-16 reconfirmed Packages usage blocking and no published owner packages. Account-wide inheritance remains enabled and unchanged; unlinked bootstrap avoids needing to change that default. No claim is made that free shared-storage space is known or that a public source repository makes private package usage free. Recheck usage/blocked spending immediately before execution, and stop on exhausted quota instead of enabling payment.

After authorized publication, inspect each package's Package settings: visibility private, no inherited source permissions, owner-only human access and no unexpected Actions/Codespaces grants. Connect K_beauty later retaining the existing ACL; recheck visibility and effective ACL. Source linkage is separate from Manage Actions access. A broad public-repository grant is not proof of fork exclusion; do not enable it automatically. Actual service checks remain NOT_RUN.

Only after these real readbacks/access checks, use the existing isolated full-graph harness for approved-registry installation, aliases/overrides/nested byte census, original-name audit, consumer tests, web/Expo/Metro/Android and independent replay. Product lockfiles/main/production remain untouched under this instruction; device/API/Auth tests remain NOT_RUN where no environment is supplied.
