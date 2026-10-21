# BEJEWELY 다국어화 로드맵 (웹 + 네이티브 앱)

> 기준: 2026-10-21 · 지원 언어: ko/en · 개발 트랙: frontend-integration
>
> 이 문서의 **완료 상태는 main 배포 상태가 아니라 이 문서가 포함된 PR 브랜치의 구현 상태**를 기준으로 기록한다. PR 병합, CI 통과, 실기기 검증은 별도 완료 조건이다.

## 원칙 및 비범위

1. 분석·추천·Face Lab의 **canonical 판단/제품 ID/스냅샷은 번역 때문에 바뀌지 않는다.**
2. `sourceLocale`(저장/생성 언어), `displayLocale`(현재 UI), `canonical decision`(언어와 무관한 판단)을 구분한다.
3. 검증된 코드/번역이 없는 과거 한국어 자유서술문을 영어로 임의 재판단하거나 새 루틴 문장으로 치환하지 않는다. 번역 불가 문구는 원어 표시와 안내가 허위 현지화보다 안전하다.
4. 새 번역 시스템/외부 실시간 번역 API/데이터베이스 이중화/추천 엔진 개편/화면 전체 재설계는 수행하지 않는다.
5. CI Watchtower Track Key: `frontend-integration`; 새 workflow 대신 기존 CI의 검사 경로를 우선 사용한다.

## M1. 표시 기반 및 언어 선택 안정화 (구현 착수)

- [x] 현재 제품 목록 API에서 `name_en`, `brand_en` 반환: `lib/product-source.js` → `app/api/current-products/products/route.js`
- [x] 네이티브 상품 선택에서 `en` 시 영문명 우선/원어명 fallback; 제품 선택은 계속 `id` 기준: `premium-client.ts`, `NativeCurrentProductsSelector.tsx`
- [x] 네이티브 언어 수동 선택을 기존 `expo-secure-store`에 저장·복구: `mobile-shell.tsx`
- [x] 웹 프리미엄 저장 리포트 언어 변경 시 `savedReportId` 전달: `app/result/full-report/page.js`
- [ ] 기존 공통 CI/타입검사 통과 확인
- [ ] 실제 Android/iOS 재실행 후 언어 선택 유지 확인

**승인 기준:** API 필드와 데이터 계약이 맞고, KO/EN 상품 선택 모두 동일 `productId`를 제출하며, 저장 결과 언어 전환은 동일 `savedReportId`를 참조해야 한다.

## M2. 분석·프리미엄·Face Lab 판단 의미 보존 (다음 단계)

- [ ] `app/result/full-report/page.js`의 `localizeFullReportForLocale` 전수 점검. 현재 `fullRoutine.morning/night`, `routineVariants`, `avoidCombinations`이 영문 정형 문구로 대체될 수 있다.
- [ ] `localizeRoutineStepsForEnglish`의 `frequency`를 일괄 `Every morning/night`로 바꾸는 동작 제거. 주 2회/보류/미사용 등의 제약을 원본과 동등하게 보존한다.
- [ ] `buildEnglishTopPickDetailedReason`, `localizeSupportingProductsForEnglish` 등 템플릿 대체 로직을 원본 판단 구조 및 언어별 정식 문구에 연결.
- [ ] 무료·프리미엄·Face Lab 각 섹터에서 한국어/영어로 동일한 추천·결정/보류·강도·횟수·경고 표시 확인.
- [ ] 한국어 누출 탐지뿐 아니라 **의미/빈도/주의사항/제품 ID 불변 검증** 추가.

**승인 기준:** 같은 canonical 판단을 두 언어로 표시할 때 결정 상태·순위·일정·주의사항이 같고, 원래 없던 지시를 추가하지 않아야 한다.

## M3. 저장 및 공유 데이터 다국어 처리

- [ ] 저장 결과 조회 시 `sourceLocale`과 `displayLocale`을 명확히 구분.
- [ ] `app/api/full-report/route.js`의 `buildSavedPremiumReportResponse`는 현재 저장 언어를 우선하므로 표시 언어 별도 계약과 표시단 projection 필요. 저장 snapshot 재작성/재판단 금지.
- [ ] 모바일 `NativeSavedReport.tsx` 및 `NativePublicResult.tsx`의 자유서술/피부타입/제품명 표시 정책 통일.
- [ ] `NativeMyDiaryView.tsx`의 피부타입·고민·민감도 등 코드형 상태값 번역. 사용자 자유입력 `memo`는 번역하지 않음.
- [ ] 기존 저장 기록/신규 EN 저장/공유 링크/비로그인·타인 접근 제한 회귀 테스트.

**승인 기준:** 데이터 무결성/조회 권한 불변, 정확히 현지화할 수 없는 기존 기록은 원어 원문을 보존한다.

## M4. 전 화면 번역 품질

- [ ] 웹·모바일 온보딩, 설문, 카메라, 무료 결과, 풀 리포트 허브, Face Lab, My, 다이어리, 공유, 계정, 동의, 에러·비활성 상태 문구 점검.
- [ ] 영문 상품명 없는 12개 제품(2026-10-21 점검 당시 176개 중 164개 영문명 보유) 공식 표기와 카테고리 검수 후 보완. 무근거 기계 번역 금지.
- [ ] 날짜·시간·숫자 표기 및 작은 화면의 줄바꿈/오버플로 검사.
- [ ] 구매 링크/판매처 이름이 실제 지역 지원 여부를 허위로 암시하지 않도록 점검.

## M5. 릴리스 게이트

- [ ] 기존 모바일 `npm run mobile:typecheck`, `npm run verify:mobile-foundation` 및 관련 CI 확인
- [ ] 기존 `npm run verify:premium-browser-journey-contract` 및 회귀 검사 확인
- [ ] 신규 정적 보완 검증 `npm run verify:i18n-m1` 확인
- [ ] 웹 KO→EN→KO, `savedReportId`, 로그인/권한/프리미엄 저장·재진입 실사용 확인
- [ ] Android/iOS 신규 설치와 재실행, 네이티브 영어 저장 결과/상품 선택 흐름 확인
- [ ] CI, 코드 리뷰 후 병합·배포·실기기 수락 테스트를 각각 별도 기록

## 진행 보고 형식

각 단계 완료 시 `수정한 내용 / 검증 결과 / 미해결 리스크 / 다음 단계`를 기록한다. 메인 반영 전 단계는 **PR 진행 중**으로 취급하며, 빌드 또는 실기기 확인이 없으면 완료로 표시하지 않는다.
