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
5. 추천 핵심 skin_types/concerns가 채워지고, Subject에 연결된 **두 필수 Fact(`low_ph`, `deep_cleansing`) 모두** `supported/product_specific_primary` 상태로 실제 확정 결과·registry·proposition·유효기간과 일치해야 한다.
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

## 6. 기존 상품의 공식 페이지 정보 자동 수집: 검토용 후보

**추가 구현:** `lib/existing-cleanser-official-capture-v1.mjs`, `scripts/run-existing-cleanser-official-capture-v1.mjs`, `scripts/verify-existing-cleanser-official-capture-v1.mjs`.

- 공식 페이지 HTML에서 Product JSON-LD의 상품명과 페이지 title/og:title을 읽어 브랜드·상품명·용량을 대조한다.
- `120ml`과 `130g`는 **절대로 단위 변환해 동일 취급하지 않는다**. 1+1·기획 세트·서로 다른 용량·제조사 이름 없는 상품 타이틀은 HOLD.
- 출처 도메인과 원본 카탈로그 URL이 같은 페이지여야 하며, 브랜드 공식 도메인의 별도 승인 목록이 있어야 한다. 소매점 URL은 제조사 증거로 취급하지 않는다.
- 검증에서 나온 SHA-256, identity surface, 검토된 용량은 **`RESEARCH_CANDIDATE_ONLY`** 기록이다. 권위 있는 Source Binding, Subject, Current Fact를 생성하지 않는다.
- 오프라인 예: `node scripts/run-existing-cleanser-official-capture-v1.mjs --product-file=product.json --captured-html=official.html --official-url=https://brand.example/products/calm --approved-hosts=brand.example --captured-at=2026-10-22T05:00:00Z`. 실제 브랜드/경로/캡처는 허가된 데이터로만 대체해야 한다.
- 라이브 fetch는 별도 `--permit-live-fetch=true --site-use-authorized=true`와 명시된 `--approved-hosts`가 필요한 경우만 허용한다. 호출자는 출처 사이트의 robots/이용약관 및 상용 재사용 권한을 **먼저** 검증해야 한다. 이 플래그를 설정했다고 법적 허가가 새로 생기지는 않는다.
- 외부 HTML/출처 사이트 요청은 이번 PR 검증에서 실행하지 않는다.

## 7. 클렌저 전용 G2 승인 사전평가 (SHADOW)

`lib/cleanser-governed-admission-shadow-v1.mjs`는 제품별 근거가 수집된 미래 상태에서의 **추천 후보 승인 적격성**을 독립적으로 평가한다. 운영 데이터의 리뷰 개수나 `skin_types`/ `concerns` 텍스트만으로는 통과시키지 않는다.

필수 조건:
1. 강화된 preflight PASS (확정된 `low_ph`, `deep_cleansing` 포함).
2. 각 추천 의미 필드(`skin_types`, `concerns`)의 공식 출처 근거와 최신 검토 이력.
3. 정확한 제품·화해 페이지에 결합된 유효한 Hwahae Capture Envelope 다이제스트.
4. 같은 Product/Subject/KR 시장에 대한 별도 현행 identity authority attestation.

**SHADOW_ELIGIBLE**는 운영 `INITIAL_ADMISSION_GRANT`가 아니다. 해당 정책의 `actualAdmissionGranted`, `governedG2GrantIssued`, `runtimeCandidateIncluded` 등은 항상 false로 반환된다.

현재 10개 제품은 Subject/Source Binding/Current Fact 및 metadata 검토·capture envelope가 없어 **이 shadow 기준도 0개 통과**다. 새 근거를 정확하게 채우지 않은 채 legacy 164개 목록에 편입하거나 G2 category 지원값만 변경하는 방식은 금지한다.

## 8. 배치 수집 연동 (기본 OFF)

운영 진단 CLI에 기존 상품 ID만 입력하면 검증 미완료 근거와 후속 작업을 확인한다. 별도의 공식 사이트 fetch는 **기본 실행하지 않음**.

- 기본 진단: `node scripts/run-cleanser-initial-admission-preflight-v1.mjs --ids=<uuid1>,<uuid2>`
- 사전에 제조사 콘텐츠 접근/상용 재사용이 허용된 경우에 한해서만: 위 명령에 `--official-hosts=brand.example --site-use-authorized=true --official-capture-limit=3` 추가.
- URL을 임의 추측하지 않고 각 canonical `products.source_url`을 사용한다. `sourceUrlClassification=OFFICIAL_SOURCE_CANDIDATE_UNVERIFIED`인 제품 중 **승인 도메인과 일치하는 제품만** 조회한다.
- 순차 최대 10개, 기본 3개, 페이지 요청 실패 시 해당 제품을 보류. 전체 배치 결과에 `officialResearch` 배열로 후보/보류 상태 및 해시 기록을 출력.
- 이 기능은 `source binding/subject` 또는 `product_fact_confirmation` 자동 작성 기능이 아니다. `--site-use-authorized=true`는 사용자 측의 사이트 권리 확인을 전제로 하며 법적 허가를 대체하지 않는다.
- 이번 구현 및 CI에서는 실제 브랜드 사이트 fetch를 실행하지 않았으며, 다음 라이브 연구 진행 전에 사이트별 사용 권한·robots를 확인해야 한다.

## 9. 운영 DB 권위 정보 읽기 경로 (추가 구현)

기존 진단 CLI에서 임의의 attestation이나 리뷰 캡처를 생성하지 않고, 다음 기존 DB 기록을 대조한다.

- `catalog_trust_intake.identity_resolution_detail.identity_authority`의 **관리자 상품 신원 확정**이 정확한 `product_id/subject_id/KR` 조합이고, `product_source_bindings`의 resolved 공식 페이지 및 `trust_source_observations`의 동일 SHA-256과 일치해야 `subjectScopeAttestation` 생성. 하나라도 누락·중복·오매칭 시 null.
- `product_evidence_sources`의 Hwahae `product_review_aggregate` 원본 봉투가 검증 가능하고, `product_evidence_source_subject_bindings`의 `exact_subject_match/equivalent` 상태이며 원본 스냅샷 경로·URL·날짜·다이제스트가 맞아야 `hwahaeCaptureEnvelope` 생성. `products.review_signals`를 다시 직렬화해 가짜 원본을 만들어서는 안 됨.
- 이 두 독립 경로는 각각 `lib/cleanser-existing-subject-attestation-v1.mjs`와 `lib/cleanser-hwahae-governed-capture-reader-v1.mjs`의 **순수 함수**로 구현됨. `scripts/run-cleanser-initial-admission-preflight-v1.mjs`에서 실제 테이블을 읽어 materialize한 값을 G2 shadow에 전달한다.
- 각각의 위조/기록 불일치/변형 사례와 **두 출처를 동시에 통과하는 통합 적격성 평가**를 정식 CI에서 검증한다.

**현실적 장애:** 2026-10-22 등록 신규 클렌저 10건에는 관리자 Subject/official binding/current Fact 등 governed 증빙이 없어 현재 승인 대상은 0이다. 또한 DB에서 `publisher='hwahae'`인 `product_evidence_sources` 원본 봉투 행은 조회 당시 0건이었다. 7개 리뷰 집계만으로 그 빈 공간을 메우면 출처 증명을 위조하게 되므로 금지한다.

따라서 **운영 전환 전 필수 단계**는 저작권 및 데이터 사용권이 확인된 Hwahae 원본 캡처 저장, 제조사 공식 증거와 Subject/Fact 확정, 필드별 출처 근거를 TRUST 권한을 통해 수립하고, 최종 read RPC/G2 승인 정책과 안전한 초기 롤아웃을 별도로 검증하는 것이다.

## 10. 기존 상품 TRUST 연구 접수 제안 (진단기 연결, 운영 등록 미실행)

운영 조회 기준 신규 클렌저 10개 모두 `products`에는 존재하지만 `catalog_trust_intake` 및 `product_fact_subjects` 0건이고, 같은 정규화 브랜드/상품명으로 등록된 충돌 제품도 0건이다.

- 추가 `lib/existing-cleanser-trust-enrollment-plan-v1.mjs`: 기존 UUID 보존, 중복·기존 intake·상품 식별 오류 차단, TRU​​ST required facts `low_ph`/`deep_cleansing`와 **현재 registry의 신규 lineage 쓰기 정책**을 확인한 경우에만 `TRUST_INTAKE_ENROLLMENT_PROPOSED` 상태를 출력한다.
- `scripts/run-cleanser-initial-admission-preflight-v1.mjs --ids=...`는 현재 `catalog_trust_intake` 목록과 두 READ-ONLY DB RPC(`catalog_required_product_facts_v1`, `product_fact_controlled_registry_write_admissibility_v2`)를 조회하여 `proposedResearchIntakes`와 `proposedResearchIntakeCount`를 출력한다.
- 각 `proposal`은 `catalog_revision = existing-cleanser-trust-research-v1:<기존UUID>`, `category=cleanser`, `market=KR`, `subject_id=null`, `identity_state=PENDING`, `trust_state=PENDING`인 **운영자 검토용 접수안**이다. 아직 insert하거나 `process_catalog_trust_product_v3`을 호출하지 않는다.
- `scripts/verify-existing-cleanser-trust-enrollment-plan-v1.mjs`에서 기존 등록 충돌/정책 불일치/재실행 상황을 포함한 순수 함수 검증 후 canonical CI에 편입했다.

운영 등록과 v3 processing은 실서비스 `catalog_trust_intake`·`product_fact_research_tasks`를 쓰는 중요 변경이므로, **DB 변경 실행 권한과 검증/롤백 계획이 확인된 별도 protected execution**이 필요하다. 연구 접수는 상품 추천 승인이 아니며 원본 출처/Subject/Fact를 자동으로 확정해주지 않는다.
