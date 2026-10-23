# 클렌저 10개 제조사 공개 페이지 1차 조사 — 2026-10-23

> 상태: **공개 페이지 조사 단서(RESEARCH LEAD)**. TRUST가 요구하는 제조사 원본 동결(digest), SKU별 정확한 실물 대상·시장, 검토자·승인 기록이 **아님**. 사이트 크롤러 실행, 공식 근거 DB 삽입, Fact·G2 권한 변경은 하지 않았다.

## 조사 결과를 읽는 방법

- **확인:** 제조사 자체 운영 사이트/공식 카탈로그에 해당 상품과 표시 용량 또는 성분 내용이 보인다.
- **미확정:** 라벨·옵션별 SKU 코드, 바코드, 동일 처방 여부, 구형/신형 전성분 비교, 판매 구성품별 실물 규격, 공식 원본 보존/검토 이력, Fact 값 및 추천 대상 여부.
- **판매처 자료:** 공식 제조사 진술과 별개로 실제 판매 페이지에서 해당 용량을 표시했음을 뜻할 뿐이고, 처방 신원에 대한 증거로 자동 승격하지 않는다.

| 기존 Product UUID 앞 8자리 | 제품 | DB 힌트 | 제조사 공개 표시 | 상태 | 공개 페이지 |
| --- | --- | --- | --- | --- | --- |
| `11322a66` | 닥터지 약산성 클렌징 젤 폼 | 200ml | 200ml | 표시 일치 | [닥터지 공식 200ml](https://www.dr-g.co.kr/item/4009) |
| `4d5b22c7` | 휩드 머그트리 비건 팩클렌저 | 130g (이름) | 130g | 표시 일치 (용량 ml 환산 금지) | [휩드 공개 검색 결과](https://whipped.co.kr/product/%ED%9C%A9%EB%93%9C-%EB%A8%B8%EA%B7%B8%ED%8A%B8%EB%A6%AC-%EB%B9%84%EA%B1%B4-%ED%8C%A9%ED%81%B4%EB%A0%8C%EC%A0%80-130g/53) — 공개 검색 결과에서 유효 제품 경로 재확인 |
| `4f918d80` | 마녀공장 퓨어 소이빈 클렌징 폼 | 160ml | 160ml (120ml 별도 열거) | 표시 일치 | [마녀공장 공식 카탈로그](https://m.manyo.co.kr/goods/goods_list.php?cateCd=006094) |
| `63a958c4` | 라로슈포제 에빠끌라 딥 클렌징 포밍 크림 | 125ml | 125ml, 전성분 | 표시 일치 | [라로슈포제 공식](https://www.larocheposay.co.kr/product/view/4397.do) |
| `c24a599b` | 블랑네이처 아크네 클렌징 폼 | 150ml | 150ml | 표시 일치 | [블랑네이처 공식](https://m.blancnature.co.kr/product/best-%EC%95%84%ED%81%AC%EB%84%A4-%ED%81%B4%EB%A0%8C%EC%A7%95%ED%8F%BC-150ml/13/category/1/display/12/) |
| `e3ebe3ff` | 라곰 셀럽 젤 투 워터 클렌저 | 170ml | **220ml** | **상이한 판매 규격 조사 필요** | [라곰 공식 220ml](https://lagom.kr/product/detail.html?cate_no=1&display_group=2&product_no=10) / [올리브영 170ml](https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000145580) |
| `ed434d86` | 휩드 유자몽 비건 팩클렌저 | 130g (이름) | 130g | 표시 일치 (ml 환산 금지) | [휩드 공식](https://www.whipped.co.kr/product/%ED%9C%A9%EB%93%9C-%EC%9C%A0%EC%9E%90%EB%AA%BD-%EB%B9%84%EA%B1%B4-%ED%8C%A9%ED%81%B4%EB%A0%8C%EC%A0%80-130g/298/category/105/display/1/) |
| `fa793e6b` | 라곰 셀럽 마이크로 폼 클렌저 | 120ml | **150ml** | **상이한 판매 규격 조사 필요** | [라곰 공식 150ml](https://lagom.kr/product/%EB%A7%88%EC%9D%B4%ED%81%AC%EB%A1%9C-%ED%8F%BC-%ED%81%B4%EB%A0%8C%EC%A0%80-150ml/9/) / [올리브영 120ml](https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000145581) |
| `fb7ca4ea` | 제로이드 포밍 클렌저 | 240ml | 공식 페이지에 제품·전성분 존재하나 **240ml 텍스트 확인 실패** | **공식 실물 규격 보류** | [제로이드 공식 전성분](https://www.zeroid.co.kr/web/product/product_detail.asp?idx=325) / [올리브영 240ml](https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000209910) |
| `ff9fe0cf` | 휩드 무화버터 비건 팩클렌저 | 130g (이름) | 130g | 표시 일치 (ml 환산 금지) | [휩드 공식](https://whipped.co.kr/product/detail.html?product_no=222) |

**수량 집계:** 제조사 공개 표시 7건 일치 / 2건 차이 / 1건 공식 표기 불명. 이는 `product_fact_subjects` 확인/승인 건수가 아니라 **공개 웹페이지에서 읽힌 제조사 상품 표기**에 관한 집계이다.

## 추가로 분리한 판매 구성 사례

- 닥터지 공식몰에는 **200ml 본품 ×2 (1+1)** 상품 페이지도 존재한다. 본품 400ml짜리 한 용기가 아니다. [공식 판매 구성](https://www.dr-g.co.kr/item/5184).
- 마녀공장 공식 카탈로그에는 160ml와 120ml를 모두 열거하며, 판매처에는 160ml 본품 2개 + 클렌징 오일 증정 기획이 보인다. [제조사](https://m.manyo.co.kr/goods/goods_list.php?cateCd=006094) / [판매처](https://m.oliveyoung.co.kr/m/mtn/brand/A001924).
- 휩드 머그트리·유자몽·무화버터는 **각각 별도 상품**이고, 제조사별 공개 성분표가 있으나 세 제품이 같은 처방이라는 뜻은 아니다. 특히 머그트리 제조사 페이지에는 **리뉴얼 및 제조 공정/사용감 변경 안내**가 있으므로, 130g이라는 수치가 같더라도 이전 버전의 전성분·제형까지 같다고 추정하지 않는다. <https://whipped.co.kr/product/%ED%9C%A9%EB%93%9C-%EB%A8%B8%EA%B7%B8%ED%8A%B8%EB%A6%AC-%EB%B9%84%EA%B1%B4-%ED%8C%A9%ED%81%B4%EB%A0%8C%EC%A0%80-130g/53>
- 라곰 두 제품은 시장에서 두 규격이 관측되지만 **기존 170/120ml 처방과 공식몰 220/150ml 처방의 성분 동일성은 불명**이다.

## 관리형 다음 작업

1. 정확한 제조사 제품 페이지·상품 코드·실물 용량/단위 및 전성분 **원본이 승인된 방식으로 보존**되어 있는지 확인. 검색 결과나 URL 문자열 자체는 frozen proof가 아니다.
2. 라곰의 용량별 구/신 버전·전성분·제형 동일성 및 유통 SKU를 **독립적으로 검토**한다. 증거가 없으면 `FORMULA_UNRESOLVED`로 유지한다.
3. 제로이드 240ml의 제조사 직접 표기 또는 승인된 포장 근거를 확보한다. 올리브영 표기만으로 공식 정보라고 하지 않는다.
4. 승인된 Source→Subject 연결 후에만 기존 20개 `low_ph`/`deep_cleansing` 연구 작업과 피부 메타데이터 리뷰로 넘긴다.
5. 공식 사이트 원본 수집은 별도의 **사이트 사용 권리 확인과 허용된 저장·검토 경로**에서 진행한다. 자동 사이트 수집 또는 운영 DB 쓰기는 이 문서로 승인되지 않는다.

**운영 상태:** Product 재등록 0, official Source Binding 승인 0, Subject/Fact 변경 0, G2 admission 0, DB/RLS/API/추천 점수 변경 0.

기계 판정 가능한 축약 집계는 [연구 리드 JSON](../../evidence/trust/cleanser-public-official-research-leads-20261023-v1.json)에 기록했다. 상위 로드맵 정본은 #1390의 `docs/architecture/trust-p2-evidence-first-redesign-v3.md` §14이다.
