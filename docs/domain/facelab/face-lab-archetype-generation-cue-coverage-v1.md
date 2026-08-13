# Face Lab Archetype Generation Cue Coverage v1

## 0. 상태

이 문서는 `FACE-EVAL-CG — Archetype Generation Cue Coverage Enablement`의 구현 authority다.

기준:

- FACE-EVAL-C contract: `face-lab-archetype-synthetic-stress-campaign-v1`
- Archetype registry: `face-lab-archetype-rubric-20260727`
- legacy feature cue profile: `face-feature-cues-v1`
- Archetype stress feature cue profile: `face-feature-cues-v2`
- Archetype taxonomy metadata version: `face-lab-archetype-taxonomy-v1`

이 문서는 FACE-EVAL-C contract의 **초기 readiness snapshot**을 대체하는 현재 구현 상태를 기록한다. 초기 contract에서 확인된 generation cue gap은 C-G에서 해소한다.

현재 목표 상태:

```text
campaignExecutionReady = true
Provider calls = 0
Synthetic writes = 0
Hosted writes = 0
```

`campaignExecutionReady=true`는 generation/contract layer가 stress scenario를 표현할 수 있다는 뜻일 뿐, synthetic campaign이 실행됐거나 calibration이 완료됐다는 뜻이 아니다.

---

## 1. 변경 원칙

기존 skin-cue pilot의 `face-feature-cues-v1`은 변경하지 않는다.

새 Archetype stress 기능은 별도 versioned profile을 사용한다.

```text
face-feature-cues-v1
→ historical / existing generic feature-control compatibility

face-feature-cues-v2
→ current Archetype stress rubric coverage
```

기존 A/B/C/D compiled prompt snapshot은 byte-identical이어야 한다.

---

## 2. v2 Visible Cue Registry

`face-feature-cues-v2`는 현재 Archetype rubric이 실제로 참조하는 visible observation axis를 모두 포함한다.

### outline

- `faceShape`
- `jawlineAngularity`
- `jawTaper`
- `cheekboneProminence`

### vertical

- `faceLengthBalance`

### eyes

- `eyeDirection`
- `eyeLength`
- `eyeOpenness`

### featureLayout

- `featureScale`
- `featureConcentration`

### visualLanguage

- `straightCurveBalance`
- `contourDefinition`
- `featureContrast`

Enum token은 Face Lab observation contract의 해당 observable enum과 일치해야 한다.

---

## 3. 이전 Gap 해소

FACE-EVAL-C contract freeze 시점의 missing rubric axes:

```text
cheekboneProminence
contourDefinition
eyeLength
faceShape
featureConcentration
featureScale
jawTaper
```

C-G 이후 expected missing rubric axes:

```text
[]
```

초기 missing required axes:

```text
contourDefinition
eyeLength
faceShape
featureConcentration
featureScale
```

C-G 이후 expected missing required axes:

```text
[]
```

---

## 4. Archetype Metadata Registry

현재 stress metadata taxonomy는 다음 7개 key만 허용한다.

```text
wolf
cat
puppy
deer
tofu
potato
dino
```

버전:

```text
face-lab-archetype-taxonomy-v1
```

이 registry는 generation metadata validation용이다.

Production taxonomy validation 또는 calibration 완료를 의미하지 않는다.

---

## 5. Metadata-only Boundary

`archetypeIntent`는 다음 형태의 campaign provenance용 metadata다.

- taxonomy version
- primary
- optional secondary
- intended weights basis points
- compilation mode

필수:

```text
compilationMode = metadata_only
```

Prompt compiler는 다음을 읽지 않는다.

```text
archetypeIntent.primary
archetypeIntent.secondary
```

따라서 다음과 같은 직접 prompt leakage는 금지된다.

```text
cat face
wolf face
puppy face
...
```

실제 prompt는 `featureIntent.cues`의 visible cue만 중립적 문장으로 컴파일한다.

---

## 6. Purpose Isolation

새 generation purpose:

```text
archetype_stress
```

`archetypeIntent`는 이 purpose에서만 허용한다.

다른 purpose에 Archetype metadata를 붙여 기존 generation semantics를 우회할 수 없다.

`archetype_stress` 조건:

- feature intent 존재
- `face-feature-cues-v2`
- Archetype metadata 존재
- skin stress cue 없음
- independent generation
- metadata-only compilation

위 조건이 깨지면 fail closed 한다.

---

## 7. v1 Compatibility

C-G는 기존 `face-feature-cues-v1`을 유지한다.

검증 대상:

- 기존 A/B/C/D GenerationSpec validation
- Gemini manual A/B/C/D positive prompt snapshots
- 기존 provider profile behavior
- paired skin edit behavior
- legacy skin-cue campaign behavior

기대:

```text
legacyPromptSnapshots = byte_invariant
```

---

## 8. Stress Draft Validation

현재 7개 Archetype 각각에 대해 최소 required-axis stress draft를 구성할 수 있어야 한다.

예:

```text
wolf
  eyeLength=long
  straightCurveBalance=straight

cat
  eyeDirection=upturned
  featureConcentration=centered

puppy
  eyeOpenness=medium|wide
  straightCurveBalance=curved

...
```

여기서 expected value 선택은 generation stress target일 뿐 Human truth가 아니다.

---

## 9. Prompt Compilation

Prompt phrase는 visible structure만 기술한다.

예:

```text
visibly long horizontal eye length
facial features visibly concentrated toward the center
soft visible facial contour definition
```

다음은 넣지 않는다.

- animal archetype token
- personality
- physiognomy
- health
- beauty ranking
- ethnicity inference
- celebrity similarity

---

## 10. Readiness Definition

C-G의 `campaignExecutionReady=true` 조건:

1. current registry의 모든 indicator axis가 v2 generation cue registry에 존재
2. 모든 indicator expected enum이 v2 registry에 존재
3. 모든 required axis coverage 존재
4. 7-key taxonomy metadata registry 활성
5. `archetype_stress` purpose isolation PASS
6. prompt에 raw Archetype token 없음
7. legacy v1 prompt snapshots byte-invariant
8. scorer lifecycle / thresholds 변경 없음

이 조건은 deterministic verifier로 확인한다.

---

## 11. 명시적 비범위

C-G에서는 하지 않는다.

- Provider call
- 실제 image generation
- synthetic candidate import
- Human judgment
- scorer weight 변경
- threshold 숫자 선택
- `calibrationStatus=ready`
- production Archetype activation
- API/UI wiring
- DB migration
- Hosted write

---

## 12. 다음 Gate

C-G가 merge된 뒤:

```text
FACE-EVAL-CS — Synthetic Archetype Stress Scenario Freeze
```

여기서 실제 실행 전에 다음을 freeze한다.

- scenario matrix
- required-axis cases
- contradiction cases
- missing-axis/low-evidence cases
- close-pair boundary cases
- stability variants
- subject/presentation strata
- provider profile
- generation budget
- source/version digest

그 다음에만 controlled synthetic generation을 시작한다.

---

## 13. Production Separation

```text
Generation cue coverage ready
!= Synthetic campaign executed
!= Synthetic alignment passed
!= Real Human calibration ready
!= Weight/threshold calibrated
!= Locked holdout passed
!= Production activated
```

Production activation은 여전히 별도 최종 gate다.
