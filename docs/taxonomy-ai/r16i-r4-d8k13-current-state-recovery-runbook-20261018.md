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
