# R16I-R4 — D8G readiness checkpoint and owner evidence handoff (2026-10-13 KST)

> Watchtower-Track: taxonomy-ai · Issues: #1204, #1208 · PR: #1255
> Status: **HOLD / NO PRODUCTION APPLY AUTHORIZATION** · Observational/read-only record only.

## 1. What was verified today

1. Vercel Production alias `k-beauty-two.vercel.app` resolves to READY deployment `dpl_8iYCmxYiynuiTtGftUQWsG3yx5JM`, GitHub `main` source commit `8f1f0559bdc4500fa064a170261df3d9b965884a`. This establishes deployment and source commit, **not database endpoint identity**.
2. The current source in `lib/supabase-admin.js` obtains the server's Supabase project URL from `NEXT_PUBLIC_SUPABASE_URL` and service credential from `SUPABASE_SERVICE_ROLE_KEY`. Deployment metadata does not disclose or attest the effective URL, and Vercel project environment inventory access has returned **403**. Therefore the actual deployed server DB identity is **NOT_ATTESTED**, notwithstanding code/config conventions or the connected Supabase client.
3. Connected Supabase candidate project `bygrczggxfuisupcevaz` read-only queries: **176** catalog Products; exact target Product `b639c8b4-6a61-440e-b4db-fac7381593ff` still 160ml/29,900 KRW (source is Hwahae #45194). For this Product: **0 captured evidence records, 0 correction proposals, 0 Product+Offer apply records**. Existing release gate `admin_r16i_correction_release_gate_v1.enabled=false`. The DB is a connected candidate, NOT verified as the Vercel Production DB.
4. Security issue #1208 OPEN. Security Draft PR #1240 OPEN/DRAFT. Its isolated real Expo 57.0.28 lock candidate still had vulnerable `braces@3.0.3` and `node-forge@1.4.0`; its raw npm production and full audits both exit nonzero. **Do not infer security clearance from source-bound diagnostics, CodeQL PASS, or expiry-extension.**
5. Exact R16I D8E2 real-engine 7,920 offline comparisons PASS (historical and synthetic fail-closed admission scopes). D8F candidate DB prestate+15 drift negatives PASS in Database Integration Authority #38341312808. Neither validates an actually verified checkout price nor deployed-server database identity.

## 2. Public seller display only — do not record as checkout price

| Seller | Exact source | Public listing observation | Required evidence still missing |
| --- | --- | --- | --- |
| Manufacturer official, 80ml single | https://www.snature.kr/product/detail.html?product_no=151 | List price 35,000 KRW and member label 24,500 KRW, public indexed page | Original selected 80ml option/SKU, stock and actual payable checkout amount for the exact purchase context |
| Hwahae, bundle | https://www.hwahae.co.kr/goods/45194 | Display 29,900 KRW for 80ml×2 + 10ml serum bundle, public indexed page | Original selected bundle option, actual payable amount and promotion terms, exact serum SKU |

These listing observations were rechecked via public search indexing on Oct 13. They are NOT authenticated user carts, order confirmations or owner-VERIFIED evidence. Never copy the 29,900-KRW bundle price into the 80ml manufacturer Product, or assume the member-discount amount applies to every purchaser. Seller listing variants may vary.

## 3. Owner-only evidence acquisition — existing implementation, no new route

Existing administrator destination: `https://k-beauty-two.vercel.app/admin/products/r16i-correction-review` (login and `admin.products.review` entitlement required; no unauthorized session bypass).

For each seller, an authorized operator must personally select the correct option, capture an unedited **original checkout-before-payment screen** including visible option, total amount and source, record timestamp and exact listing URL, and mask customer/order/payment details. Do not place an order merely for this engineering verification.

- Upload to the already-implemented **private** evidence workflow, with exact `sourceKey=official_single` or `sourceKey=hwahae_bundle`. Accepted PNG/JPEG/WebP, image max 4 MiB; metadata includes exact `sourceUrl`, `selectedOption`, claimed `checkoutPrice`, `capturedAt`, notes and original image. Keep captured private storage evidence out of public GitHub issues.
- The initial stored state is always **UNVERIFIED**. An OWNER (not the uploading user automatically) must inspect the original and issue a separate VERIFIED or REJECTED decision through the existing evidence approval screen.
- Once both sellers have valid VERIFIED evidence, the authorized operator may prepare the **field-specific Product / Offer correction proposal**; the OWNER may decide `APPROVE_FOR_D8D_REVIEW`, HOLD, or REJECT. `APPROVE_FOR_D8D_REVIEW` **is not permission to apply to Production**. The gift serum exact SKU and review population attribution remain explicitly unresolved until independently supported.
- Before any real APPLY, get a fresh PREVIEW with **0 writes**, compare immutable Product revision, verify rollback and obtain **separate explicit Production correction approval** against exact proposed Product/Offer values.

## 4. Production runtime / security gates: explicit HOLD

- **Runtime DB:** An owner with authorized Vercel project permission must inspect the *effective Production deployment* Supabase URL host/project ref **without printing or exporting key values**; compare to the candidate DB project ref, then inspect the existing owner-only GET `/api/admin/products/r16i-correction-review/apply` for serverApplyEnabled, releaseGateEnabled and application history. Source code and unrelated Supabase SELECT do not prove effective deployment settings. If these cannot be verified, maintain HOLD. Do not set any env flag or DB release gate for the purpose of checking.
- **Security:** Separate security owner must resolve #1208 via genuine audited dependency remediation, complete relevant CI, and merge the security fix under its own authorization. PR #1240's diagnostic Draft is not the fix. No temporary GHSA exception expiry extension, trust bypass, or forced green.
- **Purchase CTA:** The manufacturer #151 exact official brand URL currently falls back rather than becoming a trusted direct purchase link. The Hwahae bundle Offer does not pass the allowed source read policy. No automatic source allowlist enlargement; approved source identity and independent checkout safety review are still required.
- **Merge rule:** Keep taxonomy-ai PR #1255 OPEN while Supply Chain Security RED, and keep D8F/G/H Product/Offer mutation at zero regardless of whether other CI passes.
- **Release gate:** DB `enabled=false`; no permission to change it. Do not claim a value for the runtime `BEJEWELY_R16I_D8D_APPLY_ENABLED` flag without an authenticated server read.

## 5. Exact handoff blockers

| Blocker | State | Next authorized owner action |
| --- | --- | --- |
| Effective deployed Vercel DB identity | UNKNOWN (403 env listing) | Project owner reads nonsecret project-ref/host in effective Production settings plus authenticated server readback |
| Production server APPLY flag | UNKNOWN | OWNER GET on existing apply endpoint; do not change |
| Two original checkout screenshots | 0 saved | Human operator uploads original per-seller proof to private admin flow |
| VERIFIED seller verdict / field decision | None observed (evidence and proposals 0) | Owner reviews, records verdict, then reviews concrete Product/Offer proposal |
| Security #1208 | OPEN / audit failing | Security track owner fixes actual dependency graph and verifies green at exact commit |
| Direct manufacturer/Offer purchase authority | HOLD | Security/source policy review after source evidence |
| Production correction | NOT AUTHORIZED | Obtain separate explicit user signoff after all preceding gates |

**No Product, Offer, Subject, ranking or review production modifications. No permission/RLS/schema/environment/deployment changes. No deployment or merge.**

## 6. Continuation read-only checkpoint — 2026-10-13 14:28 KST

- **Source synchronization:** Rechecked GitHub `main@697f400436feb4e4c22254d0d4b61bebb36cd099` and PR #1255 prior HEAD `e5bf89c2e9ce4ceada9d7b2ed43dc4ae9d615332`. Disjoint TRUST P3 changes from main were integrated through verified two-parent merge `b44d982621973683e0736f27342259d0216daebf`, retaining the exact taxonomy-ai D8D/R16I files and deleting only the historical duplicate-version D8D path. Neither main nor security PR was edited.
- **Exact synchronized HEAD CI:** [Database Integration #38351385254](https://github.com/gycha0109-beep/K_beauty/actions/runs/38351385254) PASS (including isolated PG17); [Security Boundary #38351385303](https://github.com/gycha0109-beep/K_beauty/actions/runs/38351385303) PASS; [PIE #38351385656](https://github.com/gycha0109-beep/K_beauty/actions/runs/38351385656) PASS; [Main Health #38351385261](https://github.com/gycha0109-beep/K_beauty/actions/runs/38351385261) PASS; CodeQL JS/TS PASS. Supply Chain [#38351385266](https://github.com/gycha0109-beep/K_beauty/actions/runs/38351385266) had the mandatory vulnerability job **FAIL** at observed exact-HEAD check; independent security issue #1208 OPEN, security PR #1240 OPEN/DRAFT at `28fd64bffec378161be1865eae4aedf30444a02a` also has failing mandatory package audit. Nothing is waived.
- **Latest alias/deployment:** `k-beauty-two.vercel.app` now resolves to READY Production deployment `dpl_D2cMapWhKCFDsjUPy23yPTspm2az`, sourced from `main@697f4004`. It supersedes the earlier `dpl_8iYC...` deployment observation; neither ID attests the server database.
- **Live Vercel boundary:** Resolved correct project `k-beauty` (`prj_VHh3BMegmXFGwxgOJLlgFQjksmKA`, team `team_xuYA9OhCWlJETaYFOmeVodgS`). An explicitly scoped, non-decrypting project environment **metadata-only** list still returned HTTP **403 forbidden**. No environment value, project secret, runtime APPLY flag or effective server database project ref was read. **PRODUCTION_DB_IDENTITY = UNATTESTED.**
- **Connected candidate database read-only SELECT at 2026-10-13 14:27:38 KST:** `bygrczggxfuisupcevaz` candidate, target Product revision `2026-09-10T09:32:38.713599+09:00`, `size_ml=160`, `price_min=price_max=29900`, retailer `goods/45194`; `evidence=0`, `proposals=0`, `applications=0`, `offers=0`, `subjects=0`; `admin_r16i_correction_release_gate_v1.enabled=false`. Candidate identity is **not** the deployed server identity.
- **Public seller listing recheck:** Official page #151 still describes 80ml single at public 35,000 KRW / member label 24,500 KRW; Hwahae #45194 still describes 80ml×2 + serum 10ml, display 29,900 KRW. These are public/indexed listing observations only. The official checkout itself warns the final discounted payable amount is confirmed at order. No original selected-option checkout capture or independently verified gift-serum SKU was found in the existing private admin evidence table.
- **Decision:** D8F evidence/owner approval **HOLD**; D8G runtime identity/security/CTA **HOLD**; D8H live Product/Offer correction **NOT AUTHORIZED**. No backend DB/RLS/policy/env/release state change, no admin bypass and no Production write. Authenticated OWNER must obtain exact effective Production DB project-ref attestation and owner-only apply GET, plus the two original checkout captures and field-specific approvals; security owner must independently remediate the actual affected dependencies.

This checkpoint is observational. CI outcomes after any subsequent documentation commit must be checked on that new HEAD rather than inherited from `b44d9826`.

## 7. 2026-10-13 continuation — latest main/deployment and public seller-scope replay

- **Latest verified main:** `5272378c3f561407629e4c91a42d80baa1f520c3`, containing disjoint TRUST P3 template-shape work. No taxonomy R16I, security policy or Product/Offer scope overlap. Existing PR #1255 `c3f62904` exact-head CI: DB Integration + PG17, Main Health, PIE, Security Boundary and CodeQL **PASS**, Supply Chain mandatory vulnerability gate **FAIL**. Security issue #1208 OPEN and Security PR #1240 still DRAFT.
- **Deployment alias updated:** `k-beauty-two.vercel.app` resolved to READY Production `dpl_5MztRfqUfLgTYb9J9CWj5sGdCKVX` built from `main@5272378c`. This confirms deployed code origin only. The Vercel environment metadata read remains 403 and the effective deployed Supabase DB identity and runtime APPLY flag remain **UNATTESTED**.
- **New public price/review scope check:** Official 80ml listing 35,000 KRW standard / 24,500 KRW member-labeled; Hwahae 80ml×2 + serum10ml listing 29,900 KRW; indexed Hwahae displayed 43,652 reviews / 4.58 rating as of this observation. The candidate DB stores 41,475 older source-derived reviews and 160ml / 29,900 KRW; the difference is an **unresolved review-population attribution issue**, not permission to refresh or transplant it. Official selected checkout, retailer selected checkout, actual final payable prices, promotional serum SKU, review population, and owner VERIFIED evidence **still absent**.
- **Code-only negative replay:** Added price/review drift and separate URL collision cases to the existing D8F verifier. These checks do not alter review-count authority, current catalog, source binding, purchase link policy, release gate or server metadata. Latest exact-head CI must verify the additions before test-pass claims.
- **Owner action remains:** Authenticated Vercel operator independently attests effective Production DB ref and checks owner-only status GET; authorized merchant operator captures two original prepayment checkout-option screens into existing private evidence workflow; owner reviews field-specific proposals; security owner fixes #1208. **D8F/G/H HOLD**, no automatic Product/Offer apply.

