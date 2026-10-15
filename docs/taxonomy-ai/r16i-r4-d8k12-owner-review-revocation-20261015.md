# D8K-12 — R16I 관리자 자가 승인 차단·승인 철회 이력 보수

> 2026-10-15 KST · **개발 코드 작성 완료 / 운영 DB 미적용 / 병합·배포 보류**
>
> 사용자는 D8K-11 현황 보고 이후 **'기존 관리자 승인 기능의 자가 승인 차단과 검토 철회 구조 보수'를 명시 승인**했다. 따라서 관리자 승인 함수, 관리자 화면, DB migration **소스 코드**만 수정한다. 승인 대상에는 **운영 데이터베이스에서의 실제 migration 실행, 고객 가격 공개, Product/Offer 수정, 권한 상승, 배포 또는 PR 병합은 포함되지 않는다.**

## 1. 왜 고치는가

기존 동작:
- 관리자 권한을 가진 본인이 올린 캡처를 본인이 `VERIFIED`로 기록할 수 있었다. 원본 제출자의 `submitted_by`와 실제 로그인한 관리자의 `userId`를 서버에서 대조하지 않았다.
- 기존 증빙별 판정 테이블은 `evidence_id UNIQUE`여서 최초 `VERIFIED` 이후 새로운 철회/반려 이력을 추가하지 못했다.
- R16I D8C 판정·D8D 적용은 `admin_product_correction_evidence_verdicts_v1.verdict='VERIFIED'`라는 **기존 단일 상태**를 읽는다. 철회 기록만 따로 저장하고 이 상태를 갱신하지 않으면 옛 승인으로 상품 수정을 계속 진행할 위험이 있다.

새 동작:
- 사용자의 로그인 권한을 확인한 서버에서 **관리자 사용자 ID**를 DB 함수로 전달한다. DB가 활성 OWNER 권한과 원본 `submitted_by` ≠ 검토자 ID를 **같은 트랜잭션 안에서 재검증**한다.
- 첫 판정은 기존 테이블에 기록하면서 별도의 **변경 불가 이력 테이블**에도 같은 내용을 남긴다.
- 승인 철회는 `REVOKED` 사건을 새 이력으로 추가하고 기존 판정의 현재 상태를 `REJECTED`로 변경한다. **기존 D8C/D8D SQL이 과거 `VERIFIED`를 다시 사용하지 못하게 즉시 차단**한다.
- 이미 반려·철회된 *같은 원본*을 다시 승인하거나 두 번 철회할 수 없다. 필요한 경우 새로운 증빙을 다시 제출해 별도로 검토해야 한다.
- 같은 요청 ID가 다시 온 경우 동일한 최신 요청만 중복 처리 없이 응답하고, 기존 승인이 철회된 뒤 옛 승인 요청을 재전송해 되살리는 것은 거부한다.
- 검토 과정이 상품에 적용되는 작업과 경합하지 않도록 해당 Product 행을 먼저 잠그고, 원본 증빙과 판정 행을 이후 잠근다. 기존 D8D 실제 적용 함수도 Product를 먼저 잠그므로 판정이 바뀌는 중간의 승인 상태를 이용하기 어렵다.
- 감사 이력은 UPDATE/DELETE 금지 트리거와 별도 권한으로 보호. 원본 상태 테이블은 **현재 유효 여부를 표시하는 호환 영역**으로 유지한다.
- 화면에서는 OWNER에게 **승인 철회** 버튼과 **승인·반려·철회 이유 및 시각 이력**을 표시한다. 철회된 증빙은 새 상품 수정안의 유효한 근거로 나타나지 않는다.
- 이 기능은 이미지 자체의 진위, 실제 판매처/옵션 가격, 캡처 원본 보관 상태까지 자동으로 검증한다는 의미는 **아니다**. 별도 D8K-11 원본 확인과 신뢰성 검토가 여전히 필요하다.

## 2. 변경 파일과 경계

| 위치 | 변경 |
| --- | --- |
| `supabase/migrations/20261015185000_taxonomy_ai_r16i_d8k12_owner_review_revocation_v1.sql` | 이력 테이블·잠금/자가 승인 거부·안전한 철회 함수. 기존 판매 가격 승인 쿼리가 읽는 현재 verdict는 VERIFIED→REJECTED 전환. 공개 사용자/일반 로그인 권한 없음 |
| `lib/product-intelligence/r16i-correction-approval-ledger.mjs` | 이전의 직접 삽입 대신 단일 보호 DB 함수 호출. 현재 판정과 전체 감사 이력 대조; 불일치하면 관리자 화면 응답 차단 |
| `app/admin/products/r16i-correction-review/R16IR4D8CorrectionApproval.js` | 철회 사유 입력, 이력 보기, 철회된 증빙 구별 |
| `scripts/product-evidence/verify-d8k12-owner-review-revocation-v1.mjs` | 권한/철회/이전 승인 재사용 방지와 기존 D8D 코드 결속 검사 |
| `tests/fixtures/r16i-d8k12/{00_minimal_pg17,10_runtime_pg17}.sql` | **가상 정보만** 넣은 격리 PG17 실동작·권한 검사 |
| `scripts/product-evidence/run-d8k12-local-pg17.mjs` | Docker Desktop의 임시 로컬 PostgreSQL17에서만 실검사; 인터넷·포트 노출·볼륨 마운트/운영 DB 사용 없음 |
| 기존 D8C/D8K11 검증, D8F 연계 | 새 경계를 반영하여 이전 검사들도 유지 |

API 요청의 필드 이름과 action `review_evidence`는 그대로다. 신규 `verdict='REVOKED'`가 가능하며 관리자 GET 응답에 `reviewHistory`가 추가된다. 이는 관리자 전용 기능이며 가격·추천·사용자 저장 결과·고객 페이지에 새로운 데이터를 노출하지 않는다.

## 3. 도입 전 가장 중요한 중단 조건

**기존 판정 이력이 1건이라도 있으면 이 migration은 자동으로 실패한다.**

DB 변경안의 `D8K12_EXISTING_VERDICTS_REQUIRE_EXPLICIT_RECONCILIATION` 차단은 과거의 `VERIFIED`가 독립 검토된 것인지 확인되지 않은 상태에서 새 이력으로 정상화하지 않기 위해 의도됐다. 과거 데이터가 있다면 정확한 판정/제출자/철회 필요 여부를 개별 조사하고 **별도 변경안과 승인**을 받아야 한다.

운영 DB의 2026-10-15 D8K-10 SELECT에는 캡처 두 건 모두 `UNVERIFIED`라고 기록됐지만, **별도 판정 원장의 전체 행 수를 입증한 것은 아니다.** `UNVERIFIED` 캡처 행만 보고 기존 판정이 0건이라고 추측하면 안 된다.

**실제로 운영에 적용하기 전 반드시 확인할 것**:
1. 기존 증빙 판정 테이블 전체 건수·기존 철회/결정/상품 적용 상태와 복구 계획
2. 승인 기능과 DB 변경을 같은 배포 단위에서 활성화할 수 있는지. 새 DB 함수 없이 새 서버를 올리면 승인 작업이 실패하도록(안전하게 차단) 되어 있음
3. 현재 운영 원본의 진위, 가격/배송/SKU, 별도 관리자 검토자 확인
4. 실제 데이터가 이미 상품에 적용된 상태라면 **증빙 철회와 상품 복구는 별개**. 철회가 과거 상품 변경을 자동 되돌리지 않는다
5. 공급망 보안 이슈 #1208 해결. 사용자 별도 승인 전 병합·운영 반영/배포 금지

## 4. 검사

가상 자료를 사용하는 계약 검사:
```powershell
node scripts/product-evidence/verify-barrier-support-p1-r16i-r4-d8c-correction-approval-v1.mjs
node scripts/product-evidence/verify-d8k11-existing-archive-review-preflight-v1.mjs
node scripts/product-evidence/verify-d8k12-owner-review-revocation-v1.mjs
```

실제 PostgreSQL 17 동작 검사(**운영 DB 접근 없음, 로컬 Docker만 사용**):
```powershell
node scripts/product-evidence/run-d8k12-local-pg17.mjs --check-files
node scripts/product-evidence/run-d8k12-local-pg17.mjs
```

두 단계의 성공 마커: `D8K12_PG17_SQL_ACCEPTANCE_PASS`, `D8K12_LEGACY_VERDICT_MIGRATION_REFUSED_AND_ROLLED_BACK_PASS`, `D8K12_LOCAL_DOCKER_PG17_PASS`. 별도 데이터베이스에 미검토 과거 판정을 미리 넣은 뒤 변경이 **실패하면서 원본 데이터가 보존되는지**도 검사한다.

검사의 증빙 수준을 구분한다:
- 순수 코드/가상 데이터 검사: **소스 수준만 통과**. 실제 DB 트랜잭션의 보안 성능 인증 아님
- Docker PG17 테스트: 실제 DB 명령 실행이며 운영 데이터가 아닌 **합성 자료**만 사용
- 운영 원본/독립 리뷰: 아직 별도 승인·원본 열람 및 사용자 역할 신원 확인이 필요

## 5. 출시 금지 상태 유지

공식몰 80ml와 화해 80ml×2+증정 구성을 서로 다른 상품 옵션으로 취급한다. R16I Product의 용량 표기(160ml), 부모 Offer 부재, 저장된 두 원본의 `UNVERIFIED` 상태, D8K5/6 선택옵션 운영 테이블 미설치 및 가격/링크 구매 버튼 하드 OFF는 이번 작업에서 건드리지 않았다.

**완료한 것은 승인·철회 기능의 안전한 코드 변경안이다. 아직 운영에서 실제 승인·철회를 수행한 것이 아니다.**
