# Admin Product Candidate Reviews — Implementation Report

## 상태

구현·리뷰·2026-07-31 로컬 독립 재검수 완료.

## 브랜치

- `feature/admin-product-candidate-reviews`
- stacked base: `feature/admin-access-foundation`
- validated application / DB logic SHA: `9cfb4fcab51e1c554ab3766c71182c3e18e96ffc`
- validation run: `Security closeout verifiers #174` (`30527263743`)

해당 기록 이후에는 workflow와 보고서 정리가 있었고, 2026-07-31 로컬 재검수에서
아래 UI·API·migration hardening이 working tree에 추가됐다.

위 SHA와 workflow 기록은 과거 구현 기록이다. 현재 판정 근거는 GitHub Actions가
아니라 `feature/admin-product-candidate-reviews` working tree에서 수행한 로컬
정적 검토, 격리 migration replay, SQL role/RLS/RPC 시나리오, architecture guard,
JavaScript syntax 검사와 production build다.

## 구현

- 제품 후보 검수 목록·상세 workbench
- `queued / reviewing / approved / deferred / rejected` 필터
- 후보 식별·랭킹 evidence·기존 제품·승격 payload 표시
- `approve / defer / block` 결정
- service-role-only dry-run preflight
- optimistic concurrency confirm
- 기존 `promote_product_candidate` 재사용
- confirm idempotency ledger
- 관리자 audit 연동
- 읽기 권한과 조치 권한 분리
- 동일 출처 요청 검증과 no-store 응답 경계
- 격리 PostgreSQL fixture·SQL assertion·전용 CI

## 리뷰에서 수정

1. 누락 JSON field가 SQL `NULL` 비교로 검증을 통과할 수 있는 문제를 차단했다.
2. 외부 제품 identity가 없는 후보의 approve를 차단했다.
3. 동일 request id 동시 confirm을 advisory lock으로 직렬화했다.
4. 초기 unsafe 함수의 service-role 직접 실행 권한을 회수하고 hardened wrapper만 공개했다.
5. 브라우저에는 service-role key와 raw Supabase error를 노출하지 않는다.
6. preflight·confirm API에 기존 SEC-11 same-origin 정책을 적용했다.
7. 불안정한 Auth HTTP fixture를 제거하고 Postgres 트랜잭션 기반 검증으로 교체했다.

## 2026-07-31 로컬 독립 재검수 hardening

1. 감사 payload의 중첩 key/value에서 token, cookie, secret, authorization,
   service-role key, password, raw/base64 image를 차단하는 후속 migration을
   추가했다.
2. `matched_product_id`와 `duplicate_of_product_id`가 canonical normalized
   identity와 충돌하면 approve preflight를 fail-closed 하도록 보강했다.
3. Origin뿐 아니라 제공된 Referer도 same-origin인지 확인하고, API body object,
   UUID, hash, timestamp, request id 검증을 DB 호출 전에 수행한다.
4. UI confirm 재시도는 동일 request id를 유지하며 요청 중 중복 클릭과 입력 변경을
   막는다.
5. 상세 화면에 source URL, external type, raw/normalized/canonical identity,
   최초·최근·누적 관측, 필드별 근거·confidence 상태를 표시한다.
6. 원시 후보의 approve 차단 사유를 dry-run 전에도 명확히 보여주고 defer/block은
   계속 가능함을 구분한다.
7. 격리 SQL verifier에 privacy 권한, NULL 필수값, identity conflict, request id
   conflict, candidate/review/evidence stale, 민감 감사 payload, 감사 실패 전체
   rollback 시나리오를 추가했다.

## 검증 결과

다음 항목이 모두 통과했다.

- 정적 권한·호출 계약
- isolated migration replay
- owner/operator/viewer/Premium override 권한 행렬
- browser role의 preflight / confirm RPC 직접 실행 차단
- dry-run products write 0
- 누락 product form approve 차단
- 잘못된 preflight hash 차단
- 신규 제품 insert
- 기존 제품 merge와 중복 생성 방지
- defer / block products write 0
- stale preflight 차단
- idempotent retry 동일 결과
- 관리자 audit 4건과 owner-only 조회
- direct table escalation 차단
- Security closeout verifier suite
- SEC-11 origin normalization
- JavaScript syntax gate
- architecture guard
- production build
- diff check

## 현재 데이터 상태

2026-07-30 읽기 전용 점검 기준 검토 가능 큐는 30건이다.

- 30건 모두 external identity는 존재한다.
- 30건 모두 canonical brand / name, service category, 승격 payload가 아직 채워지지 않은 원시 후보다.
- 따라서 목록·상세 조회와 defer / block은 가능하다.
- approve는 enrichment / 외부 검수 결과가 채워질 때까지 dry-run에서 전부 차단되는 것이 정상이다.

관리자 UI가 기존 enrichment·review import 단계를 대체하지 않는다.

## 비대상·미적용

- hosted Supabase migration 적용
- 실제 관리자 계정 부여
- Preview / Production 활성화
- bulk review
- CSV / JSONL 외부 검수 import
- crawler review queue 정책 변경

Production 데이터와 설정은 변경하지 않았다.
