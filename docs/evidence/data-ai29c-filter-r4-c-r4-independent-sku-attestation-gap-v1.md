# DATA-AI29C-FILTER-R4-C-R4 — 독립 SKU·포뮬러 동일성 증거 재점검

**판정: `R4_C_R4_PUBLIC_SOURCE_CROSSCHECK_COMPLETE_IDENTITY_ATTESTATION_HOLD`**

- 확인일: 2026-10-09 (KST)
- 범위: BUSHMAN 50g Subject ↔ 제조사/브랜드 공식몰의 50ml 상품, 공개 출처 교차검증, 운영 DB **읽기 전용** 현황 재점검
- R3: [PR #1174](https://github.com/gycha0109-beep/K_beauty/pull/1174) / merge `1e20ad810119ab53e3bbf89771faba749aacb29c` / 병합 후 CI PASS
- 이 단계는 **Attestation 발급·관리자 승인·운영 migration·Subject 승격·Recommendation 활성화가 아님**.

## 1. 공개된 상충 단위와 일치 신호

| 비교 지점 | 브랜드 공식몰 | 판매처 신세계면세점 |
|---|---|---|
| 원문 출처 | [BUSHMAN 공식 제품 페이지](https://bushmankorea.com/product/%EB%B6%80%EC%89%AC%EB%A7%A8-%EC%9B%8C%ED%84%B0%ED%94%84%EB%A3%A8%ED%94%84-%ED%94%84%EB%A1%9C-%EC%84%A0%ED%81%AC%EB%A6%BC-spf50-pa-50ml/31/) | [신세계면세점 상품 270878000493](https://www.ssgdfs.com/kr/goos/initDetailGoos?goos_cd=270878000493) |
| 이름/UV 표기 | 워터프루프 프로 선크림 / SPF50+ PA++++ | 같은 브랜드·제품명 / SPF50+ PA++++ |
| 용량/중량 표기 | **50ml** (제품 고시 본문에도 50ml) | **50g** (상품정보고시에도 50g) |
| 제조사 | 한국콜마 | ㈜한국콜마 |
| 책임판매/브랜드 | 부쉬맨 | 부쉬맨 |
| 전성분의 비교 지점 | 정제수·징크옥사이드·다이부틸아디페이트 … 칼라민·트로폴론 | 같은 순서로 해당 성분들 표기 |

[무신사 상품](https://www.musinsa.com/products/4416202)에서도 50g 명칭을 확인했으나, 이를 제3의 독립적인 제조사 승인으로 계산하지 않는다.

**해석:** 명칭, 제조사 및 대표적인 전성분 순서는 동일 제품 가설을 강하게 지지한다. 하지만 두 공개 페이지는 동일 SKU 코드, 제조 배치, 처방 revision 또는 **50g과 50ml의 공식 동등성**을 직접 확정하지 않는다. 화장품의 중량과 부피를 1:1로 환산하지 않으며, 공개 판매처의 상품정보고시만으로 제조사의 서명된 Subject identity attestation을 대신하지 않는다. 전체 전성분을 실험실 또는 제조 문서로 대조해 처방 동일성을 인증한 것도 아니다.

이 확인은 **공개 페이지의 표시를 읽은 것**이다. 온라인 크롤링 텍스트를 저장된 네 개 Source digest의 cryptographic 재검증으로 오인하지 않는다. 새 fresh observation digest를 산출했다고 주장하지 않는다.

## 2. 운영 DB 읽기 전용 재검증

- Product `4608b3b4-8b51-4464-b46e-380b05c1a3d7`
- Subject `0b5963bb-67d6-4738-a620-32ec86c1e3d0`
- Subject semantic key `33696edfb47c47672930e0d398b0cd67fb966c355ec474ea9ec4ffa72400a584`
- Subject label `BUSHMAN Waterproof Pro Suncream 50g`, revision `data-ai29c-c5-bushman-waterproof-pro-current`
- Subject authority `data-ai29c-c5-presentation-identity-correction-v1` (변경 없음)
- 공식 Product binding `9da03b35-9e00-4c46-8ff0-8f6835382349` 1건, 관련 공식 Source 검토 `067e861d-2e61-4ec2-a3f7-660d78be468d` 1건
- 공식 Source ↔ Subject exact binding 4건 유지. 가장 최근 frozen source `94b32b8d-8340-4b91-9e62-646794fd4f41`, frozen digest `3a9fbcb280935133e95a0f7f19bfff20157258b4dc17b8dce4d601e40f6681a9` (2026-10-08 01:09:02 KST)
- Current Facts 3, Instances 3, Research Tasks 4, Evidence Records 3, Current Semantic Reviews 0
- Production `bushman_subject_identity_attestations_v1` **없음**, R2/R3 BUSHMAN Preflight/Confirmation RPC **없음**. 인증 감사 사건 0.

기존 Product Source Binding의 `scope_relation=equivalent`는 Product Fact 출처 관계에 대한 평가이지, 50g/50ml 단위 불일치에 대한 **독립 Subject identity attestation**이 아니다.

## 3. 독립 승인에 필요한 외부 증거

1. 브랜드/제조사 1차 확인: 50g 판매처 표기와 50ml 공식몰 표기가 **정확히 동일한 국내 판매 SKU 및 처방**인지, 중량/부피 표기의 의미와 적용 시점, 리뉴얼 여부를 포함한 명시적 회신.
2. 객관적 연결자: 동일 GTIN/EAN·SKU·바코드·제조 배치/패키지 식별자 또는 동일성을 명시한 제조사 문서. 서로 다른 표기만 보고 임의로 생성하면 안 된다.
3. 신규 공식 관찰 보관: 공식 출처, 관찰 시각, SHA-256 내용 영수증, 상품/처방 범위를 새로 보존하고 기존 4개 digest를 덮어쓰지 않는다.
4. 독립 관리 검토: `admin.products.review` 권한을 가진 담당자의 이유 있는 동일성 판정 및 감사 기록. **기존 공식 Source 검토는 이 서명을 대신하지 않는다.**

브랜드 회신이 명확하지 않거나 revision 분리가 확인되면, R2/R3를 통해 기존 Subject를 승격하지 않는다. 새 Subject/Revision 여부는 별도의 데이터 모델 검토 대상이며 이 단계에서 변경하지 않는다.

## 4. 단계별 게이트

| 게이트 | 상태 |
|---|---|
| 병합 후 R3 격리 Pg17 및 보안 CI | PASS |
| 공식 상품 Source 4 + Binding/Review 계보 | PASS (기존 Product Fact scope) |
| 공개된 50g/50ml 차이 및 표면적 일치 신호 정리 | PASS |
| 제조사 명시적 동일성 확인 / SKU 식별 근거 | **HOLD** |
| 신규 fresh observation digest와 독립 담당자 결재 | **HOLD** |
| Production R2+R3 migration 배포 | **미승인** |
| Production Attestation, Preflight, Subject Confirmation | **미승인** |
| Semantic Review 12/12, Admission, Ranking/Beta/UVA/Water 활성화 | **미승인** |

**R4-C-R4 완료 기준:** 공개 증거 대조 및 결손 판별만 완료. 실제 Subject authority 승격은 금지.

다음 단계는 **브랜드/제조사 1차 식별 증거 확보**다. 해당 증거가 없는 상태에서 Attestation writer나 승인 경로를 열어도 보안 통과를 실세계 제품 동등성 승인으로 확대할 수 없다.

### 불변 사항

Production DB writes 0; Product, Subject, Fact, Evidence, Source Binding, Semantic Review, Catalog, Recommendation, Ranking, Beta, UVA/Water/Public Activation 변경 0.
