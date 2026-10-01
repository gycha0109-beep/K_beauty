# DATA-AI29C-WATER-C-R1 — Production Cardinality Guard Validation

## 결과

WATER-C에서 발견된 `cardinality=one` 병렬 confirmation race에 대한 저장 계층 guard를 Production에 적용하고 실제 회귀 시나리오로 검증했다.

판정:

`WATER_C_R1_PRODUCTION_CARDINALITY_GUARD_PASS`

## 적용

Repository main:

`a70a3eaa85437eda03be3a42313932d0a60d5cf1`

Migration:

`data_ai29c_water_c_r1_cardinality_guard_v1`

Production ledger:

`20261001091011`

Guard:

`product_fact_current_cardinality_guard_v1`

상태:

- trigger enabled
- SECURITY DEFINER
- callable ACL은 postgres only
- semantic slot = `subject_id + registry_version + fact_key`

## Live regression

보존된 후발 duplicate Fact를 사용해 동일 ANESSA Subject에 다시 Current mapping을 삽입했다.

duplicate proposition:

`035a31aceae525e29bcd4dc795be4fe8f65d42aba55b8a39cbe1c03b1c524d29`

결과:

```text
SQLSTATE = 23514
message  = product_fact_current_cardinality_one_conflict
```

즉 다른 proposition은 fail closed 한다.

동일 canonical proposition의 replay/update path는 허용됨도 별도 subtransaction에서 확인했다.

## Final Current state

ANESSA canonical:

- proposition: `2b145dff9a002879db9d66c5dda622c6f8fc10d807dae2cf134bed62dbd5b63b`
- fact: `39394ff3-3f57-49d6-96ee-2df39f404872`
- confirmation: `11b9359a-eac4-46e2-afe2-697341743230`
- assignment: `c373aa09-7cb8-4fda-ba7e-fdf3346381e9`
- assignment state: `confirmed`

후발 duplicate:

- immutable Fact/Confirmation history 유지
- assignment: `a03a436e-fdc2-48e8-84ca-c0583e0d3d9f`
- assignment state: `superseded`
- Current mapping 없음

최종 count:

```text
water_resistance_duration Current = 1
canonical Current = 1
duplicate Current = 0
```

## Explicit replacement boundary

서로 다른 proposition의 Current를 교체해야 하는 정상 revalidation은 다음 상태를 모두 만족하는 Phase 8F 경로만 예외다.

새 assignment:

- `ready_for_confirm`
- `trust-phase8f-revalidation-replacement-v1`

기존 conflicting assignment:

- `re_review_required`

일반 Product Fact confirmation은 이 예외를 사용할 수 없다.

## Production invariants

Vercel Production:

- SHA: `a70a3eaa85437eda03be3a42313932d0a60d5cf1`
- state: `READY`

SPF authenticated beta:

- enabled = true
- authorized phase = `DATA-AI29C-D5D`
- WATER-C-R1로 변경되지 않음

Water:

- authority = `1/20`
- runtime activation = OFF
- ranking wiring = OFF

계속 false:

- `productionCutoverAuthorized`
- `outdoorRankableSignalAuthorized`
- `publicActivation`

## 다음 단계

저장 무결성 blocker는 닫혔다.

다음은 Water activation이 아니라 **Water authority expansion**이다.

1/20 상태에서는 cohort-wide water bonus/penalty를 활성화하지 않는다.
