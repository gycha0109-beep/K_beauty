# TRUST P3 PR-C — 동일 상품 구매 폼의 명시적 선택 용량 Shadow v1

## 왜 지금 진행하는가
PR-B strict DOM은 정적 HTML에서 상품명과 같은 상품 루트의 구매 폼을 검사하지만, 공식몰 실측에서 3/4 HTML은 현재 HTML5 파서 한계로 HOLD 상태다. 표준 HTML5 파서는 별도 보안 PR에서 검증되어야 하며, `braces`·`node-forge` 취약 경로에 대한 B1–B3 보안 작업은 아직 **release HOLD**다.

PR-C는 공급망 보안 트랙의 실제 교체를 우회하지 않고, 이미 엄격하게 검증된 테스트용 HTML 계층에서 **정적으로 명시된 선택 용량**만 검사하는 재사용 가능한 순수 함수를 준비한다. 이것은 제품별 selector 예외가 아니다.

## 판정 조건
- 이전 PR-B의 `SCOPED_NAME_AND_FORM_CANDIDATE`를 통과하고 동일 루트에 하나의 구매 form이 존재할 때만 호출한다.
- 해당 form 안에서 `size/volume/capacity/용량/사이즈` 의미가 명확한 select 또는 한 radio group만 검토한다. 폼 외부, 추천/리뷰, script/OG/JSON-LD, sibling 상품의 선택값은 버린다.
- 명시적인 `selected` 옵션 1개 또는 `checked` radio 1개만 인정한다. 옵션 첫 번째 항목의 브라우저 기본값은 근거가 아니다.
- hidden/disabled/aria-disabled/aria-hidden 또는 disabled fieldset의 선택값, 두 개 이상의 용량 control group, 복수 선택, no selection은 모두 HOLD.
- 정적 value와 visible option text의 용량이 다르면 HOLD. 하나의 값에서 25ml/40ml 등 복수 용량을 발견해도 HOLD.
- g/kg/L와 mL 혼동, 2개 묶음, 1+1, 세트·증정 구성은 HOLD.
- 결측·오류·초대용량 구조는 fail closed. 원문 선택값/HTML/상품명은 결과에 기록하지 않는다.
- catalog expected 40ml와 static 선택 40ml가 일치하더라도 `SELECTED_SIZE_MATCH_SHADOW_ONLY`라는 **비승인 표시**일 뿐이다. 상품 동일성/시장/제형/SKU를 확인하거나 `EVIDENCE_CANDIDATE_ONLY`로 승격하지 않는다.

## 범위
- 신규: `lib/trust/official-selected-size-shadow-p3-v1.mjs`, `scripts/verify-trust-p3-owned-selected-size-shadow-v1.mjs`.
- `lib/trust/official-primary-root-dom-p3-v1.mjs`는 기존 `SCOPED_NAME_AND_FORM_CANDIDATE` 진단에만 `selectedVariantShadow`를 첨부한다. Strict parser 자체, old P3 product extraction and review gates do not change.
- Canonical `.github/workflows/trust-phase5b-7d-static.yml`에서 synthetic critical negative tests를 실행한다.
- 새 의존성/워크플로/원격 수집 대상·robots bypass, automatic Subject/Fact/Source/DB/recommendation write 및 AI API 호출 모두 0.

## 실측 조건과 종료 판정
- PR exact-head TRUST/PIE/CodeQL/Main Health green을 확인한 다음, 기존 `P3-LOCATOR-LIVE-TRIAL`을 한 차례 실행해 고정된 6 공식 URL 중 실제 HTML4/HOLD2 현황과 오류를 재측정한다.
- PR-C에서 실측 `SELECTED_SIZE_MATCH_SHADOW_ONLY`가 0이어도 구현 자체가 실패라는 의미는 아니다. ROOT HOLD가 선행되면 값은 **not evaluated**다.
- 표준 HTML5 DOM 지원은 **공급망 보안 게이트 통과 이후** 별도 PR로 진행한다. Actual source/variant/market/formulation authority는 다음 검증 단계에서만 논의한다.
