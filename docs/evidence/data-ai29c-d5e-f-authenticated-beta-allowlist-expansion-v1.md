# DATA-AI29C-D5E-F — Authenticated Beta Allowlist Expansion v1

## 현재 판정

`D5E_F_AUTHENTICATED_BETA_ALLOWLIST_EXPANSION_DEPLOYED_PROBE_REQUIRED`

D5E-E deployed main 검증은 workflow run `37601242380`에서 완료됐다.

- D5D Production probe: 4/4 PASS
- D5C internal canary: 6/6 PASS
- D5E-E four-product internal canary: 6/6 PASS
- Activation Readiness: 24/24 PASS

따라서 authenticated beta sunscreen corpus를 기존 3종에서 COSRX를 포함한 4종으로 확장할 수 있다.

## 확장 범위

```text
legacy Production sunscreen 11
+ existing governed beta target 3
+ COSRX governed target 1
= authenticated beta sunscreen corpus 15
```

D5C와 D5D source contract 자체는 변경하지 않는다.

D5E-F는 별도 exact-four contract와 service를 사용한다.

- D5C 3종 reader 재사용
- D5E-E COSRX bounded reader 재사용
- 신규 Production DB migration 없음
- 기존 D5D runtime switch 재사용
- switch scope = authenticated_product_query_beta

## Route isolation

확장 옵션을 켜는 route는 정확히 다음 하나다.

```text
/api/my/product-query-beta
```

다음 route는 기존 D5D 3-product 경로를 유지한다.

- /api/my/product-query-preview
- /api/my/product-query-production-canary

public search cutover는 없다.

## Runtime probe

```text
POST /api/internal/product-query-spf-authenticated-beta-expansion
```

- outdoor_live ×2
- non_outdoor_live ×2

총 4회 deployed main probe가 필요하다.

기대값:

- Production sunscreen = 11
- governed target grant = 4/4
- combined candidate sunscreen = 15
- outdoor SPF adjustment = 15
- COSRX SPF50 delta = +6
- UVA / Water activation = false
- persistence / Product mutation / recommendation log write = false
- public activation = false

현재는 deployed D5E-F probe 전이므로 최종 PASS를 선언하지 않는다.
