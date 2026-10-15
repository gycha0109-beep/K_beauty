# Face Lab Style M2 — 실제 사진·조명·기기 색상 평가 프로토콜 v1

> **2026-10-15 / Draft / Style Track M2 / 운영·사진 수집 미승인**
>
> 현재 평가 스크립트는 **합성 RGB만** 사용한다. 피부색 측정 정확도, 실제 퍼스널 컬러 적합성, 피부 undertone·4/12계절 분류는 입증되지 않았다. 개발자가 실제 사진을 몰래 수집하거나 GitHub/CI에 첨부해서는 안 된다.
>
> 연결: `lib/face-lab-v2/personal-color/capture-repeatability-audit.js`, `scripts/verify-face-lab-v2-personal-color-capture-repeatability.mjs`, 기존 `photo-lab-sampling.js`/`photo-capture-comparison.js`. 기존 Skin Track S3(피부 변화 추적)와 별도이며, 이 프로토콜은 **사진 속 색 표현의 측정 일관성**만 다룬다.

## 1. 먼저 답해야 할 두 질문

1. **반복성(repeatability)**: 같은 피험자를 같은 장비·환경에서 다시 촬영해 사진상 관찰 색(Lab/ΔE76)이 얼마나 달라지는가? 조명만 바꾼 경우와 기기만 바꾼 경우도 별도 층위로 측정한다.
2. **정확도(accuracy)**: 비교 가능한 외부 참조 색 측정(조명·장비·색관리·교정 확인 포함)이 있을 때 사진으로 계산한 값의 편차를 검증할 수 있는가? **참조가 없다면 정확도는 측정 불가**다. 피부색이 사진상 따뜻해 보인다는 사실만으로 본래 undertone 또는 어울리는 색을 추정할 수 없다.

현재 도구가 계산하는 ΔE76은 **서로 다른 두 사진의 겉보기 Lab 차이**다. 본래 피부색의 변화나 참조계측 정확도 값이 아니다. 임의로 “ΔE가 작으면 정확”이라는 기준을 도입하지 않는다.

## 2. 실제 수집 전 반드시 필요한 조건

- **피험자 동의:** 연구 목적·촬영 종류·이용 범위·보유/파기·철회 방법을 명시한 동의와 성인/권리 범위 확인. 촬영 데이터의 외부 공개·모델 훈련 전용 범위 확장은 별도 승인.
- **개인정보 설계:** 사진·랜드마크·좌표·기기 일련번호·원본 EXIF·얼굴/실명 연결정보는 GitHub·CI·공개 문서·디버그 로그에 넣지 않는다. 필요한 경우 권한 분리된 비공개 보관 및 삭제 절차에 대한 승인 먼저.
- **촬영 세트:** 동일한 사람(독립 확인), 조명/촬영 조건 기록, 전면/약한 측면, 메이크업·필터·피부 가림 유무, 좌우 볼 ROI 독립 검수, 원본 이미지 방향과 미러링 표기. 기기 비교 시 기종/카메라 색처리 조건을 별도로 기록하되 평가 집계에는 식별 가능한 모델/기기 ID를 노출하지 않는다.
- **색상 참조:** 정확도를 주장하려면 별도 색 기준/교정·표준화된 촬영 및 계측 근거, 적절한 사람 평가자/전문가 검수가 필요. 패치 없는 무통제 스마트폰 사진은 참조 측정이 아니다.
- **사전 확정:** 평가 항목·촬영 프로토콜·보류 사유·평가자 간 불일치 처리·최소 표본과 승인된 기준을 데이터 확인 전에 별도 결정한다. 합성 테스트의 결과를 근거로 허용 오차나 임상적 판단 기준을 만들어내지 않는다.

## 3. 권장 반복 촬영 표준 구성

동일 참가자에 대해 승인된 사설 평가 환경에서 다음을 **서로 다른 비교 범주**로 관리한다.

| 범주 | 비교 방법 | 해석 범위 |
| --- | --- | --- |
| controlled_repeat | 동일 기기·동일 통제 조명·독립 반복 촬영 | 사진상 색값 반복성 |
| lighting_stress | 동일 기기·서로 다른 사전 정의 통제 조명 | 조명 영향 민감도 |
| device_stress | 조명 통제·서로 다른 기기 | 기기별 색처리 영향 |
| combined_stress | 통제된 조명 변경 + 기기 변경 | 복합 환경 변화 관찰 |
| HOLD | 얼굴 흐림·볼 가림·화이트밸런스 불명/컬러 오염·ROI 미승인·동일인 확인 불가·원본 방향 불명 | 결과를 유효 비교/정확도라고 표시하지 않음 |

*통제 조명 변경*은 연구자가 두 조명 조건을 알고 기록했다는 뜻일 뿐, 두 촬영의 Lab 값을 동일 기준이라고 보장하지 않는다. 스트레스 시험에는 ΔE를 기록하되 피부 개선/정확도/퍼스널 컬러 적합성의 근거로 사용하지 않는다.

## 4. 기존 M2 입력 → 평가 처리

```text
동의한 비공개 사진 (승인된 기기/환경에서만)
  → 단일 Face Lab Vision 관찰, 정규화·품질 보류
  → 독립 검수된 왼쪽/오른쪽 볼 ROI + 제외 마스크
  → 인메모리 RGB → Lab/LCH (measurement_only)
  → 두 촬영의 측정값 + 최소한의 촬영 비교 증거
  → capture-repeatability-audit (evaluation_only / HOLD)
  → 시나리오별 비교 개수·ΔE76 중앙값·보류 사유만 집계
```

이 평가 코드는 실사진 파일을 불러오거나 저장하는 기능이 없다. 기존 ROI 제안은 `proposal_only`이며 피부 영역 검증을 자동 승인하지 않는다. 승인된 평가 절차가 마련되기 전 실제 사진 처리/제공은 **HOLD**다.

### 순수 평가 계약

`evaluatePersonalColorCapturePair({ baseline, followup, context })`

- `baseline`과 `followup`: 이미 검증한 M2 `observation`과 `measurement` **두 키만** 포함. 원본 사진·EXIF·ID·좌표·랜드마크 입력 거부.
- `context`: `subjectReview`, `roiReview`, `orientation`, `lightingRelation`, `deviceRelation` 다섯 필드만. 모든 비교 근거는 실제 독립 검수 시스템에서 승인되어야 한다. 단순한 문자열 값을 소프트웨어가 실제 사람/ROI 검수 증명으로 간주하지 않는다.
- 출력: `status=evaluation_only` 또는 `insufficient_evidence`. 허용한 경우 `controlled_repeat / lighting_stress / device_stress / combined_stress`, 구역별 ΔL/Δa/Δb/ΔE76.
- `calibratedColorAccuracy`, `repeatabilityVerdict`, `undertone`, `seasonCandidate`, `suitability`는 **항상 null**. `sameSubjectVerified=false`이며 실제 동일인 판정의 증명이 아니다.
- `summarizePersonalColorCapturePairs`: 최대 100쌍/호출의 순수 집계. 식별자나 원본 입력 내용을 출력하지 않는다.

## 5. 검증 결과 판정 및 중단 규칙

**현재 가능한 것**
- 합성 RGB로 동일 사진·웜 조명 스트레스·기기 스트레스·복합 스트레스 값 변화 검증
- 얼굴 품질, 화이트밸런스, 필터, 메이크업, ROI 미검수, 미러링, 피험자 동일성 미확인 시 안전한 보류
- 입력에 사진 bytes, 원본 파일 경로, 개인 식별용 metadata가 추가된 경우 거절
- 동일한 입력의 결정론성, 실사진 0건·참조계측 0건 상태 명시

**아직 증명할 수 없는 것**
- 실제 촬영 사진에서의 색온도/명도/채도 축별 정확도와 재촬영 편차
- 기기별 편향 또는 광원/화이트밸런스 보정의 일반화 성능
- 전문가가 인정한 개인 퍼스널 컬러 및 화장품 Shade 적합성

**중단:** 동의·원본 처리·비공개 저장/권한·교정·실제 기기/전문가 평가가 필요한 시점에 관련 외부 권한이 없으면 그 평가만 HOLD한다. 테스트·문서·모의 데이터 분석은 계속한다. 보안 공급망 이슈 #1208은 별도 운영 게이트로 유지하며 병합·배포 또는 후보 엔진 활성화를 자동 승인하지 않는다.

## 6. 재현 명령

`node scripts/verify-face-lab-v2-personal-color-capture-repeatability.mjs`

기존 `node scripts/verify-face-lab-v2-foundation.mjs`에도 포함되어 있다. 실제 CI exact HEAD를 보고 PASS/FAIL을 판정한다. 이 명령만 성공해도 **제품 정확도 READY로 표기하지 않는다**.
