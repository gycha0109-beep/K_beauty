# 신규 클렌저 자동 승인 심사 v1 (보호된 사전 심사)

**상태:** 자동 사전 심사 구현, Production 추천 후보 승인/노출 **미활성**.

**차기 설계 우선순위(2026-10-23):** 현재 코드의 엄격한 물리 용량 일치 검사는 **변경 전 규칙**이다. 이를 즉시 비활성화하지 않고, 기존 PF-1 frozen 계약에 따라 제품 앵커/처방/실물 규격/판매 구성의 신원 확인을 분리하는 [TRUST P2 v3 로드맵 14절](trust-p2-evidence-first-redesign-v3.md#14-2026-10-23-제품처방규격판매-구성-분리-실행-로드맵-개정안)을 후속 구현 기준으로 적용한다. 이 문서의 기존 1~13절은 현재 구현 및 실행 이력으로 유지한다.

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

- 추가 `lib/existing-cleanser-trust-enrollment-plan-v1.mjs`: 기존 UUID 보존, 중복·기존 intake·상품 식별 오류 차단, **활성 Registry 정의에 cleanser 범위가 존재하는지** 검증, TRUST required facts `low_ph`/`deep_cleansing`와 **현재 registry의 신규 lineage 쓰기 정책**을 확인한 경우에만 `TRUST_INTAKE_ENROLLMENT_PROPOSED` 상태를 출력한다.
- `scripts/run-cleanser-initial-admission-preflight-v1.mjs --ids=...`는 현재 `catalog_trust_intake` 목록과 두 READ-ONLY DB RPC(`catalog_required_product_facts_v1`, `product_fact_controlled_registry_write_admissibility_v2`)를 조회하여 `proposedResearchIntakes`와 `proposedResearchIntakeCount`를 출력한다.
- 각 `proposal`은 `catalog_revision = existing-cleanser-trust-research-v1:<기존UUID>`, `category=cleanser`, `market=KR`, `subject_id=null`, `identity_state=PENDING`, `trust_state=PENDING`인 **운영자 검토용 접수안**이다. 아직 insert하거나 `process_catalog_trust_product_v3`을 호출하지 않는다.
- `scripts/verify-existing-cleanser-trust-enrollment-plan-v1.mjs`에서 기존 등록 충돌/정책 불일치/재실행 상황을 포함한 순수 함수 검증 후 canonical CI에 편입했다.

운영 등록과 v3 processing은 실서비스 `catalog_trust_intake`·`product_fact_research_tasks`를 쓰는 중요 변경이므로, **DB 변경 실행 권한과 검증/롤백 계획이 확인된 별도 protected execution**이 필요하다. 연구 접수는 상품 추천 승인이 아니며 원본 출처/Subject/Fact를 자동으로 확정해주지 않는다.

## 11. 실제 기존 클렌저 10건 TRUST 등록·연구 작업 결과 (2026-10-22)

**운영 상태 변경 수행 완료** (Supabase 프로젝트의 기존 governed `public.catalog_trust_intake`와 `public.product_fact_research_tasks`에만 변경; 기존 products / Subject / Fact / G2 / score / legacy 164 변경 없음).

- 변경 전 동일 트랜잭션에서 검증: 정확한 10개 기존 canonical 제품, normalized 중복 0, Subject/Intake/Task 0, `product-fact-registry-cross-category-v1` 활성, cleanser `low_ph`/`deep_cleansing` 정의 및 신규 lineage write policy 모두 허용.
- 단일 `DO` 원자적 실행: 전체 10건에 기존 제품 ID를 보존한 `catalog_revision=existing-cleanser-trust-research-v1:<UUID>`, `market=KR`, `source_candidate_id=NULL`, `PENDING` intake를 삽입; 각 제품에 기존 `process_catalog_trust_product_v3(id,registry)` 실행. 실행 후 10 intake + 20 Fact 연구 태스크와 예상 상태를 트랜잭션 내 확인; 실패 시 전체 자동 취소하도록 설계.
- **사후 SELECT 검증**: 10 intake / `SUBJECT_CREATION_REQUIRED` 10 / `REVIEW_REQUIRED` 10 / 필수 두 Fact 연구 태스크 20(`REVIEW_REQUIRED`) / Subject 생성 0 / Current Fact 확정 0.
- 이 프로세스의 범위는 *TRUST 검증 대기열 등록*이지, 정확한 제품/용량·전성분·pH·세정 효능 또는 추천 후보 승인에 대한 근거/허가가 아니다.
- `scripts/run-cleanser-initial-admission-preflight-v1.mjs`에 `trustQueue.identityStates`, `trustQueue.researchTasks`, `existingResearchIntakeCount`, `existingResearchTaskCount` READ-ONLY 진단 출력 추가. 재실행 시 기존 intake를 감지하여 새로운 등록 제안은 HOLD된다.

**선행 조사가 필요한 공식 출처 단서 (리서치 메모, TRUST 확정 근거 아님):**
- 제로이드 공식 브랜드 페이지: `https://www.zeroid.co.kr/web/product/product_detail.asp?idx=325` — 상품명·성분, `https://www.zeroid.co.kr/web/community/faq_list.asp` — 약산성/피부 타입 설명 후보. DB source_url은 현재 올리브영이며 자동 치환하지 않음.
- 라곰 공식몰: `https://lagom.kr/product/%EB%A7%88%EC%9D%B4%ED%81%AC%EB%A1%9C-%ED%8F%BC-%ED%81%B4%EB%A0%8C%EC%A0%80-150ml/9/` (공식 표기 150ml), `https://lagom.kr/product/detail.html?cate_no=1&display_group=2&product_no=10` (공식 표기 220ml). 기존 카탈로그는 각각 120ml/170ml이므로 **제품 버전·규격 충돌 가능성**, 과거 상품 여부 포함 검증이 필요. 기존 값/규격 임의 변경 금지.
- 마녀공장 브랜드몰 `https://www.manyo.co.kr/goods/goods_list.php?cateCd=007002` — 소이빈 폼 160ml와 120ml 모두 존재하고 약알칼리성으로 표기. `low_ph=true` 자동 추론 금지. 정확한 단품/버전 확인 필요.

### 남은 보호 단계

공식 제조사 사이트·Hwahae의 이용 권한/robots 및 원본 캡처 증빙을 별도 검증해야 한다. 기존 TRUST subject registration/official binding/product-specific Fact confirmation과 검증된 `skin_types`/`concerns`이 없으면 신규 제품의 SHADOW 적격성도 G2 grant도 생성되지 않는다.

현재 `read_recommendation_admission_authority_v1`의 권한 계약은 `contains_active` 계열로 제한된다. cleanser에 대한 최종 런타임 initial admission을 추가하려면 별도 **카테고리별 authority reader + G2 확장 + 회귀 테스트**가 필요하며, 개발/릴리즈 전 DB/Auth/RLS 통제와 canary/rollback 계약이 확인돼야 한다. 공개 추천 activation은 여기서 하지 않는다.

## 12. 판매처에 등록된 기존 상품의 별도 제조사 URL 검토 경로 (2026-10-22)

기존 수집기는 `products.source_url`과 같은 주소만 검사했으므로 올리브영 주소를 가진 제로이드/라곰 3개는 정확한 제조사 페이지를 찾아도 검사를 실행할 수 없었다. **기존 상품 URL은 수정하지 않고 별도 공식 페이지를 출처 검토 후보로 검사하는 경로**를 다음과 같이 연결했다.

- `lib/existing-cleanser-official-capture-v1.mjs`: 기본 `CATALOG_SOURCE_ONLY` 유지. `ALTERNATE_UNVERIFIED_CANDIDATE`를 명시한 경우에만 원래 구매 URL과 다른 제조사 URL을 입력받고, 올리브영/화해 등의 2차 유통 도메인을 거부한다. 결과 `catalogSourceAgreement=false` 및 `ALTERNATE_OFFICIAL_SOURCE_PENDING_MANUAL_BINDING` 표시. **인증된 Official Source Binding은 생성되지 않는다.**
- `collectExistingCleanserOfficialCapture` 라이브 경로는 허용된 도메인·사이트 사용 권한 확인에 더해, 같은 origin의 `robots.txt`를 먼저 읽고 `Crawl-delay`/경로 Disallow가 있거나 robots를 읽을 수 없으면 보류한다. 리다이렉트와 query SKU 변경도 보류한다. 단, robots 허용과 별개로 **사이트 콘텐츠 사용권 확인이 선행**되어야 한다.
- 단일 캡처 CLI의 별도 공식 주소 사용: `--official-url=https://brand.example/products/calm --alternate-source-research=true --approved-hosts=brand.example`. 오프라인에서는 `--captured-html=<기존에 적법하게 확보한 파일> --captured-at=<원본 수집시각>`, 라이브에서는 `--permit-live-fetch=true --site-use-authorized=true`가 필요하다.
- 배치 진단 CLI에 `--official-source-leads-file=evidence/trust/cleanser-official-research-leads-20261022-v1.json` 추가. 파일 내 `productId`는 실행 `--ids`의 하위 집합, URL의 host는 `--official-hosts`의 명시 허용 목록과 정확히 일치해야 하며, 범위 밖 제품·중복·URL credential·비표준 포트·hash·소매처는 실패로 처리한다. 외부 fetch 기본 OFF, 기본 최대 3개/상한 10개, **비권위 연구 후보만** 출력한다.
- JSON 연구 리드는 **웹 검색을 통해 찾은 제조사 공개 링크 후보**이며, 제품별 권한/원본 snapshot/robots 조회가 수행됐다는 뜻이 아니다. 저장된 3개: 제로이드 공식 포밍 클렌저 페이지(240ml 실물 용량 미확정), 라곰 폼 클렌저 공식몰 150ml vs DB 120ml 충돌, 젤 투 워터 공식몰 220ml vs DB 170ml 충돌. 동일 상품·과거 규격 여부 확인 전 **Subject/Fact/추천 등록 금지**.
- `scripts/verify-existing-cleanser-official-capture-v1.mjs`에 별도 URL 옵트인, SKU query 불일치, 구매처, 도메인, duplicate/가짜 리드 등 오프라인 반례 추가.

### 입고된 20개 연구 작업의 의미

신규 10개는 이미 TRUST `catalog_trust_intake` 10건과 `product_fact_research_tasks` 20건(`low_ph`/`deep_cleansing`)으로 실제 연구 대기열에 등록되어 있다. 이 작업들은 모두 `SUBJECT_CREATION_REQUIRED`로 멈춰 있다. 필수 Fact가 `low_ph`라고 해서 **모든 클렌저가 약산성이라는 뜻은 아니며**, `deep_cleansing`도 모든 제품이 딥클렌징이라는 뜻이 아니다. 해당 제품에 대해 근거 있는 불리언 판단을 기록해야 하며 판단 근거가 없으면 계속 보류해야 한다.

공개 제조사 웹페이지를 찾은 것만으로 governed identity certificate, 원본 bytes digest, formulation/variant 권위 또는 Skin Match 추천 승격을 인정하지 않는다.

## 13. 기존 TRUST 연구 실행기의 클렌저 Fact 추출 누락 보완 (2026-10-22)

운영 DB의 `catalog_required_product_facts_v1('cleanser')`는 `low_ph`·`deep_cleansing` boolean 근거를 요구한다. 그러나 `scripts/trust-research-worker.mjs`의 원래 `extractStrictFactCandidate`에는 두 키에 대한 추출 분기가 없어 **Subject를 확정하더라도 모든 클렌저가 `EVIDENCE_INSUFFICIENT`로 막히는 구조적 병목**이 있었다.

이번 PR에서 다음을 구현함.

- `lib/trust/cleanser-official-claim-extractor-v1.mjs`: 공식 제품의 제목/동일 상품 제목에 연결된 메타 설명에 **명시된** 약산성(`low_ph=true`), 약알칼리성(`low_ph=false`), 딥클렌징(`deep_cleansing=true`)을 boolean `product_claim` 후보로 추출. `저자극`, 전성분, pH-balanced, 제품 후기, 홈페이지 FAQ, 연관상품 텍스트, 일반 세정력, 선크림 세정률을 추론 근거로 사용하지 않음. 모순·부정문은 HOLD.
- `scripts/trust-research-worker.mjs`: 기존 연구 작업 처리 분기에서 이 extractor를 호출. 원본 `record_trust_research_result_v1` 계약은 boolean normalized_value와 `product_claim`을 허용하므로 DB schema/RPC 수정 필요 없음. **Product Fact confirmation은 이 함수에서 자동 생성하지 않는다.**
- 공식 source fetch 후 최종 `finalUrl`이 지정된 `source_binding.canonical_locator`와 완전히 같지 않으면 다른 SKU·시장·브랜드로 이동한 것으로 간주하여 `SOURCE_BLOCKED` 처리. 기존 provenance 오결합 가능성도 감소함.
- `scripts/verify-cleanser-official-claim-extractor-v1.mjs`에서 직접/반대 주장, 제품 본문 연관상품 오염, 모순/부정문, 불충분한 약산성 추론을 검증.
- `scripts/verify-cleanser-trust-research-worker-integration-v1.mjs`에서 외부 네트워크나 DB 호출 없이 실제 `processClaimedTask`로 후보 Boolean payload, 원본 해시, `source_binding_id`, exact SKU redirect HOLD, 부족한 근거 처리 확인. `scripts/verify-current-main-health.mjs`에 모두 포함.

**공개 공식몰 사전 탐색 (웹 자료, TRUST 승인 아님):**

- 닥터지 약산성 클렌징 젤 폼 **200ml**: 공식 제품명에 약산성 명시 (`https://www.dr-g.co.kr/item/4009`).
- 마녀공장 퓨어 소이빈 클렌징 폼 **160ml**: 공식 제품 설명의 **약알칼리성**은 `low_ph=false` 증거 후보가 될 수 있으나 검토 전 CONFIRMED 아님 (`https://m.manyo.co.kr/goods/goods_view.php?goodsNo=1000000396`).
- 라로슈포제 에빠끌라 딥 클렌징 포밍 크림 **125ml**: 공식 제품명에 딥 클렌징 명시 (`https://www.larocheposay.co.kr/product/view/4397.do`).
- 휩드 130g 팩클렌저 3종·블랑네이처 150ml 제품은 공식몰의 제품명/규격이 카탈로그와 대체로 일치하지만, 해당 공식 제목에 약산성 또는 딥클렌징이 **명시되지 않았다는 이유로 false를 생성하지 않음**.

**중요:** 20개 연구 태스크는 아직 `SUBJECT_CREATION_REQUIRED`이고, 공식 Source Binding·원본 Product Identity/품번·용량·제형 확정이 없어 이 추출기를 실서비스 대상에 실행할 수 없다. 예시 웹 검색·CI synthetic payload는 확정된 제조사 증거가 아니다. 다음은 기존 권한으로 Subject 및 official binding을 검증한 뒤 bounded claim research worker를 실행하고 관리자 확인을 거쳐 Fact와 G2 SHADOW로 전파한다.


## 14. 2026-10-23 로드맵 개정: 용량/세트와 처방 신원 분리

**이 절은 설계 우선순위 및 이행 순서를 갱신한다. 클렌저 v1 런타임·DB를 변경하지 않는다.** 정본 단계표와 전체 판정 매트릭스는 [TRUST P2 v3 14절](trust-p2-evidence-first-redesign-v3.md)에 있다. 처방/규격 관계는 [PF-1 D5/D9/D11](product-fact-subject-formulation-scope-v1.md)의 기존 frozen 결정을 따른다.

### 클렌저 10건 전용 이행 순서

| 진행 순서 | 이번 10개에서 해야 할 일 | 보류/완료 기준 |
| --- | --- | --- |
| **C0 — 현재 상태 고정** | 기존 제품 ID 10개, intake 10건, `low_ph` / `deep_cleansing` 연구 작업 20건과 기존 정보 보존 | **완료**: 대기열 등록만 완료, confirmed Subject/Current Fact/G2 grant 0. 나머지 항목은 미착수 |
| **C1 — 상품 규격 및 기획 세트 shadow 분류** | 라곰 120/150ml, 170/220ml; 제로이드 240ml; 휩드 130g 단품/기획 세트를 family/physical unit/offer 구분으로 표기. 판매처별 본품 수량·증정품·관측시점 개별 수집 | 완료: 기존 `products.size_ml`/원본 URL 임의 수정 0, 일치·불일치 이유 재현, 증정품 및 1+1이 새 `products`로 생성되지 않음 |
| **C2 — 규격 ↔ 처방 동일성 검토** | 공식 제품 원본/허가된 출처로 두 용량의 성분·제형 동일성 판단. PF-1의 `equivalent_presentation_match` 등 Source→Subject 관계 우선 사용 | 근거 부족 시 `product_family_only` / `formulation_ambiguous`, Fact 재사용 금지. 동일 처방 검토 확정 시에만 cross-size 활용 |
| **C3 — TRUST Subject/Fact 재개** | 승인된 시장/처방 Subject 및 official binding에 한해 기존 20개 연구 작업을 처리하고 별도 Fact review/confirmation 진행 | 실제 Product Fact 생성/확정은 기존 권위 경로와 감사 로그 필요. `deep_cleansing`/ `low_ph` 근거 누락을 false로 대체 금지 |
| **C4 — preflight/G2 정합성 수정 및 shadow 회귀** | `VERIFIED_EXACT_CAPACITY_REQUIRED`를 제품 신원 전체를 막는 조건으로 쓰지 않고 **판매 presentation 선택·source scope 증명**에서만 검사하도록 v2 설계·테스트. 기존 `products.source_url`과 구매 link 분리 | 다른 SKU/불명 제형의 증거 재사용 0. 기존 164개 추천·가격/판매 변화에 따른 피부 점수 불변성 회귀 PASS |
| **C5 — 단계적 활성화** | cleanser G2 authority reader 및 admission 정책을 별도 승인하고 canary/kill switch/rollback 진행 | 현재 `INITIAL_ADMISSION_AUTHORITY_INSUFFICIENT` 유지. 상위 단계 완료 전 production 추천 자동 활성화 0 |

### 구체적인 코드/DB 책임 분리

- 기존 `products`는 카탈로그 앵커다. 카탈로그 정규화 이름 unique 제약을 건드리지 않고 기존 ID를 유지한다.
- 기존 `product_fact_subjects`는 처방 버전 정본이다. 신규 'formulations' 테이블 금지. 기존 `product_evidence_source_subject_bindings.presentation_metadata`와 `equivalent_presentation_match`를 먼저 재사용한다.
- 기존 `product_offers`와 `seller_listing_observations`는 가격/판매처/시점 정본으로 유지한다. 이 10개에 현재 offer 0건이므로 향후 별도 승인 없는 더미 offer INSERT 금지.
- `product_presentations` 및 `offer_components`는 **후속 schema 후보**일 뿐이다. `presentation_formulation_links`는 기존 source-to-subject 승인 경로만으로 이력·규격 참조가 부족하다는 검증이 끝난 뒤에만 결정한다. DB/RLS/관리자 화면/API 영향과 롤백 계획을 먼저 승인받는다.
- 기획 세트의 세럼 10ml는 본품 제형 Fact에 합치지 않는다. 단가 비교는 명확한 본품 용량·수량과 판매시점이 확인된 경우만 산출하며, 미확인 프로모션 총액으로 본품의 단품가를 역산하지 않는다.

**현재 코드와의 차이:** 앞의 1절과 `lib/cleanser-initial-admission-preflight-v1.mjs`에 있는 `VERIFIED_EXACT_CAPACITY_REQUIRED`는 실제 현행 동작이다. 이를 R4/C4에서 근거·범위 검증이 있는 새로운 계약으로 대체하기 전까지 그대로 적용한다. 기존 테스트를 삭제하거나, 명목상 범위 완화를 위해 Subject/Fact 확인 절차를 건너뛰지 않는다. 이 절이 제안 상태임을 숨기고 SHADOW 적격성 또는 G2 승인 상태를 PASS로 표시하지 않는다.
