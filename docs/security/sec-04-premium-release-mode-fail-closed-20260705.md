# SEC-04 Premium release mode fail-closed 보정

## 1. 기존 fail-open 원인

기존 `lib/premium-access.js`는 `PREMIUM_RELEASE_MODE`를 `beta_open`, `paid_only` 중 하나로만 인정하면서 누락, 빈 값, 알 수 없는 값을 모두 `beta_open`으로 반환했다. 따라서 production 설정 누락이나 오타가 signed-in account user의 premium 생성 허용으로 이어질 수 있었다.

## 2. 실제 release mode 경로

* `lib/premium-access.js`: 환경변수 해석, entitlement 판정, 사용자별 premium access source of truth
* `app/api/premium/access/route.js`: client CTA가 조회하는 access-status API
* `app/api/full-report/route.js`: 신규 premium report 생성 및 session update 전 server-side guard
* `app/api/analyze/route.js`: free analysis 후 premium session 생성 전 guard
* `app/result/page.js`, `components/result/free-v2/FreeResultV2PremiumPreviewStep.jsx`: 무료 결과 CTA 표시 정합성
* `app/result/full-report/page.js`: `premium_unavailable` 차단 화면 처리

이미 저장된 premium report의 재열람은 `saved_reports.user_id` owner check로 처리되며, 현재 premium 생성 entitlement와 분리된 기존 정책을 유지한다.

## 3. 허용 mode 목록과 새 동작

| 입력 mode | access 결과 | premium session 생성 |
| --- | --- | --- |
| `coming_soon` | 차단, `premium_unavailable` | 차단 |
| `beta_open` | 기존 beta 정책 유지: signed-in non-anonymous user 허용 | 기존 pre-login session preparation 유지 |
| `paid_only` | `paid` 또는 `admin_override` entitlement만 허용 | entitlement가 있는 경우만 허용 |
| 누락, `null` 상당, 빈 값, 공백, 알 수 없는 값 | 차단, `premium_unavailable`, `configurationInvalid: true` | 차단 |

문자열은 `trim()`만 적용한다. 대소문자 변환이나 client-provided mode 값은 허용하지 않으며, 환경변수가 server-side source of truth다.

## 4. server-side 차단 위치

`/api/full-report`는 saved report 재열람 분기 뒤, 신규 생성 또는 session update 전에 공통 access resolver를 확인한다. 설정 오류 또는 `coming_soon`이면 403과 `premium_unavailable`만 반환하며, 내부 환경변수명이나 raw mode는 반환하지 않는다.

`/api/analyze`는 무료 분석의 기존 결과 계약을 유지한다. 다만 premium session DB write 직전에 공통 resolver 결과를 확인해 configuration-invalid, `coming_soon`, `paid_only` entitlement 부재에서는 session을 만들지 않는다. 무료 분석 자체와 AI 호출은 premium 설정 때문에 차단하지 않는다.

## 5. client 표시 정합성

무료 결과 화면은 `/api/premium/access`를 no-store로 조회한다. 설정 오류 또는 `coming_soon`이면 premium CTA를 disabled 상태와 unavailable copy로 표시하고, full-report route도 같은 unavailable 화면으로 이동한다. `beta_open`과 `paid_only`의 기존 CTA/login/payment-required 흐름은 유지한다.

## 6. 환경변수 운영 계약

이 저장소에는 `.env.example` 또는 별도 환경변수 문서가 없으므로, 이 문서가 `PREMIUM_RELEASE_MODE` 계약을 기록한다.

* production에는 `PREMIUM_RELEASE_MODE`를 명시적으로 설정한다.
* 허용값은 `coming_soon`, `beta_open`, `paid_only`다.
* 누락, 빈 값, 공백, 알 수 없는 값은 fail-closed다.
* `beta_open`은 반드시 명시적으로 설정해야 한다.
* `paid_only`는 환경변수만으로 entitlement를 부여하지 않으며, trusted Supabase `app_metadata` entitlement 검증을 계속 요구한다.

배포 전 hosting 환경의 값이 의도한 허용 mode 중 하나인지, 설정 누락 알림이 존재하는지 확인한다. 실제 production 값이나 secret은 이 문서에 기록하지 않는다.

## 7. 테스트 및 검증

`scripts/verify-premium-release-mode.mjs`는 실제 helper의 pure release-mode 구간을 실행해 다음을 확인한다.

* `undefined`, `null`, 빈 값, 공백, unknown mode는 모두 차단된다.
* `coming_soon`은 차단된다.
* `beta_open`의 account-user 접근과 `paid_only`의 paid entitlement 접근은 유지된다.
* `paid_only` entitlement 부재와 invalid mode는 premium session 생성도 허용하지 않는다.
* `/api/full-report`, `/api/analyze`, result CTA, full-report unavailable UI의 정적 guard 연결이 존재한다.

실행 결과는 `node scripts/verify-premium-release-mode.mjs` 통과, `node --check`로 수정한 server JS와 verifier syntax 통과, `npm run build` 통과, `git diff --check` 통과다. missing mode case는 raw 값 없이 `[premium-access] premium_release_mode_invalid` 구성 오류 코드만 한 번 기록한다.

## 8. 제외 범위

결제 연동, DB migration, Supabase RLS/policy, premium saved report payload 출처 보정, SEC-05 anonymous write token resource binding/replay 방지, 실제 production/Supabase/OpenAI 호출은 포함하지 않는다.
