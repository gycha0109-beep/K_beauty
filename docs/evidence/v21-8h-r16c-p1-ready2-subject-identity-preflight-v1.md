# V2.1-8H-R16C — P1 READY2 Product Fact Subject 신원 사전검증

## 종료 판정

**`R16C_READ_ONLY_PRESTATE_PASS_REGISTRATION_BLOCKED_ON_SOURCE_CAPTURE_AND_KEY_MATERIALIZATION`**

이니스프리 비자 시카 밤 EX 40ml 및 에스네이처 아쿠아 오아시스 수분 젤크림 80ml 대상으로 기존 신원·중복·Task·Registry·RPC 권한을 **Production 읽기 전용**으로 검증했다. **기존 Subject 중복은 0건**이고 두 상품 모두 합당한 R16B 공식 브랜드 제품 식별 근거가 있으나, **원본 공식 소스 바이트/실제 수집 Digest·최종 formulation_revision_key 및 subject_semantic_key가 없으므로 등록은 금지**한다.

### 두 상품 개별 결과

| 검증 | 이니스프리 비자 시카 밤 EX | 에스네이처 아쿠아 오아시스 젤크림 |
|---|---|---|
| 공식 KR 상품 페이지 | 이니스프리 `product/34622` | 에스네이처 `product_no=99` |
| 카탈로그 용량/공식 표시 | 40ml / 일치 | 80ml / 일치 |
| 기존 Subject | 0건 | 0건 |
| Intake | `SUBJECT_CREATION_REQUIRED`, `REVIEW_REQUIRED` | 동일 |
| 대상 Fact Task | 2건, `REVIEW_REQUIRED` | 2건, `REVIEW_REQUIRED` |
| Task 시도 횟수 | 0 | 0 |
| Research Source Observation / Evidence Candidate | 0 / 0 | 0 / 0 |
| 원문 바이트 캡처 | 미확보 | 미확보 |
| 실제 원문 Digest | null | null |
| 최종 formulation_revision_key / semantic_key | null / null | null / null |
| **Subject 등록** | **차단** | **차단** |

- 공식 참고: https://m.innisfree.com/kr/ko/dp/product/34622?inmPrdCatCd=UA
- 공식 참고: https://www.snature.kr/product/detail.html?cate_no=0&display_group=0&product_no=99

이니스프리에는 **70ml 대용량 `product/34623`** 별도 상품도 있다. 이를 40ml SKU와 혼동하거나 다른 패키지 변형의 신원 근거를 이전해서는 안 된다.

## 운영 계약 검증

Production 조회 확인:
- `product_fact_subjects` 전체 51건, 두 대상 상품 기존 Subject 0건
- 대상 Intake 2건 모두 legacy reviewable 상태; 현재 `updated_at`을 스냅샷에 보존하되 이는 미래 쓰기 시점의 optimistic lock 보장이 아니다
- `product_fact_research_tasks` 4건 모두 `product-fact-registry-cross-category-v1`, `REVIEW_REQUIRED`, attempt 0
- 해당 Registry v1 checksum: `79d41ac13de8080df5199543e31ad7bbc1c1763836ef776313613b7547b79575`
- 신원 serializer: `product-fact-subject-identity-v1`
- 두 Fact의 v1 write policy는 active이나, **연구/Subject 등록 권한을 부여하는 뜻이 아님**
- `admin_resolve_catalog_trust_intake_identity_v1`, `admin_register_product_fact_subject_v1`, `process_catalog_trust_product_v3`: **anon/authenticated EXECUTE 불가, service_role만 가능**(Production 권한 조회)
- R10/R11B의 **별도 identity resolution → Subject registration → reconciliation** 운영 계약을 참고만 하였고, R16C에서 RPC는 호출하지 않음.

### 완료한 항목과 미검증 항목 구분

**PASS (현재 Production 기준):**
1. READY2 제품군과 R16B 부모 증적이 정확히 일치
2. 공식 첫 번째 당사자 KR 상품명·용량 확인
3. 대상 Product에 이미 등록된 Subject 0
4. 현재 Intake·Task 초기 상태 무손상
5. Registry v1 및 관리자 RPC 권한 계약 존재

**미검증 → 등록 차단:**
1. 직접 재수집 가능한 공식 제품 원본 HTTP/이미지 바이트 아카이브와 출처 고정
2. 실제 수집 바이트를 근거로 한 canonical source digest
3. 현재 SKU의 formulation revision/variant 증명
4. `subject_semantic_key` 생성과 **전역 키 충돌 검증** — 키가 없으므로 0건이라고 주장할 수 없음
5. 실제 등록 직전 Intake `updated_at` 낙관적 잠금 재검증과 쓰기 승인

독립 수집 시도 환경에서 공식 도메인의 DNS 해석에 실패했으며, 웹 검색 인덱스 텍스트를 암호학적 원본 바이트로 대체하지 않았다.

## 다른 상품 보호

- R16B **HOLD 2개**: 에스네이처 아쿠아 스쿠알란 수분크림 160ml(세트/단품), 아누아 PDRN ‘캡슐’ 토큰 불일치
- ZEROID R14C HOLD 유지
- P1 미검증 나머지 7개를 자동 등록 대상에 포함하지 않음
- Product Catalog·기존 Source Binding·Registry·Subject·Intake·Fact·Recommendation **쓰기 0건**
- PDA 비수치, 164후보 × 12시나리오 = 1,968평가 기준 불변

## 다음 게이트

`V2.1-8H-R16D_P1_OFFICIAL_SOURCE_CAPTURE_AND_CANONICAL_IDENTITY_MATERIALIZATION`

R16D는 우선 **공식 SKU 원문 수집·출처 해시 검증과 정규화된 신원 키 materialization** 작업으로 제한한다. 근거가 완비되지 않으면 기존 `SUBJECT_CREATION_REQUIRED` 및 `REVIEW_REQUIRED` 유지한다. 실제 service_role 쓰기/Subject 등록은 이후 별도 승인된 게이트에서 진행해야 한다.

증적: `evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p1-r16c-ready2-subject-identity-preflight-v1.json`
