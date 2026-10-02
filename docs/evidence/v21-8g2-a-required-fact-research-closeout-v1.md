# V2.1-8G2-A — Required Fact Research Closeout

## Decision

`V21_8G2_A_REQUIRED_FACT_RESEARCH_PASS_DIRECT4_INSUFFICIENT2`

8G2-A researched exactly the six frozen Registry v1 tasks for Beplain, ATOPALM, and Dr.twentyproject.

This phase is **research-only**. No Product Evidence, Product Fact Instance, Recommendation, or public activation write is authorized or performed.

## Result

| Product | Fact | Outcome | Proposed value |
| --- | --- | --- | --- |
| 비플레인 녹두 약산성 클렌징폼 160ml | low_ph | DIRECT_EVIDENCE_FOUND | true |
| 비플레인 녹두 약산성 클렌징폼 160ml | deep_cleansing | EVIDENCE_INSUFFICIENT | null |
| 아토팜 MLE 크림 스틱 밤 10g | barrier_support_claim | DIRECT_EVIDENCE_FOUND | true |
| 아토팜 MLE 크림 스틱 밤 10g | primary_use_role | DIRECT_EVIDENCE_FOUND | local_area |
| 닥터트웬티프로젝트 나인 토너 300ml | product_format | DIRECT_EVIDENCE_FOUND | liquid |
| 닥터트웬티프로젝트 나인 토너 300ml | contains_active | EVIDENCE_INSUFFICIENT | null |

Totals:

```text
DIRECT_EVIDENCE_FOUND = 4
EVIDENCE_INSUFFICIENT = 2
IDENTITY_OR_SCOPE_BLOCKED = 0
```

## Product findings

### Beplain — exact 160ml Subject remains valid

The current official KR catalog exposes the exact `[대용량] 녹두 약산성 클렌징폼 160ml` SKU.

- `low_ph`: the exact official product title itself declares `약산성`, satisfying the v1 product-specific product-claim requirement.
- `deep_cleansing`: the exact indexed official product and category text establishes cleanser identity and usage but does not provide a product-specific deep-cleansing claim or measurement. This remains unknown, not false.

### ATOPALM — exact 10g Subject

The exact official 10g page provides both required propositions.

- `barrier_support_claim`: the official page reports a product-specific human application test for skin-barrier / TEWL improvement and explicitly describes skin-barrier strengthening.
- `primary_use_role`: the official usage instruction directs application to dry **local areas** of the face and body, mapped to v1 enum `local_area`.

### Dr.twentyproject — exact 300ml Subject

The official product page and official type category confirm the exact `나인 토너 300ml` presentation.

- `product_format`: official product/type presentation supports v1 enum `liquid`.
- `contains_active`: no specific active/functional ingredient identity admissible under v1 was established from indexed official product text. No third-party ingredient list was promoted into governed evidence.

## Frozen source locators

- Beplain exact product: `https://www.beplain.co.kr/m/product_detail.html?brand_uid=43`
- Beplain official cleansing category: `https://www.beplain.co.kr/shop/shopbrand.html?mcode=001&type=Y&xcode=013`
- ATOPALM exact 10g product: `https://neopharmshop.co.kr/product/%EC%95%84%ED%86%A0%ED%8C%9C-mle-%ED%81%AC%EB%A6%BC-%EC%8A%A4%ED%8B%B1-%EB%B0%A4-10g/2166`
- Dr.twentyproject exact 300ml product: `https://dr20project.com/product/%EB%82%98%EC%9D%B8-%ED%86%A0%EB%84%88-300ml/175/`
- Dr.twentyproject official toner/mist category: `https://dr20project.com/category/%ED%86%A0%EB%84%88%EB%AF%B8%EC%8A%A4%ED%8A%B8/58`

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

`V2.1-8G2-B_REQUIRED_FACT_RESEARCH_DR_G_WELLAGE_BRINGGREEN_6_TASKS`

No Evidence ingest or Fact confirmation is authorized by this closeout.
