# DATA-AI29C-FILTER-R4-C-R2 — BUSHMAN 전용 Subject Authority RPC

판정: `R4_C_R2_BOUNDED_RPC_IMPLEMENTED_NOT_DEPLOYED`.

Migration `supabase/migrations/20261009003000_data_ai29c_filter_r4_c_r2_bushman_subject_auth_v1.sql`에 BUSHMAN 전용 plan/preflight/confirmation RPC와 독립 관리자 identity attestation 저장 테이블을 구현했습니다. **Production 배포 또는 Subject 변경은 실행하지 않았습니다.**

## 분리된 권한
- 기존 BUSHMAN 공식 Source 4건, Product Source Binding 1건, 검토 이력 1건은 제품·출처 관계에 대한 승인이지 Subject 승격 승인이 아닙니다.
- Subject ID, semantic key, 처방 revision, KR/variant는 불변입니다. 출발 C5 lineage만 `trust-phase5-admin-subject-review-v1` 전환 가능하도록 제한합니다.
- Subject label `50g`와 공식 URL의 `50ml`는 여전히 미해결입니다. 단위 환산·문자열 보정 금지. 별도 제조사 공식 관찰과 관리자 동일성 판단/감사 기록을 요구합니다.
- `bushman_subject_identity_attestations_v1`는 RLS+FORCE RLS와 서비스 역할 직접 INSERT/UPDATE 거부. **Attestation 발급 writer 미구현**으로 정상 승인 전에 Preflight는 fail-closed합니다.

## 구현된 함수
1. `bushman_identity_auth_plan_v1`: 관리자 capability 확인, exact Subject + semantic key, 공식 Binding/Review, 4 Source+digest, 독립 attestation+감사, 모든 종속 authority 스냅샷 및 digest.
2. `admin_pf_bushman_identity_auth_v1`: read-only preflight, payload/prestate digest 반환. Write 0.
3. `admin_confirm_bushman_identity_auth_v1`: 별도 명시적 승인 후 사용하는 guarded confirmation. Subject advisory+row lock, stale digest, 요청 멱등성, 감사 이벤트.

성공 허가 시 이론적 변경은 `product_fact_subjects` 업무 필드 identity_resolution_version 1행(+updated_at), `product_fact_review_events` 1행, `admin_audit_logs` 1행뿐입니다. 나머지 Fact/Source/Evidence/Semantic/Recommendation/Ranking/Beta/Public에는 쓰지 않습니다.

## 다음 검증
이번 CI는 **정적 계약 검증만** 수행합니다. SQL 파서·Postgres 스키마 적합성·동시성·실제 RLS/ACL 확인을 마쳤다는 의미가 아닙니다. R4-C-R3에서 격리 PostgreSQL 트랜잭션/rollback E2E, official SKU 리뷰, 독립 attestation 발급 경로와 관리자 검증이 선행돼야 합니다.

기존 COSRX writer, immutable Subject registration, Admission 정책은 변경하지 않았습니다. Production DB write 0, Subject 승격 0, 추천 활성화 0.
