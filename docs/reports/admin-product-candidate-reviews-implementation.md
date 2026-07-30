# Admin Product Candidate Reviews — Implementation Report

## 상태

구현 완료, 격리 검증 대기.

## 브랜치

- `feature/admin-product-candidate-reviews`
- stacked base: `feature/admin-access-foundation`

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
- 격리 Supabase fixture·runtime verifier·전용 CI

## 구현 리뷰에서 수정

1. 누락 JSON field가 SQL `NULL` 비교로 검증을 통과할 수 있는 문제를 차단했다.
2. 외부 제품 identity가 없는 후보의 approve를 차단했다.
3. 동일 request id 동시 confirm을 advisory lock으로 직렬화했다.
4. 초기 unsafe 함수의 service-role 직접 실행 권한을 회수하고 hardened wrapper만 공개했다.
5. 브라우저에는 service-role key와 raw Supabase error를 노출하지 않는다.

## 비대상

- hosted Supabase 적용
- Production 배포
- bulk review
- CSV / JSONL review export/import
- crawler review queue 정책 변경
