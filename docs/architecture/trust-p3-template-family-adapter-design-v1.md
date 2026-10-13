# TRUST P3 — 공식 제품 상세페이지 템플릿 패밀리 어댑터 상세 설계 v1.0

- 상태: **DESIGN ONLY** (구현·배포 승인 아님)
- 기준 저장소 SHA: `812e39d995c0131212b3fb9fbef7dc2e415c0ecc`
- 범위: zero-AI-API-cost, first-party, read-only official product identity + selected variant candidate pipeline
- 기존 동결 측정: `evidence/trust/p3-selected-variant-live-20261013.json`, [Actions #38345355813](https://github.com/gycha0109-beep/K_beauty/actions/runs/38345355813)
- 선행 코드: `official-product-discovery-p2-v1.mjs`, `official-product-primary-variant-p3-v1.mjs`, `official-product-extraction-p3-v1.mjs`, `trust-p3-official-locator-revalidation.mjs`
- 권한: **SOURCE / SUBJECT / FACT / RECOMMENDATION AUTO-WRITE 금지**, 운영 DB 읽기 외 쓰기 금지, AI API 금지.

## 1. 문제 정의와 사실/추정 구별

기존 P3는 `<main>` 내부의 단일 상품명 표제와, 해당 영역의 유일하게 명시적으로 선택된 용량 옵션을 요구한다. 이 구조는 안전하지만 범용성이 제한된다.

실제 공개 공식 사이트 대상으로 6 URLs / 4 origins 검사: HTML fetch 성공 4건, Beauty of Joseon 2건 `SOURCE_BLOCKED`, 통과 후보 0건. Torriden 2개와 Aestura KR 1개는 `hasMainContent=false`. Aestura international 1개는 `hasMainContent=true`이나 `primaryTitleNameCandidate=false`, `NO_UNIQUE_SELECTED_SIZE`. **DOM 구조/JS 실행 방식, 해당 상품의 정확한 판매 SKU나 수식 변경 여부는 관찰만으로 미확정**이다. 서버에서 내려오는 HTML에 어떤 템플릿 마커가 있는지 추가 단일회 관측이 필요하다.

목표는 **판매몰/템플릿 패밀리별 재사용 어댑터** 개발이다. 제품 ID, 특정 상품명, goodsNo, 브랜드별 제품 용량에 따른 예외 통로를 만들지 않는다.

## 2. 실행 흐름 및 권한 격리

```text
Governed product/subject/source snapshot (read-only)
 → official URL candidate (historical source binding is NOT current SKU proof)
 → robots.txt / crawl-delay / same-origin / redirect / SSRF guard
 → capped HTML fetch (≤ 2 MiB, no raw HTML persisted)
 → bounded template-family shape inspector (non-authoritative)
 → deterministic profile selection, unknown/ambiguous => HOLD
 → unique product-primary root detection
 → isolated primary product title and selected variant signals
 → target name / unit / size / package consistency and hard-negative checks
 → REVIEW_CANDIDATE or explicit HOLD
 → existing P3 direct specification claim proposal (when eligible)
 → human or separately governed authority review (NOT auto Subject/Fact)
```

필수 경계:
- `SOURCE_BLOCKED`, `ROBOTS_UNAVAILABLE`, crawl-delay 불가, cross-origin/redirect, SSRF/unsafe URL은 즉시 HOLD. 검색 결과나 다른 세션으로 우회하지 않는다.
- OG/title/LD+JSON/스크립트에 이름이 있다고 primary scope로 간주하지 않는다. 별개의 1차 데이터 원천에 근거한 교차확인 자료일 뿐이다.
- 개인 상품에 맞춰 이름이나 용량을 복제하는 화이트리스트 금지. 한 템플릿의 규칙은 서로 다른 제품에서 일관되게 재현돼야 한다.
- 검증 후보 `EVIDENCE_CANDIDATE_ONLY`도 확정된 SKU가 아니다. `exactSkuVerified=false`, `marketVerified=false`, `formulationVerified=false`, `factConfirmationAuthorized=false`, `subjectCreationAuthorized=false` 유지.

## 3. 모듈 경계

### 3.1 Phase A — 단회 읽기 전용 structural inspector

신규 제안: `lib/trust/official-template-shape-p3-v1.mjs`
신규 테스트: `scripts/verify-trust-p3-template-shape-v1.mjs`

입력: guarded fetch 반환 bytes + contentType + source URL. 출력: **태그·특성의 카테고리 단위 통계**. 이름, 원문 HTML, 상세 속성 문자열, 선택 옵션 원문, 본문/스크립트/INCI는 저장하지 않는다.

필수 출력 예:
```json
{
  "contract": "trust-p3-template-shape-v1",
  "sourceDigest": "sha256-content-digest",
  "htmlBytes": 123456,
  "mainCount": 0,
  "productRootMarkerCounts": {
    "schemaProduct": 0,
    "productDataAttribute": 1,
    "productDetailClass": 1,
    "itemDetailClass": 0
  },
  "primaryTitleSurfaces": {
    "h1WithinRoot": 0,
    "scopedNameClass": 1,
    "structuredProductName": 0
  },
  "variantControlSurfaces": {
    "select": 0,
    "radio": 0,
    "optionWidget": 1,
    "explicitSelectedSignals": 0
  },
  "templateFamily": "UNKNOWN",
  "exactSkuVerified": false
}
```
값은 **예시 스키마이지 실제 사이트의 조사 결과가 아니다**. 원시 class 값·임의 CSS 선택자·원본 텍스트는 제외한다. 카테고리 분류용 허용 prefix/마커만 코드 내 고정하고, 적중 개수·모호성 여부만 보관한다.

A 단계에서 상품명 일치/Fact 후보 채택 로직을 변경하지 않는다. 실측 결과로 템플릿 프로필 추가가 타당한지를 판단한다.

### 3.2 Phase B — HTML primary root resolver

신규 제안: `lib/trust/official-primary-root-p3-v1.mjs`

단일 `<main>` 탐지만 의존하지 않고, **템플릿 패밀리에서 허용한 1차 상품 상세 루트**를 탐지한다.

- Generic: 유일한 main 내 해당 상품 영역이 명시되어 있는 경우.
- Goods-detail family: 공식 상세 페이지의 상품명과 상품옵션을 공동 소유하는 고유 루트 표지.
- Structured product family: 메타 구조가 아니라 실제 화면 상품 타이틀·옵션 영역에 연결된 유일한 루트.
- Unknown: `TEMPLATE_UNRECOGNIZED` 또는 `PRIMARY_ROOT_AMBIGUOUS` HOLD.

후보 루트는 (a) 상품 상세 맥락 구조, (b) 다른 상품 추천/메뉴/리뷰/광고와의 분리, (c) 루트 유일성, (d) 상품명 표제 및 옵션의 동일 루트 소속 여부를 확인해야 한다. 화면 속 구매 버튼·가격·상품명 필드 연결을 **보강 신호**로 쓸 수 있지만 단독 권한으로 쓰지 않는다.

어떤 상품에 대해서도 `rootCount != 1`이면 HOLD. 한 컨테이너 안에 여러 제품 카드가 있으면 HOLD. 고정 product ID, 검색 키워드, page slug만으로 루트를 정하지 않는다.

DOM 파싱은 **HTML5 중첩 구조를 보존하는 검증된 파서**를 우선 평가한다. 신규 의존성은 공급망 SCA·라이선스·lockfile 검증 통과 후에만 도입할 수 있다. 승인 전에는 메모리/시간/깊이 제한이 있는 좁은 범위 파서로 진단까지만 수행하고, regex 기반 첫 번째 닫힘 태그 방식으로 중첩 요소를 식별해 authority gate를 넓히지 않는다.

### 3.3 Phase C — product identity adapter

신규 제안: `lib/trust/official-primary-identity-p3-v1.mjs`

`primaryRoot` 내부에서 단일 상품명 필드만 추출해 normalized catalog current name과 비교한다. 허용 입력은 기존 제품의 한국어명, 영어명, 검증된 normalized name 및 **별도 승인을 받은 alias**까지이다. 동일 의미로 추정되는 번역·리뉴얼명, 긴 키워드 포함 여부만으로 인정하지 않는다.

`primaryIdentity` 판정:
- `SCOPED_NAME_MATCH_CANDIDATE`: 루트 내 유일한 1차 제품명 일치
- `SCOPED_NAME_MISMATCH`: 불일치
- `PRIMARY_NAME_AMBIGUOUS`: 복수 1차 표제 또는 충돌
- `NAME_NOT_OBSERVED`: 서버 HTML에 없음
- `ALIAS_REVIEW_REQUIRED`: 제품 개명 주장/별칭은 있지만 운영 alias 승인 불명

OG/JSON-LD는 다른 페이지, 추천 카드, script, OG-only 잘못된 승인 방지용 보강/충돌 판정으로만 쓴다. 동일 페이지에 서로 다른 현재 상품 이름이 나타나면 이름 게이트 HOLD.

### 3.4 Phase D — unit and variant adapter

신규 제안: `lib/trust/official-primary-variant-options-p3-v1.mjs`

제품명과 같은 primaryRoot에 있는 **실제 선택된** 판매 옵션의 크기를 파악한다.

허용할 수 있는 선택 증거 (템플릿 구조가 실측 검증된 경우에 한함):
- `<select>` 내부 단일 `selected` option
- 같은 상품/용량 그룹의 단일 `checked` radio
- 서버 렌더된 제품 상세 form 내부의 명시적 선택 상태 + 해당 변형의 양/단위/가격/SKU 연결
- 구조화 variant ID와 동일 상품의 선택된 입력값이 함께 표기되며 충돌이 없는 경우의 **review candidate** (스크립트 단독 불가)

금지:
- 용량 선택지 목록에 `40ml`가 존재한다는 이유만으로 선택 판정
- 데이터 JSON에 `40ml` 상품이 있다는 이유만으로 default-selected 판정
- URL 텍스트, OG, 관련 상품, 숨김 교차판매 컨트롤, disabled 버튼만으로 판정
- JS 미실행 페이지의 "첫 옵션일 것" 추측
- 옵션 없음/복수 선택/복수 제품 루트/용량 불일치/세트 구성에 대한 임의 보정

상태: `SELECTED_SIZE_MATCH_CANDIDATE`, `SELECTED_SIZE_MISMATCH`, `MULTIPLE_SELECTED_VARIANTS`, `NO_EXPLICIT_SELECTION`, `SIZE_UNIT_AMBIGUOUS`, `BUNDLE_HOLD`, `VARIANT_NOT_IN_PRIMARY_ROOT`.

용량 단위는 `ml`, `mℓ`, `밀리리터` 및 정규화 가능한 표기만 원래 카탈로그 `size_ml`과 숫자 비교한다. `g` 등 다른 단위는 환산 근거 없이 `ml`로 치환하지 않는다. `2×20ml`와 단품 `40ml`, 기획세트 `40ml+사은품`은 별개 판단. 동형 규격이라도 시장/제형은 별도 HOLD.

### 3.5 Phase E — policy gate integration

기존 `official-product-extraction-p3-v1.mjs`는 아래 독립적인 ALL 조건에서만 `EVIDENCE_CANDIDATE_ONLY`를 반환한다.

1. source policy, origin, robots, redirect 모두 통과
2. template family가 지원 목록 중 유일하게 식별
3. product primary root가 유일하고 관련/리뷰/광고 영역과 분리
4. 그 안에서 catalog product name이 유일하게 일치하고 별칭 승인이 필요한 리뉴얼명이 아님
5. 같은 primary root의 유일한 명시적 선택 옵션이 catalog 용량/구성과 충돌하지 않음
6. title size mismatch, bundle, cross-sell, contradictory structured data, market-conflict 등의 hard veto 없음
7. 현재 규칙을 **기존 P3와 합성**했을 때 더 위험한 긍정 승인 경로를 만들지 않음

조건이 하나라도 빠지면 구체적 HOLD 코드. 그 뒤 기존 opt-in `data-product-specs`/제품 claims 섹션의 SPF/PA/UV/INCI **직접 claim 후보만** 추출. 이름·SPF·UV type을 ingredient list/광고 본문으로 추론하지 않는다. Fact 확정 권한은 별도.

## 4. 진단·결과 데이터 계약 (제안)

```json
{
  "contract": "trust-p3-template-family-verdict-v1",
  "productId": "existing-governed-product-id",
  "sourceUrl": "https://official-origin.example/product",
  "sourceDigest": "sha256",
  "templateFamily": "GENERIC_MAIN | GOODS_DETAIL | STRUCTURED_DETAIL | UNKNOWN",
  "primaryRoot": {"count": 1, "signatureDigest": "sha256"},
  "identity": {"state": "SCOPED_NAME_MATCH_CANDIDATE", "surface": "primary-title"},
  "variant": {
    "state": "SELECTED_SIZE_MATCH_CANDIDATE",
    "selectedSizeMl": 40,
    "availableSizeCount": 2,
    "selectedOptionCount": 1
  },
  "status": "EVIDENCE_CANDIDATE_ONLY",
  "reasonCodes": [],
  "authority": {
    "exactSkuVerified": false,
    "marketVerified": false,
    "formulationVerified": false,
    "subjectCreationAuthorized": false,
    "sourceBindingAuthorized": false,
    "factConfirmationAuthorized": false,
    "dbWrites": 0,
    "aiApiCalls": 0
  }
}
```

원문 콘텐츠, 전체 ingredient list, 쿠키, 인증 헤더는 artifact에 저장하지 않는다. `signatureDigest`는 원시 CSS 문자열이나 DOM subtree를 기록하지 않고 **카테고리와 구조의 정규화된 요약**을 해시한다. 전체 응답 SHA-256은 원격 페이지 변화를 탐지하는 데만 쓰며 상품 동일성의 증거가 아니다.

## 5. 테스트 매트릭스와 통과 조건

| 유형 | 검증 내용 | 기대 |
| --- | --- | --- |
| 기본 정상 | 유일 상품 루트 + 명시 선택 40ml + 일치하는 상품명 | REVIEW_CANDIDATE |
| 재사용성 | 서로 다른 2개 이상 상품에 동일 템플릿 적용 | 같은 결과 규칙 |
| 다른 상품 | 추천 카드 안에 같은 이름/용량 | HOLD |
| 애매한 루트 | 0개 또는 2개 이상 1차 상품 루트 | HOLD |
| 실제 선택 아님 | 25/40ml 옵션만 나열 | HOLD |
| 규격 오선택 | 카탈로그 40ml, 현재 선택 25ml | HOLD |
| 단위 충돌 | 40g, 40ml 혼재 또는 구성 합산 | HOLD |
| 묶음/기획 | 2개 세트, 본품+증정, 리필 | HOLD |
| 오염된 정보 | OG-only, script-only, 리뷰/문의/사이드바 | HOLD |
| 개명/리뉴얼 | 검증되지 않은 다른 이름이나 formulation | HOLD |
| 동적 폼 | 서버 HTML에 선택값 없음 | HOLD |
| 시장/로케일 | 글로벌/한국 제품의 동일성 미확정 | HOLD |
| 정책 | robots 불가, redirect, SSRF, cross-origin | HOLD |
| 대용량/악성 HTML | 과도한 중첩, 깊이, 속성, 비정상 인코딩 | 안전 중단 |

정적 회귀 테스트는 기존 `.github/workflows/trust-phase5b-7d-static.yml` 단일 owner에서 실행한다. new workflow 추가 금지. positive fixture 결과를 live coverage로 간주 금지.

**릴리스 최소 조건** (수치는 이 설계의 제안 목표, 현재 측정 결과 아님):
- Critical false-positive 자동 `EVIDENCE_CANDIDATE_ONLY` **0건**, hard HOLD 테스트 전부 PASS.
- 검증 후보 모두 유일한 `primaryRoot`와 일치하는 선택 variant 근거를 가져야 함.
- 반복 실행에서 결정론적 동일 verdict; 안정된 소스 동일 SHA.
- 기존 6 URL 재측정 + 가능한 다른 템플릿 패밀리 표본: 결과/실패를 구분 보고.
- 운영 DB/Product/Subject/Fact/Recommendation write count 0, AI API 0.
- CodeQL/TRUST/PIE/Main Health green; SCA 취약점은 bypass/예외 연장 없이 독립 해결.

결과 보고는 별도로 `policyEligibleSourceRate`, `htmlFetchedRate`, `templateRecognizedRate`, `identityScopedRate`, `selectedVariantObservedRate`, `reviewCandidateRate`, `confirmedExactSkuRate`를 분모와 함께 구분한다. 0/6 통과를 "제품 0개 확인" 또는 "자동화 실패"라고 포장하지 않고 원인별 HOLD와 신뢰도 안전성을 구분한다.

## 6. 실행 PR 분할 (순서 고정)

### PR-A: shape diagnostics only
- 신규 shape inspector, 엄격 제한, negative fixtures, canonical TRUST CI.
- 이름/용량 gate 변경 금지.
- 단일회 robots-gated 6 URL official probe. 이 단계에서 어떤 템플릿 패밀리가 실제로 존재하는지 근거 확보.
- 종료: 태그/상품루트/변형 컨트롤별 metadata artifact가 생성되거나 각 URL HOLD 이유가 기록됨.

### PR-B: primary-root + product-name adapter
- PR-A에서 관측된 제품 상세 root 패밀리만 등록. unknown/collision HOLD.
- 고유 root 내 product title 추출과 이름 불일치 테스트. brand/product-ID override 금지.
- 템플릿별 positive와 unrelated cross-sell negative fixture.

### PR-C: explicit selected variant adapter
- 실제 표시된 선택 규격 필드가 정적 HTML에 존재하는 템플릿만 지원.
- g/ml, bundle, 25/40ml unselected, source redirect, dynamic widget negative cases.
- 상품명 검증과 선택 규격 검증을 결합하되 authority gate 불변.

### PR-D: integrate, accept and freeze
- 기존 `official-product-extraction-p3-v1.mjs`와 `scripts/trust-p3-official-locator-revalidation.mjs` 통합.
- 기존 canonical TRUST job, exact-head CodeQL/PIE/Main Health, robots-gated live measurement.
- source hashes, reason codes, aggregate funnel 수치 동결; 권한 변화 없음.
- 모든 제품에 자동 적용하는 확장 작업은 **PR-D 검증 이후** 별도 단계로 수행한다. 템플릿 패밀리당 재사용성을 확인하되 제품 176개를 한 건씩 수작업하지 않는다.

## 7. 설계 종료 조건·잔여 리스크

**설계 범위는 원칙과 인터페이스 확정으로 종료**. 실제 official HTML의 product-container/variant 위젯 유형은 아직 측정되지 않았으므로 특정 CSS 선택자나 JSON 구조는 **미확정**. PR-A 증거 없이 유사 사이트의 구조를 추정하여 구현하지 않는다. 공식몰 차단은 사용자 인증/우회나 헤드리스 브라우저로 임의 해결하지 않으며 별도 정책 심사까지 HOLD.

현재 baseline: official 6 URLs 중 4 fetch / 2 blocked / eligible 0, verified SKU 0. 구현 검증 목표는 오탐을 늘리지 않고 **정확히 식별 가능한 템플릿 패밀리 범위에서만 후보 coverage를 증가**시키는 것이다.
