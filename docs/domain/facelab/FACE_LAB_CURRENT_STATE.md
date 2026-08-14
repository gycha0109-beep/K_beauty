# FACE LAB CURRENT STATE

> 갱신일: 2026-08-12
> 구현 기준 SHA: `9361fc100bd5770f4ccf95999b561f8738cbd3a2`
> 이 문서를 추가·수정하는 문서 전용 commit 때문에 `main` SHA가 전진할 수 있다. 아래 구현 판정의 기준 코드는 위 SHA다.
> 현재 코드와 최신 component contract가 과거 날짜형 진행상황 문서보다 우선한다.

## 1. 한눈에 보는 현재 상태

Face Lab은 관찰 기반과 평가 기반은 상당히 구축됐고, 결정론적 Archetype shadow scorer도 현재 `main`에 복구됐다. 그러나 Archetype calibration과 이후 스타일링 계층이 아직 production authority가 아니므로 최종 Face Lab 엔진은 완성 상태가 아니다.

```text
Eligibility / quality                 ✅ 구현
Unified Face Lab observations         ✅ 구현
Canonical analysis container          ✅ 구현
Archetype registry                    ✅ shadow / rubric_ready
Deterministic archetype scoring       ✅ shadow
Archetype decision / hold             ✅ shadow, production 차단
Archetype calibration                 ❌ not_ready
Canonical archetype promotion         ❌ 미연결
Style Identity                        ❌ 미구현
Core / Alternative strategy           ❌ 미구현
Color 최종 엔진                       ❌ 미구현
Hair 최종 엔진                        ❌ 미구현
Makeup 최종 엔진                      ❌ 미구현
Face Style 최종 엔진                  ❌ 미구현
Look Composer                         ❌ 미구현
최종 canonical Free/Premium 결과      ❌ 미완성
Synthetic evaluation infrastructure   ✅ 구현
Controlled skin-cue pilot             ✅ 공식 alignment 완료 / closeout 대기
Real human archetype calibration set  ❌ 미구축
```

## 2. 현재 production 분석 경로

현재 제품은 하나의 Vision observation boundary를 공유한다. Face Lab과 Skin Match가 같은 이미지에 대해 독립적으로 Vision을 다시 호출하는 구조가 아니다.

Face Lab observation contract에는 이미 다음이 구조화돼 있다.

- quality
- pose / occlusion
- outline
- vertical balance
- eyes
- feature layout
- visual language
- color appearance
- field-level evidence와 confidence

Vision은 대표 상이나 최종 스타일링 추천을 직접 만들지 못하도록 계약상 제한돼 있다.

## 3. Canonical Face Lab bundle

`face-lab-canonical-v1` 객체는 존재한다.

현재 실제 상태는 observation-first다.

```text
analysis       = populated
archetype      = null
styleIdentity  = null
strategies     = null
color          = null
hair           = null
makeup         = null
faceStyle      = null
looks          = null
```

따라서 canonical container 자체는 존재하지만 최종 Face Lab 판단·스타일링 결과는 아직 조립되지 않았다.

현재 sanitizer는 검증된 observation analysis에서 canonical bundle을 다시 만들기 때문에 승인되지 않은 downstream 필드가 조용히 현재 authority로 살아남지 못한다.

## 4. Archetype Engine

### 4.1 현재 `main`에 구현된 범위

FACE-ENGINE-1 shadow 계층에는 다음이 있다.

- versioned Archetype Registry
- 7개 rubric 후보
- positive / negative indicator
- weighted deterministic scoring
- evidence-required contribution
- evidence coverage
- contradiction count
- contribution ledger
- deterministic ranking
- fail-closed hold reason
- shadow decision adapter

현재 rubric key:

```text
wolf
cat
puppy
deer
tofu
potato
dino
```

이 7개는 production 최종 taxonomy로 확정된 상태가 아니다.

### 4.2 현재 lifecycle

Registry는 의도적으로 다음 상태다.

```text
lifecycle = rubric_ready
calibrationStatus = not_ready
```

각 archetype 역시 production calibration 기준으로는 `unvalidated`다.

다음 decision-policy threshold도 production 값으로 채워지지 않았다.

- minimum evidence coverage
- minimum top score
- minimum top margin
- maximum contradictions

따라서 현재 shadow decision 결과는 다음 경계를 유지한다.

```text
productionEligible = false
status = held
decision = null
```

Taxonomy와 calibration readiness가 명시적으로 승격되기 전에는 사용자 판정으로 활성화하지 않는다.

### 4.3 아직 필요한 것

- 검증된 Human evaluation data
- calibration된 rubric weight
- calibration된 decision threshold
- 관련 presentation variation에 대한 coverage / bias 평가
- production activation 판단
- canonical bundle wiring

## 5. Styling 영역 상태

`face-lab-archetype-styling-contract-v1.md`는 존재한다.

이 문서는 다음 제품 철학과 목표 데이터 경계를 정의한다.

- 대표 상과 유사도 언어
- Style Identity
- Core / Alternative strategy
- Color
- Hair
- Makeup
- Face Style
- Core / Alternative Look

그러나 이 문서 자체도 분류 weight와 threshold가 검증 전이라고 명시하고 있으며, 문서가 존재한다는 것이 downstream 엔진 구현 완료를 뜻하지 않는다.

| 영역 | 계약·설계 | Production 구현 |
|---|---|---|
| Style Identity | 개념·경계 정의 | 미구현 |
| Core Strategy | 개념·경계 정의 | 미구현 |
| Alternative Strategy | 개념·경계 정의 | 미구현 |
| Color | 목표 경계 정의 | 최종 엔진 미구현 |
| Hair | 목표 경계 정의 | 최종 엔진 미구현 |
| Makeup | 목표 경계 정의 | 최종 엔진 미구현 |
| Face Style | 목표 경계 정의 | 최종 엔진 미구현 |
| Look Composer | 목표 경계 정의 | 미구현 |

현재 transition projector가 출력하는 제한적인 얼굴형·컬러·헤어 문구를 위 최종 엔진으로 간주하면 안 된다.

## 6. Free / Premium 상태

현재 제품에는 evidence-gated Face Lab 출력 경로와 Premium-safe summary/storage 동작이 있다.

하지만 이것은 목표 Face Lab 구조로 가기 위한 전환 계층이다.

목표는 계속 다음 구조다.

```text
하나의 canonical Face Lab result
→ Free projection
→ Premium projection
→ 허용된 stored snapshot
```

현재 Free/Premium 화면이 존재한다는 이유로 Style Identity, Core/Alternative, 영역별 스타일 엔진, Look Composer가 구현 완료됐다고 판정하면 안 된다.

## 7. Synthetic Evaluation Infrastructure

Repository에는 production과 분리된 synthetic evaluation workspace가 있다.

현재 실행 가능한 범위에는 다음이 포함된다.

- candidate import
- blind observation
- judgment
- consensus
- intent alignment
- purpose-scoped promotion
- campaign orchestration
- reporting / export
- dataset lock / baseline
- full-pipeline rehearsal
- Solo assessment
- cue-level alignment diagnostic

Production application은 이 toolkit에 의존하지 않는다.

핵심 authority 분리는 다음과 같다.

```text
generation intent ≠ observation ≠ judgment ≠ promotion
```

## 8. Controlled Skin-Cue Pilot 상태

Diversified skin-cue pilot의 **공식 reveal / alignment 단계**는 local synthetic-data workspace에서 완료됐다.

이 local artifact들은 production application 데이터로 Git에 추적하지 않는다.

아직 남아 있는 것은 operator decision, checkpoint, campaign closeout이다.

Campaign:

`crun_140d7a156fb69f754db7a780`

Solo session:

`solo_08235338b490f242e7b4ebc3`

운영자가 보고한 최종 official alignment 상태:

- official reveal receipts: 8/8 valid
- cue alignments: 8/8 valid
- wave alignment report: valid
- report digest: `ff3a76910cf0b044a5cf9b7355f77d6b3b8181681383ae7b7bed0b3fcfc53c1a`
- reveal/alignment 단계 Provider calls: 0
- retries/recovery: 0/0
- operator decision: 0
- checkpoint: 0

### 이 Pilot에서 확인한 핵심

- Human redness는 단일 reviewer의 색 구분 한계 때문에 `unverifiable`로 보존했다. target mismatch로 계산하지 않는다.
- blemish-negative control은 Human 기준으로 명확하게 구분됐다.
- positive blemish cue는 여러 장에서 매우 subtle하거나 ambiguous했다.
- Human에게 비교적 명확했던 positive 사례 하나에서 T4 observation miss 가능성이 나타났다.
- 평가 시스템이 uncertainty를 억지 성공/실패로 바꾸지 않고 그대로 보존할 수 있음을 확인했다.

이 결과는 **평가 파이프라인의 작동을 검증한 것**이지 production Archetype taxonomy를 검증한 것이 아니다.

또한 pilot의 행정·운영 closeout은 아직 별도 단계다.

### 8.1 Archetype stress D2D-XP hosted intake 준비 상태

Independent Human cue 실행 준비에는 sealed D2D-P packet authority와 D2D-UI1 offline Korean distribution이 그대로 남아 있다. 그 위에 reviewer-specific ZIP/JSON 회수 대신 사용할 별도 hosted intake v1 draft가 추가됐다.

- single deterministic 14-image hosted set
- reviewer slot 없는 independent session submission
- 한국어 blind-safe UI와 canonical-token response contract
- opaque shared link와 server-only Supabase write
- `public.tmp_face_lab_independent_human_cue_submissions` 격리 저장
- hosted authority digest: `b92f221f8c9b3521637b9f1660ddd2f6c287883bb8620f4b8ac02bd786e30491`

이 상태는 intake implementation과 test row 검증까지다. 실제 reviewer link 배포, Human judgment, reveal, aggregation, consensus, production consumption, D2D-X, W2는 시작되지 않았다. 상세 authority와 운영 경계는 `face-lab-independent-human-cue-hosted-intake-v1.md`와 operator note를 따른다.

## 9. 과거 문서와 현재 authority

다음 자료는 설계 배경과 당시 상태를 이해하는 데 여전히 가치가 있지만 현재 구현 상태 authority는 아니다.

- `face lab은 무엇인가 0716.txt`
- `Face_Lab_구현_명세_0716_수정본.md`
- `face_lab_진행상황_0727.txt`
- `bejewely-face-analyze-pipeline-07-30.txt`

특히 0727 당시의 “Archetype scoring 미구현” 판정은 당시에는 맞았지만 현재 `main`에는 shadow scorer가 복구됐으므로 더 이상 현재 상태가 아니다.

반대로 0716의 제품 아키텍처와 07-30의 generation / judgment 분리 원칙은 여전히 유효해 새 MASTER와 EVALUATION 문서로 승계했다.

## 10. Production Archetype 활성화 전 blocker

다음 작업의 핵심은 archetype 종류를 더 늘리거나 합성 이미지를 대량 생성하는 것이 아니다.

현재 blocker:

1. 현재 rubric / observation contract에 맞는 Archetype calibration protocol 정의
2. Synthetic stress evidence와 Real Human annotation authority 분리
3. ambiguity를 보존하는 Human labeling / consensus 평가셋 구축
4. Synthetic controlled set으로 rubric과 observation layer stress test
5. weight와 hold/decision threshold calibration
6. stability, coverage, bias 평가
7. 그 후에만 production ArchetypeDecision 활성화 및 canonical bundle 연결

## 11. 다음 권장 순서

```text
FACE-EVAL-A
Archetype calibration protocol

→ FACE-EVAL-B
Human labeling / consensus dataset contract

→ FACE-EVAL-C
Synthetic archetype stress campaign

→ FACE-ENGINE-2
Weight + threshold calibration

→ FACE-ENGINE-3
Production-safe ArchetypeDecision

→ FACE-STYLE-1
Style Identity

→ FACE-STYLE-2
Core / Alternative Strategy

→ FACE-STYLE-3
Color / Hair / Makeup / Face Style

→ FACE-LOOK-1
Look Composer

→ FACE-PRODUCT-1
Canonical Free / Premium integration
```

단계 이름은 바뀔 수 있다. 의존관계를 건너뛰려면 별도 contract 변경이 필요하다.
