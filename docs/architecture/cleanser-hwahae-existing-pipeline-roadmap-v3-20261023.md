# BEJEWELY 클렌저 R0–R6 로드맵 v3 — 화해 기존 파이프라인 재사용
**갱신: 2026-10-23 · 문서 상태: #1403 Draft의 실행 기준(운영 변경/정식 채택 전)**

> **v2 교정:** 기존에 구현·운영 중인 화해 수집 → 정규화 → `products.review_signals / market_signals / ingredient_signals` → Skin Match 보정점수를 기준으로 진행한다. `reviewed_by`, `reviewed_at`, `review_state=reviewed`, 임의 `sample_count >= 10` 같은 **별도 Shadow 전용 구조를 일반 추천의 추가 필수 요건으로 만들지 않는다.** v2의 0/10 `LIMITED_FIT_SHADOW` 결과는 이 새 스키마를 충족하지 못했다는 **합성 호환성 결과**일 뿐, 이미 저장된 7건의 화해 데이터가 추천 근거로 불가능하다는 판정이 아니다.

## 0. 결정된 운영 방향
1. **화해 집계는 비주얼리의 기존 보조 추천 근거**다. 화해 AI 리뷰 요약·긍정/부정 언급 빈도, 평점·리뷰수, 성분 신호를 추출/정규화하여 사용자 맥락별 가중치로 사용한다. **개별 리뷰 원문 전체를 확보해야 한다는 뜻이 아니다.**
2. **추천 점수에 활용하는 관측 신호와 확정적 Product Fact는 다른 권한이다.** `review_signals`에서 질감·사용감·세안 후 당김 등 *소비자 관측*을 점수화할 수 있어도, 이를 `low_ph=true` 또는 `deep_cleansing=true`로 확정/Subject 교차 재사용하지 않는다.
3. **공식 제조사 회신/동일 처방 입증은 일반 추천의 일괄 선행조건이 아니다.** 공식 근거 확보는 정확한 기능성 Fact와 처방 공유 결정의 별도 경로에서 진행한다. 제품 식별/시장/옵션이 불명확한 관측은 해당 제품의 잘못된 신호를 배제한다.
4. **기존 파이프라인은 중복 구현하지 않는다.** 기존 `build-review-signal-fixture`, `normalizeReviewSignals`, `computeReviewSignalScore`, `computeIngredientSignalScore`, `computeMarketConfidenceScore`를 **그대로 기준**으로 삼고 보호된 G2 진입 정책은 별도 변경 승인 전까지 유지한다.
5. 현재 #1403은 Shadow/문서 전용. **카탈로그/DB/RLS/Subject/Fact/G2/추천 스코어/배포 쓰기 0**. #1390 strict 공식 Fact 트랙과 #1401 R1–R5 추천 불변 계약은 소유권 그대로 보존한다.

## 1. 실제 구현되어 있는 기존 데이터 계약(재사용 우선)

| 데이터/단계 | 기존 파일/필드 | 의미 | 주의 |
| --- | --- | --- | --- |
| 화해 화면 추출 | `scripts/review-signals/prepare-hwahae-review-raw-batch.mjs` | `review_raw`, `market_raw`, `ingredient_raw` 추출 계획/배치 | 원본 상품 식별/카테고리/URL 검증, 사이트 이용권 확인 필요 |
| 정규화 | `scripts/review-signals/build-review-signal-fixture.mjs` | 화해 AI 요약→ positive/negative의 `label,count,mapped`, 시장/성분 신호 | 카테고리 의미가 맞지 않으면 `review_signal_status=skipped`; `ready`는 **Fact 승인 아님** |
| 저장 | `scripts/review-signals/import-review-signals-to-supabase.mjs`, `products` | `review_signals`, `market_signals`, `ingredient_signals`, `hwahae_url` | 중복 재크롤링/재적재 기본 금지, 기존 값 재사용 |
| 기존 출처 증빙 | `lib/hwahae-review-capture-provenance.js`, `scripts/build-hwahae-review-capture-envelope.mjs` | 제품/외부 source identity, HTTPS locator, observed_at, canonical payload digest | 이미 존재하는 provenance 계약을 사용하고 별도 `reviewed_by` 필드를 지어내지 않음 |
| 추천 입력 | `lib/product-source.js` | 위 세 신호를 product payload로 전달 | Product ID/한국 판매 상품/용량이 다른 페이지 혼입 확인 |
| 기존 리뷰 점수 | `lib/review-signals.js` | `computeReviewSignalScore`, 리뷰 count confidence, mapped tag, ±10 한도 | 이는 소비자 경험 보조점수이며 과학적 검증 점수 아님 |
| Skin Match 합산 | `lib/skin-match-decision-engine-core.js` | base + reviewSignal + ingredientSignal + marketConfidence + adjustment + penalty | 별도 점수식 신설·가중치 이중 반영 금지 |

## 2. 반드시 구분할 네 가지 상태

| 상태 | 현재 의미 | 점수·추천 취급 |
| --- | --- | --- |
| **기존 상품 카탈로그 신원** | Product ID/브랜드/카테고리 존재 | 탐색/코호트 기준 |
| **화해 정규화 신호 저장** | `review_signals/market_signals/ingredient_signals` 중 해당 필드 존재 | 기존 점수식의 **입력 후보**, 실제 태그·카테고리·리뷰 수·신뢰도 품질은 검사 |
| **화해 신호가 특정 상품에 정확히 대응** | 원래 추출한 `hwahae_url`/source identity/캡처 계약과 Product 연결에 충돌 없음 | 기존 `computeReviewSignalScore` 등에서 한정된 관측 신호 사용 가능(현재 새 클렌저는 Shadow) |
| **Governed Subject/Fact 확정** | PF-1 검토·승인된 정확한 처방/Source/Fact | 확정적 기능성 주장/교차 용량 재사용에만 사용. 일반 선호 점수의 필수 조건이 아님 |

**삭제할 잘못된 판정:** `7개에 review_signals 저장` → `reviewed_by 필드 없음` → `화해 리뷰 근거 0개`로 결론 내리는 구조. **대신** `저장된 7건이 현재 점수식에서 어떤 신호를 얼마만큼 낼 수 있는가`, `정확한 화해 상품에 연결되었는가`를 검증한다.

## 3. R0–R6 갱신 실행계획

| 단계 | 현재 상태 | 우선 작업(코드 중심) | 완료 기준 |
| --- | --- | --- | --- |
| **R0** 기존 카탈로그·파이프라인 감사 | 완료: 기존 10 UUID/10 intake/20 Task, 데이터 수집·점수식 경로 파악 | 7/3 신호 상태와 원래 크롤링·정규화 함수 매핑을 1개 문서로 고정 | 원본 데이터·점수·Product ID 변경 0 |
| **R1** 제품/규격/판매구성 | Shadow 구현, 실제 라곰 시장별 차이 조사 | 170/220, 120/150, 휩드 130g, 1+1 규격 차이만 제한 범위 검토 | 크롤링 데이터가 다른 용량·기획세트/시장으로 섞일 때 HOLD, 판매구성을 단일 제형으로 해석 안 함 |
| **R2** **화해 기존 파이프라인 정합성** | **이번 갱신으로 최우선**. 정규화·점수식 이미 구현, 실제 클렌저 연결검증 미완료 | 기존 7개 `review_signals`을 `normalizeReviewSignals`/기존 score에서 **읽기 전용으로 재생**; source ID/URL/category/recorded date 교차 검증; unmapped tag·리뷰 빈도·rating 누락/편차 분석; 3개 누락 상품은 원본 매핑 확인 후 보수적 처리 | 실제 7건의 입력·출력·제품 매핑별 **usable/partial/hold** 판정 및 3건 누락 사유, 존재하지 않는 새 reviewed metadata를 요구하지 않음 |
| **R3** 추천 신호 vs Product Fact **권한 분리** | 기존 strict v1 + 잘못 격리된 v2 별도 Shadow 존재 | 새로운 `reviewed_by/reviewed_at/sample_count` 강제 게이트를 **폐기/비권위 실험으로 격하**; 제품별 기존 리뷰 점수는 관측 근거로, PF-1은 기능성 Fact로 각각 검증. 제조사 동일처방 증명 없이 허용 가능한 신호만 분리 | `low_ph`·`deep_cleansing` 임의 확정/복사 0, 미확인은 UNKNOWN, 잘못된 source↔product는 HOLD |
| **R4** 신규 클렌저 제한 진입 사전평가 | 코드 Shadow만 검증. 운영 G2 category=cleanser는 현재 차단 | 기존 점수식/카테고리 의미를 유지하는 **별도 제한 진입** 입력·충돌 우선순위 설계; 필수 Fact를 일반 추천 필수로 요구하지 않음 | 기준 만족할 때만 Shadow candidate 제시, G2·운영 권한 우회 0 |
| **R5** 실제 데이터·평가셋·회귀 | 기존 164×12 및 판매 교란 회귀 PASS, 신규 10개의 실제 적합성 검증 필요 | 7개 저장 신호 real-data replay, 라곰 다른 용량 혼입/리뷰 없는 3건/unmapped labels/표본 편향/근거-점수 분리 반례. 기존 recommendation hash 유지 | 실데이터 Shadow 결과·오탐/보류 사유 기록, 기존 164×12 해시 동일, 새로운 점수 이중계산 0 |
| **R6** 제한 추천 운영 준비 | 보류, 0 activation | 출처 이용권·고지, 권한/RLS, feature flag, kill switch, Canary/rollback, 명시적인 보호된 G2 정책 변경 승인 | **별도 승인 전 실제 추천 편입/DB/G2/배포 0** |

### 다음 3개 실행 묶음

**P1 · 즉시:** R2 real-data replay. DB의 7개 기존 `review_signals/market_signals/ingredient_signals`을 SELECT-only로 읽어 기존 함수에 입력하고 카테고리·mapped 태그·score breakdown을 기록. *원본 소비자 리뷰 텍스트/성분 상세를 공개 PR에 복사하지 않는다.* 3개는 `NOT_CAPTURED` 또는 `LINK_MISMATCH`처럼 검증된 실제 원인으로 표기한다.

**P2 · 다음:** R3 잘못된 신규 gate 교정. 기존 `lib/trust/cleanser-evidence-tier-shadow-v1.mjs`은 새 스키마를 요구하는 **비호환 실험**으로 명시, 기존 `review_signals`/provenance/score 함수 호환 어댑터를 구현하고 리플레이 결과로 테스트. 리뷰에 표시된 경험 → Fact 확정/피부 안전 보증으로 승격 금지.

**P3 · 그다음:** R4~R5 기존 Skin Match와 진입 계약 통합 Shadow; Product ID/카테고리/시장/판매용량 충돌 검증, 164×12 추천 불변/Fact 권한/score weight 중복검증; R6는 사용자 별도 승인 시에만.

## 4. 반드시 지킬 기준

- **기존 수집된 화해 요약 데이터를 버리거나 동일한 데이터를 재크롤링하여 새 시스템을 만들지 않는다.**
- `getReviewSignalConfidence`가 사용하는 *긍정/부정 요약 언급 수*와 `market_signals.review_count`(상품의 전체 리뷰 수)는 **다른 필드**다. 합치거나 `review_aggregate.sample_count`라는 별도 정체불명 값으로 바꾸지 않는다.
- `getReviewSignalConfidence` 자체는 점수 보정값이므로 **통계적 검증이나 공식 효능의 승인으로 표현 금지**. 인기도 지표(`marketConfidence`)는 피부 적합성 진리값이 아니다.
- 상품 수준의 출처 바인딩 충돌, 라곰 용량/국가·리뉴얼 차이, 누락·unmapped 태그, 원본/재사용 권한 문제는 **정해진 범위의 관측만 HOLD**. 근거 부재만으로 모든 제품을 잘못된 기능성 사실로 간주하지 않는다.
- 추출/재사용 권리와 화해 접근 조건은 별도로 점검. 원본 페이지 무단 재수집/우회 및 GitHub에 소비자 리뷰 원문 저장 금지.
- PF-1 Subject/Source/Fact, strict 클렌저 v1, G2/R6 승인 체계는 별도 보호 트랙이다. 이를 바꾸려면 정식 보호자 승인.
- 갱신된 로드맵은 이 Draft 내 실행 우선순위로 적용하고, #1390 정본과 충돌하는 **운영 권한 조항은 아직 변경하지 않는다.**

## 5. 기존 문서/코드 관계와 폐기 판단

| 아티팩트 | 조치 |
| --- | --- |
| 기존 v2 로드맵 `docs/architecture/cleanser-evidence-tiered-recommendation-roadmap-v2-20261023.md` | **v3에 의해 작업 우선순위 대체**. 개발 이력으로 남기되 현행 로드맵은 본 문서. |
| `lib/trust/cleanser-evidence-tier-shadow-v1.mjs` | 기존 모델에 없는 reviewer/timestamp/sample_count 강제 → **비호환 실험으로 격하**, 운영 추천 허용 근거 아님. |
| `scripts/verify-cleanser-evidence-tier-shadow-v1.mjs` | 합성 fail-closed 안전망은 유지, R2 실데이터 통과율 자료로 인용 금지 |
| `lib/review-signals.js` 및 `lib/skin-match-decision-engine-core.js` | **정본 점수식**. 이번 트랙에서 변경하지 않음 |
| `lib/hwahae-review-capture-provenance.js` 및 리뷰 배치·fixture·import 스크립트 | **정본 원본·가공 추적 경로**. 중복 approval schema 신설 금지 |
| 기존 R6 restricted 출시 체크리스트 | 배포용 승인/차단 시험으로 보존. 새 `reviewed_by` 없는 데이터라는 이유만으로 실제 제품 근거 0건 결론 금지 |

**현실 진척 요약:** R0 완료 / R1 Shadow 완료·실물 불확실성 일부 / R2 기존 기능은 있지만 신규 10개 호환성 감사가 막힌 핵심 / R3 정책 경계 재정의 / R4 제한 진입 미적용 / R5 레거시 회귀 PASS·신규 real-data 평가 대기 / R6 미착수.

`#1403` Draft 대상. PR 머지·운영 배포·DB 쓰기 권한 없음.

## 2026-10-24 R2 진행 결과 — 기존 DB 신호 직접 점검

- 실 데이터: `products`를 **SELECT-only** 조회해 기존 클렌저 10개 신호를 재집계. 7개가 화해 AI 리뷰 요약·시장 리뷰/평점·성분 신호를 저장했고 해당 7개 모두 `hwahae_url`과 `market_signals.hwahae_review_page`의 URL 문자열이 일치. 다만 **일치 문자열만으로 정확한 판매 SKU/처방까지 검증됐다고 단정할 수 없음**.
- **6개**: 리뷰 요약의 상위 긍정/부정 3개 범위에 이미 매핑된 태그가 존재함 → 기존 `computeReviewSignalScore` 입력 후보. 기계적 후보이며 아직 신규 추천 G2 승인이나 제품 규격 확정 아님.
- **1개** 휩드 머그트리 130g: 페이지 전체 리뷰 수 **2건**. 저장 리뷰 요약은 부정 1개만 존재하며 점수 매핑 태그 0개 → `NO_TOP_THREE_MAPPED_REVIEW_TAGS`. 리뷰·시장 정보가 있다는 사실과 실제 피부 점수 기여를 분리한다.
- **3개** 마녀공장 퓨어 소이빈/라곰 젤 투 워터/라곰 마이크로 폼: 화해 캡처 미기록 → `NO_HWAHAE_REVIEW_CAPTURE`. 이 3개의 실제 상품이 화해에 존재하지 않는다는 결론이 아님.
- DB의 리뷰 신호 `updated_at=2026-10-22`는 7개에 존재. **정규화된 `updated_at`은 단순 저장시점으로, 페이지 수집 원본의 별도 `observed_at` 승인이나 검토자 정보가 아님.**
- `market_signals.review_count`(페이지 전체 리뷰 수)와 `review_signals.positive/negative[].count`(화해 AI 요약의 표현 언급 횟수)를 서로 대체하지 않음.

### 이번에 구현한 검증 도구

- [읽기 전용 실데이터 10개 축약 스냅샷](../../evidence/trust/cleanser-existing-hwahae-signal-footprint-20261024-v1.json): 상품 ID/이름·건수·상위 매핑 개수·상태만 보존. **리뷰 원문·AI 요약 라벨·URL·성분 원본을 저장하지 않음**.
- `lib/trust/cleanser-hwahae-existing-score-shadow-v1.mjs`: **기존 `normalizeReviewSignals` + `computeReviewSignalScore`를 그대로 호출**. 별도 `reviewed_by`, `reviewed_at`, `review_state`, 새 표본수를 요구하지 않음. 실제 저장된 링크 문자열이 불일치하면 보류. 반환 점수는 기존 Review Signal 축 **하나만**이며 Skin Match의 최종 추천 점수 전체가 아님.
- `scripts/run-cleanser-existing-hwahae-live-review-score-v1.mjs`: 승인된 서버에서 DB 원본 10개를 읽고 세 가지 사용자 상태별 **원래 리뷰 점수식으로 재계산**한 뒤 숫자·상태만 표시하는 프로그램. 단, **현재까지 실제 운영 DB 인증정보를 넣어 이 프로그램 자체를 실행한 것은 아님**. CI에서는 자격증명 없이 합성 예제에서 원래 점수식을 호출하고 차단 장치만 검증.
- `scripts/verify-cleanser-hwahae-existing-score-shadow-v1.mjs`: 실제 SELECT 축약값 6/1/3과 합성 원래 점수식 테스트, 잘못된 URL/카테고리/저신호 보류·Fact/G2 쓰기 0을 점검. 기존 제품 및 점수식은 수정하지 않는다.
- **R2 완료 기준 일부 달성**: 데이터 존재·라벨 매핑 현황 및 기존 함수 연결 구현. **추가 완료(2026-10-24)**: 운영 DB SELECT 원본 신호를 별도 격리 JS에서 기존 `main` 스코어러 본문 그대로 실행해 6개 상품 × 3개 사용자 맥락의 **정확한 리뷰 신호 점수 replay**를 확보. [원문 제거한 숫자 증거](../../evidence/trust/cleanser-actual-review-score-replay-20261024-v1.json)에 고정. **남은 일**: 전체 Skin Match 최종 스코어/시장·성분 반영 전 과정을 그대로 계산한 것이 아니며, 별도의 외부 호스팅 CLI를 직접 가동한 검사는 아직 안 됨.
- **R3 일부 달성**: 호환 어댑터 코드로 기존 파이프라인 재사용. 이전 v2의 새 필드 기준은 보호된 진입 요건으로 채택하지 않음.
- **R4~R6**: 변경/활성화 없음. 기존 164×12 추천 해시 유지 검증 필요.

### 다음 구현 순서 갱신

1. 먼저 보호된 실행 환경에서 `run-cleanser-existing-hwahae-live-review-score-v1.mjs`로 정확한 7개 원본 리뷰 점수/3개 누락 사유를 계산하고, 원본 라벨 없는 숫자 결과만 저장한다. **공용 CI에 Supabase 서비스 키를 제공하지 않는다**.
2. 정확한 화해 상품 식별/리뉴얼/용량 미스매치 후보와 리뷰 요약의 매핑 실패만 재검토한다. 웹사이트를 임의로 다시 크롤링하거나 허위 `reviewed_by`를 넣지 않는다.
3. R4 제한 추천 권한 정책 설계를 R5 실데이터 점수 검증·164×12 기존 점수 불변과 결합해 검토하고, 보호된 승인 이전에 G2 활성화하지 않는다.

## 2026-10-24 R3·R4 추가 진행 — 기존 리뷰 점수의 진입권한 분리 Shadow

- 실수치 기준([R3·R4 검증 보고서](../evidence/cleanser-r3-r4-review-admission-shadow-20261024.md)): 원본 `computeReviewSignalScore`로 계산한 기존 6개×3개 피부 조건을 **긍정 4 / 부정 주의 9 / 중립 5**로 구별한다. 미매핑 1개×3조건, 캡처 미기록 3개×3조건은 별도 보류, 전체 **30개** 결정.
- `lib/trust/cleanser-existing-review-admission-shadow-v1.mjs`는 **기존 숫자를 읽기만** 하고 신규 점수 계산/합산·Fact 확정/추천 순위 조정이 없다. 피부 조건의 부정 보정점을 긍정 추천 근거로 사용하지 않고, 0점은 `근거 없음`으로 구분한다.
- `scripts/verify-cleanser-existing-review-admission-shadow-v1.mjs`는 실데이터 축약 리플레이 + 보호된 실제 G2 분류 함수의 **cleanser NO_GRANT** 검사 + 오염/신호 조작 반례를 검증한다.
- **R3** 기존 화해 신호와 엄격한 기능성 Fact의 코드상 방화벽 확대 / 실제 사용자 고지·정식 정책 채택은 미완료. **R4** 신규 클렌저 Shadow 점수 방향 분류 구현 / 신규 클렌저 전체 추천 점수·정식 G2 승인 조건은 미완료. **R5** 기존 164×12 회귀 재확인 필수. **R6** 미승인·미배포 그대로.
- **정본 정책 유지:** `reviewed_by` / 별도 신규 리뷰 승인 스키마를 도입하지 않으며, 제조사 공식 처방 확인을 일반 리뷰 가감점의 선행 조건으로 되살리지 않는다.

### 로드맵 상태(참고용)

| 단계 | 상태 |
| --- | --- |
| R0 | 완료 |
| R1 | 규격/용량 Shadow 구현·시장별 확인 일부 |
| R2 | 실상품 6개의 기존 리뷰 가감점 **실제 재계산 완료**. 전체 점수/시장별 재현 보강 필요 |
| R3 | **리뷰 신호 ≠ 확정적 Fact** 분리 Shadow 구현, 운영 계약 채택은 보류 |
| R4 | **실제 리뷰 점수 30개 피부 조건별 분류** 구현, 최종 적합성 점수·G2 신규 진입은 아직 |
| R5 | 기존 164×12 회귀검사, 신규 10개의 완전한 후보 비교는 미완료 |
| R6 | 제한 추천 실제 활성화 미시행 / 별도 승인 필요 |
