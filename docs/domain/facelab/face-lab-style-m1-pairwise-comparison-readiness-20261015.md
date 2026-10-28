# Face Lab Style M1 — 블라인드 비교 식별 가능성 및 평가 준비성 감사 (2026-10-15)

> **상태:** 결정론적 synthetic 진단 / 운영 추천 정책 불변 / Human 판단 없음.
> **권위:** `FACE_LAB_V2_STYLE_ROADMAP.md` Draft #1277 M1, `face-lab-v2-vcandidate-personalization-design-v1.md`, 기존 Human pairwise contract. 최신 제품 코드/검증이 문서보다 우선.
> **기준선:** `main@1a82cf9961f4fbba30d1d59f1ec2de1a3c6dd7e2`, 기존 vCurrent / 비활성 vCandidate-1을 변경하지 않음.

## 1. 확인된 비교 구조

- 평가 코호트는 합성 **8개 얼굴 × 12개 Target = 96개**이다. 스타일 판단의 사람 기준 정확도는 이 수치로 증명되지 않는다.
- 블라인드 Human 준비 자료 **14쌍**은 목적이 다른 3개 bucket으로 구성된다.
- `route_mutation`: **5쌍**, A/B 추천 digest 상이 — 엔진 간 차이를 비교할 수 있는 후보.
- `activation_boundary`: **3쌍**, A/B 추천 digest 동일 — 후보 relation이 작동해도 실제 선택 경로가 같아지는 경계 대조군.
- `high_repetition`: **6쌍**, A/B 추천 digest 동일 — classic, mature_calm, minimal, natural, sophisticated, trendy에 대한 반복 추천 진단 대조군.
- 합계 **직접 A/B 차이를 판정할 수 있는 쌍 5 / 동일 추천 쌍 9**. **동일 추천 쌍에서 A 또는 B 선호를 candidate의 개선 증거로 계산하면 안 된다.**

이 수치는 `scripts/verify-face-lab-v2-style-m1-pairwise-readiness.mjs`에서 **현재 실제 패킷 생성기/운영자 manifest/평가 엔진**을 함께 실행해 확인한다. 리뷰어에게 운영자 A/B 매핑을 공개하지 않는다.

## 2. 해석의 경계

1. A/B가 동일한 9쌍은 품질이 좋거나 나쁘다는 증거가 아니다. 오염, 무의미한 강제 선택, 평가 인터페이스 동작과 응답 일관성의 대조군 역할을 할 수 있다.
2. 동일 Target에서 서로 다른 얼굴에게 동일 추천이 나온 사실은 **genericity 가설**이지 실제 미용적 결함 확정이 아니다.
3. 얼굴만으로 현재 헤어/메이크업/액세서리 사용 상태를 추론하여 `Current Styling Baseline`을 채우지 않는다.
4. Human 평가 0건이므로 vCandidate 승격·우열·정량 정확도를 선언할 수 없다.
5. 실제 사람 평가 시 동의/저장/참가자 독립성/봉인 후 reveal 승인은 기존 #1242의 HOLD를 유지한다.

## 3. M1 다음 실행

- **즉시 가능:** 본 synthetic 평가 게이트 유지, vCurrent 회귀·candidate relation lineage·scope/constraints 회귀, 블라인드 packet/manifest 역할 분리를 계속 검증.
- **Human 필요:** 구별 가능한 5쌍은 target fit / specificity / evidence–action linkage에 대해 독립 Human 판단. 동일한 9쌍은 *직접 비교 불가능* 상태로 따로 집계한다.
- **후속 연구:** 반복 추천의 실제 문제 여부는 *동일 Target, 서로 다른 얼굴*을 나란히 보며 action fit을 판단할 수 있는 **별도 cross-face 검토 프로토콜**로 검증한다. 이 구조는 새 사용자 사진/참가자 동의 및 평가 도구 승인 전 실제 실행하지 않는다.
- **향후 개선:** 실제 평가에서 필요한 것으로 입증될 경우에만 vCandidate-2 `Current Styling Baseline`(자가 보고, `unknown` 가능)과 `Current Styling Gap` 후보를 설계한다. Production Style Delta/route authority 변경은 별도 PR·Human 판정 후 승격 심사.

## 4. 검증

`node scripts/verify-face-lab-v2-style-m1-pairwise-readiness.mjs`

**완료 기준:** 96개 deterministic sample, reviewer packet 14쌍, 구별 가능한 5쌍/동일 9쌍, 6개 반복 Target, 운영자 매핑 유출 0. 이 테스트 PASS는 사람 평가 PASS가 아니다.

**보호:** 개인정보/사진/Provider/Auth/DB/Storage/Security/Payment/Production 변경 없음. 병합·배포 HOLD 및 SCA #1208 유지.
