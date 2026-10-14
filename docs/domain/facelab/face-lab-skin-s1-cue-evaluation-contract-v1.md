# [Face Lab / Skin] S1 독립 피부 단서 평가 계약 v1

> **상태:** Synthetic-only 평가 인프라 / 실사진·Human 정확도 승인 이전. 2026-10-14. 기준 `main@1a82cf9961f4fbba30d1d59f1ec2de1a3c6dd7e2`. S1의 평가 도구 준비 단계이지 **S1 DoD 완료가 아니다**.
> **오너:** Skin Track. Style Track, Production recommendation/scoring, Provider 및 저장 경로에는 연결되지 않는다.

## 1. 실제 평가 질문

1. 얼굴 피부에서 **눈으로 볼 수 있는 단서**가 독립 Human 관찰과 일치하는가?
2. 이미지 품질·조명·화이트밸런스·각도·화장·필터·가림·해상도·기기 변화에 따라 과도한 확신/오탐이 증가하는가?
3. 관찰되지 않은 단서와, 관찰 가능했지만 실제로 보이지 않은 단서를 **다른 값**으로 취급하는가?
4. 판단할 근거가 없는 경우 보류(ABSTAIN)하는가? 특정 축의 보류가 전체 사진 자격 판정과 별도로 작동하는가?

**금지:** 사진 한 장에서 피부 장벽 기능, 실제 수분량, 피지량, 질병, UV 손상, 원인/제품 부작용을 의료적으로 진단하지 않는다. 내부 `barrier/dehydration/acne` 축의 Human reference는 각각 **표면 부담 표현/건조해 보이는 표면/스팟처럼 보이는 흔적** 등 가시 단서로만 정의해야 한다. `uv`는 현행 Vision observation key에 없으므로 사진 기반 정확도 점검 축에서 제외한다.

## 2. 관찰 축과 참조 정의

| 내부 축 | 독립 관찰 대상 | 측정하지 않는 것 |
| --- | --- | --- |
| `oiliness` | 표면 광택·반사 | 피지 분비량/지성 피부 확진 |
| `dehydration` | 들뜸·메마른 듯한 피부 결·눈에 띄는 각질 | 실제 피부 수분도 |
| `acne` | 눈에 보이는 spots/blemish appearance | 여드름 질환 확진 |
| `uneven_tone` | 표면 내 시각적 톤 차이 | 색소 질환 원인 또는 Personal Color |
| `pores` | 해당 촬영 조건에서의 모공 가시성 | 크기 측정/조직학적 상태 |
| `redness` | 붉게 보이는 부위 | 염증·홍조 질환 확진 |
| `barrier` | 제한된 표면 자극·거침 표현 | 장벽 기능 검사, TEWL |

기존 Vision `surface_shine/dry_texture/visible_flaking/red_appearance/active_spots/pore_visibility/tone_variation/surface_stress`의 가시적 정의 범위에서만 대조한다.

## 3. 데이터 권위 분리

`generation intent ≠ vision observation ≠ Human judgment ≠ promotion`과 `synthetic ≠ real-human` 유지.

- **Raw photo:** 별도 승인된 비공개 환경에 보관. 촬영 동의, 2차 이용, 보유기간, 철회, 접근권한, 삭제 정책 전에는 수집·Git 커밋·공개 CI 사용 금지.
- **Human reference:** 원본 사진을 보고 독립적으로 판단한 결과. 모델 점수, 생성 목표, 예상 정답, 설문, 제품 정보는 blind reviewer에게 노출하지 않는다. 주석 불일치/판정불가를 강제로 yes/no로 합의시키지 않는다.
- **Vision predicted evidence:** 현재 Provider/Normalizer 결과에서 독립적으로 export한 후보. 현행 숫자 0은 `absent`로 자동 변환 **금지**. 미래 interpretation policy가 approved되기 전에는 `abstain` 또는 `unsupported` 문제 자체를 보고한다.
- **Evaluation record:** 사용자를 알 수 없는 `caseId`, `subjectGroupId`, 촬영 조건 태그, 신호별 Human reference 및 model prediction **메타데이터만** 오프라인 엔진으로 입력한다. 이름/얼굴/이미지/URL/원본 바이너리/의료정보 없음.

## 4. 입력 계약

파일 형태: 로컬 JSON (비공개 위치), `schemaVersion = skin-cue-evaluation-v1`, `evidenceFamily = synthetic | human_review`, `datasetId`, `cases[]`.

Case: `{caseId, subjectGroupId, captureTags: [...], signals: {axis:{reference:{assessability,cue},prediction:{cue,confidence,rawScore}}}}`.

- `reference.assessability`: `assessable | not_assessable | ambiguous`
- `reference.cue`: assessable일 때 `present | absent`, 나머지는 반드시 `null`.
- `prediction.cue`: `present | absent | abstain` (모델의 Raw 0–5를 바로 해석하지 않음).
- `prediction.confidence`: `low | medium | high | unknown`. Confidence는 판정 근거를 나타내는 것이지 accuracy calibration 승인값이 아니다.
- `prediction.rawScore`: `null` 또는 0–5의 정수. 이 수치로 negative/positive를 자동 생성하지 않는다.
- `captureTags`: `baseline, low_light, strong_glare, white_balance_shift, angle_change, makeup_present, filter_suspected, skin_occluded, low_resolution, different_device, controlled_repeat`.

데이터셋 전용 메타데이터에만 입력. 실제 이미지·개인정보·URL 같은 예기치 않은 추가 필드는 fail-closed로 거절. 의도적 axis 누락은 0으로 보완하지 않고 별도 누락으로 남긴다. 범위/학습 대상 편향은 입력 코호트 구성 책임이며 평가 함수가 임의로 보정하지 않는다.

## 5. 평가 지표와 보류 정책

평가 단위는 **신호 축 × 케이스 × 촬영 조건**.

- Assessable reference에서만 TP/TN/FP/FN 계산.
- Positive precision = TP/(TP+FP), recall = TP/(TP+FN), FPR = FP/(FP+TN), FNR = FN/(FN+TP).
- Coverage = 결정된 TP/TN/FP/FN 건수 / assessable 건수.
- Abstain rate = assessable에서 모델이 보류한 건수 / assessable 건수.
- Unknown reference rate = (not_assessable + ambiguous) / 전체 참조 건수.
- Unsupported assertion rate = 참조 판단불가인데 모델이 단정한 건수 / 참조 판단불가 건수. high-confidence unsupported count 별도.
- 분모 0이면 0%가 아닌 `null`(평가 불가).
- `captureTags`별 동일 분할 수치를 함께 기록. 특정 취약 조건 결과를 전체 평균으로 은폐하지 않는다.

**주의:** 이 지표는 예측을 별도 계약에 따라 명시적으로 분류한 후에만 의미가 있다. 현행 `signals[axis]=0`은 모호한 입력이므로 자동으로 `absent` 처리하여 정확도처럼 보고하지 않는다.

## 6. 사용 방법과 테스트

- Fixture-only: `node scripts/facelab/skin/verify-face-lab-skin-s1-cue-evaluation.mjs`.
- 동의·권한이 확보된 뒤 승인된 metadata-only JSON으로 `node scripts/facelab/skin/evaluate-skin-cues.mjs /private/approved/skin-cue-manifest.json`.
- CLI는 결과를 stdout으로만 반환하고 외부 Provider, DB, 사용자 사진, 저장 스키마를 호출하지 않는다. 결과 `realPhotoAccuracyCertified=false` / `productionActivationAuthorized=false` 고정.
- Existing Current Main Health 실행 체인에 synthetic-only verifier만 **단일 추가**, 새 CI workflow 없음.
- 각 사례의 독립 annotation provenance, labeler disagreement, consent/retention 계약 검증은 현재 evaluator 외부의 Human governance gate.

## 7. 출시에 필요한 독립 검증 (HOLD)

1. 표본 다양성 및 수집 권리 승인, 독립 평가자/맹검 프로토콜, axis별 구체적 관찰 앵커/부재 정의와 합의 기준.
2. 조명/기기/화장/필터/피부톤·해상도 stratified Human 결과 및 확신도 보정, 반복성.
3. Product/score safety layer와 최종 행동이 거짓 사진 주장에 민감하지 않은지 별도 S2 권위.
4. 외부 held-out set, leak-free 데이터 관리/고지, S4 모바일 실제 촬영 인수, S5 security/운영 승인.
5. `#1208` SCA 차단 해제는 해당 security owner만. 이 PR에서 provider/score/DB/Auth/RLS/Privacy/Style 변경 금지.

**현재 판단:** S1 평가 도구 준비 가능, **S1 accuracy/DoD = HOLD**. 합성 PASS를 실사진 결과나 의학적 판독 신뢰도로 승격하지 않는다.

Watchtower-Track: face-lab-skin
