# R16I-R4 — owner-VERIFIED evidence / D8C field decision preflight (2026-10-14 KST)

> Track: taxonomy-ai · PR #1255 · #1204 · Security #1208 · **READ-ONLY CANDIDATE / NO PRODUCT OR OFFER APPLY**.

## 1. Changed from the preceding checkpoint

On the connected Supabase candidate project, the two seller captures now have distinct human **VERIFIED** verdict rows:
- Official manufacturer 80ml single: verified on 2026-10-14 12:14:30 KST; observed checkout total **24,500 KRW**.
- Hwahae goods #45194 double 80ml + promotional 10ml serum: verified on 2026-10-14 12:14:50 KST; observed checkout total **29,900 KRW**.

Read-only checks confirmed both verifier memberships are active OWNER, each signed source image still exists in private Storage, capture dates meet the D8D 30-day validity window, and exact source URL/selected option agree with the stored seller keys. The evidence source rows themselves intentionally remain UNVERIFIED because verdicts live in a separate immutable table. Private image contents, hashes, user identities, storage paths and evidence UUIDs are **not** copied here.

At read time: target legacy Product still **160ml / 29,900 KRW / 1,868.75 KRW per 10ml**, frozen revision unchanged; 0 Product/Offer collisions, 0 Fact Subject collisions, 1 qualifying source binding, 1 qualifying trust intake, 0 correction proposals and 0 apply records. Correction release gate is **false**. Supabase candidate project URL alone is **not** the deployed Vercel server DB attestation.

## 2. D8D code-required field values — illustration only, NOT an approved proposal

Based on current code in `supabase/migrations/20261012181320_taxonomy_ai_r16i_d8d_transactional_apply_v1.sql`, a future owner-authorized full D8D PREVIEW would require the following **five** Product field changes for these verified checkout amounts:

| Field | Current Product value | D8D after candidate | Required separate decision |
| --- | --- | --- | --- |
| `products.size_ml` | 160 | **80** | Manufacturer 80ml unit identity vs listing bundle |
| `products.price_min` | 29,900 | **24,500** | Whether a discounted checkout may be published as the canonical Product price |
| `products.price_max` | 29,900 | **24,500** | Same policy; 35,000 KRW list price is visible in the official screenshot |
| `products.unit_price_per_10ml` | 1,868.75 | **3,062.50** | Only coherent with 80ml and 24,500 KRW; not a blanket market price |
| `products.buy_link` | Hwahae bundle #45194 | Manufacturer page #151 | Manufacturer URL not yet approved in trusted direct-link CTA policy |

The D8D PREVIEW would independently stage one separate Hwahae Offer with **seller checkout 29,900 KRW** and unresolved fact-subject scope, not a standalone 160ml Product. It does not independently approve the gifted serum SKU, its formulation, review population, source binding promotions or ranking.

**Critical policy gap:** The D8D SQL currently insists that both Product price_min/max equal the observed **24,500 KRW discounted checkout**. Owner-VERIFIED original proof confirms that screen, not price permanence nor the canonical meaning of Product price_min/max. **Do not silently treat those five values as field authorization.** The owner must decide whether this one-checkout price is a valid Product-wide value or whether the D8D contract needs revision before any proposal approval.

## 3. Next gated actions

1. Owner/operator reviews the above Product price interpretation and manufacturer purchase-link trust policy. If the field semantics are accepted, manually authors an exact before/after D8C proposal referencing **both already-VERIFIED seller proofs**. There is no proposal at this checkpoint and no AI/user identity has been impersonated.
2. OWNER makes a separate D8C decision; `APPROVE_FOR_D8D_REVIEW` only authorizes review, not production mutation. Afterward use authenticated D8D `PREVIEW` only (0 writes) and inspect exact Product/Offer projected values.
3. Production apply/merge still **HOLD**: issue #1208 mandatory package audit FAIL; security isolated replacement candidate PR #1288 remains DRAFT, original app dependency graph not cleared; deployed server DB identity unverified, gate disabled, final field/application authorization absent. No security bypass, PR merge or production data changes.

This is a read-only handoff record, not an executable SQL/apply payload.
