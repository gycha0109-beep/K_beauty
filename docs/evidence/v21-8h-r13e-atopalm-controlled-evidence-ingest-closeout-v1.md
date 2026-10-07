# V2.1-8H-R13E — ATOPALM Controlled Evidence Ingest Closeout

## 종료 판정

`BARRIER_SUPPORT_ATOPALM_P0_CONTROLLED_EVIDENCE_INGEST_PASS`

R13D에서 사전검증한 아토팜 직접 근거 2건을 Production 통제 RPC로 실제 ingest했다.

대상:

1. `barrier_support_claim = true`
   - Evidence class: `product_claim`
2. `primary_use_role = multi_area`
   - Evidence class: `usage_instruction`

## 실제 Production 결과

RPC:

`admin_ingest_product_fact_evidence_v1(uuid,text,jsonb)`

두 호출 모두 `status = evidence_recorded`로 성공했다.

첫 호출:

- Source 생성 = 1
- Binding 생성 = 1
- Evidence 생성 = 1

두 번째 호출:

- 기존 Source 재사용
- 기존 Binding 재사용
- Evidence 생성 = 1

최종 생성:

- Source: `35cd1f0d-575b-4807-8977-41a635cd5a4b`
- Binding: `058b9f34-6c8b-4595-84ed-8fed87e78c5f`
- barrier Evidence: `af1a47e6-e168-4492-8407-1072f9f7ff60`
- role Evidence: `73bd7367-857f-476b-a88e-5beae7347c8b`

생성 시각:

`2026-10-07T19:05:51.645294+09:00`

## Source / Binding

공식 KR 출처:

`https://www.neopharmshop.co.kr/product/detail.html?cate_no=123&display_group=1&product_no=3324`

Binding:

- `exact_subject_match`
- `scope_relation = equivalent`
- 100ml ×2
- 총 200ml
- 시장 KR
- R13A 확정 Subject와 동일 presentation

## Evidence 1 — barrier_support_claim

- 값: `true`
- Evidence class: `product_claim`
- authority: `product_specific_primary`
- confidence: `high`
- support direction: `supports`
- Proposition: `a1e01fd7508d83f2b251d33f59397f902a1ed20b4a09c51ed4dd3e3da7a639c5`
- Evidence digest: `ce752257d8580d45028b225dba1e60cc82537eb47456a81968bd4334724ef503`

## Evidence 2 — primary_use_role

- 값: `multi_area`
- Evidence class: `usage_instruction`
- authority: `product_specific_primary`
- confidence: `high`
- support direction: `supports`
- Proposition: `82e11e7bb7e999b242759f6ebdabcfb5fce4625ad0432e85144abbd64d2ce240`
- Evidence digest: `6ff58a251ba9ba8cb5adb0a9bfe4b98afed5be510c55b7c30f75973ecde927fa`

## Production 수치

실행 전:

- Product Fact Subject = 51
- Product Fact Current = 105
- Fact Instance = 106
- Confirmation = 106
- Evidence Record = 108

실행 후:

- Product Fact Subject = 51
- Product Fact Current = 105
- Fact Instance = 106
- Confirmation = 106
- Evidence Record = **110**

즉 증가한 것은 Evidence 2건뿐이다.

대상 Subject:

- Fact Instance = 0
- Current Fact = 0
- Review Assignment = 0
- Confirmation = 0

연구 Task 2건도 계속:

- `RESEARCH_PENDING`
- `attempt_count=0`
- `blocker_code=null`

상태를 유지한다.

## 권위 경계

이번 단계의 커밋된 쓰기:

- Source = 1
- Binding = 1
- Evidence = 2
- Review Event = 2
- Audit = 2

수행하지 않은 것:

- Review Assignment = 0
- Fact Instance = 0
- Product Fact Current = 0
- Confirmation = 0
- Recommendation write = 0

따라서:

`Evidence != Fact`

`Review Preparation != Confirmation`

`Fact adoption != Recommendation activation`

경계를 유지한다.

## 다음 단계

`V2.1-8H-R13F_ATOPALM_REVIEW_PREPARATION_PREFLIGHT`

다음 단계는 생성된 Evidence 2건이 기존 통제 Review Preparation 경로를 정확히 통과할 수 있는지만 rollback probe로 확인한다.

R13E 종료 자체는 Review Preparation / Confirmation / Recommendation activation을 승인하지 않는다.
