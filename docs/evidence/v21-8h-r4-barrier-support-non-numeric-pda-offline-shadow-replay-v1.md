# V2.1-8H-R4 — 배리어 지원 비수치형 의사결정축 오프라인 그림자 재생

## 종료 판정

`NON_NUMERIC_BARRIER_SUPPORT_PDA_OFFLINE_SHADOW_REPLAY_VALIDATED`

4단계는 3단계 계약을 재설계하지 않고, 범위 정보가 완전한 읽기 전용 고정 자료를 통해 전체 상품에 재생한다. 운영 추천은 이 출력물을 소비하지 않는다.

## 입력 권위

- 전체 상품: 176
- 보습제 계열: 61
- 분류값 없음: 10
- 관련 현재 사실: 12
- 운영 접근: 자료 추출 시 1회 읽기 전용
- 자동 검사 중 운영 DB 접근: 없음
- 고정 자료 해시: `45ec8f9b7ca5768c161ff0b5283125f68ebdea049ac022c80acf453d3b00ea67`

고정 자료는 사실 범위 `market/region/locale/valid_from/valid_to`와 주체 범위 `variant_key/formulation_revision_key/market_applicability/region_applicability`를 보존한다. 기존 현재 사실 해석기 v1은 범위 정보를 운반하지 않으므로 4단계 입력 경로에서 사용하지 않는다.

## 전체 상품 재생

상태 분포: `{"GOVERNED_BARRIER_CLAIM_BLOCKED":51,"GOVERNED_BARRIER_CLAIM_ESTABLISHED_TRUE":6,"GOVERNED_BARRIER_CLAIM_UNKNOWN":14,"NOT_APPLICABLE":105}`.

적용 범위 분포: `{"category_unknown":10,"claim_with_usage_role_context":6,"identity_blocked":51,"missing_fact":4,"not_applicable":105}`.

보습제 중 현재 확정 주체가 없는 상품은 3단계 계약에 따라 차단된다. 분류값이 없는 상품은 거짓이나 비적용으로 추정하지 않고 분류 미확정 상태로 유지된다.

## 범위와 계보

- 가짜 계보: 0
- 범위 불일치: 0
- 증거 원문 포함: 0

사용 역할은 문맥일 뿐 효능이나 강도를 변경하지 않는다.

## 비수치 경계

- 숫자값 존재: 0
- 서열값 존재: 0
- 효과 강도 존재: 0

모든 출력은 `legacy_numeric_contribution=PROHIBITED`, `production_consumption=NO`를 유지한다.

## 추천 불변성

추천 불변성 분모는 전체 상품 176개로 확대하지 않는다. 기존 승인 후보 164개와 고정 사용자 상황 12개, 총 1,968건을 그대로 사용한다. 집중 검증기는 현재 추천 회귀 검증기 `scripts/verify-current-recommendation-health.mjs`를 실제 실행하고, 4단계 모듈이 운영 추천 코드에서 가져와지지 않는 것도 검사한다.

요구 변화량은 점수, 순위, 1위, 상위 3개, 자격, 후보 정책, 공개 응답, 저장 모두 0이다.

## 운영 불변성

상품 사실, 주체, 사실 인스턴스, 확인 기록, 레지스트리, DB 마이그레이션을 변경하지 않는다. 4단계 수행 중 운영 쓰기는 0이다.

## 다음 단계

`V2.1-8H-R5 — 배리어 지원 그림자 추천 소비 어댑터 계약`

5단계는 이 비수치형 결과와 사용자 배리어/탈수 문맥의 연결 계약을 다루며, 4단계에서는 실행하지 않는다.
