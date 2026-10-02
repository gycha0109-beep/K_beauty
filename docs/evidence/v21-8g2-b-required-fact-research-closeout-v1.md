# V2.1-8G2-B — Required Fact Research Closeout

## Decision

`V21_8G2_B_REQUIRED_FACT_RESEARCH_PASS_DIRECT2_INSUFFICIENT4`

8G2-B researched exactly the six frozen Registry v1 tasks for Dr.G, WELLAGE, and BRINGGREEN.

This phase is research-only. No Product Evidence, Product Fact Instance, Recommendation, or public activation write is authorized or performed.

## Result

| Product | Fact | Outcome | Proposed value |
| --- | --- | --- | --- |
| 닥터지 더모이스처 배리어.D 멀티 밤 50ml | barrier_support_claim | DIRECT_EVIDENCE_FOUND | true |
| 닥터지 더모이스처 배리어.D 멀티 밤 50ml | primary_use_role | DIRECT_EVIDENCE_FOUND | multi_area |
| 웰라쥬 리얼 히알루로닉 수딩 크림 80ml | barrier_support_claim | EVIDENCE_INSUFFICIENT | null |
| 웰라쥬 리얼 히알루로닉 수딩 크림 80ml | primary_use_role | EVIDENCE_INSUFFICIENT | null |
| 브링그린 알로에 97% 수딩젤 300ml | barrier_support_claim | EVIDENCE_INSUFFICIENT | null |
| 브링그린 알로에 97% 수딩젤 300ml | primary_use_role | EVIDENCE_INSUFFICIENT | null |

Totals:

```text
DIRECT_EVIDENCE_FOUND = 2
EVIDENCE_INSUFFICIENT = 4
IDENTITY_OR_SCOPE_BLOCKED = 0
```

## Product findings

### Dr.G — exact 50ml Subject

The exact official KR page identifies `더모이스처 배리어.D 멀티 밤 50ml` and explicitly calls it a moisturizing-coating **barrier** multi balm.

- `barrier_support_claim`: direct official product claim.
- `primary_use_role`: official usage instruction enumerates face, around the mouth, elbows, heels, nail cuticles, and other dry face/body areas. This is mapped to Registry v1 `multi_area`, consistent with existing governed multi-area usage semantics.

### WELLAGE — exact 80ml Subject

The exact official KR page and product-detail images establish moisture replenishment, oil-water balance, cooling/soothing, and surface-moisture coating.

- `barrier_support_claim`: hydration / surface-moisture coating is not silently promoted into a skin-barrier claim. No product-specific barrier claim or barrier measurement was established.
- `primary_use_role`: the indexed official page points to the detail view for usage, but the reviewed official detail material does not establish a v1 usage-role enum. Cream form or `all skin types` is insufficient to infer `full_face`.

### BRINGGREEN — exact 300ml Subject

CJ Olive Young is the brand owner and first-party commerce authority for BRINGGREEN. The exact product is current, and official material places it in a cooling/soothing context.

- `barrier_support_claim`: cooling/soothing is not equivalent to barrier support; no product-specific barrier claim or measurement was established.
- `primary_use_role`: no explicit usage-area instruction sufficient for the v1 enum was exposed by the reviewed first-party sources. Third-party copied usage disclosures remain discovery-only.

## Frozen source locators

- Dr.G exact product: `https://www.dr-g.co.kr/item/4688`
- WELLAGE exact product: `https://wellage.co.kr/product/%EB%A6%AC%EC%96%BC-%ED%9E%88%EC%95%8C%EB%A3%A8%EB%A1%9C%EB%8B%89-%EC%88%98%EB%94%A9-%ED%81%AC%EB%A6%BC-80ml/1769/`
- WELLAGE official detail image: `https://www.wellage.co.kr/detail/ha_soothing/ver2/sd_02-2.jpg`
- WELLAGE official detail image: `https://www.wellage.co.kr/detail/ha_soothing/ver2/sd_08.jpg`
- BRINGGREEN first-party commerce: `https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000215502`
- BRINGGREEN brand-owner page: `https://corp.oliveyoung.com/ko/business/brand/bringgreen`
- BRINGGREEN brand-owner press release: `https://corp.oliveyoung.com/ko/news/139?pg=2`

Each canonical source capture is frozen in the JSON research artifact and verified by SHA-256.

## Boundaries preserved

```text
Product != Product Fact Subject
Evidence != Fact
Fact != Decision Axis
Fact adoption != Recommendation activation
missing != false

Registry = product-fact-registry-cross-category-v1
Registry v2 = excluded
Evidence DB writes = 0
Fact Instance writes = 0
Recommendation writes = 0
publicActivation = false
```

## Next gate

`V2.1-8G2-C_REQUIRED_FACT_RESEARCH_RUUVE_SCINIC_4_TASKS`

No Evidence ingest or Fact confirmation is authorized by this closeout.
