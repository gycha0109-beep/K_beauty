# 비주얼리 재방문 구조 Implementation Plan

## 1. 문서 목적

이 문서는 비주얼리의 재방문 구조를 실제 코드에 반영하기 위한 구현 계획서다.

이미 작성된 문서:

```txt
docs/visualy-revisit-usecase.md
docs/visualy-db-erd.md
```

이 문서는 위 두 문서를 기준으로 Codex가 다음 작업을 안전하게 수행하도록 통제한다.

핵심 목표:

```txt
1. 기존 진단/결과/유료 리포트/공유 기능을 깨지 않는다.
2. Supabase Auth 기반 로그인 구조를 추가한다.
3. 진단 결과를 로그인 사용자 계정에 저장한다.
4. 로그인 사용자는 /my에서 자신의 피부 프로필을 확인한다.
5. 사용자는 오늘 피부 체크를 저장한다.
6. 체크인 결과 기반으로 오늘 루틴 카드를 생성한다.
```

---

## 2. 구현 원칙

## 2.1 기존 기능 보호

아래 기능은 반드시 유지되어야 한다.

```txt
/onboarding
/result
/result/full-report
/r/[shareId]
/api/analyze
/api/full-report
기존 premium_report_sessions 흐름
기존 products 기반 추천
기존 무료 결과 렌더링
기존 유료 Full Report 렌더링
기존 공유 결과 metadata
```

금지 사항:

```txt
기존 result 구조 전면 교체 금지
기존 full-report 구조 전면 교체 금지
기존 products schema 임의 변경 금지
기존 premium_report_sessions 삭제 금지
기존 공유 페이지 동작 변경 금지
```

---

## 2.2 작은 단위로 구현

Codex는 한 번에 모든 기능을 만들지 않는다.

권장 작업 단위:

```txt
1. DB migration
2. Supabase Auth SSR 유틸
3. 로그인 UI 최소 추가
4. 결과 저장 API
5. /my 대시보드
6. /my/check-in
7. rule-based routine generator
8. 검증 및 리팩터링
```

---

## 2.3 로그인 강제 금지

첫 진단 전에는 로그인을 요구하지 않는다.

권장 흐름:

```txt
홈 접속
→ 무료 진단 시작
→ 결과 확인
→ 결과 저장 CTA
→ 로그인
→ 결과 저장
→ /my 이동
```

비권장 흐름:

```txt
홈 접속
→ 로그인 요구
→ 진단 시작
```

---

## 2.4 AI 호출 최소화

매일 체크인 기능은 비용이 낮아야 한다.

MVP 원칙:

```txt
오늘 루틴 카드는 rule-based로 생성한다.
LLM 호출은 하지 않는다.
문장 품질 개선이 필요할 때만 추후 hybrid 방식으로 확장한다.
```

---

# 3. Phase 구조

## Phase 0. 사전 점검

목표:

```txt
현재 프로젝트 구조, Supabase 설정, 기존 결과 저장 흐름을 파악한다.
```

Codex가 먼저 확인할 파일:

```txt
package.json
.env.local.example 또는 환경변수 사용 지점
lib/supabase 관련 파일
lib/product-source.js
lib/skin-match-decision-engine.js
lib/face-lab-launch.js
app/layout.js
app/page.js
app/result/page.js
app/result/full-report/page.js
app/r/[shareId]/page.js
app/api/analyze/route.js
app/api/full-report/route.js
```

확인할 내용:

```txt
1. 현재 Supabase client 생성 방식
2. service role key 사용 위치
3. premium_report_sessions 사용 방식
4. result 페이지가 sessionStorage/localStorage/Supabase 중 무엇을 읽는지
5. full-report 페이지가 어떤 API 응답 구조를 기대하는지
6. 현재 products 테이블 FK 타입
7. 현재 Next.js App Router 구조
```

산출물:

```txt
수정 전 구조 요약
변경 예정 파일 목록
리스크 목록
```

---

## Phase 1. DB Migration

목표:

```txt
재방문 기능에 필요한 최소 테이블을 생성한다.
```

구현 대상:

```txt
profiles
skin_profiles
saved_reports
daily_checkins
routine_logs
```

후순위 테이블:

```txt
user_products
sos_logs
weekly_reports
```

Phase 1에서는 후순위 테이블을 만들 수는 있지만, UI 구현은 하지 않는다.

권장 migration 파일명:

```txt
supabase/migrations/YYYYMMDDHHMMSS_add_revisit_core_tables.sql
```

포함 내용:

```txt
1. profiles 생성
2. skin_profiles 생성
3. saved_reports 생성
4. daily_checkins 생성
5. routine_logs 생성
6. index 생성
7. RLS 활성화
8. RLS policy 생성
```

주의:

```txt
products 테이블은 이미 존재한다고 가정한다.
기존 products enum/check constraint를 건드리지 않는다.
premium_report_sessions는 삭제하지 않는다.
```

검증 SQL:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'profiles',
    'skin_profiles',
    'saved_reports',
    'daily_checkins',
    'routine_logs'
  );
```

---

## Phase 2. Supabase Auth SSR 구성

목표:

```txt
Next.js App Router에서 Supabase Auth 세션을 안전하게 읽고 쓸 수 있게 한다.
```

권장 패키지:

```txt
@supabase/supabase-js
@supabase/ssr
```

Codex 작업 전 확인:

```txt
package.json에 이미 설치되어 있는지 확인한다.
없으면 설치 명령을 제안한다.
```

설치 명령:

```bash
npm install @supabase/supabase-js @supabase/ssr
```

권장 파일 구조:

```txt
lib/supabase/browser.js
lib/supabase/server.js
lib/supabase/middleware.js
middleware.js
app/auth/callback/route.js
app/api/auth/signout/route.js
```

---

## 2.1 `lib/supabase/browser.js`

목적:

```txt
Client Component에서 사용할 browser client 생성
```

역할:

```txt
createBrowserClient 사용
NEXT_PUBLIC_SUPABASE_URL 사용
NEXT_PUBLIC_SUPABASE_ANON_KEY 사용
```

---

## 2.2 `lib/supabase/server.js`

목적:

```txt
Server Component, Route Handler에서 cookie 기반 Supabase client 생성
```

역할:

```txt
createServerClient 사용
cookies() 기반 세션 처리
server-side user 조회
```

주의:

```txt
service role key를 browser client에 절대 노출하지 않는다.
```

---

## 2.3 `lib/supabase/middleware.js`

목적:

```txt
middleware에서 세션 refresh 처리
```

역할:

```txt
request cookie 읽기
response cookie 갱신
Supabase auth session 유지
```

---

## 2.4 `middleware.js`

목적:

```txt
인증 세션 refresh 및 보호 라우트 제어
```

보호 대상:

```txt
/my
/my/check-in
/my/routine
/my/sos
/my/report/weekly
```

MVP 정책:

```txt
/my 이하 접근 시 로그인하지 않았다면 / 로 redirect
```

주의:

```txt
/result, /result/full-report, /r/[shareId]는 보호하지 않는다.
```

---

## 2.5 `app/auth/callback/route.js`

목적:

```txt
OAuth 로그인 이후 Supabase code exchange 처리
```

동작:

```txt
1. URL query에서 code 읽기
2. Supabase auth exchangeCodeForSession 실행
3. next 파라미터가 있으면 해당 경로로 이동
4. 없으면 /my로 이동
```

---

## 2.6 `app/api/auth/signout/route.js`

목적:

```txt
로그아웃 처리
```

동작:

```txt
1. server client 생성
2. supabase.auth.signOut()
3. / 로 redirect
```

---

# 4. Phase 3. 로그인 UI 최소 추가

목표:

```txt
결과 저장과 /my 접근을 위해 최소 로그인 진입점을 만든다.
```

권장 파일:

```txt
components/auth/LoginButtons.jsx
components/auth/UserMenu.jsx
```

---

## 4.1 LoginButtons

기능:

```txt
Google 로그인 버튼
추후 Kakao 로그인 버튼 확장 가능
```

MVP 우선순위:

```txt
1. Google OAuth 먼저 구현
2. Kakao OAuth는 후순위
```

Google 먼저 쓰는 이유:

```txt
개발/테스트가 빠르다.
Supabase 설정이 상대적으로 단순하다.
카카오는 한국 런칭 직전에 추가해도 된다.
```

버튼 동작:

```txt
supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${origin}/auth/callback?next=/my`
  }
})
```

주의:

```txt
실제 코드는 현재 프로젝트의 env/site url 유틸을 확인한 뒤 맞춘다.
```

---

## 4.2 UserMenu

기능:

```txt
현재 로그인 사용자 표시
/my 이동
로그아웃
```

노출 위치:

```txt
app/page.js 또는 공통 Header가 있으면 Header
/my 상단
```

---

# 5. Phase 4. 결과 저장 기능

목표:

```txt
비로그인 사용자가 무료 결과를 확인한 뒤, 로그인해서 결과를 저장할 수 있게 한다.
```

추가 API:

```txt
app/api/my/save-report/route.js
app/api/my/skin-profile/route.js
```

---

## 5.1 저장 CTA

대상 파일:

```txt
app/result/page.js
```

추가 UI:

```txt
결과 저장하기
내 피부 프로필로 저장하기
매일 루틴 점검하기
```

동작:

```txt
로그인 상태:
  /api/my/save-report 호출 후 /my 이동

비로그인 상태:
  로그인 버튼 표시 또는 로그인 페이지/모달 표시
  로그인 후 다시 저장 flow 실행
```

주의:

```txt
기존 유료 전환 CTA를 제거하지 않는다.
결과 저장 CTA는 유료 CTA와 경쟁하지 않게 배치한다.
```

권장 위치:

```txt
무료 결과 하단
또는 Top Pick 아래
또는 Full Report 유도 카드와 별도 카드
```

---

## 5.2 `/api/my/save-report`

메서드:

```txt
POST
```

역할:

```txt
1. 현재 로그인 user 조회
2. request body에서 result data 받기
3. skin_profiles에 핵심 진단 정보 저장
4. saved_reports에 원본 결과 저장
5. 저장된 skin_profile_id 반환
```

Request 예시:

```json
{
  "reportType": "free",
  "sourceType": "session",
  "sourceSessionId": "optional-session-id",
  "freeResult": {},
  "faceLab": {},
  "surveySnapshot": {},
  "photoAnalysis": {}
}
```

Response 예시:

```json
{
  "ok": true,
  "skinProfileId": "uuid",
  "savedReportId": "uuid"
}
```

실패 응답:

```txt
401: 로그인 필요
400: 저장할 결과 없음
500: 저장 실패
```

---

## 5.3 skin_profiles 저장 규칙

저장 전 처리:

```txt
같은 user_id의 기존 active skin_profiles를 is_active = false로 변경한다.
새 row를 is_active = true로 생성한다.
```

저장 필드 매핑:

```txt
skin_type ← result 또는 survey 기반
concerns ← result 또는 survey 기반
sensitivity_level ← survey/result 기반
skin_summary ← result summary
face_summary ← faceLab summary
preferences ← 선호 사용감/선크림 응답 등
photo_analysis ← 사진 분석 결과
survey_snapshot ← 설문 원본
result_snapshot ← 무료 결과 전체
```

주의:

```txt
필드명이 현재 결과 객체와 다를 수 있으므로 Codex는 실제 result object shape를 먼저 확인한다.
```

---

# 6. Phase 5. `/my` 대시보드

목표:

```txt
로그인 사용자가 재방문했을 때 자신의 피부 프로필과 오늘 루틴 상태를 확인한다.
```

추가 파일:

```txt
app/my/page.js
app/api/my/dashboard/route.js
components/my/MyDashboard.jsx
components/my/SkinProfileSummaryCard.jsx
components/my/TodayRoutineCard.jsx
components/my/TodayCheckInPrompt.jsx
```

---

## 6.1 `/api/my/dashboard`

메서드:

```txt
GET
```

역할:

```txt
1. 현재 user 조회
2. 최신 active skin_profile 조회
3. 오늘 daily_checkin 조회
4. 오늘 routine_log 조회
5. 최근 saved_report 조회
6. dashboard payload 반환
```

Response 예시:

```json
{
  "latestSkinProfile": {},
  "todayCheckin": {},
  "todayRoutine": {},
  "latestSavedReport": {},
  "hasProfile": true,
  "needsCheckIn": false
}
```

---

## 6.2 `/my` UI 상태

### 상태 A. 저장된 프로필 없음

표시:

```txt
아직 저장된 피부 프로필이 없습니다.
먼저 무료 진단을 진행해 주세요.
```

CTA:

```txt
무료 진단 시작하기
```

---

### 상태 B. 프로필 있음 + 오늘 체크인 없음

표시:

```txt
오늘 피부 상태를 체크하고 루틴을 조정해보세요.
```

CTA:

```txt
오늘 피부 체크하기
```

---

### 상태 C. 프로필 있음 + 오늘 체크인 있음 + 루틴 있음

표시:

```txt
오늘의 피부 상태
오늘 유지할 것
오늘 줄일 것
오늘 피할 것
AM 루틴
PM 루틴
```

---

# 7. Phase 6. 오늘 피부 체크

목표:

```txt
사용자가 매일 10초 이내로 피부 상태를 기록한다.
```

추가 파일:

```txt
app/my/check-in/page.js
app/api/my/check-in/route.js
components/my/DailyCheckInForm.jsx
lib/my/routine-generator.js
```

---

## 7.1 체크인 항목

MVP 항목:

```txt
dryness_level
oiliness_level
redness_level
breakout_level
irritation_level
makeup_today
outdoor_today
memo
```

입력 UI:

```txt
각 level은 0~4 선택
makeup_today, outdoor_today는 boolean
memo는 optional
```

권장 UX:

```txt
0 없음
1 약함
2 보통
3 강함
4 매우 강함
```

---

## 7.2 `/api/my/check-in`

메서드:

```txt
GET
POST
```

GET 역할:

```txt
오늘 checkin 조회
```

POST 역할:

```txt
1. 현재 user 조회
2. active skin_profile 조회
3. daily_checkins upsert
4. routine_logs 생성 또는 업데이트
5. 결과 반환
```

POST Response 예시:

```json
{
  "ok": true,
  "checkin": {},
  "routine": {}
}
```

---

## 7.3 중복 처리

원칙:

```txt
하루 1개의 checkin만 유지한다.
같은 날짜에 다시 제출하면 update/upsert한다.
```

기준:

```txt
unique(user_id, checkin_date)
```

---

# 8. Phase 7. Rule-based Routine Generator

목표:

```txt
daily_checkin + skin_profile 기반으로 오늘 루틴 카드를 생성한다.
```

추가 파일:

```txt
lib/my/routine-generator.js
```

함수 예시:

```js
export function generateDailyRoutine({ skinProfile, checkin }) {
  return {
    amRoutine: [],
    pmRoutine: [],
    keepItems: [],
    reduceItems: [],
    avoidItems: [],
    warnings: [],
    generationSource: 'rule'
  }
}
```

---

## 8.1 기본 규칙

### 붉은기/자극감 높음

조건:

```txt
redness_level >= 2
or irritation_level >= 2
```

결과:

```txt
avoid_items:
- 각질 패드
- 레티놀
- 비타민C
- 강한 클렌징

keep_items:
- 진정 세럼
- 장벽 크림
- 저자극 선크림
```

---

### 건조/당김 높음

조건:

```txt
dryness_level >= 2
```

결과:

```txt
reduce_items:
- 강한 클렌저
- 산뜻한 젤 크림만 단독 사용
- 과한 세안

keep_items:
- 보습 토너
- 장벽 크림
- 수분 세럼
```

---

### 유분 높음

조건:

```txt
oiliness_level >= 2
```

결과:

```txt
keep_items:
- 가벼운 수분 루틴
- 산뜻한 선크림

reduce_items:
- 무거운 크림 과다 사용
- 오일리한 제품 레이어링
```

---

### 트러블 높음

조건:

```txt
breakout_level >= 2
```

결과:

```txt
avoid_items:
- 새 제품 동시 테스트
- 과한 각질 제거
- 무거운 제형 과다 사용

keep_items:
- 진정 루틴
- 가벼운 보습
- 필요한 경우 스팟 케어
```

---

### 화장 예정

조건:

```txt
makeup_today = true
```

결과:

```txt
reduce_items:
- 밀림 위험 높은 제품 과다 레이어링
- 끈적한 선크림 과다 사용

keep_items:
- 얇은 보습
- 밀림 적은 선크림
```

---

### 야외 활동 예정

조건:

```txt
outdoor_today = true
```

결과:

```txt
keep_items:
- 선크림
- 필요 시 덧바름
- 저녁 세안 꼼꼼히
```

---

## 8.2 routine_logs 저장 형태

```json
{
  "am_routine": [
    {
      "step": "cleanser",
      "label": "가벼운 세안",
      "reason": "오늘은 당김이 있어 강한 세안보다 부드러운 세안을 우선합니다."
    }
  ],
  "pm_routine": [
    {
      "step": "moisturizer",
      "label": "장벽 크림",
      "reason": "붉은기와 자극감이 있어 장벽 회복 중심으로 마무리합니다."
    }
  ],
  "keep_items": ["진정 세럼", "장벽 크림", "선크림"],
  "reduce_items": ["각질 제품", "강한 클렌징"],
  "avoid_items": ["레티놀", "비타민C", "각질 패드"],
  "warnings": [
    {
      "type": "irritation_risk",
      "severity": "medium",
      "message": "오늘은 기능성 제품을 줄이는 것이 좋습니다."
    }
  ],
  "generation_source": "rule"
}
```

---

# 9. Phase 8. 홈 분기

목표:

```txt
로그인 사용자는 재방문 시 /my로 자연스럽게 이동한다.
```

대상 파일:

```txt
app/page.js
```

권장 방식:

```txt
server component에서 session/user 확인
로그인 상태면 redirect('/my')
비로그인 상태면 기존 랜딩 렌더링
```

주의:

```txt
기존 랜딩 UI와 metadata는 유지한다.
공유 metadata와 /r/[shareId]는 건드리지 않는다.
```

---

# 10. 후순위 Phase

## Phase 9. 내 제품 관리

추가 테이블:

```txt
user_products
```

추가 파일:

```txt
app/my/routine/page.js
app/api/my/products/route.js
components/my/UserProductsManager.jsx
```

MVP 기능:

```txt
제품 직접 입력
카테고리 지정
현재 사용 여부 저장
제품 DB 매칭은 optional
```

---

## Phase 10. 피부 SOS

추가 테이블:

```txt
sos_logs
```

추가 파일:

```txt
app/my/sos/page.js
app/api/my/sos/route.js
components/my/SosIssueSelector.jsx
```

MVP 기능:

```txt
문제 유형 선택
rule-based 대응 가이드 생성
sos_logs 저장
```

---

## Phase 11. 주간 리포트

추가 테이블:

```txt
weekly_reports
```

추가 파일:

```txt
app/my/report/weekly/page.js
app/api/my/weekly-report/route.js
```

MVP 기능:

```txt
최근 7일 daily_checkins 조회
checkin_count >= 2이면 요약 생성
반복 패턴 표시
```

---

# 11. 파일별 작업 목록

## 새로 추가할 가능성이 높은 파일

```txt
lib/supabase/browser.js
lib/supabase/server.js
lib/supabase/middleware.js
middleware.js

app/auth/callback/route.js
app/api/auth/signout/route.js

app/my/page.js
app/my/check-in/page.js

app/api/my/dashboard/route.js
app/api/my/save-report/route.js
app/api/my/skin-profile/route.js
app/api/my/check-in/route.js
app/api/my/routine-log/route.js

components/auth/LoginButtons.jsx
components/auth/UserMenu.jsx

components/my/MyDashboard.jsx
components/my/SkinProfileSummaryCard.jsx
components/my/TodayCheckInPrompt.jsx
components/my/TodayRoutineCard.jsx
components/my/DailyCheckInForm.jsx

lib/my/routine-generator.js

supabase/migrations/YYYYMMDDHHMMSS_add_revisit_core_tables.sql
```

---

## 수정 가능성이 높은 기존 파일

```txt
app/page.js
app/result/page.js
app/result/full-report/page.js
app/layout.js

lib/openai-env-diagnostics.js
lib/product-source.js
lib/skin-match-decision-engine.js
```

주의:

```txt
lib/product-source.js와 lib/skin-match-decision-engine.js는 가능하면 Phase 1에서 건드리지 않는다.
```

---

# 12. 환경변수

필수:

```txt
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_SITE_URL
```

주의:

```txt
SUPABASE_SERVICE_ROLE_KEY는 서버 전용이다.
Client Component 또는 browser bundle에 노출되면 안 된다.
```

OAuth 설정 시 확인:

```txt
Supabase Auth Provider 설정
Google OAuth Client ID/Secret
Site URL
Redirect URLs
```

권장 Redirect URL:

```txt
http://localhost:3000/auth/callback
https://실서비스도메인/auth/callback
```

필요 시 wildcard:

```txt
http://localhost:3000/**
https://실서비스도메인/**
```

---

# 13. Codex 작업 프롬프트 초안

아래 프롬프트는 Phase 1-A 작업용이다.

```txt
docs/visualy-revisit-usecase.md와 docs/visualy-db-erd.md, docs/visualy-revisit-implementation-plan.md를 먼저 읽어라.

이번 작업 범위는 Phase 1-A DB migration만이다.

목표:
- 재방문 구조의 core tables를 생성한다.
- profiles, skin_profiles, saved_reports, daily_checkins, routine_logs를 만든다.
- 필요한 index를 추가한다.
- RLS를 활성화한다.
- 사용자별 데이터는 auth.uid() = user_id 또는 profiles.id 기준으로만 접근 가능하게 한다.
- 기존 products, premium_report_sessions, result/full-report/share 구조는 절대 변경하지 않는다.

작업:
1. 현재 supabase/migrations 폴더 구조를 확인한다.
2. 새 migration 파일을 생성한다.
3. docs/visualy-db-erd.md의 SQL 초안을 현재 DB와 충돌 없게 보정한다.
4. products FK가 필요한 작업은 Phase 2로 미루고 이번 migration에서는 건드리지 않는다.
5. SQL 문법 오류가 없도록 작성한다.

검증:
- npm run build가 가능하면 실행한다.
- Supabase migration 적용 명령은 직접 실행하지 말고, 사용자가 실행할 SQL/명령어를 알려준다.
- 변경 파일 목록과 주의사항을 요약한다.
```

---

# 14. 검증 명령어

Codex 작업 후 사용자가 실행할 수 있는 명령:

```bash
npm run build
```

가능하면:

```bash
npm run lint
```

Supabase CLI를 쓰는 경우:

```bash
supabase db diff
supabase db push
```

단, 사용자의 기존 환경에서 Supabase local/Docker 이슈가 있었으므로, 무조건 Supabase CLI 실행을 전제로 하지 않는다.

대안:

```txt
Supabase Dashboard SQL Editor에 migration SQL을 붙여 실행한다.
```

---

# 15. 기능 검증 시나리오

## 15.1 기존 기능 회귀 테스트

```txt
1. / 접속 가능
2. /onboarding 진입 가능
3. 무료 진단 완료 가능
4. /result 렌더링 가능
5. /result/full-report 접근 가능
6. /r/[shareId] 공유 페이지 접근 가능
7. npm run build 성공
```

---

## 15.2 로그인 테스트

```txt
1. Google 로그인 버튼 클릭
2. Supabase OAuth 이동
3. /auth/callback 복귀
4. /my 이동
5. 로그아웃 가능
```

---

## 15.3 결과 저장 테스트

```txt
1. 비로그인 상태로 무료 진단 완료
2. /result에서 결과 저장 클릭
3. 로그인
4. skin_profiles 생성 확인
5. saved_reports 생성 확인
6. /my에서 최신 프로필 표시
```

---

## 15.4 체크인 테스트

```txt
1. /my/check-in 접속
2. 5문항 입력
3. 저장
4. daily_checkins row 생성 확인
5. routine_logs row 생성 확인
6. /my에서 오늘 루틴 카드 표시
7. 같은 날짜 재제출 시 update/upsert 확인
```

---

## 15.5 RLS 테스트

```txt
1. 사용자 A로 데이터 생성
2. 사용자 B로 로그인
3. 사용자 A의 skin_profiles/daily_checkins 조회 불가 확인
```

---

# 16. 실패 방지 규칙

## 16.1 한 번에 하지 말 것

```txt
Auth + DB + /my + check-in + 제품 관리 + SOS + weekly report를 한 번에 구현하지 않는다.
```

---

## 16.2 먼저 만들지 말 것

```txt
커뮤니티
캘린더 UI
푸시 알림
출석체크
복잡한 제품 검색
리뷰 작성
랭킹 피드
AI 주간 리포트 자동 생성
```

---

## 16.3 기존 result 훼손 금지

```txt
/result는 기존 무료 결과 표시가 최우선이다.
저장 CTA 추가 때문에 기존 결과 렌더링이 깨지면 안 된다.
```

---

## 16.4 기존 Full Report 훼손 금지

```txt
/result/full-report는 기존 유료 리포트 흐름이 최우선이다.
저장 기능은 후킹으로 붙이고, 기존 렌더 구조를 전면 교체하지 않는다.
```

---

# 17. Phase 1 완료 기준

아래 조건을 모두 만족하면 Phase 1 완료로 본다.

```txt
1. DB core tables가 생성되어 있다.
2. RLS가 활성화되어 있다.
3. Supabase SSR client가 구성되어 있다.
4. Google 로그인/로그아웃이 가능하다.
5. /my 보호 라우트가 동작한다.
6. 비로그인 사용자는 기존처럼 진단할 수 있다.
7. 결과 저장 CTA가 추가되어 있다.
8. 로그인 사용자는 결과를 skin_profiles/saved_reports에 저장할 수 있다.
9. /my에서 최신 skin_profile을 볼 수 있다.
10. /my/check-in에서 오늘 피부 체크를 저장할 수 있다.
11. 체크인 후 routine_logs가 생성된다.
12. /my에서 오늘 루틴 카드가 보인다.
13. npm run build가 성공한다.
14. 기존 /result, /result/full-report, /r/[shareId]가 깨지지 않는다.
```

---

# 18. 최종 구현 순서 요약

```txt
1. 현재 구조 점검
2. DB migration 작성
3. RLS 적용
4. Supabase SSR client 구성
5. OAuth callback/signout 추가
6. Google 로그인 버튼 추가
7. /my 보호 라우트 추가
8. /api/my/dashboard 추가
9. /my 대시보드 최소 구현
10. /api/my/save-report 추가
11. /result 저장 CTA 추가
12. /api/my/check-in 추가
13. /my/check-in UI 추가
14. routine-generator 추가
15. routine_logs 저장
16. 회귀 테스트
17. build 검증
```

---

# 19. 다음 문서

이 Implementation Plan 이후 필요한 문서는 다음이다.

```txt
docs/visualy-revisit-codex-prompts.md
```

목적:

```txt
Codex에 넣을 작업별 프롬프트를 Phase 단위로 분리한다.
```

추천 프롬프트 분리:

```txt
Prompt 1. DB migration only
Prompt 2. Supabase Auth SSR setup only
Prompt 3. /my dashboard only
Prompt 4. result save flow only
Prompt 5. daily check-in + routine generator only
```
