# DATA-AI29C-UVA-R3B — Registry Version Compatibility Audit v1

## 판정

`UVA_R3B_HOLD_V2_PUBLISH_ACTIVE_V1_LINEAGE_AND_LATEST_REGISTRY_COUPLING`

R3A에서 `broad_spectrum`을 별도 boolean Fact로 정의하는 의미론은 PASS했다.

하지만 **새 Registry version을 지금 publish하는 것은 HOLD**다.

이번 R3B는 read-only audit이며 Production schema/Registry/Product Fact를 변경하지 않는다.

## Production Registry state

현재 Production:

```text
Registry versions                  = 1
Current registry                   = product-fact-registry-cross-category-v1
Active definitions                 = 20
Current Product Facts              = 92

Open review assignments            = 0

Active v1 research lineage:
  EVIDENCE_CANDIDATE               = 28
  REVIEW_REQUIRED                  = 343
  total                            = 371
```

즉 아직 v1 lineage가 대규모로 남아 있다.

## Global latest-registry coupling

현재:

`product_fact_controlled_latest_registry_v1()`

은 effective registry 중 가장 최근 것을 하나 선택한다.

`effective_at = null`인 새 Registry를 publish하면 생성 시각 기준으로 곧바로 latest가 된다.

latest를 강제하는 Production write path를 확인한 결과 최소 다음 4개가 직접 결합돼 있다.

1. `admin_prepare_product_fact_review_v1`
2. `product_fact_controlled_build_preflight_v1`
3. `trust_phase4_build_adoption_plan_v1`
4. `trust_phase8e_build_revalidation_plan_legacy_v1`

특히 Phase 4 adoption은 candidate registry가 latest와 다르면 fail-closed한다.

따라서 지금 v2를 latest로 만들면 현재 남아 있는 v1 evidence/research lineage가
기존 정상 경로로 완료되지 못할 수 있다.

## future effective_at도 해결책이 아니다

v2를 미래 시점으로 publish하면 당장은 v1이 latest로 남는다.

하지만 effective 시점이 오면 동일 문제가 재발한다.

따라서:

`publish now with future effective_at`

은 compatibility 설계가 아니라 단순한 지연이다.

## Recommendation reader coupling

현재 sunscreen protection reader가 소비하는 Fact는:

```text
spf_value
uva_label
water_resistance_duration
```

뿐이다.

`broad_spectrum`은 읽지 않는다.

따라서 broad_spectrum Fact 자체가 별도 Registry에 존재하더라도
현재 reader가 그대로라면 Recommendation score에는 들어가지 않는다.

이 점은 안전하다.

하지만 현재 reader는 자신이 읽는 SPF/UVA/Water Fact들에 대해:

`distinct registry_version count == 1`

을 요구한다.

즉 기존 protection Fact 중 하나만 v2로 재확정하고 나머지가 v1이면:

`CURRENT_PROTECTION_FACT_REGISTRY_AMBIGUOUS`

로 fail-closed한다.

따라서 Registry evolution과 기존 Fact migration은 별개 문제로 취급해야 한다.

## Scenario 판정

### 1. v2 즉시 publish

**금지**

371건 v1 lineage의 정상 완료 경로를 끊을 수 있다.

### 2. v2 future effective_at

**금지**

문제를 미래로 미룰 뿐이다.

### 3. 기존 SPF/UVA/Water 일부만 v2 migration

**금지**

현재 Recommendation protection reader의 single-registry invariant를 깨뜨린다.

### 4. v2에 broad_spectrum만 새 Fact로 사용

의미론적으로는 가장 안전한 방향이다.

현재 Recommendation reader가 broad_spectrum을 무시하기 때문에 ranking은 변하지 않는다.

하지만 이 방식을 실제 write로 사용하려면 먼저
**global latest-registry gate를 registry coexistence model로 바꾸는 작업**이 필요하다.

## 다음 설계에 필요한 조건

R3C는 Registry publish가 아니다.

`DATA-AI29C-UVA-R3C — Registry Evolution Coexistence Design`

으로 변경한다.

필수 조건:

1. task/assignment가 자신의 Registry lineage를 명시적으로 pin할 수 있어야 한다.
2. "최신이 아니다"라는 이유만으로 이미 시작된 v1 lineage가 무효화되면 안 된다.
3. v1 definitions/Facts는 immutable하게 유지한다.
4. broad_spectrum 추가가 기존 20개 Fact definition의 재확정을 요구하면 안 된다.
5. 기존 fact_key를 v2로 부분 migration하지 않는다.
6. cross-version Current/cardinality/proposition collision semantics를 별도 정의한다.
7. Recommendation reader는 명시적 consumer migration 전까지 기존 3개 Fact만 읽는다.
8. broad_spectrum은 Fact-only / score 0 / bucket null 상태를 유지한다.

## 대안

기술적으로 가장 단순한 대안은 v1 active lineage가 0이 될 때까지 기다리는 것이다.

하지만 현재 371건이다.

Broad Spectrum Fact 하나를 추가하기 위해 unrelated v1 backlog 전체를 먼저 정리하는 것은
운영상 과도하다.

따라서 다음 단계의 우선 경로는:

`REGISTRY_COEXISTENCE_REDESIGN`

이다.

## 계속 금지

- v2 publish
- future effective_at을 compatibility 해결로 간주
- v1 definition mutate
- v1에 broad_spectrum direct insert
- broad_spectrum Product Fact write
- SPF/UVA/Water partial v2 migration
- Recommendation protection reader 변경
- protection projection 변경
- Production ranking 변경
- public activation
