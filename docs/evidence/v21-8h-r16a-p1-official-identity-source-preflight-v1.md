# V2.1-8H-R16A — P1 공식 제품 식별·출처 정합성 사전검증

## 종료 판정

`R16A_P1_SOURCE_PREFLIGHT_READY3_HOLD1_DEFERRED7`

R8 우선순위 큐의 **P1 11개를 Production 읽기로 전수 대조**하고, 큐 순서 6~9번 **4개를 공식 브랜드 SKU 중심으로 집중 조사**했다. 이 문서의 `READY`는 **공식 제품명·KR 용량에 대한 연구 판정**이며 Subject 신규 등록이나 Product Fact 확정 승인이 아니다.

| 결과 | 건수 | 의미 |
|---|---:|---|
| READY | 3 | 제품별 브랜드 공식 상세에서 카탈로그 이름·용량 직접 일치 |
| HOLD_PRESENTATION | 1 | 기존 160ml 범위가 세트로 표시되며 단품 정합성 미해결 |
| DEFERRED_P1_RESEARCH | 7 | 인벤토리·기존 URL 유형만 점검; 브랜드 신원 근거는 이번 단위에서 미조사 |
| 합계 | 11 | R8 P1 고정 순서 보존 |

## 공식 출처 조사 — 선두 4개

### #6 에스네이처 아쿠아 스쿠알란 수분크림, 카탈로그 160ml — HOLD

- [브랜드 60ml 단품](https://snature.kr/product/detail.html?product_no=74) — 공식몰 단품 60ml
- [브랜드 80ml 단품](https://www.snature.kr/product/detail.html?product_no=151) — 공식몰 단품 80ml
- [현재 바인딩된 화해 상품](https://www.hwahae.co.kr/goods/45194) — `80ml 더블+세럼 10ml 세트`, 가격 표기 기준 `160ml`

새롭게 발견된 중요한 정합성 문제: 카탈로그의 `size_ml=160`은 **160ml 단일 용기라는 증거가 아니며**, 연결된 화해 상품은 **80ml 용기 2개 + 별도 세럼 10ml 구성**으로 표시된다. 공식 브랜드에서 160ml 단일 SKU를 확인하지 못했고, 카탈로그 행의 의도가 세트인지 단품인지 통제된 정정 절차도 실행하지 않았다.

**판정:** `HOLD_PRESENTATION` / `CATALOG_160ML_EQUALS_RETAILER_DOUBLE_BUNDLE_NOT_BRAND_CONFIRMED_SINGLE_SKU`. 기존 `PRESENTATION_SCOPE_UNRESOLVED` HOLD는 해제하지 않는다. 160을 80으로 임의 변경하거나 두 용기의 총량을 새 단품 SKU로 만들지 않는다.

### #7 이니스프리 비자 시카 밤 EX, 40ml — READY (연구 수준)

- [이니스프리 공식 상세](https://m.innisfree.com/kr/ko/dp/product/34622?inmPrdCatCd=UA)
- 공식 상품 제목에서 정확한 **비자 시카 밤 EX (40mL)** 표시를 확인했다.
- 브랜드 설명에서 농축 밤 제형과 스팟 케어 문맥도 확인했으나, R16A는 Product Fact 연구 단계가 아니므로 `primary_use_role`이나 `barrier_support_claim` 값으로 전용하지 않는다.
- **다음 게이트:** 현재 SKU/변형 동일성과 출처의 재현 가능한 캡처를 확인한 뒤 R16B 판정.

### #8 아누아 PDRN 히알루론산 100 수분 크림, 60ml — READY (연구 수준)

- [아누아 공식 상세](https://www.anua.kr/product/detail.html?cate_no=83&display_group=1&product_no=402)
- 브랜드 고시정보에서 공식 상품명과 **60mL**, KR 제조/판매 주체를 확인했다.
- 일반적인 `피부에 골고루 펴 바름` 문구는 `full_face` 확정 근거가 아니다.
- **다음 게이트:** 현재 변형 연결·정규화된 출처 스냅샷 검증.

### #9 에스네이처 아쿠아 오아시스 수분 젤크림, 80ml — READY (연구 수준)

- [에스네이처 공식 상세](https://www.snature.kr/product/detail.html?cate_no=0&display_group=0&product_no=99)
- 브랜드 공식몰이 제품명과 **80ml** 용량을 직접 표시한다.
- 기존 바인딩 URL은 [화해 카테고리 랭킹](https://www.hwahae.co.kr/rankings?english_name=category&theme_id=4199)이며, **특정 SKU 상품 상세 URL이 아니다**.
- **다음 게이트:** 공식 상세 캡처·변형 비교 후 별도 통제된 Source Binding 보수 판단.

## 나머지 P1 7개 인벤토리 — 공식 제품 근거 미판정

| 큐 번호 | 상품 | 관측 상태 |
|---|---|---|
| 10 | 코스노리 판테놀 베리어 에멀전 | 화해 제품 링크. 1차 자료 미검증 |
| 11 | 이즈앤트리 알로에 수딩 젤 | `source_name=hwahae`이나 URL은 `isntree.com` 공식 도메인. 촉촉한 타입 SKU 분리 조사 필요 |
| 12 | 아비노베이비 더멕사 아토 나이트타임 밤 | 카탈로그 용량 null. 화해 URL 연결만 존재 |
| 13 | 그린핑거 판테딘 엠디 더마 수딩젤 | 기존 `FIRST_PARTY_SKU_AUTHORITY_MISSING` HOLD. URL은 다나와이고 `source_name=hwahae` |
| 14 | 일리윤 세라마이드 아토 수딩젤 | URL은 올리브영인데 `source_name=hwahae` |
| 15 | 디에이이펙트 포스트케어 밤 | 화해 제품 URL. 1차 자료 미검증 |
| 16 | 키엘 울트라 훼이셜 베리어 스틱 밤 | 카탈로그 용량 null. 화해 URL 연결만 존재 |

**바인딩 메타 불일치 3건(#11, #13, #14)**, 상품 상세가 아닌 랭킹 URL 1건(#9)을 식별했다. 바인딩의 `resolved` 상태는 외부 키의 연결 상태일 뿐, 공식 제품 신원·Fact 검증 완료를 의미하지 않는다. **바인딩 DB 직접 변경 0건.**

## Production 현황 및 경계

프로젝트 `bygrczggxfuisupcevaz`에서 조회한 P1 11개는 전부 다음 상태다.

- `product_fact_subjects` 0개
- `catalog_trust_intake` 11건, `identity_state=SUBJECT_CREATION_REQUIRED`, `trust_state=REVIEW_REQUIRED`
- `barrier_support_claim` / `primary_use_role` Research Task 총 22건, 전부 `REVIEW_REQUIRED`, attempt=0
- P1 두 Fact의 Fact Instance 0개

R16A에서 Supabase 쓰기, Product Catalog 용량 변경, Subject 등록, Evidence/Fact/Review 변경 **모두 0건**. 기존 ZEROID HOLD, R15B 불충분 Fact 4건, 기존 P1 역사적 HOLD 전부 보존했다.

PDA 비수치 경계, 164개 후보 × 12개 시나리오 = 1,968개 비교 기준도 변경하지 않았다.

## 증적의 한계

공식몰 본문과 검색 인덱스에서 직접 확인 가능한 상품명·용량·표현 범위를 조사했다. 외부 페이지의 원본 응답 바이트는 저장하지 않았으므로 해시가 존재한다고 기재하지 않았고, 리뷰나 인접 제품 문구를 동일 SKU Fact로 승격하지 않았다. 향후 R16B에서는 동일 상품별 1차 문서 캡처·인증·변형 확인을 독립적으로 수행한다.

## 다음 게이트

`V2.1-8H-R16B_P1_OFFICIAL_IDENTITY_AUTHORITY_REVIEW`

1. **READY 연구 후보 3개**(이니스프리·아누아·에스네이처 젤크림)의 현재 KR SKU, 변형, 원문 캡처 및 Identity Authority 검증
2. **HOLD 1개**(에스네이처 수분크림 160ml)의 단품/묶음 범위 불일치를 해소할 공식 근거 확보; 미확보 시 HOLD 유지
3. **Deferred 7개**는 별도 후속 조사 배치. 다른 후보가 준비돼도 이 7개의 완료를 기다릴 필요 없음
4. 적합한 Identity Authority가 확정되면 *별도의* R16C Subject preflight를 시작할 수 있으나, R16A 자체는 Registry/Source Binding/Subject/Fact/Recommendation 쓰기를 승인하지 않음

## 검증 산출물

`evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p1-official-identity-source-preflight-v1.json` 및 `scripts/product-evidence/verify-barrier-support-p1-official-identity-source-preflight-v1.mjs`.
