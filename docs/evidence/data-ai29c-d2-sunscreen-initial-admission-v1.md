# DATA-AI29C-D2 — Sunscreen Initial Admission Authority v1

## 결론

D2는 기존 generic `initial-admission-grant-policy-v1`을 확장하지 않는다.

별도 권위:

`sunscreen-initial-admission-grant-policy-v1`

Positive decision:

`SUNSCREEN_INITIAL_ADMISSION_GRANT`

의 의미는 오직 다음과 같다.

> 비-legacy canonical sunscreen이 향후 기존 Recommendation candidate pipeline에 진입할 수 있을 만큼 제품 identity, 보호 Product Fact, sunscreen semantic authority가 갖춰졌다.

이 Grant는 safety, efficacy, recommendation, score, Top Pick, Production activation을 뜻하지 않는다.

## Production authority baseline

기준 main:

`2fc78facd820b9cc3033aedb43b9148eb57d0665`

Production Supabase:

`bygrczggxfuisupcevaz`

D1 primary 5종 모두 다음을 충족한다.

- canonical UUID
- `catalog-taxonomy-v1` sunscreen shadow assignment
- exact current Product Fact Subject
- `spf_value` Current
- `uva_label` Current
- `uv_filter_type` Current
- 세 Product Fact 모두 `supported / product_specific_primary / high`
- D1B semantic envelope ready
- category_slot = sunscreen established
- semantic uv_filter_type와 governed Current Fact 일치

결과:

`5/5 SUNSCREEN_INITIAL_ADMISSION_GRANT`

## Required Product Facts

D2 admission-critical Product Fact는 정확히 세 개다.

1. `spf_value`
2. `uva_label`
3. `uv_filter_type`

각 Fact는:

- exact current Subject에 바인딩
- Current
- non-stale
- semantic_status = supported
- authority_ceiling = product_specific_primary
- confidence = high 또는 medium
- frozen registry/proposition serializer lineage
- fact instance / proposition / confirmation identity 존재

를 요구한다.

`water_resistance_duration`은 D2 requirement가 아니다.

Water axis는 계속 HOLD이며 SPF/UVA admission을 막지 않는다.

## Canonical taxonomy

Product row의 legacy `category` null을 임의로 채우지 않는다.

D2는 다음 canonical taxonomy assignment를 직접 요구한다.

- taxonomy: `catalog-taxonomy-v1`
- entity kind: cosmetic
- domain: skincare
- recommendation family: sunscreen
- category: sunscreen
- assignment state: shadow

현재 v1은 이 exact lineage만 허용한다. 후속 taxonomy lifecycle/version은 별도 compatibility review 없이 자동 승인하지 않는다.

## Semantic authority

D2는 D1B `sunscreen-recommendation-semantic-projection-policy-v1`을 사용한다.

Admission에는:

- 12/12 field가 최소 reviewed
- exact single Subject
- admission core `category_slot`, `uv_filter_type` established

가 필요하다.

반면 `sensitivity_safe`, `irritation_risk`, `pilling_risk` 등 optional/contextual field가
`conflict` 또는 `reviewed_not_established`라는 이유만으로 admission 전체를 막지 않는다.

그 uncertainty는 D3에서 해당 scoring feature를 fail-closed로 gate해야 한다.

즉:

`admission permission != scoring permission`

## Existing generic policy invariance

기존 generic policy의 sunscreen 분류는 그대로 유지한다.

`INITIAL_ADMISSION_AUTHORITY_INSUFFICIENT`

D2는 이를 `INITIAL_ADMISSION_SUPPORTED`로 바꾸지 않는다.

향후 composition은 별도 단계에서:

```text
legacy frozen member
OR valid generic INITIAL_ADMISSION_GRANT
OR valid SUNSCREEN_INITIAL_ADMISSION_GRANT
→ candidate admission
```

형태로 다룬다.

## Runtime boundary

D2에서는 Production candidate runtime을 연결하지 않는다.

고정 invariants:

- Production candidate admission wiring = NO
- Product source mutation = NO
- Product row backfill = NO
- Recommendation scorer change = NO
- Recommendation ranking change = NO
- outdoor_exposure Production rankable = NO
- public activation = NO

다음 단계 D3가 D2 Grant 제품만 별도 integrated shadow projection으로 소비한다.
D3에서도 raw Product null field를 legacy fallback materializer에 넣으면 안 된다.
