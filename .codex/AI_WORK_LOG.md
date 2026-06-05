# AI_WORK_LOG.md

## 목적

이 문서는 AI 에이전트 작업 이력을 단순 보관하지 않고, 성공한 작업 패턴과 에러·실패·회귀에서 얻은 교훈을 함께 수집해 재사용 가능한 운영 규칙과 상위 문서 승격 후보를 추출하기 위한 로그다.

작업 유형의 판단 기준은 `.codex/AI_ROUTER.md`를 따른다.

---

## 기록 대상

Medium 이상 작업 또는 문제가 발생한 작업만 기록한다.

기록 대상:
- 라우팅 판단
- 변경 범위
- 보호 구역
- 검증 결과
- 문제/주의점
- 재사용할 규칙
- 규칙 승격 후보
- Context 반영 후보

---

## 작업 로그 형식

### YYYY-MM-DD / 작업명

- 브랜치:
- 작업 유형:
- 라우팅 판단:
- 목표:
- 변경 파일:
- 보호 구역:
- 검증 결과:
- 문제/주의점:
- 다음 작업:
- 재사용할 규칙:
- 규칙 승격 후보:

### 2026-05-22 / result 저장 CTA 위치 조정

- 브랜치: feature/revisit-core-db
- 작업 유형: 실행형
- 라우팅 판단: 수정 대상과 목표가 명확하고, 저장 CTA 표시 위치 중심의 제한된 UI 작업이므로 실행형으로 처리
- 목표: /result 저장 CTA를 무료 결과 마지막 step 아래 1회만 노출하고, 공유 액션은 최하단 compact group으로 유지
- 변경 파일: app/result/page.js, components/result/ResultOverviewStep.jsx, components/result/SaveReportCTA.jsx
- 보호 구역: 저장 API 로직, 저장 데이터 구조, 공유 액션 로직, 기존 워킹트리의 무관한 변경 파일
- 검증 결과: npm run build 성공, git diff --check 성공, /test-result 390px overflow 없음, 마지막 step에서 저장 CTA 1회 노출 확인, 저장 후 ✓ 저장됨 및 My skin 링크 확인
- 문제/주의점: 기존 워킹트리에 이전 변경 파일이 남아 있어 해당 파일은 되돌리지 않음
- 다음 작업: 필요 시 최종 모바일 스크린샷 기준으로 spacing만 추가 조정
- 재사용할 규칙: CTA 위치 조정 작업은 저장/API 로직과 분리하고, 표시 조건과 레이아웃만 수정한다.
- 규칙 승격 후보: UI 작업에서 기존 워킹트리 변경 파일이 있으면 되돌리지 않고 작업 범위 밖으로 명시한다.
- Context 반영 후보: `NULL`

### 2026-05-22 / result 저장 후 floating nudge

- 브랜치: feature/revisit-core-db
- 작업 유형: 실행형
- 라우팅 판단: 저장 완료 이후의 안내 UI 표시 조건 조정이며, 저장/API 로직 변경 없이 상태 기반 UI만 수정하므로 실행형으로 처리
- 목표: 저장 완료 후 마지막 step이 아닌 화면에서만 My skin 이동 floating nudge를 제공
- 변경 파일: app/result/page.js, components/result/SaveReportCTA.jsx
- 보호 구역: 저장 API 로직, 저장 성공 판정 로직, 결과 데이터 구조, 라우팅 목적지
- 검증 결과: npm run build 성공, git diff --check 성공, /test-result 390px overflow 없음, 저장 전 floating 없음 확인, 저장 후 마지막 step [이전]/[저장된 결과 보러가기] 확인, 이전 step floating nudge 확인, floating 클릭 시 /my 이동 확인
- 문제/주의점: 저장 성공 alert는 기존 저장 완료 상태 전환 직후 노출되며 저장/API 로직은 변경하지 않음
- 다음 작업: 실제 모바일 화면에서 floating 위치가 하단 OS UI와 겹치면 bottom spacing만 추가 조정
- 재사용할 규칙: 상태 기반 안내 UI는 저장 전, 저장 중, 저장 후, 현재 화면 위치 조건을 분리해서 처리한다.
- 규칙 승격 후보: 저장 이후 안내 UI는 핵심 저장 로직과 분리하고, 상태값과 화면 위치 조건만으로 제어한다.
- Context 반영 후보: `NULL`

### 2026-05-26 / 비주얼리 에러 빈 상태 UI 정리

- 브랜치: main
- 작업 유형: 실행형
- 라우팅 판단: 공통 에러/빈 상태 컴포넌트와 관련 화면 교체가 목표로 명확하고, 저장/API/인증/결제 로직을 건드리지 않는 UI 중심 작업이므로 실행형으로 처리
- 목표: Next.js 기본 에러 느낌을 제거하고 light/dark 브랜드 로고를 사용하는 에러/빈 상태 UI로 통일
- 변경 파일: components/common/ErrorState.jsx, app/error.js, app/not-found.js, app/result/page.js, app/result/full-report/page.js, public/images/brand/bejewely-icon-light.png, public/images/brand/bejewely-icon-dark.png
- 보호 구역: 인증/권한, DB schema/migration/policy, 결제 로직, API response field names, 저장 데이터 구조, 배포 설정
- 검증 결과: npm run build 성공, git diff --check 성공, 390px Playwright 확인에서 404/result empty/analysis failed/full-report empty/error boundary 화면 overflow 없음, light 로고와 dark 로고 분기 확인, 버튼 href 확인
- 문제/주의점: 요청은 main 작업이었지만 기존 feature 브랜치에 미커밋 변경이 있어 `codex-preserve-before-main-error-state` stash로 보존 후 main으로 전환함. `/my` 라우트는 main에 없어 새 화면을 만들지 않고 기존 결과 없음 상태만 교체함.
- 다음 작업: 저장 결과 목록 화면이 추가되면 result_empty 보조 액션을 `/my`로 연결할 수 있음
- 재사용할 규칙: 공통 에러 UI는 개발자용 에러 문자열을 직접 노출하지 않고, 행동 가능한 CTA와 브랜드 로고를 우선한다.
- 규칙 승격 후보: `NULL`
- Context 반영 후보: `NULL`

### 2026-05-26 / feature 브랜치 main merge 반영

- 브랜치: feature/revisit-core-db
- 작업 유형: 실행형
- 라우팅 판단: 사용자가 main 반영 방식을 merge로 명확히 지정했고, commit/push 없이 병합 결과와 검증만 수행하는 제한 작업이므로 실행형으로 처리
- 목표: feature/revisit-core-db에 main 최신 변경사항을 반영하되 merge commit은 만들지 않고 build/diff 검증까지 확인
- 변경 파일: main merge 반영 파일 전체, 기존 stash 복원 파일(.gitignore, AGENTS.md, components/result/SaveReportCTA.jsx, img/Bejewely_icon.png, img/bejewely-icon-dark.png, img/bejewely-icon-light.png), data/hwahae-review-signals/categories/moisturizer/balm/.gitkeep, data/hwahae-review-signals/categories/moisturizer/gel/.gitkeep
- 보호 구역: commit/push 미수행, merge commit 생성 방지를 위해 --no-commit --no-ff 사용, 인증/DB/결제/배포 설정 수동 수정 없음
- 검증 결과: git merge --no-commit --no-ff main 충돌 없음, git stash pop 충돌 없음, npm run build 성공, git diff --check 성공, git diff --cached --check 성공, git diff HEAD --check 성공
- 문제/주의점: main에서 들어온 .gitkeep 두 파일에 trailing whitespace가 있어 제거 후 staging함. 현재 MERGE_HEAD가 남아 있어 사용자가 commit 또는 merge abort로 마무리해야 함.
- 다음 작업: 수동 리뷰 대상 파일 확인 후 문제가 없으면 merge commit 생성, 문제가 있으면 git merge --abort 또는 필요한 파일만 조정
- 재사용할 규칙: commit 금지 조건이 있는 merge 작업은 --no-commit --no-ff로 병합 결과만 만들고 검증한다.
- 규칙 승격 후보: `NULL`
- Context 반영 후보: `NULL`

### 2026-05-26 / my 햄버거 메뉴 연결

- 브랜치: feature/revisit-core-db
- 작업 유형: 실행형
- 라우팅 판단: /my 헤더 UI에서 로그아웃 버튼 노출 위치만 변경하는 요청이며, 인증/로그아웃 로직과 라우트는 그대로 유지하므로 실행형으로 처리
- 목표: /my 상단의 노출된 로그아웃 버튼을 제거하고 햄버거 메뉴 안으로 이동
- 변경 파일: components/my/MyDashboard.jsx, components/my/MyDashboardMenu.jsx
- 보호 구역: /api/auth/signout 라우트, 인증 세션 처리, dashboard payload, DB/API 로직
- 검증 결과: npm run build 성공, git diff --check 성공, /my에서 헤더 로그아웃 버튼 미노출 확인, 햄버거 메뉴 open 시 로그아웃 href가 /api/auth/signout인 것 확인
- 문제/주의점: 로그아웃 동작 자체는 기존 href를 그대로 사용하며 직접 클릭 검증은 세션 종료를 유발하므로 수행하지 않음
- 다음 작업: /my 메뉴에 추가 항목이 필요하면 result/full-report 메뉴와 항목 체계를 맞춰 확장
- 재사용할 규칙: 계정 액션은 화면 주요 CTA처럼 노출하지 않고, 필요 시 compact menu 안으로 이동한다.
- 규칙 승격 후보: `NULL`
- Context 반영 후보: `NULL`

### 2026-05-26 / 공용 햄버거 메뉴 컴포넌트 정리

- 브랜치: feature/revisit-core-db
- 작업 유형: 실행형
- 라우팅 판단: result/full-report/my 헤더 메뉴 UI의 중복 구현을 공용 컴포넌트로 묶는 제한된 UI 구조 정리이며, 인증/저장/API 로직 변경 없이 표시 컴포넌트만 조정하므로 실행형으로 처리
- 목표: 화면별로 달라진 햄버거 메뉴 구성을 언어, 계정, 화면 모드, 보조 액션 구조로 통일
- 변경 파일: components/navigation/AppHamburgerMenu.jsx, components/my/MyDashboardMenu.jsx, components/my/MyDashboard.jsx, app/result/page.js, app/result/full-report/page.js
- 보호 구역: 인증 세션 처리, /api/auth/signout 라우트, 저장/공유/full-report 데이터 로직, DB/API 로직
- 검증 결과: npm run build 성공, git diff --check 성공, /my 헤더에서 노출 로그아웃 제거 확인, /my 메뉴 open 시 언어/계정/화면 모드/무료 진단 시작하기 확인, /test-result 메뉴 open 시 언어/계정/화면 모드/다시 테스트하기 확인, /test-full-report 메뉴 open 시 언어/계정/화면 모드/무료 결과로 돌아가기/다시 테스트하기 확인, 425px viewport overflow 없음 확인
- 문제/주의점: /my는 영어 전용 대시보드 라우트가 없어 English 메뉴는 /en 랜딩으로 보낸다.
- 다음 작업: /en/my가 생기면 MyDashboardMenu의 English href를 /en/my로 교체
- 재사용할 규칙: 동일 헤더 메뉴는 화면마다 직접 복사하지 말고 공용 컴포넌트로 구성만 주입한다.
- 규칙 승격 후보: 공통 메뉴/헤더 UI는 한 컴포넌트에 모으고 화면별 액션만 props로 분리한다.
- Context 반영 후보: Candidates

### 2026-05-27 / result UX main merge 전 최종 점검

- 브랜치: feature/revisit-core-db
- 작업 유형: 진단형
- 라우팅 판단: main merge 전 변경 범위, 빌드, diff, 모바일 회귀를 확인하는 점검 작업이며 새 기능/UI 변경 없이 검증 중심으로 처리
- 목표: revisit/result UX 변경이 main 병합 가능한 상태인지 확인
- 변경 파일: docs/Bejewely-revisit-db-erd-v0.2.md, docs/Bejewely-revisit-implementation-plan-v0.2-fixed.md, docs/Bejewely-revisit-usecase-v0.2.md, .codex/AI_WORK_LOG.md
- 보호 구역: result/auth/save/share/full-report 로직 및 UI 재배치 미수정, DB schema 미수정
- 검증 결과: npm run build 성공, git diff --check 성공(CRLF warning만 남음), main 기준 diff-check trailing whitespace 3건 제거, /result 390px overflow 없음, hamburger/language/theme/save/floating/full-report/share page/image save 수동 확인, build 성공 후 /result smoke 재확인
- 문제/주의점: 최초 npm run build는 dev server가 살아있는 상태에서 Next.js 15.5.14 초기 출력 이후 9분 이상 추가 로그 없이 멈췄다. dev server와 build 프로세스를 모두 종료한 뒤 재실행하자 17.8초에 정상 완료되어, 코드 정적 렌더 hang이 아니라 concurrent dev/build 실행 영향으로 판단한다.
- 다음 작업: merge 전 build를 다시 실행할 때는 dev server를 먼저 종료한다.
- 재사용할 규칙: main merge 전 점검은 작업 브랜치 diff뿐 아니라 origin/main 기준 diff-check도 함께 확인한다.
- 규칙 승격 후보: `NULL`
- Context 반영 후보: `NULL`

### 2026-05-31 / Supabase anonymous user data policy hardening

- Branch: main
- Task type: diagnostic with limited execution
- Routing decision: Supabase RLS/auth policy work is High risk, but user explicitly requested applying only the anonymous-user policy restriction and committing/pushing it.
- Goal: Block Supabase anonymous-auth users from owner-scoped My Skin data policies while preserving permanent authenticated-user access.
- Changed files: supabase/migrations/20260531123349_restrict_anonymous_user_data_policies.sql
- Protected areas: DB policy touched with explicit user instruction; no env/auth redirect/deployment config changes.
- Validation: Applied SQL to linked Supabase project with `supabase db query --linked --file ...`; verified affected policies include `is_anonymous = false`; `supabase db advisors --linked --type security --level warn -o json` now reports only `auth_leaked_password_protection`.
- Notes/risks: Existing unrelated working-tree changes were not staged or modified. Leaked password protection remains a dashboard/plan-dependent Auth setting.
- Reusable rule: When anonymous Supabase sign-in is enabled, `to authenticated` RLS policies for account-owned data should explicitly exclude anonymous users with the JWT `is_anonymous` claim.
- Context promotion candidate: Bridge

### 2026-05-31 / 무료 결과 v2 흐름 실험

- 브랜치: feature/free-result-flow-v2
- 작업 유형: 실행형
- 라우팅 판단: 무료 결과 페이지의 UI/UX 흐름 조정이며, 수정 대상과 목표가 명확하고 API/DB/유료 리포트 구조를 건드리지 않는 제한된 UI 작업이므로 실행형으로 처리
- 목표: 무료 결과를 핵심 진단, 판단 근거, 우선순위, 추천 방향, Top Pick 미리보기, 루틴 방향, Face Lab 프리뷰, Full Report CTA 순서로 펼쳐 실제 화면 검토가 가능하게 만들기
- 변경 파일: app/result/page.js, .codex/AI_WORK_LOG.md
- 보호 구역: 유료 리포트 페이지, 추천 알고리즘, DB/API 응답 구조, 저장 데이터 구조, 인증/권한, 배포 설정 미수정
- 검증 결과: npm run build 성공, git diff --check 성공(CRLF warning만 있음), Browser로 /test-result 1/5~5/5 이동 확인, 390px Playwright 확인에서 5개 step 모두 가로 overflow 없음 및 console/page error 없음
- 문제/주의점: 기존 워킹트리에 데이터/스크립트/package.json 관련 사용자 변경이 있어 건드리지 않음. 사진/설문/Face Lab 구조화 값이 부족한 경우 무료 UI 표시용 fallback과 TODO 주석으로 처리함.
- 다음 작업: 실제 사용자 결과 화면 기준으로 카드 병합/삭제, 문구 압축, 모바일 첫 화면 정보량 조정
- 재사용할 규칙: 무료 결과 UI 실험은 API 응답 구조와 유료 리포트 구조를 바꾸지 않고, 기존 결과 데이터와 표시용 fallback helper만으로 먼저 검증한다.
- 규칙 승격 후보: `NULL`
- Context 반영 후보: `NULL`

### 2026-05-31 / 무료 결과 v2 문구 직관화

- 브랜치: feature/free-result-flow-v2
- 작업 유형: 실행형
- 라우팅 판단: 무료 결과 v2 화면의 1/5, 2/5, 4/5 문구와 표시 방식만 조정하는 UI 작업이며, 기능 로직/API/DB/유료 리포트 구조 변경이 없으므로 실행형으로 처리
- 목표: 핵심 진단은 체감 묘사를 먼저 보여주고, 판단 근거는 사진/설문 신호를 해석 문장으로 연결하며, 루틴 방향은 긴 설명 대신 AM/PM 단계형 흐름으로 압축
- 변경 파일: app/result/page.js, .codex/AI_WORK_LOG.md
- 보호 구역: 추천 알고리즘, API 응답 구조, DB/저장 데이터, Full Report 페이지, 인증/권한, 배포 설정 미수정
- 검증 결과: npm run build 성공, git diff --check 성공(CRLF warning만 있음), /test-result 390px Playwright 확인에서 1/5 체감 문장/진단명, 2/5 해석 문장/종합 해석, 4/5 AM/PM pill 흐름과 gate 문구 확인, 가로 overflow 없음, console/page error 없음
- 문제/주의점: 기존 5단계 시퀀스와 카드 구성은 유지하고 텍스트 밀도만 낮춤
- 다음 작업: 실제 결과 데이터별로 1/5 체감 문장의 분기 문구가 과하게 일반적이지 않은지 샘플별로 비교
- 재사용할 규칙: 무료 결과 첫 문장은 분류명보다 사용자가 체감할 상태 묘사를 우선하고, 분류명은 보조 태그로 낮춘다.
- 규칙 승격 후보: `NULL`
- Context 반영 후보: `NULL`

### 2026-06-01 / 무료 결과 v2 AI 리포트감 보강

- 브랜치: feature/free-result-flow-v2
- 작업 유형: 실행형
- 라우팅 판단: 2/5, 4/5, 5/5 무료 결과 화면의 시각 표현 보강이며, API/추천 로직/Step 수/저장 구조 변경 없이 단일 결과 UI 파일 중심으로 제한되는 작업이라 실행형으로 처리
- 목표: 판단 근거 사진에 AI 분석 오버레이를 추가하고, 루틴 방향을 미니 흐름 다이어그램으로 보강하며, 전체 리포트 프리뷰 항목에 썸네일 미리보기를 추가
- 변경 파일: app/result/page.js, .codex/AI_WORK_LOG.md
- 보호 구역: API 응답 필드, 추천 로직, Step 수, 저장 데이터 구조, 인증/권한, DB/배포 설정 미수정
- 검증 결과: git diff --check 통과(CRLF warning만 있음), npm run build 성공, Browser로 390px 모바일 폭에서 2/5·4/5·5/5 진행 확인, Playwright 390px dark screenshot 3장 생성, 2/5·4/5·5/5 scrollWidth 390 및 console/page error 없음 확인
- 문제/주의점: in-app Browser fullPage screenshot은 CDP capture timeout이 발생해, Browser 상태 검증 후 별도 Playwright로 동일 localhost 390px 스크린샷을 생성함
- 다음 작업: 실제 사용자 사진 비율이 다양한 경우 오버레이 라벨 위치가 얼굴을 과하게 가리지 않는지 샘플별로 미세 조정
- 재사용할 규칙: 무료 결과의 리포트감 강화는 분석/추천 데이터 구조를 바꾸지 않고, 기존 표시 데이터 위에 시각적 근거와 미리보기 레이어를 얹어 먼저 검증한다.
- 규칙 승격 후보: `NULL`
- Context 반영 후보: `NULL`
### 2026-06-01 / free result v2 step 1 summary cleanup

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 1 UI/UX cleanup in `app/result/page.js` only; API, DB, recommendation logic, storage, auth, and full-report routes were out of scope.
- Goal: Refocus 1/5 on the skin summary by removing repeated Face Lab and recommendation direction content from Step 1, then moving those sections to Step 4.
- Changed files: app/result/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check` passed with CRLF warnings only; `npm run build` passed; `/test-result` 390px Playwright smoke passed for 1/5 through 4/5; Step 1 scrollWidth/clientWidth stayed 390/390, console/page errors were empty, and Step 1 scrollHeight reduced from the prior 1842px check to 1272px.
- Notes/risks: Existing unrelated dirty files remained untouched. Step 4 is longer because it now carries the moved recommendation direction and Face Lab preview.
- Reusable rule: The free result first step should remain a summary page; recommendation direction and style/mood previews belong later in the flow.
- Context promotion candidate: Candidates

### 2026-06-01 / free result v2 step 3 recommendation guide merge

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 1 and Step 3/4 UI structure cleanup in `app/result/page.js` only; API, DB, recommendation logic, storage, auth, and full-report routes were out of scope.
- Goal: Move the Face Lab summary back into Step 1 as secondary information, merge Top Pick and routine usage into a new Step 3 recommendation/use guide, and leave Step 4 as an expected-change placeholder.
- Changed files: app/result/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check` passed with CRLF warnings only; `npm run build` passed; `/test-result` 390px Playwright smoke passed for 1/5 through 4/5; Step 1/3/4 scrollWidth/clientWidth stayed 390/390, console/page errors were empty.
- Notes/risks: Step 4 is intentionally a placeholder for the next expected-change task. Existing unrelated dirty files remained untouched.
- Reusable rule: Free result v2 should keep roles separated by step: 1 summary, 2 evidence, 3 recommendation plus use direction, 4 expected change, 5 premium continuation.
- Context promotion candidate: Candidates

### 2026-06-01 / free result v2 step 3 density refinement

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 3 UI density and copy refinement in `app/result/page.js` only; API, DB, recommendation logic, step count, and other result steps were out of scope.
- Goal: Improve the Step 3 recommendation/use guide layout using the reference for hierarchy and density while preserving the current information structure.
- Changed files: app/result/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check` passed with CRLF warnings only; `npm run build` passed; `/test-result` 390px Playwright check passed on Step 3 with scrollWidth/clientWidth 390/390 and no console/page errors.
- Notes/risks: The in-app browser control path had a click-runtime issue, so the 390px verification used Playwright directly against the same localhost page.
- Reusable rule: Step 3 should keep Top Pick compact, make the use routine the visual focus, and phrase locked cards as decisions the user can resolve.
- Context promotion candidate: Candidates

### 2026-06-02 / free result v2 step 3 mobile readability cleanup

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 3 UI-only cleanup in `app/result/page.js`; recommendation logic, API, DB, data fields, step structure, and other steps were out of scope.
- Goal: Make Step 3 easier to scan on mobile by emphasizing the core product role, changing AM/PM routines to a clearer vertical flow, and compressing locked cards.
- Changed files: app/result/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check` passed with CRLF warnings only; `npm run build` passed; `/test-result` 390px Playwright check passed on Step 3 with scrollWidth/clientWidth 390/390 and no console/page errors.
- Notes/risks: Verification used Playwright directly against localhost:3001; no API/DB/recommendation code was changed.
- Reusable rule: On mobile, Step 3 roles should distinguish core vs supporting roles, routines should read vertically, and locked cards should use compact decision-oriented rows.
- Context promotion candidate: Candidates

### 2026-06-02 / free result v2 step 4 management checkpoints

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 4 UI role rebuild in `app/result/page.js`; API, DB, recommendation logic, data fields, payment, and full-report pages were out of scope.
- Goal: Replace the temporary routine/expected-change Step 4 with a management checkpoint page focused on observation, maintenance, and caution signals after applying the recommendation.
- Changed files: app/result/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check` passed with CRLF warnings only; `npm run build` passed; `/test-result` 390px Playwright check passed on Step 4 with scrollWidth/clientWidth 390/390, no console/page errors, required checkpoint sections present, and forbidden Step 3 repeats absent.
- Notes/risks: Step 4 now has a clearer management role, but the final flow still needs the next UX decision for whether Step 4 should become expected-change content later or keep the checkpoint role.
- Reusable rule: Step 4 should avoid Top Pick, AM/PM routine, Face Lab, current-priority, and recommendation-direction repeats; it should focus on management, observation, and caution.
- Context promotion candidate: Candidates

### 2026-06-02 / free result v2 step 4 recommendation validation

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 4 UI-only role change in `app/result/page.js`; API, DB, recommendation logic, data fields, payment, and full-report pages were out of scope.
- Goal: Reframe Step 4 from management checkpoints into a recommendation validation page that helps the user judge whether the recommended routine fits their skin.
- Changed files: app/result/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check` passed with CRLF warnings only; `npm run build` passed; `/test-result` 390px Playwright check passed on Step 4 with scrollWidth/clientWidth 390/390, no console/page errors, required validation sections present, and Step 3 repeats absent.
- Notes/risks: Section 1 uses four fit signals, so Step 4 is slightly longer than the reference. The hierarchy is clearer, but the Step 4-to-Step 5 CTA wording may still need tuning after Step 5 is finalized.
- Reusable rule: Step 4 should answer "how do I know this recommendation fits?" with positive fit signals and adjustment signals, not repeat recommendation product, AM/PM routine, Face Lab, or priority content.
- Context promotion candidate: Candidates

### 2026-06-02 / free result v2 step 3 structure compression

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 3 UI structure refactor in `app/result/page.js`; API, DB, recommendation logic, data fields, payment, and full-report pages were out of scope.
- Goal: Compress Step 3 by merging product tags and role information, switching AM/PM routine display to a single tabbed routine card, and consolidating paid prompts into one preview list.
- Changed files: app/result/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check` passed with CRLF warnings only; `npm run build` passed; `/test-result` 390px Playwright check passed on Step 3 with scrollWidth/clientWidth 390/390, no console/page errors, default morning tab visible, night tab switch working, and Step 4 validation content absent from Step 3.
- Notes/risks: Step 3 is shorter and less lock-heavy, but the product image placeholder still limits the visual polish until a real product image is available.
- Reusable rule: Step 3 should show one recommendation, one active routine view, and one consolidated premium preview box; avoid separate lock cards and repeated fit/role tags.
- Context promotion candidate: Candidates

### 2026-06-02 / free result v2 step 4 signal toggle compression

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 4 UI-only refactor in `app/result/page.js`; API, DB, recommendation logic, data fields, payment, and other result steps were out of scope.
- Goal: Compress Step 4 into the same toggle pattern as Step 3, showing either fit signals or adjustment signals while consolidating the full-report preview into one list box.
- Changed files: app/result/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check` passed with CRLF warnings only; `npm run build` passed; `/test-result` 390px Playwright check passed on Step 4 with scrollWidth/clientWidth 390/390, no console/page errors, fit tab default active, adjustment tab switching correctly, and full-report items rendered as one list box.
- Notes/risks: Step 4 is now much shorter, but the visual balance depends on whether the full-report CTA remains below this step or moves into Step 5 copy later.
- Reusable rule: Step 4 validation signals should use one toggle card and one consolidated full-report preview; do not show fit and adjustment groups simultaneously.
- Context promotion candidate: Candidates

### 2026-06-02 / free result v2 step 5 execution guide conversion

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 5 UI-only premium conversion refactor in `app/result/page.js`, with display-label support in `components/result/SaveReportCTA.jsx`; API, DB, payment, recommendation logic, Full Report, and Step 1-4 content were out of scope.
- Goal: Replace the final locked-card list with a compact "my skin execution guide" conversion screen focused on order, frequency, avoided combinations, and alternatives.
- Changed files: app/result/page.js, components/result/SaveReportCTA.jsx, .codex/AI_WORK_LOG.md
- Protected areas: Auth/save behavior was not changed; `SaveReportCTA` only received optional label/helper text overrides for the final free-save presentation.
- Validation: `git diff --check` passed with CRLF warnings only; `npm run build` passed; `/test-result` 390px in-app browser check passed on localhost:3002 with scrollWidth/clientWidth 390/390, required Step 5 copy present, old large AM/PM cards absent, no new console/page errors, and a clean Playwright screenshot saved.
- Notes/risks: localhost:3001 was an older long-running Next server, so latest UI verification used a separate localhost:3002 dev server. Production `next start` cannot verify `/test-result` because that route redirects in production mode.
- Reusable rule: Step 5 should close the free flow with one execution-guide card, one blurred routine preview, one compact included-items list, and one primary action-oriented CTA.
- Context promotion candidate: Candidates

### 2026-06-04 / free result v2 step 2 evidence signal flip toggle

- 브랜치: feature/free-result-flow-v2
- 작업 유형: 실행형
- 라우팅 판단: /test-result Step 2의 판단 근거 카드 표시 방식만 바꾸는 제한된 UI 작업이며, API/DB/추천 로직/저장 구조/결제/Full Report는 범위 밖이므로 실행형으로 처리
- 목표: Step 3 루틴 카드처럼 사진/설문 신호를 토글로 전환하고, 신호 카드 영역 클릭 시 뒤집히는 애니메이션으로 두 신호 묶음을 확인하게 만들기
- 변경 파일: app/result/page.js, .codex/AI_WORK_LOG.md
- 보호 구역: API 응답 필드, 저장 데이터 구조, 인증/권한, DB schema/migration/policy, 결제, 배포 설정 미수정
- 검증 결과: `git diff --check` 통과(CRLF warning만 있음), `npm run build` 성공, in-app Browser에서 `/test-result` Step 2 진입 후 사진/설문 탭 각각 1개 노출 확인, 설문 탭 전환과 카드 클릭 후 사진 탭 복귀 확인, scrollWidth/clientWidth 380/380, console error 없음
- 문제/주의점: in-app Browser viewport screenshot 캡처는 CDP timeout으로 실패했지만, DOM/상태/폭/콘솔 검증은 완료함
- 다음 작업: 실제 모바일 화면에서 flip 전환이 너무 빠르거나 느리면 duration만 미세 조정
- 재사용할 규칙: 무료 결과의 병렬 근거 정보는 한 화면에 모두 펼치기보다 탭과 단일 active card로 압축해 텍스트 밀도를 낮춘다.
- 규칙 승격 후보: `NULL`
- Context 반영 후보: `NULL`

### 2026-06-04 / free result v2 step 2 photo cue reveal animation

- 브랜치: feature/free-result-flow-v2
- 작업 유형: 실행형
- 라우팅 판단: /test-result Step 2 사진 분석 카드의 설명 노출 방식만 조정하는 제한된 UI 작업이며, API/DB/추천 로직/저장 구조/인증/결제/Full Report는 범위 밖이므로 실행형으로 처리
- 목표: 사진 분석 설명 텍스트를 기본 숨김 상태로 두고, 사진을 누르면 유도 문구가 사라지며 설명 callout들이 튀어나오는 애니메이션을 적용
- 변경 파일: app/result/page.js, .codex/AI_WORK_LOG.md
- 보호 구역: API 응답 필드, 저장 데이터 구조, 인증/권한, DB schema/migration/policy, 결제, 배포 설정 미수정
- 검증 결과: `git diff --check` 통과(CRLF warning만 있음), `npm run build` 성공, Playwright 390px에서 Step 2 진입 확인, 사진 CTA `눌러보세요!` 기본 노출 확인, 사진 클릭 후 `aria-expanded=true` 및 유도 문구 제거 확인, scrollWidth/clientWidth 390/390, console/page error 없음
- 문제/주의점: in-app Browser 현재 탭에서는 하단 CTA 클릭이 step을 이동시키지 않아, 동일 localhost에 대해 별도 Playwright로 상호작용 검증함
- 다음 작업: 실제 모바일 화면에서 callout 튀어나오는 강도가 과하면 spring stiffness/damping만 미세 조정
- 재사용할 규칙: 사진 위 분석 설명은 처음부터 전부 노출하지 않고, 클릭 유도와 reveal 애니메이션으로 단계적으로 열어 모바일 밀도를 낮춘다.
- 규칙 승격 후보: `NULL`
- Context 반영 후보: `NULL`

### 2026-06-04 / free result v2 step 2 photo cue persistence

- 브랜치: feature/free-result-flow-v2
- 작업 유형: 실행형
- 라우팅 판단: Step 2 사진 분석 카드의 reveal 상태와 점선 오버레이 노출만 조정하는 UI 상태 작업이며, API/DB/추천 로직/저장 데이터/인증/결제/Full Report는 범위 밖이므로 실행형으로 처리
- 목표: 사진을 한 번 누른 뒤 다른 step이나 새로고침 후 돌아와도 분석 설명이 펼쳐진 상태로 유지되고, 점선 동그라미도 설명과 함께 나타나도록 조정
- 변경 파일: app/result/page.js, .codex/AI_WORK_LOG.md
- 보호 구역: API 응답 필드, 저장 데이터 구조, 인증/권한, DB schema/migration/policy, 결제, 배포 설정 미수정. UI reveal 여부만 sessionStorage에 저장
- 검증 결과: `git diff --check` 통과(CRLF warning만 있음), `npm run build` 성공, Playwright 390px에서 기본 상태 `aria-expanded=false`, CTA 노출, 점선 오버레이 `aria-hidden=true`/opacity 0 확인. 클릭 후 `aria-expanded=true`, CTA 제거, 점선 오버레이 `aria-hidden=false`/opacity 1 확인. Step 3 이동 후 이전 및 새로고침 후 Step 2 재진입에서도 펼쳐진 상태 유지 확인. scrollWidth/clientWidth 390/390, console/page error 없음
- 문제/주의점: 없음
- 다음 작업: 실제 모바일 화면에서 sessionStorage 유지 범위가 과하면 브라우저 세션 한정 대신 parent state로 좁힐 수 있음
- 재사용할 규칙: 인터랙션으로 한 번 연 분석 보조 정보는 같은 결과 확인 세션 안에서는 다시 접히지 않게 유지해 반복 클릭 부담을 줄인다.
- 규칙 승격 후보: `NULL`
- Context 반영 후보: `NULL`

### 2026-06-04 / free result v2 step 2 bridge CTA lead-in

- 브랜치: feature/free-result-flow-v2
- 작업 유형: 실행형
- 라우팅 판단: Step 2 마지막에 Step 3 CTA를 연결하는 단일 UI 요소를 추가하는 작업이며, API/DB/추천 로직/저장 데이터/인증/결제/Full Report는 범위 밖이므로 실행형으로 처리
- 목표: CTA 직전에 정보 카드보다 가벼운 bridge 영역을 추가해 "이 분석을 바탕으로 가장 적합한 제품과 활용 방법을 정리했습니다." 문구로 Step 2에서 Step 3로 자연스럽게 연결
- 변경 파일: app/result/page.js, .codex/AI_WORK_LOG.md
- 보호 구역: API 응답 필드, 저장 데이터 구조, 인증/권한, DB schema/migration/policy, 결제, 배포 설정 미수정
- 검증 결과: `git diff --check` 통과(CRLF warning만 있음), `npm run build` 성공, Playwright 390px에서 bridge 문구 노출, `종합 해석` 미노출 유지, bridge가 CTA 바로 위에 배치됨 확인, bridge 높이 66px, scrollWidth/clientWidth 390/390, console/page error 없음
- 문제/주의점: 없음
- 다음 작업: 실제 기기에서 CTA보다 bridge가 강하게 보이면 border/background opacity만 낮춰 조정
- 재사용할 규칙: Step 간 연결 문구는 독립 정보 카드가 아니라 CTA 직전의 낮은 무게 bridge로 처리해 다음 행동을 방해하지 않는다.
- 규칙 승격 후보: `NULL`
- Context 반영 후보: `NULL`

### 2026-06-04 / free result v2 step 1 diagnosis structure polish

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 1 UI-only polish in `app/result/page.js`; API, DB, recommendation logic, payment, result step count, and Step 2-5 structures were out of scope.
- Goal: Promote the one-line diagnosis, combine photo and compact pentagon parameters, reduce Face Lab into an auxiliary chip strip, and tighten priority TOP 3 with a subtle core badge.
- Changed files: app/result/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check` passed with CRLF warning only; `npm run build` passed; in-app Browser `/test-result` reload confirmed required Step 1 texts and no console errors; Playwright 390px checks passed for light and dark themes with scrollWidth/clientWidth 390/390 and required Step 1 labels/CTA present.
- Notes/risks: The top global result header still sits above Step 1, so the CTA is not guaranteed to be in the first viewport from absolute page top at 390px. Step 1 itself keeps the diagnosis first within the step and does not change data/recommendation behavior.
- Reusable rule: Step 1 should prioritize a large diagnosis statement, keep the photo plus pentagon as one compact visual summary, keep Face Lab as auxiliary chips, and show priority TOP 3 as the execution order.
- Context promotion candidate: NULL

### 2026-06-04 / free result v2 step 1 radar help modal

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 1 i-button copy and popover behavior in `app/result/page.js`; API, DB, recommendation logic, saved data, payment, and result step count were out of scope.
- Goal: Make the skin-state pentagon understandable by renaming axes to care-attention terms and connecting the i button to a compact explanatory modal.
- Changed files: app/result/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check` passed with CRLF warning only; `npm run build` passed; Playwright 390px light/dark checks confirmed the renamed axes, help modal title/body/axis list/footer copy, close button, outside-click close, scrollWidth/clientWidth 390/390, and no console/page errors.
- Notes/risks: The radar values remain display-only derived UI values. They should continue to be framed as care-priority signals, not exact skin scores.
- Reusable rule: When a visual summary uses derived skin axes, axis names and help copy should make the direction explicit: farther outward means stronger current care signal, not a medical measurement.
- Context promotion candidate: NULL

### 2026-06-04 / free result v2 step 1 mobile compression polish

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 1 UI compression and interaction polish in `app/result/page.js`; API, DB, recommendation logic, payment, saved data, and result step count were out of scope.
- Goal: Shorten radar labels, make the i button more discoverable without competing with CTA, organize Face Lab as grouped auxiliary info, remove the priority helper link, and collapse priority descriptions behind a simple accordion.
- Changed files: app/result/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check` passed with CRLF warning only; `npm run build` passed; in-app Browser `/test-result` reload confirmed short radar labels, Face Lab groups, removed priority helper link, and no browser errors; Playwright 390px light/dark checks confirmed short labels, help modal, grouped Face Lab, collapsed priority descriptions, first priority accordion open, scrollWidth/clientWidth 390/390, and no console/page errors.
- Notes/risks: The priority accordion defaults to all rows collapsed, so users must tap a priority row to read the short description.
- Reusable rule: Step 1 should keep derived radar labels short on the graph and move explanatory detail into help; priority text should default to title-first and reveal short detail only on tap.
- Context promotion candidate: NULL

### 2026-06-04 / free result v2 step 1 photo and radar structure split

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 1 UI-only structure rearrangement in `app/result/page.js`; API, DB, recommendation logic, payment, saved data, result step count, and Step 2-5 flow were out of scope.
- Goal: Keep the Step 1 information set while moving Face Lab beside a larger photo, separating the skin radar into its own card, and keeping priority TOP 3 below the radar.
- Changed files: app/result/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check` passed with CRLF warning only; `npm run build` passed; Playwright 390px checks confirmed the larger photo, standalone radar with legend, unclipped/non-overlapping radar labels, collapsed priority list, CTA visibility path, and scrollWidth/clientWidth parity.
- Notes/risks: Step 1 becomes taller because the photo/mood card and radar card are split. This improves photo and radar readability at the cost of slightly more vertical scroll.
- Reusable rule: When Step 1 has both face mood and skin-state visualization, keep Face Lab attached to the photo as auxiliary face mood context and keep the pentagon as a separate skin snapshot card.
- Context promotion candidate: NULL

### 2026-06-05 / free result v2 step 1 conclusion card experiment

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 1 UI-only experiment in `app/result/page.js`; recommendation logic, API, DB, payment, Face Lab, radar structure, result step count, and Step 2-5 flow were out of scope.
- Goal: Replace the free-form one-line diagnosis block with a compact conclusion card that makes the core result easier to notice without modal/position/absorption animation.
- Changed files: app/result/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check` passed with CRLF warning only; `npm run build` passed; in-app Browser 390-ish dark viewport confirmed conclusion card, photo/radar/priority order, no horizontal overflow, and no radar label clipping/overlap.
- Notes/risks: The conclusion card improves first-read clarity while reducing the large headline height, but it is visually less dramatic than the previous oversized text treatment by design.
- Reusable rule: Step 1 conclusion emphasis should use a lightweight static card plus one-time opacity/Y entrance only; avoid central popups, position movement, repeated animation, scale, and CTA-level visual weight.
- Context promotion candidate: NULL

### 2026-06-05 / free result v2 loading reveal test flow

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Development-only test route addition in `app/loading/page.js`; recommendation logic, API response shape, DB, payment, saved data, and existing Step 1-5 result flow were out of scope.
- Goal: Add a 15-second forced loading UX that changes analysis-stage copy, then reveals a one-line diagnosis completion screen with CTA into the existing `/test-result` Step 1 flow.
- Changed files: app/loading/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check` passed with CRLF warning only; `npm run build` passed and generated `/loading`; Playwright 390px light flow confirmed 0-5s/5-10s/10-15s active loading details, 15s completion reveal, CTA click to `/test-result`, Step 1 `RESULT STEP` 1/5, and no horizontal overflow; Playwright 390px dark completion screen confirmed completion copy, diagnosis, CTA, and no horizontal overflow; in-app Browser `/loading` flow confirmed 15s reveal and CTA navigation to `/test-result`.
- Notes/risks: `/loading` is a development verification route and redirects to `/` in production via client effect. It does not call analysis APIs or seed/write result data directly; `/test-result` continues to handle fixture seeding.
- Reusable rule: Result-entry experiments should be isolated on development routes first, use fixture-backed navigation, and avoid modifying production analysis or result data flow.
- Context promotion candidate: NULL

### 2026-06-05 / free result v2 step 1 radar dashboard polish

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 1 skin-state radar card internal UI polish in `app/result/page.js`; Step 1 overall structure, Face Lab, priority TOP 3, recommendation logic, API, DB, payment, saved data, and result step count were out of scope.
- Goal: Make the pentagon card read as an interpretable skin-state dashboard by adding a concise interpretation sentence, status sublabels, compact TOP3 signal chips, a slightly larger chart, and a quieter guide legend.
- Changed files: app/result/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check` passed with CRLF warning only; `npm run build` passed; in-app Browser `/test-result` reload confirmed the new radar interpretation and TOP3 chips with no label clipping/overlap; Playwright 390px light/dark checks confirmed interpretation text, signal chips, legend, SVG size 247x242, scrollWidth/clientWidth 390/390, no SVG label overlap/clipping, and no console/page errors.
- Notes/risks: The radar card is taller because it now includes interpretation and signal chips, but the chart remains below hero scale and the priority card remains the action-order section.
- Reusable rule: Radar cards should separate current-state signals from management priority: chart/chips summarize current signal strength, while priority TOP 3 remains the care order.
- Context promotion candidate: NULL

### 2026-06-05 / free result v2 step 1 radar card final spacing

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 1 internal UI polish and selected conclusion-card removal in `app/result/page.js`; Face Lab, priority TOP 3, recommendation logic, API, DB, payment, saved data, and result step count were out of scope.
- Goal: Finish the skin-state radar card by removing the strong divider, removing the repeated `핵심 신호 TOP3` label, moving the legend directly under the graph, keeping the chips lightweight, and removing the selected `AI 진단 결과` conclusion card.
- Changed files: app/result/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check` passed with CRLF warning only; `npm run build` passed; Playwright 390px light/dark checks confirmed the conclusion card and `핵심 신호 TOP3` label are removed, legend appears before chips, chips remain visible, SVG size remains 247x242, scrollWidth/clientWidth 390/390, no SVG label overlap/clipping, and no console/page errors; in-app Browser `/test-result` reload confirmed the same with scrollWidth/clientWidth 380/380.
- Notes/risks: Removing the conclusion card reduces repeated messaging and shortens Step 1, but the one-line diagnosis no longer appears as a separate card inside Step 1.
- Reusable rule: If Step 1 already has a clear heading and radar interpretation, avoid adding a separate conclusion card that competes with the photo/radar flow.
- Context promotion candidate: NULL

### 2026-06-05 / free result v2 step 1 face lab card polish

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 1 photo plus Face Lab card internal UI polish in `app/result/page.js`; Step 1 overall structure, skin radar card, priority TOP 3, recommendation logic, API, DB, payment, saved data, and result step count were out of scope.
- Goal: Make Face Lab read more clearly as a photo-derived face mood summary by renaming the title to `Face Lab · 얼굴 분위기` and changing the rows into icon, label, and value mini-list items.
- Changed files: app/result/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check` passed with CRLF warning only; `npm run build` passed; Playwright 390px light/dark checks confirmed the new title, `대표 무드`/`톤/컬러`/`스타일 방향` labels, values, preserved photo size at 156x195, scrollWidth/clientWidth 390/390, and no console/page errors; in-app Browser `/test-result` reload confirmed Face Lab, radar, priority, and no horizontal overflow at the current viewport.
- Notes/risks: The longer style value wraps naturally to multiple lines on 390px, which increases the Face Lab side panel height slightly without shrinking the photo.
- Reusable rule: Face Lab should stay tied to the photo as face-mood context, using compact icon rows for scanability while avoiding skin-state terminology and new interactions.
- Context promotion candidate: NULL

### 2026-06-05 / free result v2 step 1 face lab vertical carousel

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 1 photo plus Face Lab card internal interaction polish in `app/result/page.js`; Step 1 overall structure, skin radar card, priority TOP 3, recommendation logic, API, DB, payment, saved data, and result step count were out of scope.
- Goal: Replace the side-by-side Face Lab panel with one large photo followed by a single Face Lab lens value that advances by mobile swipe, desktop arrows, or dots.
- Changed files: app/result/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check -- app/result/page.js` passed with CRLF warning only; `npm run build` passed; Playwright checks confirmed 390px dark photo size 251x314, no horizontal overflow, mobile arrows hidden, mobile swipe 1/3 -> 2/3 -> 3/3, 390px light no horizontal overflow, desktop 900px arrows visible, desktop next arrow 1/3 -> 2/3, and no console/page errors.
- Notes/risks: The larger photo makes the Face Lab card taller. This matches the requested photo-first direction but pushes the priority card lower on 390px screens.
- Reusable rule: Face Lab interaction should stay inside the photo card, with the photo as the primary object and only one face-mood lens value visible at a time; use mobile swipe and desktop arrows without turning Step 1 into a full carousel.
- Context promotion candidate: NULL

### 2026-06-05 / free result v2 step 1 face lab carousel final polish

- Branch: feature/free-result-flow-v2
- Task type: execution
- Routing decision: Step 1 Face Lab card and priority rank circle UI-only polish in `app/result/page.js`; skin radar, recommendation logic, API, DB, payment, saved data, and result step count were out of scope.
- Goal: Reduce the Face Lab photo by 10%, remove the visible `1 / 3` counter, move desktop arrows beside the value text, remove the Face Lab icon, enlarge Face Lab text, move the one-time hint animation from the photo to the text, and shrink priority rank circles by about 15%.
- Changed files: app/result/page.js, .codex/AI_WORK_LOG.md
- Protected areas: Not touched.
- Validation: `git diff --check -- app/result/page.js` passed with CRLF warning only; `npm run build` passed; Playwright 390px dark check confirmed no horizontal overflow, no visible `1 / 3`, no Face Lab icon, photo 225x282, mobile arrows hidden, priority circle 27x27, and mobile swipe advanced the active Face Lab dot; Playwright 703px dark check confirmed desktop arrows visible beside the value text and next arrow advanced the active dot; 390px light screenshot confirmed no layout break.
- Notes/risks: The Face Lab card remains taller than the pre-carousel design, but the latest photo reduction shortens it while keeping the photo visually dominant.
- Reusable rule: For this Face Lab carousel, keep visible progress in dots only, keep mobile swipe hint on the text area, and keep desktop arrows adjacent to the value text rather than in the card header.
- Context promotion candidate: NULL
