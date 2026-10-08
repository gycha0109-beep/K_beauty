# V2.1-8H-R16B — P1 공식 SKU 식별 근거 재심사

## 판정

**`R16B_IDENTITY_AUTHORITY_REVIEW_READY2_HOLD2`**

R16A에서 조사한 P1 순서 #6~#9의 4개 카탈로그 상품을 공식 브랜드 자료 및 Production 읽기 결과로 재심사했다. **R16C Subject Identity 사전검증 대상 2개, 신원 범위 HOLD 2개.**

이 문서의 READY는 다음 **읽기 전용 신원 사전검증으로의 진입 허용**이다. Product Fact 확정·Subject 생성·추천 활성화 승인이 아니다.

| R8 순서 | 상품 | R16B 판정 | 직접 확인된 KR 근거 |
|---:|---|---|---|
| 6 | 에스네이처 아쿠아 스쿠알란 수분크림 **카탈로그 160ml** | `HOLD_PRESENTATION_SCOPE` | 공식 단품은 60ml·80ml; 기존 화해 바인딩은 80ml×2 묶음 |
| 7 | 이니스프리 비자 시카 밤 EX 40ml | `READY_IDENTITY_PREFLIGHT_ONLY` | 공식 이니스프리 상품 상세 ID `34622`, 공식 인덱스 제목의 40mL |
| 8 | 아누아 피디알엔 히알루론산**캡슐** 100 수분크림 60ml | `HOLD_NAME_VARIANT_AUTHORITY` | 공식 아누아 **크림** 제품명에는 ‘캡슐’이 없고 60ml로 표기됨 |
| 9 | 에스네이처 아쿠아 오아시스 수분 젤크림 80ml | `READY_IDENTITY_PREFLIGHT_ONLY` | 공식 S.NATURE 상품 상세 ID `99`, 80ml 동일 |

## 공식 근거 및 세부 판단

### #7 이니스프리 — R16C 사전검증 대상

- 공식: https://m.innisfree.com/kr/ko/dp/product/34622?inmPrdCatCd=UA
- 공식 페이지 본문에 **비자 시카 밤 EX** 상품·구매 옵션이 현재 표시되며, 공식 도메인 검색 인덱스 제목에 **40mL**가 명시된다.
- 제한: 정보고시의 용량 값은 이번 가시 본문에서 비어 있고, 원본 HTML 응답 바이트·공식 용량 캡처·리뉴얼 지문은 별도 확보하지 않았다.
- `READY`는 브랜드 판매 SKU의 이름·용량 정합성 연구 수준이다. R16C에서 재현 가능한 원문 아카이브와 의미론적 Subject key 충돌 검증을 수행해야 한다.

### #9 에스네이처 젤크림 — R16C 사전검증 대상

- 공식: https://www.snature.kr/product/detail.html?cate_no=0&display_group=0&product_no=99
- 같은 공식 상품 ID의 모바일 상세: https://m.snature.kr/product/detail.html?product_no=99
- 양쪽 공식 도메인 색인에서 **아쿠아 오아시스 수분 젤크림 80ml** 표시와 현재 판매 화면을 확인했다.
- 기존 화해 URL은 랭킹 목록이지 정확한 SKU가 아니다. Product Source Binding은 **아직 수정하지 않았다**.
- R16C에서 제품 변형 및 재현 가능한 원문 캡처를 고정해야 한다.

### #8 아누아 — 신규 명칭 불일치 HOLD

- 공식: https://www.anua.kr/product/detail.html?cate_no=83&display_group=1&product_no=402
- 공식 제품 고시정보: **아누아 피디알엔 히알루론산 100 수분 크림, 60 mL**
- 공식 크림 명칭에 **‘캡슐’ 없음**. 기존 카탈로그 행은 **‘피디알엔 히알루론산캡슐 100 수분크림’**.
- 별도 아누아 **피디알엔 히알루론산 캡슐 100 세럼** 제품이 존재하므로, 해당 토큰의 혼입 가능성을 반드시 구분해야 한다.
- 보조 검증: https://www.hwahae.co.kr/goods/69027 (같은 60ml 크림의 명칭 표기; 2차 자료로만 취급)
- 단지 용량과 카테고리가 일치한다는 이유로 서로 다른 명칭을 동일 SKU의 승인된 alias로 자동 정정하지 않는다.
- **해결 조건:** 브랜드가 확인한 정식 별칭, 초기 카탈로그 수집 자료, 상품 원본 식별자 연결 또는 독립 승인된 카탈로그 이름 수정 절차.

### #6 에스네이처 수분크림 — 기존 HOLD 유지

- 브랜드 공식몰 60ml: https://snature.kr/product/detail.html?product_no=74
- 브랜드 공식몰 80ml: https://www.snature.kr/product/detail.html?product_no=151
- 기존 2차 화해 상품 URL: https://www.hwahae.co.kr/goods/45194
- **카탈로그 160ml가 단일 160ml SKU라는 1차 근거가 없다.** R16A에서 확인한 80ml×2 묶음의 합산 용량이 단품 크기로 잘못 표현됐을 가능성을 유지한다.
- `PRESENTATION_SCOPE_UNRESOLVED` HOLD 자동 해제 금지. Product Catalog 수정·Subject 등록 없음.

## Production 읽기 결과

2026-10-09 재조회 시 대상 4개 모두:
- Subject **0개**
- Intake **4개**, `identity_state=SUBJECT_CREATION_REQUIRED`, `trust_state=REVIEW_REQUIRED`
- Fact Research Task **8건**, 모두 `REVIEW_REQUIRED`, 시도 0회
- Source Observation **0건**, Evidence Candidate **0건**
- 기존 Source Binding 보존

실제 DB 쓰기 **0회**. Source Binding, 카탈로그 원본, Registry, Subject, Evidence, Fact, Review, Recommendation 미변경.

## 증적의 강도

공식 브랜드 운영 페이지의 HTML/검색 인덱스 **확인 가능한 텍스트**에 근거한다. 원본 HTTP 응답 바이트를 별도 보관하지 않았으므로 **원본 소스 SHA256·content_digest·formulation_revision_digest는 null**. 검색 색인 제목을 원본 바이트의 암호학적 지문으로 가장해서는 안 된다.

R16C 사전검증을 거쳐 Subject를 생성하려면 **브랜드 원본 캡처, SKU 변형 확인, 실제 입력에서 계산된 Digest, Registry 버전 일치, idempotency·optimistic-lock 검사 및 승인된 쓰기 게이트**가 필요하다.

## 불변·후속

- R8 P1 우선순위 불변; #10~#16 7개는 미조사 상태 유지.
- 기존 R15B 불충분 Fact, ZEROID HOLD, 기존 historical HOLD 유지.
- PDA 비수치 유지, 164개 후보 / 12개 시나리오 / 1,968개 평가 기준 불변.
- R16C 후보 2개: 이니스프리 #7, 에스네이처 젤크림 #9.
- R16B HOLD 2개: 에스네이처 160ml #6, 아누아 ‘캡슐’ 명칭 #8.
- R16C는 **읽기 전용 사전검증**으로 별도 진행하며 R16B가 DB 변경을 승인하지 않는다.

관련 JSON: `evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p1-r16b-official-identity-authority-review-v1.json`
