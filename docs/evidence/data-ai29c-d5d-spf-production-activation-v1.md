# DATA-AI29C-D5D — SPF Production Activation v1

## 승인

사용자 명시 승인:

```text
D5D 진행 승인
```

D5D는 SPF 축만 Production Recommendation에 활성화한다.

전체 Product Query GA/public search cutover는 이번 단계 범위가 아니다.

현재 실제 사용자 surface:

```text
POST /api/my/product-query-beta
```

기존 authenticated limited-beta 접근제어는 그대로 유지한다.

## Production activation scope

활성 대상:

- sunscreen request
- `sunscreen_intent=true`
- governed D5D runtime switch enabled
- 신규 comparable 3종 authority 3/3
- 기존 Production sunscreen 11종 SPF authority 11/11
- exact 11 + 3 bounded corpus

활성하지 않는 것:

- UVA
- water resistance
- anonymous Product Query
- public search cutover
- profile/history merge
- recommendation persistence
- Product row mutation

## Runtime switch

Production DB:

```text
public.sunscreen_spf_runtime_activation_v1
```

단일 scope:

```text
authenticated_product_query_beta
```

read RPC:

```text
read_data_ai29c_d5d_spf_runtime_activation_v1()
```

Production migration:

```text
20260930211137_data_ai29c_d5d_spf_runtime_activation_v1
```

승인 상태:

```text
enabled=true
authorized_phase=DATA-AI29C-D5D
activated_by=explicit_user_approval
```

일반 app runtime은 activation table을 직접 SELECT할 수 없다.

허용:

```text
recommendation_admission_runtime
  → EXECUTE read_data_ai29c_d5d_spf_runtime_activation_v1()
```

금지:

```text
recommendation_admission_runtime
  → raw activation table SELECT
```

## Kill switch

SPF-only rollback:

```sql
update public.sunscreen_spf_runtime_activation_v1
set enabled = false,
    updated_at = now()
where scope = 'authenticated_product_query_beta';
```

배포 재시작 없이 다음 sunscreen Product Query request부터
기존 Product Query corpus/scoring 경로로 fail closed한다.

전체 beta emergency disable은 기존:

```text
BEJEWELY_PRODUCT_QUERY_BETA_EMERGENCY_DISABLE
```

경계도 그대로 유지한다.

## Candidate corpus

기존 normal Product source는 변경하지 않는다.

```text
getRecommendationProducts()
→ existing Production corpus
→ sunscreen = 11
```

신규 3종은 D5D sunscreen request에서만 governed runtime projection으로 추가한다.

1. Physical Daily Sunmilk
   `a6994fcd-302f-4e63-acbe-91a3f17a5a65`
2. MIN JUNG GI Physical Sun Block
   `b90bf992-07ae-4f49-a3a4-d90ea6d4a858`
3. Jojoba Suncream
   `7fc45e7c-38aa-41a1-b1a1-c0e09fcd8c17`

Production source에 이 세 ID가 이미 나타나거나
legacy sunscreen count가 11에서 변하면 D5D는 activation을 중단하고
기존 baseline ranking으로 fallback한다.

## Governed admission

신규 3종은 D5C에서 만든 live authority RPC를 재사용한다.

```text
read_data_ai29c_d5c_sunscreen_canary_authority_v1(uuid)
```

이름은 canary지만 authority contract 자체는 exact 3-product allowlist,
current exact Subject, current SPF/UVA/UV-filter Fact,
semantic bundle을 반환하는 read-only authority다.

D5D에서도 반드시 기존:

```text
evaluateSunscreenInitialAdmissionGrant()
projectEstablishedSunscreenSemantics()
projectSunscreenSpfFact()
```

를 통과해야 한다.

별도 admission/scoring 규칙은 만들지 않는다.

## Comparability authority

신규 3종은 다음 semantic authority가 established여야 한다.

```text
category_slot
uv_filter_type
finish
tone_up
```

12-field semantic envelope도 ready여야 한다.

한 제품이라도 실패하면 신규 3종 전체 Production activation을 하지 않고
기존 baseline corpus로 fallback한다.

## Protection authority

Legacy 11:

```text
readRecommendationSunscreenProtectionAuthorities()
→ projectSunscreenProtectionAuthority()
```

신규 3:

```text
live D5C authority SPF fact
→ projectSunscreenSpfFact()
```

SPF expected delta:

| cohort | delta |
|---|---:|
| legacy 11 | +6 each |
| Physical Daily | +2 |
| MIN JUNG GI | +4 |
| Jojoba | +4 |

UVA와 water projection은 신규 3종에서 명시적으로 ineligible이다.

D5A runtime gate 역시 SPF만 enable한다.

## User-facing execution

기존 authenticated beta route는 변경하지 않는다.

```text
/api/my/product-query-beta
→ executeProductQueryPreview()
→ runNaturalLanguageProductQueryShadow()
→ intent parsing
→ executeD5dSpfProductionQuery()
```

Provider 역할은 계속 intent parsing only다.

Product selection/ranking은 deterministic Recommendation authority가 담당한다.

## Outdoor

```text
category=sunscreen
sunscreen_intent=true
outdoor_exposure=true
switch=true
authority complete
```

이면:

```text
11 legacy + 3 new = 14
SPF axis ON
outdoor_exposure rankable
```

## Non-outdoor

신규 3종은 실제 sunscreen candidate corpus에는 포함된다.

하지만:

```text
outdoor_exposure != true
→ SPF axis OFF
→ outdoor signal 승격 없음
```

즉 신규 제품 편입과 SPF outdoor ranking은 서로 다른 조건이다.

## Fail closed

다음이면 기존 baseline Product Query로 fallback한다.

- switch OFF
- activation read failure
- Production sunscreen count != 11
- target already present in base Product source
- new target admission != 3/3
- legacy SPF authority != 11/11
- protection credential unavailable

fallback은 request failure가 아니라 기존 Recommendation behavior 복원이다.

## Internal deployed probe

Route:

```text
POST /api/internal/product-query-spf-production-activation
```

기존 GitHub Actions OIDC 검증을 재사용한다.

고정 case만 허용:

### outdoor_live

- switch=true
- candidate=14
- target grant=3
- legacy SPF authority=11
- SPF axis applied
- adjustments=14
- outdoor_exposure rankable

### non_outdoor_live

- switch=true
- candidate=14
- target grant=3
- SPF axis not applied
- outdoor_exposure not promoted

각 2회 반복한다.

```text
2 cases × 2 = 4 deployed runtime probes
```

## D5D Production decision

D5D PASS 조건:

- migration authority PASS
- security boundary PASS
- static contract PASS
- Production build PASS
- Current Main Health PASS
- CodeQL PASS
- deployed D5D probe 4/4 PASS

PASS 후:

```text
spfProductionActivation=true
outdoorRankableSignalAuthorized=true
```

단 다음은 계속 false:

```text
publicSearchCutover=false
productionCutoverAuthorized=false
UVA=false
Water=false
persistence=false
```

SPF Production activation과 전체 Product Query GA는 동일한 승인으로 취급하지 않는다.
