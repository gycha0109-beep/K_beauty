# Face Lab / Skin S2-C 사전 분석 — 사진 신호 신뢰도에 따른 기존 추천 영향 (2026-10-15)

> **상태:** 합성 입력과 현재 실제 엔진을 사용하는, **운영 비연결** 추천 차이 측정. 추정/수치가 아닌 **실제 GitHub exact-head 실행 로그**가 나오기 전에는 변화율을 사실로 보고하지 않음. 배포·실사진·추가 Provider 호출·점수 정책 승인 아님.

## 목적

현행 `lib/skin-match-decision-engine-core.js`는 사진 전체 `skinAnalysisEligible === true`면 8개 축의 숫자(0–5)에 4배, UV는 3배를 적용하고 실제 사용자 고민 우선순위와 제품 추천에 반영한다. 명시적 사진 근거가 없거나 low confidence인 개별 축도 가산되는 위험이 소스에서 확인되었다.

이번 사전 분석은 **추천 계산식을 수정하거나 복제하지 않는다**. 같은 설문과 같은 제품 목록으로, 기존 엔진을 **두 번** 호출하되 두 번째 호출에서만 가상 사진 입력을 조건부로 0으로 제한한다.

- 기존 실계산: 원래의 숫자 `photoAnalysis.signals`.
- 신규 **가상** 계산: S1-A `skin-axis-evidence-v1` 메타데이터 평가가 통과한 **같은 피부 축**의 `present`(신뢰도 medium/high)만 수치 가산 후보로 인정한다. `not_seen`은 0(가산 없음), `unassessable/unknown/low`도 가산 없음. numeric signal과 별도 evidence value가 불일치하면 보류.
- `uv`는 직접 시각 단서가 없어 **가상 입력에서만** 0으로 만든다. 현행 자외선 차단제 정책이나 운영 점수는 변경하지 않는다.
- 사진 전체가 제공되지 않았거나 실패/부적격이면 가상 사진 가산은 전부 0이다.
- `legacyPhotoAnalysis` 객체를 수정하지 않고 별도의 **메모리 내 복사본**을 만든다.
- **중요:** S1-A의 `not_seen`도 모델이 자기 보고한 메타데이터일 뿐 실사진의 객관적 부재를 입증하지 않는다. 이 시험은 피부 정확도가 아니다.

## 실제 추천 엔진을 그대로 쓰는 근거

검사 스크립트 `scripts/facelab/skin/verify-face-lab-s2-photo-counterfactual.mjs`는 기존 `buildSkinMatchDecisionBundle`, `buildRecommendationProductFromSource`, `fixtures/recommendation-metadata/products-v1.json`(164개), `fixtures/recommendation-metadata/user-scenarios-v1.json`(12개)을 **그대로 사용**한다. 기존 검증과 동일한 제품 정렬을 유지한다.

`scripts/facelab/skin/skin-photo-counterfactual-core.mjs`는 오직 `photoAnalysis.signals`에 대한 합성 가상 입력을 작성하고 두 결과의 차이만 분류한다. 자체 추천 계산기나 제품 가중치가 없다. `candidateSource`는 테스트 옵션으로만 취득하며 서비스에는 추가하지 않는다.

**비교 항목:** 8축 사진 가산점·설문점수·환경점수 보존, 고민 우선순위, Top Pick, 후보 164개 순위 및 Top 3 순위, 총 사진 가산 변화량, 허용/보류 항목. 후보 집합이 달라지면 즉시 오류로 처리하고, 가상 계산에서 사진 점수가 증가하는 경우 역시 오류다.

## 합성 사진 상태 9개 × 설문 12개

| 평가 케이스 | 핵심 관찰 | 기대 |
| --- | --- | --- |
| T01 확인된 0점만 있는 사진 | 모든 7개 축 `not_seen`, 숫자 전부 0 | 두 방식 일치 |
| T02 확실한 붉은기·유분 | 숫자와 cue/value 신뢰도 medium/high 일치 | 두 방식 일치 |
| T03 붉은기 5·신뢰도 낮음 | 숫자는 높지만 신뢰도 `low` | 붉은기 가상 가산 보류 |
| T04 모공 5·관찰 항목 없음 | 모델 numeric 존재, 축별 evidence 누락 | 모공 가상 가산 보류 |
| T05 UV 숫자 5 | 대응되는 직접 사진 cue 없음 | UV 가상 가산 보류 |
| T06 트러블 점수 모순 | numeric `5`, 명시 evidence `2` | 해당 축 가상 가산 보류 |
| T07 사진 미제공 | 자격 부적격, 설문만 존재 | 두 방식 일치 |
| T08 일부는 확인·일부는 unknown | acne=4 medium/high, redness=5 unknown | acne 유지, redness 가상 가산 보류 |
| T09 표시 상태는 unavailable이나 숫자·자격상 가능 | 구조적 모순을 주입한 **역경계 시험** | unavailable 가산 전부 보류; **현행 API 경로에서 실제 발생한다고 주장하지 않음** |

**규모:** 9개 사진 입력 × 12개 동일 사용자 설문 = **108쌍**, 기존 엔진 216회 실행. 결과에는 개인 신상, 원본 이미지, 실제 사진/사용자 답변이 없다. 공개 GitHub CI에는 테스트용 합성 케이스 집계만 출력한다.

## 확인해야 하는 안전성

1. 모든 108쌍에서 survey/environment 점수가 **동일**, 새 가상 photo 점수는 기존보다 **작거나 같아야** 한다.
2. 기존 164개 상품 후보 구성은 같아야 한다.
3. T01/T02/T07은 priority·Top Pick·순위가 기존과 같아야 한다.
4. T03/T04/T05/T06/T08/T09는 전 12상황에서 실제 사진 가산점 차이가 **감지**돼야 한다.
5. 우선순위/Top Pick 변화가 있더라도 이를 '개선'이나 '정확도 상승'으로 부르지 않는다. 독립 실제 사진 검증과 score-policy owner의 영향 심사가 우선이다.
6. 현재 서비스의 `applyPhotoWeights`, 우선순위 규칙, 제품 추천/후보, Provider, 응답/저장 API는 **전혀 바꾸지 않는다**.

## 2026-10-15 실제 자동 검사 결과 — 합성 평가 전용

GitHub PR #1322 첫 검증 HEAD `10d55bd2754e16a5cd3d908daddfe31d0a8c04bc`, [Current Main Health run 38666396723](https://github.com/gycha0109-beep/K_beauty/actions/runs/38666396723)에서 **전체 검사 PASS**. 스크립트의 JSON 출력값을 그대로 집계한 결과이며, **실제 사용자/실제 사진 성능 통계가 아니다**.

| 시험 사진 상태 | 비교 쌍 | 사진 점수 달라짐 | 1순위 고민 변화 | 최상위 제품 변화 | Top 3 순위 변화 | 전체 순위 변화 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| T01 확인한 0점 | 12 | 0 | 0 | 0 | 0 | 0 |
| T02 신뢰할 수 있는 붉은기·유분 | 12 | 0 | 0 | 0 | 0 | 0 |
| T03 낮은 신뢰도의 붉은기 5 | 12 | 12 | 3 | 4 | 5 | 10 |
| T04 직접 모공 관찰 없는데 숫자 5 | 12 | 12 | 1 | 3 | 4 | 9 |
| T05 관찰 단서 없는 UV 숫자 5 | 12 | 12 | 0 | 0 | 1 | 1 |
| T06 트러블 numeric 5 vs 근거값 2 | 12 | 12 | 0 | 2 | 3 | 12 |
| T07 사진 미제공 | 12 | 0 | 0 | 0 | 0 | 0 |
| T08 트러블 확인 + 붉은기 unknown | 12 | 12 | 3 | 4 | 5 | 10 |
| T09 unavailable + eligible 모순 주입 | 12 | 12 | 3 | 4 | 5 | 10 |
| **합계** | **108** | **72** | **10** | **17** | **23** | **52** |

*주의:* T09는 정상 Analyze 경로에서 실제 발생한다고 입증되지 않은 **의도적 역경계 시험**. T09 제외하면 **96쌍에서 1순위 7건, 최상위 제품 13건 변화**다. 케이스가 중복·고의로 위험 입력을 포함하므로 '10/108이 실제 사용자 오판율'이라는 해석 금지.

세부 사진 가산점 차이는 T03 240점, T04 240점, T05 180점, T06 240점, T08 240점, T09 240점의 **각각 12번 실행된 사진 가산점 차이의 합계**다. 이 합산 점수는 개별 사용자 점수나 실사용 지표가 아니다.

**확인된 것:** 동일한 현행 164제품과 12설문에 대해 실제 추천 엔진을 두 번 호출하여, 가상 사진 입력 차이만으로 고민 우선순위 및 추천 제품이 변할 수 있다는 사실. 기존 테스트에서 survey/environment 점수·164 후보 유지, photo 포인트 비증가, T01/T02/T07 순위 동일. 신규 S1-A 축별 검사 및 전체 Main Health, PIE 모두 PASS.

**확인되지 않은 것:** 실제 사진에서 각 신호의 거짓 양성/누락 비율, 평균 추천 개선 정도, 개인별 피부 안전성, 모델 `confidence`의 정확도 보정, 사업/제품 KPI, 공유 Vision v2의 실제 응답 비용·길이. 신규 추천 방식이 좋다는 결론 또는 운영 승인은 **내릴 수 없다**. 보안 검사 #1208은 별개 FAIL.

## 실행·차단

```sh
node scripts/facelab/skin/verify-face-lab-skin-s1-axis-evidence.mjs
node scripts/facelab/skin/verify-face-lab-s2-photo-counterfactual.mjs
node scripts/verify-current-main-health.mjs
```

본 설계는 #1319의 합성 계약 위에 올라가는 **별도 검증 단계**다. 독립 S1-A PR을 먼저 검토해야 한다. 실제 공유 Vision v2 정보가 아직 출력되지 않으므로, 이번 시험에는 **미래 명시적 관찰 메타데이터를 합성 입력으로만 넣었다**. 이를 실제 사진과 동일시할 수 없다.

**HOLD:** Provider 스키마 확대 및 2,200-token 응답 한도 검증/Style 독립성, 동의된 Human 사진 평가, 추천 scoring 적용, 저장/개인정보·S5, 보안 #1208.

Watchtower-Track: face-lab-skin
