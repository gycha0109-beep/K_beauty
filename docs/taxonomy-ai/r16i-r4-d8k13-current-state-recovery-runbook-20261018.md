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

