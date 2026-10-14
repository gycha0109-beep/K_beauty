# R16I-R4-D8F — Original checkout captures and owner review preflight (2026-10-14 KST)

> taxonomy-ai · PR #1255 · issue #1204 · security #1208 · **HOLD / NO PRODUCTION APPLY**.

## Supplied user screenshots; not OWNER verified

Two user-supplied PNG images were compared locally against SHA-256 values on connected Supabase candidate and **both exactly matched** original private evidence images. Both private Storage objects still existed. Raw screenshots, private Storage paths, uploader IDs, original hashes and any contact information are **not** committed to this repository.

- **Official S.NATURE page #151:** moisturizer 80ml x1; displayed item price 35,000 KRW, basic discount 10,500 KRW, shipping 0, payable **24,500 KRW** on this checkout-before-payment screen only. Not a universal price or actual receipt.
- **Hwahae listing #45194:** 80ml x2 moisturizer + 10ml serum gift; displayed checkout 29,900 KRW, free shipping, coupon 0, points used 0. Exact gift serum SKU is **not identified**, and review-population scope remains unverified.
- Operator-submitted captured_at metadata says 2026-10-14 09:50 KST; the screenshots do not independently attest that clock time.
- After user-directed removal of two wrongly entered metadata records, the connected candidate DB contains **two** scoped evidence rows (one per seller); both are still **UNVERIFIED**, with 0 owner verdicts, 0 correction proposals, 0 decisions and 0 applications.
- The official source PNG partially contains an email address. Treat original evidence as private; do not post raw captures in GitHub. The connected DB project ref alone does not independently attest the effective Vercel Production server DB.

## Field-specific candidate, NOT an approval or executable plan

| Candidate field | Review direction | Status |
| --- | --- | --- |
| Product size | Consider 160ml -> 80ml Product only after owner validates identity; kit is a distinct Offer with two cream units | HOLD |
| Official checkout price | Observe 24,500 KRW only in supplied context, not Product price_min/max | HOLD |
| Hwahae kit price | Observe 29,900 KRW only as the seller bundle; never transplant to a single 80ml Product | HOLD |
| Unit price per 10ml | Do not recalculate before canonical Product price/denominator are approved | HOLD |
| Purchase CTA | Official URL trust policy and kit Offer read-source policy still require review | HOLD |
| 10ml serum SKU, review counts, Fact Subject | Not resolved by checkout images; no adoption | HOLD |

## Next authorized steps

1. Authenticated OWNER opens each signed original in /admin/products/r16i-correction-review, independently compares seller option, payable amount, discount, gift conditions and source, then records distinct VERIFIED or REJECTED verdicts with scoped reasons. AI has not entered any verdict.
2. Only after both sellers have VERIFIED records, an authorized operator prepares a field-level proposal; an OWNER may decide APPROVE_FOR_D8D_REVIEW, HOLD or REJECT. This is **not** Production APPLY authorization.
3. Exact deployed DB identity, mandatory #1208 supply-chain audit, source CTA, and separate explicit Production application approval remain gates. No Product, Offer, Subject, rank, price, review, RLS, schema, auth, environment or release mutations.

## Fail-closed code hardening in PR #1255

The existing D8D database owner-decision RPC requires both VERIFIED seller identities, but the D8C proposal path previously admitted a one-seller proposal and UI implied only one evidence was needed. D8C now blocks any proposal missing either seller, verifies canonical source-key/URL pairs, and requires both seller selections in the UI. Four additional negative contract scenarios cover one seller, partial human verification, duplicate-seller identity and invalid source URL. Focused D8C test runs in the already-present offline D8F database integration CI step. These offline passes never replace original owner-verdict decisions.

**D8F:** Captures PRESENT / OWNER VERDICTS PENDING. **D8G/D8H:** HOLD; no Production mutation.
