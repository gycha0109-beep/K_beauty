# D8K-13 — 다중 Statement 잔여 2건의 실제 차이 및 운영 함수 적용 상태

> 2026-10-17 KST · **운영 SELECT-only / Git SQL 변경 없음 / 저장된 SQL 본문 공개 없음 / 릴리스 HOLD**.

기존 28개 다중 statement migration의 SQL lexer 비교에서 26개는 토큰이 같거나 마지막 세미콜론 하나만 다른 것으로 분류돼 있었다. 나머지 2개를 운영 `supabase_migrations.schema_migrations.statements`와 PR의 정확한 Git blob으로 다시 비교했다. **문자열 literal·quoted identifier는 값 그대로 대조하고, 주석/공백만 제외**했다. 8개 연속 토큰 일치로 편집 위치를 재동기화하며 마지막 원문까지 비교했다. 어떤 데이터/SQL도 실행·수정·게시하지 않았다.

## 1. 랭킹 파이프라인 — 적용되지 않은 현재 파일의 보완 4곳

| 현재 Git 파일 위치 | 운영 이력 대비 추가된 코드 | 추가 토큰 |
| --- | --- | ---: |
| 48행 | `ranking_snapshots` anon/authenticated INSERT/UPDATE/DELETE REVOKE, service_role GRANT | 30 |
| 71행 | `source_rankings` anon/authenticated INSERT/UPDATE/DELETE REVOKE, service_role GRANT | 28 |
| 119행 | `product_candidates` anon/authenticated INSERT/UPDATE/DELETE REVOKE, service_role GRANT | 30 |
| 338행 | 같은 `ingest_key` 재요청 시 기존 랭킹 스냅샷의 `status='ingested'` 검사 | 22 |

- 운영 이력 `20260621030000`: 31 statements, **2,482 tokens**. 현재 repo `20260621030000_phase1_ranking_snapshot_pipeline.sql`: **2,593 tokens** (Git blob `9add0e1e90dc75c0ad94a1acdf0ddb863ed42d1a`).
- 정확한 차이는 **위 110개 토큰 + 최종 세미콜론 1개**. 나머지는 값 보존 토큰 비교로 일치했다.
- 중요: `status='ingested'` 검사는 **후속 적용 이력 `20260621151304`에서 별도로 확인**했으며, **현재 `ingest_ranking_snapshot(text,jsonb)`에도 존재**한다. 따라서 해당 가드가 현재 운영에 없다고 주장하면 틀리다.
- `ranking_snapshots` 일반 역할 쓰기 차단은 후속 권한 repair `20260621151304`/`20260621152040`에서 확인했다. 반면 `source_rankings` 명시적 ACL의 생성·변경 출처는 적용 기록 178건에서 확인되지 않았다. 현재 공개 권한은 **차단**돼 있다. `product_candidates`도 이 audit만으로 전체 ACL 역사 복원 완료를 주장하지 않는다.

**판정:** `RANKING_GIT_ORIGINAL_HAS_ACL_AND_STATUS_GUARDS_MISSING_FROM_ORIGINAL_APPLIED_HISTORY__STATUS_AND_RANKING_SNAPSHOT_ACL_LATER_REPAIRED__SOURCE_RANKINGS_ACL_ORIGIN_UNPROVEN`.

## 2. SEC-05 익명 쓰기 — 현재 운영 RPC 3개 모두 구형 입력 보호

| 현재 Git 파일 위치 | 운영 최초 적용 이력과의 차이 | 토큰 편집 |
| --- | --- | --- |
| 220행 | `claim_anonymous_write_grant`의 여섯 `IS NULL` 거부 조건 | +24 |
| 391행 | `complete_anonymous_write_grant`의 전체 입력 검증 및 명시적 에러 | +73 |
| 413행 | `complete`의 NULL-safe 동일성 비교 `<>` → `IS DISTINCT FROM` | 기존 23 제거, 새 27 추가 |
| 472행 | `fail_anonymous_write_grant`의 전체 입력 검증 및 명시적 에러 | +73 |
| 494행 | `fail`의 NULL-safe 동일성 비교 `<>` → `IS DISTINCT FROM` | 기존 23 제거, 새 27 추가 |

- 운영 이력 `20260711032649`: 37 statements, **2,917 tokens**. Git `20260711032649_sec_05_anonymous_write_grants.sql`: **3,096 tokens** (Git blob `bb42c9cade8e310bdba73017ca6d81d211381056`).
- 차이는 **수정된 입력/비교 블록 5개 + 끝 세미콜론 1개**이며 나머지 literal 포함 원문 토큰은 일치.
- **현재 운영 `pg_get_functiondef`를 SELECT-only로 확인**: `claim`, `complete`, `fail` 모두 **명시적 입력 NULL 검사가 없고** `IS DISTINCT FROM` 방식도 아직 적용되지 않았다. 세 함수는 `SECURITY INVOKER`, **service_role만 EXECUTE**, `anon/authenticated`는 직접 실행 불가. 공개 API 우회/악용이 증명됐다는 뜻이 아니다.
- 2026-10-17 사용자 Windows Docker PostgreSQL17 통과 로그가 입증한 것은 **합성 claim의 여섯 NULL 검증**과 랭킹 권한 REVOKE/rollback이다. **complete/fail의 별도 native PG17 음성(negative) 케이스는 아직 미수행**이다. 이 부분을 통과로 표시하지 않는다.
- 원본 적용 migration을 수정해 재생하면 마이그레이션 이력/실서버 함수 정의를 불일치하게 만든다. **SEC-05 후속 보강 migration과 분리된 검증/보안 승인**이 필요하다. 기존 SQL이나 운영 DB를 자동 갱신하지 않는다.

**판정:** `SEC05_GIT_HARDENING_NOT_DEPLOYED_ON_ALL_THREE_RUNTIME_RPC_FUNCTIONS__ONLY_SERVICE_ROLE_CALLABLE__NATIVE_COMPLETE_FAIL_NEGATIVE_TEST_PENDING`.

## 3. 증거 및 다음 게이트

메타데이터 전용 검증 JSON: `scripts/product-evidence/baselines/d8k13-two-multistatement-source-drift-readonly-20261017.json`. 28개 중 남은 2개 차이의 버전, Git blob SHA, statement/token 수, Git 추가 위치 및 운영 `pg_proc` 상태를 포함한다. **원래 운영 SQL 본문과 고객 데이터를 repo에 업로드하지 않는다.**

우선순위:
1. 완전 분리된 Docker PG17에서 `complete`·`fail`에 대한 NULL/empty/incorrect-principal/invalid-fingerprint·정상 반복호출을 검증하고 회귀 위험을 조사.
2. `source_rankings`와 `product_candidates` 초기 생성 및 ACL의 **실제 배포 출처와 역사 snapshot**을 독립 근거로 확인. 적용 테이블이 안전해 보인다는 사실만으로 역사 이력의 신뢰성이 입증되지는 않는다.
3. 전체 178개 migration 이력의 복원/재생·실제 백업/PITR 복원·독립 OWNER 검토·공급망 `#1208` 해결·명시적 운영 승인 이전에는 SECURITY DEFINER/RLS/데이터/권한/함수 보강을 운영에 적용하지 않는다.

**이 단계 완료: 두 SQL 이력의 실제 비구분자 차이를 모두 분해해 증거 고정. 운영 배포는 HOLD.**
