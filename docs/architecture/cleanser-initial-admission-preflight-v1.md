# 신규 클렌저 자동 승인 심사 v1 (보호된 사전 심사)

**상태:** 자동 사전 심사 구현, Production 추천 후보 승인/노출 **미활성**.

현재 G2 `initial-admission-grant-policy-v1`은 신규 클렌저를 `INITIAL_ADMISSION_AUTHORITY_INSUFFICIENT`로 취급한다. 이 문서는 그 정책을 제거하거나 `products`에 등록한 것만으로 추천되게 하지 않는다.

## 1. 처리 순서

`catalog products 등록 → 신원·중복 검증 → TRUST 공식 Source/Subject/Current Fact → 화해 신호 검증 → 자동 사전 심사 → governed initial admission (별도 활성화) → 추천 점수식`

자동 심사 조건:

1. canonical UUID/브랜드/상품명/카테고리 확인 및 normalized identity 중복 없음.
2. KR 시장의 정확한 제품 Subject가 `resolved/current`이고 제품의 formulation revision이 명시됨.
3. 공식 출처 binding이 `resolved/product`이고, 같은 Subject에 묶인 최근 180일 내 digest 검증된 official observation이 있음. **정확한 ml/g 용량도 해당 observation에서 확인**해야 함.
4. 화해 리뷰 페이지 연결이 일치하고, 리뷰/평점/성분 신호가 최근 180일 내 스냅샷이며 계수·위험도 분포에 모순 없음.
5. 추천 핵심 skin_types/concerns가 채워지고, Subject에 연결된 클렌저 관련 **지원됨(supported) / 제품별 1차 출처(product_specific_primary)** Current Fact가 실제 확정 결과·registry·proposition·유효기간과 모두 일치해야 한다.
6. 충돌·누락이 없으면 `AUTO_ADMISSION_PREFLIGHT_PASS`. 화해 리뷰 개수가 낮으면 신뢰도만 `limited`이며 자동 탈락시키지 않음.

**공식 URL 하나, 화해의 별점·위험도 수치 또는 GPT 추측만으로 공식 Product Fact를 승인하지 않는다.** 미확인 용량, 에디션 충돌, 중복 등은 `MANUAL_REVIEW_REQUIRED`; 증거가 부족하면 `RESEARCH_OR_EVIDENCE_REQUIRED`로 남긴다.

## 2. 권한 경계

- 이 모듈은 **추천 후보 admission grant를 발급하지 않는다**. 결과에 `admissionGranted=false`, `recommendationRuntimeActivated=false`를 고정한다.
- 현재 `product_fact_*` governed confirmation은 관리자 RPC 경로를 유지한다. 자동 confirmation은 인증된 machine actor, 감사/롤백 권한 계약이 별도 검증되기 전까지 금지한다.
- 리뷰·랭킹 데이터는 Product Fact positive authority가 아니다.
- 기존 164개 legacy admission 및 Skin Match 점수식 변경 없음.
- 실서비스 전환에는 **실제 호스팅 데이터에서 권위 검증, 카테고리별 G2 정책의 안전한 확대, 회귀 및 feature-gated canary**가 별도로 필요하다.

## 3. 실행

- 오프라인 정책 테스트: `node scripts/verify-cleanser-initial-admission-preflight-v1.mjs`
- 읽기 전용 운영 상태 진단(서버 환경의 Supabase service-role 필요):
  `node scripts/run-cleanser-initial-admission-preflight-v1.mjs --ids=<product_uuid_1>,<product_uuid_2>`

스크립트는 SELECT만 사용하고 DB write, 스키마 변경, 관리자 confirmation 또는 공개 추천 활성화를 수행하지 않는다.

## 4. 2026-10-22 신규 상품 10건 진단 기준

당시 운영 DB 조회에서 10건 모두 Subject/공식 source binding/Current Fact가 0건이었다. 7건에 리뷰·성분 신호가 저장되어도 이 상태로는 자동 사전 심사를 통과하지 않는다. **신호 저장 성공과 권위 있는 상품 식별/추천 후보 승인은 구분한다.**

## 5. 이미 등록된 제품의 TRUST 보강 (실행 코드)

기존 `ingest_gpt_catalog_product_v1` RPC는 `normalized_brand + normalized_name`이 기존 `products`에 존재하면 `BLOCKED_DUPLICATE`를 반환한다. 따라서 **신규 GPT intake를 다시 호출하지 않는다**.

- `lib/existing-cleanser-trust-backfill-plan-v1.mjs`: 기존 제품 ID를 유지하는 read-only 작업 의존성 계획 생성.
- `scripts/run-cleanser-initial-admission-preflight-v1.mjs`: DB SELECT 후 상품별 `backfill.tasks`, `nextTask`, 출처 URL 후보 분류, 집계 `workItems` 출력.
- `scripts/verify-cleanser-initial-admission-preflight-v1.mjs`: confirmed Fact lineage, 130g, 리뷰 0건, 공식/리테일 출처 후보, 중복 및 변조 사례 회귀 테스트.
- 정식 CI의 `scripts/verify-current-main-health.mjs`에서 해당 오프라인 회귀 테스트를 실행한다.

**심사 결과는 추천 승인이 아니다.** `backfill`은 누락된 증거 수집 업무를 제안할 뿐 `Subject`, `Fact`, `source binding`, `G2`를 자동 생성/승격하지 않는다. 확인되지 않은 공식 URL은 `OFFICIAL_SOURCE_CANDIDATE_UNVERIFIED`로 표시할 뿐 검증된 공식 출처로 취급하지 않는다.

### 신규 클렌저 10건에 적용할 작업 구분

- Source binding / KR current Subject / 공식 실물 용량 관측 / governed Current Fact / 추천 의미 필드: 10건 전부 누락.
- 화해 신호 및 제품 매핑: 7건 기록, 3건 누락·불일치 보류. 기록된 7건도 독립 원본·SKU 증빙 확인은 별개.
- 구매처 URL(예: Olive Young)은 공식 제조사 출처로 자동 승격하지 않는다.
- 기존 제품 10건과 레거시 164건의 production 추천 후보 집합/점수식/카테고리 정책은 변경하지 않는다.

**다음 별도 보호 작업**: 기존 제품에 대해 상품별 공식 제조사 URL·원본·정확한 물리 용량을 근거로 Subject·Source Binding을 수립하는 관리형 TRUST 연동, Product Fact 확인, 별도 카테고리별 G2 grant 확장과 역검증, 제한 canary. 모든 단계는 감사 가능한 운영 경계를 갖춰야 한다.
