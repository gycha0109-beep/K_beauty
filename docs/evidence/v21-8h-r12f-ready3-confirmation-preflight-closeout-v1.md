# V2.1-8H-R12F — READY3 Confirmation Preflight Closeout

## 종료 판정

`BARRIER_SUPPORT_P0_READY3_CONFIRMATION_PREFLIGHT_PASS`

R12E에서 `ready_for_confirm` 상태까지 준비한 에뛰드 `primary_use_role=multi_area` proposition 1건에 대해 Product Fact Confirmation preflight를 읽기 전용으로 실행했다.

대상:

- Assignment: `4eef7c5f-30d6-495e-a42b-a6cdeaacc380`
- Evidence: `45b57536-0637-44e0-b427-bb55923c4812`
- Fact: `primary_use_role`
- Proposition: `379a68e4b599cbcc5583b0a830b3718c3f5af0fc52ec62d4d823a728626834d2`
- 값: `multi_area`

## Preflight RPC

호출:

`admin_preflight_product_fact_confirmation_v1(uuid,text,jsonb)`

함수 SHA-256:

`7d9ce38e47468fb1a419528256857e399a3d7e50e719f7bd449034c96019f59e`

권한:

- anon 실행 불가
- authenticated 실행 불가
- service_role 실행 가능

실제 Confirmation RPC:

`admin_confirm_product_fact_v1(uuid,text,jsonb,text,text)`

함수 SHA-256:

`b143613eac0e27b7e223379f7b5c20179a89f2b4b04150463c84e880656dcf29`

R12F에서는 이 Confirmation RPC를 호출하지 않았다.

## Fusion 입력

지원 Evidence:

`45b57536-0637-44e0-b427-bb55923c4812`

Evidence 역할:

`supporting`

Fusion policy:

`v2.1-4-product-fact-evidence-fusion-v1`

DB 계산 `fusion_input_digest`:

`61ad796e16ccdd844f2ec2e97c4d47053b6bfa1591830353e53d97efdaeacdf2`

## Preflight 결과

Request ID:

`v21-8h-r12f-etude-role-preflight`

결과:

```text
status = ready
actor_role = admin_owner
previous_current = null
```

고정 digest:

```text
payload_digest =
6a777a2bab29f38ba246db4d72b6f318465ddbf2fbd0b69bdedfb45dc75898d6

prestate_digest =
e3d9e16b9aa36cedc37a92911a0b9a62f58d1211af7b3c21bd32345a47915411

fusion_input_digest =
61ad796e16ccdd844f2ec2e97c4d47053b6bfa1591830353e53d97efdaeacdf2
```

## 나중에 Confirmation이 실행될 경우의 예상 쓰기 집합

Preflight 반환값:

```text
Product Fact Current = 1
Fact Instance = 1
Confirmation = 1
Review Event = 1
Evidence Link = 1
Review Assignment update = 1
```

이 값들은 **실제 쓰기 결과가 아니다.**

R12F는 해당 쓰기 집합을 계산만 했다.

## Zero-write readback

Preflight 직후:

```text
Assignment state = ready_for_confirm
Assignment Review Event = 2
Preflight Audit = 0

target Fact Instance = 0
target Current Fact = 0
target Confirmation = 0
target Evidence Link = 0

Product Fact Current = 104
Fact Instances = 105
Confirmations = 105
```

따라서 preflight는 읽기 전용으로 종료됐다.

## 권위 경계

R12F:

```text
Confirmation preflight = complete
Confirmation = not authorized in R12F
Confirmation RPC = not called
Product Fact materialization = false
Recommendation activation = false
public activation = false
```

즉:

```text
Evidence != Fact
Preflight != Confirmation
Fact adoption != Recommendation activation
```

경계를 유지한다.

## STOP 경계

`STOP_BEFORE_R12G_FINAL_CONFIRMATION`

다음 후보 단계:

`V2.1-8H-R12G — READY3 Final Product Fact Confirmation`

R12G가 실제 Confirmation을 실행하려면 바로 직전에 stale-sensitive 상태를 다시 확인해야 한다.

필수 재검증:

- Assignment가 계속 `ready_for_confirm`인지
- Subject가 계속 resolved/current인지
- Evidence/Binding이 현재 상태인지
- Registry write policy가 계속 허용인지
- `fusion_input_digest`가 동일한지
- preflight를 다시 실행했을 때 `prestate_digest`가 현재 상태 기준으로 유효한지

R12F 자체는 실제 Confirmation을 승인하거나 실행하지 않는다.
