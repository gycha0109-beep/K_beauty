# Face Lab Style Check — SC-06C 구조 Shadow 블라인드 A/B 평가 패킷

> 2026-10-23 · SYNTHETIC PACKET ONLY · Status: **BUILD/CONTRACT VERIFICATION; NO HUMAN EVALUATION**
> 선행 PR: #1398 (SC-06B 구조 후보). 관련 계약: `human-pairwise-contract.js`, `human-pairwise-builder.js`, SC-05 실사진 연구 권한 검증.
> 역할: 기존 Current V2 추천 vs SC-06B 구조 Shadow 3가설의 **평가자에게 보이는 선택 경로**만 블라인드 A/B로 비교하는 연구 패킷 생성.

## 1. 범위 구분

- 코호트: **8개의 synthetic 구조 얼굴 × 12개 Target = 96건**. 실제 사람 얼굴 분석·이미지 파일·Human 투표·선호도 검증 **0건**.
- SC-06B의 96건 테스트에서 Shadow modifier가 동작한 **14건** 중 일부는 **선택되지 않은 다른 Route만 변경**하여 현재 기본 미리보기에서는 비교할 수 없다.
- SC-06B의 `routeChangedCases=9`는 **전체 routes 집합의 변화**이며, 이를 곧바로 사용자에게 보이는 9개의 비교쌍으로 해석하지 않는다.
- 이번 패킷은 선택 경로의 action/strategy가 실제로 다른 **7쌍**만 우선 포함한다. *선택 경로 변화가 없는 7건*은 제외한다. 이 숫자는 SC-06C 전용 평가자 가시성 기준이며 기존 SC-06B의 9건과 다른 측정치다.

## 2. 재사용한 고정 Human Pairwise 계약

- Review Item 스키마 `face-lab-v2-human-pairwise-review-item-v1`.
- 공통 3차원: `target_fit`, `specificity`, `evidence_action_linkage`.
- 선택 가능한 verdict: `A / B / tie / uncertain / not_assessable`, 평가 중단/불확실성 보존.
- Blind state 6개: engine role/version, A/B mapping, prior human judgment, LLM judgment, aggregate result hidden.
- 기존 digest 계산 및 검증 규칙, 변조 시 SHA-256 검출.

## 3. 반드시 물리적으로 분리할 두 결과물

1. `buildStyleCheckStructuralHumanReviewPacket()` → **평가자 전용**. 각 케이스는 A/B 제안, 공통 Target·출처가 있는 관찰 특징, 공통 제약, 고정 블라인드 플래그로 구성. 후보 ID·Shadow reason·운영 engineVersion/role mapping은 제거한다.
2. `buildStyleCheckStructuralHumanOperatorManifest()` → **운영자 전용**. SHA-256 digest로 연결된 A/B→current/candidate 역할, source case, 후보 relation IDs 및 샘플링 사실을 담는다. **평가자에게 배포 금지**. Human seal 전 reveal 금지.

운영자 manifest는 `blinding` 체크박스가 아니라 실제 접근 권한이 분리돼야 의미가 있다. 본 PR은 별도 백엔드/원격 저장소를 제공하지 않고 *형태와 계약*만 검증한다.

## 4. 선택 기준과 테스트

- `candidatePolicy.productionActive === false` 유지, 현재 Canonical 사용해 Current 제안 추출, 연구 전용 Shadow로 Candidate 제안 계산.
- baseline/Shadow의 **기본 선택된 Route**를 비교한다. 기본 선택은 *사용자 직접 선택*이 아니며 운영 제품의 선택으로 취급하면 안 된다.
- 후보 고유 reason/evidence가 평가자 패킷에 노출되지 않도록 **현재 Action 원문을 공통 텍스트 기초**로 투영한다. 비교되는 사실은 route/행동/강도 차이.
- 평가자에게 필요한 구조 cue가 대표 keyFeatures에 없다면, 기존 normalized source observation에서 동일 cue/evidence를 A/B 공통 context에 표시한다. 이는 **실제 얼굴 사진 검증이 아니라 synthetic 관찰 레이블**.
- A/B current 역할을 양쪽에 분산, 인위적으로 동일한 두 옵션은 배제, 여러 가설 중 `SC-STRUCT-003`처럼 실제 코호트 활성화 0건은 평가자 패킷에 끼워 넣지 않는다.
- 패킷 SHA, item SHA, manifest SHA 교차검증, role leakage, 변조 탐지 및 데이터 불변성 회귀 테스트 실행.

## 5. 평가 실행 전 남은 필수 단계

- 실사진 사용 권리/연구 동의/철회/삭제 프로토콜의 **실제** 운영 검증.
- 개발·잠금 표본의 동일인/동일 촬영 family 중복 배제, 독립 평가자 두 명 이상 배정.
- 사람에게 사진 기반 관찰 가능성과 스타일 유용성을 나누어 질문하며 Human 평가자가 판단 불가를 인정할 수 있어야 한다.
- 평가가 끝난 뒤 *sealed Human Judgment + digest binding* 통과 전 operator reveal 금지.
- A/B 결과는 `target_fit`, `specificity`, `evidence_action_linkage` 각각 독립 보고. 실사용 styling preference 또는 얼굴 관찰 정확도는 별도 실사진·사람 평가 없이 주장할 수 없음.
- **SC-07 production 활성화는 별도의 품질 기준과 정책 승인이 선행되어야 한다.**

## 6. 코드·상태

- `lib/face-lab-v2/evaluation/style-check-structural-human-pairwise-builder.js`
- `scripts/verify-face-lab-style-check-structural-human-packets-sc06c.mjs`
- `scripts/verify-face-lab-v2-foundation.mjs` 기존 CI에서 호출
- PR #1399 Draft. 운영 canonical, UI, DB, API, 사진 저장/업로드, 정책 상수는 변경하지 않았다.
