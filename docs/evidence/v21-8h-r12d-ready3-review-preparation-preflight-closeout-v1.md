# V2.1-8H-R12D — READY3 Review Preparation Preflight

## 종료 판정

`BARRIER_SUPPORT_P0_READY3_REVIEW_PREPARATION_PREFLIGHT_PASS`

R12C에서 실제 ingest한 에뛰드 Evidence 1건이 기존 통제 Review Preparation 경로를 정확히 통과할 수 있는지 Production rollback probe로 검증했다.

대상:

- 제품: 에뛰드 순정 판텐소사이드™ 10 시카 밤 50ml
- Evidence: `45b57536-0637-44e0-b427-bb55923c4812`
- Fact: `primary_use_role`
- 값: `multi_area`
- Proposition: `379a68e4b599cbcc5583b0a830b3718c3f5af0fc52ec62d4d823a728626834d2`

## 통제 RPC

사용 RPC:

`admin_prepare_product_fact_review_v1(uuid,text,jsonb)`

Production 함수 SHA-256:

`9d0992369021a37a83c96561f8ad3d9e9b505a61771b7b5312fa35fc424dbff1`

권한:

- anon: 실행 불가
- authenticated: 실행 불가
- service_role: 실행 가능
- actor capability: `admin.products.review`

기존 8G3-B 통제 경로와 함수 해시가 동일하다.

## Registry 쓰기 정책

`primary_use_role` 신규 lineage 정책:

- allowed = true
- policy state = active
- policy version = `data-ai29c-uva-r3d-registry-coexistence-v1`
- policy digest = `1ee29792af7acddc521916fedef250944d10e2a4c0a55ef75ba46a9d3ca03e46`

## 전이 규칙

신규 Assignment는 바로 `ready_for_confirm`으로 만들 수 없다.

필수 순서:

```text
under_review
→ ready_for_confirm
```

R12E 실제 실행도 이 순서를 그대로 사용해야 한다.

Review policy:

`v21-8g3-b-direct-evidence-review-v1`

담당자:

`e1a59349-fe13-43ff-86ce-078c2dce0d99`

## Production prestate

```text
Product Fact Subject = 50
Product Fact Current = 104
Fact Instance = 105
Confirmation = 105
Evidence Records = 108

target Evidence = 1
target Review Assignment = 0
target Fact Instance = 0
target Current Fact = 0
target Confirmation = 0
```

연구 Task는 그대로:

- `RESEARCH_PENDING`
- `attempt_count=0`
- `blocker_code=null`

상태다.

## Rollback probe

Production에서 다음 2개 RPC를 한 트랜잭션 안에서 실행했다.

1. `under_review`
2. `ready_for_confirm`

트랜잭션 내부 결과:

```text
Assignment = 1
ready_for_confirm = 1
Review Event = 2
Audit = 2
Fact Instance = 0
Current Fact = 0
Confirmation = 0
```

즉 Review Preparation 경로는 정상 작동했고 Fact 채택은 발생하지 않았다.

이후 즉시 ROLLBACK했다.

post-rollback:

```text
Assignment = 0
Assignment Review Event = 0
Audit = 0
Fact Instance = 0
Current Fact = 0
Confirmation = 0
R12C Evidence = 1 유지
```

Production residue는 없다.

## 권위 경계

R12D는 사전검증 전용이다.

커밋된 쓰기:

```text
Review Assignment = 0
Review Event = 0
Audit = 0
Fact Instance = 0
Product Fact Current = 0
Confirmation = 0
Recommendation = 0
```

따라서:

```text
Evidence != Fact
Review Preparation != Confirmation
Fact adoption != Recommendation activation
```

경계를 유지한다.

## 다음 단계

`V2.1-8H-R12E — READY3 Controlled Review Preparation`

R12E에서 허용되는 것은 정확히 1개 proposition에 대한:

```text
under_review
→ ready_for_confirm
```

2단계 Review Preparation뿐이다.

R12E에서도:

- Confirmation preflight 미승인
- Confirmation 미승인
- Recommendation activation 금지
- public activation 금지

를 유지한다.
