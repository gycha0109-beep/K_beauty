# Visuali MVP Manual QA Checklist

MVP release 전 수동 확인용 체크리스트다. 각 항목은 실제 브라우저, 모바일 뷰포트, Vercel 배포 URL에서 반복 확인한다.

## 1. 첫 진입 페이지

- 테스트 항목: 홈 첫 진입, 언어 전환, 테마 초기 렌더링
- 실행 방법: `/`, `/en`에 각각 접속하고 새로고침한다. 테마 토글과 시작 CTA가 정상 노출되는지 본다.
- 기대 결과: 초기 화면이 깨지지 않고 사진 업로드 단계로 자연스럽게 진입할 수 있다.
- 실패 시 의심 파일: `app/page.js`, `app/layout.js`, `components/ThemeToggle.jsx`, `components/onboarding/BottomCTA.js`
- 우선순위: P0

## 2. 사진 업로드

- 테스트 항목: 이미지 선택, 미리보기, 잘못된 파일 형식/용량 처리
- 실행 방법: JPEG/PNG/WEBP를 각각 업로드하고, 비이미지 파일과 큰 파일도 시도한다.
- 기대 결과: 정상 이미지는 미리보기가 표시되고 다음 단계로 갈 수 있다. 잘못된 파일은 사용자 오류 메시지를 보여준다.
- 실패 시 의심 파일: `components/onboarding/PhotoUploadStep.js`, `lib/upload-validation.js`, `app/api/analyze/route.js`, `app/api/face-reading/route.js`
- 우선순위: P0

## 3. 설문 진행

- 테스트 항목: 설문 step 이동, 필수 항목 검증, 상단 스크롤
- 실행 방법: 일부 항목을 비운 상태와 모든 항목을 채운 상태를 각각 테스트한다. 다음 step 이동 시 화면이 상단으로 스크롤되는지 확인한다.
- 기대 결과: 필수 응답 없이는 다음으로 진행되지 않고, 정상 입력 시 loading 단계까지 도달한다.
- 실패 시 의심 파일: `components/onboarding/SurveyFlow.js`, `components/onboarding/BasicSurveyStep.js`, `components/onboarding/ExtraSurveyStep.js`, `components/onboarding/constants.js`, `app/page.js`
- 우선순위: P0

## 4. 무료 분석 결과

- 테스트 항목: `/api/analyze` 성공 후 무료 결과 페이지 렌더링
- 실행 방법: 사진과 설문을 제출하고 `/result` 또는 `/en/result`로 이동되는지 확인한다.
- 기대 결과: Top Pick, 루틴 요약, 피부 요약, 사진 근거, 전체 리포트 CTA가 표시된다.
- 실패 시 의심 파일: `app/api/analyze/route.js`, `app/result/page.js`, `lib/skin-match-decision-engine.js`, `lib/recommendation-scoring.ts`, `lib/product-source.js`
- 우선순위: P0

## 5. Face Lab 결과

- 테스트 항목: Face Lab teaser와 full payload 저장
- 실행 방법: 분석 완료 후 무료 결과의 Face Lab preview를 확인하고, 풀리포트 Face Lab 탭까지 진입한다.
- 기대 결과: 무료 결과에는 teaser가 보이고, 풀리포트에는 확장 Face Lab 섹션이 표시된다.
- 실패 시 의심 파일: `app/api/face-reading/route.js`, `lib/face-lab-launch.js`, `app/page.js`, `components/result/FaceShapePreviewCard.jsx`, `app/result/full-report/page.js`
- 우선순위: P1

## 6. 공유 저장

- 테스트 항목: 결과 저장, 링크 복사, native share fallback
- 실행 방법: 결과 페이지에서 저장/공유 버튼을 누르고 Network 탭에서 `/api/results` 요청을 확인한다.
- 기대 결과: `shareId`가 생성되고 저장 완료 메시지 또는 공유 링크가 표시된다.
- 실패 시 의심 파일: `components/result/ResultShareActions.jsx`, `app/api/results/route.js`, `lib/analysis-results.js`, `lib/supabase/browser-client.js`, `lib/write-access-client.js`
- 우선순위: P0

## 7. 공유 링크 새 탭 확인

- 테스트 항목: `/r/[shareId]` 공개 공유 페이지
- 실행 방법: 복사된 공유 링크를 새 탭, 시크릿 창, 모바일 브라우저에서 연다.
- 기대 결과: 로그인/sessionStorage 없이 공유 카드가 렌더링되고 홈으로 돌아가기 버튼이 동작한다.
- 실패 시 의심 파일: `app/r/[shareId]/page.js`, `app/api/results/[shareId]/route.js`, `components/result/ResultShareCard.jsx`, `lib/analysis-results.js`
- 우선순위: P0

## 8. 새 분석 시작 시 이전 결과 혼입 방지

- 테스트 항목: stale cache 정리
- 실행 방법: 결과를 저장한 뒤 홈으로 돌아가 다른 사진/설문으로 새 분석을 실행한다. 공유 버튼, Face Lab, 풀리포트 메타가 이전 결과를 재사용하지 않는지 본다.
- 기대 결과: `skinTestShare`, 이전 Face Lab full payload, write-access token, 이전 full-report metadata가 새 결과와 섞이지 않는다.
- 실패 시 의심 파일: `app/page.js`, `components/result/ResultShareActions.jsx`, `lib/write-access-client.js`, `app/result/full-report/page.js`
- 우선순위: P0

## 9. 풀리포트 진입

- 테스트 항목: 무료 결과에서 full report CTA 이동
- 실행 방법: 무료 결과 마지막 단계에서 전체 리포트 버튼을 눌러 `/result/full-report` 또는 `/en/result/full-report`로 이동한다.
- 기대 결과: premium session 기반 리포트가 로드되고 Skin Match 탭과 Face Lab 탭이 표시된다.
- 실패 시 의심 파일: `app/result/page.js`, `app/api/full-report/route.js`, `app/result/full-report/page.js`, `lib/premium-report-session.js`
- 우선순위: P0

## 10. 풀리포트 새로고침

- 테스트 항목: full report refresh/session 유지
- 실행 방법: 풀리포트 페이지에서 새로고침하고, 잠시 후 다시 접속한다.
- 기대 결과: premium cookie/session이 유효한 동안 리포트가 다시 로드된다. 만료 시에는 명확한 재분석 안내가 표시된다.
- 실패 시 의심 파일: `app/api/full-report/route.js`, `lib/premium-report-session.js`, `app/result/full-report/page.js`
- 우선순위: P1

## 11. 모바일 화면 확인

- 테스트 항목: 360px, 390px, 430px 폭에서 핵심 플로우
- 실행 방법: DevTools 모바일 뷰포트와 실제 휴대폰에서 홈, 설문, 결과, 공유 페이지, 풀리포트를 확인한다.
- 기대 결과: 버튼이 화면 밖으로 밀리지 않고, 카드/CTA/탭/공유 버튼이 터치 가능하다.
- 실패 시 의심 파일: `app/page.js`, `app/result/page.js`, `app/result/full-report/page.js`, `components/onboarding/*.js`, `components/result/*.jsx`
- 우선순위: P1

## 12. 다크/라이트 테마 확인

- 테스트 항목: 테마 토글과 저장된 테마 상태
- 실행 방법: 라이트/다크를 전환한 뒤 홈, 결과, 공유, 풀리포트 페이지를 새로고침한다.
- 기대 결과: 텍스트 대비가 유지되고 카드 배경, 버튼, 입력 UI가 읽기 어렵지 않다.
- 실패 시 의심 파일: `components/ThemeToggle.jsx`, `app/layout.js`, `app/result/page.js`, `app/result/full-report/page.js`, `tailwind.config.js`
- 우선순위: P2

## 13. API 실패/fallback 상황 확인

- 테스트 항목: OpenAI 실패, API key 누락, upload validation 실패
- 실행 방법: 개발 환경에서 OpenAI key를 제거하거나 네트워크 실패를 유도하고 분석/Face Lab을 실행한다.
- 기대 결과: `/api/analyze`는 fallback notice와 함께 무료 결과를 유지하고, `/api/face-reading`은 `meta.source`가 fallback 계열로 내려온다.
- 실패 시 의심 파일: `app/api/analyze/route.js`, `app/api/face-reading/route.js`, `lib/openai-env-diagnostics.js`, `lib/photo-evidence.js`
- 우선순위: P1

## 14. Supabase 저장 확인

- 테스트 항목: `analysis_requests`, `analysis_results`, `result_json`, `user_id`, `share_id`
- 실행 방법: 공유 저장 후 Supabase SQL Editor/Table Editor에서 최신 row를 확인한다.
- 기대 결과: `analysis_requests`와 `analysis_results`가 생성되고, `analysis_results.result_json`에 `schemaVersion`, `generatedAt`, `source`, `locale`, `result`, `submission`이 있다.
- 실패 시 의심 파일: `app/api/results/route.js`, `lib/analysis-results.js`, `lib/supabase/server-client.js`, `lib/supabase-admin.js`, `supabase/migrations/*`
- 우선순위: P0

## 15. 배포 환경 Vercel 확인

- 테스트 항목: production env, route 동작, cookie/header, static/dynamic pages
- 실행 방법: Vercel 배포 URL에서 전체 플로우를 1회 실행하고, Network 탭에서 `/api/analyze`, `/api/face-reading`, `/api/results`, `/api/full-report` 상태 코드를 확인한다.
- 기대 결과: 환경변수 누락 없이 분석/저장/공유/풀리포트가 동작하고, `x-kbeauty-write-token`과 premium report cookie 흐름이 정상이다.
- 실패 시 의심 파일: `next.config.js`, `app/api/analyze/route.js`, `app/api/full-report/route.js`, `app/api/results/route.js`, `lib/premium-report-session.js`, `lib/supabase-admin.js`
- 우선순위: P0
