# V2.1-8H-R12 — READY3 Official Evidence Research Closeout

## 종료 판정

`BARRIER_SUPPORT_P0_READY3_OFFICIAL_EVIDENCE_RESEARCH_DIRECT1_INSUFFICIENT5`

R11B에서 등록을 끝낸 READY3 세 제품의 Registry v1 작업 6개를 공식 출처 기준으로 조사했다.

이 단계는 **연구 전용**이다.

- Evidence DB write: 0
- Fact Instance write: 0
- Confirmation write: 0
- Recommendation write: 0
- Public activation: false

## 조사 대상

| 제품 | 피부 장벽 지원 주장 | 주요 사용 목적 |
| --- | --- | --- |
| 더하르나이 시카이드 밤 100ml | 근거 부족 | 근거 부족 |
| 에뛰드 순정 판텐소사이드™ 10 시카 밤 50ml | 근거 부족 | 직접 근거: `multi_area` |
| 마녀공장 판테토인 인리치드 밤 80ml | 근거 부족 | 근거 부족 |

합계:

```text
DIRECT_EVIDENCE_FOUND = 1
EVIDENCE_INSUFFICIENT = 5
IDENTITY_OR_SCOPE_BLOCKED = 0
```

## Registry v1 기준

### barrier_support_claim

- 값 형식: boolean
- 허용 근거: `product_claim`, `measurement`
- 의미: **공식 장벽 지원 주장**
- 측정된 장벽 개선과 동일 개념으로 취급하지 않음
- 제품별 직접 근거 필요
- 누락/침묵은 false가 아님

### primary_use_role

허용값:

- `full_face`
- `local_area`
- `spot_use`
- `multi_area`
- `body_possible`

허용 근거:

- `role_declaration`
- `usage_instruction`

이 값은 사용 문맥이며 추천 가중치가 아니다.

## 제품별 판정

### 1. 더하르나이 시카이드 밤 100ml

정확한 공식 KR 제품 페이지:

`https://theharnay.co.kr/product/%EB%8D%94%ED%95%98%EB%A5%B4%EB%82%98%EC%9D%B4-%EC%8B%9C%EC%B9%B4%EC%9D%B4%EB%93%9C-%EB%B0%A4-100ml/19/`

정확한 100ml 제품 식별은 확인됐지만, 검토 가능한 텍스트에서:

- 이 제품에 직접 결합된 피부 장벽 지원 주장 없음
- 명시적 적용 부위 사용법 없음

공식 브랜드 홈에는 시카이드 라인의 진정·보습 맥락과 별도 시카이드 크림의 장벽 강화 문구가 존재한다. 그러나 **라인/형제 제품의 주장을 밤 Subject로 이전하지 않았다**.

따라서 두 작업 모두 `EVIDENCE_INSUFFICIENT`.

### 2. 에뛰드 순정 판텐소사이드™ 10 시카 밤 50ml

정확한 공식 KR 단품:

`https://www.amoremall.com/kr/ko/product/detail?onlineProdCode=110090000335&onlineProdSn=60162`

동일한 정확한 50ml 단위 2개 구성 공식 페이지:

`https://www.amoremall.com/kr/ko/product/detail?onlineProdCode=110090000337&onlineProdSn=60201`

공식 사용법은:

- 진정이 필요한 부위
- 또는 얼굴 전체
- 집중 케어 시 도톰하게 적용

을 명시한다.

이는 한 제품이 여러 적용 부위를 명시적으로 허용하는 기존 `multi_area` 판례와 호환되므로:

- `primary_use_role = multi_area`
- `evidence_class = usage_instruction`
- `DIRECT_EVIDENCE_FOUND`

로 판정했다.

반면 검토 가능한 공식 KR 텍스트에서는 제품별 **명시적 장벽 지원 주장**을 확인하지 못했다. 시카/판테놀/진정 성격만으로 장벽 주장을 추론하지 않았다.

따라서 `barrier_support_claim`은 `EVIDENCE_INSUFFICIENT`.

### 3. 마녀공장 판테토인 인리치드 밤 80ml

정확한 공식 KR 페이지:

`https://www.manyo.co.kr/goods/goods_view.php?goodsNo=1905`

KR 페이지는:

- 고농축 진정·보습 밤
- 적당량을 피부 결에 따라 골고루 바른 뒤 흡수

를 명시한다.

그러나:

- 명시적 피부 장벽 지원 주장은 없음
- 사용 부위가 얼굴/국소/몸 등으로 명시되지 않음

따라서 KR 근거만으로 두 작업 모두 값을 정할 수 없다.

ma:nyo 일본 공식 80ml 페이지에는 얼굴의 건조 부위와 입가·목·팔꿈치 등 더 구체적인 사용법이 있으나, **KR Subject에 대한 자동 시장 간 근거 이전을 금지**했다. 이 출처는 discovery-only로만 보존했다.

## 보존한 경계

```text
Evidence != Fact
Fact != Decision Axis
Fact adoption != Recommendation activation
missing != false

line/sibling claim transfer = forbidden
cross-market evidence transfer = forbidden
ingredient identity -> barrier claim inference = forbidden
soothing/moisturizing -> barrier claim inference = forbidden

Evidence DB writes = 0
Fact Instance writes = 0
Confirmation writes = 0
Recommendation writes = 0
publicActivation = false
```

## Production 불변 기대

R12는 연구 산출물만 생성하므로 Production 기준은 그대로다.

```text
Product Fact Subject = 50
Product Fact Current = 101
Fact Instance = 102
Confirmation = 102
READY3 research tasks = 6
```

## 다음 단계

`V2.1-8H-R12A — READY3 Official Source Gap Recovery`

미해결 5개 작업에 대해 공식 상세 자산/추가 1차 출처를 조사한다.

현재 직접 근거 1건도 아직 Evidence ingest가 승인되지 않았다.
