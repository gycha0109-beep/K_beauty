# Face Lab Archetype Stress Scenario Freeze v1

## 0. 상태

이 문서는 `FACE-EVAL-CS — Synthetic Archetype Stress Scenario Freeze`의 실행 전 authority다.

기준 source main:

`84cf4aec5b9cb502aa12d5733a0b1b8a582dc1fe`

현재 상태:

```text
scenario freeze = FROZEN
campaign executed = false
Provider calls = 0
Synthetic asset writes = 0
Hosted writes = 0
Human annotations = 0
```

이 freeze는 실제 generation 실행 승인이 아니다. W1 실행은 별도 operator/execution gate에서 시작한다.

---

## 1. 목적

FACE-EVAL-C와 FACE-EVAL-CG에서 다음이 준비됐다.

- stress methodology contract
- 7-key metadata-only Archetype intent
- `face-feature-cues-v2`
- current rubric axis/enum full generation coverage
- raw Archetype token prompt leakage 방지
- legacy v1 prompt snapshot invariance

FACE-EVAL-CS는 이제 실행 전에 다음을 immutable plan으로 고정한다.

- scenario matrix
- subject strata
- provider profile
- generation/observation budget
- checkpointed wave order
- offline fixture plan
- capture-stability derived transform plan
- source/version authority
- zero-write execution state

---

## 2. Authoritative Artifact

Machine-readable freeze:

`evidence/facelab/archetype-stress-scenario-freeze-v1.json`

Schema:

`face-lab-archetype-stress-scenario-freeze-v1`

Campaign:

`face-eval-c-archetype-stress-pilot-v1`

Freeze digest:

`5b137c955697badf40ba6892853bd8c7aebb456e59a1bd1efcff7e6aff3752c2`

Digest는 `freezeDigest`를 제외한 JSON semantic object를 stable key ordering으로 직렬화한 SHA-256이다.

---

## 3. Provider Freeze

Primary profile:

`gpt-image-manual-v1@1.0.0`

Required status:

`active_pilot`

원칙:

- 20 primary generation slot은 한 Provider profile만 사용한다.
- fallback Provider는 허용하지 않는다.
- Provider 변경이 필요하면 기존 freeze를 조용히 수정하지 않고 새 freeze/version을 만든다.
- Provider output은 generation intent의 성공 증명이 아니다.

---

## 4. Budget Boundary

Provider-generation budget:

| 항목 | 값 |
| --- | ---: |
| primary slots | 20 |
| technical retry reserve | 10 |
| max generation attempts | 30 |
| max attempts per slot | 2 |
| authoritative observation runs | 20 |
| observation recovery reserve | 10 |
| max observation runs | 30 |

이 숫자는 **calibration sample size가 아니다.**

기존 synthetic pilot의 20 primary + 10 technical reserve 운영 상한을 재사용하면서, 이번 rubric stress matrix의 자연스러운 7 + 7 + 6 primary slot 구조에 맞춘 offline pilot cap이다.

Retry는 technical failure에만 사용한다. cue mismatch, ambiguity, low score, Human disagreement를 이유로 재생성해서는 안 된다.

---

## 5. Checkpointed Provider Waves

### W1 — Required Axis Positive

7 slots, Archetype 후보당 1개.

각 slot은 해당 후보의 current required indicators를 visible cue로 설정한다.

목적:

- generation cue가 실제 image에서 observable한가
- blind observation이 required evidence를 회수하는가
- scorer ledger가 intended positive axis를 읽는가

W1만 initial execution wave다.

### W2 — Explicit Negative Contradiction

7 slots, 후보당 현재 explicit negative indicator 1개.

W1 checkpoint에서 systemic generation/observation blocker가 없을 때만 해제한다.

목적:

- negative contribution이 absence가 아니라 explicit observed opposite cue에서만 발생하는지 stress

### W3 — Close-Pair Boundary

6 slots:

- wolf / cat
- puppy / deer
- puppy / tofu
- deer / tofu
- cat / potato
- wolf / dino

각 pair는 `5000 / 5000` generation-intent metadata를 사용하고, 양쪽 rubric signal을 함께 포함하는 subtle visible cue set을 사용한다.

이는 Human truth나 taxonomy relationship 선언이 아니다.

W2 checkpoint 후에만 해제한다.

---

## 6. W4 — Offline Observation Fixtures

Provider 호출 없이 14개 deterministic fixture를 계획한다.

후보당:

- `missing_required_axis` 1개
- `low_evidence` 1개

`missing_required_axis`는 image를 일부러 망가뜨리는 방식이 아니라 observation contract fixture에서 required axis를 unavailable로 만든다.

`low_evidence`는 required axes를 unavailable로 두고, rubric상 positive인 non-required cue 1개만 남긴다.

목적:

- unavailable evidence = 0 contribution
- missing evidence != negative evidence
- score != evidence coverage
- forced top-1 방지

---

## 7. W5 — Capture Stability Derived Variants

W1의 7 baseline asset 각각에서 Provider 재호출 없이 2개 deterministic derived variant를 만든다.

계획:

- gamma `0.95`
- gamma `1.05`

총 14 derived variants.

금지:

- structure mutation
- identity mutation
- geometry warp
- face-shape edit
- cue-specific retouch

목적은 mild lighting-response stability이며 새로운 synthetic subject 생성이 아니다.

Derived transform implementation/verifier가 준비되기 전에는 W5를 실행하지 않는다.

---

## 8. Subject Strata Freeze

20 primary slots은 다음 분포로 고정된다.

### Age presentation

- 20s: 5
- 30s: 5
- 40s: 5
- 50s: 5

### Presentation

- feminine: 7
- masculine: 7
- androgynous: 6

### Regional appearance hint

- null: 10
- `korean_appearance_hint`: 10

이 strata는 scorer input이 아니며 failure stratification과 synthetic subject diversity용이다.

Synthetic 분포로 population fairness를 증명하지 않는다.

---

## 9. Intent / Prompt Boundary

각 generation scenario는:

- target primary
- optional secondary
- intendedWeightsBps
- visible cue set
- subject stratum

을 freeze한다.

그러나 prompt compiler는 Archetype label을 읽지 않는다.

```text
archetypeIntent = metadata only
featureIntent = visible generation instruction
```

`wolf`, `cat`, `puppy`, `deer`, `tofu`, `potato`, `dino` token을 image prompt에 직접 넣지 않는다.

---

## 10. Observation-Failure Diagnostic

`observation_failure`는 별도 Provider image target으로 만들지 않는다.

다음과 같은 실제 disagreement에서 diagnostic으로 파생한다.

```text
visible cue evidence exists
+ observation layer fails to surface it
→ observation-side miss possible
```

이 flag는 causal proof가 아니다.

---

## 11. Human Review Boundary

이번 freeze에서는 다음을 숫자로 확정하지 않는다.

- reviewer count
- consensus algorithm
- consensus pass threshold
- Human confidence calibration

상태:

```text
reviewerCount = not_yet_determined
consensusAlgorithm = not_yet_determined
```

다만 blind ordering은 고정한다.

- engine output hidden before Human submission
- generation intent hidden before Human submission

---

## 12. Source Authority

Freeze는 최소 다음 version을 고정한다.

- source main SHA
- Archetype registry version
- lifecycle / calibration status
- GenerationSpec schema
- feature cue profile v2
- metadata taxonomy version
- compiled prompt schema
- prompt compiler version
- Provider profile id/version

Source authority가 변하면 실행 전에 freeze drift 검사를 통과해야 한다.

---

## 13. Immediate Stop / Re-freeze Conditions

다음이면 Provider execution을 시작하거나 계속하지 않는다.

- source main authority mismatch
- Archetype registry/version drift
- cue registry drift
- prompt compiler drift
- Provider profile version/status drift
- raw Archetype token prompt leakage
- primary Provider switch 필요
- synthetic-only provenance 훼손
- budget hard cap 초과

이 경우 새 freeze 또는 explicit reconciliation이 필요하다.

---

## 14. Explicit Non-Goals

FACE-EVAL-CS에서는 하지 않는다.

- Provider call
- image generation
- candidate import
- observation API call
- Human judgment 실행
- scorer weight tuning
- threshold 선택
- taxonomy 승격
- `calibrationStatus=ready`
- `productionEligible=true`
- canonical Archetype wiring
- production API/UI/storage 변경

---

## 15. Next Gate

Scenario freeze가 verified/merged된 뒤 다음은:

```text
FACE-EVAL-CX1 — W1 Required-Axis Synthetic Execution
```

단 W1 실행 전에:

- exact source re-verification
- Provider profile re-verification
- 7 compiled prompt preview/digest freeze
- budget counter = 0 확인
- operator checkpoint

을 거친다.

W1 결과가 등록되기 전 W2/W3를 선행 실행하지 않는다.

---

## 16. Production Separation

```text
Scenario freeze complete
!= Provider execution complete
!= Synthetic alignment passed
!= Real Human calibration complete
!= Weight/threshold calibration complete
!= Production activated
```

FACE-EVAL-CS는 오직 실행 계획과 source authority를 고정한다.
