# Face Lab / Skin S1-B — v1/v2 지연시간·비용 비노출 평가 보강 (2026-10-15)

> **상태:** 합성 메타데이터 검사만 구현. 실제 Provider 지연시간·청구비용 수집 및 정확성 평가 **미실시**. 운영 1회 Vision Provider 구조, 2,200 completion token 제한, Style/Face 관찰, 추천·저장·배포 **불변**.

## 목적과 기존 작업과의 관계

- 기반: 로드맵 Draft #1307, S1-A #1319, Vision v2 후보 #1323, 응답 완결성·Face 품질 검사 #1326.
- #1326의 `inspectSkinVisionTrial`/`summarizeSkinVisionTrials`가 담당하는 종료 사유·형식·토큰·Face 관찰 품질 비교를 **재구현하지 않는다**.
- 기존 S1-B acceptance 문서가 미완료로 명시한 **실제 소요 시간·비용**을 향후 측정할 때, 비식별 숫자로 paired summary를 구성할 평가 전용 모듈을 추가한다.
- `scripts/facelab/skin/skin-vision-v2-operational-metrics.mjs`와 독립 negative verifier를 `scripts/verify-current-main-health.mjs`에 연결했다.

## 입력 계약

`summarizeSkinVisionOperationalPairs(rows, { evidenceOrigin })`은 **시험 ID, 변형, #1326에서 이미 분류한 형식 상태, 시간·비용 숫자**만 받는다.

| 필드 | 의미 |
| --- | --- |
| `caseId` | 가명화된 안전한 ID (영숫자·`_`·`-`, 최대 48자) |
| `variant` | `v1` 또는 `v2` |
| `structuralResult` | 기존 #1326 결과에서 복사한 `STRUCTURALLY_VALID` 또는 `INVALID_OR_INCOMPLETE` |
| `elapsedMs` | 별도 승인된 시험 하네스에서 측정한 응답 경과시간 정수(ms). 측정 전에는 `null` |
| `estimatedCostMicroUsd` | 운영자가 별도 계산한 비용 **추정값** (USD 백만분의 1 단위). 공식 청구비용으로 단정 금지 |
| `costSource` | `operator_estimate` 또는 `unavailable`. 근거 없으면 비용은 `null` |

`evidenceOrigin`은 `synthetic` 또는 `operator_unverified`만 사용한다. 실제 Provider 출력·원본 모델 메시지·원본 얼굴 사진·URL·사용자 식별자·자유 서술 필드는 입력에서 거절한다. 출력도 케이스 ID 없이 **건수·집계 수치와 고정 상태**만 반환한다.

### 비교 수치

- 완전한 v1/v2 쌍 개수, 양쪽 형식 정상 개수, 응답시간 측정 쌍, 비용 추정 가능 쌍
- 변형별 시간과 비용 추정의 평균·중앙값·p95·최대, `v2 - v1` 차이
- v2가 느리거나 비용 추정이 더 큰 쌍의 개수
- 일부 측정 누락 시 `MEASUREMENT_EVIDENCE_INCOMPLETE`
- 모든 숫자가 채워져도 `MEASUREMENT_CAPTURE_COMPLETE_REVIEW_REQUIRED` — 승인/비용정산/Provider 적합성 PASS는 아님

`structuralResult`는 외부에서 전달한 enum이므로 이 모듈만으로 기존 게이트 통과 사실이나 동일 사진 사용을 증명할 수 없다. 현재 결과에는 항상 `actualProviderCompatibilityVerified=false`, `productReady=false`, `releaseReady=false`가 남는다. 평균·p95는 표본에 대한 기술 통계일 뿐 성능 SLA 또는 비용 예측 근거가 아니다.

## 시험 및 안전 경계

```bash
node scripts/facelab/skin/verify-face-lab-s1b-operational-metrics.mjs
node scripts/verify-current-main-health.mjs
```

합성 부정 사례: 비용·시간 누락, 한쪽 버전 누락, 중복 케이스, 부정확한 숫자·단위 범위, 임의 Provider 확인 라벨, 얼굴 URL·원문 필드 주입 거부, 결과 ID 미노출, 순서 독립성. 로컬 단독 verifier에서 PASS; 전체 CI exact-head 판정은 해당 브랜치의 실행 결과가 나올 때 별도 확인한다.

## 계속 필요한 외부 증거

1. 공유 Vision/Style 담당자 검토 및 승인된 비운영 Provider 평가 환경
2. 동일 사진 쌍을 실제로 확인할 수 있는 동의·비공개 취급 절차
3. #1326 실제 v1/v2 종료 사유·토큰·Face 품질 비교와 별개, 경과시간 및 **확인 가능한 청구 비용** 검증
4. #1310 기반 독립 Human 피부 사진 평가 및 S2-E 추천 변경 승인
5. 보안 #1208 해결과 S4/S5 실기기/개인정보/운영 인수

실사진 없이 생성한 비용·지연시간 숫자는 합성 fixtures일 뿐 실제 평균/청구 근거로 사용하지 않는다. Provider 요청 횟수, 출력 상한, 점수, 결과 스키마, 저장 정책은 변경하지 않았다.

Watchtower-Track: face-lab-skin
