# DATA-AI29C-FILTER-R4-D-S1 — BUSHMAN 선크림 Semantic 12항목 사전검토

**판정:** `BUSHMAN_12_FIELD_SEMANTIC_REVIEW_PROPOSAL_READY_NOT_APPLIED`
2026-10-09 / taxonomy-ai / **미배포 사전검토**

## 1. 제품 동일성에 관한 사용자 결정

사용자 지시에 따라 기존 BUSHMAN 워터프루프 프로 선크림의 **50g/50ml 표기는 동일한 상품으로 간주하여 내부 검토를 진행**한다. 동일성 논쟁 때문에 피부 적합성 분석을 더 이상 중단하지 않는다. 단, 이는 제조사의 SKU·처방 공식 인증, 독립 관리자의 감사서명 또는 `trust-phase5-admin-subject-review-v1` 계보로의 데이터베이스 변경을 뜻하지 않는다.

대상 Product `4608b3b4-8b51-4464-b46e-380b05c1a3d7`, Subject `0b5963bb-67d6-4738-a620-32ec86c1e3d0`, 기존 Semantic Review `0/12`을 유지한다.

## 2. 12개 피부 적합성 판단안

| 항목 | 사전검토 상태 | 제안값 | 근거 / 한계 |
|---|---|---|---|
| category_slot | established | sunscreen | 제조사 공식 상품명 '선크림' |
| skin_types | reviewed_not_established | null | '어린이겸용'만으로 지성/건성/민감성 적합성 단정 불가 |
| concerns | reviewed_not_established | null | SPF 효능을 피부 고민 enum으로 임의 치환 금지 |
| texture | reviewed_not_established | null | '부드러운 발림'만으로 gel/lotion/cream/watery 분류 불가 |
| finish | reviewed_not_established | null | 발림성과 마무리감은 별개 |
| uv_filter_type | established | hybrid | 기존 공식 증거 기반 Product Fact Current (registry v2) |
| sensitivity_safe | reviewed_not_established | null | '저자극'은 개인별 무자극·절대 안전 보장이 아님 |
| irritation_risk | reviewed_not_established | null | 저자극 문구를 low/medium/high 확률값으로 변환 금지 |
| tone_up | reviewed_not_established | null | 명시적 톤업 유무 확인 불가 |
| white_cast | established | none (medium) | 제조사 상품정보고시 '백탁현상방지' 문구 기반 **표시 주장**만 반영; 독립 시험 아님 |
| eye_sting | reviewed_not_established | null | 눈시림 위험 증거 부족 |
| pilling_risk | reviewed_not_established | null | 화장 밀림·필링 위험 증거 부족 |

1차 출처: [BUSHMAN 공식 상품 #31](https://bushmankorea.com/product/%EB%B6%80%EC%89%AC%EB%A7%A8-%EC%9B%8C%ED%84%B0%ED%94%84%EB%A3%A8%ED%94%84-%ED%94%84%EB%A1%9C-%EC%84%A0%ED%81%AC%EB%A6%BC-spf50-pa-50ml/31/). 혼합 필터 `hybrid`는 성분 리스트를 비공식으로 재해석한 값이 아니라 이미 확인된 governed Fact를 따른다.

## 3. 예상 평가 — 아직 Production 결과가 아님

- 사전검토 `12/12 reviewed`, `3 established`, `9 reviewed_not_established`.
- D1B envelope **순수 함수 시뮬레이션**: `envelopeReady=true` (카테고리·UV 필터 core established + 전체 12개 review 제안 완료).
- Neutral / white-cast relevance는 사전검토 자료상 가능하지만, 눈시림·민감성·필링·제형 등 미확정 문맥은 fail-closed.
- **실제 운영 12개 review INSERT/UPDATE는 0건**. 따라서 Production은 여전히 0/12이며, 위 시뮬레이션으로 Admission, Ranking, Live Beta를 승인할 수 없다.

## 4. 후속 실행 순서

1. 이 사전검토를 CI와 독립 검토로 검증한다.
2. 기존 Semantic Reviewer RPC에 필요한 관리자 capability·exact Subject·증거 payload 요건을 재검증한다.
3. 사용자 결정에 따라 50g/50ml는 **내부 제품 표기 동등**으로 취급하고 review 준비 작업을 진행한다. 제조사 확인을 요구하는 반복 조사를 하지 않는다.
4. 운영 Review 쓰기가 필요한 단계는 별도 audit-capable 승인 경로가 검증된 후 실행하며, 현재 Subject lineage를 사실과 다르게 승격하지 않는다.
5. R4-E Admission은 12개 실제 current review와 Subject authority가 모두 충족된 이후만 판단한다.

**불변조건:** Product/Subject/Fact/Source/Evidence/Registry, Production migration, Recommendation, Ranking, Beta, Public/UVA/Water: 변경 없음.
