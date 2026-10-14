# Face Lab V2 — authorized catalogue bridge / current main integration

> Track: face-research
> Source: PR #1167 scoped server read bridge, ported to pinned current main `5bdfe4dc79f3a51d55c18b0064ea09ff1f26f72a`.
> Status: offline adapter and verifier only; not a Production reader, hosted storage integration, or image-provider request.

## Invariant: Product Fact Subject is not a commerce variant

The core binding `buildFaceLabCatalogProductTryOnSelection` on current main demands:

- `subject.identity_status=resolved`, `subject.current_state=current`, product/subject identity consistency.
- **Separate approved** `subjectVariantBridge` with exact `productId, subjectId, variantId, subjectVariantKey, mappingVersion, evidenceRefs` matching current subject formulation and explicit commerce variant.
- Active canonical taxonomy, category-slot mapping, eligible capability, provenance, and approved private image assets.

The scope sent to an injected `readAuthorizedAssets` now contains `productId, subjectId, variantId, subjectVariantKey, mappingVersion, slotKey`. The asset `candidateRef` is constructed with the approved commerce `variant.variantId`, **not** `subject.variant_key`. Actor identity and request-scoped selection/asset reader envelopes remain required.

## Regressions

`node scripts/verify-face-lab-v2-try-on-catalog-read-bridge.mjs` covers:

- Approved mapping succeeds when formulation Subject key `formulation-v1` differs from commerce variant `coral`; signed source image and each allowed brand swatch pass only after blob-loader bytes/hash validation.
- Missing, pending, incorrect Variant ID or stale Subject key mapping cannot obtain a successful authenticated bridge.
- Category taxonomy shadow, authorization actor mismatch, unexpected extra asset, subject-key-as-asset-Variant substitution, unapproved permission or missing assets remain denied.
- No actual backend reader, service-role secrets, unscoped bucket paths, Production SQL, network provider calls or paid generation are introduced.

The production reader implementation and permission checks (including RLS and security reviews) remain separate Security/Platform ownership gates. A green Face Lab fixture test proves only the adapter/consumer guard. It does **not** imply that real hosted catalog/asset records exist.

## PR ownership and integration

- Replacement for the current-main-incompatible portion of old PR #1167, not a second independent recommendation/scoring pipeline.
- Face Lab CI is the **only** verifier executor; the shared Product Fact data source remains taxonomy-ai responsibility.
- Once this branch passes same-HEAD CI and Security's independently owned supply-chain issues are resolved, close or explicitly supersede obsolete #1167 before integration so that both bridge copies never land.

Watchtower-Track: face-research
