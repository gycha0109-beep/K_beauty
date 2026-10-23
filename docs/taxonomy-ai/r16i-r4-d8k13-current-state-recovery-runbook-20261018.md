# D8K-13 현재 운영 DB 기준 복구 체계 — 실행 문서 (2026-10-18)

## 1. 목표 및 이전 접근과의 차이

과거 2026-04-10 이전 최초 DB 생성 SQL이나 178건 migration 이력을 완벽하게 모으는 작업은 **별도 역사성 감사 항목으로 보류**한다. 서비스의 현재 상태 복구 가능성은 **현재 운영 DB에서 승인된 시점에 내보낸 실제 구조·권한·데이터·외부 의존성**으로 따로 검증한다.

- 사용 가능한 이력 SQL 전체 재현은 **재해 복구를 위한 필수 선행 조건이 아님**. 단, 해당 이력의 감사 결함이 자동으로 해결되는 것도 아님.
- 비인가 운영 변경 금지. 이번 PR에서 Production Supabase에 실행한 것은 **읽기 전용 catalog SELECT**뿐이다.
- 실제 운영 DB backup/export/restore **미완료**. 현재 기준선은 `public` 구조 **요약만**이며, 암호화된 복원 가능한 백업 파일이 아니다.
- PR #1341 Draft, release HOLD, 보안 #1208 OPEN, 제품 가격·offer·CTA 변경 없음.

## 2. 운영 DB에서 실제 관측한 현시점 구조

Supabase project `bygrczggxfuisupcevaz` (Postgres 17), 2026-10-18 KST 기준. `scripts/product-evidence/sql/d8k13-current-public-recovery-inventory-readonly-v1.sql`과 `scripts/product-evidence/baselines/d8k13-current-public-recovery-inventory-20261018.json`에 관측값/SQL Git blob을 고정.

| `public` 구조 | 관측값 |
| --- | ---: |
| 일반/파티션 테이블 | 101 |
| 뷰 / materialized view | 6 / 0 |
| 일반 컬럼 | 1,425 |
| 기본키 / 외래키 | 101 / 233 |
| DB 함수 / SECURITY DEFINER 함수 | 187 / 135 |
| RLS 활성 / FORCE RLS 관계 | 101 / 4 |
| RLS 정책 | 58 |
| 내부 트리거 제외 트리거 | 23 |
| enum 타입 | 5 |

위 수치는 구조 **개수**이며 CREATE TABLE, 함수 본문, 역할/GRANT, 사용자 행, 암호화 키, Edge Functions, Auth/Storage 객체, 실제 Storage 바이너리 등을 포함하지 않는다. 다른 시점의 차이는 정상적인 스키마 진화일 수도 있으므로 드리프트 발견 시에는 새 snapshot으로 독립 검토해야 한다.

## 3. 실제로 검증한 백업·복원 리허설 (합성 데이터만)

[GitHub Actions #39109843279](https://github.com/gycha0109-beep/K_beauty/actions/runs/39109843279)의 **분리된 PostgreSQL 17.6 DB**를 이용했다. Run HEAD `72abd7589ee08573aea5b0e71f97fff62741d829`.

1. 기존 `d8k13_preledger_synthetic`에 첫 migration이 이미 적용된 상태를 확인한다.
2. 동일 서비스 컨테이너에서 PostgreSQL 17 `pg_dump --schema-only`와 `--data-only`를 사용해 테스트 전용 `public` 스키마·데이터를 일시 추출한다.
3. 새 `d8k13_current_restore_disposable`의 **빈 기본 public 스키마만** 제거하고 dump로 구조와 데이터를 각각 트랜잭션 복원한다.
4. 제품·후보·랭킹 1개씩, 증거 뷰와 rank, DB 타입, public 함수·FK·RLS·정책 등 복원 전후 동일성을 검사한다.
5. 임시 dump는 CI 단계가 종료되면 `trap`으로 삭제한다. 아티팩트 업로드, 인터넷 전송, 운영 DB 접근은 없다.

PG17 job의 `D8K13_CURRENT_RECOVERY_SYNTHETIC_SCHEMA_DATA_RESTORE_PASS`, Node22 job의 `D8K13_CURRENT_RECOVERY_INVENTORY_PASS_HOLD`가 실제 기록됐다. CI의 첫 3개 실패는 Docker stdin / dump 문구 검사 / 빈 public schema 및 줄 연결 처리 결함을 수정하는 과정에서 발생했으며, 최종 위 run의 **두 jobs SUCCESS**로 검증되었다.

**의미:** 테스트용 DB를 현재 상태처럼 백업·복원하는 자동 절차가 동작함. **의미하지 않는 것:** 운영 DB 101개 테이블의 실제 내보내기나 개인정보·권한·Storage 포함 전체 복원 성공.

## 4. 운영 DB의 실제 복구 가능한 기준본을 확보하는 절차 — 아직 실행 안 함

오너/DB 운영자가 승인한 격리 장비와 비공개 암호화 저장소에서 진행할 작업. 현재 연결된 Supabase 도구는 `pg_dump` 스트리밍과 비공개 원격 백업 보관 기능을 노출하지 않으므로 이 단계는 *미완료*다.

1. **백업 시점 고정:** 운영 DB의 대상 project ref, PostgreSQL major, Supabase CLI/pg_dump 버전, 수행자, UTC timestamp, RPO/RTO, 읽기 권한을 기록한다. 운영 변경·쓰기 lock·role 생성은 별도 승인 없이는 하지 않는다. 서로 다른 덤프 시점의 스키마·데이터 일관성도 관리한다.
2. **비공개 logical backup:** 공식 Supabase 지침에 따라 현재 프로젝트의 **roles / schema / data**를 승인된 `supabase db dump`로 분리 저장한다. 데이터는 `--data-only --use-copy`. 역할 백업의 보안과 LOGIN 자격증명 별도 처리에 주의한다. 복원에 필요한 managed schemas/사용자 계정은 별도 검증한다. 백업 파일의 raw SQL/연결 URL/사용자 정보/비밀번호를 GitHub, CI artifacts, PR, ChatGPT나 평문 로그에 업로드하지 않는다. 사용자 맞춤 RLS/read-only identity에서 full-row `pg_dump`이 거절될 수 있으며, 권한 상승을 **본 PR에서 수행하지 않는다**.
3. **목록·무결성:** 비공개 저장소에서 파일별 SHA-256, 정확한 byte count, 백업 수행 UTC, 대상 프로젝트, 범위, 접근 감사 기록을 생성하고, 회전 및 보존기간/암호화/복구키 보관체계를 확정한다. Git에는 raw 백업 없이 **비식별된 검증 상태**만 기록한다.
4. **운영 DB가 아닌 복원 대상 준비:** PostgreSQL 17 및 호환 Supabase managed/Auth/Storage 구성, extensions, schema owner, 권한을 별도 격리된 시스템에서 구축하고 복원한다. 초기에 기존 `public` grant/default privileges가 과도하게 열리지 않도록 별도 검토한다.
5. **Parity 검사:** 101테이블·6뷰·187함수·58정책·233FK 등의 해당 백업 시점 기준 구조, 모든 RLS/SECURITY DEFINER 권한 경계, data count/consistency, 핵심 기능 read queries, Storage 객체와 Auth ID 참조, 암호화 기능을 각각 테스트한다. 날짜가 다른 inventory 101/6/...과 기계적으로 맞추어 pass하면 안 된다.
6. **독립 승인:** 복원 job 결과, 무결성, 실제 복원 비밀키 취급, 장애 복구 리허설과 Owner/Security 검토를 증거로 승인한다. PR #1341은 승인이 없으므로 여전히 HOLD.

Supabase 공식 참고:
- [Backup and Restore using CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
- [Supabase CLI `db dump` 참고](https://supabase.com/docs/reference/cli/supabase-inspect-db-role-configs)
- [Supabase Platform to Self-hosted 데이터/역할/Storage 주의사항](https://supabase.com/docs/guides/self-hosting/restore-from-platform)

## 5. 승인 기준과 차단 범위

| 단계 | 결과 |
| --- | --- |
| 현재 `public` 구조 metadata 수집 | **PASS** — 운영 READ ONLY |
| 합성 PG17 schema+data dump/replay | **PASS** — CI #39109843279 |
| 실운영 `public` 스키마·역할·데이터의 비공개 백업 | **NOT DONE** |
| 실운영 백업을 별도 PG17에 복원 | **NOT DONE** |
| Auth / Storage / Key / ACL 전체 동등성 | **NOT DONE** |
| 독립 Owner·Security 승인 및 #1208 해결 | **NOT DONE** |
| 서비스 릴리스 승인 | **HOLD** |

기존 178 migration 이력 복구 문제는 여기서 해결하려 하지 않는다. **서비스 현상태 복구의 독립적 통과경로**로 사용할지를 최종 결정하는 것은 사용자의 별도 운영 승인이고, 그 승인 전에는 이전 release HOLD를 해제하지 않는다.

## 6. 사용자 Windows ZIP 백업 후속검증 (2026-10-18)

사용자가 `BEJEWELY_DB_Backup_20261018_181006.zip` **7,323,679 bytes**를 로컬에서 생성하고 `roles.sql`, `schema.sql`, `data.sql` 내부 항목 검사를 통과했으며 Google Drive에 넣었다고 보고했다. 그러나 현재 연결된 Google Drive 검색에서는 **정확히 일치하는 ZIP을 찾지 못했다**. 따라서 *원격 파일 접근·무결성·실제 SQL 내용·운영 DB 재복원은 확인되지 않았다*. **파일을 채팅이나 GitHub로 가져오지 않는다.** user-reported 경계: `scripts/product-evidence/baselines/d8k13-owner-local-backup-intake-20261018.json`.

소스 저장소의 다음 로컬 실행 스크립트를 추가함:

`scripts/product-evidence/verify-d8k13-private-backup-zip-local.ps1`

Windows PC에서 저장소의 해당 기능 브랜치를 동기화한 후, PowerShell에서 다음 명령을 실행한다. 기본 ZIP 경로는 `$HOME\BEJEWELY_Private_DB_Backups\BEJEWELY_DB_Backup_20261018_181006.zip`. Drive 동기화 위치에만 있는 경우 `-BackupZip "실제 ZIP 경로"`로 변경한다.

~~~powershell
# 순수 검사 (기본값): 압축 항목 3개, 실제 크기, 추출, SHA-256 검증
powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\product-evidence\verify-d8k13-private-backup-zip-local.ps1" -Mode Inspect

# 복원 리허설: Docker Desktop 필수. 임시 Supabase/Postgres17.6.1.136, 네트워크/포트/볼륨 없음
powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\product-evidence\verify-d8k13-private-backup-zip-local.ps1" -Mode Restore
~~~

- 실 ZIP의 압축 항목은 정해진 **루트 SQL 3개 외 전부 거부**하고, 예상 ZIP 크기는 사용자 보고값 7,323,679 bytes이다. 반환값에는 ZIP SHA-256과 SQL 바이트수만 표시하고 데이터·SQL·자격증명은 표시하지 않는다.
- `-Mode Inspect`의 정상값 `D8K13_LOCAL_ZIP_INSPECTION_PASS`는 ZIP 압축 검증에 한정된다.
- `-Mode Restore`는 새로 생성한 Docker `supabase/postgres:17.6.1.136` 컨테이너에 **네트워크 없는 환경**에서 ZIP 안의 roles, schema, data 순서대로 로컬 SQL을 복원한다. 종료 시 컨테이너와 임시 추출 파일은 삭제한다. 모든 SQL이 적용되고 public 테이블이 1개 이상이면 `D8K13_DISPOSABLE_PG17_SQL_RESTORE_PASS_LIMITED`와 집계 메타데이터만 출력한다.
- **2026-10-18 실제 최초 실행에서** 이전 스크립트가 사용한 일반 PostgreSQL 17.6 이미지에 `anon` Supabase 역할이 없어 `roles.sql:22` 단계에서 중단됐다. 이는 백업 자체가 손상됐다는 증거가 아니다. 수정본은 `supabase/postgres:17.6.1.136`으로 전환하고 `anon`, `authenticated`, `service_role`, `supabase_admin` 존재를 복원 전 검사한다. 다만 프로젝트별 auth/storage/migrations/extension 차이로 실제 ZIP 복원이 실패할 수 있다. 이 경우 **미완료**이고 오류는 raw SQL 없이 단계별 범주 코드로 제공한다.
- Docker에서 운영 Supabase로 DB 연결하는 부분이 없고 컨테이너 네트워크 자체가 차단되어 있다. 원본 ZIP과 실제 SQL은 CI, 원격 채팅, PR, 저장소에 저장하지 않는다.
- CI [#39133409278](https://github.com/gycha0109-beep/K_beauty/actions/runs/39133409278)에서 사용자 실제 ZIP이 아닌 **합성 ZIP**의 Inspect, Supabase 역할 `anon/authenticated` GRANT, `auth.users` FK 및 `auth.uid()` RLS 정책을 포함한 **격리 Supabase/Postgres17 SQL 복원**, 잘못된 크기의 ZIP fail-closed 경로 모두 PASS. 실제 사용자 ZIP 복원 성공을 입증하지 않는다.
- CLI 백업은 Supabase Auth/Storage 관리 객체, 실제 Storage 바이너리, Vault 암호화 키, 전체 migration ledger를 자동 보존하지 않는다. **서비스 전체 재해복구 PASS로 확대 해석 금지**. RLS/ACL/SECURITY DEFINER·데이터 무결성 대조와 독립 OWNER/Security 승인이 여전히 필요하다.

상태: **사용자 PC 실 ZIP Inspect PASS** (7,323,679 bytes; SHA-256 A3E290AE2368D1032786A2202E60B1E328341B8A9C7DFAD1FD9A0F2DABEAD2C6). **구버전 일반 PG17에서 실 ZIP restore FAILED** (`anon` 역할 누락). 새 Supabase/Postgres 이미지로 교체 후 **실 ZIP 재실행 NOT DONE**, release HOLD.

### 6.1. Windows PowerShell 초기 Docker 이미지 다운로드 실패 조치 (2026-10-18)

운영자 두 번째 실 ZIP 실행에서는 `D8K13_LOCAL_ZIP_INSPECTION_PASS` 출력 뒤 `Unable to find image 'supabase/postgres:17.6.1.136' locally`만 표시되고 중단되었다. 이 문장은 **Docker가 호스트의 이미지 캐시에 없음을 알려주는 일반적인 첫 다운로드 안내**다. 해당 안내만으로 원격 레지스트리의 태그가 없거나 pull에 실패했다고 판단할 수 없다. 이전 PowerShell 5.1 스크립트가 `$ErrorActionPreference='Stop'`와 네이티브 명령 `stderr` 리다이렉션을 결합해 상태 메시지를 `NativeCommandError`처럼 처리하면서 **실제 종료 코드·pull 완료까지 기다리지 않고 종료**한 것이 유력한 원인이다. 따라서 이는 실 DB 백업 불량의 증거가 아니다.

수정: `Invoke-DockerLifecycle`은 `Start-Process -Wait -PassThru`로 Docker 명령의 **실제 exit code**를 판정하고 표준출력/표준에러를 로컬 임시 로그로 각각 분리한다. `docker image inspect`를 실행해 캐시가 없을 때만 `docker pull supabase/postgres:17.6.1.136`을 별도 단계로 수행한다. pull 정상완료를 확인한 이후에만 `docker run --network none`으로 테스트 컨테이너를 생성한다. `Run-Docker` SQL 복원 명령도 원시 에러가 사용자 화면에 출력되는 것을 피하기 위해 `Start-Process`와 별도 stderr 로그, 오류 종류만 반환하도록 변경했다.

CI [#39134449424](https://github.com/gycha0109-beep/K_beauty/actions/runs/39134449424): 실제 runner의 Docker 이미지 캐시에서 해당 tag를 강제 제거하고 **cold-pull → synthetic schema/roles/data restore → reject wrong-sized ZIP** 모두 SUCCESS. CI [#39134664951](https://github.com/gycha0109-beep/K_beauty/actions/runs/39134664951): `Run-Docker`를 stderr 분리·종료코드 방식으로 수정한 후 **전체 synthetic restore 성공**.

운영자 재실행 방법: feature branch의 `scripts/product-evidence/verify-d8k13-private-backup-zip-local.ps1`를 다시 내려받고 기존 ZIP(7,323,679 bytes)은 그대로 둔다. `-Mode Restore` 실행. 정상 cold pull은 `D8K13_LOCAL_DOCKER_IMAGE_DOWNLOAD_START` 뒤 `..._PASS`를 출력한다. 이미지 다운로드에는 수 분이 걸릴 수 있다. 이미지만 받은 상태를 복원 완료로 표기하지 않는다. **실제 사용자 ZIP에 대한 새 환경의 schema/data restore는 아직 미검증**이다.

실패 시 `D8K13_LOCAL_DOCKER_IMAGE_PULL_<범주>_EXIT_<정수>` 또는 `D8K13_LOCAL_RESTORE_<단계>_<범주>_FAILED_EXIT_<정수>` 등 **비민감 오류 코드만 수집**한다. 네트워크가 끊겼거나 Docker Desktop이 꺼진 경우 다운로드/컨테이너 동작은 실패할 수 있으며, 그 실패 역시 운영 DB와는 무관하다. Release HOLD.

### 6.2. 운영자 실 ZIP schema 단계 누락 스키마 및 초기화 경합 진단 (2026-10-19)

실제 사용자 Windows ZIP 재실행 출력:
- ZIP 정밀 검사 PASS, 7,323,679 bytes, SHA-256 `A3E290AE2368D1032786A2202E60B1E328341B8A9C7DFAD1FD9A0F2DABEAD2C6`. 세 SQL 원본 크기 1,446 / 1,623,596 / 20,857,133 bytes.
- Supabase/Postgres Docker image 다운로드 START/PASS.
- `D8K13_LOCAL_RESTORE_SCHEMA_MISSING_SCHEMA_FAILED_EXIT_3` — **실제 schema.sql 복원 실패**, data.sql 적용 전 중지. 오류를 비식별화했으므로 해당 오류만으로 누락된 *정확한 스키마 이름*은 미확인. **백업 손상으로 결론내릴 근거는 없음.**

운영 DB에서 추가로 `pg_catalog` 메타데이터를 **SELECT-only** 조회하여 격리된 Supabase/Postgres 17.6.1.136 이미지의 실제 네임스페이스 및 extension 목록과 비교했다.

| 스키마 | 현재 운영 DB | Supabase PG 17 기본 이미지 |
| --- | --- | --- |
| `private` | 존재, 함수 2개 | 없음 |
| `recommendation_shadow` | 존재, 함수 2개 | 없음 |
| `supabase_migrations` | 존재, 적용 이력 테이블 1개 | 없음 |
| `auth`, `storage`, `extensions`, `vault` | 존재 | 존재 |

검증한 Supabase 이미지의 `pgcrypto`, `pg_stat_statements`, `supabase_vault`, `uuid-ossp` 확장도 존재. 위 차이는 **실제 누락된 네임스페이스 후보**이지 원본 SQL 오류의 정확한 식별 결과는 아니다.

보수:
1. `schema.sql`을 **로컬 임시 디렉터리에서만 읽어**, `private` / `recommendation_shadow`에 대한 참조가 있지만 덤프 자체에 `CREATE SCHEMA`가 없는 경우에 한하여, 네트워크 없는 일회용 DB에 해당 스키마를 준비한다. 이미 덤프가 생성하는 경우에는 **중복 생성하지 않는다**. 고정 허용 목록 밖의 네임스페이스는 자동 생성하지 않는다. `supabase_migrations`를 빈 가짜 적용 이력으로 임의 복원하지 않는다.
2. Supabase Docker entrypoint는 임시 PostgreSQL 프로세스로 초기 SQL을 실행한 뒤 최종 서버를 시작할 수 있다. `pg_isready`나 단 한 번의 query 성공 대신, 필수 역할/스키마/확장 확인과 `pg_postmaster_start_time()`의 **연속 동일성**을 기다린다.
3. 이미지 부족 및 SQL 복원 stderr는 운영 SQL/사용자 행을 출력하지 않고 미리 정의된 범주의 오류 코드만 알려준다. `docker run --network none`, 무포트/무볼륨, 임시 SQL/container 종료 시 삭제 경계 유지.

**실제 CI** [#39141611642](https://github.com/gycha0109-beep/K_beauty/actions/runs/39141611642)에서 의도적으로 `private`, `recommendation_shadow` 네임스페이스가 없는데 이를 참조하는 합성 SQL fixture로 **role restore → namespace preparation → schema restore → data restore 성공**을 확인했다. 잘못된 크기 ZIP 거부도 PASS. 재사용할 PowerShell 소스는 `scripts/product-evidence/verify-d8k13-private-backup-zip-local.ps1`; 사용자가 `restore-local.ps1` 로컬 복사본을 다시 최신 기능 브랜치로 갱신해야 수정이 반영된다.

**현재 판정:** 합성 ZIP 복원 성공, 실사용자 ZIP 복원 **미검증**, `auth`·`storage` 관리 객체와 바이너리/키, 전체 역사 이력 검증 **미완료**, PR #1341 DRAFT/HOLD / issue #1208 OPEN / production DML/DDL 0.

### 6.3. 반복된 MISSING_SCHEMA 재현과 public 삭제 결함 수정 (2026-10-19)

사용자가 동일한 로컬 ZIP (7,323,679 bytes / SHA-256 `A3E290AE2368D1032786A2202E60B1E328341B8A9C7DFAD1FD9A0F2DABEAD2C6`)으로 재검증했지만 `D8K13_LOCAL_RESTORE_SCHEMA_MISSING_SCHEMA_FAILED_EXIT_3`이 **다시 발생했다**. 종전의 `private`/`recommendation_shadow` 후보 보완만으로 원인을 해결했다고 주장할 수 없다.

구현을 재검수해 **확인된 복원 스크립트 자체의 결함**을 발견함. 이전 `Run-Docker 'DROP_EMPTY_PUBLIC'`은 `schema.sql`의 구성과 무관하게 대상의 초기 `public` 스키마를 항상 삭제했다. 공식 `supabase db dump`는 경우에 따라 `CREATE SCHEMA public;`을 포함하지 않으므로, 해당 백업에서는 추후 `public` 스키마가 없어서 실패할 수 있다. **실제 owner ZIP의 public CREATE 유무나 최초 실패의 스키마 이름은 아직 직접 확인하지 못했다.** 원인 후보를 정확한 실측으로 단정하지 않는다.

수정된 `scripts/product-evidence/verify-d8k13-private-backup-zip-local.ps1`:
1. ZIP을 로컬에만 해제한 뒤 `schema.sql`에 명시적 `CREATE SCHEMA public;`이 있을 때만, 기존 **빈** `public`을 제거한다. SQL에 생성문이 없다면 기본 `public`을 **보존**한다. `IF NOT EXISTS` 생성문도 보존. 사용자 정의 스키마 `private`/ `recommendation_shadow`은 기존의 고정 허용목록 검사 유지.
2. 오류 메시지에서 실패한 schema가 일반 안전한 PostgreSQL 식별자 `[a-z_][a-z0-9_]{0,62}`일 경우, 민감 SQL 전문/행/문맥을 보여주지 않고 **스키마 이름과 SQL 원본 줄 번호만** 출력한다. 예시: `D8K13_LOCAL_RESTORE_SCHEMA_MISSING_SCHEMA_EXAMPLE_LINE_123_FAILED_EXIT_3` (예시이며 실 사용자 오류가 아님).
3. ZIP 내용이나 로컬 SQL을 GitHub·CI·채팅에 업로드하지 않으며, 운영 DB 접속을 하지 않는다. 변경은 네트워크 없는 임시 Docker의 테스트 대상만 적용.

**통과 검증:** [GitHub Actions #39148634432](https://github.com/gycha0109-beep/K_beauty/actions/runs/39148634432), Synthetic-only. PowerShell 문법 검사, `public`이 생성되는 백업 복원, `CREATE SCHEMA public`이 **없는 백업** 복원, 의도적으로 누락된 `d8k13_missing_fixture` 스키마의 **이름·줄 번호만 안전하게 진단** 및 종료 코드 3, 잘못된 ZIP 크기 거부 모두 PASS. 이 CI에는 실제 운영 ZIP이 사용되지 않았다.

**다음 단계:** 사용자 PC에 있는 `restore-local.ps1`을 기능 브랜치 최신 버전으로 다시 복사해 동일 ZIP으로 `-Mode Restore` 재검증. 실패한다면 `D8K13_LOCAL_RESTORE_SCHEMA_MISSING_SCHEMA_<NAME>_LINE_<N>_FAILED_EXIT_3`와 같이 출력된 비민감 코드만 공유. 실제 데이터 복원·권한·Auth/Storage 바이너리·Vault·migration ledger 최종 복구는 모두 미검증. PR DRAFT / release HOLD / production writes 0.

### 6.4. 반복된 실제 schema OTHER 오류의 SQLSTATE·줄 번호 비식별 진단 (2026-10-19)

사용자가 동일한 로컬 운영 ZIP을 사용하여 재시도했으며 ZIP 검사 PASS, `D8K13_LOCAL_PUBLIC_SCHEMA_PRESERVED_FOR_DUMP` 후 `D8K13_LOCAL_RESTORE_SCHEMA_OTHER_FAILED_EXIT_3`로 **schema.sql 복원이 실패했다**. `data.sql`은 실행되지 않았다. public 보존 후에도 실패했으므로 앞서 추정한 누락된 `public`이 실제 오류의 유일한 원인이라고 할 수 없다. 실제 owner SQL을 GitHub/연결 앱/채팅으로 전송하지 않았다.

**변경:** `scripts/product-evidence/verify-d8k13-private-backup-zip-local.ps1`에서 `psql -v VERBOSITY=sqlstate -v SHOW_CONTEXT=never`을 `roles.sql`, `schema.sql`, `data.sql` 복원 호출에 적용. 실패 시 Docker stderr를 **임시 로컬 파일**로만 수집하고, `psql:/tmp/schema.sql:<line>: ERROR: <SQLSTATE>`에서 숫자/영문 다섯 글자의 표준 PostgreSQL SQLSTATE와 숫자 줄 번호만 추출하여 `D8K13_LOCAL_RESTORE_SCHEMA_SQLSTATE_<CODE>_LINE_<N>_FAILED_EXIT_3`처럼 출력한다. 전체 SQL/쿼리/개인정보/DB 자격증명/임시 stderr 내용은 출력·업로드하지 않는다. 스크립트 종료 후 임시 폴더/컨테이너를 제거한다.

**검증:** 합성 ZIP만 사용한 [CI #39183076360](https://github.com/gycha0109-beep/K_beauty/actions/runs/39183076360) job `117840075100` **SUCCESS**. Parser 검사 / 정상 full schema dump / `CREATE SCHEMA public` 없는 dump / 의도적 누락 schema SQLSTATE `3F000` 및 줄 번호 추출 / 기존엔 OTHER로 표시됐을 0 나누기 SQLSTATE `22012` 및 줄 번호 추출 / 유효하지 않은 ZIP 크기 거부 모두 PASS. 오류 코드와 줄 번호 이외의 SQL 텍스트가 stderr에 노출되지 않는다는 부정 검사도 통과.

**현재 상태:** 사용자 실 ZIP의 정확한 SQLSTATE / 실패 줄은 아직 보고되지 않았다. 실제 DB 복원 PASS로 간주하지 않으며 운영 Supabase는 읽기 전용, PR #1341 OPEN/DRAFT/HOLD, 보안 #1208 OPEN.

**다음 오너 로컬 조치:** 기능 브랜치에서 최신 `restore-local.ps1`을 갱신하고, 이전과 동일한 ZIP에 `-Mode Restore`을 1회 실행하여 마지막 `D8K13_LOCAL_RESTORE_SCHEMA_SQLSTATE_..._LINE_..._FAILED_EXIT_3` 코드 또는 성공 상태만 전달. 실패 줄의 실제 SQL 내용은 공유 불필요. 이 값으로 정확한 원인분석 후 **새 복구 환경 변경 여부를 결정**한다.

### 6.5. 운영자 실 ZIP의 private 함수 OWNER 권한 실패 및 제한적 격리 복원 보완 (2026-10-19)

운영자가 동일한 SHA-256 `A3E290AE2368D1032786A2202E60B1E328341B8A9C7DFAD1FD9A0F2DABEAD2C6` ZIP을 학원 Windows PC에서 실행했고 `D8K13_LOCAL_ZIP_INSPECTION_PASS`, `D8K13_LOCAL_PUBLIC_SCHEMA_PRESERVED_FOR_DUMP` 다음에 `D8K13_LOCAL_RESTORE_SCHEMA_SQLSTATE_42501_LINE_474_FAILED_EXIT_3`가 출력됐다. 원본 SQL을 전송하지 않은 상태에서 **로컬 메타데이터 전용 명령**으로 해당 문장이 `ALTER FUNCTION`, `OWNER TO`, schema `private`, owner role `product_offer_link_health_recorder_owner`임을 확인했다. 로컬 ZIP의 `roles.sql`에서 이 role의 CREATE/ALTER 정의가 있음도 확인했고, 속성 검출값은 NOLOGIN·NOSUPERUSER·NOCREATEROLE에 해당했다. 단, 이는 raw SQL 또는 ZIP의 외부 검증이 아니다.

PostgreSQL 17 공식 `ALTER FUNCTION` 문서에 따르면 함수 소유권 이전자는 대상을 `SET ROLE` 할 권한이 있어야 하고, 새로운 owner는 함수 스키마에 CREATE 권한이 있어야 한다. 운영 DB나 백업 SQL/역할 자체는 변경하지 않고 `--network none` 일회용 Supabase/Postgres 대상에서만 다음을 실행하도록 로컬 스크립트를 제한적으로 보완했다.

1. 백업의 `roles.sql`에 해당 role의 `CREATE ROLE` 선언이 있고 `schema.sql`에 `ALTER FUNCTION private.... OWNER TO ...`가 있을 때만 적용. 소유권 변경이 있는데 role 정의가 없다면 fail closed.
2. 일회용 `private` namespace의 CREATE 권한을 대상 NOLOGIN role에 부여하고 해당 역할로 SET ROLE 가능한 postgres 멤버십을 준비. 백업의 원래 `OWNER TO` SQL 자체는 그대로 적용하여 소유권을 건너뛰지 않는다.
3. 초기 구현은 PowerShell 정규식에서 과다 이스케이프된 백슬래시 때문에 실제 owner ZIP에서 보완 분기가 실행되지 않았다. `D8K13_LOCAL_PRIVATE_FUNCTION_OWNER_RESTORE_GRANTS_READY`가 없는 실행 결과로 이를 식별했고 패턴을 수정, 적용/비적용 마커를 명시했다.
4. 로컬 `psql -c` 단계 오류도 원본 SQL 노출 없이 `SQLSTATE`만 분류. quoted identifier 인수 전달 위험을 제거하기 위해 소문자 고정 대상 역할은 SQL 식별자로 직접 사용한다.

**검증:** [GitHub Actions #39223627159](https://github.com/gycha0109-beep/K_beauty/actions/runs/39223627159), job `117964525037` **SUCCESS**, 합성-only. 기존 파서·ZIP 점검, Cold image, 관리 역할/스키마 초기화, `CREATE ROLE` / `ALTER ROLE` NOLOGIN, `private.fixture_probe()` 함수의 실제 `OWNER TO product_offer_link_health_recorder_owner` 변경, 역할 스코프 권한 준비 마커, 정상 roles/schema/data 복원, `public` 생성문 없는 경우, SQLSTATE 3F000/22012 오작동 방지, 잘못된 ZIP 크기 거부 전부 통과했다. 초기 합성 fixture에서 슈퍼유저 전용 `ALTER ROLE NOSUPERUSER`를 넣은 테스트 오류와 SQL `-c` 인수 전달 오류를 해결한 뒤 최종 통과한 결과다. **실 ZIP이 CI에 사용된 적은 없다.**

**현재 판정:** 실제 ZIP 재실행은 위 최종 수정 이후 **아직 없음**. 따라서 실 사용자 데이터 복원 PASS/서비스 전체 복구 승인 모두 미확인. PR #1341 DRAFT / unmerged / release HOLD, 보안 이슈 #1208 OPEN, 운영 DB write 0. 사용자는 최신 branch의 PowerShell 스크립트를 재복사하고 같은 ZIP으로 `-Mode Restore`를 재실행하여 성공 마커 또는 민감정보 없는 최종 오류 코드만 공유해야 한다.

### 6.6. 2026-10-20 GitHub 검증 및 운영자 재실행 대기

현재 [PR #1341](https://github.com/gycha0109-beep/K_beauty/pull/1341) HEAD `31dbd50b942b26757b5364b3c431bb3c8d2df358` 확인: 함수 owner 보완 코드 `0d615aa95931c20e8fee9f140a8246fddd421b47` 뒤 두 커밋은 이 runbook 및 owner ZIP 비식별 증거 JSON만 변경하였다. 따라서 [CI #39223627159](https://github.com/gycha0109-beep/K_beauty/actions/runs/39223627159)의 **합성 복원 SUCCESS**는 현 스크립트 버전에 유효하다. 이것을 실제 owner ZIP의 schema/data restore PASS로 승격하지 않는다. 마지막 실 ZIP 실패는 `SQLSTATE_42501_LINE_474`이며 데이터 복원은 시도·완료 확인이 없다.

현재 코드의 owner-role 검출 조건과 회복 경계 재확인: `roles.sql`의 `CREATE ROLE product_offer_link_health_recorder_owner` 및 `schema.sql`의 `ALTER FUNCTION private.... OWNER TO`가 함께 있는 경우에 한하여, `--network none` / 포트·볼륨 미사용 임시 컨테이너 안에서만 `private` CREATE privilege와 역할 membership을 사전 준비한다. `D8K13_LOCAL_PRIVATE_FUNCTION_OWNER_RESTORE_GRANTS_READY`가 정상 분기의 식별 마커다. 원래 소유자 변경문은 생략하거나 원본을 바꾸지 않는다. 실제 권한·소유권 동등성은 **독립 검증 전까지 미확인**이다.

동일 운영자 PC, 동일 기존 ZIP을 유지하여 다음을 Windows PowerShell에서 수행한다. 저장소에서 실행하며 GitHub 재인증 및 Docker Desktop 사용 가능 상태는 로컬 사전조건이다.

~~~powershell
git fetch origin feat/taxonomy-ai/d8k13-legacy-self-review-reconciliation-design-20261016
$folder = "$HOME\BEJEWELY_Private_DB_Backups"
git show "FETCH_HEAD:scripts/product-evidence/verify-d8k13-private-backup-zip-local.ps1" |
    Set-Content "$folder\restore-local.ps1" -Encoding UTF8
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$folder\restore-local.ps1" -Mode Restore
~~~

수집 범위: 위 READY 마커/격리 복원 성공 메타데이터 또는 `D8K13_LOCAL_RESTORE_<STAGE>_SQLSTATE_<CODE>_LINE_<N>_FAILED_EXIT_<N>` 형태의 안전한 실패 코드만. SQL/행/스크린샷/원본 ZIP/비밀번호를 요청하지 않는다.

**다음 판정 순서:** (1) 실제 schema/data 모두 성공했는지, (2) 복원 전후 객체·행수·무결성·FK·인덱스·트리거·RLS/정책·역할/소유권/ACL 비교, (3) Auth·Storage·Vault 관리 영역과 SQL 외부 storage binaries/암호화 키·비밀의 누락 경계, (4) 재현성 및 독립 Owner/Security 승인. `--single-transaction` restore 중 session_replication_role 사용은 모든 FK/트리거가 정상 검증됐다는 의미가 아니므로 (2)를 생략할 수 없다. 운영 Supabase 변경/원본 178 migration history 고치는 작업/PR 병합/배포/릴리스 게이트 변경을 승인하지 않는다. 보안 #1208 OPEN, PR Draft, RELEASE HOLD 유지.

### 6.7. 운영자 ZIP schema 생성 이전 GRANT 3F000 및 순서 보완 (2026-10-20)

**새 사용자 PC 실 ZIP 결과:** `D8K13_LOCAL_ZIP_INSPECTION_PASS` (7,323,679 bytes / 동일 SHA-256 `A3E290AE2368D1032786A2202E60B1E328341B8A9C7DFAD1FD9A0F2DABEAD2C6`), `D8K13_LOCAL_PUBLIC_SCHEMA_PRESERVED_FOR_DUMP` 다음에 **`D8K13_LOCAL_RESTORE_PRIVATE_FUNCTION_OWNER_SCHEMA_CREATE_SQLSTATE_3F000_FAILED_EXIT_1`**. `schema.sql` 적용 및 `data.sql` 복원은 **미완료**. 원본 ZIP/SQL은 공유하거나 업로드하지 않았다.

**진단:** 새 오류는 원래 함수 `ALTER FUNCTION ... OWNER TO`에서 발생한 `42501`이 아니라, 복원 스크립트가 사전 수행한 `GRANT CREATE ON SCHEMA private`에서의 `3F000`(스키마 없음)이다. 당시 `private`가 아직 생성되지 않았다는 사실이 입증되었지만, 실제 원본 `schema.sql`에 `CREATE SCHEMA private`가 있는지는 원본을 직접 읽지 않았으므로 **추정**이다. `private` 생성 시점이 늦는 백업을 합성으로 재현하는 새 검증 케이스를 추가하였다.

**코드 수정 (운영 무변경):** `verify-d8k13-private-backup-zip-local.ps1`은 역할과 실제 `ALTER FUNCTION private.... OWNER TO product_offer_link_health_recorder_owner`가 함께 있을 때만 준비한다. 백업이 `CREATE SCHEMA private`를 선언하면 미리 GRANT하지 않고, ZIP에서 추출한 **임시 schema.sql 복제본의 해당 ALTER 앞 동일 줄**에 지정 역할의 `GRANT CREATE`를 단계적으로 추가한다. 원본 ZIP·원래 ALTER 문은 변경하지 않으며 기존 `--network none` 컨테이너에서만 실행된다. 백업에 `CREATE SCHEMA private`가 없으면 격리 DB에서 해당 스키마를 제한적으로 생성한 후 권한을 준비한다. PostgreSQL17 함수 소유권 이전의 CREATE/SET ROLE 요건은 유지한다. 임시 부여 권한이 남을 수 있으므로 원본 DB와 ACL parity를 달성했다고 선언하지 않는다.

**검증 등급:** 합성 테스트에 *덤프가 명시적으로 private 스키마를 만드는 경우*를 추가했다. 최신 CI가 실제로 성공하기 전까지 **CODE_CHANGED / SYNTHETIC_CI_UNVERIFIED** 상태이며, 운영자 실 ZIP에 새 버전 재실행을 요청하지 않는다. 안정적으로 검증되면 이전과 같은 로컬 ZIP, 최신 스크립트로만 1회 재검증할 것. 실패하면 최종 단계/SQLSTATE/줄 번호만 사용하며, 백업·SQL·자격증명은 요청하지 않는다. PR #1341 Draft/미병합, issue #1208 OPEN, 출시 HOLD, 운영 데이터 변경 없음.

### 6.8. 3F000 보수 합성 PG17 CI 통과 및 실 ZIP 재검증 허용 (2026-10-20)

- **사전 준비 순서 결함 수정의 실제 CI 통과:** [GitHub Actions #39355259890](https://github.com/gycha0109-beep/K_beauty/actions/runs/39355259890), job `118408838387`, commit `e3b7353f06ece27a52583dc4314894de6e62fcd2`, **SUCCESS**. §6.7의 `SYNTHETIC_CI_UNVERIFIED`는 해당 시점 기록이며 **현재 최신 검증 등급은 SYNTHETIC_PG17_PASS / REAL_OWNER_ZIP_PENDING**이다.
- **실제 확인한 job 단계:** PowerShell ParseFile, 합성 roles/schema/data ZIP 검사, Supabase/PostgreSQL 17 cold image 및 격리 복원, `CREATE SCHEMA public` 유무, **`CREATE SCHEMA private`가 원본 함수 owner 변경보다 먼저 나오는 새 fixture**, 미확인 schema SQLSTATE 3F000 fail-closed, 일반 SQLSTATE 22012 비식별 처리, 잘못된 ZIP 길이 거부 — **모두 success**. 앞선 임시 소스 치환 손상 `41b620...` 및 `109d2c...`는 **각각 CI 실패**했고, 손상된 중간판을 사용하면 안 된다. `c0525946...` 및 최종 `e3b7353...`는 실제 CI SUCCESS.
- **재실행 범위 허용:** 이제 운영자는 수정된 기능 브랜치 스크립트를 재취득해 같은 로컬 ZIP에 대해 `-Mode Restore` 한 번 재시도할 수 있다. ZIP/SQL/credentials를 채팅·Git/CI로 가져오지 않고, 성공 시 `D8K13_LOCAL_PRIVATE_FUNCTION_OWNER_GRANT_STAGED_FOR_IN_DUMP_SCHEMA` (해당 경우) 및 `D8K13_LOCAL_PRIVATE_FUNCTION_OWNER_RESTORE_GRANTS_READY`, 마지막 `D8K13_DISPOSABLE_PG17_SQL_RESTORE_PASS_LIMITED`와 비민감 집계만 확인한다. 실패 시 마지막 `D8K13_LOCAL_BACKUP_DRILL_FAILED: D8K13_LOCAL_RESTORE_...` 코드만 기록한다.
- **경계:** 원본 ZIP의 `CREATE SCHEMA private` 존재는 직접 검증하지 않았으며, 실제 `schema.sql/data.sql` 성공도 미확인. 합성 restore PASS를 실제 백업 복원·Auth/Storage/Vault 완전성·ACL/role parity·운영 release readiness로 확대 금지. 제한적으로 추가한 `GRANT CREATE`는 ACL drift 가능성을 만들기 때문에 이후 독립 권한/ownership 비교가 필수. PR #1341 Draft, #1208 OPEN, production writes/merge/deploy 0, RELEASE HOLD.

### 6.9. 실제 ZIP schema.sql 22086행 권한 오류 — 오프라인 문장 분류 단계 (2026-10-20)

- **운영자 새 실제 ZIP 결과:** 동일 ZIP 7,323,679 bytes, SHA-256 `A3E290AE2368D1032786A2202E60B1E328341B8A9C7DFAD1FD9A0F2DABEAD2C6`. `D8K13_LOCAL_ZIP_INSPECTION_PASS`, `D8K13_LOCAL_PUBLIC_SCHEMA_PRESERVED_FOR_DUMP`, **`D8K13_LOCAL_PRIVATE_FUNCTION_OWNER_GRANT_STAGED_FOR_IN_DUMP_SCHEMA`**, 이어 **`D8K13_LOCAL_RESTORE_SCHEMA_SQLSTATE_42501_LINE_22086_FAILED_EXIT_3`**. 이전 preflight 단계의 `3F000`에서 실제 schema.sql 파일 실행 단계로 전진. `data.sql` 실행과 실백업 복원 완료 확인 **없음**.
- PostgreSQL `42501`은 권한 부족 분류다. 하지만 파일 22086행의 문장 종류, 대상, 역할, 복원 컨텍스트는 **아직 미확인**. 앞선 `ALTER FUNCTION private ... OWNER TO` 474행과 같은 원인 또는 해당 역할이라고 추정하면 안 된다. 광범위 GRANT, 슈퍼유저/역할 승격, 함수 소유권 무시, SQL 주석 처리, 원본 dump 수정, `--no-owner` 또는 복원 오류 무시 금지.
- **안전한 다음 진단:** `scripts/product-evidence/diagnose-d8k13-private-backup-schema-line-local.ps1`는 소유자 PC ZIP의 고정 size/SHA/파일 집합을 로컬에서 확인하고 `schema.sql` 물리적 22086행의 가장 가까운 top-level SQL **문장 종류/객체 종류/OWNER·GRANT 분류**만 제한된 어휘값으로 반환한다. DB/네트워크/Docker 미접근, 원문·식별자·행·ZIP 내용/비밀번호/파일 경로 출력 없음. **SQL 파서가 아닌 어휘상 휴리스틱**이므로 불명확하면 추가 로컬 검증을 설계. 원본 SQL/ZIP은 절대 외부 전송하지 않는다.
- 사용자는 새 진단 스크립트의 합성 CI가 PASS한 뒤에만, GitHub feature branch 파일을 로컬 백업 폴더에 복사하여 `-LineNumber 22086` 한 번 실행한다. 성공 시 `D8K13_LOCAL_SCHEMA_LINE_CLASSIFIED_METADATA_ONLY` JSON만 기록하고 이에 근거해 **정확한 격리 복원 단계의 보수 범위**를 결정한다. 실 ZIP으로 동일 `-Mode Restore` 반복 재시도는 이 분류 결과가 나올 때까지 중단.
- 이 진단은 백업의 실제 복원 성공, OWNER·ACL/RLS 동등성 또는 보안 승인 아님. 원본 178 migration replay 및 bootstrap 출처는 독립 HOLD. #1341 Draft/미병합, #1208 OPEN, 운영 변경 없음, release HOLD 유지.

### 6.10. 22086행 비식별 분류기 CI 수락 — 실제 SQL 분류 대기 (2026-10-20)

- [GitHub Actions #39359659800](https://github.com/gycha0109-beep/K_beauty/actions/runs/39359659800), job `118422589377`, source commit `4875873afeacb8b21d80bd323522e8080d2970c2` **SUCCESS**. PowerShell parser, synthetic ZIP 출처 줄 분류(ALTER FUNCTION OWNER / GRANT FUNCTION / 다중행 ALTER TABLE OWNER), SQL 원문 유출 방지, 잘못된 SHA 거절, 기존 no-network Supabase PG17 합성 schema/data restore 및 negative 검사 모두 통과.
- 중간 CI #39359225144는 테스트용 ZIP이 1024 bytes 미만이어서 실패했다. #39359534484는 의도적 child exit3이 parent step 결과로 남는 테스트 하네스 문제 때문에 실패; 분류기 정상 출력 자체는 관측했다. 최종 통과는 #39359659800으로만 인정한다.
- **다음 PC 작업(복원 재시도 아님):**
~~~powershell
git fetch origin feat/taxonomy-ai/d8k13-legacy-self-review-reconciliation-design-20261016
$folder = "$HOME\BEJEWELY_Private_DB_Backups"
git show "FETCH_HEAD:scripts/product-evidence/diagnose-d8k13-private-backup-schema-line-local.ps1" |
  Set-Content "$folder\diagnose-line-local.ps1" -Encoding UTF8
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$folder\diagnose-line-local.ps1" -LineNumber 22086
~~~
- 출력의 `D8K13_LOCAL_SCHEMA_LINE_CLASSIFIED_METADATA_ONLY` JSON에서 `verb / objectKind / operation / mentionsKnownPrivateSchema / mentionsKnownFunctionOwnerRole`의 **고정된 분류만** 확보한다. SQL 텍스트·원본 ZIP·비밀키·개인정보 업로드 금지. 분류 결과는 SQL 파서가 아닌 휴리스틱이므로 모호하면 독립적인 비식별 재확인 설계. 무단 GRANT/owner 우회/SQL 주석 처리나 이미 실패한 `-Mode Restore` 반복 금지.
- 원본 ZIP에 대한 실제 성공 미검증, data.sql NOT RUN, RLS/ACL/Auth/Storage/Vault parity 미인증. #1341 Draft 미병합 / #1208 OPEN / 운영 DB write 0 / RELEASE HOLD.

### 6.11. owner 실제 ZIP line 22086이 ALTER FUNCTION OWNER TO임을 확인 (2026-10-20)

- **실제 사용자 PC 비식별 분류:** `D8K13_LOCAL_SCHEMA_LINE_CLASSIFIED_METADATA_ONLY`, `inspectedPhysicalLine=22086`, `nearestTopLevelCommandLine=22086`, `verb=ALTER`, `objectKind=FUNCTION`, `operation=OWNER_TO`. `mentionsKnownPrivateSchema=false`, `mentionsKnownFunctionOwnerRole=false`. `classificationConfidence=LEXICAL_HEURISTIC_NOT_SQL_PARSER`. 실제 ZIP/SQL/비밀번호/개인 데이터 외부 전송 없음. 이 결과가 입증하는 것은 **권한 오류 문장 유형 및 기존 known private owner 보수와의 구분**이지, 새 역할 이름·스키마·누락 권한의 판정이 아니다.
- PostgreSQL 17 `ALTER FUNCTION OWNER` 요구 조건: 기존 객체 소유권과 함께 새 소유자 역할로의 `SET ROLE` 가능 및 대상 역할의 함수 스키마 `CREATE` 권한. 서버 postgres가 superuser라고 가정하지 않는다. 대상 역할이 `roles.sql`에 선언됐는지/ Supabase 이미지 managed role인지/ 스키마 종류가 public/custom/managed인지 불명 상태에서 임의 `GRANT`를 추가하면 안 된다. 레퍼런스: https://www.postgresql.org/docs/17/sql-alterfunction.html.
- **신규 제한적 진단:** `diagnose-d8k13-private-backup-schema-line-local.ps1` 에 메타데이터-only `ownerTransferStatementShape`, `ownerRoleSourceClass`, `functionSchemaClass` 3개 고정 enum을 추가; 대상 role/schema 이름 및 SQL 원문은 출력하지 않는다. 이름 인용/복잡문 등 매칭 불가 시 `UNPARSEABLE/UNDETERMINED`으로 fail closed. 오너 PC 실제 `-LineNumber 22086` 재분류 전에 합성 CI 확인이 필요. 재실행할 작업은 **로컬 분류기만**, `-Mode Restore` 반복 아님.
- `data.sql` 미실행, SQL 복원 미완료, baseline 역할/ACL/RLS/Auth/Storage/Vault parity 미인증, 역할 신규 부여 승인 없음. PR #1341 Draft, #1208 OPEN, release HOLD, production connection/write 0.

### 6.12. role provenance 분류 확장 합성 CI 수락 (2026-10-20)

- **합성 수락:** GitHub Actions [#39364883648](https://github.com/gycha0109-beep/K_beauty/actions/runs/39364883648), job `118439895100`, code commit `79fbd1e3754dab2109b8aed77b24791a6c773082`, SUCCESS. 추가한 역할 출처/스키마 종류 비식별 분류기의 인용 식별자·roles.sql 선언·managed baseline·미지원 식별자 fail-closed·ZIP SHA 거절 검증과 이전 격리 PG17 SQL restore 회귀 모두 통과. **실 ZIP을 CI에 업로드하지 않음**.
- 이제 동일 Windows 로컬 ZIP을 변경하지 말고 최신 `diagnose-d8k13-private-backup-schema-line-local.ps1`을 GitHub 기능 브랜치에서 다시 받아 `-LineNumber 22086`로만 실행. 기존 분류 필드에 `ownerTransferStatementShape`, `ownerRoleSourceClass`, `functionSchemaClass`가 추가된다. 해당 세 고정값만 받아 역할이 백업에 있는지, 대상 스키마가 기본/managed/custom인지 구분; role/schema 식별자·원문·ZIP 업로드 금지.
- 이 절차는 복원 재실행이 아니며, 사용자 측 실제 역할 출처 분류가 오기 전에는 자동 역할 멤버십·CREATE 부여를 하지 않는다. `schema.sql/data.sql` 복원 및 권한·RLS/Auth/Storage/Vault 동등성은 계속 미확인, PR Draft/보안 #1208 OPEN/RELEASE HOLD.

### 6.13. Owner 22086 public 함수 소유권 복원 코딩 및 PG17 합성 수락 (2026-10-20)

- **실 ZIP 사용자의 증거(비식별):** `schema.sql:22086`에서 `ALTER FUNCTION … OWNER TO`, `functionSchemaClass=PUBLIC`, `ownerRoleSourceClass=DECLARED_IN_ROLES_SQL`, SQLSTATE 42501. 기존 `private` 함수·소유자와 다름. 실제 schema/data 복원 미완료.
- **실제 코드 수정:** `scripts/product-evidence/verify-d8k13-private-backup-zip-local.ps1`에서 `ALTER FUNCTION public.<function> OWNER TO <role>` 중 roles.sql의 `CREATE ROLE`로 확인된 안전한 소문자 식별자에 대해서만 `GRANT <role> TO postgres` 및 `GRANT CREATE ON SCHEMA public TO <role>`를 임시 `--network none` PG17 컨테이너에서 준비. 같은 역할 여러 함수는 일괄 처리. `schema.sql`은 로컬 임시 추출본에 원본 줄 번호를 보존하는 방식으로만 권한 SQL을 선행 배치. ZIP/함수 소유권 변경 원문, 운영 Supabase 역할·ACL은 건드리지 않음. 임시 GRANT가 잔류하므로 restore 성공만으로 **권한 동등성 보증 불가**.
- **테스트:** `CREATE ROLE d8k13_public_fixture_owner NOLOGIN` + `CREATE FUNCTION public...` + `ALTER FUNCTION ... OWNER TO` 합성 fixture 추가. CI 최초 #39367681125 는 인용 부호와 Docker ArgumentList 충돌로 42601 실패했고, 검증된 식별자의 불필요한 중첩 SQL 쌍따옴표를 제거. **[CI #39368088218](https://github.com/gycha0109-beep/K_beauty/actions/runs/39368088218) job `118449431599` SUCCESS**; code `fa6fbbbf62291e33b26c7a84eb03a47bb42830ec`. 새 public fixture, 기존 private owner, schema variants, 오류 비식별, ZIP 검증 전체 합성 성공. 실제 ZIP CI 업로드/사용 없음.
- **다음 유일한 owner 절차:** 기존 동일 로컬 ZIP을 바꾸지 않고 아래 최신 기능 브랜치의 검증된 복원 스크립트만 갱신하여 1회 격리 복원. 사용자 PC에 설치된 Docker Desktop / 복원 리포지터리에서 실행한다.
~~~powershell
git fetch origin feat/taxonomy-ai/d8k13-legacy-self-review-reconciliation-design-20261016
$folder = "$HOME\BEJEWELY_Private_DB_Backups"
git show "FETCH_HEAD:scripts/product-evidence/verify-d8k13-private-backup-zip-local.ps1" |
    Set-Content "$folder\restore-local.ps1" -Encoding UTF8
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$folder\restore-local.ps1" -Mode Restore
~~~
- 기대 진단 마커: `D8K13_LOCAL_PUBLIC_FUNCTION_OWNER_GRANTS_STAGED_<N>` 후 `D8K13_DISPOSABLE_PG17_SQL_RESTORE_PASS_LIMITED`; 또는 안전한 SQLSTATE/원본 줄 번호. 실 ZIP 성공으로 표시하려면 실제 schema.sql/data.sql이 모두 완주해야 함. 이후 RLS/ACL/role/owner/데이터 무결성 및 Auth·Storage·Vault 동등성/미포함 범위를 독립 검증. 역사적 178 migration replay 별도 HOLD. PR #1341 DRAFT, #1208 OPEN, release HOLD, 운영 DB 변경/배포/merge 금지.

### 6.14. Owner real ZIP 42883 at schema.sql 36502 after owner-grants, one-pass schema audit (2026-10-20)

- 운영자 실제 동일 ZIP 크기/해시/three SQL PASS, `D8K13_LOCAL_PUBLIC_SCHEMA_PRESERVED_FOR_DUMP`, `D8K13_LOCAL_PRIVATE_FUNCTION_OWNER_GRANT_STAGED_FOR_IN_DUMP_SCHEMA`, **`D8K13_LOCAL_PUBLIC_FUNCTION_OWNER_GRANTS_STAGED_9`** 이후 **`D8K13_LOCAL_RESTORE_SCHEMA_SQLSTATE_42883_LINE_36502_FAILED_EXIT_3`**. `42883=undefined_function` ([PostgreSQL 17 SQLSTATE](https://www.postgresql.org/docs/17/errcodes-appendix.html)); 실제 함수명/연산자/SQL 종류는 아직 불명. 실 schema 트랜잭션 실패, data 미실행, 실 ZIP 복원 미완료. 이번 실패는 이전 42501 권한 문제를 넘어 진행한 지점.
- 원본 SQL 없이 기능을 자의적으로 생성하거나 누락된 함수에 대한 COMMENT/GRANT/트리거를 주석 처리하여 복원 성공이라고 보고하면 **백업 정합성 및 ACL 소유권 보증 불가**. 오류를 무시하는 옵션을 일반 Restore에 넣지 않는다.
- **새 모드 `-Mode AuditSchema`:** 같은 엄격한 ZIP fingerprint, 가상 격리 `supabase/postgres:17.6.1.136` `--network none`, 동일 사전 roles/namespace/owner staging을 거쳐 **schema.sql 전체를 오류 발생 시 중단하지 않고 한 번 실행하는 감사 전용 모드**. 여러 독립 SQLSTATE/물리 라인 및 제한된 어휘상 `verb`/`objectKind`를 최대 80건 수집하며 전체 코드별 발생 개수 집계. 원문/함수명/역할명/데이터/서버 파일경로는 출력하지 않는다. data.sql **실행 금지**, 부분 schema는 finally에서 폐기, `D8K13_DISPOSABLE_PG17_SCHEMA_AUDIT_ONLY_NOT_RESTORE` 반환. 이 결과는 절대 복원 성공으로 취급하지 않는다.
- 감사 mode는 독립 실패를 한 번에 드러내는 데 도움 되나, 앞선 실패의 연쇄 오류가 섞일 수 있으며 오류 위치 근처 SQL의 타입 분류는 SQL 파서가 아닌 lexical heuristic. psql 중단/미분류 오류 발생 시 fail closed.
- owner PC에서는 합성 PG17 CI 통과 후 최신 feature branch 복원 스크립트로 **AuditSchema를 1회 실행**하고 고정 구조 JSON만 가져온다. 실패 그룹별로 원인별 보수/합성 수락 후 Restore 재시도. 178 migration replay, Supabase Auth/Storage/Vault, ACL/RLS/owner parity, #1208 보안, PR #1341 draft/릴리스 HOLD 모두 별도 미해결.

### 6.15. D8K13 전체 스키마 일괄 감사 CI 수락 (2026-10-20)

- **합성 CI 수락:** [GitHub Actions #39375433292](https://github.com/gycha0109-beep/K_beauty/actions/runs/39375433292) job `118472411060` SUCCESS, 코드 `2104abbdd87c6891aa231373854616882c9911dd`. 실 ZIP 미사용. 합성 schema 에서 서로 다른 2개의 `42883` 함수 참조 오류를 `AuditSchema` 한 번으로 집계, SQL 내용/함수 식별자 비노출, data.sql 미실행, 기존 엄격한 `Restore` 회귀 테스트/negative 결과 정상. `42883` 원인의 실제 함수/연산자 이름은 모름. 권한 부여/유실 객체 생성/주석 처리 및 운영 DB 접근 없음.
- **소유자 로컬에서 단 1회 실행:**
~~~powershell
git fetch origin feat/taxonomy-ai/d8k13-legacy-self-review-reconciliation-design-20261016
$folder = "$HOME\BEJEWELY_Private_DB_Backups"
git show "FETCH_HEAD:scripts/product-evidence/verify-d8k13-private-backup-zip-local.ps1" |
  Set-Content "$folder\restore-local.ps1" -Encoding UTF8
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$folder\restore-local.ps1" -Mode AuditSchema
~~~
- 결과 `D8K13_DISPOSABLE_PG17_SCHEMA_AUDIT_ONLY_NOT_RESTORE` JSON **한 덩어리만** 받아 오류 SQLSTATE 빈도/라인/문장 종류를 함께 검토해 원인을 묶어서 수정. 이전 `-Mode Restore`를 반복하지 않으며, `AuditSchema` 결과는 schema/data 복원 성공으로 보지 않는다. `ERROR` 출력이 raw SQL 포함하는 경우 업로드 불허. #1341 DRAFT, #1208 OPEN, release HOLD, 178 migration replay 별도 보류.

### 6.16. Owner real 20-policy zero-reference lexical coverage correction (2026-10-20)

- Owner returned `D8K13_POLICY_REFERENCE_INVENTORY_LOCAL_ONLY` for 20 policies, lines 36502–36578, with `uniqueQualifiedReferenceCount=0`, `references=[]`, `unresolvedUnqualifiedOrDynamicReferencesPossible=true`; immutable private ZIP and DB non-upload checks still true. **This does not prove no routines or that the failure has been resolved.** Original inventory recognized only unquoted `namespace.routine(...)` and missed bare `routine(...)` and quoted `"namespace"."routine"(...)`.
- Updated same offline read-only `scripts/product-evidence/diagnose-d8k13-policy-dependencies-local.ps1`: detect three lexical forms, strip single-quoted string constants and SQL comments, preserve the existing 20-policy exact-boundary checks, group routine identifiers by occurrences and compare `CREATE FUNCTION` lexical declarations. New fields `uniqueUnqualifiedReferenceCount`, `quotedIdentifiersObserved`, `lexicalReferencesAreNotProofOfMissingFunctions`. The output remains only object identifiers and bounded metadata, never original SQL statements/credentials/user records. **This heuristic cannot establish function signature, search_path resolution, operator lookup, execution security, or actual presence in disposable PG17.**
- **CI accepted** [#39382818032](https://github.com/gycha0109-beep/K_beauty/actions/runs/39382818032) job `118495596109` SUCCESS for tested commit `dfb65e16d75fe18ec542af8884fe07ea057b5e6f`; synthetic 20 CREATE POLICY references include quoted managed `auth.uid`, quoted `public.my_helper`, bare `missing_local_helper`; previous PG17 schema/data restore synthetic regressions also passed. Actual owner ZIP not uploaded or tested in CI.
- **Next owner-only action:** Refresh the same script from feature branch and rerun against unchanged local immutable ZIP, no Docker or production connection. Interpret result as candidate routine references, not proven cause. If no lexical functions are found again, do not invent an object or modify policies; use stronger isolated SQLSTATE metadata diagnosis. Strict Restore and D8K full release/HOLD unaffected. PR #1341 Draft, issue #1208 OPEN, D8D v2 OFF; 178 historical migrations/Auth-Storage-Vault/ACL/RLS parity still unverified.

### 6.17. 20-policy Auth JWT/UID dependencies, disposable-only helper bootstrap (2026-10-20)

- **Owner private ZIP verified metadata:** `D8K13_V2_SCRIPT_VERIFIED`, 20 failed `CREATE POLICY` lines 36502–36578. All 20 reference **`auth.jwt()`**, **`auth.uid()`** and `coalesce`; only one references `btrim` and `jsonb_typeof`. Neither `auth.jwt()` nor `auth.uid()` is declared in the public-schema-only ZIP `schema.sql`; `coalesce` is a PostgreSQL special expression, and `btrim`/`jsonb_typeof` are built-ins (not missing custom routines). The reference inventory is lexical, not conclusive proof of actual runtime missing function(s).
- **Owner-independent verified upstream:** Supabase Auth migration `20220531120530_add_auth_jwt_function.up.sql` supplies `auth.jwt() returns jsonb language sql stable` reading JWT claims; `20220224000811_update_auth_functions.up.sql` supplies `auth.uid() returns uuid language sql stable` reading JWT sub. The database image can omit later managed Auth migrations. The `postgres` role is demoted and may not have CREATE permission on managed `auth` schema, causing SQLSTATE `42501` if it attempts managed bootstrap.
- **Code:** `verify-d8k13-private-backup-zip-local.ps1`, both strict `Restore` and diagnostic `AuditSchema`, in **disposable no-network PG17 only** when dump calls `auth.uid`/`auth.jwt`: fail closed if dump declares the functions, stage locally generated Supabase Auth baseline SQL, execute using image-native `supabase_admin` on a **local Unix socket** (not production), create only absent zero-argument functions, never replace pre-existing managed functions, validate return types UUID/JSONB, STABLE and invoker security. Marker: `D8K13_LOCAL_DISPOSABLE_AUTH_CLAIMS_HELPERS_VERIFIED`. Policies stay unchanged; no RLS bypass, no data skipped; source ZIP remains immutable. This limited test environment does **not** establish managed service parity, real Auth semantics, ACL equivalence, or release readiness.
- **CI:** [workflow run #39391834303](https://github.com/gycha0109-beep/K_beauty/actions/runs/39391834303), job `118524957615`, **SUCCESS**, tested code commit `b11d59c0c32234cbe8d83c6f9a38e73b8acc9350`. Synthetic private-free RLS policy references `auth.uid()` and `auth.jwt()`, and asserts auth stage marker and full synthetic PG17 schema/data restore, along with old namespace/ownership/audit/negative regressions. Earlier two attempts failed while setting up Auth: `42501` when executed as demoted `postgres` resolved by `-U supabase_admin`.
- **Owner-only next gate:** fetch the latest feature branch *restore* script, verify it contains `D8K13_LOCAL_DISPOSABLE_AUTH_CLAIMS_HELPERS_VERIFIED`, and run exactly once with `-Mode Restore` against the original same-size/hash local ZIP. Only a real result with `D8K13_DISPOSABLE_PG17_SQL_RESTORE_PASS_LIMITED` can establish limited ZIP schema/data viability; further validation required. Do not share raw ZIP/SQL/errors with raw identifiers. Real restore remains **PENDING** at this writing.
- PR #1341 **DRAFT, unmerged**, issue #1208 **OPEN**, production connections 0, no production permission changes, D8D v2 OFF, release HOLD, 178 migrations replay HOLD, managed Auth/Storage/Vault and ACL/RLS parity pending.

### 6.18. Real owner ZIP DATA SQLSTATE 42703 line 28 after full schema restore (2026-10-20)

- **Owner 실제 ZIP:** same immutable 7,323,679-byte file SHA-256 `A3E290AE2368D1032786A2202E60B1E328341B8A9C7DFAD1FD9A0F2DABEAD2C6`. `D8K13_LOCAL_ZIP_INSPECTION_PASS`, public schema preserved, disposable `auth.uid()/auth.jwt()` prepared, private owner stage, **public owner changes 9**, private grant ready. The process continued past the strict transactional schema restore into **data.sql**. `D8K13_LOCAL_RESTORE_DATA_SQLSTATE_42703_LINE_28_FAILED_EXIT_3` = `undefined_column`. The exact source data operation and affected target table or column remain unknown; **data restore incomplete**, all rows not imported, no backup corruption established.
- Existing PG17 container includes managed Supabase baseline independent of the user's hosted-project version. Data-only COPY columns can differ, especially for managed tables omitted from the public schema dump. Do **not** invent missing columns/types, disable constraints, skip COPY blocks, alter hosted Auth/Storage or claim parity.
- New `-Mode AuditData` first repeats the same **strict schema.sql restore** in a disposable, `--network none` PG17 container, then **streams only COPY headers** from source `data.sql` and compares all source column names with actual `pg_namespace`/`pg_class`/`pg_attribute` metadata from the same restored container in one query. Source data rows **never inserted or returned**. Output `D8K13_DISPOSABLE_PG17_DATA_COPY_HEADER_AUDIT_ONLY_NOT_RESTORE` includes COPY counts, mismatch counts, source line and generic schema class (PUBLIC / SUPABASE_MANAGED / OTHER_SCHEMA), not table names, column names, original SQL or row contents. Unsupported COPY formats fail closed.
- A synthetic fixture with a single intentionally absent column in an otherwise valid `COPY` is added to GitHub Actions; CI workflow #39394837449. Owner private ZIP is unavailable to CI. The next owner-only gate is one `-Mode AuditData` run **after synthetic CI succeeds** to collect all table-family/data COPY mismatches and separate managed-image divergence from public custom schema issues. No release, hosted permissions, data writes, migrations or PR merge authorized.

### 6.19. Owner ZIP data COPY managed schema drift and local named-detail gate (2026-10-20)

- **Observed owner-only AuditData result:** unchanged ZIP SHA-256 `A3E290AE2368D1032786A2202E60B1E328341B8A9C7DFAD1FD9A0F2DABEAD2C6`; schema strict replay PASS; 134 COPY headers / 1,680 referenced source columns; **18 missing destination columns**, **280 source-column references to nonexistent destination tables**, **32 affected COPY headers**; **all 32 classified as SUPABASE_MANAGED**, none flagged PUBLIC/OTHER. Header parser parsed all 134; source row SQL never executed. `data.sql` full restore remains blocked and source backup not proven corrupt.
- **New owner-only `-Mode AuditDataDetail`:** strict schema restore remains a prerequisite. After matching every COPY header to the disposable PG17 catalog, construct metadata records: source line; schema; table; `MISSING_TABLE` or `MISSING_COLUMNS`; source column count; *only* missing destination column names. Named records are written under the owner's existing private backup directory to a new unique `D8K13_LOCAL_COPY_DRIFT_DETAILS_*.json` file. **Do not upload or commit this file.** Console shows aggregate per-schema-class counts and the local path, but **never** named objects, raw SQL, rows or secrets. Original ZIP and any hosted DB stay untouched.
- **Acceptance scope:** CI run [#39431867966](https://github.com/gycha0109-beep/K_beauty/actions/runs/39431867966) covers missing-column + absent-managed-table synthetic fixture; no real backup is used by CI. Await CI result and owner's named metadata examination before selecting any managed-service baseline/restore strategy. Do not add ad-hoc Auth/Storage tables, silently strip COPY commands, weaken RLS, or claim Auth/Storage/Vault data/ACL parity.
- **Gate:** PR #1341 Draft, issue #1208 open, 178 migrations not replayed, D8D v2 OFF, **RELEASE HOLD**; no production writes, no merge.

### 6.20. Exact Auth/Storage baseline gap and separately gated public COPY recovery (2026-10-20)

- **Owner named-detail evidence:** all 32 incompatible COPY headers are managed service objects: Auth has 22 missing tables plus 3 existing tables with 18 missing columns; Storage has 7 missing tables. The owner shared only table/column names; real SQL, row data and source ZIP remain on the owner PC. No public COPY structural failures were reported.
- **Root cause and official recovery contract:** standalone supabase/postgres:17.6.1.136 initializes some service namespaces, but not Auth/Storage service-managed schema migrations to parity with the source platform. Supabase official CLI backup/restore instructions target a preconfigured and initialized Supabase project, not the standalone database image. Do not hand-create the 29 managed tables, hand-add 18 columns, silently omit managed data in a purported full restore, or claim the ZIP is corrupt.
- **New isolated limited proof mode RestorePublicData:** inspect and strictly replay roles/schema in a disposable --network none PG17 container, then scan data.sql using a fail-closed source command allowlist. Retain only public COPY blocks and public sequence resets; recognize but do not replay pg_dump SET/search_path setup lines, and explicitly discard all Auth/Storage/other-schema COPY data. Session-settings and data-value semantic parity are NOT yet validated; a limited positive check verifies only public COPY table row counts. Run one isolated transactional public COPY restore and check actual per-table COUNT(*) against source COPY row counts. Never import original backup rows into CI, display private SQL/data, alter the original ZIP, connect to hosted production, or modify live permissions.
- **Proof boundary:** a passing limited public-only restore validates only public COPY row counts and declared sequence commands, not application behavior, FK referential integrity (triggers disabled for import), Auth account/session recovery, Storage object metadata or file bytes, Vault root key, migration history, ACL/RLS/owner parity, full DR, or release readiness. In particular, Auth and Storage managed COPY remain deliberately unimported, and the mode returns allDataRestored=false.
- **Synthetic acceptance complete:** GitHub Actions #39445406530 and final [#39446671276](https://github.com/gycha0109-beep/K_beauty/actions/runs/39446671276) both SUCCESS. Tests exercise two public COPY blocks, one public sequence reset, skipped Auth/Storage COPY, exact table row counts, an unsupported-SQL negative case, and all existing isolated PG17 regressions. Source private ZIP stays local; Owner real ZIP RestorePublicData has NOT run. Source script is byte-identical to CI-proven code 6c9aed011888e8a9a0b7877346fa1ac55184c3a2 (restored at 7599f54ddb5a1de951f599eac6e1443b09231358 after a parser-failing settings-preservation experiment).
- **HOLD:** PR #1341 Draft/unmerged; issue #1208 OPEN; 178 migrations not replayed; D8D v2 OFF; production connections/writes 0; RELEASE HOLD.

### 6.21. Owner partial-public restore blocked by pg_dump setval grammar (2026-10-22)

- **Owner-side evidence:** original ZIP inspection fingerprint PASS; the strict schema restore completed and the subsequent RestorePublicData scan failed closed with D8K13_PUBLIC_DATA_SEQUENCE_FORMAT_UNSUPPORTED_LINE_18268. No public COPY rows were applied because the scan checks the entire source before SQL execution. No backup corruption is established.
- **Cause hypothesis grounded in PostgreSQL output:** previous script allowed only SELECT pg_catalog.setval('public.seq'::regclass, n, true/false); while standard pg_dump outputs the otherwise identical command *without* ::regclass (see PostgreSQL official mailing-list output). Exact private source line text was not uploaded, so match against the owner's backup remains to be confirmed by a successful owner rerun.
- **Code fix:** commit 1ce5532c82fb950d891ab0f583ef305e74d9a972 makes the regclass cast optional but retains strict schema-qualified identifier validation, bounded signed integer, true/false and semicolon anchoring. Non-public sequence resets remain skipped, never executed. Public COPY and Auth/Storage gates are unchanged.
- **Synthetic confirmation:** full [D8K13 PG17 workflow #39766727882](https://github.com/gycha0109-beep/K_beauty/actions/runs/39766727882) SUCCESS, including both cast and no-cast public sequence reset fixtures, nonpublic-managed no-cast reset skip, public rows/counts and negative unsupported SQL rejection. No owner backup SQL or data was used in GitHub CI.
- **Next owner gate:** fetch verified branch script by git show without merging/stashing the owner's local .codex/AI_WORK_LOG.md, then rerun RestorePublicData on the unchanged private ZIP. A pass would prove only isolated public COPY row counts; it must **not** be interpreted as full Supabase recovery, Auth/Storage parity, FK/RLS/ACL parity or release permission. PR #1341 DRAFT, issue #1208 OPEN, RELEASE HOLD.

### 6.22. Full-data command-family audit after 18,291 preflight error (2026-10-22)

- **Owner report:** immutable real ZIP fingerprint PASS, strict schema replay PASS, then RestorePublicData was stopped by `D8K13_PUBLIC_DATA_UNEXPECTED_SOURCE_COMMAND_LINE_18291`. The previous sequence `setval()` format failure at line 18268 was no longer observed, supporting that its narrow syntax fix was exercised. The source-only COPY-selecting pass stopped before invoking actual data import; **no public or managed COPY rows restored**, no production connections or backup changes.
- **Next diagnostic is source-only `-Mode AuditDataCommands`**, not another disposable PostgreSQL restore. It reads the validated local ZIP and streams all lines of data.sql once, skipping all COPY payload lines and never executing SQL, starting Docker or opening network connections. A fixed whitelist classifies recognized COPY, setval and pg_dump setup commands. Any other non-payload line produces only a **fixed command family enum and source line number**; output aggregates counts and up to 200 enumerated samples (no table/column names, raw source SQL, literals, row values, secrets or SQL excerpts). Missing/unsupported COPY headers are classified too, not silently accepted.
- **Safety/acceptance:** the audit reports no restore completion, no data import, no source mutations and no release authorization. Run the synthetic negative fixture before owner execution: known SQL outside COPY should be classified across multiple lines, while fake SQL text embedded in COPY payload must be ignored. This identifies all unusual commands at once instead of piecemeal patching one line per restore attempt.
- **Synthetic CI:** an initial command-family fixture run #39775067827 found a PowerShell generic-list serialization mismatch; corrected using ToArray() at commit dfb9f10482f223359461019843654c67729d2710. Full [PG17 and local-only command audit workflow #39775759787](https://github.com/gycha0109-beep/K_beauty/actions/runs/39775759787) **SUCCESS**, covering three unknown command families, skipped COPY payload, two pg_dump setval forms, ZIP immutability and all existing restore regressions. Owner real ZIP command-family audit not yet run. Keep PR #1341 Draft/unmerged, issue #1208 OPEN, D8D v2 OFF, **RELEASE HOLD**.

### 6.23. Only one unknown source trailer command remains; guarded RESET ALL support (2026-10-22)

- **Owner AuditDataCommands (real unchanged ZIP):** scan of entire `data.sql` reports 18,291 physical lines, 134/134 valid COPY headers, 17,168 COPY payload lines skipped, 3 supported `pg_catalog.setval` sequence resets, 11 SET lines, 1 search_path set_config, 839 comments/blank lines and exactly **one unrecognized command on final line 18,291**, classified only as `OTHER_SQL_KEYWORD`. Docker was not started, no COPY rows imported, source SQL/values not returned, original ZIP unchanged.
- **Supported hypothesis, not source confirmation:** Supabase CLI restore runbooks document `data.sql` beginning with session_replication_role=replica and ending in `RESET ALL;`. The final line's exact content is not shared; classify this as a **plausible** terminal session cleanup statement, not a proven fact. Reference https://github.com/jwh3times/magic-agenda/blob/main/docs/runbooks/restore-from-backup.md .
- **Guarded parser adjustment:** source-only AuditDataCommands recognizes only exact `RESET ALL;` syntax as `RESET_ALL_SYNTAX_RECOGNIZED` and otherwise names fixed SQL keyword types, never raw SQL. RestorePublicData accepts exactly `RESET ALL;` as a **terminal** non-executed command (trailing blank/comment lines allowed); any subsequent executable line fails closed before data import. The limited partial COPY pipeline already ignores original dump SET statements and supplies its own disposable replication_role=replica; thus ignoring source trailer cannot enable DDL or production changes. No broad RESET, COMMIT or arbitrary SQL allowance.
- **Synthetic acceptance PASS:** GitHub Actions [#39780628115](https://github.com/gycha0109-beep/K_beauty/actions/runs/39780628115) completed **SUCCESS**. Verified positive terminal reset, negative nonterminal reset (no import), public COPY row counts, SQL-like COPY payload not parsed, sequence cast/no-cast, and the complete prior PG17 restore/audit/security regression suite. Code and run remain on Draft PR #1341; the real ZIP RestorePublicData must be rerun to verify that the final trailer matches the exact syntax and to check actual public table row counts.
- **Release boundary unchanged:** no managed Auth/Storage data, storage file bytes, full FK/RLS/ACL parity, full migration replay or service recovery verified. Issue #1208 OPEN, 178 migrations not replayed, D8D v2 OFF, **RELEASE HOLD**.


### 6.24. 실소유자 ZIP의 격리 public COPY 101테이블 / 12,220행 제한 복원 성공 (2026-10-23)

- **증거 출처/범위:** 운영자가 ChatGPT에 반환한 `AuditDataCommands` JSON, `RestorePublicData` JSON 및 `D8K13_OWNER_PUBLIC_RESTORE_VERIFIED` 마커. 사용자 PC 원본 ZIP 또는 SQL/행 데이터에는 연결하지 않았으며, 독립적인 PC 원격 실행 결과가 아닌 **운영자 제공 비식별 실행 증거**다. 기존 CI [#39780628115](https://github.com/gycha0109-beep/K_beauty/actions/runs/39780628115)는 실데이터 없이 합성 테스트만 성공했다. 확인 당시 작업 브랜치 `b2d62f19144741f7ddef5c8c0af2558746931d29`에서 복원 스크립트 Git blob `2af909e93b1b85f99936d34e98b5fd6accdc4529`는 합성 수락 이후 미변경이었다.
- **원본 ZIP 무결성:** 7,323,679 bytes, SHA-256 `A3E290AE2368D1032786A2202E60B1E328341B8A9C7DFAD1FD9A0F2DABEAD2C6`. 운영자 제공 검증 명령에서 시작 전과 종료 후 SHA 일치. 원문 ZIP/SQL/행 데이터 미업로드, 원본 변경 없음.
- **소스-only 명령 감사 PASS:** `sourceLines=18291`, `copyHeaders=134`, `copyPayloadLinesNotInspected=17168`, `COPY_VALID=134`, `SETVAL_VALID=3`, `SET_VALID=11`, `SET_CONFIG_VALID=1`, `COMMENT_OR_BLANK=839`, `RESET_ALL_SYNTAX_RECOGNIZED=1`, `unexpectedCommandCount=0`. 마지막 명령은 정확한 `RESET ALL;` 문법으로 인식됐으므로 이전 추정이 **문법 분류 수준에서** 확인됐으며 SQL 원문은 열람·게시하지 않았다.
- **제한적 격리 복원 PASS:** `D8K13_DISPOSABLE_PG17_PUBLIC_DATA_RESTORE_PASS_LIMITED`; strict `schema.sql` 성공, 총 134 COPY 중 `public` COPY **101개** 실행, `public` 대상 테이블 **101개**, 복원 후 테이블별 COUNT와 소스 COPY 행 수 일치 **총 12,220행**, `public` sequence `setval` **2개** 적용, 비-public sequence **1개** 제외, 관리형 COPY **33개** 제외, 기타 스키마 COPY **0개**. 마지막 `RESET ALL;`은 실행하지 않고 정상 생략. 격리 PG17의 `--network none`; 운영 DB 연결 0; 릴리스 승인 false.
- **입증하지 않은 것:** 행별 원본 byte/값 동일성 및 외부키 데이터 참조 정합성(복원 COPY 단계 트리거 우회), 시퀀스 다음값 정확성, RLS 정책·권한·OWNER·SECURITY DEFINER의 운영 동등성, Supabase Auth·Storage 관리형 데이터 및 Storage 실제 파일 bytes, Vault 키, 실제 서비스 부팅, 전체 178 migrations replay 또는 운영 PITR. `allDataRestored=false`, `foreignKeyReferentialParityVerified=false`, `authDataRestored=false`, `storageMetadataRestored=false`, `releaseAuthorized=false`가 명시돼 있다.
- **다음 P0:** 현재 백업 스냅샷에 한정해 `public` FK 관계와 참조 건수, 시퀀스 메타데이터/현재값, RLS/owner/ACL/GRANT/REVOKE 및 객체 메타데이터 동등성을 *읽기 전용·격리*로 단계별 확인한다. 관리형 `auth` 참조에 의존하는 FK는 Auth 데이터 미복원 상태로 별도 `BLOCKED_MANAGED_DEPENDENCY`로 분리한다. 기존 컨테이너는 자동 삭제된 상태이므로 이 검증은 새 격리 실행과 별도 검증 수락이 필요하다. 역사적 178-migration lineage 문제는 snapshot 재해 복구와 분리된 릴리스 차단으로 유지한다.
- **상태:** `PUBLIC_DATA_LIMITED_RESTORE_PASS` / `FULL_RECOVERY_NOT_ATTESTED` / `RELEASE HOLD`. PR #1341 계속 Draft/미병합, issue #1208 OPEN, D8D v2 OFF; 무승인 운영 SQL, ACL/Auth 변경, migration repair, Product/Offer/CTA 활성화, 병합·배포 금지.


### 6.25. 격리된 실제 public→public 외래키 참조 무결성 PASS (2026-10-23)

- **소스:** 운영자 Windows `DESKTOP-6C3L8O4`에서 연결된 Remote Desktop Commander로 직접 실행. ZIP 크기 7,323,679 bytes 및 SHA-256 `A3E290AE2368D1032786A2202E60B1E328341B8A9C7DFAD1FD9A0F2DABEAD2C6` 실행 전후 재확인. 스크립트는 GitHub commit `ac95fc58dda5952b45b6dffa807590b2e831a3f4`의 `-Mode RestorePublicDataWithPublicFkAudit`. 최초 Docker Desktop 미기동으로 image pull 단계에서 차단(원본/운영 DB 영향 없음); Docker Desktop 기동 후 재실행 **PASS**.
- **합성 CI:** [#39882815706](https://github.com/gycha0109-beep/K_beauty/actions/runs/39882815706) 전체 SUCCESS. 기존 비공개 백업 ZIP 파서·격리 스키마·public COPY 회귀 + 정상 public→public FK + 고아 FK + 복합 MATCH FULL 일부 NULL 반례가 올바르게 통과/거절되는지 검증. 이전 두 CI 실패는 코드 삽입 중 파서 오류 및 의도한 음성 테스트의 잔류 종료 코드였으며 최종 실행에서 해소. 실제 백업은 GitHub CI에 제공하지 않음.
- **실제 데이터 검증:** strict schema restore PASS; `public` COPY 101개/테이블 101개, 소스·실제 테이블별 행 수 일치 12,220행, `public` sequence setval 2개, 관리형 COPY 33개 제외, 비-public sequence 1개 제외. `public` child → `public` parent FK **199개 검사, 위반 FK 0개, 위반 행 0개, 지원되지 않는 검사 형식 0개**. Auth 등 **비-public parent 참조 FK 34개 제외** (보호 대상 관리형 데이터가 존재하지 않아 별도로 BLOCKED). 총 대상 FK 233개 = 199 검사 + 34 분리.
- **안전:** disposable PG17 `--network none`, Docker 컨테이너 종료 후 정리, 원본 ZIP 불변, 운영 DB 연결 0, 원문 SQL/행·민감한 이름 출력 0. 출력은 카운트 및 상태만 포함. `foreignKeyReferentialParityVerified=false`는 관리형 관계 미검증을 정확히 보존; `publicToPublicForeignKeyRowsVerified=true`.
- **다음 범위:** 격리된 시퀀스 source setval 정확성 및 `nextval` semantics 별도 점검; ACL/OWNER/SECURITY DEFINER/RLS 및 view/trigger parity 평가; 관리형 Auth/Storage 의존 참조 34개는 관리형 베이스라인 없이 강제 검사 금지. 178 migration provenance 불일치와 security issue #1208 OPEN은 **독립 RELEASE BLOCKER**.
- **상태:** `PUBLIC_FK_199_PASS_ZERO_VIOLATIONS`, `MANAGED_PARENT_34_BLOCKED`, `FULL_SUPABASE_RECOVERY_NOT_ATTESTED`, **RELEASE HOLD** / D8D v2 OFF / PR #1341 Draft·미병합 / 어떠한 운영 SQL·병합·배포 승인도 아님.


### 6.26. 실제 백업 public 시퀀스 setval 상태의 격리 검증 PASS (2026-10-23)

- **운영자 PC 직접 실행:** 승인된 Windows Desktop Commander의 원본 ZIP `BEJEWELY_DB_Backup_20261018_181006.zip`(7,323,679 bytes, SHA-256 `A3E290AE2368D1032786A2202E60B1E328341B8A9C7DFAD1FD9A0F2DABEAD2C6`)을 로컬에서 검사; 원본 변경 없음. GitHub HEAD `51742466feb51005ecb6441ed78bf2cf155f7239` 기준 스크립트 `-Mode RestorePublicDataWithIntegrityAudit`, `supabase/postgres:17.6.1.136`, Docker `--network none`, 운영 DB 연결 0.
- **합성 수락:** [워크플로 #39891138819](https://github.com/gycha0109-beep/K_beauty/actions/runs/39891138819) SUCCESS. 원본 아카이브 미제공 합성 소스에서 `setval`의 `is_called=true/false` 상태를 검증하고 기존 public COPY/FK 및 차단 회귀 PASS.
- **운영자 ZIP 결과:** `D8K13_OWNER_PUBLIC_INTEGRITY_SEQUENCE_VERIFIED_LIMITED`. public COPY/테이블 101개, 총 행 수 12,220개 일치. public-parent FK 199개 검사·위반 제약 0개·위반 행 0개·비-public-parent 34개 미검증 분리. public source `setval` 2개와 복원된 실제 sequence last_value/is_called **2/2 일치**, 카탈로그 public sequence 2개, 산술상 nextval 범위 초과 예상 0개. `nextval()`은 호출하지 않아 시퀀스 상태를 변경하지 않음.
- **범위 제한:** 시퀀스 수치 검증은 백업 명시적 `setval` 대상에 한정. `nextval` 실제 실행·동시성·운영 트래픽 또는 `RLS/ACL/OWNER` 동등성을 입증하지 않는다. 관리형 Auth/Storage/Vault 원본 데이터 및 부모 FK 34개, 전체 마이그레이션 이력 178개, security issue #1208는 독립 차단이다.
- **다음 게이트:** 격리 DB의 `public` 권한·소유권·RLS 정책 카탈로그를 비식별·집계 형태로 점검하고 실제 운영 hosted baseline과의 비교 가능 여부를 따로 판정할 것. 원본 SQL/행/역할명·민감한 grant 본문을 GitHub 또는 외부 응답에 노출하지 말 것.
- **상태:** `PUBLIC_SEQUENCE_2_OF_2_STATE_PASS` / `PUBLIC_FK_199_PASS` / `FULL_RECOVERY_NOT_ATTESTED` / **RELEASE HOLD**, PR #1341 Draft·미병합, D8D v2 OFF. 운영 데이터/권한 변경, SQL, 병합, 배포 미승인.


### 6.27. 실제 백업 public 보안 카탈로그 집계; 함수 권한 리뷰 필요 (2026-10-23)

- **실행 출처:** 승인된 운영자 Windows PC에서 원본 ZIP SHA-256 `A3E290AE2368D1032786A2202E60B1E328341B8A9C7DFAD1FD9A0F2DABEAD2C6`의 수정 없는 격리 PG17 검사. 스크립트 HEAD `76810246b39e2792f087ff7aff230a54687312af`, 모드 `RestorePublicDataWithSecurityInventory`, 합성 CI [#39896462011](https://github.com/gycha0109-beep/K_beauty/actions/runs/39896462011) SUCCESS. 원본 SQL/행/민감한 식별자 출력 없음; 운영 연결 0, 네트워크 차단.
- **재확인:** public 테이블 101개·COPY 행 12,220개, public FK 199개/위반 0개, managed parent FK 34개 제외, public sequence 2개 setval 원본 상태 일치.
- **RLS 집계:** 101 테이블 모두 RLS ON; FORCE RLS 4개; RLS ON이면서 정책 0개인 테이블 77개; 정책 58개(전부 permissive, restrictive 0개). 정책 0개는 일반적으로 non-bypass 역할에 기본 거부이나 SECURITY DEFINER / BYPASSRLS / OWNER 예외와 실제 서비스 의도를 별도 평가해야 함. hosted 보안 동등성은 입증되지 않음.
- **함수/OWNER/ACL 집계:** public 함수 187개 중 SECURITY DEFINER 135개; postgres 소유 178개/기타 역할 소유 9개. `has_function_privilege` 기준 격리 DB의 anon/authenticated 실효 EXECUTE = 각 187개; 그중 SECURITY DEFINER 실효 EXECUTE = 각 135개. 이는 explicit GRANT만을 뜻하지 않으며 기본 PUBLIC EXECUTE·상속도 포함한다. 함수별 body/search_path/내부 인증 및 호스티드 비교 없이 취약점으로 확정하지 않음. 하지만 **SECURITY_REVIEW_REQUIRED**로 안전성·권한 출처를 확인할 때까지 RELEASE HOLD.
- **테이블/뷰:** `publicTablesExplicitSelectForBrowserRoles=101`은 카탈로그 relacl/acldefault에서 grantee 0/PUBLIC 또는 anon/authenticated로 직접 표기된 SELECT 항목이 있는 테이블을 센 값이며, 실제 RLS 적용 후 행 열람 가능을 뜻하지 않는다. public view 6개 모두 `security_invoker=true`; security_barrier=true 뷰 0개.
- **한계/다음:** 스냅샷 자체 집계 결과이며 hosted ACL/role membership 비교, schema `GRANT/REVOKE` 유래 교차 검증, 135 SECURITY DEFINER의 function-level authorization/SET search_path/호출 그래프 리뷰, 정책별 접근 기능 테스트는 미실시. 관리형 Auth/Storage 미복원, 178 migrations provenance 및 issue #1208 OPEN은 독립 릴리스 차단.
- **상태:** `PUBLIC_SECURITY_CATALOG_COLLECTED` / `SECURITY_DEFINER_EXECUTE_REVIEW_REQUIRED` / `RLS_ACL_OWNER_PARITY_NOT_ATTESTED` / **RELEASE HOLD**, D8D v2 OFF, PR #1341 Draft·미병합. 운영 SQL·권한 변경·병합·배포 없음.


### 6.28. SECURITY DEFINER 135개: EXECUTE 권한 출처·함수별 search_path 카탈로그 조사 (2026-10-23)

- **검증:** 소유자 Windows PC 원본 ZIP SHA-256 `A3E290AE2368D1032786A2202E60B1E328341B8A9C7DFAD1FD9A0F2DABEAD2C6` 전후 무변경. `RestorePublicDataWithSecurityInventory` 격리 PG17/no-network 실행, 원문 SQL·사용자 행·함수명은 출력하지 않음. 스크립트 `8349c169a6fe3a77b0556e43c2ad3a7ea76a833c`; 합성 CI [#39898675361](https://github.com/gycha0109-beep/K_beauty/actions/runs/39898675361) SUCCESS. 인증/운영 DB 연결 0.
- **135개 SECURITY DEFINER EXECUTE 출처:** NULL `proacl` 기본값 0개, 명시적 `proacl` 135개. default `PUBLIC EXECUTE` 0개, explicit `PUBLIC EXECUTE` 0개, 실효 `PUBLIC EXECUTE` 0개. 대신 **135개 모두 anon·authenticated에 각각 explicit EXECUTE GRANT 존재** (`aclexplode(proacl)`), 양 역할 모두 `rolbypassrls=false`. 함수의 고권한 실행 자체와 RLS 우회 여부는 함수 소유자 및 내부 구현에 좌우된다.
- **검색 경로:** 모든 SECURITY DEFINER 함수 135개에 함수별 `proconfig`의 명시적 `search_path` 존재, 미설정 0개. 그중 **69개는 `public` 경로를 포함**. `public` 포함 여부 자체만으로 취약성 확정 불가; 경로 순서, 객체 이름 해석, 변조 가능한 객체와 접근권한, 모든 SQL 문맥 및 SECURITY DEFINER 본문 확인 필요.
- **기존 public 무결성 유지:** 101 테이블/12,220행, public-parent FK 199개 위반 0, 관리형-parent FK 34개 미검증, public sequence 2개 복원 상태 일치.
- **위험 판정:** `SECURITY_DEFINER_AUTHZ_REVIEW_REQUIRED`, `SEARCH_PATH_REVIEW_REQUIRED`. 위 결과는 isolated snapshot의 사실이지 hosted 시스템에 동일한 GRANT/OWNER/함수 정의가 있다고 보증하지 않음. 취약점 건수로 환산 금지; 권한 임의 REVOKE, 정책 해제, 릴리스 승인 금지.
- **다음 게이트:** 135개 함수 중 웹역할 직접 호출 가능 함수에 대해 소유권/인자·RETURNS/SECURITY DEFINER 본문과 `search_path` 조합, 내부 `auth.uid()/auth.jwt()`·서비스 권한 검사 여부를 비밀 데이터 유출 없이 감사. hosted `pg_proc/proacl` 동등성 비교 및 승인 경로 확보 전 **RELEASE HOLD**, PR #1341 Draft·미병합, D8D v2 OFF, issue #1208 OPEN.


### 6.29. SECURITY DEFINER 135개 함수 본문 lexical signal 격리 분류 (2026-10-23)

- **출처:** 운영자 Windows PC의 원본 ZIP SHA-256 `A3E290AE2368D1032786A2202E60B1E328341B8A9C7DFAD1FD9A0F2DABEAD2C6` 실행 전후 동일. 합성 CI [#39903567164](https://github.com/gycha0109-beep/K_beauty/actions/runs/39903567164) SUCCESS, 스크립트 `fcc8b9c7699f67c253c3ab221ef03bb492a1228d`, `RestorePublicDataWithSecurityBodySignals`. Disposable PG17 `--network none`, 생산 연결 0, 함수 이름/본문/인자/원문 SQL/사용자 행 출력 0. 101 public 테이블·12,220행, FK 199개 위반 0개, sequence 2개 재검증 유지.
- **범위:** 공개 스키마 `SECURITY DEFINER` 함수 135개: PL/pgSQL 113개, SQL 22개, 타 언어 0. 정규식에 의한 함수 본문 문자열 분석만 수행; 주석·SQL 문자열·간접 호출이 혼재할 수 있어 *인증 부재나 취약성 확정 아님*.
- **인증 단서:** `auth.uid/auth.jwt/auth.role` 또는 request JWT 설정 접근 관련 직접 lexical 표현 1개, 표현 미감지 134개. 이 수치는 함수 간 호출·별도 정책·역할 검사·컨트롤 플로를 평가하지 않는다.
- **동적 SQL 단서:** PL/pgSQL 함수 중 `EXECUTE` 표현 감지 3개, 그중 `format()`도 감지 1개. EXECUTE lexical 감지 3개 모두 직접 인증 표현 미감지. `RAISE EXCEPTION` 표현 감지 94개. 우선순위 평가에만 사용; 함수별 명칭/내용이나 row data는 외부로 전달하지 않음.
- **경로:** 함수별 `search_path` 중 public 포함 69개, pg_temp 포함 68개(68개 전부 설정 경로 끝에 pg_temp 표시), pg_temp 미명시 67개. PostgreSQL의 임시 스키마 해석 및 위험성은 객체 유형·사용자 CREATE 권한·스키마 순서/정규식 오탐 여부·실제 함수 본문을 함께 평가해야 함.
- **소유:** postgres 소유 SECURITY DEFINER 126개, postgres 소유 함수 중 EXECUTE lexical 감지 3개. 기존 명시적 anon/authenticated EXECUTE 135개 및 관리형-parent FK 34개 미검증 분리 유지.
- **다음 게이트:** 우선 동적 SQL 단서 3개에 대해 owner-local·출력 차단된 개별 리뷰, 역할/인증 guard와 SQL 문자열·identifier quoting·SET search_path·함수 간 호출 그래프·권한 상속 평가. 전체 135개 함수의 실행 권한 필요성/최소권한, hosted parity, 178 migration provenance 및 보안 이슈 #1208도 별도 차단 요소.
- **판정:** `BODY_SIGNAL_LEXICAL_TRIAGE_COLLECTED`, `3_DYNAMIC_SQL_LEXICAL_REVIEW_PRIORITY`, `FUNCTION_AUTH_SEMANTICS_NOT_VERIFIED`, **RELEASE HOLD**, PR #1341 Draft·미병합, D8D v2 OFF. 운영 SQL/권한 조정/병합/배포 미승인.
