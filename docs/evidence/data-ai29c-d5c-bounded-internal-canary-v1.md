# DATA-AI29C-D5C — Bounded Internal SPF Canary v1

## 목적

D5C는 D5A/D5B에서 검증한 SPF runtime gate를 처음으로
**배포된 main 애플리케이션에서 실행**한다.

그러나 일반 사용자 Product Query에는 연결하지 않는다.

D5C 범위:

1. 신규 comparable sunscreen 3종을 live governed authority로 재검증
2. 해당 3종을 canary 호출 안에서만 임시 admission/projection
3. 기존 Production sunscreen 11종과 합친 14종 corpus로 SPF ranking 실행
4. internal GitHub Actions OIDC route에서만 실행
5. SPF ON / 즉시 OFF rollback / non-outdoor control을 각각 2회 검증
6. public activation은 계속 금지

## Canary target allowlist

정확히 다음 3개만 허용한다.

- Physical Daily Sunmilk
  `a6994fcd-302f-4e63-acbe-91a3f17a5a65`
- MIN JUNG GI Physical Sun Block
  `b90bf992-07ae-4f49-a3a4-d90ea6d4a858`
- Jojoba Suncream
  `7fc45e7c-38aa-41a1-b1a1-c0e09fcd8c17`

Zinc / Bio Repair는 D5C allowlist에 없다.

## Production corpus boundary

일반 `getRecommendationProducts()`는 수정하지 않는다.

D5C 시작 시 반드시 확인:

```text
current Production sunscreen count = 11
canary target already in Production = 0
```

하나라도 깨지면 canary는 fail closed한다.

따라서 신규 3종은 permanent Production admission이 아니라
**해당 internal canary request 메모리 안에서만** 11종과 합쳐진다.

```text
11 Production legacy
+ 3 governed D5C target
= 14 canary corpus
```

## Live governed authority

D5C는 frozen fixture만으로 admission하지 않는다.

Production DB에 별도 bounded RPC를 추가한다.

```text
read_data_ai29c_d5c_sunscreen_canary_authority_v1(uuid)
```

RPC 자체가 exact 3 product allowlist를 가진다.

반환 범위:

- product id / brand / name
- canonical sunscreen taxonomy
- exact current Product Fact Subject
- Product Fact registry lineage
- current SPF
- current UVA label
- current UV filter type
- current sunscreen Recommendation semantic bundle

그 외 제품은:

```text
PRODUCT_NOT_D5C_CANARY_TARGET
```

으로 종료한다.

## DB privilege boundary

Runtime role:

```text
recommendation_admission_runtime
```

허용:

```text
EXECUTE read_data_ai29c_d5c_sunscreen_canary_authority_v1
```

금지:

- raw taxonomy SELECT
- raw semantic-review SELECT
- direct semantic-bundle RPC
- Product Fact raw table SELECT
- admin write
- Product mutation

RPC owner:

```text
recommendation_admission_reader_owner
```

SECURITY DEFINER + empty search_path + explicit schema qualification을 사용한다.

함수 ownership 이동에 필요한 schema CREATE는 migration transaction 안에서만
일시 부여하고 commit 전에 다시 회수한다.

Applied Production migration:

```text
20260930202522
data_ai29c_d5c_bounded_canary_authority_v1
```

## Admission decision

Live RPC 결과를 기존:

```text
evaluateSunscreenInitialAdmissionGrant()
```

에 그대로 넣는다.

즉 D5C가 별도 admission 규칙을 만들지 않는다.

필수 Product Fact:

- SPF
- UVA label
- UV filter type

필수 semantic envelope:

- 모든 12개 field reviewed
- category_slot established
- uv_filter_type established

Canary mixed-comparability를 위해 추가로 established가 필요한 field:

- finish
- tone_up

따라서 D3R3에서 비교 가능하다고 판정했던 정확한 3종만 admission될 수 있다.

## Semantic projection

Product row의 null/default를 사용하지 않는다.

```text
projectEstablishedSunscreenSemantics()
```

만 사용한다.

unresolved field는:

- false로 변환하지 않음
- 임의 기본값을 권위값으로 사용하지 않음
- canary object에서도 null 또는 empty로 유지

Product row를 mutate하지 않는다.

## SPF authority

기존 Production 11종:

```text
readRecommendationSunscreenProtectionAuthorities()
→ projectSunscreenProtectionAuthority()
```

D5C 신규 3종:

live D5C RPC가 반환한 governed SPF fact를

```text
projectSunscreenSpfFact()
```

로 투영한다.

SPF bucket logic을 새로 복사하지 않는다.

Expected:

| cohort | SPF delta |
|---|---:|
| legacy 11 | +6 each |
| Physical Daily | +2 |
| MIN JUNG GI | +4 |
| Jojoba | +4 |

UVA와 Water는 D5C projection에서 명시적으로 ineligible이다.

즉 D5C에서 ranking 가능한 protection axis는 SPF 하나뿐이다.

## Internal route

Route:

```text
POST /api/internal/product-query-spf-canary
```

접근 조건:

- deployed ref = main
- exact deployed SHA
- existing DATA-AI5 GitHub Actions OIDC validation
- GitHub-hosted runner
- fixed workflow identity
- request body exactly `{ "caseId": "..." }`

raw query text는 받지 않는다.

Provider도 호출하지 않는다.

## Canary cases

### 1. outdoor_spf_on

Intent:

```text
category=sunscreen
sunscreen_intent=true
outdoor_exposure=true
```

기대값:

- 11 + 3 = 14 candidates
- canary grant 3/3
- SPF authority complete
- SPF axis applied
- adjustments 14
- outdoor_exposure becomes rankable
- new deltas = +2 / +4 / +4
- legacy deltas = +6 × 11

### 2. rollback_off

같은 outdoor intent에서:

```text
spfRuntimeGate.enabled=false
```

기대값:

- SPF axis not applied
- outdoor_exposure not promoted
- 기존 execution contract 기준 rankable signal 없음
- status = insufficient_supported_intent
- result count = 0

이 케이스가 즉시 rollback 증거다.

### 3. non_outdoor_control

Intent:

```text
skin_type=oily
outdoor_exposure=false
```

SPF gate option은 true로 전달하더라도:

- existing skin_type ranking은 정상 실행
- SPF axis는 적용되지 않음
- outdoor_exposure는 rankable signal로 승격되지 않음

## Repetition

main push 후 deployed runtime에서:

```text
3 cases × 2 repeats = 6
```

모두 PASS해야 한다.

이 probe는 기존:

```text
.github/workflows/data-ai5-activation-readiness.yml
```

의 short-lived OIDC credential을 재사용한다.

새 public credential이나 장기 canary token을 만들지 않는다.

## Rollback

D5C에서 rollback은 deployment-wide flag mutation이 아니다.

Canary 호출에서:

```text
spfRuntimeGate.enabled=false
```

로 즉시 원래 execution behavior를 복원한다.

일반 Product Query의 기본 상태도 계속:

```text
spfRuntimeGateDefault=false
```

이다.

## PASS 조건

Static contract:

- exact 3 allowlist
- narrow DB RPC
- raw reads denied
- current Production corpus unchanged
- live D2 grant reuse
- semantic projection reuse
- canonical SPF projection reuse
- fixed OIDC-only route
- SPF only
- rollback case present
- no public route wiring

Deployed runtime:

- Production sunscreen 11
- canary target 3
- grant 3/3
- combined 14
- legacy SPF eligible 11/11
- outdoor SPF ON PASS ×2
- rollback OFF PASS ×2
- non-outdoor PASS ×2

모두 만족해야 D5C를 PASS로 간주한다.

## D5C가 승인하지 않는 것

D5C PASS는 다음을 의미하지 않는다.

- 일반 사용자에게 신규 3종 admission
- Production-wide SPF flag ON
- outdoor signal public ranking authority 승인
- UVA activation
- Water activation
- public activation
- full production cutover

## Production boundary

D5C 동안 계속 false:

- permanentCandidateAdmissionMutation
- productionRankingChanged
- productionCutoverAuthorized
- outdoorRankableSignalAuthorized
- publicActivation
- uvaActivated
- waterResistanceApplied
- persistence

Deployed 6/6 probe가 통과한 뒤에도 public rollout은 별도 D5D 승인 단계다.
