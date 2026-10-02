# V2.1-8G2-C — Required Fact Research Closeout

## Decision

`V21_8G2_C_REQUIRED_FACT_RESEARCH_PASS_DIRECT0_INSUFFICIENT4`

8G2-C researched exactly the four remaining frozen Registry v1 tasks for ruuve and SCINIC.

This phase is research-only. No Product Evidence, Product Fact Instance, Recommendation, or public activation write is authorized or performed.

## Result

| Product | Fact | Outcome | Proposed value |
| --- | --- | --- | --- |
| 러베 5중 세라마이드 아기로션 200ml | barrier_support_claim | EVIDENCE_INSUFFICIENT | null |
| 러베 5중 세라마이드 아기로션 200ml | primary_use_role | EVIDENCE_INSUFFICIENT | null |
| 싸이닉 더 심플 데일리 로션 300ml | barrier_support_claim | EVIDENCE_INSUFFICIENT | null |
| 싸이닉 더 심플 데일리 로션 300ml | primary_use_role | EVIDENCE_INSUFFICIENT | null |

Totals:

```text
DIRECT_EVIDENCE_FOUND = 0
EVIDENCE_INSUFFICIENT = 4
IDENTITY_OR_SCOPE_BLOCKED = 0
```

## Product findings

### ruuve — exact 200ml Subject

The current official product page and SKIN CARE catalog establish the exact `러베 5중 세라마이드 아기로션 200ml` SKU.

- `barrier_support_claim`: the product name declares 5-ceramide composition, but the reviewed first-party indexed text does not establish a product-specific skin-barrier support claim or barrier measurement. Ingredient naming is not promoted into a barrier proposition.
- `primary_use_role`: no explicit application-area instruction was exposed by the reviewed official text. Baby-lotion naming and SKIN CARE category placement do not justify mapping to an allowed v1 role.

### SCINIC — exact 300ml Subject

The current official product page identifies `싸이닉 더 심플 데일리 로션 300ml` and describes it as a mild-acidic moisturizing lotion. It is also current in the official lotion and sensitive/soothing categories.

- `barrier_support_claim`: moisturizing / mild-acidic / sensitive-soothing context is not equivalent to a barrier-support claim. The official lotion category separately uses explicit `장벽 강화` wording for a different product, while the exact 300ml SKU is described only as a moisturizing lotion. This absence is not converted to false.
- `primary_use_role`: no indexed official usage-area instruction was found. Lotion form and category placement are not sufficient to infer `full_face` or another allowed role.

## Frozen source locators

- ruuve exact product: `https://ruuve.kr/product/%EB%9F%AC%EB%B2%A0-5%EC%A4%91-%EC%84%B8%EB%9D%BC%EB%A7%88%EC%9D%B4%EB%93%9C-%EC%95%84%EA%B8%B0%EB%A1%9C%EC%85%98-200ml/4140/`
- ruuve official SKIN CARE catalog: `https://ruuve.kr/category/skin-care/56/`
- SCINIC exact product: `https://scinic.com/product/%EC%8B%B8%EC%9D%B4%EB%8B%89-%EB%8D%94-%EC%8B%AC%ED%94%8C-%EB%8D%B0%EC%9D%BC%EB%A6%AC-%EB%A1%9C%EC%85%98-300ml/43`
- SCINIC lotion category: `https://scinic.com/category/%EB%A1%9C%EC%85%98/108/`
- SCINIC sensitive/soothing category: `https://scinic.com/category/%EB%AF%BC%EA%B0%90%EC%A7%84%EC%A0%95/50/`

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

`V2.1-8G2-CLOSE_WAVE1_REQUIRED_FACT_RESEARCH_AGGREGATE`

No Evidence ingest or Fact confirmation is authorized by this closeout.
