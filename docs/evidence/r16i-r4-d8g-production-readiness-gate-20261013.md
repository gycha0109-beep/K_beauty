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
