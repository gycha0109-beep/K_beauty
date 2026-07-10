# revisit.md

> Role: tool/workflow-specific reference
> Default read: no
> Canonical authority: no; actual app code, auth/config, schema, and verifier evidence take precedence.
> Read when: revisit, `/my`, saved-report, or related recovery work needs historical product/workflow context.
> Canonical references: `AI_ROUTER.md`, `AI_EXECUTION_RULES.md`, `SECURITY_BOUNDARIES.md`

## Merge 원칙

main 브랜치는 최신 UI source of truth로 유지한다.

revisit 기능은 최신 UI 위에 자연스럽게 얹는다.

merge conflict 시:

- 디자인/레이아웃은 main 우선
- revisit 기능 로직은 feature 우선

---

## Revisit 핵심 구조

비주얼리 핵심 revisit 루프:

무료 진단
→ 결과 저장
→ /my
→ 오늘 피부 체크
→ 오늘 루틴 생성
→ 재방문

---

## /my 원칙

/my는 설정 페이지가 아니다.

“개인 피부 운영 홈” 역할로 유지한다.

우선순위:

오늘 피부 체크
→ 오늘 루틴
→ 최근 피부 프로필
→ 최근 저장 리포트

---

## UX 원칙

비로그인 상태에서도 결과 확인은 항상 가능해야 한다.

로그인 강제형 UX로 회귀시키지 않는다.

저장 CTA와 공유 CTA를 시각적으로 분리한다.

광고형 쇼핑몰 느낌보다
“개인 피부 관리 공간” 톤을 유지한다.

과도한 카드 중첩과 dashboard clutter를 피한다.

---

## Save Flow 원칙

pendingSaveReport는 OAuth redirect 이후에도 유지되어야 한다.

저장 흐름:

결과 확인
→ 저장
→ /my 연결

---

## Auth 원칙

Supabase SSR auth만 사용한다.

service role key는 client bundle에 절대 노출하지 않는다.

---

## DB 원칙

skin_profiles:
저장된 피부 상태 snapshot

saved_reports:
저장된 결과 리포트

daily_checkins:
일일 피부 상태 입력

routine_logs:
생성된 데일리 루틴

유저당 active skin_profile은 하나만 유지한다.

---

## 현재 유지해야 하는 핵심 기능

- Google OAuth
- SSR auth
- 결과 저장
- /my dashboard
- daily check-in
- today routine generation
- share page
- full-report

---

## 향후 확장 방향

- streak
- 최근 피부 변화
- weekly insight
- 내 제품 관리
- 사용중 제품
- 교체 후보

비주얼리는 단발 진단기가 아니라
“개인 피부 운영 시스템” 방향으로 확장한다.
