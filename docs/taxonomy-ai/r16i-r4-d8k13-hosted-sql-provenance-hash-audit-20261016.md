# D8K-13 — 운영에 실제 기록된 SQL 원문과 GitHub 이력의 출처 검증

> 2026-10-16 KST · **읽기 전용 실제 SQL 지문 확인 / 운영 DML·DDL 0 / PR #1341 Draft·HOLD**
>
> 근거: 운영 `supabase_migrations.schema_migrations`의 **`statements` 배열**, GitHub 현재 브랜치의 SQL blob SHA, 과거 메인라인 Git 커밋·rename 이벤트. 고객 데이터·운영 credential·실제 SQL 원문은 공개 저장소에 복사하지 않는다. 모든 SQL 내용 비교는 **읽기 전용으로 DB 안에서 Git blob/SHA-256 지문을 계산한 뒤** GitHub의 공개 blob 해시와 비교하였다.
>
> 구조화된 검증 결과: `scripts/product-evidence/baselines/d8k13-hosted-migration-provenance-readonly-20261016.json`. 이후 로컬 파일 변조 검사: `node scripts/product-evidence/verify-d8k13-hosted-provenance-v1.mjs --full`.

## 1. 핵심 결론

이전 "운영 적용 이력은 남았으나 SQL은 없을 수 있다"는 위험 추정이 **부분적으로 해소**되었다. 운영 DB의 `schema_migrations.statements`에는 **178개 이력 모두 SQL 본문이 저장**되어 있었다(150개 1문장 배열, 28개 여러 문장 배열). 따라서 **GitHub에 없는 34개도 운영 DB에 원문이 남아 있어 통제된 읽기 전용 복원 대상**이다. 다만 복원된 SQL을 공개 PR에 복사하거나 운영 DB에 재실행해도 된다는 뜻은 아니다. 특히 보안 비밀번호 폐기 관련 `v21_admission_g3a_emergency_revoke_exposed_runtime_password`는 **민감 정보 검토 전 원문 출력·공개 금지**로 분류했다.

| 감사 집합 | 결과 | 의미 |
| --- | ---: | --- |
| 저장소 SQL | 153개 | 기존 목록과 동일 |
| 운영 migration 적용 기록 | 178개 | 모든 기록에서 `statements` 길이 양수 |
| **동일 이름·다른 버전** | **41개** | 실제 SQL 지문으로 대조 |
| └ 현재 GitHub SQL 원문 정확히 동일 | **29개** | PostgreSQL `statements` → Git blob SHA 일치 |
| └ 끝 줄바꿈 LF 하나만 추가하면 동일 | **5개** | 추가 `\n`이 있는 Git blob SHA 일치 |
| └ 현재 GitHub 파일과 byte 불일치 | **7개** | 현재 파일을 과거 실행 SQL로 간주 금지 |
| 7건 중 과거 커밋 SQL 정확히 복원 | **1개** | DATA-AI29C shadow fallback의 과거 SHA 확인 |
| GitHub 현재 브랜치에 이름이 없는 적용 이력 | **34개** | 원문은 운영 migration statements에 보존 |
| 34건 중 과거 Git rename로 byte 입증 | **1개** | Review queue repair |
| 동일 이름·동일 버전 | **103개** | 별도 검증 결과 57개 blob 일치, **46개 미일치/미입증** |
| └ 위 46개 중 statement 배열 복수 | **28개** | 여러 SQL 문장 재조립 방식 추가 검토 필요 |
| └ 위 46개 중 statement 1개 | **18개** | 본문/형식 차이 구분 필요 |

**중요:** 57/103 및 34/41의 blob 일치는 **본문 해시만** 증명한다. 배포 당시 실행 순서·인증 주체·트랜잭션 경계·실제 결과와는 구별한다. 반대로 해시가 불일치했다고 반드시 SQL 의미가 다른 것도 아니다.

## 2. 다른 버전으로 적용된 41건 — 34건 확정, 나머지 7건 분해

현재 파일과 일치한 34건에는 V2.1 organic shadow, Product source binding/Offer, Taxonomy2 adoption reconcile, FACE LAB test quota, R16I 기초 감사 등 다수 마이그레이션이 포함된다. **현재 파일 그대로 재실행할 이유는 없으며, 이미 적용된 파일의 타임스탬프가 다르다고 `migration repair`로 무조건 고쳐서는 안 된다.**

| 적용 기록 이름 | 현재 SQL과의 관계 | 후속 판단 |
| --- | --- | --- |
| `v21_admission_g3a_pf_authority_read_v1` | 원문 blob 다름; 주석과 공백을 기계적으로 제거한 비교에서만 일치 | **정식 SQL lexer/함수 body 의미 검수 필요**, 동일성 확정 아님 |
| `data_taxonomy3_product_exact_equivalence_v1` | 현재 파일이 과거 실행 SQL을 `BEGIN/COMMIT`으로 감싼 구조 | SQL 실행내용 비슷하나 **트랜잭션 래퍼 차이**; 별도 동등성 확인 |
| `data_taxonomy8_nullable_legacy_category_projection_v1` | **운영 적용 기록은 `ALTER TABLE public.products ALTER COLUMN category DROP NOT NULL` 단일 DDL(64 bytes)**, 현재 파일은 더 넓은 1,920-byte 마이그레이션 | **명백한 적용 범위 차이; 우선순위 P0** |
| `face_lab_v2_persistence_revision` | 실제 기록은 현재 파일 앞에 줄바꿈 LF 1개를 더한 문자열 | 내용 차이 없이 **앞 줄바꿈만 다른 것** 확인 |
| `data_ai29c_shadow_transport_fallback` | 현재 파일은 다름. **과거 Git 커밋 `9c562c54101f` blob SHA와 운영 SQL 원문 해시가 정확히 일치** | 과거 배포 당시 파일 출처 복원 성공; 이후 코드 수정 이력 보존 |
| `data_ai29c_c5b_subject_presentation_identity_correction_v1` | 운영 SQL 11,051 bytes, 현재 파일 13,396 bytes, 단순 포맷 정규화 불일치 | **실제 변경 내역 수동 감사 P0** |
| `data_ai29c_water_c_r1_cardinality_guard_v1` | 원문 blob 다름; 주석·공백을 기계적으로 제거한 비교에서만 일치 | **Postgres 함수 body 포함하여 의미 동등성 검수 필요**, 확정 아님 |

*SQL의 주석/공백 제거는 함수의 dollar-quoted body·문자열 literal 내부에도 영향을 줄 수 있으므로 배포 승인 판단에 사용하지 않는다.* 

## 3. 현재 GitHub에서 빠진 운영 적용 이력 34건 — DB 원문 확보 가능

- 운영 `statements`에는 **34/34 SQL 내용이 기록**되어 있다. 이 중 `20260622180503 / 20260622093000_repair_review_queue_distinct_observed_dates`는 메인라인의 **Git rename 커밋 `2095c14aff46`**으로 구버전 파일과 신버전 파일의 blob SHA가 모두 `b3b93d60e93b1dacc29e70a805c910c61d138a11`임을 입증했다. 실제 운영 SQL은 끝 LF 하나만 더하면 이 blob SHA와 일치한다.
- 나머지 33건은 **기본 메인라인에서 조회한 정확한 `{applied_version}_{applied_name}.sql` 커밋 경로가 없었다**. 이것만으로 모든 원격 브랜치/운영자 보관소에 원본이 없었다는 뜻은 아니다.
- Taxonomy2 resolution/rollback/seed 약 29건과 Trust Phase8H3 relocation 3건 등의 SQL 원본은 Supabase 이력 테이블에 보존되어 있다. **공개 GitHub로의 원본 SQL 자동 추출은 수행하지 않았다.**
- 원문을 별도 보안 저장소로 복원해야 하는 경우 **출시 승인과 별개로** 인증 담당자가 credential·토큰·PII 유무를 검사하고 접근 제어/암호화/감사 로그가 있는 작업 영역에서 읽기 전용 추출해야 한다. `v21_admission_g3a_emergency_revoke_exposed_runtime_password`는 SQL 73-byte 보안 사고 완화 이력으로 별도 고위험 처리한다.
- **원문 존재는 복원 가능성의 근거**이지만 실제 롤백 가능성, 데이터 스냅샷 무결성, historical migration 재실행의 안전성을 증명하지 않는다.

## 4. 별도 확인된 위험: 이름·버전까지 같은 103건

이번에 추가한 fingerprint 검증은 원래 조사 대상인 41건 외에도 **103개 동일 버전·이름 집합**을 살폈다. 그중 **57개**는 raw 또는 LF 한 개 보정 blob 일치, **46개**는 같은 방식으로 일치하지 않는다. 후자 중 **28개는 `statements` 배열이 복수**라 단순 `array_to_string(..., '\\n')`이 원래 배포 파일을 byte-for-byte 재현하지 않을 수 있다. 나머지 **18개는 SQL 1개**로 저장되었지만 현재 파일과 해시가 일치하지 않는다.

이 18개에는 제품 카테고리, Face Lab, 제품 증빙/신뢰 정책, DATA-AI SPF 운영 전환 등 민감한 마이그레이션이 포함된다. **이름·버전 둘 다 같아도 같은 SQL을 실행했다고 단정할 수 없다.** 이 항목은 D8K-13의 다음 감사 대상으로 명시한다.

## 5. 실제 작업 범위 및 출시 정책

**이번 수행:**
- Supabase `schema_migrations`에 대해 SELECT-only로 statement 개수·길이·hash/Git blob SHA 계산. 민감한 SQL 본문/credentials는 GitHub에 게시하지 않음.
- GitHub API에서 **실제 과거 Git rename과 옛 SHA를 조회**하여 두 사례의 file provenance를 입증.
- 일치한 34/41과 불일치한 7건을 개별 매니페스트로 기록.
- 34개 운영-only 이력의 SQL 보존 여부를 확인하고, 보안 위험에 따라 공개 복원 차단.
- 오프라인 파일 해시 검사 `verify-d8k13-hosted-provenance-v1.mjs` 추가; `--enforce-release`는 의도적으로 종료코드 3.

**아직 하지 않은 것:**
- DB `statements` 원문을 파일로 추출·공개하거나, 과거 누락 SQL을 로컬 migrations 디렉터리에 복사.
- 기존 migration 이름·버전 재작성, Supabase `migration repair`, 운영 DB 데이터·스키마·권한 변경.
- 18개 같은 버전 SQL 불일치의 원인 전수 분석, 7개 drift의 의미론적 수동 검증, **전체** 178개 replay.
- 백업/PITR 복원 시험, 독립 OWNER 심사, 공급망 보안 #1208 해결, PR 병합/배포.

**현재 판정:** `D8K13 PG17 PARTIAL CHAIN PASS` / `MIGRATION HISTORICAL PROVENANCE AUDIT IMPROVED` / **`HOSTED RELEASE HOLD`**.
