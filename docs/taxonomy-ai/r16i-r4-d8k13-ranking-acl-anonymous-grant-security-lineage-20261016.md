# D8K-13 — Ranking ACL 적용 계보 및 익명 쓰기 함수 보안 경계

2026-10-16 KST · 운영 SELECT-only / 오프라인 정적 검사 / Draft HOLD. 이번 감사 중 운영 RPC·DDL·DML·사용자 권한 수정·마이그레이션 실행은 없다. 비밀번호·토큰·사용자 행·비공개 SQL 본문을 공개 저장소로 복사하지 않았다.

## 1. Ranking ACL 적용 계보

- 운영에 적용된 `20260621030000_phase1_ranking_snapshot_pipeline` SQL에는 RLS ON은 포함되지만 현재 GitHub 파일의 일부 명시적 `ranking_snapshots` 권한 REVOKE/GRANT가 없다.
- **운영 적용 이력 `20260621151304_repair_phase1_ranking_snapshot_ingest_rpc`**에서 `ranking_snapshots`의 `anon/authenticated INSERT/UPDATE/DELETE REVOKE` 및 `service_role SELECT/INSERT/UPDATE GRANT`를 확인했다.
- **운영 적용 이력 `20260621152040_repair_phase1_ranking_snapshots_truncate_privilege`**에서 `ranking_snapshots`의 `anon/authenticated TRUNCATE REVOKE`를 확인했다.
- 현재 운영 `ranking_snapshots` 및 `source_rankings`는 RLS ON이고 `anon/authenticated`의 직접 쓰기가 차단되며 `service_role INSERT`가 허용된다.
- 판정: `ranking_snapshots` 초기 ACL 불일치의 일부는 **실제 적용된 후속 보수 migration**으로 설명된다. `source_rankings`의 명시적 ACL 변경 출처 및 모든 과거 시점의 RLS 상태는 아직 미입증. 초기 SQL 재실행이나 migration repair 금지.

## 2. SEC-05 익명 쓰기 함수 보안 경계

### 운영 DB에서 읽기 전용으로 확인

- `public.claim_anonymous_write_grant(text,text,text,text,text,text)`는 `SECURITY INVOKER`다. 실행 권한은 **service_role만 보유**하고 `anon/authenticated/PUBLIC`는 직접 호출 불가.
- `anonymous_write_grants`와 `anonymous_write_grant_uses`는 RLS ON이며 일반 사용자 읽기/쓰기 권한이 없다.
- 운영 함수와 기존 applied SQL에는 **여섯 입력 인자의 명시적 IS NULL 검사**가 없다. 현재 GitHub migration에는 해당 검사들이 존재한다.
- PostgreSQL SELECT-only 합성 상수 실험에서 `NULL !~ regexp`와 `'a' <> NULL`은 둘 다 `UNKNOWN`이었으며, SQL 조건문에서 UNKNOWN은 true로 간주되지 않았다. 원래 함수 입력 계약에 대한 **방어 심층화 필요성**을 확인했다. 운영 함수 실행이나 실제 grant 테이블 테스트를 한 것은 아니다.

### 현재 GitHub 서버 호출 흐름

- `lib/security/anonymous-write-grant.js`는 `server-only` 모듈이다.
- `verifyAnonymousWriteGrantToken`은 HMAC 서명과 claims, 만료, operation을 검사한다.
- `verifyAnonymousWriteGrantForRequest`는 쿠키에서 얻은 principal과 토큰 principal을 일치 확인한다.
- `claimAnonymousWriteGrant`은 필수 jti/principal/fingerprint가 없으면 RPC 호출을 진행하지 않는다.
- `/api/results`·`/api/track`은 **서명/principal 검증 → 요청 resourceId 확인 → fingerprint 생성 → claim RPC** 순서를 따른다.
- 별도의 service_role 호출처가 존재하는지, 운영에 배포된 서버 SHA가 이 코드와 같은지, 실제 취약점이 악용 가능한지는 미확인이다.

**판정:** `DIRECT_PUBLIC_EXECUTE_DENIED / SERVER_FLOW_STATICALLY_GUARDED / HISTORICAL_DB_NULL_GUARD_MISSING`. 공개 API 침해나 데이터 유출을 확인했다고 단정하지 않는다. DB 깊이의 NULL 입력 거부 누락은 새 서버 호출처·입력 계약 변경에 대한 defense-in-depth 리스크로 남는다.

## 3. 재검증 방법과 증거

- `scripts/product-evidence/sql/d8k13-historical-drift-readonly-preflight-v1.sql` — **2026-10-16 16:34 KST** 운영 SELECT-only 실행 PASS. ranking 후속 적용 이력, 현재 RLS/ACL, 함수 role EXECUTE, NULL 검사 누락 및 SQL UNKNOWN 비교를 원문·행 데이터 없이 출력했다.
- `scripts/product-evidence/baselines/d8k13-hosted-same-version-sql-triage-readonly-20261016.json` — metadata-only 관측값, 인가 차단 상태, 과거 migration lineage.
- `scripts/product-evidence/verify-d8k13-historical-security-lineage-v1.mjs` — 오프라인 정적/합성 계약 검사. 실제 소스 **10개**를 입력으로 실행: `D8K13_HISTORICAL_SECURITY_LINEAGE_OFFLINE_PASS_HOLD` PASS, 일반 실행 종료코드 0, `--enforce-release` 종료코드 3. 이는 **새 native PG17·전체 migration acceptance가 아니다**.

## 4. 다음 단계와 명시적 운영 보류

- `claim_anonymous_write_grant`의 명시적인 필수 입력 IS NULL 방어를 **별도 승인된 migration**으로 설계하고, 6가지 NULL 입력·정상 입력·role ACL·retry/rollback을 **격리된 PG17 합성 DB**에서 먼저 검증한다. 운영 DB 직접 교체는 금지.
- `source_rankings` ACL provenance, Crawler 구분자, Taxonomy8 과거 preflight, 전체 178건 migration history 정합성은 별도 확인해야 한다.
- 공급망 보안 `#1208`, 독립 reviewer/OWNER, 백업/PITR 복원, 전체 migration chain 재현과 운영자 명시 승인 전에는 **merge / deployment / migration repair / DDL / DML / 상품 가격·CTA 모두 HOLD**.
