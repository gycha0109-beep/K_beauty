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

## 1. 신규 확인된 릴리스 순서 **차단** — P0

| 시점 | 파일/상태 |
| --- | --- |
| Hosted last applied | `20261012181544` |
| 미적용이며 현재 저장소에 있는 선행 SQL | `supabase/migrations/20261014150000_taxonomy_ai_r16i_d8d_v2_owner_gated_dual_offer.sql` |
| 후행 통합 SQL | `supabase/migrations/20261015185000_taxonomy_ai_r16i_d8k12_owner_review_revocation_v1.sql` |

확정된 모순:

- D8D v2 선행 SQL은 `admin_r16i_d8d_v2_applications`, `admin_r16i_d8d_v2_owner_authorizations`, `admin_r16i_d8d_v2_application_offers`를 **생성한다**.
- D8K-13 통합 SQL은 위 세 테이블 중 **하나라도 존재하면** `D8K13_UNEXPECTED_LEGACY_SCHEMA`로 중단한다.
- 공식 Supabase CLI 문서에서 `supabase db push`는 적용되지 않은 **모든 로컬 migration**을 실행하며, `--dry-run`은 적용 대상 목록만 미리 보여 준다. 따라서 현재 분기 전체를 대상으로 한 통상적인 순차 적용은 **D8D v2 선행 설치 후 D8K-13의 의도된 중단**으로 이어질 수 있다. 기존 운영 DB 손상이 확인된 것은 아니며 **호환 릴리스 경로가 아직 없다는 뜻**이다.

**안전하게 다음 중 하나의 릴리스 설계를 별도 리뷰/합성 PG17 테스트로 확정해야 한다.**

- **안 A — 정상 순서 호환**: D8D v2가 정확한 예상 스키마로 설치되어 있고 owner authorization/application/offer 등 관련 테이블에 이력이 **전혀 없음**을 검증하는 보호된 경로를 설계한다. D8D v2 SQL 원문 스키마·권한·사이드이펙트와 동시성 로직을 실제로 재현한 PG17 통합 테스트가 필요하며, 미확인 또는 데이터가 한 건이라도 있으면 계속 거부한다. 기존 `VERIFIED` 자가 승인 2건 및 릴리스 게이트 OFF 검증은 절대로 완화하지 않는다.
- **안 B — 명시적 승인된 별도 적용 순서**: 전수 미적용 migration 목록과 의존성을 확인하고, DBA/운영 승인 아래 통합 부트스트랩을 D8D v2보다 먼저 적용하는 합법적인 절차를 새로 설계한다. 적용 기록을 거짓으로 표시하지 않으며, 타임스탬프를 임의 수정하거나 `supabase migration repair`를 통과 수단으로 악용하지 않는다. 마이그레이션 이력과 이후 표준 적용 순서를 일관성 있게 보장해야 한다.

**현재 어느 안도 구현·운영 승인된 것이 아니다.** 정식 선택 전 `supabase db push`, `supabase migration repair`, 운영에서 SQL 복사 실행을 모두 금지한다.

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
- **새로운 P0:** 미적용 D8D v2 마이그레이션이 D8K-13보다 시간순으로 먼저 실행되고, D8K-13은 D8D v2 설치 사실만으로 거부한다.
- **미확인:** 적용 경로, 운영 백업/PITR 및 복원 시험, 독립 검토자, 공급망 보안 해결, 실제 운영 migration 계획. 운영 데이터는 전혀 변경하지 않았다.
- **출시/운영 판정: HOLD.** 마이그레이션 일괄 적용, 수동 DB 쓰기, 병합, 배포 모두 금지.
