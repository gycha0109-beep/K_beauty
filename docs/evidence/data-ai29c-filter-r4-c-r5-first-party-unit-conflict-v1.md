# DATA-AI29C-FILTER-R4-C-R5 — BUSHMAN 공식몰 내부 50g/50ml 표기 불일치 재현

**판정: `FIRST_PARTY_UNIT_CONFLICT_REPRODUCED_MANUFACTURER_ATTESTATION_HOLD`**
조사일: 2026-10-09 / 트랙: `taxonomy-ai` / 선행 PR: [R4-C-R4 #1179](https://github.com/gycha0109-beep/K_beauty/pull/1179)

## 1. R4-C-R4 이후 추가 확인된 1차 출처

| 출처 | 공식 표시된 상품 | 상품명 | 상품정보고시 |
|---|---|---|---|
| [브랜드 공식 단품 #31](https://bushmankorea.com/product/%EB%B6%80%EC%89%AC%EB%A7%A8-%EC%9B%8C%ED%84%B0%ED%94%84%EB%A3%A8%ED%94%84-%ED%94%84%EB%A1%9C-%EC%84%A0%ED%81%AC%EB%A6%BC-spf50-pa-50ml/31/) | 워터프루프 **프로** 선크림 | **50ml** | **50ml** |
| [브랜드 공식 세트 #50](https://bushmankorea.com/product/%EB%B6%80%EC%89%AC%EB%A7%A8-%EC%94%A8%ED%94%84%EB%A0%8C%EB%93%A4%EB%A6%AC-%EB%B8%8C%EB%A1%A0%EC%A6%88-%ED%83%9C%EB%8B%9D%EC%98%A4%EC%9D%BC-190ml-spf7-%EC%9B%8C%ED%84%B0%ED%94%84%EB%A3%A8%ED%94%84-%ED%94%84%EB%A1%9C-%EC%84%A0%ED%81%AC%EB%A6%BC-50g-spf50-pa-2%EC%A2%85-%EC%84%B8%ED%8A%B8/50/) | 태닝오일 + 워터프루프 **프로** 선크림 | **프로 선크림 50g** | **190ml/50ml** (태닝오일/선크림) |
| [신세계면세점 #270878000493](https://www.ssgdfs.com/kr/goos/initDetailGoos?goos_cd=270878000493) | 워터프루프 **프로** 선크림 | **50g** | **50g** |

세트 #50의 상품명에는 선크림 50g이 쓰이지만, **같은 페이지의 제품 고시 본문은 선크림 50ml**로 읽힌다. 이는 서로 다른 유통업체의 차이에 국한되지 않고 **브랜드 1차 상품 기록 자체에서 용량 표기가 혼재**함을 의미한다.

브랜드 단품 #31과 세트 #50의 공개 고시 전성분 나열은 같은 순서로 기재되며 선크림 제조사를 한국콜마로 표시한다. 단, 두 페이지의 고시 문구 비교는 **제품처방 원본·제조번호·GTIN의 독립 인증과 다르다.** 판매용 세트 #50의 선크림이 단품 #31과 동일 SKU라는 명시적 일차 문서/회신은 확보하지 못했다.

혼동 주의: 공식 세트 #44에는 이름이 **'워터프루프 선크림 50g'**인 다른 구성품과 **'워터프루프 프로 선크림 150ml'**가 함께 기재돼 있다. 이 상품의 50g을 **프로 선크림 50g의 승인 근거로 계산하지 않는다.** 제3자 일본 화장품 DB의 JAN `8809990190508` 역시 공식몰의 SKU와 연결 확인 전에는 승인 근거로 쓰지 않는다.

## 2. 남아 있는 실세계 승인 결손

- 공개된 이름·제조사·전성분 일치는 **동일 SKU·처방 추정의 보조 신호**일 뿐이다.
- g↔ml를 1:1 변환하거나, 세트 #50 표기를 단순 오타로 확정하지 않는다.
- 새 raw HTML/PDF 보관이나 공식 SKU 증명 문서를 수령하지 않았으므로 **신규 SHA-256 증거 digest 산출/DB 수집을 수행했다고 주장하지 않는다.**
- 브랜드의 명시적 정정, 제품 SKU/GTIN 연계 또는 제조사 공식 회신과 **독립 관리자 검토**가 없다.
- 기존 Product Source Binding `equivalent` 검토, R2/R3 격리 런타임 PASS 및 이 단계의 1차 출처 표시 혼용만으로 Subject authority를 승격시키지 않는다.

## 3. 브랜드 문의 경로와 발송 전 확인 문안

공식몰에 공개된 문의 경로: **bushmankorea@gmail.com**, 전화 **02-998-5127**. 아직 전자우편을 작성/발송하거나 업체로부터 답변을 받은 것은 아니다.

**제목:** 부쉬맨 워터프루프 프로 선크림 50g/50ml 표기와 동일 SKU 확인 요청

안녕하세요. 화장품 제품 정보의 정확한 제품 식별을 위해 공식 상품 표기 확인을 부탁드립니다.

1. 공식몰 단품 상품번호 **31**에는 프로 선크림이 50ml로, 공식몰 세트 상품번호 **50**에는 상품명 50g·상세 고시 50ml로 표시됩니다. 두 구성품이 국내 판매 기준 **정확히 동일한 제품 SKU와 동일한 처방**인가요?
2. 50g는 중량 표기, 구형/유통처 상품명 또는 단순 표기 오류 중 무엇인가요? 관련 표기 적용일·패키지/처방 변경 이력이 있는지 확인 부탁드립니다.
3. 동일성 확인에 사용할 수 있는 공식 SKU/바코드(GTIN/EAN), 제조사 제품 식별자 또는 패키지 표기 자료가 있나요?
4. 가능하다면 공식 회신이나 정정된 상품 고시를 제공해 주실 수 있을까요?

참고 주소:
- 단품: https://bushmankorea.com/product/%EB%B6%80%EC%89%AC%EB%A7%A8-%EC%9B%8C%ED%84%B0%ED%94%84%EB%A3%A8%ED%94%84-%ED%94%84%EB%A1%9C-%EC%84%A0%ED%81%AC%EB%A6%BC-spf50-pa-50ml/31/
- 세트: https://bushmankorea.com/product/%EB%B6%80%EC%89%AC%EB%A7%A8-%EC%94%A8%ED%94%84%EB%A0%8C%EB%93%A4%EB%A6%AC-%EB%B8%8C%EB%A1%A0%EC%A6%88-%ED%83%9C%EB%8B%9D%EC%98%A4%EC%9D%BC-190ml-spf7-%EC%9B%8C%ED%84%B0%ED%94%84%EB%A3%A8%ED%94%84-%ED%94%84%EB%A1%9C-%EC%84%A0%ED%81%AC%EB%A6%BC-50g-spf50-pa-2%EC%A2%85-%EC%84%B8%ED%8A%B8/50/
- 판매처: https://www.ssgdfs.com/kr/goos/initDetailGoos?goos_cd=270878000493

감사합니다.

**상태:** `OUTREACH_NOT_SENT`. 외부 발송은 별도 명시적 승인이 있을 때만 수행한다.

## 4. 생산 권한 및 후속 게이트

2026-10-09 Production 읽기 전용 확인: BUSHMAN Subject `0b5963bb-67d6-4738-a620-32ec86c1e3d0`은 여전히 `data-ai29c-c5-presentation-identity-correction-v1`; R2/R3 Attestation 테이블·Preflight·Confirmation RPC 부재; 권한 승격 감사 0건; 현행 Semantic Review 0건.

**금지:** Production migration, synthetic/실제 attestation 생성, Subject 직접 UPDATE, Fact/Source/Evidence 변경, Semantic Review, Admission/Ranking/Beta/UVA/Water/Public 활성화.

**다음 게이트:** 업체의 SKU·처방 동일성 확인 또는 명시적 비동일 판단. 그때까지 `IDENTITY_ATTESTATION_HOLD`. 외부 응답이 오더라도 **별도 관리자 검토/감사/권한 승인 없는 자동 승격 금지**.
