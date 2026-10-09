# V2.1-8H-R16E — P1 READY2 포뮬러 리비전 권한 실사

## 판정

**`R16E_INGREDIENT_PANEL_1_OF_2_FORMULATION_REVISION_0_OF_2_HOLD`**

R16D의 **정확한 HEAD `d01a5c6...`** GitHub Actions #37899489889, artifact #11600769958에 보관된 실제 공식 HTML 두 건을 독립적으로 재검수했다. 이는 2026-10-09 UTC 07:31 시점의 **관측 스냅샷**이며 영속적인 제조 처방 증명이 아니다.

**공식 상품/SKU 식별 2/2 → 공식 전성분 목록 1/2 → 적용 로트·리뉴얼 시점 0/2 → 등록 가능 0/2.**

| 검증 | 이니스프리 비자 시카 밤 EX 40ml | 에스네이처 아쿠아 오아시스 수분 젤크림 80ml |
|---|---|---|
| 공식 KR SKU | `34622` | `cafe24_smasteri_1_99` |
| 원본 HTTP HTML | 552,567바이트 | 248,632바이트 |
| 실제 SHA-256 | `84c2a82e...` | `12234f1a...` |
| 공식 전성분 관측 | 내장 상품정보고시 **26개** | 캡처된 HTML 텍스트에서는 **미검출** |
| 로트/처방 적용일 | 미확인 | 미확인 |
| 최종 formulation revision / Subject semantic key | 미생성 / 미생성 | 미생성 / 미생성 |
| 최종 판정 | `PANEL_PRESENT_REVISION_LINEAGE_UNBOUND` | `FIRST_PARTY_COMPLETE_FORMULA_PANEL_NOT_OBSERVED` |

### 이니스프리 — 숨겨진 상품정보고시 원문 발견

공식 상품 페이지의 렌더링 전 HTML에서 표시 테이블의 전성분 칸은 비어 있으나, 내장된 제품 고시 직렬화 데이터에는 다음 필드가 있다.

`화장품법에 따라 기재 표시하여야하는 모든 성분`

해당 필드의 성분명은 **26개**다. 숫자 내부의 쉼표(`1,2-헥산다이올`, `1,000ppm`)는 성분 구분자로 계산하지 않았다.

- 해당 **성분표 텍스트 자체** UTF-8 길이: **746바이트**
- 실제 텍스트 SHA-256: `3a9ecd76e31282c42b245986c6b5f6adba0d9dd61c2adfa592a2f411403a8134`
- 첫 5개: 정제수, 프로판다이올, 글리세린, 사이클로펜타실록세인, 스쿠알란
- 마지막 5개: 마데카소사이드, 아시아티코사이드, 마데카식애씨드, 아시아틱애씨드, 글루코오스

같은 페이지의 `제조일로부터 36개월` 표시는 **일반 사용기한 규칙**이지 실제 제조일·로트 번호·처방 적용일이 아니다. 내장 상품정보고시가 관측됐다는 사실도 현재 판매 재고/제조 차수의 포뮬러 리비전 연결까지 증명하지 못한다.

공식 상품: https://m.innisfree.com/kr/ko/dp/product/34622?inmPrdCatCd=UA

### 에스네이처 — 정확한 SKU는 확인, 처방 증명은 미확보

같은 원본에서 공식 JSON-LD Product 명칭 `아쿠아 오아시스 수분 젤크림 80ml`과 SKU `cafe24_smasteri_1_99`는 확인된다. 그러나 HTML 원문 텍스트와 렌더링 후 추출 텍스트에 `전성분`·`정제수`·`제조번호`·`리뉴얼` 문구를 발견하지 못했다. 상세 이미지 내부의 전성분 고시는 **별도 이미지 자산 검사 대상으로 남겨둔다**. 타사 리뷰/성분 데이터가 있더라도 이를 곧바로 1차 포뮬러 권한으로 승격하지 않는다.

공식 상품: https://www.snature.kr/product/detail.html?cate_no=0&display_group=0&product_no=99

### Product Fact Subject 신원 계약

`docs/architecture/product-fact-subject-formulation-scope-v1.md`에 따르면 **제품 용량, 패키지, 판매용 SKU는 제품 처방의 독립적인 증거가 아니다**. 실제 formulation generation을 식별해야 Subject를 발급할 수 있다.

기존 R10 선례의 `canonical_capture → SHA-256 → formulation_revision_key` 방식은 관측 당시의 identity descriptor를 사용한 것이며, 현재 확보된 **가격·재고·이벤트가 변하는 페이지 바이트 해시나 단독 전성분 텍스트 해시를 대체 처방 키로 사용하지 않는다**.

Production SELECT 확인:
- 두 대상의 Product Fact Subject 총 **0**
- 두 Intake는 `SUBJECT_CREATION_REQUIRED`, `REVIEW_REQUIRED`
- Registry v1 조사 Task **4건 모두 REVIEW_REQUIRED**, 시도 0건
- Registry checksum `79d41ac13de8080df5199543e31ad7bbc1c1763836ef776313613b7547b79575`
- `subject_semantic_key` 생성 전이므로 **전역 키 충돌 검증은 NOT_EVALUABLE**, 거짓 PASS 금지

### R16F 독립 회복 조건

1. 이니스프리: **정확한 KR 40ml 포장**의 제조 로트/기간에 연결된 전성분 증거 또는 브랜드·제조사 공식 포뮬러 적용 시점 회신을 확보하고, 상이한 70ml 대용량의 presentation/처방 관계는 별도로 구분
2. 에스네이처: 공식 80ml 상세 이미지/용기 표기에서 **전성분 전체**의 진위를 확인하고, 현행 제조 차수와 리뉴얼 관계까지 독립적으로 조사
3. 전성분 표기·유통 SKU가 수렴하더라도 별도 신원 리뷰 없이 자동 Subject 등록하지 않음
4. formulation_revision_key 확인 후에만 `product-fact-subject-identity-v1`으로 semantic key를 materialize하고, 그때 Production 전역 충돌과 Intake 낙관적 잠금을 재점검
5. 별도 서비스 관리자 승인 전까지 등록 RPC·Review·Evidence·Fact 쓰기 **0**

R16B HOLD(아누아 명칭, 에스네이처 160ml 묶음) 및 ZEROID HOLD 유지. 비수치 PDA **164개 × 12시나리오 = 1,968건**의 랭킹·가산점·후보 선정 변화 없음.

**다음 작업:** `V2.1-8H-R16F_P1_TARGETED_FIRST_PARTY_FORMULA_LINEAGE_RECOVERY`

증적: `evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p1-r16e-formulation-revision-authority-frontier-v1.json`
