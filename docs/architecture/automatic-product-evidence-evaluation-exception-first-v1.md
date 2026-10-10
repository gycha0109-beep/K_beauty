# 상품 근거 자동 평가와 예외 중심 운영 설계 v1

- 담당: taxonomy-ai
- 상태: 오프라인 자동 평가기 1차 구현 + 부쉬맨 파일럿, 운영 DB/추천 미적용
- 선행: product-fact-storage-admin-review-v1, product-fact-subject-formulation-scope-v1, data-ai29c-d1b-sunscreen-semantic-projection-policy-v1

## 1. 배경과 목표

부쉬맨 선크림을 관리자가 12회씩 검토·승인하는 절차를 전체 상품으로 확대하지 않는다. 관리자가 정보 부족을 확인하더라도 근거 자체가 증가하지 않는다.

목표: 공식 사실은 기존 등록된 Fact 권한에서 자동 판독, 제조사 주장은 주장으로 분리, 후기는 출처와 사용 조건별 신호로 분석, 미확정은 보존, **중대한 충돌에 한해서만 관리자 개입**. 자동 평가와 관리자 승인 및 실제 추천 허가는 서로 다른 책임이다.

## 2. 데이터 흐름과 경계

~~~
카탈로그 + 공식 원본 + Product Fact Current + 후기 캡처/원본 출처
  → 상품/Subject/시장/처방 식별
  → 자동 필드 평가기 (본 작업)
       검증된 사실 / 제조사 주장 / 사용자 후기 경향 / 근거 부족
  → 예외 분류
       정상·선택 정보 부족·후기 상충 = 자동 보존 및 재수집
       동일 Subject의 권위 있는 사실 충돌·잘못된 Subject 바인딩 = 관리자 예외
  → 자동 판단 이력 저장 (후속 작업)
  → 기존 Admission과 분리된 추천 Shadow 비교 (후속 작업)
  → 별도 승인 이후 제한적 운영
~~~

기존 재사용 대상:
- 공식 근거 수집 및 Digest: lib/trust/gpt-catalog-intake.mjs, Product Evidence 기록 계층
- 제품·처방 식별: Product Fact Subject / Registry / Scope 계약
- 후기 신호: lib/review-signals.js, lib/product-evidence-review-observation-readiness.js, lib/hwahae-review-capture-provenance.js
- 추천 보호 경계: lib/sunscreen-recommendation-semantic-projection.mjs, lib/sunscreen-initial-admission-grant-policy.mjs
- 관리자 인증/감사/멱등성: 현재 Admin v1/v2 기능 (신규 자동 평가의 승인자로 악용 불가)

## 3. 입력과 판정

입력: productId, category, Subject(식별·current 여부), verifiedFacts[], manufacturerClaims[], reviewObservations[].

1. verifiedFacts: 기존 DB Current/확정·정확한 Subject·Registry 어댑터에서 읽은 값만 허용한다. 필드·값·Subject·출처·타입·확인 상태를 명시한다. **순수 평가기의 confirmed 플래그 자체는 증명 수단이 아니다. 실제 운영 어댑터가 신뢰 경계에서 확인해야 한다.**
2. manufacturerClaims: 제품 공식 페이지 설명을 주장으로 기록한다. 백탁 방지, 저자극 등은 해당 Claim을 Fact/안전 판정으로 승격하지 않는다.
3. reviewObservations: 사용감의 긍정·부정·맥락·출처 식별자를 기록한다. 화해 태그 집계는 **방향성 있는 관찰 빈도**일 뿐 실제 사용자의 발생 확률/분모/독립 표본수가 아니다. 중복은 같은 출처 신호로 합친다.
4. fields: verified_fact | review_signal | insufficient. 값 확정, 후기 mixed/positive_signal/negative_signal, 근거 출처와 누락을 구분한다.
5. exceptions: 권위 있는 동일 필드의 상반 Fact, 다른 처방/시장/Subject 바인딩, 잘못된 자료 출처 등 운영자 판단이 필요한 것만 기록한다.
6. researchNeeds: 필수/선택 근거 부족은 재수집 과제로 보내고 관리자의 반복 승인 업무로 만들지 않는다.

선크림 필드 12개: category_slot, skin_types, concerns, texture, finish, uv_filter_type, sensitivity_safe, irritation_risk, tone_up, white_cast, eye_sting, pilling_risk.

기존 D1B의 정식 핵심 필드는 category_slot, uv_filter_type이다. 이 두 값의 자동 근거 준비가 끝나도 SPF·PA, Registry, Subject authority, Admission 등은 기존 D2에서 별도 판단한다.

기존 레거시 변환에서 생기는 combination, dehydration, watery, natural, medium, Boolean(null) 등의 기본값은 검증된 Fact로 역승격하지 않는다. 근거가 없는 선택 항목을 false/low/medium으로 채우지 않는다.

## 4. 예외와 사용자 조건

| 상황 | 자동 처리 | 관리자 개입 |
| --- | --- | --- |
| 핵심 공식 사실이 확인됨 | 해당 필드의 근거 준비 | 없음 |
| 선택 정보 누락 | insufficient 유지, 추가 수집 | 없음 |
| 후기의 긍정·부정 공존 | mixed 경향과 맥락 유지 | 없음 |
| 브랜드 백탁 방지 주장 vs 백탁 사용자 후기 | 주장과 관찰의 종류를 분리 | 없음 |
| 같은 Scope에서 확정 Fact 값 충돌 | 필드 확정 중지 | 필요 |
| 다른 처방/Subject 자료 잘못 연결 | 범위 오류 중지 | 필요 |
| Subject unresolved/non-current | 전체 판단 중지 | 필요 |

눈시림·민감성·백탁·밀림 조건이 중요한 사용자에게는 미확정·혼합 신호를 '안전함'으로 간주하지 않는다. 사용자 맥락에 따라 보수적 후보 배제/우선순위 조정 후보가 되지만 **현재 자동 평가기의 결과는 추천 스코어가 아니며 공개 추천으로 연결하지 않는다.**

## 5. 자동 평가와 승인 권한 구분

- 본 PR: 순수 함수, 고정된 스키마, 부쉬맨 오프라인 파일럿, 음성·불변 테스트, 문서만 도입한다.
- Production DB 신규 쓰기 0건, 관리자 승인·감사 기록 0건, Subject 권한 수정 0건.
- 자동 분석 실행 기록과 Field Assessment, 후기 경향, 예외 큐는 다음 단계에 별도 버전/소유권으로 영속화한다. 관리자 서명을 차용하지 않는다.
- 자동 결과의 evidenceReady가 참이더라도 recommendationAdmissionGranted는 거짓.
- 실제 운영 어댑터는 보호된 서버에서 DB Current Fact의 Subject, 확정 상태, scope, registry를 조회해 validatedFacts를 구성한다. 클라이언트/AI가 confirmed=true를 보내 자체 승인하는 경로를 만들지 않는다.
- 부쉬맨 개별 관리자 12회 화면을 향후 일반 운영 내비게이션에서 제거한다. 기존 수동 RPC는 이전 데이터·관리자 감사 목적으로 독립 보존한다.

## 6. 구현 순서

A. 본 작업: 공통 판정 엔진 + 공식 Fact·주장·후기 구분 + 예외 판정 + 부쉬맨 자료 기반 오프라인 검증. 선크림만 등록된 규칙, 다른 카테고리는 아직 지원하지 않으며 임의 추천 금지.
B. 운영 어댑터: 서버 DB Current Fact, Capture digest, Source/Subject scope 조인. 신뢰할 수 있는 캡처 원본과 확인된 어댑터만 받아들임.
C. 상태 관리: 평가 실행·엔진 버전·근거 해시·이전 판단·무효화·재평가 멱등 키 보존. 서명하지 않은 자동 기록은 별도의 system actor.
D. 예외 처리: 기존 관리 기능과 통합하되 실제 필수 충돌만 대시보드에 표시, 이유·영향 범위·해결 행동을 한국어로 제공.
E. 추천 v2 Shadow: 예측된 상황별 적합성과 D1B/D2를 병렬 비교, unknown의 가짜 우위·고위험 제약 누락 0건 확인. 별도 허가 후 활성화.
F. 카테고리 확대: 선크림→클렌저·보습제·세럼/토너. 각 도메인 Registry와 맥락 정책을 등록한 뒤 공통 평가기에 연결한다.

## 7. 오프라인 완료·거절 기준

- 부쉬맨 12개 필드 자동 평가 및 근거 리스트 출력, 관리자 클릭 필요 없음.
- 공식 확정값과 브랜드 주장·후기 분리, mixed 후기에서 확률 생성 금지.
- 같은 자료 반복 입력/순서 변경에 결과 불변.
- 누락 선택 필드는 관리자 큐를 만들지 않음.
- 핵심 Fact 모순·Subject 불일치만 EXCEPTION으로 분류.
- 미확정 위험 항목을 안전한 Fact로 오인하지 않음.
- 권한 없는 상태로 실제 후기 DB 적재, Production Semantic Review, Subject identity 승격, Admission, Ranking, Beta/Public 시작 금지.
- 오프라인 성공은 운영 반영 성공으로 표시하지 않음.

향후 측정: 자동 처리 비율, 진짜 예외율, 근거 누락/만료율, 수동 개입 시간, 의미 충돌 탐지율, 추천 위험·누출 0건.

## 8. 부쉬맨 운영 사례

50g/50ml는 내부적으로 동일 제품 취급하는 사용자 판단을 유지한다. 이는 공식 제조사 SKU 동일성이나 Subject attestation으로 둔갑하지 않는다. 선행 S2의 백탁 none 확정 철회는 유지하며, 화해/브랜드 구매 후기에서 나온 상반된 백탁·눈시림·밀림·자극을 후기 경향으로 기록한다. 기존 Product Fact 3개와 관리자 Semantic Review 0/12라는 역사적 상태를 자동 승인 12/12로 바꾸지 않는다.

다음 단계의 진정한 블로커는 운영 Fact DB 어댑터와 Admission 권한이다. 추가 제조사 메일·상품 12회 승인 반복을 정상 업무로 도입하지 않는다.


## 9. 2단계 — 운영 데이터 읽기 전용 어댑터(2026-10-10)

실제 Supabase 스키마를 SELECT로 확인하고, 개발용 고정 S2 자료를 운영 자료인 것처럼 사용하지 않도록 별도 어댑터를 구현한다.

- 서버 접근: `lib/product-intelligence/automatic-product-evidence-db-reader-v1.mjs` — 기존 서비스 역할 서버 클라이언트에서 SELECT만 수행. `products`, `product_fact_subjects`, `product_catalog_taxonomy_assignments`, `product_fact_current`, `product_fact_instances`, `product_fact_confirmations`, `product_fact_definition_snapshots`, `product_source_bindings`, `trust_source_observations`.
- 데이터 검증: `lib/product-intelligence/automatic-product-evidence-live-adapter-v1.mjs` — Current·resolved Subject는 1개만 허용, 분류는 기존 v1 canonical taxonomy의 정확한 shadow/source classification을 요구, UV는 현재 Fact 인스턴스·확인 결과·Registry 정의·지원 상태·권한 수준·신뢰도·유효기간을 함께 대조.
- SPF·PA는 `protectedSunscreenFacts` 진단으로 보존하되, 의미가 다른 12필드에 강제 대응하지 않는다.
- 후기: `products.review_signals`만으로 확정하거나 추천하지 않는다. 해당 화해 바인딩이 `resolved + product`이며 정확한 URL로 이어지는 경우에만 검증 가능한 화해 AI 요약 태그를 약한 사용감 신호로 변환한다. 태그 개수는 발생 확률이나 독립 사용자 수가 아니다. Subject에 미귀속인 `product_subject_unresolved` 연결은 신호 생성 금지.
- 공식 제품 설명과 `trust_source_observations`의 SPF/PA 관측은 존재하더라도 백탁·눈시림·민감성에 대한 확정 결론으로 확장하지 않는다. 미수집 원문 후기를 추측하지 않는다.
- 관리자 전용 읽기 API: `GET /api/admin/products/automatic-evidence/preview?productId=<uuid>`. `admin.products.review` 권한과 실제 로그인 세션 필요, 공유 캐시 금지, 내부 오류 노출 금지. 어떤 운영 승인·추천 수정도 수행하지 않는다.

**부쉬맨 실제 운영 조사 결과(SELECT, 2026-10-10):**
- Subject: resolved/current 1개, 별도 historical 1개. 현재 lineage는 `data-ai29c-c5-presentation-identity-correction-v1`로 기존 Admission 권한 미충족.
- Current Fact: SPF 50 / PA++++ / hybrid 3건이 확인됨. 카탈로그 분류는 `product_catalog_taxonomy_assignments`의 `shadow/source_classification`인 sunscreen.
- 제품 row의 `review_signals={}`, `hwahae_url=null`. 화해 바인딩은 `product_subject_unresolved`. 실사용 후기 자동 신호 0건.
- 실제 12필드 읽기 전용 기대치: 분류·혼합자차 2개 근거 준비 / 후기 신호 0개 / 나머지 10개 정보 부족. 이전 **고정 S2 자료 파일럿의 2/7/3은 실제 DB 평가 결과가 아니다**.
- 정보 부족 10개는 자동 재수집 후보이며 관리자 승인 요청 10개로 바꾸지 않는다.

**검증 범위:** CI는 격리된 가짜 DB 응답을 통해 쿼리·권한 경계·상반 후기·변조/중복을 시험한다. 운영 DB 상태는 별도 SELECT로 대조한다. **인증된 관리자 세션으로 실제 배포 API를 호출하기 전까지 운영 실행 성공으로 단정하지 않는다.**

후속 과제는 확인된 후기 원본의 Subject 귀속, 증거 해시/관찰 이력의 서버 검증, 자동 판단 이력 영속화, 예외 큐 및 추천 Shadow 분리이다. 현재 문서와 어댑터만으로 Subject authority, Semantic Review, Admission, 랭킹 또는 공개 추천을 활성화하지 않는다.

## 10. 정확한 Evidence 연결 재검증(2026-10-11)

실제 Production SELECT에서 Product Fact Current 3건의 근거 연결을 확인했다.

```text
product_fact_current.fact_instance_id
→ product_fact_evidence_links.fact_instance_id
→ product_evidence_records.evidence_id
→ product_evidence_source_subject_bindings.binding_id + source_id
→ product_evidence_sources.source_id
```

`product_fact_evidence_links.evidence_id`는 `product_evidence_sources.source_id`가 아니다.
동일 URL의 SPF·UVA·UV 근거 3건은 서로 다른 EvidenceRecord이지만 독립적인 3개 제품 출처로 계산하지 않는다.

서버 읽기 어댑터는 위 체인에 대한 SELECT를 추가하고, 지원 근거의 Fact/Proposition/Registry/Subject/제품 일치, `exact_subject_match`, `equivalent`, 공식 Source 종류, HTTPS, content digest를 재검증한다.
보조 provenance가 누락되거나 바뀌면 해당 Fact를 `verifiedFacts`로 보내지 않고 정보 부족으로 처리한다. 일반 누락은 관리자 수동 승인으로 전환하지 않는다.

- Production 데이터 쓰기/승격/추천 변경 없음.
- 오프라인 테스트는 가짜 DB 응답, 위조 Evidence 및 Subject mismatch를 검증한다.
- 실제 운영 DB SQL 대조와 배포된 관리자 API 인증 실행은 별도 확인 영역이다.
- Source 문서 원문을 재수집·변경하거나 과거 Evidence digest를 수정하지 않는다.

## 11. 3단계 A — 평가 이력 후보 생성 및 중복·변경 감지(2026-10-11)

이 단계는 이력 **저장 준비**만 구현한다. Production migration, INSERT/UPSERT/RPC, 관리자 감사 기록, 추천 활성화는 포함하지 않는다.

- 구현: `lib/product-intelligence/automatic-evidence-history-candidate-v1.mjs`
- 호출: 기존 서버 DB 리더가 정확한 Product/Subject/Current Fact/Registry/Evidence 원본을 SELECT 및 자동 평가한 후, `historyPreview`를 같은 관리자 전용 조회 결과에 첨부한다.
- 저장 상태: `writeState=NOT_SAVED`; `databaseWrites=0`, `adminReviewWrites=0`, `recommendationWrites=0`.
- 이력 후보: productId, subjectId, evaluator/adapter/contract version, 실행 시각, system actor, 12필드 판단, 불확실성/예외, 근거 digest, 판단 digest, 결정론적 멱등 키.
- 실행 시각은 후보의 관찰 메타데이터이며 동일 근거·판단의 멱등 키를 매번 바꾸지 않는다.
- `compareAutomaticEvidenceHistoryCandidates`: 최초 관측 / 동일 평가 중복 / 근거 갱신만 발생 / 실제 판단 변경을 구분하며, 실제 변경된 필드를 식별한다.
- 필드 판단과 인정된 근거 digest는 서로 다른 해시다. 공식 URL이 동일하다고 증거 3개를 독립적인 리뷰 표본으로 계산하지 않는다.
- 부쉬맨 기본값: 사실 2개 / 후기 0개 / 정보 부족 10개, 관리자 자동 승인 및 Admission 없음.

**검증:** 기존 `scripts/verify-automatic-product-evidence-live-v1.mjs`에 멱등성, 재실행 시각 불변, 근거만 변경, 분류 authority 변경, Subject 범위 불일치, 출처 누락, 부정한 쓰기 상태 차단을 추가했다. 신규 전용 워크플로 대신 Database Integration Authority 기존 CI에서 실행한다.

**다음 별도 승인 Gate (3단계 B):** 데이터베이스 schema/RLS, 기록 수명 및 접근 정책, 서버 machine actor 및 원자적 멱등 저장 RPC, compare-and-append 동시성 안전성, replay/rollback, 운영 권한 경계 검증. 이를 승인하고 실제 migration이 수행되기 전까지 자동 평가 **이력이 DB에 기록되었다고 주장하지 않는다**.

## 12. 3단계 B — 서버 전용 자동 평가 이력 저장

구현: `supabase/migrations/20261011013000_taxonomy_ai_automatic_evidence_history_store_v1.sql`, `lib/product-intelligence/automatic-evidence-history-store-v1.mjs`, `app/api/admin/products/automatic-evidence/history/route.js`.

- `public.automatic_product_evidence_history_v1`: 평가 이력만 기록하는 append-only 장부. 현재 Product/Subject, 평가 시각, 버전, 근거·판단 digest, 12개 필드, 근거 정보, 이전 행 참조, 변경 종류/필드를 저장한다. 동일 Product/Subject/idempotencyKey는 UNIQUE 제약으로 하나의 행만 허용한다.
- `public.record_automatic_product_evidence_history_v1(jsonb)`: `SECURITY INVOKER`, `service_role` 단독 실행, 정확한 현재 Subject 요구, product/subject 단위 트랜잭션 advisory lock, 동일 키 재실행은 기존 행 반환, 이전 판단과 비교 후 새로운 이력만 append. 다른 제품 정보와 추천 등록은 변경하지 않는다.
- 접근: RLS enabled/forced; `anon`·`authenticated` 테이블 및 RPC 불허; `service_role` SELECT/INSERT만 가능하며 UPDATE/DELETE 불가. 관리자 브라우저는 service-role 키를 소유하지 않는다.
- 관리자 POST는 `PRODUCTS_REVIEW` 인증·동일 출처 검사를 요구하고 **제품 ID 하나만** 입력받는다. DB 원천 근거와 평가를 서버에서 다시 실행한 후 저장한다. 관리자 필드별 승인 및 추천 활성화는 이 API가 수행하지 않는다. 기존 GET preview는 그대로 읽기 전용이다.
- 운영 활용: 검증된 서버 평가 호출을 batch/scheduler에서 `recordAutomaticEvidenceFromLiveDB`로 재사용할 수 있다. 이번 단계에서는 **자동 실행 스케줄/대량 백필은 활성화하지 않는다**. 호출 없이 자동으로 평가가 쌓이는 것으로 설명하지 않는다.
- 회귀: 기존 Database Integration Authority (Node 테스트 + 별도 PostgreSQL 17 격리 트랜잭션), 중복/근거 갱신/판단 변경/비현재 Subject/권한 차단/롤백을 확인한다. Production 적용 여부와 최초 행 저장은 별도 실측한다.
- 제한: 기록은 평가 시점의 **서버 판정 스냅샷**이다. 저장 자체가 Fact confirmation, 제품 권위 상승, 추천 허가를 뜻하지 않는다. 쓰기 트리거의 사용자 요청 이력, 백그라운드 주기, 보관/삭제 정책은 추후 운영 단계에서 다룬다.
