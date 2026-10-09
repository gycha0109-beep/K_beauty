# V2.1-8H-R16F — P1 READY2 공식 상품 범위·포뮬러 권한 재검토

## 종료 판정

**`R16F_OFFICIAL_80ML_90ML_PRESENTATION_SCOPE_MIXED_AND_REVISION_LINEAGE_UNBOUND_HOLD2`**

R16E에서 포뮬러 적용 로트·시점을 찾지 못한 2개 상품을 공식 1차 자료로 다시 검토했다. 새로운 핵심 발견은 **에스네이처 공식 상품번호 99의 80ml 판매 표기와 90ml 상세 이미지 경로, 2024년 90ml 기획세트 기록이 서로 다른 presentation을 가리킨다는 점**이다. 이는 **자료 범위의 혼재**이며, 80ml의 실제 용량이 틀렸거나 90ml로 리뉴얼됐다는 확정 판정은 아니다.

| 항목 | 이니스프리 비자 시카 밤 EX | 에스네이처 아쿠아 오아시스 수분 젤크림 |
|---|---|---|
| 현행 공식 판매 표기 | 40ml (#34622) | 80ml (#99) |
| 공식 판매 형제/과거 포장 단서 | 대용량 70ml (#34623) | 2024년 90ml 기획세트 |
| 상품 ID·현재 presentation 식별 | 가능 | 가능 |
| 현재 처방의 로트·적용 시점 | 없음 | 없음 |
| 추가 확인된 자료 범위 문제 | 40ml↔70ml 처방 동일성 미증명 | 80ml 표기와 90ml 상세 이미지 경로 혼재 |
| formulation revision / semantic key | 미발급 / 미발급 | 미발급 / 미발급 |
| Subject 등록 | **HOLD** | **HOLD** |

## 1. 에스네이처 공식 HTML 원본 — 재현 가능한 내부 증적

R16D 최종 검증 GitHub Actions **#37899489889**, 증적 artifact **#11600769958**에 있는 `snature-aqua-oasis-gel-cream-80ml.html`을 다시 열었다.

- 원본 바이트: **248,632**
- 원본 SHA-256: `12234f1acdc3e520850b06b09485e79ba9b36abbdbfc93a429718bf8fb1bc88b`
- OG 상품명 / JSON-LD SKU: `아쿠아 오아시스 수분 젤크림 80ml` / `cafe24_smasteri_1_99`
- `#prdDetail` 이미지 URL 총 **20개** 가운데 `/gelcream/90ml/260826/` 경로 **17개**, `/gelcream/80ml/gel80ml_info.jpg` **1개**, 이외 2개.
- 상세 이미지 참조 예: `/web/upload/new_design/gelcream/90ml/260826/gelcream_01.webp`
- 정보 이미지 참조: `/web/upload/new_design/gelcream/80ml/gel80ml_info.jpg`

**중요한 구분:** 이번 단계에서 실제 이미지 파일 바이트·이미지 안의 문구는 내려받거나 판독하지 않았다. 검증한 것은 **공식 HTML에 포함된 이미지 URL과 경로 토큰**이다. 폴더명 `260826`을 제조일, 2026-08-26 리뉴얼 적용일 또는 포뮬러 버전으로 해석하지 않는다.

현행 공식 판매 페이지: https://www.snature.kr/product/detail.html?cate_no=0&display_group=0&product_no=99

## 2. 에스네이처 공식몰 NEWS — 90ml의 과거 판촉 기록

브랜드 공식몰이 직접 호스팅하는 `NEWS` 게시물 **2024-06-25**에는 2024년 4월 올영픽 프로모션의 구성으로 **젤크림 90ml + 카밍 패드 2매 기획세트**가 기재돼 있다.

- 출처: https://m.snature.kr/article/news/3/10033/page/2/
- 게시일과 보도된 판촉 행사의 달은 다르며, 기사 원문 일자·브랜드 상품 리뉴얼 일자를 혼동하지 않는다.
- 브랜드 공식몰의 **역사적 상업적 포장 정보**이지만, 2026년 80ml가 2024년 90ml와 동일 처방이라는 증거가 아니다.
- 브랜드 자체 공개물의 과거 제품 정보이며, 현재 상품 패키지의 제조 로트나 바코드 GTIN, 리뉴얼 일자는 관측하지 못했다.
- 해당 뉴스 페이지의 원본 응답 바이트는 별도 보관하지 않았으므로 **이 페이지에 대한 SHA-256은 없음**. 링크와 게시 내용만 출처로 보존한다.

현재 브랜드 공식 카테고리는 **80ml**로 표시한다: https://snature.kr/category/all/73

## 3. 이니스프리 40ml / 70ml 자료 분리

- 40ml: https://m.innisfree.com/kr/ko/dp/product/34622?inmPrdCatCd=UA
- 70ml 대용량: https://m.innisfree.com/kr/ko/dp/product/34623
- 기존 R16E에서는 **40ml HTML 내장 고시에 전성분 26개**가 확인됐으나, 현행 제조 로트·포뮬러 적용 시점은 발견하지 못했다.
- 같은 상품명과 마케팅 문구, 용량 선택지가 있다는 사실로 **40ml와 70ml가 제조 처방까지 동일**하다고 단정하지 않는다.

## 4. 승인 금지 및 다음 단계

- **카탈로그 80ml→90ml 자동 수정 금지.** 공식 판매 표기는 실제로 80ml다.
- **90ml 경로 폴더의 사진을 80ml의 처방 전성분 근거로 강제 적용 금지.**
- **이미지 파일 자체를 실제 열기 전까지 완전 전성분 확보라고 표시 금지.**
- 2024 판촉 기록·제3자 판매의 90ml·HTML 전체 SHA·전성분 텍스트 SHA는 현행 포뮬러 리비전 권한이 아니다.
- 최종 `formulation_revision_key`, `subject_semantic_key` **모두 null**이며, 전역 key 충돌 검증은 `NOT_EVALUABLE_NO_KEY`.
- Production DB/Supabase RPC 호출·쓰기·Fact 확정·소스 바인딩 수정·추천 랭킹 변경 **없음**.

### R16G 증거 회복 요청

1. 공식 `gel80ml_info.jpg`와 상세 이미지 `90ml/260826`의 **실제 바이트·원문 문구**를 확보하고, 80ml 상품정보고시와 90ml 상세 설명이 각각 무엇을 표기하는지 독립 검토한다.
2. 브랜드의 서면 확인 또는 제조사/패키지 근거로 **80ml vs 90ml SKU·제형·전성분·리뉴얼 관계**와 적용 시점을 확인한다.
3. 이니스프리 40ml에 대해서도 현행 로트에 연결된 원본 패키지·전성분이나 공식 처방 세대 적용 범위를 조사한다.
4. 증거가 충족되기 전까지 Subject 등록 시도 금지. 승인 이후에도 최신 Intake 낙관적 잠금과 semantic key 충돌을 별도 검증한다.

문의에 사용할 확인 사항은 다음과 같으며, **문의 메일·상담을 발송하거나 회신을 받지는 않았다**.

> 공식 상품번호 99가 현재 80ml로 표기되지만 상세 이미지에는 90ml 폴더가 포함됩니다. 두 자료는 같은 현행 포뮬러인가요, 과거 포장/판매 구성인가요? 80ml 상품의 현행 전성분, 적용 제조일/로트, SKU/바코드 및 90ml와의 처방 변경 이력을 확인할 수 있을까요?

R16B 아누아/에스네이처 160ml HOLD, ZEROID HOLD 유지. 비수치 PDA 164×12 = 1,968비교 및 랭킹/추천 결과 불변.

**다음 게이트:** `V2.1-8H-R16G_P1_OFFICIAL_IMAGE_CONTENT_AND_MANUFACTURER_APPLICABILITY_RECOVERY`

원본 증적: `evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p1-r16f-firstparty-presentation-scope-audit-v1.json`
