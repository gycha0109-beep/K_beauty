# Face Lab Style Check — SC-05 실사진·Human 평가 준비 프로토콜

> 2026-10-22 · Status: **PROTOCOL ONLY / NO REAL-PERSON STUDY EXECUTED BY THIS CHANGE**
> Source baseline: `FACE_LAB_STYLE_CHECK_EXECUTION_ROADMAP_R2_20261022.md`, `FACE_LAB_EVALUATION_STRATEGY.md`, existing `face-lab-v2-recommendation-human-pairwise-contract-v1.md`.
> 기술 테스트 통과 ≠ 실제 얼굴 관찰 정확도 ≠ 미적/스타일 추천 품질 합격 ≠ 실서비스 승격.

## 1. 범위와 기존 평가 자산의 재사용

Style Check의 품질에는 서로 다른 두 질문이 있다.

1. **Observation validity**: 사진의 윤곽·세로 비율·눈·이목구비 배치·시각 대비·사진상 Color 단서가 실제로 관찰 가능한가? 보류 시 보류됐는가?
2. **Recommendation usefulness**: 동일 근거와 사용자의 명시 Target에서 Hair / Brow / Makeup / Color / Grooming / Eyewear / Accessories의 제안이 구체적·실행 가능하며 원하는 스타일을 향하는가?

기존 V2 Human Pairwise Contract의 `target_fit`, `specificity`, `evidence_action_linkage`와 불확실성/판정 보류, blind A/B, sealed judgment→role reveal을 **그대로 사용**한다.

이미 있는 Human Pairwise Review Builder의 14쌍은 **구조화 synthetic observation 기반 기존 Candidate/current 추천 비교**다. 이 14쌍을 실제 사진 표본, 실제 사람 선호 판단 또는 인구집단 근거로 재표기하지 않는다. 이 SC-05 작업은 기존 Builder·schema를 변경하지 않는다.

## 2. 조사 표본 (계획; 실사진 수집/촬영 작업 아님)

**단위**: 사람= `subjectGroupRef`, 촬영·변형 family=`derivationFamilyRef`, 평가 자료=`sampleRef` (모두 비식별 토큰).

- 전면 선명한 사진 / 소폭 yaw / 부분 가림 / 부드럽거나 흐린 화질 / 저조도 / 불균일 광원 / 색 정보 부적합 / 화장된 사진을 고려한다.
- 6개 원천 observation 그룹: `outline`, `vertical`, `eyes`, `featureLayout`, `visualLanguage`, `colorAppearance`. 유효성은 22개 필드별 `available | insufficient_evidence | unavailable`와 보류 사유를 따로 평가한다.
- Current Face Profile의 대표 특징 8개와 구조적 측정 16개는 중복하는 source가 있다. 모든 22개가 실제 추천에 적용된다고 가정하지 않는다.
- Face Harmony의 현재 production-authorized modifier는 `eyeDirection`, `featureContrast`, `contourDefinition`, `straightCurveBalance` 네 근거만 평가 우선 항목으로 고정한다. SC-04 synthetic CI에서 각 적용 조건에 해당하는 사례가 적다는 사실을 반영해 경계 사례를 별도로 확보한다.
- **실사진 사진/식별정보/얼굴 임베딩은 표본 계획 JSON, GitHub PR, CI logs에 두지 않는다.** 실제 사진 접근 경로는 별도 보호 영역에서만 다루며 이 PR에 구현하지 않는다.

## 3. 사전 권한·개인정보 게이트

1. **별도의 명시적 평가 동의**: 일반 서비스 사진 업로드/분석 동의는 연구 평가 데이터 사용 동의를 대체하지 않는다.
2. **권리 확인**: 평가 목적, 공유 범위, 평가자 접근, retention 및 삭제/철회 방법을 실제 운영자가 확인한다. 코드에서 `operator_attested` 문자열이 존재한다는 사실만으로 권리가 성립했다고 주장하지 않는다.
3. **자료 분리**: production saved report/skin-match snapshot에는 평가 원본 사진·crop·평가자 메모·subject group을 추가하지 않는다.
4. **Subject/family 단위 holdout**: 동일 인물, 같은 원본/촬영 family·파생 variant는 개발과 locked holdout을 가로지르면 안 된다. 특정 family hash가 유사 사진임을 자동 증명하는 것은 아니므로 외부 근접중복 검사/사람 확인 필요.
5. **독립 평가자**: locked holdout에서 observation 및 recommendation 과제 각각 최소 **2개의 서로 다른 평가자 할당**. 계획 할당은 실제 평가 완료의 증거가 아니다.
6. **블라인드**: 이미 존재하는 6개의 `FACE_LAB_V2_HUMAN_PAIRWISE_BLIND_STATE` 플래그 유지. A/B 역할의 operator manifest를 평가자에게 사전 공개하지 않는다.
7. **판정 정직성**: `uncertain`, `not_assessable`과 상충 판단을 그대로 보존한다. 평점이 불명확하면 강제로 winner를 만들지 않는다.

## 4. 추천 평가 과제 분리

| 과제 | 질문 | Authority |
|---|---|---|
| 독립 사진 관찰 | 특정 눈매·윤곽·얼굴 구조가 실제 사진에서 읽히는가 | Blind human visual cue + observation field evidence |
| 불확실성/재현성 | 촬영 상황이 바뀌어도 유지되는 특징인가, 보류가 적절한가 | repeat capture + independent review |
| 추천 Target 적합성 | 명시 Target과 사용자 제약을 반영하는가 | Human pairwise target_fit |
| 추천 구체성 | 얼굴 근거 없이 반복하는 일반적인 템플릿과 구분되는가 | Human pairwise specificity |
| 근거→행동 연결 | 눈·이목구비·선 대비 등 확인된 특징이 해당 Hair/Makeup 행동과 논리적으로 연결되는가 | Human pairwise evidence_action_linkage |
| 하드 제약 | 선택하지 않은 영역·금지 영역이 실행에서 배제되는가 | SC-02/03/04 CI + 수동 후기 확인 |

**Color 주의**: 화이트밸런스, 조명, 화장 부적합 사진을 피부색 정답이나 계절형 퍼스널컬러 라벨로 승격하지 않는다. 볼 ROI v3는 독립 Color 연구다.

## 5. 데이터 흐름과 기술 게이트

```text
Operator-controlled consent/rights + deletion procedures
  → pseudonymous, split-safe sample plan
  → protected real-photo assets (outside GitHub/SC-05 verifier)
  → independent blind observation & review (existing contracts)
  → independent sealed Human A/B judgments
  → only after seal: operator-only A/B role mapping reveal
  → per-dimension disagreement/uncertainty/hold summaries
  → locked real holdout analysis without retuning
  → separate product/release authorization
```

이번 PR의 `auditStyleCheckRealStudyPreflight()`는 오직 **첫 번째 sample-plan 구조 게이트**다.
- 반환값은 검증 상태, 오류 코드, 영역/촬영조건별 존재 여부와 할당 건수만.
- 입력에 `rawImage`, `imageUrl`, 생성되지 않은 관찰 필드, 미등록 reviewer/rights 필드가 포함되면 검증 실패.
- 문서/코드의 synthetic 예시에서 2개 샘플을 사용할 수 있으나 **실사진 평가 완료 건수는 0**.
- 실사 권한 운영자 확인, sealed Human 판단 수집, holdout 잠금, 합격 수치의 선행 등록은 이 코드가 자동 완료시키지 않는다.
- `productionAuthorization:false`와 `pilotExecutionAuthorized:false`는 이 계약에서 상수로 유지한다.

## 6. 실제 평가 전 준비 게이트

- 연구 데이터 목적·보관·삭제·철회·보호 영역 승인
- 실제 이미지에 대한 권리 검증, 복수 리뷰어 사전 배정, 데이터 분할 및 중복 검사
- 필드별 평가 설문과 Pairwise 리뷰어 UI가 각각 접근 권한을 지키는지 별도 E2E
- locked holdout을 측정하기 **전** 일치도/보류율/각 dimension 리뷰 단위와 판단 기준을 선행 등록
- 스타일 권고 오류·차별적 외모 규범·이용자 추구미 권한 침해 가능성에 대한 human adjudication
- 연구결과를 전환율/구매 추천/기능성·피부상태 판단에 자동 사용하지 않음

## 7. 현 단계에서 결론낼 수 있는 것

- `SC-02/03/04`: 기술적 lineage, 22개 필드 coverage, 4개 얼굴 modifier의 controlled counterfactual은 synthetic regression으로 관찰 가능.
- `SC-05`: 연구 계획 구조가 leakage/권한/블라인드/할당 조건을 만족하는지만 자동 검사 가능.
- *아직 결론낼 수 없는 것*: Style Check가 실사진 얼굴 특징을 정확히 식별한다거나 사용자가 실제로 만족하는 스타일을 추천한다는 주장.

**다음 작업**: 운영 승인된 별도 보호 영역에서 실제 사진과 독립 사람 평가를 준비한 후, 기존 sealed Human 계약을 통해 결과를 분석해야 한다. 본 문서만으로 실제 수집·모델 변경·실서비스 활성화는 승인되지 않는다.
