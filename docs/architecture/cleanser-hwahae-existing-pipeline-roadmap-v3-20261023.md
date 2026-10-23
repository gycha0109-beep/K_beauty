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
