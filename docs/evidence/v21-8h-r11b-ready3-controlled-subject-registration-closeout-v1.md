# V2.1-8H-R11B — READY3 Controlled Subject Registration Closeout

## 종료 판정

`BARRIER_SUPPORT_P0_READY3_CONTROLLED_SUBJECT_REGISTRATION_PASS`

R10에서 식별 권위가 확정된 READY3를 기존 Phase 5B 통제 등록 경로로 Production에 등록했다.

대상:

1. 더하르나이 시카이드 밤 100ml
2. 에뛰드 순정 판텐소사이드™ 10 시카 밤 50ml
3. 마녀공장 판테토인 인리치드 밤 80ml

아토팜과 제로이드는 R9 HOLD 사유가 해소되지 않았으므로 이번 단계에서 제외했다.

## Production 최종 상태

- Product Fact Subject: **50**
- Product Fact Current: **101**
- Fact Instance: **102**
- Confirmation: **102**
- READY3 등록 Subject: **3**
- READY3 조사 대기 작업: **6**
- READY3 `SUBJECT_CREATION_REQUIRED`: **0**

세 제품 모두:

- `identity_status=resolved`
- `current_state=current`
- `market_applicability=KR`
- `variant_key=null`
- Intake `identity_state=EXACT_SUBJECT_FOUND`
- Intake `trust_state=RESEARCH_PENDING`
- 기존 Registry v1 작업 ID 유지
- `attempt_count=0`
- `blocker_code=null`

## 식별 권위 보존 결함 및 복구

초기 두 건 등록 과정에서 기존 `process_catalog_trust_product_v3`가
R11A의 중첩형 `identity_resolution_detail.identity_authority`를 인식하지 못해
재처리 후 권위 메타가 소실되는 결함을 발견했다.

원인:

- R11A legacy-backfill 경로: 중첩 `identity_authority` 객체 사용
- 기존 8G1 보존 함수: 루트 `authority_kind` 필드만 스냅샷

조치:

- 중첩 `identity_authority`를 우선 보존
- 기존 루트형 authority 호환 유지
- market / HTTPS / SHA-256 / authority version 재검증
- `service_role` 전용 실행 권한 유지
- 이미 영향받은 더하르나이·에뛰드는 frozen R10 semantic/formulation identity가 정확히 일치하는 경우에만 복구

Production migration:

- 저장소: `supabase/migrations/20261005044500_v21_8h_r11b_identity_authority_preservation_fix_v1.sql`
- Production migration: `20261005153209_v21_8h_r11b_identity_authority_preservation_fix_v1`

마녀공장 등록 후 실제 재처리에서도 `identity_authority`가 유지되어 수정 경로를 Production에서 확인했다.

## 권위 경계

이번 단계에서 수행하지 않은 것:

- Evidence 자동 채택
- Product Fact 자동 확정
- Recommendation 변경
- 공개 활성화
- HOLD 제품 자동 해제

세 신규 Subject 각각의 Fact Instance와 Current Fact는 **0건**이다.

따라서 Subject 등록은 Product Fact 채택이나 Recommendation 활성화와 분리된 상태를 유지한다.

## READY3 고정 식별

### 더하르나이

- Subject: `f8e92b1d-6586-430c-88e2-03763dbd6777`
- 의미 키: `9d756f9088eae3572db9d75eb3f654424db7ac01cbb0b6b4d3ada389dc3bf9d6`
- 처방 버전 키: `v21-8h-r10:e769b508ecdcf0f6f652a00da3434867364ef5d04cc627c9bec65163b641e4de`

### 에뛰드

- Subject: `84beae6f-72c8-424e-b561-c2c067fef9e0`
- 의미 키: `028945101121562f1f5470a44fd1a7974477a7c8a50cd6954102993fb087650d`
- 처방 버전 키: `v21-8h-r10:a8a01568cf96737549c033542599a2d94e843367d0c876774262f0b409125327`

### 마녀공장

- Subject: `9ef1863e-b16c-414b-88ae-d686fc4fda33`
- 의미 키: `facb3e2bb9ebd6768b71dbf076dfd7b9ebd3bbbef8cd3fb401603ddba08a65f2`
- 처방 버전 키: `v21-8h-r10:c48757c1795e8fc7afe01fb3d479c7ff3c87753ab20e28e51894dee04fbd4a60`

## 다음 단계

`V2.1-8H-R12 — READY3 Barrier Support Official Evidence Research`

R12는 별도 단계다. 공식 근거 조사를 시작하되:

- Evidence != Fact
- 근거 부족 != false
- 공식 claim != 측정 효능
- `primary_use_role`은 문맥 정보
- Recommendation 자동 활성화 금지

를 그대로 유지한다.
