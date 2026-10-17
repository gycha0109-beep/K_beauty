# D8K-13 — SEC-05 NULL 방어 · Ranking 공개 ACL 격리 PG17 검증

> 2026-10-16 KST · **검증기 구현 및 파일 계약 PASS / Native Docker PG17 실행 증거 없음 / 운영 HOLD**
>
> 이 문서는 기존 D8D v2 → D8K-13 PG17 부분 체인과 **별개의 보안 보강 합성 테스트**를 다룬다. 운영 DDL·DML·migration history·제품/Offer/CTA·role은 수정하지 않는다. 새 SQL은 모두 tests/fixtures 아래에서만 사용하며 `supabase/migrations`에 신규 적용 파일을 만들지 않는다.

## 1. 검증 배경과 정확한 출처

운영 `claim_anonymous_write_grant(text,text,text,text,text,text)`의 함수 본문에는 필수 인자 `IS NULL` 검사 6개가 없다. 현재 저장소 `20260711032649_sec_05_anonymous_write_grants.sql`에는 이를 보완하는 코드가 있다. DB에 보존된 운영 함수를 SELECT-only로 읽어, 현재 파일의 해당 6개 검사를 **정확히 제거**한 격리 합성 legacy 함수와 비교한 결과 **양쪽 PL/pgSQL 본문 747개 SQL 토큰이 일치**했다. 비교는 문자열 리터럴을 보존하고 주석/공백만 제외했으며 실제 운영 SQL 본문을 공개 파일에 게시하지 않았다.

검증 러너 `run-d8k13-sec05-acl-synthetic-pg17.mjs`는 합성 legacy 함수의 **정확한 코드 범위(현재 hardened 5,240 문자 / legacy 5,047 문자)**를 검사한다. JavaScript replacement의 `$'` 후행 문자열 확장 버그를 피하기 위해 문자열 직접 치환이 아니라 콜백 치환을 사용한다. 함수가 변경되면 크기/구문 사전 조건에서 멈추도록 설계했다.

`ranking_snapshots`의 현행 운영 공개 ACL은 `SELECT` 외에 `REFERENCES`, `TRIGGER`, `MAINTAIN` 권한이 `anon`과 `authenticated` 모두에 남아 있다. 최초 SQL의 일부 권한 변경 부재는 후속 실적용 이력 `20260621151304`·`20260621152040`로 설명되지만, 잔여 세 권한에 대한 최소 권한 보강은 운영 변경 승인 대상이다.

## 2. 합성 PG17 테스트가 실제로 수행하는 것

| 검증 대상 | 실제 픽스처 동작 | 성공 조건 |
| --- | --- | --- |
| 초기 역할·ACL | 합성 `anon`·`authenticated`·`service_role` 및 ranking table 두 개 생성 | RLS ON, 공개 역할의 DML 차단, 세 잔여 권한 존재 |
| 운영과 같은 옛 SEC-05 함수 | 현재 GitHub function body에서 오직 6개 NULL check만 제거해 재구성 | 합성 resource ID `NULL`인데도 claim/use가 발생하는 과거 SQL 동작 재현 |
| 과거 동작의 격리 | 해당 호출과 합성 INSERT를 `BEGIN → ROLLBACK`으로 묶음 | grant/use 행 모두 0으로 복귀 |
| Hardened SEC-05 함수 | 같은 함수에서 6개 NULL guard 복구 | 6개 인자 각각 NULL이면 SQLSTATE `22023` 및 예상 오류코드 |
| 정상 claim·재시도 | 가짜 64자 해시/가짜 run ID로 합성 grant 생성 | 정상 claim `claimed`, 같은 fingerprint 재시도 `in_progress`, use count 1 |
| PUBLIC/anon/authenticated | 함수 권한 및 역할 전환의 직접 RPC 거부 | 일반 역할 함수 실행 불가, service_role만 EXECUTE |
| Ranking 잔여 ACL | `REVOKE REFERENCES,TRIGGER,MAINTAIN` 한정, 우선 트랜잭션 ROLLBACK 후 반복 적용 | 세 권한 차단, 기존 `SELECT`와 service_role 권한 유지, RLS 유지, idempotency |
| 기타 테이블 | 합성 `source_rankings` 권한 상태도 재검증 | 공개 역할 쓰기 차단 및 service_role INSERT 보존 |
| 배포 | 아예 구현하지 않음 | 테스트 성공 여부와 무관하게 운영 릴리스 HOLD |

테스트 SQL:
- `tests/fixtures/r16i-d8k13/30_sec05_acl_synthetic_setup_pg17.sql`
- `tests/fixtures/r16i-d8k13/31_sec05_legacy_null_behavior_pg17.sql`
- `tests/fixtures/r16i-d8k13/32_sec05_hardened_null_contract_pg17.sql`
- `tests/fixtures/r16i-d8k13/33_sec05_ranking_acl_minimal_revoke_pg17.sql`

## 3. 로컬 실행 명령

**조건:** clean 별도 K_beauty Git worktree, Node.js, 로컬 Docker Linux engine, **미리 다운로드한 `postgres:17` 이미지**. 원본 dirty Windows worktree와 연결하지 말 것.

```powershell
node scripts/product-evidence/run-d8k13-sec05-acl-synthetic-pg17.mjs --check-files
node scripts/product-evidence/run-d8k13-sec05-acl-synthetic-pg17.mjs
```

Docker runner는 `--pull=never`, `--network=none`, `--tmpfs`, 랜덤 이름, 호스트 포트/volume 없음, 로컬 Docker context만 허용, 실행 종료 시 자동 삭제. DB 연결 URL·운영 credential·고객 데이터는 사용하지 않는다.

**예상 통과 마커(실제 통과 주장 아님):**
- `D8K13_SEC05_ACL_SYNTHETIC_CHECK_FILES_PASS`
- `D8K13_SEC05_LOCAL_PG17_READY`
- `D8K13_SEC05_LEGACY_NULL_REPRODUCED_AND_ROLLBACK_PASS`
- `D8K13_SEC05_HARDENED_NULL_MATRIX_AND_RETRY_PASS`
- `D8K13_SEC05_PUBLIC_RPC_DIRECT_EXECUTE_DENIED_PASS`
- `D8K13_SEC05_RANKING_MINIMAL_ACL_ROLLBACK_PASS`
- `D8K13_SEC05_ACL_LOCAL_DOCKER_PG17_PASS`

**이번 세션에서 실제 완료:** 새 runner와 4 fixture GitHub 반영, `--check-files`를 실제 저장소 파일 6개로 격리 JS 실행해 PASS. 별도의 `verify-d8k13-historical-security-lineage-v1.mjs`와 `verify-d8k13-release-sequence-v1.mjs`도 실제 GitHub 입력으로 offline PASS/HOLD, `--enforce-release` exit 3. **현재 컨테이너는 Docker 엔진·PostgreSQL 서버 바이너리가 없어 native SQL 단계는 실행되지 않았다.** 따라서 위 모든 SQL 결과 마커는 아직 `NOT_RUN`으로 관리한다.

### Windows clean-worktree 실행 도우미

별도 Windows 검증 worktree를 재사용하는 경우 `scripts/product-evidence/run-d8k13-sec05-acl-local-windows.ps1`에서 GitHub origin, dirty 여부, 허용된 별도 경로를 검사하고 **기능 테스트 코드가 고정된 커밋 `3a59bb2bae80c1ac033325ec536f973abb0eabb0`**을 체크아웃한 뒤 `node --check`, `--check-files`, Docker PG17 테스트를 순서대로 실행한다.

```powershell
powershell -NoProfile -File .\scripts\product-evidence\run-d8k13-sec05-acl-local-windows.ps1
```

기본 대상은 `D:\cha\K-beauty-D8K13-verify`이며 원본 `D:\cha\K_beauty`와 dirty 검사 worktree는 실행을 거부한다. 로컬 로그 파일 경로는 종료 후 `D8K13_SEC05_ACCEPTANCE_LOG=...`로 출력된다. 도우미의 Git fetch/clean verify 체크아웃은 **로컬 합성 검증 준비 작업**일 뿐 hosted DB 및 운영 배포 작업이 아니다. 현재 서버에서는 PowerShell·Docker 실행 환경이 없어 **도우미 실제 Windows 실행은 NOT_RUN**이다.

## 4. 보안·승인 경계

- 과거 SQL에서 NULL 매개변수 수용이 실제로 성공했다는 사실을 운영 DB에서 호출해 증명한 적은 없다. 현재 747-token 동등성은 코드 출처 증빙, 합성 PG17 테스트는 후속 실행 대상이다.
- 이후 Docker 통과하더라도 **운영 SQL 함수 CREATE OR REPLACE / REVOKE / migration repair를 자동 수행하지 않는다**. 실제 최소 권한 정책, 기존 함수에 대한 접근성, retry/fencing, 백업/복원과 해당 PR의 역사 정합성 검토가 별도 필요하다.
- 공급망 보안 `#1208`, 독립 OWNER/검토자, 전체 178건의 마이그레이션 재현, Crawler delimiter/Taxonomy8 history 및 운영 릴리스 승인 미충족. D8K-13 PR은 Draft/HOLD다.

**최종 판정: `SEC05_RANKING_PG17_TEST_FIXTURES_READY / LOCAL_CHECK_FILES_PASS / NATIVE_PG17_NOT_RUN / HOSTED_RELEASE_HOLD`.**


## 2026-10-17 집 PC 실제 SEC-05/Ranking ACL PG17 결과 — 부분 시험 PASS

사용자가 2026-10-17 16:52–16:53 KST Windows에서 직접 실행한 **독립 Docker PostgreSQL17 합성 테스트가 종료코드 0 및 `D8K13_HOME_PG17_TEST_PASS`로 완료**됐다. 고정 코드 버전 `0832a7f964cb68aa7fb057eba654343f46214cfa`의 소스 6개 Git blob 검증을 통과했다. 읽기 가능한 최종 마커에 `D8K13_SEC05_HARDENED_NULL_MATRIX_AND_RETRY_PASS`, `D8K13_SEC05_PUBLIC_RPC_DIRECT_EXECUTE_DENIED_PASS`, `D8K13_SEC05_RANKING_MINIMAL_ACL_ROLLBACK_PASS`, `D8K13_SEC05_ACL_LOCAL_DOCKER_PG17_PASS`가 모두 있었다.

**로그의 제한:** `D8K13_SEC05_LOCAL_PG17_READY`와 `D8K13_SEC05_LEGACY_NULL_REPRODUCED_AND_ROLLBACK_PASS` 표시는 제출된 PowerShell transcript에 직접 남지 않았다. 고정된 러너의 제어 흐름상 두 단계가 통과하지 않았다면 최종 마커에 도달할 수 없으므로 **러너 전체 성공의 간접 근거**로 수용했다. 원시 `psql` statement별 출력이나 hosted에서의 실제 NULL 호출 성공을 검증했다고 주장하지 않는다.

독립 근거: [2026-10-17 home Windows 로컬 PG17 acceptance](./r16i-r4-d8k13-home-sec05-acl-pg17-acceptance-20261017.md). 사용자 로그 SHA256 `72ad32e76230dc0859ed4ce446269fa9d0fd7cf123d540a443094d0fa99c52fe`. 원본 로그와 PC 사용자명/경로는 공개 저장소로 업로드하지 않았다.

**이번 테스트의 결론은 `SEC05_RANKING_SCOPED_SYNTHETIC_PG17_PASS`이다. `D8K13_HOSTED_RELEASE_HOLD`는 그대로 유지**된다. 전체 178개 migration replay, Crawler parser, backup/PITR 복원, independent OWNER, #1208, 그리고 운영 권한/함수 수정에 대한 명시적 승인은 미완료다. 이 문서 상단의 "Native PG17 NOT_RUN" 기록은 **2026-10-16 당시 상태**이며 이 2026-10-17 후속 증거가 해당 부분만 갱신한다. 실제 운영 DB는 변경하지 않았다.
