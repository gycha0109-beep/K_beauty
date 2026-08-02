# 2026-07-30 Admin Access Foundation

## 작업 유형

- 설계 → 리뷰 → 구현 → 재리뷰 → 격리 검증
- 보호 영역: Auth, DB migration, RLS, administrator authorization
- 기준 브랜치: `main`
- 작업 브랜치: `feature/admin-access-foundation`
- Draft PR: `#94`

## 목표

비주얼리 어드민의 후속 기능이 재사용할 관리자 멤버십, capability, 감사 로그, `/admin` 접근 경계를 추가한다.

## 구현

- `admin_memberships`와 4개 역할
- 9개 capability의 DB·애플리케이션 동기화 계약
- service-role 전용 최초 owner bootstrap
- service-role 전용 감사 이벤트 기록 함수
- 관리자 본인 멤버십 조회 RLS
- owner 전용 감사 로그 조회 RLS
- `/admin` middleware 로그인 pre-check
- `/admin` 서버 레이아웃의 활성 멤버십·capability 재검증
- 실제 지표를 만들지 않는 최소 관리자 홈
- 정적 계약 verifier
- 격리 Supabase role-matrix verifier
- 전용 GitHub Actions workflow

## 리뷰 수정

1. authenticated 관리자가 audit RPC를 직접 호출해 가짜 로그를 만들 수 있던 초안을 폐기했다.
   - audit RPC를 service-role 전용으로 변경
   - actor 활성 멤버십과 required capability를 DB에서 재검증
   - service-role의 audit table 직접 쓰기도 차단

2. 동시에 first-owner bootstrap이 실행될 수 있던 경쟁 조건을 차단했다.
   - transaction advisory lock 추가

3. 감사 로그 payload 폭증과 이미지성 데이터 혼입 위험을 줄였다.
   - before/after 각각 64 KiB
   - metadata 8 KiB
   - table constraint와 함수 preflight 양쪽에 적용

## 검증

Admin Access Foundation workflow run `30521573806`: success

- static admin contract verifier: success
- isolated Supabase start/reset: success
- migration replay: success
- owner/viewer/Premium override role matrix: success
- second owner bootstrap rejection: success
- direct role escalation rejection: success
- authenticated audit RPC rejection: success
- missing-capability audit rejection: success
- idempotent audit retry: success
- owner-only audit read: success
- service-role direct audit-table write rejection: success
- architecture guard: success
- production build: success
- git diff --check: success
- isolated Supabase cleanup: success

Security closeout verifiers run `30521573827`: success

## 비실행

- hosted Supabase migration 적용
- 실제 사용자 `admin_owner` bootstrap
- Preview/Production 배포
- 제품 후보 검수 기능

위 항목은 이번 기반 PR의 비대상이며 Production 상태를 변경하지 않았다.

## 다음 작업

`Product Candidate Reviews` vertical slice:

```text
검토 목록
→ 후보·기존 제품 비교
→ evidence 확인
→ approve / defer / block preflight
→ dry-run
→ confirm
→ audit log
```
