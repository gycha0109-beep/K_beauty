# D8K-13 — 전체 마이그레이션 이력 대조 및 운영 차단 보고서

> 2026-10-16 KST · **읽기 전용 감사 / 운영 적용 불가 / PR #1341 Draft·HOLD**
>
> 저장소 기준 코드: `f7455eb18bd4f93d78b29006e0d1231818f1dc8f`. 운영 Supabase의 `supabase_migrations.schema_migrations` 버전·이름 목록 178건과 해당 커밋의 `supabase/migrations` SQL 파일 153개를 비교했다. **운영 DB 조회는 SELECT/metadata만 사용했고 DDL/DML, migration repair, 백업 복구, 권한 변경, 머지·배포를 수행하지 않았다.**
>
> 계산 재현: `node scripts/product-evidence/verify-d8k13-migration-chain-readonly-v1.mjs --full`.
> 비교한 운영 메타데이터는 `scripts/product-evidence/baselines/d8k13-hosted-migrations-readonly-20261016.json`에 버전·이름만 저장했다. 이는 한 시점의 스냅샷으로, **실시간 운영 상태 또는 SQL 내용 동일성 증명이 아니다**.

## 1. 결론

**P0 — 현 브랜치의 마이그레이션 디렉터리를 대상으로 자동 `supabase db push` 또는 수동 전체 replay를 수행하면 안 된다.**

D8K-13의 `D8D v2 원문 → D8K-12/13` 부분 체인은 **격리된 합성 PostgreSQL 17에서 PASS**했지만, 그 앞에 실제 운영 DB에서 기록된 **178개 migration**과 현재 저장소에 존재하는 **153개 SQL**의 계보가 서로 다르다. 여기에는 같은 목적의 다른 타임스탬프, 저장소에서 사라진 운영 적용 SQL, 오래된 미기록 데이터 변경 SQL, 정상적으로 아직 미적용인 D8K-12/13이 섞여 있다.

| 항목 | 건수 | 해석 |
| --- | ---: | --- |
| 로컬 migration SQL | **153** | `f7455eb1` 기준 GitHub directory |
| 운영 적용 이력 | **178** | 읽기 전용 Supabase migration list |
| 버전·이름 모두 일치 | **103** | 내용의 byte/hash 동일까지 입증한 것은 아님 |
| **동일 버전, 다른 이름** | **1** | 버전만으로 적용 여부 판단 불가 |
| **동일 이름, 다른 버전** | **41** | 역사적 타임스탬프 치환 가능성, SQL 동일성 미확인 |
| 저장소에는 있고 운영 이력에 같은 이름 없음 | **8** | 5개 오래된 SQL + 3개 정상 미적용 후행 SQL |
| 운영 이력 이름에 대응하는 저장소 SQL 없음 | **34** | 운영 상태를 현재 파일 집합만으로 재생성 불가 |
| **동일 로컬 버전의 중복 파일 그룹** | **1** | 버전 `20260824`을 2개 SQL이 공유; 단일 migration ID로 취급 불가 |
| **14자리 버전 형식이 아닌 로컬 파일** | **7** | 모두 8자리 날짜 버전; CLI 규칙/과거 적용 절차 별도 확인 |
| 로컬 버전이 운영 적용 버전 목록에 없음 | **49** | 41개 치환 후보 + 8개 이름 미대응 |
| 위 49개 중 마지막 운영 버전 이하 | **45** | 표준 전체 replay 위험 범위 |
| 위 49개 중 마지막 운영 버전 이후 | **4** | 그중 1개는 운영에 이미 같은 이름으로 다른 버전 적용 |
| 현재 운영 마지막 적용 버전 | `20261012181544` | 이후 상태는 실시간 재확인 필요 |

운영 이력의 **이름·버전이 같은 것만으로도 원래 실행한 SQL bytes가 저장소 SQL과 같다고 말할 수 없다.** **추가 감사로 확인한 바, `supabase_migrations.schema_migrations.statements`에 실제 SQL 원문이 모두 존재한다.** 읽기 전용으로 원문 Git blob SHA를 계산해 41개 버전 변경 파일 중 **34개가 현 GitHub SQL과 일치**함을 입증했다. 남은 7개와 동일 이름·버전 46개의 추가 검증 및 적용 실행 증거·승인 기록은 여전히 필요하다.

### 추가 버전 충돌 (자동 migration 추적 불가)

- 두 로컬 파일 §20260824_add_product_localized_names.sql§와 §20260824_backfill_product_english_display_names.sql§이 동일한 8자리 버전 §20260824§를 공유한다. **두 파일의 SQL이 같다는 뜻이 아니며**, 실제로 하나는 컬럼 추가 계열, 다른 하나는 여러 Product 영어 표기의 데이터 UPDATE다.
- 로컬 SQL **7개**는 14자리 버전이 아닌 8자리 날짜 접두사로 작성되어 있다(2026-04-10/24/30, 05-07/26, 08-24 두 건). 현재 Supabase migration 관리에서 이 접두사를 어떻게 해석하는지는 승인된 도구 버전·실제 배포 이력 기준으로 검증해야 한다.
- 이 추가 충돌은 153/178 집계와 **별도의 유형**이며, 기존 49개 미기록 파일 개수에 다시 더하면 이중 집계가 된다.

## 2. 8개 이름 미대응 로컬 SQL

### 2-A. 기존 적용 범위보다 오래된 5개 — **자동 재실행 금지**

| 저장소 SQL | SQL의 주요 동작 | 2026-10-16 운영 SELECT 관측 | 판정 |
| --- | --- | --- | --- |
| `20260824_backfill_product_english_display_names.sql` | 다수 Product의 영어 표기 **UPDATE** | `products.name_en`, `brand_en` 존재 | 데이터 내용/백필 이력 불명; 재실행 금지 |
| `20260913202500_data_taxonomy2_candidate_manual_classification_v1.sql` | Taxonomy2 테이블 2개·함수 4개 생성, 시드 INSERT/UPDATE | 해당 테이블 2개와 함수 4개 존재 | 재생성·DML 충돌 가능; 재실행 금지 |
| `20261001103000_data_ai29c_uva_r3d_registry_coexistence_v1.sql` | UVA Registry 정책·함수/권한 및 데이터 정책 설정 | 관련 정책 테이블과 확인 대상 핵심 함수 존재 | 동일 실행/동일 함수 본문 불명; 재실행 금지 |
| `20261009003000_data_ai29c_filter_r4_c_r2_bushman_subject_auth_v1.sql` | Bushman 주체 인증 테이블·함수/감사 경로 | 해당 신규 테이블·함수 미존재 | **실제 미적용 후보**; 별도 출처·승인·의존성 확인 필요 |
| `20261009043000_data_ai29c_filter_r4_c_r3_bushman_replay_digest_guard_v1.sql` | 앞선 R2 RPC 이름 변경 후 replay 해시 검증 wrapper 적용 | 앞선 RPC 및 새 wrapper 미존재 | R2 미적용 시 순서 의존으로 실패; 자동 적용 금지 |

세 파일에서 테이블이나 함수가 발견됐다는 것은 **해당 파일을 동일한 내용으로 실행했다는 증거가 아니다.** 기존 운영에 누가/어떤 SHA로 설치했는지 조사해야 한다. 반대로 Bushman 관련 객체 부재는 **관련 SQL이 의도적으로 미배포였을 가능성**을 뒷받침할 뿐, 실행 승인으로 간주할 수 없다.

### 2-B. 운영 적용 기록보다 새로운 3개 — D8K-13 의존 체인

1. `20261014121000_taxonomy_ai_r16i_verdict_reason_nonempty_v1.sql` — 기존 판정 reason CHECK 강화; **운영 레거시 데이터 검사 필요**.
2. `20261014150000_taxonomy_ai_r16i_d8d_v2_owner_gated_dual_offer.sql` — v2 게이트 기본 OFF, OWNER authorization/apply/rollback 보호 테이블·RPC.
3. `20261015185000_taxonomy_ai_r16i_d8k12_owner_review_revocation_v1.sql` — D8K-12/13 통합 자기승인 격리/감사 부트스트랩.

위 3개 부분 체인은 합성 PG17에서 필요한 경로를 검증했지만, **운영의 모든 기존 스키마·migration 이력과 결합해 replay한 것은 아니다**. 별도 공급망 #1208, 독립 OWNER 부재, 복구·백업 미확인, 실제 증빙 무결성 문제가 남아 있다.

### 2-C. 마지막 버전보다 새롭지만 같은 이름으로 이미 적용된 1개

- 로컬: `20261012190000_trust_p2c_visible_identity_dispositions_v1.sql`
- 운영 적용: `20261012181544 / trust_p2c_visible_identity_dispositions_v1`

이 파일 역시 시간상 후행이라는 이유만으로 신규 SQL로 취급하면 안 된다. **41개 이름 동일·버전 상이 집합에 포함**된다.

## 3. 34개 운영 전용 이름과 41개 타임스탬프 상이 이름

- 저장소에 대응 이름이 없는 운영 적용 migration은 **34개**. 특히 2026-09-13 `data_taxonomy2_candidate_resolution_*` 관련 일련의 적용 이력, `v21_admission_g3a_emergency_revoke_exposed_runtime_password`, 2026-09-27 `trust_phase8h3_*` 등이 해당된다.
- **41개**는 이름만 같고 버전이 다르다. 일부는 단순 timestamp 편차처럼 보이지만 **내용이 동일하다는 증빙은 아직 없다**.
- **버전 같고 이름 다른 1개**: `20260622180503`. 로컬 `repair_review_queue_distinct_observed_dates`에 대응하지만 운영의 recorded name은 `20260622093000_repair_review_queue_distinct_observed_dates`로 저장되어 있다. 이것도 자동 보정 금지.
- SQL 파일 삭제/이름 변경, 이미 진행된 배포 및 수동 DB 변경의 역사적 근거가 일치하지 않는다. 현재 브랜치를 **운영 schema 재구축의 유일한 authoritative migration history**라고 취급할 수 없다.

## 4. 배포 차단 및 다음 복원 가능한 검증 경로

### 단계 A — metadata 감사 (이번에 수행함)
- read-only 운영 migration VERSION/NAME 조회와 GitHub pinned commit의 migration directory 대조.
- 로컬 분석기 `verify-d8k13-migration-chain-readonly-v1.mjs`는 네트워크·운영 키·DB 연결·파일 변경이 없다.
- 일반 실행은 `status=HOLD`와 상세 차이를 보고하며, `--enforce-release` 옵션은 무조건 **종료코드 3**으로 실제 배포 파이프라인을 차단한다.

### 단계 B — 과거 승인 배포 artifacts 복원 (미수행)
- 41개 이름 매칭 버전 차이에 대해 **배포 당시 Git commit / migration 원문 SHA256 / 원격 승인 이벤트 / 적용 작업 증거**를 재구성한다. 단지 이름이나 현재 함수를 보고 "같음" 체크 금지.
- 운영-only 34개의 SQL 원문은 **운영 migration history `statements`에 모두 존재**함을 확인했다. credential·민감 내용 검수 없이 공개 저장소로 추출하지 말고, 운영자의 통제된 비공개 복원 절차와 원본 배포 실행 증거를 별도 확보한다.
- 5개 오래된 로컬-only migration의 **의도적 미배포 vs 다른 버전 수동 반영**을 구분하고, 데이터 UPDATE/INSERT의 반복 실행 영향을 평가한다. 개별 운영 승인 전에는 임의 적용 금지.

### 단계 C — 최종 체인 재현 (미수행)
- 승인된 이전 schema snapshot 또는 운영 데이터가 제거된 synthetic reconstruction에서 178개 applied schema 선행 상태와 SQL 변화량을 재구성한다.
- **로컬 파일의 historical filename rename이나 삭제는 승인된 버전 매핑 계획 아래에서만** 수행한다. `supabase migration repair`를 불일치 은폐 수단으로 쓰지 않는다.
- 전체 pending 적용 경로에 대해 PostgreSQL 17 + 실 DB schema 형태의 fixture, 권한, RLS, 기존 VERIFIED 2건, v2 gate OFF, 동시성, 보존·롤백, 적용 전후 migration history를 검사한다.
- 운영 `supabase db push --dry-run`은 CLI 버전/공식 옵션을 다시 확인하고 **별도 읽기 전용 세션에서만** 검토한다. dry-run 자체를 적용 승인으로 해석하지 않는다.

### 단계 D — 운영 변경 별도 승인 (현재 불가)
- Backup/PITR의 실제 존재·복원 리허설, Storage 캡처 bytes 관리, PRIVATE 증빙·판정 ID manifest(실제 값은 PR에 기록하지 않음), 독립 OWNER, 보안 #1208 해결, 모든 안전 검증이 선행해야 한다.
- **운영 DB DML/DDL, migration, repair, admin role 변경, 병합, 배포, 가격/CTA 활성화 — 모두 HOLD.**

## 5. 증거 등급

- **확인됨:** 운영 migration 178개, 저장소 SQL 153개, 버전·이름 조합 차이 및 read-only 주요 객체 존재 여부. 이미 검증한 D8K-13 부분 PG17 PASS는 **커밋 f7455eb1의 합성 fixture**에 대해서만 성립한다.
- **추가로 확인됨:** 운영 적용 이력 178건 모두 SQL 원문 보존; 같은 이름·다른 버전 41건 중 34건의 byte-equivalence, 과거 Git SHA 복원 1건. 자세한 현황: [운영 SQL 원문 지문 감사](./r16i-r4-d8k13-hosted-sql-provenance-hash-audit-20261016.md).
- **미확인:** 다른 7건의 완전 동일성(일부는 실제 적용 범위가 다름), 동일 버전·이름 103건 중 46건, 전체 historical replay, 복원·백업, 독립 검토자 및 가격·Offer·CTA.
- **결론:** 전체 pending migration 체인 **배포 준비 불가(P0/HOLD)**. 다음 진행은 먼저 migration 역사적 출처·동일성 조사의 기록화이지, 운영 DB 적용이 아니다.


## 6. 읽기 전용 진단기 실행 검증

- 저장소의 **실제 153개 파일명**과 위 **178건 migration baseline**을 입력으로 하여 분석기 본문을 격리된 JavaScript 런타임에서 실행했다.
- 결과: 103 / 1 / 41 / 8 / 34 / 49 / 45 / 4, 버전 중복 1그룹, 8자리 파일 7개를 **모두 보고**했다.
- 일반 실행: `D8K13_FULL_MIGRATION_CHAIN_READONLY_HOLD` 마커 출력, 종료코드 0(조회 자체 성공).
- `--enforce-release` 실행: `D8K13_FULL_CHAIN_RELEASE_REFUSED` 출력, **종료코드 3**, DB 접속/파일 쓰기 없음.
- **참고:** 이 검증은 실제 코드/메타데이터 비교 로직을 실행한 것이며, 과거 SQL 본문의 byte-equivalence 검증이나 PostgreSQL 전체 migration 실행이 아니다. 운영 변경 승인으로 승격해서는 안 된다.

## 7. 본문 기반 출처 검증 완료분 (2026-10-16, 후속 조사)

초기 `VERSION/NAME` 감사 이후 실제 Supabase migration `statements` 배열을 확인했다. 178건 모두 본문이 있으며(1문장 150건, 복수문장 28건), DB 내부에서 `pgcrypto SHA-1` Git blob 지문을 계산한 뒤 GitHub blob과 비교했다. **원문 SQL이나 credential은 공개 저장소로 복사하지 않았다.**

- **같은 이름·다른 버전 41건:** 29건 Git blob 완전 일치, 5건 마지막 LF 하나만 달랐음. 나머지 7건 현재 파일과 다름.
- **7건 중 한 건**은 과거 Git 커밋 `9c562c54101f`의 파일이 운영 기록과 정확히 일치. `face_lab_v2_persistence_revision`은 앞에 LF 하나만 더 있음. `data_taxonomy3_product_exact_equivalence_v1`은 트랜잭션 BEGIN/COMMIT 래퍼 차이.
- `data_taxonomy8_nullable_legacy_category_projection_v1`은 **운영에서 실행된 DDL 단 64 bytes**, 반면 현재 GitHub 파일은 더 넓은 마이그레이션. `data_ai29c_c5b_subject_presentation_identity_correction_v1`도 원문과 파일 분량/내용이 다르므로 수동 재검토 P0.
- **운영-only 34건:** 원문 복원 가능한 history row 모두 확인. 특히 `20260622093000_repair_review_queue_distinct_observed_dates`는 과거 rename commit `2095c14aff46`과 blob SHA로 복원 가능.
- **기존에 둘 다 일치하던 이름·버전 103건:** 57건 해시 일치, 46건 미입증(복수 statements 28, 1개 statements 18). 단일 내용의 일치가 확인되지 않았다고 모두 다른 SQL이라고 단정하지 않는다.
- JSON 감사 매니페스트 및 오프라인 검증기: `scripts/product-evidence/baselines/d8k13-hosted-migration-provenance-readonly-20261016.json`, `node scripts/product-evidence/verify-d8k13-hosted-provenance-v1.mjs --full`.

**기존 결론 `운영 릴리스 HOLD`는 변경 없다.** 본문이 보존된 사실은 **사용할 수 있는 안전한 복구 이력**을 제공하지만, 외부 승인/재실행·migration repair·운영 배포의 근거가 아니다.

## 8. 최초 적용 이력보다 이전의 스키마 의존성 경계 (2026-10-17 후속)

운영에서 **최초** applied version `20260410`(이전 ledger row 0건)을 읽기 전용으로 확인했다. 본문은 `product_candidates`를 ALTER하고 `source_rankings` 참조 뷰를 만들지만 두 테이블의 직접 CREATE가 없다. 현재 저장된 178건의 SQL에서 직접 CREATE 및 ACL GRANT/REVOKE 좁은 구문 패턴은 양쪽 모두 0건이며, 명칭 언급은 각각 product_candidates 40건, source_rankings 6건이다. **최초 DDL이 없었다고 주장하지 않는다**: 이전 bootstrap/별도 provisioning/동적 SQL/과거 artifact는 현 이력 외부일 수 있다. 현재 RLS+ACL이 차단 상태라는 사실도 초기 생성 때의 권한을 인증하지 않는다.

관련 P0 읽기 전용 스냅샷: `scripts/product-evidence/baselines/d8k13-p0-acl-taxonomy-provenance-followup-20261017.json`. 178건의 안전한 clean replay/rollback 및 실백업 복원은 그대로 **NOT ATTESTED / RELEASE HOLD**.

## 9. 최초 스키마 원본 수색 및 재현 차단 조건 고정 (2026-10-17)

**별도 SELECT-only 운영 검사를 완료했다.** PostgreSQL17의 현재 `product_candidates`는 36개 컬럼, 8개 제약조건, 외래키 2개, RLS ON / policy 0; `source_rankings`는 14개 컬럼, 3개 제약조건, 외래키 2개, RLS ON / policy 0이다. 두 객체 모두 현재 `postgres` 소유 일반 테이블이며 Extension-owned가 아니다. 두 테이블의 anon/authenticated 직접 SELECT·INSERT는 차단, service_role INSERT는 허용. **현재 스키마 프로필은 과거 초기 schema/ACL의 사본이 아니다.**

별도 Git 이력 조사에서는 K_beauty 초기 커밋 `934762c805e910a946bb23b09f2c4634e47468f0`(2026-04-08, 41개 파일)의 트리에 SQL 파일이 없었고, 초기 2026-04-10 커밋 `4e221df671483802274a64b1484b19e683c8f521`(61개 엔트리)의 SQL은 `20260410_safe_review_and_promotion_layer.sql` 하나였다. 운영 최초 migration이 바로 그 파일에서 `product_candidates`를 ALTER하고 `source_rankings`를 뷰에서 JOIN하므로 **현재 확인한 초기 Git 트리와 운영 migration ledger 중 어느 쪽에서도 두 테이블 최초 CREATE·GRANT 출처는 발견되지 않았다.** 다른 비공개 bootstrap, 수동 프로비저닝, 삭제된 Git 경로 또는 역사적 배포 artifact가 없다고 주장하지 않는다.

새 차단 계약:
- `scripts/product-evidence/baselines/d8k13-preledger-reconstruction-readiness-20261017.json`: 원본 기초 schema·ACL 증거, 전체 178건 SQL·순서, isolated PG17 replay, Crawler parser, PITR 복원, 독립 보안 및 공급망 승인 등 **11개 필수 게이트 모두 아직 false**. 증거가 없는 상태를 임의로 true로 만들면 오프라인 검사에서 즉시 중단하도록 설계했다.
- `scripts/product-evidence/sql/d8k13-preledger-schema-profile-readonly-v1.sql`: 운영에서 **SELECT-only 실행 PASS**. 현재 객체의 집계 메타데이터만 출력하고 사용자·상품·SQL 원문·비밀값은 출력하지 않는다.
- `scripts/product-evidence/verify-d8k13-preledger-reconstruction-v1.mjs`: 원본 Git blob, 스냅샷, 11개 HOLD 게이트를 fail-closed 검사. 단독 `--enforce-release` 및 연동된 `verify-d8k13-migration-chain-readonly-v1.mjs --enforce-release`는 릴리스 거절 코드 3을 유지하도록 작성.

**검증 등급:** GitHub blob pin/경계 소스/스냅샷 및 차단 코드의 정적 확인 PASS, 운영 SELECT 실행 PASS. **새 Node 검증기 실제 프로세스 실행과 실제 전체 PostgreSQL17 복원은 별도 미검증**. 이 사실을 synthetic schema 원본의 발견이나 실제 backup/PITR 검증이라고 기록하지 않는다.

**다음 실제 순서:** 별도 통제된 초기 스키마/백업/배포 artifact 확보 → 최초 두 테이블 생성·owner/ACL 출처 증빙 → 전체 178 applied SQL의 비공개 원본·순서 검증 → 격리 PG17 replay와 실제 복원 리허설 → OWNER·Security Advisor·#1208 및 운영 승인. 어떤 단계도 migration repair, hosted DDL, 릴리스 또는 PR merge 권한을 부여하지 않는다.

## 10. 2026-10-18 실제 Node 22 + 격리 PostgreSQL17 시작점 실패·롤백 실증

**자동 실검증 완료:** [GitHub Actions run #39059702566](https://github.com/gycha0109-beep/K_beauty/actions/runs/39059702566) — 테스트 시점 HEAD `4b0a50d4dea04514757e512f1e54cd2fb7ed0125`, 전용 workflow `.github/workflows/taxonomy-ai-d8k13-preledger-isolated.yml`은 **feature-branch push에만 반응**, production secret 없이 `postgres:17.6` 일회성 서비스 컨테이너와 별도 로그인·DB를 생성한다.

| 실제 테스트 | 증거 | 판정 |
| --- | --- | --- |
| Node 22 오프라인 preledger/HOLD baseline | Job `117474947581`의 `D8K13_PRELEDGER_RECONSTRUCTION_CONTRACT_PASS_HOLD` | PASS |
| Node 22 Taxonomy8 writer/ACL pin | 동일 Job `D8K13_P0_ACL_TAXONOMY_CONTRACT_PASS_HOLD` | PASS |
| 현재 migration 체인 분석기 및 독립 사전 단계 `--enforce-release` | 두 실행의 **exit=3** 검증, `D8K13_PRELEDGER_NATIVE_NODE_RELEASE_HOLD_PASS` | PASS (릴리스 거절 정상) |
| Disposable PostgreSQL17 **빈 DB**에서 진짜 `20260410_safe_review_and_promotion_layer.sql` 실행 | Job `117474947437`의 `D8K13_PRELEDGER_ISOLATED_PG17_EXPECTED_FAILURE_PASS` | **의도된 실패**: 선행 `public.products` 부재 |
| 실패 후 DB 상태 | 동일 Job에서 `products`, `product_candidates`, `source_rankings`, `product_review_status`가 모두 존재하지 않음 확인 | **트랜잭션 롤백 PASS** |

첫 migration은 PostgreSQL17에서 `relation "public.products" does not exist`를 반환했다. 이것은 **초기 스키마 없이 178건 적용 이력을 그대로 실행할 수 없음을 입증한 실패 경로 테스트**다. **전체 178건 정상 완료, 진짜 처음 bootstrap, 과거 ACL, 실제 복원/PITR에 대한 성공 증거는 없다.** 원래 D8K-13 synthetic ACL/SEC-05 부분 PASS와 구분한다.

초기 Git `934762c805e910a946bb23b09f2c4634e47468f0`의 `crawler/README.md`(historical blob `6d9e42b801a5e4d6fe183742f4feab21eb52b030`)에서 `source_rankings`, `product_candidates`, `crawl_jobs`를 저장 대상이라고 명시하나 초기 CREATE/GRANT SQL은 없다. 이것은 테이블 사용 의도/코드 참조를 증명할 뿐 최초 SQL 배포 로그는 아니다.

영속 증거: `scripts/product-evidence/baselines/d8k13-preledger-native-node-pg17-negative-acceptance-20261018.json`; 코드 `scripts/product-evidence/run-d8k13-preledger-negative-pg17.mjs`; 오프라인 baseline 검증기에 workflow/job 결과·rollback 진술을 **source-pin 및 release HOLD와 함께** 검사하도록 연결했다. 검증기는 과거 실제 GitHub Action 결과가 적힌 manifest를 검사하므로, 새 시점의 PG17 재실행 자체와 동일하지 않다. 새 commit의 CI 결과는 각 GitHub workflow run에서 별도 확인한다.

**다음 필수 선행:** DB 최초 스키마 SQL 또는 신뢰 가능한 최초 backup dump, 해당 시점의 role/ACL 및 PostgreSQL/Supabase dependency, 178건 applied 원문 SQL과 버전·순서 정합성, 별도 비공개 복원 환경, 실제 restore drill. 이 증거들이 없는 동안 **HOLD**, 어떤 임의 DDL bootstrap이나 `migration repair`도 실제 역사를 재구성했다고 주장하지 않는다.

## 11. 2026-10-18 실제 PG17 초기 기초계약 양방향 검증 — 합성 범위 한정

먼저 **원본 없음**을 다시 확인했다. `supabase/local-shadow-test/supabase/migrations/00000000000000_local_shadow_bootstrap.sql`은 스스로 `test-only`/synthetic을 명시하며, `products.id`를 `text` PK로 정의한다. 반면 실제 첫 적용 migration `20260410`은 `product_candidates.matched_product_id`를 `uuid`로 만들고 `products(id)`를 참조한다. 따라서 이 로컬 shadow fixture를 최초 운영 스키마로 사칭하거나 직접 재활용하는 것은 안전하지 않다.

이 한계를 분리하기 위해 `tests/fixtures/r16i-d8k13/36_preledger_synthetic_base_pg17.sql`을 작성했다. **새로 만든 합성 세 테이블** `products`, `product_candidates`, `source_rankings`와 각 1개의 테스트용 행만 구성하며, 과거 실제 초기 DDL/ACL·정상 migration history로 취급할 근거가 없다.

[GitHub Actions #39062707665](https://github.com/gycha0109-beep/K_beauty/actions/runs/39062707665)의 PostgreSQL17.6 격리 job `117483803947`은 다음 두 실험을 **서로 다른 새 임시 DB**에서 실행하여 SUCCESS 기록을 남겼다.

1. **음성 대조:** 빈 DB에 원래 `20260410_safe_review_and_promotion_layer.sql`을 적용 → `public.products` 부재로 예상 실패, transaction rollback PASS.
2. **합성 양성 대조:** 위 최소 synthetic schema+행을 먼저 생성하고 **변경하지 않은 최초 SQL**을 실행 → `D8K13_PRELEDGER_SYNTHETIC_FIRST_MIGRATION_PG17_PASS`. 실제 SQL 처리 이후 Product category/texture/finish enum 변환, skin_types array 변환, normalized name/brand, candidate `new` 상태, `product_candidate_evidence_summary` 뷰에서 1개 evidence 및 best rank=1, `product_candidates_matched_product_id_fkey`를 검사해 PASS.

이로써 **첫 SQL의 문법 자체가 무조건 실패하는 것은 아니고, 기초 스키마가 전혀 없으면 적용할 수 없다는 구분**을 실제 PG17에서 검증했다. 이것은 오직 합성 첫 migration의 호환성 실증이다. **178건 전체 migration replay, 실 운영 초기 DB schema/ACL 동일성, 최초 bootstrap 출처, PITR 실제 restore는 여전히 모두 미인증**이다.

영속 증거: `scripts/product-evidence/baselines/d8k13-preledger-synthetic-positive-pg17-20261018.json`(실제 CI run/job, commit 및 소스 Git SHA 고정). 진단기 `verify-d8k13-preledger-reconstruction-v1.mjs`는 합성 원본 3개 blob을 검사하고 `releaseAuthorized=false`, `full178AppliedMigrationChainReplayed=false`를 강제한다. release gate `--enforce-release` **exit 3**, DB writes 0, PR #1341 Draft / **HOLD**.
