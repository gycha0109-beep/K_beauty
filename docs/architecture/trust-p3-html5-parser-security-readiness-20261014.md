# TRUST P3 — HTML5 파서 도입 보안·구조 적합성 결정서 (2026-10-14)

## 1. 확인된 사실

- 근거: `evidence/trust/p3-attribute-failures-live-20261014.json`, GitHub Actions [38495005152](https://github.com/gycha0109-beep/K_beauty/actions/runs/38495005152), Artifact `11863513204`.
- 로봇/출처 제한을 지킨 공식 URL 6건 중 HTML 수집 4건, 접근 차단 2건. 현재 P3 검토 후보 0건, 실제 SKU 확정 0건.
- 신형 strict DOM parser: `AMBIGUOUS_ATTRIBUTES` 3건(기존 토리든 `DIV` 4번째 속성 `UNSUPPORTED_ATTRIBUTE_SYNTAX`, 기존 에스트라 `OTHER` 3번째 속성 같은 유형, 국제 에스트라 `OTHER` 5번째 속성 `DUPLICATE_ATTRIBUTE_NAME`).
- 토리든 대체 URL은 완전 파싱 가능하지만 `PRIMARY_ROOT_NOT_PROVEN`. HTML5 파서 변경만으로 상품명/소유 구매 폼이 입증된다고 가정할 수 없다.
- 모든 Source/Subject/Fact/Recommendation/DB 쓰기 및 AI API 호출 0건. raw HTML/원문 속성 문자열 보관 없음.

## 2. 현재 파서의 한계

`official-primary-root-dom-p3-v1.mjs`는 엄격한 중첩/속성 파서이지 WHATWG HTML5 tree builder가 아니다. HTML5는 중복 속성의 오류 회복, 암묵적 종료 및 태그 컨텍스트에 따른 DOM 재구성 규칙을 갖는다. 따라서 strict parser가 중단된 사실만으로 공식 사이트가 잘못되었다고 단정하지 않는다. 반대로 DOM을 더 잘 구성해도 **대표 판매 상품·브랜드·시장·제형·선택 규격을 입증하지 않는다**.

현재 실제 실행에서 표준 HTML5 DOM 해석의 유용성을 검증할 근거는 충분하다(3개 속성 parsing HOLD). **자동 권한 채택**의 충분 조건은 아니다. 프로젝트별 상품 하드코딩도 금지한다.

## 3. 후보 패키지 평가 — 비설치

| 항목 | 결과 |
|---|---|
| 후보 | `parse5@8.0.1` (현재 조사 기준) |
| 범주 | WHATWG HTML5 tree parser |
| 라이선스 | MIT |
| npm dependency | `entities` 1개 |
| 공개 취약점 정보 | Snyk package 페이지에 현재 버전의 알려진 취약점 없음(저장소 보안 검사 통과 의미 아님) |
| 현재 `package-lock.json` | parse5 / entities 잠금 항목 없음 |
| 본 PR에서 dependency/lockfile 변경 | **없음** |

외부 참고:
- https://www.npmjs.com/package/parse5
- https://parse5.js.org/modules/parse5.html
- https://security.snyk.io/package/npm/parse5

공식몰 raw HTML을 artifact에 저장하지 않는 기존 정책 때문에 이번 단계에서는 실제 원문을 외부 분석 도구에 복제하지 않는다. 필요한 경우 robots-gated, first-party, 메모리 내부의 **동일 실측 runner**에 대해서만 플러그인 적용을 검토한다.

## 4. 현재 저장소 보안 게이트 — BLOCKED

2026-10-14 `BEJEWELY Supply Chain Security` 잠금 경로 검사:
- `apps/mobile -> expo -> @expo/cli -> @expo/metro-file-map -> micromatch@4.0.8 -> braces@3.0.3` (GHSA-vfj7-8cjw-p6xm). 기존 임시 예외 2026-10-10 UTC 만료로 production 보안 검사 실패.
- `apps/mobile -> expo -> @expo/cli -> node-forge@1.4.0` (GHSA-86w9-cpqp-85rv). 잠금 경로에 남아 있으며 임시 예외 만료일 2026-10-16 UTC.
- Advisory 기준으로 두 패키지의 현재 영향 버전에 대한 **패치 버전이 보고되지 않음**(2026-10-14 조사 시점). 잠금 의존성 경로의 접근 가능성이 곧 실제 실행 경로에서 공격 가능하다는 뜻은 아니다.
- 해당 CI는 유효한 보안 PASS가 아니며 `exception` 기간을 늘리거나 `npm audit`를 건너뛰어서 parser 도입을 허가할 수 없다.

보안 참고:
- https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
- https://github.com/advisories/GHSA-86w9-cpqp-85rv

**결정: parse5의 새 런타임 의존성/잠금 변경은 이 PR에서 보류.** 관련 보안 취약 경로는 원인 제거 또는 보안 책임자의 정식 remediation으로 해결하고, 깨끗한 CI에서 별도 기능 PR로 검증한다. 단순 취약점 예외 연장 금지.

## 5. 도입 시 필수 구현 계약

1. 순차 파이프라인 고정: 공식 출처/robots/동일 origin/SSR F/바이트 제한 검사 → 2MiB 이하 HTML 메모리 내부 HTML5 파서 → bounded node/depth/attrs → 유일한 대표 상품 영역 → 동일 루트의 정확한 catalog title → 동일 소유 폼의 **명시적 선택된** 용량 검사 → 검토 후보. 각 단계 미확정 시 보류.
2. DOM tree builder의 HTML5 오류 복구는 HTML root structure만 판단할 수 있게 하며, 중복 attribute/소유 불명/추천 카드/리뉴얼 및 market/formulation은 여전히 HOLD. parse5의 DOM 오류 복구 자체가 SKU authority가 되어서는 안 된다.
3. 크로스셀·리뷰·메뉴·related product·script/JSON-LD/OG·다른 폼의 속성이나 선택값을 현재 판매 상품으로 인정하지 않는다. `form=`으로 외부 연결된 요소는 검증된 소유권 경로가 없으면 보류.
4. 스크립트 실행, headless 브라우저, crawler restriction 회피, HTML 원문 또는 제품 식별값을 artifact에 저장하는 행위는 금지.
5. CodeQL, TRUST, PIE, Main Health, **Supply Chain Security**, lockfile integrity 모두 성공한 exact-head PR에 한해 실제 공식 URL 6개 read-only trial 진행. 필드 `exactSkuVerified=false`, `factConfirmationAuthorized=false`, `subjectCreationAuthorized=false` 보전.
6. 테스트는 현재 3개 parser failures와 synthetic duplicate attrs/unsupported directives/repaired HTML을 분리하고, **정상 루트와 실제 판매 variant가 모두 입증되기 전에는 candidate 승인 0**을 기본으로 검증한다.

## 6. 종료 판정

- **완료:** 비식별 속성 파싱 원인 식별, 정적 CI, 6개 공식 URL 재측정, parser 후보 및 공급망 보안 게이트 검토.
- **보류:** 표준 HTML5 파서 설치/운영 연결, 유일한 공식몰 상품 영역 및 선택된 SKU 승인, Fact/Subject 자동 변경.
- **다음 의존 작업:** 공급망 보안 owner의 실제 취약 경로 제거(우회 금지), 이후 HTML5 parser feasibility PR과 real source probe.
