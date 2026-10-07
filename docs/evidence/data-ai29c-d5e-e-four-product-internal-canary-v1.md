# DATA-AI29C-D5E-E — COSRX Four-product Internal Canary v1

## 현재 판정

`D5E_E_FOUR_PRODUCT_INTERNAL_CANARY_DEPLOYED_PROBE_REQUIRED`

D5E-D-R4에서 COSRX Recommendation admission이 GRANT로 복구됐으므로
다음 단계는 기존 내부 3종에 COSRX 1종을 더한 **4-product internal canary**다.

이 문서는 D5E-E의 Production authority와 코드 경계를 고정한다.
아직 deployed main 6/6 probe를 실행하지 않았으므로 D5E-E PASS로 판정하지 않는다.

## 핵심 격리 구조

기존 D5D Production service는 D5C의 exact 3-product allowlist를 직접 재사용한다.

따라서 D5C allowlist 자체를 3 → 4로 변경하면 D5E-F 승인 전에
authenticated beta corpus가 함께 넓어질 수 있다.

D5E-E는 이를 금지하고 다음 구조를 사용한다.

```text
기존 D5C protected reader = 기존 3종 그대로
신규 D5E-E COSRX reader = COSRX 1종 only

internal canary request memory:
3 + 1 = exact 4
```

변경하지 않는 것:

- `D5C_SUNSCREEN_CANARY_PRODUCT_IDS` = 3 유지
- D5D target grant expectation = 3 유지
- D5D combined sunscreen corpus = 14 유지
- authenticated beta runtime switch = DATA-AI29C-D5D 유지
- public Product Query wiring 없음

## Production authority

적용 migration:

```text
20261007155804
data_ai29c_d5e_e_cosrx_internal_canary_authority_v1
```

신규 bounded RPC:

```text
read_data_ai29c_d5e_e_cosrx_canary_authority_v1(uuid)
```

RPC target은 정확히 COSRX 하나다.

```text
888eca86-af25-4a12-b9ea-47922d83f520
```

보안 경계:

- owner = `recommendation_admission_reader_owner`
- SECURITY DEFINER
- `search_path = ''`
- EXECUTE = `recommendation_admission_runtime` only
- anon/authenticated/service_role execute 없음
- runtime raw taxonomy SELECT 없음
- runtime direct semantic RPC 없음
- 기존 D5C policy/function 수정 없음

## 15-product internal corpus

```text
legacy Production sunscreen 11
+ 기존 D5C governed target 3
+ COSRX governed target 1
= 15 internal canary corpus
```

COSRX는 기존:

- `evaluateSunscreenInitialAdmissionGrant()`
- `projectEstablishedSunscreenSemantics()`
- `projectSunscreenSpfFact()`

를 그대로 통과해야 한다.

별도 admission/scoring 규칙을 만들지 않는다.

## SPF-only expected delta

| cohort | delta |
| --- | ---: |
| legacy 11 | +6 each |
| Physical Daily Sunmilk | +2 |
| MIN JUNG GI Physical Sun Block | +4 |
| Jojoba Suncream | +4 |
| COSRX Ultra-Light Invisible Sunscreen SPF50 PA++++ | +6 |

COSRX SPF50은 canonical `spf_50_plus_band`를 사용한다.

UVA / Water는 D5E-E에서도 ranking eligibility를 부여하지 않는다.

## Internal route

```text
POST /api/internal/product-query-spf-four-product-canary
```

접근 조건:

- deployed ref = main
- exact deployed SHA
- 기존 DATA-AI5 GitHub Actions OIDC
- fixed workflow identity
- body exactly `{ "caseId": "..." }`

arbitrary query/provider/public credential은 사용하지 않는다.

## Canary cases

### outdoor_spf_on

기대:

- candidates = 15
- governed target grant = 4/4
- legacy SPF authority = 11/11
- SPF axis applied
- adjustments = 15
- `outdoor_exposure` rankable
- 신규 4종 delta = +2 / +4 / +4 / +6

### rollback_off

기대:

- SPF axis OFF
- outdoor signal 승격 없음
- status = `insufficient_supported_intent`
- result count = 0

### non_outdoor_control

기대:

- candidate corpus = 15
- existing skin_type ranking 정상
- SPF axis OFF
- outdoor signal 승격 없음

각 case는 deployed main에서 2회 반복한다.

```text
3 cases × 2 = 6
```

## Production boundary

D5E-E 동안 계속 false:

- betaAllowlistExpanded
- permanentCandidateAdmissionMutation
- productionRankingChanged
- publicActivation
- UVA activation
- Water activation
- recommendation persistence
- Product mutation

## PASS 조건

D5E-E PASS는 다음을 모두 만족한 뒤에만 선언한다.

1. static contract PASS
2. Production authority security boundary PASS
3. deployed main exact SHA binding PASS
4. target grant 4/4
5. combined corpus 15
6. outdoor SPF ON ×2 PASS
7. rollback OFF ×2 PASS
8. non-outdoor ×2 PASS
9. 기존 D5D 3-product Production probe regression 0

## 다음 gate

`DATA-AI29C-D5E-F_AUTHENTICATED_BETA_ALLOWLIST_EXPANSION`

현재 상태:

`BLOCKED_UNTIL_D5E_E_DEPLOYED_6_OF_6_PASS`

D5E-F 전에는 authenticated beta allowlist를 4종으로 확장하지 않는다.
