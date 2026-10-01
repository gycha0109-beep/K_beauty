# DATA-AI29C-WATER-C-R1 — Cardinality-One Parallel Confirmation Guard

## 문제

WATER-C controlled adoption에서 ANESSA의 canonical
`water_resistance_duration` Fact가 이미 확정된 뒤,
다른 qualifier로 생성된 두 번째 proposition이 병렬 confirmation을 통과했다.

결과적으로 같은:

```text
Subject + registry_version + fact_key
```

에 대해 `cardinality=one`인데 서로 다른 Current proposition이 잠시 2개 존재했다.

WATER-C closeout에서 후발 Current mapping은 제거했고
immutable history는 보존했다.

## 근본 원인

기존 generic Product Fact confirmation은 proposition 단위 advisory lock을 사용한다.

서로 다른 proposition:

```text
P1 != P2
```

은 서로 다른 lock을 잡기 때문에 동일한 semantic slot에 대한 병렬 confirmation을
직렬화하지 못한다.

또한 generic confirmation preflight 자체에는 registry의
`cardinality=one`을 기준으로 다른 Current proposition을 거부하는 storage-level
불변조건이 없었다.

## 하드닝

`product_fact_current` write boundary에 trigger guard를 둔다.

cardinality-one semantic slot:

```text
subject_id
+ registry_version
+ fact_key
```

을 advisory transaction lock으로 직렬화한다.

lock key namespace:

```text
bejewely_product_fact_current_cardinality:
<subject_id>:<registry_version>:<fact_key>
```

lock을 획득한 뒤 같은 semantic slot에 다른 Current proposition이 있으면
기본적으로:

`product_fact_current_cardinality_one_conflict`

로 fail closed 한다.

## Same proposition

동일 proposition의 idempotent replay / Current replacement는 충돌 대상으로 보지 않는다.

```text
current.proposition_key <> new.proposition_key
```

인 경우만 conflict다.

## Explicit replacement 예외

기존 TRUST Phase 8F semantic replacement는
새 proposition confirmation과 old Current 제거를 하나의 governed transaction으로 수행한다.

이 경로를 깨뜨리지 않기 위해 다음 조건을 **모두** 만족할 때만
일시적인 cross-proposition Current를 허용한다.

새 assignment:

- state = `ready_for_confirm`
- policy = `trust-phase8f-revalidation-replacement-v1`

old conflicting assignment:

- state = `re_review_required`

일반 WATER-C / Product Fact confirmation은 이 예외를 사용할 수 없다.

## 범위

변경:

- Product Fact Current cardinality-one storage invariant 강화

변경 없음:

- Product Fact registry
- WATER-C canonical Fact
- Water Product Query intent runtime
- Recommendation scorer
- water ranking activation
- SPF authenticated beta
- broad Product Query cutover

따라서 Water authority는 계속:

`1 / 20`

이고 Water ranking은 계속 OFF다.

## 판정

`WATER_C_R1_CARDINALITY_GUARD_STATIC_PASS`

Production migration 적용 후에는 다음 live 검증이 필요하다.

1. existing canonical ANESSA Current = 1
2. 후발 duplicate immutable history 유지
3. 동일 duplicate Current 재삽입 시 fail closed
4. canonical Current 변화 없음
5. SPF Production activation 변화 없음
