# TRUST P3 PR-B — 엄격한 HTML 계층 기반 상품 영역 판별기 v1

기준: `docs/architecture/trust-p3-template-family-adapter-design-v1.md`, 실측 `evidence/trust/p3-root-colocation-live-20261013.json`.

## 구현 범위
- `lib/trust/official-primary-root-dom-p3-v1.mjs`: bounded, strict nested-tag structural parser. 상품 마커가 있는 루트(없으면 유일한 main), 해당 루트 안의 상품명 표제, 같은 루트 하위 상품 구매 form/option control의 실제 조상-자손 관계를 검사.
- `scripts/trust-p3-official-locator-revalidation.mjs`: 기존 robots-first 6 URL read-only runner에 `strictPrimaryRoot` 추가. 기존 P3 `candidate.gate` 변경 없음.
- `scripts/verify-trust-p3-strict-dom-primary-root-v1.mjs`: 교차판매, 별도 폼, 중복 루트, script/OG, 틀린 이름, malformed HTML, 긴 태그, 과도한 노드, 중첩 태그, 임의 데이터 유출 테스트.
- 기존 TRUST CI에서 검사. 새 workflow, 크롤링 대상, 권한 및 dependency 추가 없음.

## 보수적 범위 및 한계

이 구현은 **엄격한 HTML 계층 파서**로, HTML5 브라우저의 implied closing, foster parenting 등의 복구 규칙을 구현하지 않는다. 따라서 브라우저에서 표시되는 일부 공식 사이트도 `UNBALANCED_HTML` 등으로 보류될 수 있다. 파싱 가능하다고 하더라도 **exact SKU나 market/formulation 검증은 아니다**.

긴 start tag, 파싱 오류, 암묵적 닫힘이 필요한 HTML, 지나치게 많은 후보 영역/표제는 fail-closed. 기존 2MiB total source limit, 512KiB bounded skip limit, 20k node/tag bound, 512 depth and 128 candidate root/title bounds를 적용. Source HTML/상품명/옵션 텍스트/DOM 속성값은 결과 파일에 저장하지 않는다. Product catalog names are used only for transient equality checks.

- `SCOPED_NAME_AND_FORM_CANDIDATE`는 공식 페이지 *구조에서* 특정 카탈로그명 표제와 상품 폼이 단일 루트에 함께 있다는 **비권한 진단**이다.
- 별도 구매 폼, related/upsell 영역, external form association, 두 독립 상품, OG/JSON-LD only, script-only, 옵션이 동적으로 렌더되는 페이지는 HOLD.
- 동일 루트 내 select의 **실제 선택된 규격**을 확인하지 않았으므로 Product Fact, primary SKU, market/formulation, source binding, Subject, recommendation을 자동 변경하지 않는다.
- `primaryRootAuthority=false`, `exactSkuVerified=false`, `sourceBindingAuthorized=false`, `subjectCreationAuthorized=false`, `factConfirmationAuthorized=false`, `dbWrites=0`, `aiApiCalls=0`는 출력 시 상수다.

## 검증·다음 단계

합성 fixture의 positive/negative는 파서의 제한된 계층 판별만 검증하며 실제 공식몰 검증률 개선의 근거가 아니다. PR checks TRUST, PIE, Main Health, CodeQL 초록색 확인 후 `P3-LOCATOR-LIVE-TRIAL` 1회, 공식 6 URL / 4 origins에 한정해서 실행하고 결과 증거를 동결한다.

실제 HTML에서 `UNBALANCED_HTML`이 발생하면 이를 허용으로 완화하지 말고, 검증된 HTML5 DOM tree parser 도입 여부를 공급망 보안 검토 후 별도 PR로 판단한다. 실제 selected 40ml vs 25ml, URL/시장/제형 동일성은 향후 PR-C 범위다. 기존 공급망 취약점 검사 실패는 우회하지 않는다.
