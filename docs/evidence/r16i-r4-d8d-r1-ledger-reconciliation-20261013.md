# R16I-R4-D8D-R1 — Migration ledger reconciliation (2026-10-13)

> Track: taxonomy-ai · Issue: #1204 · No Production Product / Offer / Subject writes · Release gate remains OFF
> Base main: `7b9b5927f027d2138b5a4eb09f143cad92f36edc`

## Verified baseline (read-only)

- Connected Supabase candidate: `bygrczggxfuisupcevaz`. This is **not** yet independently attested to be the DB used by the Production Vercel server.
- Supabase `supabase_migrations.schema_migrations`: one applied entry for semantic name `taxonomy_ai_r16i_d8d_transactional_apply_v1`, applied version `20261012181320`, one statement.
- GitHub main migration SQL was at `20261012190000_taxonomy_ai_r16i_d8d_transactional_apply_v1.sql`; the complete applied ledger statement and repository SQL **matched exactly**, 20,600 JavaScript UTF-16 code units / SQL text characters (direct full-text equality).
- `20261012190000` was also used by TRUST's `trust_p2c_visible_identity_dispositions_v1`, causing Database Integration Authority `#38228827854` to fail with **migration version collisions changed**, rather than with a D8D SQL/schema error.
- The D8D release gate `admin_r16i_correction_release_gate_v1.enabled=false` in the candidate DB. Product ID `b639c8b4-6a61-440e-b4db-fac7381593ff` remained 160ml / 29,900 KRW with no mapped Offer. Applied migration does not itself perform Product / Offer updates.
- RPC contract in that candidate DB: `r16i_d8d_apply_v1` is SECURITY INVOKER, `r16i_d8d_rollback_v1` is SECURITY DEFINER, both owned by postgres, `search_path=''`, callable by service_role but not anon/authenticated. These are catalog operation functions and do not themselves establish Vercel runtime DB identity.
- Vercel Production alias `k-beauty-two.vercel.app` resolves to READY deployment `dpl_38DyxMPoJDzMWpaUSjDvvZWrF8Fm`, commit `8bfd425e0fc28238a71cb25f9dddbe65a5cc0074`. New main commits may not yet be deployed. Environment-variable metadata retrieval returned HTTP 403, so the server's actual database target and apply flag could not be attested. **D8D-R1 runtime identity remains HOLD**.
- Supply-chain security `#1208`: failure `#38228827799`, expired `GHSA-vfj7-8cjw-p6xm` exception for braces. No exception extension or cross-track dependency changes.
- Main Health `#38331616991` failed on trailing whitespace in the roadmap; latest main `7b9b5927` Main Health `#38332070445` succeeded after the other track's merge. No unrelated workflow changes.

## Narrow repository reconciliation

- Rename the D8D repository migration **filename only** to `20261012181320_taxonomy_ai_r16i_d8d_transactional_apply_v1.sql`, matching the already-applied ledger. SQL content unchanged; no replay, DDL execution, or migration ledger mutation.
- Update the existing R16I D8D static verifier's file reference; no new CI workflow.
- Historical repository collision `20260824` remains explicitly governed by the existing Database Integration Authority contract. TRUST `20261012190000` remains unchanged.
- Verify resulting diff as an exact rename and verify using existing Database Integration Authority / D8D static / Main Health checks. **Do not mark the stage complete before CI results and database runtime attestation.**

## D8E1 discovery (read-only)

- Existing `scripts/verify-skin-decision-recommendation-invariance.mjs` imports `buildRecommendationProductFromSource`, `buildSkinMatchDecisionBundle`, and `normalizeRecommendationAnswers`. It asserts a historical 164-product fixture and 12 user scenarios and invokes the actual recommendation engine; this is a candidate harness, **not yet** the required before/after correction regression.
- Connected Supabase candidate current catalog count is **176 products** (read-only COUNT on 2026-10-13), not the historical 164-product fixture count. Thus historical 164×12=1,968 comparisons and present 176×12=2,112 comparisons have separate scopes; neither has been executed in this task.
- `lib/product-offer-read-path.js` uses an explicit source policy map; no `hwahae` source policy. An inserted `hwahae` Offer is therefore not admitted as a trusted direct-link/price source. When a product has offers but none is admissible, `projectProductWithOfferAuthority` sets `buy_link` to empty. This must be specifically regression-tested before D8H.
- Price separation is preserved: manufacturer 80ml single-product price must not be filled with the Hwahae bundle price; no review-source reassignment or ranking policy activation.

## Outstanding gates

1. Prove exact **deployed server runtime** DB identity using authorized server attestation; Vercel project environment metadata read is forbidden (403) to this connector. Merely inspecting this Supabase project is insufficient.
2. Confirm corresponding `BEJEWELY_R16I_D8D_APPLY_ENABLED` is not enabled without exposing its secret value; never change it as part of this reconciliation.
3. Run targeted CI for repository rename, D8D static contract, and Database Integration Authority. Keep security #1208 as independent OPEN blocker.
4. D8E1 / D8E2: confirm the availability of actual 164×12 fixture, baseline and exact same-engine before/after comparator; run 1,968 evaluated product-scenario pairs and negative-path assertions, report observed deltas rather than arithmetic-only counts.
5. D8F real seller screenshot, owner verdict and D8C decision remain absent. D8G/D8H blocked without independent Production-write approval.

## Explicit non-actions

No production Product, Offer, Subject, review, recommendation, source binding, or migration ledger writes; no release gate or environment flag changes; no owner decisions; no test fixtures mixed into Production.

Watchtower-Track: taxonomy-ai
