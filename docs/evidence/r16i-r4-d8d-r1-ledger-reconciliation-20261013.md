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

## D8E1 — Actual executable historical replay and commerce boundary

- Original evidence fixtures are tracked in **`fixtures/recommendation-metadata/products-v1.json`** (exactly 164 rows, target Product ID included) and **`fixtures/recommendation-metadata/user-scenarios-v1.json`** (12 actual answer objects); the summary is in `evidence/recommendation-metadata-shadow/scenario-summary-v1.json`. The previous `_reference/recommendation/...` lookup was simply an alternate absent directory, **not** absence of the canonical frozen fixture.
- New focused verifier `scripts/product-evidence/verify-r16i-r4-d8e1-structural-replay.mjs` injects those files into the **real** `buildSkinMatchDecisionBundle` and source projector, processing **164×12 scored product-scenario pairs twice** (before / controlled structural after). Its executable assertions require identical 164 identities, scores, ordering, Top1, Top3, candidates, reviews, and market signals. No stub scorer, external network, live Production fixture writes, or fabricated checkout prices. This is **historical structural-isolation testing**, not full D8E2 true checkout-price shadow.
- Frozen August fixture omitted `buy_link`; the verifier explicitly reconstructs *only this historical target's* observed read-only Hwahae URL from the October product snapshot, and labels it. All 164 product semantic fields are otherwise fixture-derived.
- Price is held at **historical 29,900 solely to isolate non-price semantics**, never represented as the proposed 80ml Product's price. The structural mutation uses size=80, unit_price unknown, official URL #151. Price-sensitive and real checkout-price D8E2 remains HOLD until 2 verified merchant screenshots and approval.
- Confirmed blocker: Product source projector recognizes the existing Hwahae URL but currently does **not** recognize `https://www.snature.kr/product/detail.html?product_no=151` as an allowed official-brand direct purchase URL. Independently, `lib/product-offer-read-path.js` does not whitelist `hwahae::hwahae`; a current-but-untrusted Hwahae Offer yields empty `buy_link`, and the downstream purchase resolver falls back to Naver Shopping. **Do not silently grant Hwahae Offer authority or present Naver fallback as a verified official 80ml CTA.** This is a D8G checkout UI/authority blocker, requiring approved exact official source validation before any purchase policy modification.
- Existing Database Integration Authority workflow runs the scoped new checker as one added step. No new workflow or operations UI; no new DB tables.
- Supabase candidate Product row count `176` from read-only COUNT on 2026-10-13. Historic 164×12 cannot be described as complete current-catalog 176×12 coverage; **2,112 current pair comparison not executed**.
- Target error cases covered in this narrow replay: spoof hostname, untrusted Offer source, no unapproved Offer price promotion, exact reviews and product identities, and zero ranking/Top1/Top3 deltas. D8D duplicate/stale/rollback tests remain in existing isolated PostgreSQL 17 fixture.
- Security #1208 remains RED and Vercel runtime identity attestation remains HOLD. Even a passing D8E1 shadow does **not** authorize D8G/D8H.
