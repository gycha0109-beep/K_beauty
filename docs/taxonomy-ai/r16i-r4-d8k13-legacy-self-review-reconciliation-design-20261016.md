# D8K-13 — R16I 기존 자기 승인 2건의 안전한 reconciliation 설계 v1

> 2026-10-16 KST | **설계 + 코드 전용 구현 / 운영 DB 미적용 / Native PG17 재검증 대기 / Draft PR / 병합·배포 보류**
>
> 기준: D8K-12 `2be34cf95d93424d206702bde5068deb6f033de9` (로컬 Node 80 assertions 및 Docker PG17 PASS).
> 이번 승인은 **설계와 읽기 전용 확인**만 포함한다. 기존 증빙·판정의 UPDATE/DELETE, 역할 변경, 승인 철회 실행, 마이그레이션 실행, PR 머지, 배포, 상품/Offer 수정, 고객 가격·구매 CTA 공개는 **허용되지 않았다**.

## 0. 상태와 근거 등급

- **운영 DB 읽기 전용 관측 (2026-10-16 KST):** `admin_product_correction_evidence_v1` 원본 2건, `admin_product_correction_evidence_verdicts_v1` 판정 2건. `official_single` 1건과 `hwahae_bundle` 1건 모두 원본은 `UNVERIFIED`, 현재 판정은 `VERIFIED`, `submitted_by=reviewer_id`.
- **출시/적용 상태:** D8C 정정 제안 0, 결정 0, D8D v1 적용 0/이벤트 0, D8D v2 적용 테이블 미설치, 출시 게이트 `R16I_S_NATURE_PRODUCT_1=false`. 활성 `admin_owner` 1명.
- **D8K-12 운영 적용:** 감사 이벤트 테이블 `admin_product_correction_evidence_review_events_v2` 없음, `review_r16i_evidence_v2` 없음. D8K-12를 현 운영 DB에 그대로 적용하면 `D8K12_EXISTING_VERDICTS_REQUIRE_EXPLICIT_RECONCILIATION`으로 **의도된 실패**.
- **원본 바이트의 진위·독립 판매처 확인은 미검증:** 메타데이터 존재는 증빙 품질을 입증하지 않는다. 실제 사용자 계정 UUID, 사유 텍스트, 요청 UUID, screenshot 경로/해시는 공개 저장소에 기록하지 않는다.
- 재현 가능한 읽기 전용 진단: `scripts/product-evidence/sql/d8k13-legacy-self-review-readonly-preflight-v1.sql`. `shape_matches_observed_snapshot`은 **관찰과 일치한다는 뜻일 뿐 출시나 DB 변경 권한이 아니다**.

## 1. 반드시 지켜야 할 안전 불변식

1. **과거 사실 불변:** 두 레거시 판정의 원래 `verdict=VERIFIED`, `reason`, `reviewer_id`, `request_id`, `reviewed_at`, `verdict_id`, `evidence_id`, 제출자와 증빙 출처를 독립된 변경 불가 이력에 정확하게 보존한다. '당시에 VERIFIED 기록이 있었다'와 '독립 검토로 신뢰 가능하다'는 서로 다르다.
2. **현재 승인 불능:** D8C/D8D 기존 SQL은 현재 판정 테이블의 `v.verdict='VERIFIED'`만 확인하므로 **현재 v1 행도 원자적으로 `REJECTED`로 바뀌어야 한다**. 별도 격리 테이블·UI 표시만 추가하는 것은 불충분하다.
3. **영구적 구분:** 신규 D8K-12 사람이 검토한 `REJECTED`/`REVOKED`와 레거시 보안 격리 `LEGACY_QUARANTINED`를 감사 이력과 UI에서 구분한다. 레거시 원본을 정상적인 새로운 `VERIFIED` 승인 이벤트로 승격하지 않는다.
4. **원자성:** 보존 스냅샷 작성, 격리 이력 기록, v1 유효 상태 `VERIFIED→REJECTED`, D8K-12 권한 제한·RPC 설치를 하나의 통제된 트랜잭션/릴리스 단위로 구성한다. 일부만 성공한 상태는 금지.
5. **정확한 대상:** 예상 범위의 두 판정 외에 1건이라도 추가·누락·수정·비자기승인·다른 상품·중복 원본이 있으면 자동 중단. 이미 작성된 제안·결정·적용, 게이트 활성화, D8D v2 적용 기록이 있거나 스키마가 달라져도 중단.
6. **실사용 출시와 분리:** Product/Offer/Subject/ranking/원본 Storage 파일에 쓰지 않는다. 원본 판정을 격리해도 판매 옵션·가격·SKU 검증이 끝난 것은 아니며 출시 게이트는 계속 OFF.
7. **실패 시 보존:** 사전조건·권한·유일성·감사 무결성 문제에서 반드시 전체 ROLLBACK. 적용 후 과거 `VERIFIED`를 되살리는 단순 역마이그레이션은 금지.
8. **별도 승인:** 실제 운영 reconciliation 및 새 독립 관리자 권한 부여는 각기 별도 승인을 받아야 한다. 코드 변경 허가는 운영 데이터 조작 허가가 아니다.

## 2. 기각한 방식과 선택한 방식

| 방식 | 판단 | 이유 |
| --- | --- | --- |
| 기존 판정 `DELETE` 후 D8K-12 재실행 | **금지** | 감사 체인 훼손·소급 은폐, 역추적 곤란 |
| 레거시 `VERIFIED` 그대로 두고 별도 quarantine 표기 | **금지** | D8C/D8D v1/v2 기존 현재 상태 조건을 우회 |
| 두 판정을 무조건 `REVOKED` 이벤트로 전환 | **금지** | 정상적인 독립 승인 후 철회와 자기 승인 보안 격리를 혼동 |
| 레거시를 새 `VERIFIED` 이벤트로 백필 | **금지** | 존재하지 않았던 독립 심사를 생성한 것처럼 보이게 함 |
| 레거시 행만 `REJECTED`로 먼저 UPDATE | **금지** | D8K-12의 '판정 1건 이상' 차단은 그대로이며 이전 원본 판정과 상태 전환의 관계를 잃음 |
| **불변 스냅샷 + 명시적 레거시 격리 이벤트 + 현재 판정 REJECTED + 통합 부트스트랩** | **채택(설계)** | 원본·효력·원인 분리, 단일 트랜잭션, 기존 SQL 호환 |

## 3. DB 데이터 계약 (구현 후보, 아직 마이그레이션 파일 아님)

### 3.1 원본 레거시 감사 스냅샷

비공개 데이터용 신규 테이블 가칭 `admin_product_correction_legacy_verdict_quarantine_v1`:

- `legacy_verdict_id` (기존 verdict UUID, UNIQUE), `evidence_id` (UNIQUE), `product_id`, `source_key`.
- `original_verdict='VERIFIED'`, `original_reason`, `original_reviewer_id`, `original_request_id`, `original_reviewed_at`, `original_submitted_by` 및 기존 행의 신뢰 가능한 불변 스냅샷.
- `classification='SELF_REVIEWED_LEGACY_UNTRUSTED'`, `disposition='QUARANTINED_NOT_APPROVED'`, `quarantine_reason`, `release_ticket`, `quarantined_at`, 승인된 실행 주체 식별자(실제 코드 도입 시 명확히 규정).
- `UPDATE/DELETE` 거부 트리거, `RLS ENABLED`, `anon/authenticated/PUBLIC` 전 권한 없음, `service_role` 읽기 전용; 기존 감사 자료는 고객 API·검색·가격 결과에 노출하지 않음.
- 원본 데이터 복사 후 UPDATE가 완료되기 전에 행별 원본과 사본의 `IS DISTINCT FROM` 무결성 확인. 원본을 삭제하거나 기존 `reviewer_id/reason/request_id/reviewed_at`를 덮어쓰지 않는다.

### 3.2 별도 상태 이력

D8K-12 감사 이벤트 계약을 다음과 같이 **호환 확장**하는 방안을 구현 대상으로 삼는다.

- 허용 상태에 `LEGACY_QUARANTINED`를 추가하되 **보호된 부트스트랩만 기록 가능**. `review_r16i_evidence_v2` 사용자 판정 입력에는 추가하지 않는다.
- 레거시 이벤트에 `origin='D8K13_LEGACY_RECONCILIATION'` 및 `legacy_snapshot_id`를 연결해 통상의 `VERIFIED/REJECTED/REVOKED` 관리자 판정 이력과 분리한다.
- 레거시 이벤트의 `recorded_at`은 **격리한 시각**, 기존 원승인 시각은 `original_reviewed_at`에 보존. 감사 이벤트의 reviewer 필드는 정책상 '격리 실행자'와 '원승인자'를 혼동하지 않도록 명시적인 별도 메타데이터로 모델링한다.
- 감사 이벤트를 읽는 서버는 `LEGACY_QUARANTINED`를 **현재 유효 판정 `REJECTED`**로 투영하되 사용자에게 `레거시 자기 승인 — 격리됨`으로 출력한다. `REJECTED`를 신규 독립 검토자가 내린 반려라고 거짓 표시하지 않는다.
- 기존 D8K-12 `REVOKED`의 의미·리플레이·최신 이력 일치 검사, 유효 독립 `VERIFIED` 요건은 유지한다. 레거시 원본 ID 재승인/철회/리플레이는 모두 거절한다.

### 3.3 실제 유효 상태와 중복 승인 방지

- 현재 `admin_product_correction_evidence_verdicts_v1` **같은 행**의 `verdict`만 `VERIFIED→REJECTED`로 수정. 행의 PK·evidence 연결 및 기존 reviewer·사유·요청 ID·시각은 유지한다.
- D8C 제안 생성 `createR16IProposal`, D8C owner 결정 `decide_r16i_product_correction_v1`, D8D v1 `r16i_d8d_apply_v1`, D8D v2 `r16i_d8d_apply_v2`가 읽는 `VERIFIED` 판정이 두 레거시 건에서 **0개**가 되어야 한다.
- DB 트랜잭션에서 Product 행을 먼저 잠근 뒤 evidence/verdict를 잠그며, 잠금 중 검토/적용 레이스를 차단한다. D8D 적용 함수와 잠금 순서를 통합 검수한다.
- 신규 독립 심사는 **신규 증빙 ID**를 통해서만 가능하며, 이전 검토 상태를 초기화하거나 원본 캡처를 근거 없이 재활용하는 작업은 허용하지 않는다.

## 4. 배포 가능한 변경안 작성 시 원자적 부트스트랩 순서

**이 절은 구현 순서 설계이며 실행 가능한 운영 SQL이 아니다.** 구현 승인 전에는 실제 DB 쓰기용 마이그레이션을 만들지 않는다.

1. 운영 관리자 승인 API 쓰기 차단 및 D8D 릴리스 게이트 OFF 확인; 승인된 배포 티켓·백업/복원 지점·변경 대상 DB 식별을 확인.
2. `BEGIN` 내 Product → 관련 evidence → legacy verdict 순으로 행 잠금. 가능하면 관련 승인 게이트도 잠그고, 모든 조건을 락 획득 후 재확인.
3. 해당 상품의 정확한 2건, 소스별 1건, 둘 다 `UNVERIFIED/VERIFIED`이고 원승인자=제출자, 기존 전체 verdict 수 2, proposal/decision/application/event 수 0, D8D v2 미설치 또는 무기록, 게이트 OFF, 외부 스키마 변동 없음 등을 **정확히 검사**. 일치하지 않으면 명확한 오류 코드로 ROLLBACK.
4. 승인된 D8K-12 수정 버전의 이벤트/보안 함수·레거시 보존 스키마를 구성하고, **기존 두 행의 모든 원본 판정 필드**를 불변 감사 스냅샷에 복사·검증.
5. 일반 검토 이벤트와 분리된 `LEGACY_QUARANTINED` 2건 기록. v1 같은 행의 `verdict`를 `REJECTED`로 전환. 두 이력과 두 상태의 FK/개수/현재-최신 이벤트 일관성을 검사.
6. 기존 판정 테이블의 `service_role` 직접 쓰기 권한을 `REVOKE ALL` 후 `GRANT SELECT`로 제한하고, 좁은 `SECURITY DEFINER` 보호 RPC에만 EXECUTE 허용. 브라우저 `anon/authenticated`에는 함수/이력 접근 권한 없음.
7. COMMIT 직전: 원본 증빙 2건, 보존 스냅샷 2건, 신규 격리 이벤트 2건, 현재 `VERIFIED=0/REJECTED=2`, Product/Offer/Subject 변경 0, release gate OFF를 재검증. 하나라도 다르면 ROLLBACK.
8. 커밋 후에도 고객 가격/구매 CTA OFF. 관리자 읽기 결과가 격리 상태를 정확히 보여 주는지와 기존 D8C/D8D가 레거시 두 건을 사용하지 못하는지 검증.

**중요 — D8K-12 마이그레이션 호환성:** 이미 작성된 D8K-12 마이그레이션의 `IF EXISTS (legacy verdict) THEN RAISE`는 유지된 채 **별도의 D8K-13 선행 UPDATE만 실행해서는 절대 통과하지 못한다.** 기존 표에 행이 남기 때문이다. 정식 구현 단계에서 **아직 운영에 미적용인 D8K-12 마이그레이션을 엄격한 허용 대상·감사·격리 부트스트랩을 포함하도록 조정**하고, 해당 하나의 변경과 D8K-13 보수 코드를 같은 테스트/릴리스 대상으로 묶어야 한다. 미검증 레거시 데이터를 허용하는 일반적 우회 플래그를 추가하거나, 조용히 보호 preflight를 삭제하는 방식은 금지한다.

## 5. 단일 OWNER 문제 — 별도 트랙

- 운영에서 `admin_owner`가 1명이고 두 캡처도 그 계정이 제출했다. D8K-12 `submitted_by <> reviewer_id` 규칙을 유지하면 같은 증빙을 독립 승인할 수 없다. **권한 규칙을 낮춰 해결하지 않는다**.
- 경로 A(권장 검토): 독립된 실제 검토자를 적격자로 지정하고 두 번째 OWNER로 승인·등록(권한 확대의 영향 평가와 별도 승인 필요).
- 경로 B(후속 설계): OWNER 전체 권한 대신 좁은 증빙 검토 capability를 가진 역할을 설계하고 서버/DB 양쪽 권한검증·RLS·감사 규칙을 갱신(범위가 넓으므로 D8K-13 디자인 승인만으로 구현 금지).
- 어느 쪽이든 직접 출처 원본을 열람하고 판매처·상품 옵션·가격·배송·SKU를 독립적으로 검증해야 하며, **기존 두 캡처를 재승인하지 않고 새 검증 가능 증빙을 제출**해야 한다.
- 검토자가 없으면 상태는 `QUARANTINED/REVIEW_BLOCKED`로 유지한다. 임시 소유자 ID 위조·셀프리뷰 예외·자동 정상화 없음.

## 6. 필수 테스트(실제 구현 단계의 승인 조건)

| 시나리오 | 기대 결과 |
| --- | --- |
| 현재 관측한 합성 fixture: 자기 승인 레거시 2건 | 원본 스냅샷 2, 격리 이벤트 2, 현재 `REJECTED` 2, 유효 `VERIFIED` 0 |
| verdict 0/1/3건, 두 소스 중복/누락, 다른 상품 행 존재 | 전체 트랜잭션 거부·롤백 |
| 두 건 중 하나가 독립 검토였거나 `UNVERIFIED`가 아님 | 자동 격리 거부·수동 조사 필요 |
| 제안·결정·적용/롤백 기록 1건 이상, 출시 게이트 ON | 자동 격리 거부 |
| D8D v2가 설치/사용되었거나 새 스키마가 생김 | 미리 지정한 검증 밖이므로 중단·재설계 |
| 불변 감사 스냅샷 누락·중복·유실/권한 이상 | 트랜잭션 롤백, 기존 DB 원상 유지 |
| `service_role`의 직접 `INSERT/UPDATE/DELETE/TRUNCATE` | 실제 PG17에서 권한 거부 |
| `anon/authenticated`의 이벤트 읽기·RPC 호출 | 권한 거부 |
| 기존 `review_r16i_evidence_v2`에 `LEGACY_QUARANTINED` 전달 | 입력 거부 |
| 같은 레거시 ID 재승인·철회·리플레이 | 모두 거부 |
| D8C 제안·D8D v1/v2 레거시 캡처 활용 | DB 수준에서 거부, 가격·카탈로그 쓰기 0 |
| 중간 SQL 실패·동시 승인/적용 경쟁 | 트랜잭션 롤백·부분 격리 없음 |
| 관리자 GET/UI | `LEGACY_QUARANTINED` 별도 표시, 기존 원승인 기록 보존 |
| 정상 신규 증빙과 독립 OWNER 2명 합성 시나리오 | 기존 D8K-12 심사/철회 기능 회귀 없이 동작 |
| 운영 데이터 미연결 로컬 Docker PG17·Node 테스트 | 실제 SQL·권한 계약 PASS 마커 확인 전 승인 불가 |

로컬 fixture에 사용자 식별자·실제 캡처 bytes·운영 credential을 포함하지 않는다. 테스트 전용 PostgreSQL만 사용하고 운영 검증은 별도 읽기 전용 preflight + 승인된 배포 절차로 분리한다.

## 7. 출시/롤백 규칙 및 승인 요청 경계

- **이번 D8K-13 완료 정의:** 본 설계서 + 읽기 전용 점검 SQL이 저장소의 독립 Draft PR에 기록되고 실제 운영 SELECT 관측과 일치하는 것. **데이터 격리 실행이나 런타임 안전성 시험을 완료했다고 주장하지 않는다.**
- 후속 실행 준비에는 코드/SQL 구현, 직접 권한 검수, 실제 Docker PG17 긍정·부정 시나리오, D8C/D8D 회귀, 차단 상태 유지 확인, 운영 백업과 릴리스·사고 대응 계획, 독립 보안 검토가 필요.
- **릴리스 차단:** 공급망 보안 #1208, 저장된 캡처 원본 미검증, 동일 OWNER만 존재하는 상태, Product 160ml vs 대상 80ml·부모 Offer 부재, 구매 CTA OFF. D8K-13 격리만으로 해결하지 않는다.
- 트랜잭션 실패 시 원복은 자동이어야 한다. 커밋 후 안전성 문제 발견 시 **다시 `VERIFIED`로 되돌리지 않는다**. 적법한 새 보완 이벤트/긴급 격리 조치와 복원 지점 사용은 별도 운영 승인 및 사고 절차가 필요.
- 사용자 별도 승인 전에는 D8K-12/D8K-13 병합·마이그레이션·배포·권한 조작을 모두 보류한다.

## 8. 연결 문서

- 상위 PR: #1338 (D8K-12), 해당 브랜치의 `docs/taxonomy-ai/r16i-r4-d8k12-owner-review-revocation-20261015.md`.
- 차단 보안 이슈: #1208.
- DB 기본 동작: D8C `20261012172837_taxonomy_ai_r16i_correction_approval_ledger_v1.sql`, D8D v1 `20261012181320_taxonomy_ai_r16i_d8d_transactional_apply_v1.sql`, D8D v2 `20261014150000_taxonomy_ai_r16i_d8d_v2_owner_gated_dual_offer.sql`.
- 유효 상태/관리자 API: `lib/product-intelligence/r16i-correction-approval-ledger.mjs`, `app/api/admin/products/r16i-correction-review/approval/route.js`.

**결론: 두 레거시 판정은 ‘과거에 VERIFIED로 저장되었다’는 기록만 남기고, 실제 승인 효력은 영구히 제외한다. 독립 검토·상품 변경·고객 노출은 전혀 자동 허용하지 않는다.**


## 9. D8K-13 후속 코드 구현 (2026-10-16, 코드만 변경)

> 이 절은 앞선 **설계-only 초기 승인 범위**에서 실제 작성된 **미배포 구현 코드의 상태**를 구분한다. 운영 쓰기 또는 릴리스 승인이 아니다.

### 통합 부트스트랩 구현
- `supabase/migrations/20261015185000_taxonomy_ai_r16i_d8k12_owner_review_revocation_v1.sql`의 **아직 운영에 미적용인 코드**에, 기존 판정이 없는 경우 D8K-12 원래 경로를 유지하면서 두 건의 레거시 판정에 한해 D8K-13 호환 경로를 추가했다.
- 기존 판정이 있는 경우 **릴리스 티켓**(`app.d8k13_release_ticket`)과 **사전에 확정한 정확한 `source_key:evidence_id:verdict_id` 매니페스트**(`app.d8k13_expected_manifest`)가 필요하다. 매니페스트는 사전 읽기 전용 관측과 배포 승인에서 독립적으로 도출한다. 운영 UUID는 저장소나 로그에 하드코딩하지 않는다. 이 두 설정값 자체가 배포 권한을 부여하는 것은 아니다.
- Product 행 선행 락, evidence/verdict 및 관련 제안·결정·적용·게이트 테이블 쓰기 충돌 락, 출처·자가 판정·수량·적용·활성 OWNER·게이트·스키마 사전 검증을 구현. 예상과 다르면 `D8K12_EXISTING_VERDICTS_REQUIRE_EXPLICIT_RECONCILIATION`, `D8K13_UNEXPECTED_LEGACY_SCHEMA` 또는 `D8K13_UNEXPECTED_LEGACY_SHAPE`로 중단한다.
- `admin_product_correction_legacy_verdict_quarantine_v1`에 원승인 판정/사유/검토자/요청 UUID/시각/제출자를 보존하고 새 audit 이벤트를 `LEGACY_QUARANTINED` 및 `D8K13_LEGACY_RECONCILIATION`으로 생성한 후 **기존 v1 판정의 `verdict`만 `REJECTED`로 변경**. 같은 SQL 트랜잭션의 실패는 전부 롤백한다.
- D8K-12 신규 정상 `VERIFIED/REJECTED/REVOKED` 이벤트에는 `origin=D8K12_HUMAN_REVIEW` 기본값을 유지하고, 레거시 이벤트가 사용자 RPC로 입력되는 것을 금지한다.
- 기존 권한 제한 유지: `service_role`은 레거시 판정/스냅샷/이벤트에 대해 직접 쓰기 금지. 일반 `anon/authenticated` 역할은 이벤트·스냅샷 읽기 및 판정 RPC 호출 금지. 불변 audit 테이블에는 UPDATE/DELETE 차단 트리거.

### 관리자 호출 경계
- `lib/product-intelligence/r16i-correction-approval-ledger.mjs`는 레거시의 **최신 이벤트 + snapshot FK + origin**을 확인하고 유효 판정은 `REJECTED`로 투영한다. history/API는 `LEGACY_QUARANTINED`를 보존한다.
- `app/admin/products/r16i-correction-review/R16IR4D8CorrectionApproval.js`는 **과거 자기 승인 — 격리**로 표시하며 해당 캡처의 재승인 버튼이나 정정안 선택을 제공하지 않는다.

### 코드 전용 수용 테스트
- `node scripts/product-evidence/verify-d8k13-legacy-quarantine-v1.mjs` — 신규 격리 이력, 위조 provenance, 현재 상태 모순, 정정안 재사용 거부 계약
- `node scripts/product-evidence/verify-d8k12-owner-review-revocation-v1.mjs` — 기존 D8K-12 회귀
- `node scripts/product-evidence/run-d8k13-local-pg17.mjs --check-files` — SQL 사전 검사
- `node scripts/product-evidence/run-d8k13-local-pg17.mjs` — **운영 DB/네트워크/마운트 없는 Docker PG17**에서 기존 D8K-12, 정확한 두 건 격리·원본 보존·권한·새 독립 리뷰, 티켓 누락 및 여러 변형 사례의 전체 롤백을 검사
- 합격 마커: `D8K13_PG17_LEGACY_TWO_ROW_QUARANTINE_PASS`, `D8K13_PG17_DRIFT_REFUSAL_AND_ROLLBACK_PASS`, `D8K13_LOCAL_DOCKER_PG17_PASS`.

**테스트 증빙 등급:** 이 기록 시점에는 GitHub 소스의 정적 대조까지만 진행했으며, 신규 코드의 실제 Node·PostgreSQL 17 실행 결과는 **아직 확인되지 않았다**. 검증 전에는 코드 안정성 PASS로 표시하지 않는다. PR #1338의 과거 PASS는 **D8K-13 변경 HEAD에 승계되지 않는다**.

**운영 상태:** 실제 기존 판정은 여전히 VERIFIED 2건이며, D8K-12 이벤트와 D8K-13 격리 스냅샷은 운영에 설치되지 않았다. 별도 운영 변경 승인·보안 #1208 해결·출시 게이트 검수 전에는 병합·배포·DB 변경 불가.
