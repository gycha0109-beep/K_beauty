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
