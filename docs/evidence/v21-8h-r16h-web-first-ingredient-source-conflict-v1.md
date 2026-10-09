# V2.1-8H-R16H — 웹 우선 공식 전성분 교차검증

**종료 판정: `R16H_WEB_FIRST_FORMULATION_EQUIVALENCE_UNPROVEN_SOURCE_CONFLICT_HOLD2`**

2026-10-09 공개 자료를 실사했다. R16G까지 확보한 국내 공식 40ml/80ml 전성분과 추가로 검색한 공식 해외·판매처 자료를 나란히 대조했다. 웹 검색으로 확인된 문자열을 **현재 국내 제조 로트의 직접 처방 권한**으로 바꾸지 않는다.

## 1. 이니스프리 비자 시카 밤 EX 40ml ↔ 70ml

| 구분 | 출처 | 검증 결과 |
|---|---|---|
| 한국 공식 40ml #34622 | https://m.innisfree.com/kr/ko/dp/product/34622?inmPrdCatCd=UA | R16D/R16E 원본 HTML에서 26개 전성분 확인 |
| 한국 공식 대용량 70ml #34623 | https://m.innisfree.com/kr/ko/dp/product/34623 | 대용량 SKU 및 70ml 판매 존재. 이번 단계에서 **원문 전성분 미수집** |
| 호주 공식 40ml | https://au.innisfree.com/products/bija-cica-balm-40ml-new | 26개 전성분 중 `Torreya Nucifera Seed Oil` 표기 |
| 말레이시아 공식 70ml | https://my.innisfree.com/products/bija-cica-balm-ex-70ml | 26개 성분으로 보이는 목록에 `Birch Seed Oil (1,000 ppm)` 표기. 제목은 **70ml**이나 제품정보 용량은 **40 mL** |

**중요:** 해외 두 목록은 첫 성분들, 구성과 배열에 유사성이 있지만 성분명 불일치(`Birch Seed Oil` ≠ `Torreya Nucifera Seed Oil`로 취급)와 말레이시아 공식 페이지 내부의 용량 모순이 있다. 이를 26/26 일치, 동일 처방, 2023 리뉴얼 확정이라고 주장하지 않는다. YesStyle의 `2023 renewal version` 문구는 **판매처 설명**이며 제조사 공식 변경일이 아니다.

국내 40ml과 70ml의 정확한 전성분 순서 비교를 위한 **읽기 전용 수집기** `capture-barrier-support-p1-r16h-innisfree-kr-comparison-v1.mjs`를 구현했다. 소스는 HTML 원본 SHA, 공식 상품번호, 용량이 포함된 title, 직렬화된 공식 전성분 고시 필드를 검사한다. `1,2-헥산다이올`, `1,000ppm` 내부 쉼표가 목록 항목을 잘못 증가시키지 않도록 분할한다.

**이 단계에서 실제 한국 70ml 원본 HTML의 유효 전성분이 수집됐다고 주장하지 않는다.** 별도 호스팅 온라인 실행 및 수집 증적이 있어야 한다.

## 2. 에스네이처 수분 젤크림 80ml ↔ 90ml

국내 공식 80ml 고시 이미지 `gel80ml_info.jpg`: 25개 성분, 순서의 앞부분은 **정제수 → 글리세린 → 부틸렌글라이콜 → 1,2-헥산다이올 → 블루아가베잎추출물**이다. 원본 SHA-256:
`4d62a3be8996ef8b2ab52421cc2f153e63eb20c73f453cac95c0f3d583b696c6`.

서로 다른 **90ml 판매처** 고시:
- https://funchreward.com/product/에스네이처-아쿠아-오아시스-수분-젤크림-90ml/549 — 젤크림 목록 25개, **정제수 첫 번째**. 80ml 공식 이미지와 초기 성분 순서 일치.
- https://item.gmarket.co.kr/Item/ItemDetailV2?goodsCode=4671825529 — 90ml 목록에서 **블루아가베잎추출물(500,000ppm) 첫 번째**, 그다음 정제수.

이 판매처 차이는 전성분 **표기 충돌**이다. 리뉴얼·성분 배합 변경의 증거라고 확정할 수 없다. 90ml와 80ml가 동일한 처방인 경우에도 90ml의 온라인 정보고시가 서로 충돌할 수 있다. 브랜드 공식 90ml 제조 로트·전성분 고시의 확인 전까지 어느 목록도 최종 신원 근거로 채택하지 않는다.

## 3. 생산·Subject 승인 경계

- `formulation_revision_key`: 두 제품 모두 **null**.
- `subject_semantic_key`: 두 제품 모두 **null**.
- 한국 70ml 공식 전성분 원본 **미검증**.
- 에스네이처 90ml 브랜드/제조사 공식 처방 적용 근거 **미검증**.
- R16B HOLD, ZEROID HOLD, 비수치 PDA 164×12=1,968 평가 불변.
- Subject 등록·Task Claim·Fact/Source Binding·Production DB·추천/랭킹 쓰기 **0건**.

## 4. 다음 작업

**`R16H_R2_CAPTURE_KR_70ML_AND_RECOVER_OFFICIAL_90ML_PANEL`**

1. 한국 공식 이니스프리 #34622/#34623 HTML을 동일한 실행 환경에서 확보해 **전체 전성분의 명칭·순서** 직접 비교. 차이 있으면 근거와 관측 시점 고정.
2. 에스네이처 90ml의 현재 공식 원문 고시·로트 자료를 확보하고, 90ml 판매처의 서로 다른 성분 첫 순서 중 어느 쪽에 권한이 있는지 판단.
3. 목록만 일치해도 제조 로트·리뉴얼 증빙이 없다면 Subject 발급 자동화 금지. 증거를 확인할 수 없는 경우 그 근거 부족분만 공식 문의.
4. 키 확정 시 별도 리뷰, 전역 충돌·Intake 낙관적 잠금 검증, 별도 쓰기 승인.

근거 JSON: `evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p1-r16h-web-first-source-conflict-v1.json`
