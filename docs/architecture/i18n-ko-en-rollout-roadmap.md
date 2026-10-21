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

## M2. 분석·프리미엄·Face Lab 판단 의미 보존 (안전성 보수 진행 중)

- [x] `localizeFullReportForLocale`가 `fullRoutine.morning/night`, `routineVariants`, `avoidCombinations`을 영문 정형 문구로 덮어쓰지 않도록 차단. 원문 내러티브 또는 명시된 이중 언어 데이터만 사용.
- [x] `localizeRoutineStepsForEnglish`의 강제 `Every morning/night` 및 새 instruction/caution 생성 제거. 원문 빈도·주의사항·조건을 유지하며, 명시된 `en` 번역만 사용.
- [x] 영어 Top Pick·지원 상품의 원문 근거를 일반 템플릿으로 치환하지 않도록 차단. 기존 자유서술의 검증된 영문 번역 생성은 M3 이후 과제로 유지.
- [ ] 무료·프리미엄·Face Lab 각 섹터에서 한국어/영어로 동일한 추천·결정/보류·강도·횟수·경고 표시 확인.
- [x] `scripts/verify-i18n-face-lab-canonical.mjs`에 실제 Face Lab V2 생성 함수 KO/EN 대조 회귀 테스트 추가 (전체 상태, 목표 상태·키, 경로 ID·선택 상태, 도메인 상태, product handoff ID).
- [x] `style-delta`의 기존 한국어 고정 설명(스타일 변화 요약/현재 관찰 특징 보존 이유)을 화면 언어에 따라 현지화; 우선순위, 제약 상태, 행동 키는 변경하지 않음. 테스트는 유효한 스타일 경로가 실제 생성되는 경우를 요구.
- [x] 기존 Face Lab 결과가 한국어로 저장되어 영어 UI에 노출되면 원문 언어 안내 표시 (`PremiumFaceLabSection.jsx`), 원본 판단·문장 재생성 없음.
- [x] `scripts/verify-i18n-m2-fidelity.mjs`에 대표 사례(주 2회·상태 조건·중단 경고·원문 보존) 및 구조적 치환 금지 검증 추가.
- [ ] 전체 저장 페이로드·Face Lab·실사용자의 한국어/영어 의미 동등성 검증 완료.

**승인 기준:** 같은 canonical 판단을 두 언어로 표시할 때 결정 상태·순위·일정·주의사항이 같고, 원래 없던 지시를 추가하지 않아야 한다.

**M2 남은 일:** 기존 원문을 보존하는 것은 안전성 보수이지 완전 영어화가 아니다. 저장 당시 한국어 전용 안내는 현재 영어 화면에도 원문으로 남는다. 원어 안내/검증 번역 정책, 루틴과 Face Lab 실제 결과 페이로드의 의미 동등성은 별도 통과가 필요하다.

## M3. 저장 및 공유 데이터 다국어 처리

- [x] 저장 프리미엄 응답 `meta.sourceLocale`·`meta.displayLocale` 추가 (`meta.locale` 호환 유지). 저장 스냅샷은 수정하지 않음.
- [x] 무료 저장·공유 결과 DTO에 엄격한 `sourceLocale` 추가 (`ko`/`en`/`null`). 원본 locale이 없는 기록은 출처를 추측하지 않고 `null`로 전달하며 기존 `locale` fallback은 호환 유지 (`lib/analysis-results.js`).
- [x] 모바일 저장/공유 원문 안내는 무료 응답 `sourceLocale` 및 실제 한글 안내 감지 사용. 표시값만 바뀌며 공유 권한·기존 API 읽기 가드는 그대로 유지.
- [x] `app/api/full-report/route.js`의 저장 응답에서 sourceLocale과 요청 displayLocale을 구분하고, 저장 Top Pick 적합도 라벨은 표시 언어를 적용. 원본 판단·fingerprint/스냅샷 불변.
- [ ] 전체 리포트 중 언어에 따라 새 문장을 만드는 다른 표시 경로와 legacy 자유서술 번역 품질은 별도 검증.
- [x] 모바일 `NativeSavedReport.tsx` 및 `NativePublicResult.tsx`의 피부타입·코드형 고민·포함된 영문 상품명 우선 표시 구현. 자유서술은 원문 유지 및 안내 노출.
- [x] 모바일 Premium 상세의 `{ko,en}` 내러티브 필드를 선택 언어 우선으로 읽고 중복된 언어 텍스트를 나열하지 않도록 보완.
- [x] `NativeMyDiaryView.tsx`의 피부타입·고민·민감도 코드형 상태값을 검증된 KO/EN 레이블로 현지화. 사용자 자유입력 `memo`는 번역하지 않음.
- [x] `NativeSavedReport.tsx`/`NativePublicResult.tsx`의 코드형 피부타입·고민 표시값 KO/EN 현지화 (원문 자유서술은 그대로 유지).
- [x] 저장 당시 한국어가 확인되는 웹 프리미엄·모바일 저장/공유 리포트의 영어 화면에 원문 언어 안내 표시.
- [ ] 기존 저장 기록/신규 EN 저장/공유 링크/비로그인·타인 접근 제한 회귀 테스트.

**승인 기준:** 데이터 무결성/조회 권한 불변, 정확히 현지화할 수 없는 기존 기록은 원어 원문을 보존한다.

**M3 남은 일:** DB에 영문명 미포함 legacy 제품의 화면 처리, 기존 자유서술 영문 재표시 품질, 프로필 이외 진단 항목과 보안·공유 권한 실사용 회귀 검증은 미완료. 완료된 기반: 저장/공유 `sourceLocale` provenance, 구형 결과 한글 안내 감지, 레거시 한국어 피부 타입·고민 코드 정규화, 빈 번역 필드 원문 fallback.

## M4. 전 화면 번역 품질

- [x] 웹 현재 제품 선택의 KO에서 영문명 노출되는 문제 수정; EN에서만 공식 `brand_en`/`name_en` 우선. 이미 API가 제공하는 영문명에 대해 별도 브라우저 Supabase 재조회 제거.
- [x] 웹 무료 공유 리포트의 KO/EN 언어 전환(표시 UI만 변경·재조회/재분석 없음), 원문 한국어 분석 서술 안내 및 검증된 한국어 레거시 상태 레이블 번역.

- [ ] 웹·모바일 온보딩, 설문, 카메라, 무료 결과, 풀 리포트 허브, Face Lab, My, 다이어리, 공유, 계정, 동의, 에러·비활성 상태 문구 점검.
- [x] 영문 컬럼 누락 12개 제품(2026-10-21 점검 당시 176개 중 164개 영문명 보유) DB 실측·분류 및 공식 제조사 영문 표기 2건 확인: `docs/architecture/i18n-product-name-backfill-review-20261021.md`.
- [ ] 공식 표기 확인이 필요한 10건 추가 검토 후 운영 제품 파이프라인을 통한 조건부 display-only backfill 승인·실행·재검증. `category IS NULL` 10건은 번역과 별도로 검수.
- [x] 모바일 My·다이어리·최근 리포트의 캘린더 날짜/월 표기를 KO/EN 형식으로 전환. 날짜 키·정렬·체크인 조회에는 원래 값 사용, UTC 기반 날짜 밀림 방지 (`apps/mobile/lib/date-display-i18n.ts`).
- [ ] 나머지 화면의 날짜·시간·숫자 형식과 실기기 화면의 줄바꿈/오버플로 검사.
- [ ] 구매 링크/판매처 이름이 실제 지역 지원 여부를 허위로 암시하지 않도록 점검.

## M5. 릴리스 게이트

- [ ] 기존 모바일 `npm run mobile:typecheck`, `npm run verify:mobile-foundation` 및 관련 CI 확인
- [ ] 기존 `npm run verify:premium-browser-journey-contract` 및 회귀 검사 확인
- [ ] 신규 검증 `npm run verify:i18n-m1`, `npm run verify:i18n-m2`, `npm run verify:i18n-m3`, `npm run verify:i18n-m4`, `npm run verify:i18n-face-lab` 최신 커밋 기준 통과 확인 (기존 current-main health CI에 연결; 이전 커밋에서는 통과).
- [ ] 웹 KO→EN→KO, `savedReportId`, 로그인/권한/프리미엄 저장·재진입 실사용 확인
- [ ] Android/iOS 신규 설치와 재실행, 네이티브 영어 저장 결과/상품 선택 흐름 확인
- [ ] CI, 코드 리뷰 후 병합·배포·실기기 수락 테스트를 각각 별도 기록

## M6. 이후 언어 확장 (KO/EN 출시 이후)

- [ ] 3번째 언어는 사용자 유입·실제 수요·운영 지원 가능 국가의 데이터를 기준으로 선정한다. 일본어/중국어/베트남어 등 특정 언어를 근거 없이 선확정하지 않는다.
- [ ] 화면 문자열·코드형 상태 레이블을 `SupportedLocale` 확장 가능한 사전으로 관리하고, 자유서술/엔진 판단의 언어별 품질을 독립 평가한다.
- [ ] 언어별 상품 공식 명칭, 날짜 표기, 권한·개인정보 고지, 상점 링크 지원 지역을 각각 검수한다.
- [ ] KO/EN과 동일한 의미 보존/스냅샷 불변/사용자 여정 게이트 통과 전에는 신규 언어를 '완료'로 표시하지 않는다.

**진행 조건:** M1~M5 완료 + 우선 국가/언어 근거 확보. 단순 UI 번역 파일 추가만으로 언어 확장을 완료 처리하지 않는다.

## 진행 보고 형식

각 단계 완료 시 `수정한 내용 / 검증 결과 / 미해결 리스크 / 다음 단계`를 기록한다. 메인 반영 전 단계는 **PR 진행 중**으로 취급하며, 빌드 또는 실기기 확인이 없으면 완료로 표시하지 않는다.
