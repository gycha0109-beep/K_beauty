# V2.1-8H-R13F — ATOPALM Review Preparation Preflight

## 종료 판정

`BARRIER_SUPPORT_ATOPALM_P0_REVIEW_PREPARATION_PREFLIGHT_PASS`

R13E에서 실제 ingest한 아토팜 Evidence 2건이 기존 통제 Review Preparation 경로를 정확히 통과할 수 있는지 Production rollback probe로 검증했다.

이번 단계의 **커밋된 Production 쓰기는 0건**이다.

## 대상

### barrier_support_claim

- Evidence: `af1a47e6-e168-4492-8407-1072f9f7ff60`
- 값: `true`
- Proposition: `a1e01fd7508d83f2b251d33f59397f902a1ed20b4a09c51ed4dd3e3da7a639c5`
- Evidence class: `product_claim`

### primary_use_role

- Evidence: `73bd7367-857f-476b-a88e-5beae7347c8b`
- 값: `multi_area`
- Proposition: `82e11e7bb7e999b242759f6ebdabcfb5fce4625ad0432e85144abbd64d2ce240`
- Evidence class: `usage_instruction`

## 통제 RPC

`admin_prepare_product_fact_review_v1(uuid,text,jsonb)`

Production 계약:

- SHA-256: `9d0992369021a37a83c96561f8ad3d9e9b505a61771b7b5312fa35fc424dbff1`
- anon 실행 불가
- authenticated 실행 불가
- service_role 실행 가능
- actor capability: `admin.products.review`
- review policy: `v21-8g3-b-direct-evidence-review-v1`

R12D 선례와 동일한 함수 계약이다.

## Registry 쓰기 정책

두 Fact 모두 신규 lineage 허용 상태다.

- `barrier_support_claim`
  - allowed = true
  - policy digest = `6f3cbd77ba4501100cc637c2ac1300ccc0591563973a50c8d28a4b70503c6f6e`
- `primary_use_role`
  - allowed = true
  - policy digest = `1ee29792af7acddc521916fedef250944d10e2a4c0a55ef75ba46a9d3ca03e46`

공통 policy version:

`data-ai29c-uva-r3d-registry-coexistence-v1`

## 전이 규칙

각 proposition은 독립 Assignment를 사용하며 필수 순서는:

```text
under_review
→ ready_for_confirm
```

신규 Assignment를 바로 `ready_for_confirm`으로 만드는 것은 금지된다.

## Production prestate

- Product Fact Subject = 51
- Product Fact Current = 105
- Fact Instance = 106
- Confirmation = 106
- Evidence Record = 110
- 대상 Evidence = 2
- 대상 Review Assignment = 0
- 대상 Fact Instance = 0
- 대상 Current Fact = 0
- 대상 Confirmation = 0

연구 Task 2건도 계속 `RESEARCH_PENDING / attempt_count=0 / blocker=null` 상태다.

## Rollback probe

두 proposition 각각에 대해:

1. `under_review`
2. `ready_for_confirm`

을 같은 트랜잭션 내부에서 실행했다.

총 RPC:

- attempted = 4
- accepted = 4

트랜잭션 내부:

- Assignment = 2
- ready_for_confirm = 2
- Review Event = 4
- Audit = 4
- Fact Instance = 0
- Current Fact = 0
- Confirmation = 0

강제 rollback 후:

- Assignment = 0
- Assignment Review Event = 0
- Audit = 0
- Fact Instance = 0
- Current Fact = 0
- Confirmation = 0
- 기존 Evidence = 2 유지

Production residue는 없다.

## 권위 경계

R13F는 사전검증 전용이다.

커밋된 쓰기:

- Review Assignment = 0
- Review Event = 0
- Audit = 0
- Fact Instance = 0
- Product Fact Current = 0
- Confirmation = 0
- Recommendation = 0

따라서:

`Evidence != Fact`

`Review Preparation != Confirmation`

`Fact adoption != Recommendation activation`

경계를 유지한다.

## 다음 단계

`V2.1-8H-R13G_ATOPALM_CONTROLLED_REVIEW_PREPARATION`

R13G에서 허용되는 것은 두 proposition 각각에 대한:

```text
under_review
→ ready_for_confirm
```

Review Preparation뿐이다.

Confirmation preflight / Confirmation / Recommendation activation은 계속 금지한다.
