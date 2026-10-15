# Face Lab / Skin S1-A — 항목별 관찰/0점 분리 계약 및 합성 검증 (2026-10-15)

> **상태:** 평가 전용 초안. Skin 사진 추천 엔진/공용 Vision 계약/실제 분석 결과에는 연결하지 않음. `main@1a82cf9961f4fbba30d1d59f1ec2de1a3c6dd7e2` 기준. 관련 로드맵 #1307, 설계 #1317. **실사진 정확도, 피부질환 진단, 추천 정책 승인 아님.**

## 1. 무엇을 추가했는가

- `scripts/facelab/skin/skin-axis-evidence-contract-core.mjs`: **평가 전용** 7개 피부 사진 단서 축의 명시적 관찰 계약 검사기.
- `scripts/facelab/skin/verify-face-lab-skin-s1-axis-evidence.mjs`: 누락/부적격/저신뢰/잘못된 축·신호·중복 등에 대한 합성 회귀 검사.
- `scripts/verify-current-main-health.mjs`: 기존 전체 건강 검사에 위 회귀 검사를 추가. 단일 Vision 호출이나 추천 엔진에는 모듈을 연결하지 않음.

**현행 증거 손실:** v1 `skin.signals` 정수 `0`은 '명확히 관찰되지만 보이지 않음'과 '관찰 불가능'을 구별할 수 없다. 기존 v1 값으로 새 관찰 상태를 **역추론하지 않는다**.

## 2. 평가 전용 입력·반환

아래 단일 검사 함수의 입력은 실제 Provider 응답 형식을 교체하지 않는 **검증용 manifest**다.

```js
assessSkinAxisEvidence({
  schemaVersion: "skin-axis-evidence-v1",
  axes: [
    { axis: "oiliness", state: "present", value: 4, confidence: "high",
      cue: "surface_shine", area: "forehead", reason: "none" },
    { axis: "pores", state: "not_seen", value: 0, confidence: "medium",
      cue: "pore_visibility", area: "cheeks", reason: "none" },
    { axis: "redness", state: "unassessable", value: null, confidence: "unknown",
      cue: null, area: null, reason: "lighting" },
    // ... remaining visible axes also explicitly required
  ]
}, { photoStatus: "available", skinAnalysisEligible: true });
```

- `present` — 시각적 단서가 있는 것으로 **표시된** 축, `value` 1–5, 해당 축과 맞는 cue·부위·상태 및 low/medium/high confidence 필요. `low`는 가산 **후보가 되지 않는다**.
- `not_seen` — 모델이 해당 부위를 관찰했다고 **명시적으로** 표시하고 confidence medium/high인 경우에만 `value=0`. **정상 피부 또는 질환 없음 판정이 아니다.**
- `unassessable` — 사진 조건 때문에 판단 불가; `value=null`, 이유가 명시되어야 한다.
- `unknown` — 값 누락·구분 불능·과거 v1·잘못된 형식; `value=null`.

반환 `ready`는 **형식 검사를 통과했다**는 뜻일 뿐, 실제 사진 분석이 정확하다는 뜻이 아니다. `partial`은 일부 축 거절·보류, `blocked`는 사진 전체 부적격/실패이며, `unsupported_schema`는 v1 또는 잘못된 형식이다. 거부 이유에는 개인 데이터·자유서술 원문을 남기지 않는다.

입력은 7개의 **사진에서 시각적으로 확인 가능한 축**만 취급한다: oiliness, dehydration, acne, uneven_tone, pores, redness, barrier. `uv`는 대응 가능한 단독 사진 cue가 없어서 이 계약에서 제외한다. **이 모듈은 기존 UV 점수를 변경하지 않는다.**

## 3. 구체적인 안전성 검사

| 입력/상황 | 기대 결과 |
| --- | --- |
| 관찰한 0 (`not_seen`) | 0을 명시적으로 보존, 감점·정상 확정 없이 사진 가산 후보 아님 |
| 누락된 축 / 모순 상태 / 중복 축 | 해당 축 `unknown(null)`, 축별 문제 코드, 나머지 정상 축은 유지 |
| 평가할 수 없는 축 / 잘못된 신호·지역/문자형 점수 | 해당 축 가산 후보 제외, `null`로 보류 |
| 같은 축의 점수 5 + 낮은 confidence | 시각 단서는 보존하되 사진 점수 가산 **후보 제외** |
| 사진 전체 Provider 실패/미제공/부적격/품질 불충분 | 모든 축 `unknown(null)`; 가산 후보 없음 |
| 과거 `vision-observation-v1`의 `signals.pores=0` | 절대 `not_seen`으로 소급 분류하지 않음 |
| 음성 축의 잘못된 low confidence·cue/area 불일치 | 구분 실패로 보류 |
| 알 수 없는 UV/원치 않는 자유 필드 | 거부하거나 보류; 원문은 문제 목록에 기록하지 않음 |
| 입력 관찰 7축의 순서를 변경 | 같은 정규화 결과 |
| 검증되지 않은 부분 객체를 가산 후보 함수에 직접 전달 | 인정 금지 |

**제한:** 임의 Provider JSON의 동일 키 중복은 JSON 파서가 선행 단계에서 제거할 수 있다. 본 계약은 `axes`를 **배열로 요구하여 중복 축을 식별**한다. 향후 공유 Vision 응답은 JSON 파싱의 동작과 원형 토큰 수/응답 안정성을 별도 확인해야 한다.

**제한:** `not_seen`의 cue/area/confidence 조합도 AI의 자기 보고에 불과하다. 이 검증기는 **실제 사진에서 선명한 영역이 있었는지 객관적으로 증명하지 않는다**. 그 검증은 별도 동의 기반 Human 사진 평가(S1-D) 후에만 가능하다.

## 4. 경계와 다음 작업

현재 코드는 **`scripts/` 아래 평가·검사 전용**으로만 존재한다. 서비스 사진 점수 가중치, 설문 비교, Premium UI/API, 단일 Provider, 저장·재진입, Style, DB/Auth/RLS, 실사진/개인정보, 보안 정책 **불변**이다.

검증 명령:

```sh
node scripts/facelab/skin/verify-face-lab-skin-s1-axis-evidence.mjs
node scripts/verify-current-main-health.mjs
```

두 명령의 통과 여부는 해당 PR의 실제 GitHub 검사 로그에 근거해 별도 기록한다. 코드가 있다고 실제 CI까지 통과한 것으로 보지 않는다.

**다음 B(별도 담당 검토 필요):** 기존 한 번의 공유 Vision 요청/Style 관찰 호환성 안에서 이 상태 정보를 제공할 수 있는 응답 형식·모델 출력 길이·비용·실패 경계를 평가한다. 실제 사진 호출과 Provider 계약 변경은 자동 착수하지 않는다.

**다음 C(현재 차단):** 기존 추천과 새 계약 기반 평가 계산을 **동일 관찰 결과**로 비교하고 164상품×12상황 frozen 점수/순위·Top Pick 변동량을 확인한다. 운영 적용은 별도 score-policy 권한, S1 실제 Human 검증, S5 출시 게이트 없이는 불가.

**독립 장애:** Supply Chain 보안 이슈 #1208; 해당 정책 예외 연장/비활성화 금지.

Watchtower-Track: face-lab-skin
