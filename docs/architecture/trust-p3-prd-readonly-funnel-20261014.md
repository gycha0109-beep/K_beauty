# TRUST P3 PR-D0 — 비승인 관측 퍼널 통합 (2026-10-14)

## 범위
PR-A/PR-B/PR-C의 진단 결과를 기존 `scripts/trust-p3-official-locator-revalidation.mjs`에 **비승인 read-only stage**로 집계한다. 기존 `official-product-extraction-p3-v1.mjs`의 candidate gate, Fact/Subject/Source 등록, 추천 및 DB 저장 로직은 **수정하지 않는다**.

## 스테이지와 분모

`lib/trust/official-p3-readonly-funnel-v1.mjs`는 고정 enum만 출력한다.

| stage | 조건 |
|---|---|
| NOT_EXECUTED | PLAN_ONLY; 네트워크 요청 없음 |
| SOURCE_HOLD | robots/source/fetch 제한으로 공식 HTML 미확보 |
| ROOT_PARSER_HOLD | strict DOM 파싱 실패, 큰 HTML 등 |
| PRIMARY_ROOT_HOLD | HTML 파싱했으나 유일한 제품명 포함 상품 영역 미확정 |
| OWNED_FORM_HOLD | 제품명이 있어도 실제 구매 폼 소속 미확정 |
| SIZE_NOT_EVALUATED | 루트·폼은 적절하지만 선택 용량 검사 결과 없음 |
| SIZE_SELECTION_HOLD | 선택 누락/복수/사이즈 불일치/세트 등 |
| SELECTED_SIZE_MATCH_SHADOW_ONLY | 동일 폼의 명시적 선택과 카탈로그 용량 일치. **단독 승인 불가** |

최상위 `summary.readOnlyFunnel.denominators.officialLocators`는 검사한 URL 수, `htmlFetched`는 접근·출처 정책을 통과하여 HTML 획득한 URL 수다. 각 stage 값의 합은 `officialLocators`다. `primaryNameAndOwnedFormObserved`와 `explicitSelectedSizeMatchObserved`는 누적 관측 단계 수, `existingP3ReviewCandidates`는 **원래 P3 분류기 결과**라 구분해 기록한다. 새 판별기의 shadow 진단이 기존 review 후보 숫자를 변경할 수 없다.

출력에 raw HTML, 제품명, 선택값, DOM 속성, 원문 오류 문자열을 새로 포함하지 않는다. 모든 `policyEligibilityAuthorized`, `exactSkuVerified`, `sourceBindingAuthorized`, `subjectCreationAuthorized`, `factConfirmationAuthorized`는 `false`, writes/AI API 0. 루트나 옵션 정보가 불완전하면 그 원인의 HOLD 단계에서 중단한다.

## 검증
- 동형 상품 25/40ml 오선택, duplicate root, 미선택 option, 오염된 JSON/속성 주입, robots/policy blocked 및 offline fixture는 fail closed.
- 기존 `scripts/verify-trust-p3-official-locator-revalidation.mjs`의 6 URL 시나리오에서 이전 `productCandidates`의 결과와 불변성을 확인한다.
- canonical TRUST/PIE/Main Health/CodeQL 검증 뒤에만 한 번의 `P3-LOCATOR-LIVE-TRIAL`을 병합 커밋에서 실행해 read-only evidence 동결.
- 기존 공급망 B3–B7은 별도 Draft/HOLD 트랙으로 원래 보안 게이트를 우회하지 않고 관리. HTML5 parser 신규 설치/lock 변경 없음.

## 종료 게이트
PR-D0는 **안전한 진단/퍼널 통합**만 완료할 수 있다. 상품 영역 식별 성공률과 선택 옵션 검증률이 실제 공식몰에서 확인되기 전까지 PR-D의 새로운 candidate eligibility/팩트 반영 승인은 **HOLD**. `parse5` 등 새로운 DOM parser는 SCA 보안 복구 및 독립 검토 이후 별도 PR.
