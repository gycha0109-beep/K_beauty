# R3·R4 클렌저 — 기존 리뷰 점수 재사용과 진입 권한 분리 (2026-10-24)

> **결론:** 기존 화해 수집 데이터와 Skin Match `computeReviewSignalScore`의 실데이터 수치 재생 결과를 그대로 입력. 사용자 조건별 **보조 리뷰 가감점의 방향만** Shadow로 분류한다. 새로운 `reviewed_by`, `reviewed_at`, `sample_count` 게이트나 점수식 추가 없음. **운영 G2·추천 랭커·PF-1 Fact·DB 변경 0**.

## 한 것

- 기존 클렌저 10개 중 **6개는 기존 리뷰 점수 입력 후보**, **1개(머그트리)는 태그 매핑 부족**, **3개는 화해 캡처 미기록**이라는 DB SELECT 실제 결과를 보존한다.
- 기존 `lib/review-signals.js`의 정확한 실데이터 점수(숫자만 저장)를 **6개 × 3 피부 맥락**으로 분리하고, 이 값을 **추가 가산하지 않음**(`review_score_added_again:false`).
- 리뷰 점수 분류: `POSITIVE_REVIEW_CONTRIBUTION_ONLY`(일부 긍정), `NEGATIVE_REVIEW_CAUTION_ONLY`(주의), `NO_REVIEW_SCORE_CONTRIBUTION`(해당 피부 맥락에서는 근거 없는 중립). 매핑 부족과 캡처 미기록은 별도 HOLD.
- 실제 30개 제품×피부 맥락: **긍정 4 / 부정 9 / 중립 5 / 매핑 부족 3 / 캡처 미기록 9**. 이는 실상품 추천 승인·성능 평가 점수가 아니다.
- 엄격한 기존 `classifyInitialAdmissionCategory("cleanser")` 결과는 `INITIAL_ADMISSION_AUTHORITY_INSUFFICIENT`, 기존 G2 심사에서도 **NO_GRANT** 유지.
- `low_ph`, `deep_cleansing`은 `UNKNOWN`; 화해 집계→관리형 기능성 Fact 변환·다른 용량 성분 재사용·임의 안전 보증 없음.
- 별도 가짜 제품 ID, 신호에 포함된 비정상적 점수, 카테고리/프로파일 오염, 기존 Fact/G2 위조에 대해서는 fail-closed 테스트 추가.

## 남은 것

1. 현재 값은 **리뷰 보정 점수**만 재계산한 것이다. Skin Match 전체 추천 점수(기본점수, 성분/시장 신호, 위험 보정, 카테고리/루틴) 전체를 신규 10개에 재생한 것은 아님.
2. 화해 캡처 URL 문자열 일치만으로 한국 시장의 정확한 용량/SKU·리뉴얼 버전 연결이 독립 검증된 것이 아님. 특히 라곰 170/120ml는 다른 국가/용량과 섞이지 않아야 함.
3. 기존 근거를 사용한 제한 진입 정책은 **검증용 Shadow 설계**. 실제 신규 상품 G2 진입 정책 및 운영 추천권한 변경은 별도 승인 전 보류.
4. 클렌저 3개 누락 원본 재확인과 머그트리 2건/미매핑 문제는 기존 정규화·수집경로의 허용된 방식으로만 개선. 무단 재크롤링 금지.

## 다음 작업

- R4·R5: 실제 신호와 한국 상품 매핑이 맞는지 독립 검토하고, 신규 클렌저의 **전체 Skin Match Shadow 점수·카테고리 적합성·리뷰 점수 중복 계산 없음**을 검증.
- R5: 기존 164×12 회귀 해시가 동일한지 확인하고 부족한 3개는 일반 카탈로그 탐색과 적합성 평가를 별도 판단.
- R6: 새로운 제한 진입 보호 정책, 설명 UI, kill switch, 소스 사용권·보안 및 canary/rollback 후 **명시적인 운영 승인**을 받을 때만 실제 추천 활성화.

## 블로커 및 승인사항

- **기술 블로커:** 실상품 10개의 전체 추천 파이프라인 재생·한국 판매 제품 정확성 검증, 리뷰 부족/누락에 대한 검증된 처리 정책.
- **외부/사용권 블로커:** 새 화해 원본 수집이나 타 페이지 활용을 할 때 해당 수집·재사용이 허용되는지 확인.
- **보호된 별도 승인:** 신규 클렌저를 실제 G2 추천 후보로 허용하는 정책 변경 및 배포는 아직 승인되지 않았다. 이번 코드·테스트는 이를 요구하지 않는다.

### 파일

- [실제 데이터 익명화 점수](../../evidence/trust/cleanser-actual-review-score-replay-20261024-v1.json)
- `lib/trust/cleanser-existing-review-admission-shadow-v1.mjs`
- `scripts/verify-cleanser-existing-review-admission-shadow-v1.mjs`
- [R0–R6 로드맵 정본](../architecture/cleanser-hwahae-existing-pipeline-roadmap-v3-20261023.md)
