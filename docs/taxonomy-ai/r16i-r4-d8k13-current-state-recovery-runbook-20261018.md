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
