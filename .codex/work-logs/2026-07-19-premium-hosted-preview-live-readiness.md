# Premium Hosted Preview Live Readiness Work Log

## 기준

- 저장소: `gycha0109-beep/K_beauty`
- 구현 Draft PR: #51
- 설계 Draft PR: #44
- 설계 HEAD: `1f483c19e235c54106d1d7604855e59a4ef96598`
- 범위: Hosted Preview 검증 하네스와 실행 준비물만
- 금지 범위: Production, Premium runtime/API/UI 의미, DB schema/migration/RLS, Auth 정책, Provider, Payment, Vercel/Supabase 설정 변경

## 목적

계약 검증을 통과한 하네스가 실제 현재 UI와 Preview 보호 환경에서 실행 가능한지 소스 수준으로 재검토하고, 사용자의 Google OAuth 개입 전까지 저장소 측 준비를 완료한다.

## 실행 가능성 재검토 결과

### Critical 2

1. 접근 가능한 파일 업로드 경로 부재
   - 현재 홈 화면의 실제 파일 input은 숨겨져 있고 accessible label이 없다.
   - 기존 fixture DSL의 `uploadByLabel`만으로는 실제 브라우저에서 사진을 올릴 수 없다.
   - 실제 접근 가능한 트리거는 버튼이다.
     - KO: `사진에서 선택`
     - EN: `Choose Photo`

2. 독립 `/premium` 진입 lane이 실제 세션 흐름과 불일치
   - Premium 입력 화면은 분석 및 무료 결과 이후 `/result/full-report` 흐름에서 나타난다.
   - 분석 세션 없이 `/premium`을 직접 열어 검증하는 방식은 실제 Premium entry를 증명하지 못하며 false failure 또는 잘못된 페이지 검증을 만들 수 있다.

### Important 1

3. Premium entry marker가 단일 언어 필드로 정의됨
   - 실제 heading은 locale별로 다르다.
     - KO: `현재 쓰는 제품을 알려주세요`
     - EN: `Add your current products`
   - 단일 `premiumEntryMarker`로는 KO/EN 양쪽의 정확한 accessible heading을 강제할 수 없다.

## 보완

- fixture DSL에 `uploadByRole` 추가
  - 허용 role은 `button`만
  - exact accessible name 필수
  - 상대 경로, realpath, fixture-root containment, 확장자, 크기 검증 유지
  - Playwright `filechooser` event를 통해 숨은 input에 파일 전달
- standalone `/premium` navigation lane 제거
- KO/EN normal journey가 실제 전체 흐름 중 locale별 Premium entry heading을 `expectHeading`으로 관측하도록 강제
- 두 locale journey 모두 Premium entry를 관측한 경우에만 code-owned `premium-entry` lane PASS 생성
- manifest 계약을 `premiumEntryMarkers.ko/en`으로 변경
- 두 marker 모두 heading이어야 하며 locale 문자열이 달라야 함
- legacy singular `premiumEntryMarker`는 fail-closed 거부
- source-derived marker를 example manifest에 반영
  - Google login: `Google로 로그인`
  - signed-in dashboard: `My Skin`
  - KO Premium entry: `현재 쓰는 제품을 알려주세요`
  - EN Premium entry: `Add your current products`
- example UI case를 `uploadByRole`과 Premium entry heading 관측 형태로 수정
- contract verifier에 다음 negative test 추가
  - `uploadByRole`의 button 외 role 거부
  - upload path traversal 거부
  - external/unsupported action/role 거부 회귀

## 리뷰 종료 상태

- Critical: `2 → 0`
- Important: `1 → 0`
- Medium: `0 → 0`
- 필수 assertion 및 evidence 완화 없음
- runtime/UI/API/DB/Auth 정책 변경 없음

## 남은 저장소 작업

- 최종 branch HEAD 고정
- 변경 `.mjs` syntax check
- example JSON parse
- hardening/기존 Hosted Preview/browser journey 계약 검증
- Premium route/reentry/integrated/decision 회귀
- architecture guard
- production build
- `git diff --check`
- 별도 임시 Draft PR에서 exact-head 검증

## 외부 실행 Gate

저장소 검증 완료 후에도 실제 live gate에는 다음 수동·외부 입력이 필요하다.

- 최종 exact HEAD의 immutable READY Preview
- Google Account A/B의 headed OAuth 및 2FA
- Preview Supabase public URL/anon key
- Account A/B user-ID hashes 및 Premium entitlement 분리
- exact catalog hash
- synthetic normal/fallback photos
- 실제 화면에 맞춘 7개 fixture action sequence
- 별도 non-Production Fault Preview와 authoritative deployment IDs
- cleanup 전 명시적 사용자 승인
