# D8K-13 운영 적용 준비/차단 판정 v1 — 2026-10-16

> **운영 DB에 적용하지 않는다.** 본 문서는 PR #1341에서 구현된 격리 기능의 **릴리스 전 읽기 전용 검수와 진행 순서**다. 코드의 Node 및 격리 Docker PG17 검증 PASS와 운영 적용 승인/복구 가능성은 구분한다. 운영 데이터·권한·배포·상품·Offer·가격·CTA 변경, PR 머지는 별도 명시적 승인이 필요하다.

## 0. 근거 및 확인 시각

2026-10-16 12:43–12:46 KST, Supabase 운영 프로젝트에 SELECT/metadata 조회만 수행:

| 관측 항목 | 값 |
| --- | --- |
| PostgreSQL | 17.6 (Supabase 연결 프로젝트, HEALTHY) |
| 운영 적용된 migration 수 및 마지막 버전 | 178개, `20261012181544` |
| R16I `evidence` | 2건, `official_single` 1 / `hwahae_bundle` 1, 원본 `UNVERIFIED` |
| 기존 `verdict` | 2건 모두 `VERIFIED`; 2건 모두 자기 승인 |
| 제안/결정/D8D v1 application/event | 모두 0건 |
| 활성 OWNER | 1명 |
| R16I release gate | OFF |
| D8K-12 이벤트 테이블·RPC / D8K-13 snapshot | 미설치 |
| D8D v2 application/authorization/offer tables | 미설치 |
| 서비스 역할의 기존 verdict 직접 권한 | `SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER` (D8K-12 변경은 미적용) |
| 백업 시점, PITR 활성화, 복원 시험 | **확인 불가 — 운영 승인 차단** |

원본 캡처의 bytes, 저장 경로, `submitted_by`/reviewer 실제 UUID, 기존 판정 사유·요청 ID 등은 공개 저장소와 이 문서에 남기지 않는다. 특정 대상을 확정하는 `source_key:evidence_id:verdict_id` **원문 매니페스트는 접근 통제된 승인 기록에서만** 관리한다. MD5/해시만으로 승인된 매니페스트를 대신하지 않는다.

## 1. 릴리스 순서 P0 — 조건부 호환 코드 작성, 실제 순서 검증 대기

| 시점 | 파일/상태 |
| --- | --- |
| Hosted last applied | `20261012181544` |
| 미적용이며 현재 저장소에 있는 선행 SQL | `supabase/migrations/20261014150000_taxonomy_ai_r16i_d8d_v2_owner_gated_dual_offer.sql` |
| 후행 통합 SQL | `supabase/migrations/20261015185000_taxonomy_ai_r16i_d8k12_owner_review_revocation_v1.sql` |

확정된 모순:

- D8D v2 선행 SQL은 `admin_r16i_d8d_v2_applications`, `admin_r16i_d8d_v2_owner_authorizations`, `admin_r16i_d8d_v2_application_offers`를 **생성한다**.
- 최초 검수 시점 D8K-13은 위 세 테이블 중 하나라도 존재하면 `D8K13_UNEXPECTED_LEGACY_SCHEMA`로 중단했다. **현재 Draft 코드에서는 실제 D8D v2 테이블 5개·RPC 2개가 완전 설치되고, 컬럼/타입/RLS/권한이 예상과 동일하며, v2 게이트 OFF·이력 0건인 경우만 호환 후보로 허용한다.** 부분 설치·이력·권한/스키마 drift는 거부한다.
- 공식 Supabase CLI 문서에서 `supabase db push`는 적용되지 않은 **모든 로컬 migration**을 실행하며, `--dry-run`은 적용 대상 목록만 미리 보여 준다. 조건부 호환 소스를 작성했지만, **실제 PG17 검증과 전체 pending migration 의존성 검수가 끝나기 전에는 릴리스 경로가 확정되지 않았다**. 운영 DB 변경은 없었다.

**안전하게 다음 중 하나의 릴리스 설계를 별도 리뷰/합성 PG17 테스트로 확정해야 한다.**

- **안 A — 정상 순서 호환**: D8D v2가 정확한 예상 스키마로 설치되어 있고 owner authorization/application/offer 등 관련 테이블에 이력이 **전혀 없음**을 검증하는 보호된 경로를 설계한다. D8D v2 SQL 원문 스키마·권한·사이드이펙트와 동시성 로직을 실제로 재현한 PG17 통합 테스트가 필요하며, 미확인 또는 데이터가 한 건이라도 있으면 계속 거부한다. 기존 `VERIFIED` 자가 승인 2건 및 릴리스 게이트 OFF 검증은 절대로 완화하지 않는다.
- **안 B — 명시적 승인된 별도 적용 순서**: 전수 미적용 migration 목록과 의존성을 확인하고, DBA/운영 승인 아래 통합 부트스트랩을 D8D v2보다 먼저 적용하는 합법적인 절차를 새로 설계한다. 적용 기록을 거짓으로 표시하지 않으며, 타임스탬프를 임의 수정하거나 `supabase migration repair`를 통과 수단으로 악용하지 않는다. 마이그레이션 이력과 이후 표준 적용 순서를 일관성 있게 보장해야 한다.

**안 A는 Draft 코드 수준에서 구현됐지만 이 기록 당시 신규 HEAD의 실제 PG17 통과 증거가 없다. 안 B는 미구현이다. 어느 안도 운영 적용 승인은 없다.** 별도 승인 전 `supabase db push`, `supabase migration repair`, 운영 SQL 실행을 금지한다.

별도 로컬 파일 진단: `node scripts/product-evidence/verify-d8k13-release-sequence-v1.mjs`. **읽기 전용·네트워크 없음·릴리스 HOLD**만 판정. `--enforce-release` 옵션은 의도적으로 nonzero 종료하며 실제 배포 명령이 아니다. 도구 출력에 `status: HOLD`이면 진단의 목적대로 동작한 것이다.

## 2. 운영 사전 승인 게이트

**다음 조건이 모두 충족되어야만 실제 운영 변경에 대한 별도 승인을 요청할 수 있다.**

1. **릴리스 경로:** D8D v2 순서 충돌 해결, `supabase db push --dry-run` 또는 동등한 **읽기 전용** 운영 migration 목록 대조, 예상 밖 DB delta=0, 전체 체인에 대한 격리 PG17 통합 검증 통과. CLI 옵션은 도입된 설치 버전 `supabase db push --help`로 재확인.
2. **복구 능력:** [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups) 대시보드에서 실제 복구 가능한 백업의 존재·타임스탬프·복구 방식(PITR 포함)을 운영자가 검증한다. **연결 API는 이 프로젝트의 사용 가능 백업과 복구 시험을 확인하지 못했다.** 복원 시험이 수행되지 않았다면 승인 보류. DB 백업은 Storage 객체 **실제 파일 bytes를 포함하지 않으므로**, 캡처 객체 보존 정책을 별도로 확인한다. 운영 복구 시 다른 정상 사용자 데이터의 손실·다운타임 영향까지 평가.
3. **정확 대상:** read-only `scripts/product-evidence/sql/d8k13-legacy-self-review-readonly-preflight-v1.sql` 재조회에서 **2건의 자기 승인, 원본 상태/출처, 0건의 후속 적용, 비활성 게이트**가 변하지 않았음을 확인. 오프라인 두 번째 승인자에게 **실제 증빙 UUID + verdict UUID** 매니페스트를 비공개로 제시하고 서명/확인. 실행 세션이 스스로 추출한 ID를 기대 매니페스트로 복사해서는 안 됨.
4. **인증·권한:** 격리 코드는 원래 제출자/검토자를 꾸며내지 않는다. 별도 실제 독립 검토 계정이 확보되지 않은 상태이므로 신규 `VERIFIED` 근거가 없으며, 운영 릴리스 게이트는 계속 OFF.
5. **릴리스 변경권한:** 사용자와 운영 담당자가 정확한 DB·코드 SHA·릴리스 티켓·유지보수 시간·복구 책임자·검증자·중단 기준을 **명시적으로 승인**. Supabase 키/접속 문자열/운영 식별자는 PR 댓글·콘솔 출력·스크립트에 남기지 않는다.
6. **보안:** [공급망 이슈 #1208](https://github.com/gycha0109-beep/K_beauty/issues/1208) OPEN 해소 및 전체 CI/보안 관리자 재검증. 단순 예외 만료 연장 금지. Supabase Security Advisor의 RLS 정책 부재 INFO는 내부 서비스 전용/기본 거부 테이블의 의도 여부를 별도 확인해야 하며, `anon/authenticated` 접근을 무조건 허용하지 않는다.
7. **프로덕트 불변:** 가격·구매 링크·Offer·Product/Subject·랭킹·Storage 객체 변경 권한 없음, 원래 160ml vs 정정 예정 80ml는 별도 상품 정합성 리뷰 대상.

## 3. 승인된 릴리스에만 적용할 실행 순서 (현재 실행 금지)

1. 작업 대상 프로젝트 ID·데이터베이스·정확 커밋과 미적용 migration dry-run 결과를 독립적으로 교차확인. `D8K-13`이 실제 릴리스 대상인지, 기존 D8D v2 등 모든 선행 migration 영향을 승인서에 명시.
2. 백업 가능 시간대 확보, DB·Storage 원본 보존과 복원 시험 문서 검토. 쓰기 트래픽을 통제할 수 없으면 중단.
3. 실행 전 읽기 전용 스냅샷 및 비공개 매니페스트 재확인. 릴리스 티켓과 비공개 매니페스트는 **운영자가 통제하는 동일한 세션/트랜잭션 경계에서만** 설정하고, SQL runner의 세션·트랜잭션 의미가 로컬과 일치하는지 검증. 커밋/실행 명령을 본 문서에 자동화해서 제공하지 않음.
4. 스키마 drift, lock timeout, 예상 밖 계정/판정, 사전조건 위반, D8D 기존 적용 행, 감사 보존 오류, 배포 중 연결 단절 등이 발견되면 중단. 임의로 `DISABLE TRIGGER`, RLS 해제, `DELETE`, `TRUNCATE`, 우회 GUC를 사용하지 않는다.
5. 합성 PG17에서 이미 검증한 원자적 기준: 기존 verdict 사유·검토자·요청 ID·시각 보존 스냅샷 2, `LEGACY_QUARANTINED` 2 이벤트, 현재 `REJECTED` 2/`VERIFIED` 0. 단, **실제 운영에서 이 조건을 충족했다고 아직 주장할 수 없다**.
6. 코드 배포와 DB 변경의 순서를 일치시키고 관리자 읽기·호출이 `LEGACY_QUARANTINED`를 일반 독립 `VERIFIED`로 보이지 않게 검증. 상품·Offer·CTA는 계속 HOLD.
7. 완료 후 사용자에게 변경 실행 여부, 기록/행 건수, 실측 근거, 실패/롤백 여부와 보안 게이트를 보고한다. 통합 실행을 하지 않은 경우 작업 상태는 **CODE ACCEPTANCE PASS / HOSTED NOT APPLIED**로 유지.

## 4. 실패 및 사고 대응

- **트랜잭션 실패/사전조건 거부:** SQL 전체 ROLLBACK; D8K-13 스냅샷·이벤트가 남지 않아야 하고 기존 판정이 그대로 유지되는지 읽기 전용 검증한다.
- **DB 연결 끊김/타임아웃:** 결과를 성공으로 추측하지 않는다. 운영 변경 승인자에게 즉시 에스컬레이션하고 `schema_migrations`, 원본·snapshot·events·gate 상태를 **읽기 전용**으로 검사한 뒤 단일 재실행 가능성 판단.
- **커밋 이후 이상 발견:** `REJECTED→VERIFIED` 임의 복원 금지. 기존 감사 기록을 보존하며 영향 범위·실제 DB 복원 시점·Storage 파일 보존 상태·다른 고객 레코드의 피해를 평가하고, 필요하면 별도 사고 대응 승인에 따라 복구한다. 운영 복원 작업 자체도 별도 명시적 승인이 필요.

## 5. 2026-10-16 결론

- **확인됨:** 2026-10-16 학원 PC D8C/D8K11/D8K12/D8K13 Node+격리 PG17 합격; 운영 읽기 전용 판정 2건/게이트 OFF; PR #1341 Draft; #1208 OPEN.
- **P0 대응 중:** D8D v2 선행 설치를 예상하되 **정확한 스키마·RLS·APPLY INVOKER/ROLLBACK DEFINER·제한된 실행 권한·게이트 OFF·이력 0건**인 경우만 허용하는 조건부 코드를 작성했다. 신규 실제 순서 PG17 검증 전에는 HOLD.
- **미확인:** 적용 경로, 운영 백업/PITR 및 복원 시험, 독립 검토자, 공급망 보안 해결, 실제 운영 migration 계획. 운영 데이터는 전혀 변경하지 않았다.
- **출시/운영 판정: HOLD.** 마이그레이션 일괄 적용, 수동 DB 쓰기, 병합, 배포 모두 금지.


## 6. 조건부 D8D v2 호환 코드와 테스트 (2026-10-16)

- 통합 SQL은 **D8D v2 advisory lock (195721,16)을 Product 행 락보다 먼저 확보**해 v2 APPLY와 잠금 순서를 맞춘다. D8D v1은 기존 Product 행 락으로 직렬화한다.
- D8D v2 테이블 다섯 개(게이트, OWNER 승인, 적용, 적용 Offer, 이벤트)와 보호된 RPC 두 개가 모두 없으면 **기존 v1-only 두 건 경로**, 모두 있으면 **정확한 설치 상태 검증 경로**, 일부만 있으면 **거부**다.
- v2 스키마가 존재할 때에는 5개 테이블의 컬럼 **이름·타입 정확히 일치**, base table/RLS, RPC는 **APPLY=`SECURITY INVOKER`, ROLLBACK=`SECURITY DEFINER`**로 각각 원본 계약과 일치하고, **두 함수 모두 `service_role`만 EXECUTE 가능**하며 `anon`·`authenticated`에는 실행 권한이 없어야 한다. service_role 게이트/승인 테이블 직접 쓰기 불가 및 브라우저 읽기 불가를 검증한다. v2 게이트 `false`, 변경 티켓 `NULL`, OWNER 승인·적용·Offer·이벤트 0건을 강제한다.
- 원문 D8D v2 SQL을 수정하지 않고 합성 PG17에서 먼저 실행하도록 `run-d8k13-local-pg17.mjs`에 순서 재현을 추가했고, v2 게이트 ON, 승인 이력, 컬럼 드리프트, 권한 상승, 익명 SELECT, 테이블 누락을 각각 롤백 검증한다.
- 합성 fixture: `05_d8dv2_existing_catalog_pg17.sql`, `20_d8dv2_chain_runtime_pg17.sql`. Product/Offer 실제 행 데이터나 운영 계정 정보는 사용하지 않는다.
- 별도 릴리스 진단기는 조건부 코드 존재를 인식하지만 여전히 `status=HOLD`, `--enforce-release` 실패를 유지한다.
- **검증 상태:** 소스 작성 및 정적 검수까지 수행했다. 실제 PostgreSQL 테스트의 신규 HEAD 통과 결과는 아직 확인되지 않았다. 보안 #1208, 백업/복원 불명, 독립 OWNER 부재 등도 남아 있다.


## 7. 2026-10-16 학원 실제 PG17 실패 및 수정 (재검증 전)

- 로그: `D8K13-acceptance-20261016-134623.log`, HEAD `3d447fc560ff4c306be4fe762cdcb0cb414532ca`. D8C(23), D8K11(464), D8K12(80), D8K13(78) Node 계약, D8K12 PG17, D8K13 v1-only 2건 격리 및 drift/rollback은 **PASS**.
- 이어서 수행한 **D8D v2 실제 SQL → 통합 마이그레이션**은 `D8K13_UNEXPECTED_D8DV2_SECURITY`로 중단, 새 ordered-chain PASS 마커는 없음. 임시 컨테이너 정리는 완료.
- 원인 확정: 기존 D8D v2 원본 SQL은 `r16i_d8d_apply_v2(...): SECURITY INVOKER`, `r16i_d8d_rollback_v2(...): SECURITY DEFINER`. 반면 기존 D8K-13 guard는 두 RPC가 모두 INVOKER라고 잘못 가정해 정상 원문 설치를 거부했다. 운영 DB의 실제 권한 이상이 아니다.
- 보정: 통합 migration이 **서로 다른 원본 보안 속성**을 명시적으로 검사하고, 두 RPC의 `service_role EXECUTE` 허용 / `anon,authenticated EXECUTE` 차단을 추가로 검증한다. 기존 이력·게이트·권한·스키마 mismatch FAIL-CLOSED는 유지한다.
- 추가 테스트: rollback 함수의 INVOKER 변형, 익명 RPC 실행 허용, service_role RPC 실행 권한 제거를 각각 거부하는 합성 PG17 부정 시나리오 3개.
- **현재 결론:** 새로운 guard/runner 계약의 source 일치 여부는 검사했으나, 수정된 HEAD의 native PG17 성공은 **아직 확인되지 않았다**. 재검증 전 릴리스 HOLD. 이 수정은 운영 DB나 원본 D8D v2 migration을 건드리지 않았다.


## 8. D8D v2 스키마 검사 실패 — 학원 PC 2026-10-16 14:15

- 증빙 로그: `D8K13-acceptance-20261016-141507.log`, HEAD `2b5ee7241a5dbb4887d12d1e0e85b49c4c6fdbbe`.
- **PASS:** D8C 23 부정 케이스, D8K11 464 assertions, D8K12 80 assertions, D8K13 85 assertions, release-sequence 정적 진단 HOLD, D8K12 PG17, D8K13 기존 자기 승인 2건 격리 및 v1-only drift rollback.
- **FAIL:** 실제 D8D v2 마이그레이션 원문을 선행 적용한 뒤 D8K-13 통합 SQL에서 `D8K13_UNEXPECTED_D8DV2_SCHEMA`, SQL 입력 223줄 / PLpgSQL 166줄. v2 순서 체인 PASS 마커는 출력되지 않았다. 임시 Docker 컨테이너는 정리.
- 원본 D8D v2 SQL과의 정적 대조에서는 5개 테이블의 46개 컬럼 이름·타입이 모두 일치했다. `pg_catalog.format_type` 표기와 SQL 이름 정렬 차이 여부를 운영 DB에 **읽기 전용**으로 검토했으나 정적 조회만으로는 정확한 실패 테이블/원인을 확정하지 못했다. **특정 원인으로 단정하지 않는다.**
- 수정 코드: 위치 민감한 두 배열의 정렬 비교를 **양방향 `EXCEPT` 집합 일치 + 정확한 개수 일치**로 바꾸고, RLS/relkind와 실제·기대 열 목록 실패를 구분하여 안전한 컬럼명/타입 진단을 오류 문자열에 포함한다. 타입 drift 부정 사례도 추가한다. 무조건적인 스키마 허용이나 예상 밖 컬럼 무시는 금지.
- 기존 보호: 레거시 2건·티켓·사전 승인된 매니페스트, D8D v1/v2 이력 0건·게이트 OFF, 서비스 권한·RPC 호출 제한, 트랜잭션 롤백, 전체 레코드 보존.
- 새 HEAD의 Node/실제 Docker PG17 재검증 **아직 미완료**. 다음 재검증에서 동일한 오류가 나면 `D8K13_UNEXPECTED_D8DV2_SCHEMA table=... actual=... expected=...` 진단을 근거로 수정한다. 운영 DB 변경·머지·배포는 HOLD.



## 9. Docker PostgreSQL 임시 서버 기동 경합 (2026-10-16 14:30 로그)

- 증빙 로그: `D8K13-acceptance-20261016-143050.log`; 검증한 HEAD `d18cc672d71b5f5c5cff01e77d245d479f4cdc50`.
- **PASS:** D8C 23 부정 사례, D8K11 464 assertions, D8K12 80 assertions, D8K13 88 assertions, 릴리스 시퀀스 정적 진단의 의도된 HOLD, SQL 소스 파일 사전 검사.
- **중단:** PostgreSQL 서버에 대한 첫 실제 연결 시 Unix 소켓 `/var/run/postgresql/.s.PGSQL.5432`를 찾을 수 없다는 오류. 이전 PG17 성공 마커는 이번 로그에 없으며 **신규 D8D-v2 → D8K-13 마이그레이션 SQL은 실행되지 않았다**. 임시 Docker 컨테이너 정리는 출력으로 확인.
- **원인 후보(강함):** 기존 러너의 소켓 `pg_isready`는 공식 postgres 이미지의 initdb 중 **임시 socket-only PostgreSQL 서버**에도 성공할 수 있고, 그 서버가 종료되어 정식 서버로 재시작되는 사이 첫 `psql`이 소켓 누락으로 실패할 수 있다. 이 로그만으로 Docker의 모든 기동 경합 가능성을 확정할 수는 없다.
- **수정:** Docker `--network=none` 격리를 유지한 채 **컨테이너 내부 127.0.0.1 TCP pg_isready + 실제 인증 SELECT(version=17) 성공**을 반드시 확인한다. 임시 socket-only 서버는 이 검사를 만족하지 못한다. 최대 120회/500ms 준비 확인, 실패는 `PG17_FINAL_TCP_SERVER_NOT_READY`로 명시한다. 정식 서버가 검증되면 `D8K13_PG17_FINAL_TCP_READY`를 출력한 뒤 기존 SQL 테스트를 시작한다.
- 기존 원본 worktree, 운영 DB, Product/Offer/권한/릴리스 게이트 변경 없음. 격리된 throwaway Docker PostgreSQL만 사용한다.
- **현재 결과:** 수정 코드 작성, 새 HEAD 실제 native PG17 재검증은 아직 미완료. 이후 SQL 스키마 비교가 여전히 실패하면 `D8K13_UNEXPECTED_D8DV2_SCHEMA table=... actual=... expected=...`의 구체적인 값을 근거로 분석한다. 운영 적용·머지·배포는 **HOLD**.



## 10. 전체 migration 체인 별도 P0 — 153개 vs 운영 178개 (2026-10-16)

D8D v2 → 통합 D8K-13 **부분 체인의 실제 합성 PG17 PASS(커밋 `f7455eb1`)** 이후, 저장소의 **모든** SQL migration 153개와 운영 applied VERSION/NAME 178건을 읽기 전용으로 대조했다. 전체 적용 순서 자체는 아직 승인이 불가능하다.

- 버전·이름 둘 다 일치 **103**; 같은 버전·다른 이름 **1**; 같은 이름·다른 버전 **41**; 로컬 이름이 운영에 없는 SQL **8**; 운영에 적용됐으나 현재 로컬 대응 이름이 없는 SQL **34**.
- 로컬 버전 자체가 운영 적용 이력에 없는 SQL은 **49**(운영 마지막 버전 이하 **45**, 이후 **4**).
- **중복 버전 1그룹:** `20260824` 접두사를 두 SQL이 공유. 14자리 migration 버전이 아닌 8자리 파일도 7개.
- 오래된 5개 이름 미대응 중 영문 이름·Taxonomy2·UVA Registry 객체는 실제 운영에 존재하지만 같은 SQL 본문이 적용됐다고 입증하지는 못함. Bushman 인증 관련 두 SQL의 새 테이블/함수는 운영에 존재하지 않음.
- 운영 버전 `20261012181544`로 기록된 `trust_p2c_visible_identity_dispositions_v1`는 로컬에서 `20261012190000`; 신규 적용을 자동화하면 안 됨.

**증거·재현 절차**
- `docs/taxonomy-ai/r16i-r4-d8k13-full-migration-chain-readonly-audit-20261016.md`
- `scripts/product-evidence/baselines/d8k13-hosted-migrations-readonly-20261016.json` (민감 정보 없는 VERSION/NAME read-only 스냅샷)
- `node scripts/product-evidence/verify-d8k13-migration-chain-readonly-v1.mjs --full` (로컬 파일 비교·네트워크 없음)
- `node scripts/product-evidence/verify-d8k13-migration-chain-readonly-v1.mjs --enforce-release` 및 기존 `verify-d8k13-release-sequence-v1.mjs --enforce-release`는 **각각 종료코드 3**, 릴리스 HOLD.

**이력 이름 일치만으로 배포된 SQL 본문의 SHA/논리 동일성을 증명하지 못한다.** 승인된 배포 artifacts로 41개 timestamp 변화와 운영-only 34개를 복원하고, 5개 오래된 미대응 SQL의 의도적 미배포 여부를 결론낸 뒤에야 전체 PostgreSQL 17 history replay 테스트를 설계해야 한다. `supabase db push`, `supabase migration repair` 및 운영 SQL 수동 실행은 계속 금지한다.

검증된 D8K-13 원본 SQL·Node 격리 코드는 **변경하지 않았다**. 신규 검사·보고·이력 snapshot만 Draft PR에 추가했다.


## 11. Git Blob 지문 기반 운영 migration SQL 실증 (2026-10-16 후속)

운영 DB의 `supabase_migrations.schema_migrations.statements` 배열이 178건 전부 SQL 본문을 보존함을 확인했다. 본문은 공개 저장소에 노출하지 않고 PostgreSQL `extensions.digest`로 Git blob SHA를 직접 계산했다.

- 서로 다른 버전이나 같은 이름으로 운영에 기록된 41개 중 **34개 현재 GitHub 파일과 정확히 일치**(원문 29 / 마지막 LF 보정 5). **7개는 원문 바이트 불일치**.
- 7개 중 `data_ai29c_shadow_transport_fallback`은 배포 당시 Git 커밋 `9c562c54101f` SHA와 일치하므로 실재했던 버전을 복원했다. `face_lab_v2_persistence_revision`은 앞 LF 하나의 차이, `data_taxonomy3_product_exact_equivalence_v1`은 SQL 트랜잭션 래퍼의 차이다.
- **주요 P0:** `data_taxonomy8_nullable_legacy_category_projection_v1`의 운영 기록은 `products.category DROP NOT NULL` 한 문장(64 bytes)만 보유하며 현 저장소 SQL과 범위가 다르다. `data_ai29c_c5b_subject_presentation_identity_correction_v1`도 적용된 SQL 본문과 현 파일이 단순 줄바꿈 수준을 넘어 다르다.
- 34개의 운영 이력-only migration SQL 내용은 모두 복원 가능하게 보존되어 있으나 GitHub 공개 복원은 하지 않았다. credential 폐기 관련 `v21_admission_g3a_emergency_revoke_exposed_runtime_password`는 보안 검수 이전 원문 출력/공개 금지.
- **추가 발견:** 버전·이름 모두 일치하는 103건에서도 현 파일과 Git blob 일치는 57건뿐이다. 나머지 46건 가운데 SQL이 복수 statement로 저장된 28건 및 단일 statement인데도 일치하지 않은 18건을 별도 분석해야 한다.

근거 보고서: [운영 SQL 본문 지문 감사](./r16i-r4-d8k13-hosted-sql-provenance-hash-audit-20261016.md). 증빙용 개인/비밀번호/운영 SQL 원문은 PR에 기록하지 않음. 읽기 전용 해시 일치는 **운영 적용 이력의 파일 출처**에 관한 증거이지 배포 승인·DB 복원 성공을 의미하지 않는다.

**현 판정: 격리 Docker PG17 부분 체인 PASS / 역사적 SQL provenance 일부 복원 / 전체 migration history·보안·복원·독립 OWNER HOLD.**


## 12. Taxonomy8/C5B·46건 추가 검증 (2026-10-16)

운영 SQL stored body와 실제 함수/권한을 SELECT-only로 확인한 후, 전체 이력의 동일 버전·이름인데 body가 미입증이던 **46건**을 재분류했다. 세부 자료: [Taxonomy8/C5B/46건 심층 감사](./r16i-r4-d8k13-tax8-c5b-46-sql-drift-triage-20261016.md).

- **Taxonomy8:** 실제 적용 이력은 `products.category DROP NOT NULL` 64-byte DDL 1건. 현재 파일의 사전 보호 DO와 COMMENT 등은 migration 당시 실행 증거가 없다. 현재 운영 category는 nullable이고 COMMENT 및 관련 taxonomy 객체는 존재. 전체 파일 반복 실행은 금지한다.
- **DATA-AI29C C5B:** migration 하네스의 preflight/ACL postcheck는 실제 적용 원문과 다르지만, **과거 저장된 함수 body와 현재 GitHub, 현재 live 함수 body는 1,203개 SQL 토큰 모두 일치**. 현재 service_role만 실행 가능. 과거 pre/post guard 실제 적용 여부는 별도 미확인.
- **동일 버전·이름 해시 불일치 46건:** 단일 statement 18건은 양끝 개행 정리 후 Git blob 일치 6, SQL 토큰 일치 5, 말미 세미콜론 차이 6, crawler PLpgSQL delimiter 이슈 1로 분류.
- **복수 statements 28건은 모두 토큰 재조립 검증 수행:** 1건 완전 일치, 25건 말미 세미콜론만 다름, **2건 실제 토큰 차이**. 단순 blob 동일성 또는 역사적 실행권한 동등성은 주장하지 않는다.
- **랭킹 계보 추적:** 최초 SQL에 빠진 ranking_snapshots 명시적 ACL은 후속 운영 적용 이력 `20260621151304`(REVOKE/GRANT), `20260621152040`(TRUNCATE REVOKE)에서 확인. 현재 ranking_snapshots/source_rankings는 RLS ON, anon/authenticated 직접 쓰기 DENY. **source_rankings 명시적 ACL 출처는 일부 미확인**.
- **P0 #2 익명 쓰기 grant:** 현재 운영 `claim_anonymous_write_grant` 함수 정의에서 현재 GitHub SQL의 `IS NULL` 초기 검사 부재. 현재는 SECURITY INVOKER이고 해시 형식 검사는 존재하나 악용 여부 불명. 별도 보안 리뷰 필요.
- P0 crawler delimiter 차이도 별도 native PG17 파서 검수 대상으로 유지한다.

새 evidence JSON `d8k13-hosted-same-version-sql-triage-readonly-20261016.json`은 SQL 원문을 게시하지 않고 결과·Git blob SHA만 저장한다. 오프라인 provenance verifier와 release gate의 manifest count guards에 연결했다.

**여전히 전체 178 migrations의 parser/DB rollback equivalence, 백업/PITR 복원, 독립 검토자, supply-chain #1208, 실제 배포 승인 미충족. PR Draft/운영 migration·DDL·DML·머지·배포 HOLD.**


## 13. 랭킹 ACL 후속 복구 이력 및 익명 쓰기 server-only 검증 (2026-10-16 16:34 KST)

실제 운영 `schema_migrations.statements`를 SELECT-only로 다시 검토해 `ranking_snapshots`의 일반 사용자 쓰기 REVOKE 및 service_role GRANT가 **후속 이력 `20260621151304`**에서, TRUNCATE REVOKE가 **`20260621152040`**에서 시행된 증거를 확인했다. 해당 테이블의 현재 RLS/권한은 보호 상태이며 초기 이력의 ACL 누락은 적어도 일부 후속 repair로 설명된다. `source_rankings`의 모든 명시적 ACL 이력은 아직 확정되지 않았다.

익명 쓰기 `claim_anonymous_write_grant`는 운영에서 **SECURITY INVOKER / service_role 전용 EXECUTE / PUBLIC·anon·authenticated EXECUTE 거부**다. 현재 서버 소스는 HMAC 서명, anonymous cookie principal 결속, 리소스 경계, fingerprint 및 필수 입력 검사 후 claim RPC를 호출한다. 다만 운영 DB 함수에 현재 GitHub migration의 명시적 `p_* IS NULL` 검사가 없고 PostgreSQL의 UNKNOWN 논리가 적용된다. **공개 호출 우회가 확인된 것이 아니라 DB 함수 레벨의 defense-in-depth 보강 필요 항목**이며 사용자 영향·악용 여부는 검증되지 않았다.

근거: `docs/taxonomy-ai/r16i-r4-d8k13-ranking-acl-anonymous-grant-security-lineage-20261016.md`; 운영 SELECT-only 사전 점검 `d8k13-historical-drift-readonly-preflight-v1.sql` 재실행 PASS, 오프라인 `verify-d8k13-historical-security-lineage-v1.mjs` 실제 코드 10개를 입력으로 검증 PASS/HOLD(일반 exit 0, enforce-release exit 3).

**D8K-13 합성 Docker PG17 부분체인은 기존 PASS 유지.** 전체 178건 history 복원, crawler 파서, 백업/PITR, 독립 reviewer, 보안 #1208, NULL 방어에 대한 별도 승인·격리 PG17 테스트 전 운영 SQL/DDL/DML/repair/머지/배포 전부 HOLD.


## 14. PG17 공개 역할 잔여 권한 — 보안 승인 별도 차단 (2026-10-16 16:43 KST)

운영 `ranking_snapshots`는 `anon/authenticated` INSERT/UPDATE/DELETE/TRUNCATE가 차단돼 있으나 **REFERENCES / TRIGGER / MAINTAIN** 권한이 여전히 있는 것을 `relacl`과 `has_table_privilege`로 확인했다. 두 역할의 `public` schema CREATE 권한은 없으며, `source_rankings`에는 같은 공개 권한이 없다. 두 테이블 RLS ON. **침해·실질 악용 가능성은 미확인**이지만 최소 권한 검토가 추가로 필요하다.

현재 읽기 전용 SQL `d8k13-historical-drift-readonly-preflight-v1.sql`은 2026-10-16 16:43:50 KST에 정상 실행·`READ_ONLY_HOLD`를 반환했다. 메타데이터 snapshot과 `verify-d8k13-historical-security-lineage-v1.mjs`·`verify-d8k13-release-sequence-v1.mjs`도 해당 위험을 릴리스 차단 입력으로 반영한다.

[Ranking ACL·SEC-05 독립 감사 보고서](./r16i-r4-d8k13-ranking-acl-anonymous-grant-security-lineage-20261016.md)에 실제 ACL의 효과 범위, 앞선 후속 repair 적용 이력, 익명 쓰기 RPC의 server-only/HMAC 경계, 승인 전 PG17 보수 테스트 요구사항을 기록했다.

**운영 GRANT/REVOKE, claim RPC 수정, migration repair 및 배포는 명시적 승인 전까지 금지**한다. D8K-13 기존 합성 PostgreSQL acceptance는 변함없이 통과했고, 전체 운영 역사 정합성/보안 `#1208`/독립 OWNER/복원 증명은 계속 HOLD다.


## 15. SEC-05 NULL 입력·Ranking 최소 권한 격리 PG17 검증 준비 (2026-10-16 후속)

[SEC-05 / Ranking ACL 격리 PostgreSQL17 테스트 계획](./r16i-r4-d8k13-sec05-ranking-acl-synthetic-pg17-acceptance-20261016.md)에 **운영 SQL이 아닌** 실행 가능한 4개 합성 fixture와 로컬 Docker runner를 추가했다.

- 기존 SEC-05 함수의 필수 `p_* IS NULL` 검사 6개만 제거한 **합성 과거 함수**와 운영 `pg_get_functiondef`의 SQL body를 주석/공백 제외 토큰 비교한 결과 **747개 모두 일치**했다. JS의 `$'` special replacement escape 문제를 고쳐, 재구성 문자열이 오염되면 즉시 실패하도록 고정했다.
- 테스트용 SQL은 합성 grant row만 사용하여 legacy NULL resource claim 동작을 트랜잭션 ROLLBACK과 함께 재현한 뒤, hardened 함수의 6개 NULL 인자에 대한 `22023` 에러, 정상 claim/retry/idempotency, anon/authenticated 실제 RPC 직접 거부를 검사하도록 구성했다.
- 별도 ranking table에서는 공개 역할의 `REFERENCES/TRIGGER/MAINTAIN` 권한만 REVOKE하고 transaction ROLLBACK·재적용·idempotency·`SELECT/service_role` 권한 보존을 검증한다.
- Docker 컨테이너 `postgres:17`은 **LOCAL context만 허용**, `--pull=never`, `--network=none`, tmpfs, volume/port 없음. 기존 dirty original worktree 및 hosted Supabase URL을 사용하지 않는다.
- **이번 세션에서 실제 실행 완료:** repository source 6개를 통한 new runner `--check-files` PASS, historical security verifier/overall release checker 모두 실제 소스를 입력한 격리 JS 검증 **PASS/HOLD**, 두 `--enforce-release` 종료코드 **3**. 운영 함수와 synthetic legacy body의 747-token source equivalence도 SELECT-only로 입증.
- **아직 미실행:** 새 Docker PostgreSQL17 fixture 전체 SQL; 이 실행 환경에는 Docker engine·postgres server binary가 없으므로 native PG17의 성공 마커가 존재하지 않는다. 이전 D8K13 core 부분체인 PG17 합격과 혼동 금지.
- `--check-files` 실행 명령: `node scripts/product-evidence/run-d8k13-sec05-acl-synthetic-pg17.mjs --check-files`. Native 합성 PG17 실행은 로컬 Docker Linux engine 및 사전 pull된 postgres:17이 있는 별도 깨끗한 Git worktree에서 **`--check-files` 없이** 실행한다.

**SEC-05 보강과 공개 ACL REVOKE는 운영 migration으로 작성·적용되지 않았다.** 실제 PostgreSQL 합성 acceptance, 전체 역사적 migration 복원, PITR 복원, #1208, 독립 OWNER, 명시적 운영 승인 전까지 `D8K13_RELEASE_HOLD` 유지.


## 2026-10-17 집 PC 실제 SEC-05/Ranking ACL PG17 결과 — 부분 시험 PASS

사용자가 2026-10-17 16:52–16:53 KST Windows에서 직접 실행한 **독립 Docker PostgreSQL17 합성 테스트가 종료코드 0 및 `D8K13_HOME_PG17_TEST_PASS`로 완료**됐다. 고정 코드 버전 `0832a7f964cb68aa7fb057eba654343f46214cfa`의 소스 6개 Git blob 검증을 통과했다. 읽기 가능한 최종 마커에 `D8K13_SEC05_HARDENED_NULL_MATRIX_AND_RETRY_PASS`, `D8K13_SEC05_PUBLIC_RPC_DIRECT_EXECUTE_DENIED_PASS`, `D8K13_SEC05_RANKING_MINIMAL_ACL_ROLLBACK_PASS`, `D8K13_SEC05_ACL_LOCAL_DOCKER_PG17_PASS`가 모두 있었다.

**로그의 제한:** `D8K13_SEC05_LOCAL_PG17_READY`와 `D8K13_SEC05_LEGACY_NULL_REPRODUCED_AND_ROLLBACK_PASS` 표시는 제출된 PowerShell transcript에 직접 남지 않았다. 고정된 러너의 제어 흐름상 두 단계가 통과하지 않았다면 최종 마커에 도달할 수 없으므로 **러너 전체 성공의 간접 근거**로 수용했다. 원시 `psql` statement별 출력이나 hosted에서의 실제 NULL 호출 성공을 검증했다고 주장하지 않는다.

독립 근거: [2026-10-17 home Windows 로컬 PG17 acceptance](./r16i-r4-d8k13-home-sec05-acl-pg17-acceptance-20261017.md). 사용자 로그 SHA256 `72ad32e76230dc0859ed4ce446269fa9d0fd7cf123d540a443094d0fa99c52fe`. 원본 로그와 PC 사용자명/경로는 공개 저장소로 업로드하지 않았다.

**이번 테스트의 결론은 `SEC05_RANKING_SCOPED_SYNTHETIC_PG17_PASS`이다. `D8K13_HOSTED_RELEASE_HOLD`는 그대로 유지**된다. 전체 178개 migration replay, Crawler parser, backup/PITR 복원, independent OWNER, #1208, 그리고 운영 권한/함수 수정에 대한 명시적 승인은 미완료다. 이 문서 상단의 "Native PG17 NOT_RUN" 기록은 **2026-10-16 당시 상태**이며 이 2026-10-17 후속 증거가 해당 부분만 갱신한다. 실제 운영 DB는 변경하지 않았다.
