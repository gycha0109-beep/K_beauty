# V2.1-8H-R9 — 배리어 지원 P0 공식 제품 정체성 권위 조사

## 종료 판정

`BARRIER_SUPPORT_P0_OFFICIAL_IDENTITY_RESEARCH_READY3_HOLD2`

R8의 P0 5개만 대상으로 현재 제품명·단위 용량·시장·포뮬러 정체성의 1차 권위를 조사했다. 이 단계는 Subject 등록이나 Product Fact 연구/쓰기를 수행하지 않는다.

## 판정 기준

READY는 현재 정확한 제품과 카탈로그 단위 프레젠테이션이 브랜드 공식 또는 1차 권위 페이지에서 직접 닫힐 때만 허용한다. 2차 출처는 보조 확인만 가능하며, 1차 권위에서 빠진 용량이나 번들 범위를 대신 닫지 않는다.

## READY 3

1. 에뛰드 — 순정 판텐소사이드™ 10 시카 밤 — 50ml
   - 아모레퍼시픽 공식몰에서 현재 에뛰드 제품명과 50ml 단품을 직접 확인.
2. 마녀공장 — 판테토인 인리치드 밤 — 80ml
   - 마녀공장 공식몰에서 제품명, 80ml, 대한민국/코스맥스 제조 정보를 직접 확인.
3. 더하르나이 — 시카이드 밤 — 100ml
   - 더하르나이 공식몰 현재 상품 목록에서 시카이드 밤 100ml를 직접 확인.

READY는 배리어 지원 주장이 참이라는 뜻이 아니다. 다음 Subject 정체성 사전검증 대상으로만 이동할 수 있다.

## HOLD 2

### 아토팜 — 릴렉싱 나이트 밤

카탈로그 `size_ml=200`인데 공식몰은 100ml 단품과 100ml ×2개 세트를 동시에 판매한다. 기존 카탈로그 이름에는 세트 수량이 없고, 현재 buy_link는 100ml 단품을 가리킨다.

따라서 `BUNDLE_PRESENTATION_SCOPE_UNRESOLVED`로 HOLD한다. 번들 총량 200ml를 하나의 200ml 포뮬러 용량으로 간주하지 않는다.

### 제로이드 — 인텐시브 SOS 플러스 밤

제로이드 공식 제품 페이지에서 정확한 제품명과 현재 전성분 전체를 확인했지만, 접근 가능한 공식 텍스트에서는 40ml 표기가 확인되지 않았다. 화해 등 2차 출처에서는 40ml가 확인되지만 이를 1차 프레젠테이션 권위로 승격하지 않는다.

따라서 `FIRST_PARTY_PRESENTATION_SIZE_UNCONFIRMED`로 HOLD한다.

## 불변성

- Subject 쓰기: 0
- Evidence 연구 시작: 0
- Product Fact 판정/쓰기: 0
- Recommendation 변경: 0
- public activation: 없음
- missing != false

## 다음 단계

`V2.1-8H-R10 — P0 READY3 Subject Identity Preflight`

R10은 READY 3개에 대해서만 canonical capture와 Subject semantic key/formulation revision key를 계산하고, Production 쓰기 전 충돌·중복·기존 Subject 존재 여부를 검사한다. HOLD 2개는 자동 진행하지 않는다.
