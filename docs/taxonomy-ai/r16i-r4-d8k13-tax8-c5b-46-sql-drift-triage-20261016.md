# D8K-13 — Taxonomy8/C5B 운영 SQL 출처와 동일 버전 46건 분류

> 2026-10-16 KST. Hosted SELECT-only. PR #1341 Draft / release HOLD.
>
> 출처: 운영 `supabase_migrations.schema_migrations.statements`, 현재 PostgreSQL `pg_catalog`, GitHub migration 원문 및 blob SHA. 운영 SQL 원문·비밀번호·개인 식별자·키를 공개 파일에 저장하지 않았다.

## 1. 확정된 두 P0 원인 구분

### Taxonomy8 — 실제 배포된 범위는 현 파일보다 작음

- 운영 이력: `20260914153348 / data_taxonomy8_nullable_legacy_category_projection_v1`. 저장된 SQL은 64바이트, 정확히 `ALTER TABLE public.products ALTER COLUMN category DROP NOT NULL;` 단일 문장.
- 현재 GitHub: `20260914030000_data_taxonomy8_nullable_legacy_category_projection_v1.sql`, 1,920바이트. `BEGIN/COMMIT`, `DO` 기반의 nullable-before/enum/exact-equivalence 사전 검증, category `DROP NOT NULL`, `COMMENT`를 포함한다.
- 현재 운영 DB: `products.category`는 nullable=YES / `product_category` enum. exact-equivalence view와 canonical assignment table은 존재한다. 실제 컬럼 COMMENT는 현재 GitHub의 설명과 일치한다.
- **보안·무결성 판정: APPLIED_SUBSET_ONLY / PREFLIGHT_NOT_ATTESTED (P0).** 최종 컬럼 상태·설명이 같아도 GitHub 사전 검증이 배포 당시 시행됐다는 증거는 아니다. 이미 nullable이므로 현재 파일 전체를 운영 DB에서 재실행하면 `expected NOT NULL category baseline` 조건에서 의도적으로 거부될 수 있다. migration repair와 반복 DDL을 금지한다.

### DATA-AI29C C5B — 함수 본문은 일치, migration 보호 래퍼가 다름

- 운영 이력: `20260929181051 / data_ai29c_c5b_subject_presentation_identity_correction_v1`. 기록 SQL 11,051바이트/274줄; 현재 GitHub SQL `20260929180500_...`는 13,396바이트/379줄.
- `admin_correct_product_fact_subject_presentation_variant_v1(uuid,text,uuid,text,text)` 함수 본문을 quoted literal을 보존하고 SQL 주석/공백을 제외해 렉싱한 결과, **기록된 함수 body와 현재 GitHub body 1,203/1,203 토큰 완전 일치**.
- `pg_get_functiondef`로 읽은 **현재 운영 함수 body와 GitHub도 1,203/1,203 토큰 일치**. 현재 `SECURITY DEFINER`, `service_role EXECUTE=true`, `anon/authenticated EXECUTE=false`.
- GitHub migration에만 선행 테이블/RPC 존재 체크, 함수 설명 COMMENT, 후행 `has_function_privilege` 검증 하네스가 있다. 저장된 과거 migration에는 이 하네스가 없다.
- **판정: FUNCTION_BODY_TOKEN_MATCH / MIGRATION_PRE_POST_GUARDS_NOT_ATTESTED.** 배포당시 함수의 실행 의미/권한 이력과 migration 사전검증이 완전히 동일했다고 간주하지 않는다. 토큰 비교는 바이트 동일성이나 native PostgreSQL 재실행을 대체하지 않는다.

## 2. 같은 이름·버전이지만 Git blob 해시 미일치한 46건

총 103건 중 57건은 현재 Git blob 해시가 직접 일치했고, 46건은 기존 방법으로 입증되지 않았다.

| 구분 | 건수 | 확인 수준 |
| --- | ---: | --- |
| 여러 statements로 저장 | **28** | 빈 문자, LF, 2LF, CRLF, `;` 결합 등을 포함한 11종 단순 join 모두 current blob에 불일치; **parser-aware 재구성 필요** |
| 단일 statement: 끝 SQL 구분자 한 토큰 차이 | **6** | 댓글/공백을 보존성 있게 제외한 lexer에서 나머지 토큰이 동일 |
| 단일 statement: 주석·공백 제외 토큰 동일 | **5** | quoted literal은 그대로 보존, SQL 토큰 배열 일치 |
| 단일 statement: 앞뒤 CR/LF 정리 후 blob 일치 | **6** | normalized body는 현재 Git blob과 SHA-1 일치 |
| 단일 statement: crawler 함수 달러 블록 구분자 차이 | **1** | `crawler_canonical_adoption_authority_remediation_v1`. native PG17 파서 검토 필요 |
| **합계** | **46** | **전체 migration chain 승인 불가** |

세미콜론/공백/주석/줄바꿈만 다른 파일은 의미 동등성이 높아 보일 수 있으나, 문자열 literal과 dollar-quoted 함수 body의 의미 및 트랜잭션 경계까지 자동으로 동등하다고 주장하지 않는다. 특히 Crawler의 PLpgSQL 블록 `END` 직후 구분자 차이는 별도 native parser 검증 전까지 미해결.

## 3. 다른 버전으로 적용된 7건의 진전

- `data_ai29c_shadow_transport_fallback`: 운영 원문은 과거 Git commit `9c562c54101f` 파일과 **byte-identical**.
- `face_lab_v2_persistence_revision`: GitHub 파일 앞에 LF 한 개 차이.
- `data_taxonomy3_product_exact_equivalence_v1`: SQL 실행부 주위 `BEGIN/COMMIT` wrapper 차이.
- `v21_admission_g3a_pf_authority_read_v1`와 `data_ai29c_water_c_r1_cardinality_guard_v1`: 주석/공백 제외 시 텍스트 일치 후보이나 정식 token/PG 검사 미완료.
- Taxonomy8/C5B는 위 P0 항목과 같다.

## 4. 저장된 검증 자료·다음 승인 경계

- `scripts/product-evidence/baselines/d8k13-hosted-same-version-sql-triage-readonly-20261016.json` — SQL 본문 없는 46건의 분류, source Git blob SHA, hosted statement count.
- `scripts/product-evidence/verify-d8k13-hosted-provenance-v1.mjs` — SHA 및 46건 분류 갯수가 바뀌면 실패하는 offline-only 진단.
- 기존 `scripts/product-evidence/verify-d8k13-release-sequence-v1.mjs`는 여전히 Draft/HOLD이며 강제 릴리스 검사 종료코드 3을 유지한다.
- 다음 작업: 28건의 parser-aware statement split 비교, crawler 구분자 합성 PG17 테스트, Taxonomy8 preflight 미실행 증거 처리, C5B migration wrapper 차이에 대한 독립 감사. 전체 보안 #1208 / 실제 백업 복원 / 독립 reviewer / 전체 migration 체인 검증은 별도 HOLD다.

**운영 DDL·DML·schema_migrations repair·PR merge·deploy·관리자 권한 변경·상품 가격/CTA 활성화 모두 금지.**


## 5. 복수 statements 재조립 1차 표본 (2026-10-16)

28건 중 **3건을 읽기 전용으로 추가 시험**했다: `safe_review_and_promotion_layer`(39 statements), `add_revisit_core_tables`(80 statements), `product_fact_storage_v1`(95 statements).

운영 `schema_migrations.statements`를 세미콜론으로 재결합하고, 문자열 literal은 보존하면서 SQL 주석·공백을 제외하는 lexer로 GitHub 현재 파일과 비교한 결과 **3건 모두 마지막 세미콜론 한 토큰만 제외하면 정확히 일치**했다. 단순 문자열/Git blob SHA 재조립은 여전히 일치하지 않으므로 이것을 byte-identical이라고 표시하지 않는다. 사용된 PostgreSQL 실제 파서·실행 순서·권한은 별도 검증 대상이다.

**남은 25건은 동일 검증을 완료하지 못했다.** 표본의 결과를 전체 28건으로 확장하지 않는다. 28건 전체에 대한 `PARSER_REASSEMBLY_NOT_PROVEN` 상태 및 릴리스 HOLD는 유지한다.
