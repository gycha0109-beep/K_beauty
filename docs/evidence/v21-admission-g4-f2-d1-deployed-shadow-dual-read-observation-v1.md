# V2.1-ADMISSION-G4-F2-D1 — Deployed Shadow Dual-Read Observation

## Decision

`V21_ADMISSION_G4_F2_D1_DEPLOYED_SHADOW_DUAL_READ_OBSERVED_PASS`

FATION category-authority shadow dual-read가 실제 main 배포에서 정상 동작함을 확인했다.

## Production observation

Workflow:

`Recommendation Admission - G3A PF Authority Read`

Run:

`37194196847 / #165`

Deployment SHA:

`d34bd85a1943467b9a9e1f4f0378a2d2e3071c2e`

FATION target:

`da5df70c-8cdd-4eb2-93b6-ede46c2f171d`

실제 관측:

```text
HTTP                                    = 200
result                                  = PASS
runtime role                            = recommendation_admission_runtime
raw category-review SELECT              = denied
raw taxonomy SELECT                     = denied
raw taxonomy-version SELECT             = denied

PF authority status                     = NO_AUTHORITY
PF authority reason                     = CURRENT_SUBJECT_MISSING

category authority status               = CATEGORY_AUTHORITY_RESOLVED
category                                = treatment
category read contract                  = recommendation-category-authority-read-v1
assignment digest                       = eaed6cb9dd58b0f1e08bc5b35da817a72887b81ee497e0d144fcb5018b108d39

production decision source              = G3_PF_AUTHORITY_ONLY
category authority observational only   = true
Recommendation admission mutated        = false
Production cutover authorized           = false
secret exposed                          = false
```

## Recommendation parity

같은 배포 run에서 기존 Recommendation parity도 유지됐다.

```text
Recommendation products                 = 164
legacy exact overlay                    = 165
catalog-only shadow                     = 10
catalog-only Recommendation leak        = 0
score delta                             = 0
slot delta                              = 0
full-order delta                        = 0
top1 delta                              = 0
top3 delta                              = 0
Recommendation runtime cutover          = false
```

## Category lane closure

G4-F의 category-authority lane은 다음까지 검증됐다.

- reviewed Product-level authority 존재
- protected reader 정상
- 실제 runtime role에서 protected read 정상
- raw table SELECT 차단 유지
- FATION category = `treatment`
- Recommendation 판정에는 미반영
- `products.category` 미변경
- global taxonomy authority 미활성화
- Product Fact 미변경

## G4-G status

G4-G initial admission cutover는 **아직 승인되지 않는다**.

현재 FATION PF authority:

```text
status = NO_AUTHORITY
reason = CURRENT_SUBJECT_MISSING
```

기존 Product Fact lane 결정도 계속:

`V21_ADMISSION_G4_B_R1_FORMULATION_AUTHORITY_NOT_RECOVERED`

따라서 새로운 first-party formulation authority가 회복되어 Product Fact authority가 실제로 성립하기 전에는 G4-G로 진입하지 않는다.

## Next gate

명목상 다음 최종 gate는:

`V2.1-ADMISSION-G4-G_FATION_INITIAL_ADMISSION_CUTOVER`

그러나 현재:

`authorized = false`

이다.
