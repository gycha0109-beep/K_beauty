# V2.1-8H-R13D — ATOPALM Direct Evidence Ingest Preflight

## 종료 판정

`BARRIER_SUPPORT_ATOPALM_P0_DIRECT_EVIDENCE_INGEST_PREFLIGHT_PASS`

R13C에서 확보한 아토팜 직접 근거 2건이 기존 통제 Evidence ingest 경로에 안전하게 들어갈 수 있는지 Production에서 사전검증했다.

이번 단계의 **커밋된 Production 쓰기는 0건**이다.

## 승인 후보

1. `barrier_support_claim = true`
   - task: `b1430a7d-79bb-43a5-bfea-a19599441811`
   - Evidence class: `product_claim`
   - proposition key: `a1e01fd7508d83f2b251d33f59397f902a1ed20b4a09c51ed4dd3e3da7a639c5`
   - canonical Evidence digest: `ce752257d8580d45028b225dba1e60cc82537eb47456a81968bd4334724ef503`

2. `primary_use_role = multi_area`
   - task: `cbdad075-35a1-476e-b3ac-6279b676e73e`
   - Evidence class: `usage_instruction`
   - proposition key: `82e11e7bb7e999b242759f6ebdabcfb5fce4625ad0432e85144abbd64d2ce240`
   - canonical Evidence digest: `6ff58a251ba9ba8cb5adb0a9bfe4b98afed5be510c55b7c30f75973ecde927fa`

## Source / Binding

공식 KR 페이지:

`https://www.neopharmshop.co.kr/product/detail.html?cate_no=123&display_group=1&product_no=3324`

R13A에서 확정된 Subject와 정확히 같은 `100ml ×2` 번들이므로:

- `binding_state = exact_subject_match`
- `scope_relation = equivalent`
- bundle units = 2
- unit size = 100ml
- total size = 200ml

로 고정했다.

## 통제 RPC

`admin_ingest_product_fact_evidence_v1(uuid,text,jsonb)`

현재 Production 계약:

- SHA-256: `c5bf2429801f3f5811c41d3c39fbddff3eca2914bccb59f100321f369264b481`
- anon 실행 불가
- authenticated 실행 불가
- service_role 실행 가능
- actor는 `admin.products.review` capability 필요

R12B와 동일한 계약이 유지되고 있다.

## 사전 상태

- Product Fact Subject = 51
- Product Fact Current = 105
- Fact Instance = 106
- Confirmation = 106
- Evidence Record = 108

대상 Subject에는:

- Source = 0
- Binding = 0
- Evidence = 0
- Fact Instance = 0
- Current Fact = 0

두 연구 Task도 모두 `RESEARCH_PENDING / attempt_count=0 / blocker=null` 상태였다.

## Rollback probe

두 후보를 같은 통제 Source/Binding으로 순서대로 호출했다.

트랜잭션 내부:

- RPC accepted = 2/2
- Source = 1
- Binding = 1
- Evidence = 2
- Review Event = 2
- Audit = 2
- Fact Instance = 0
- Current Fact = 0

첫 번째 RPC가 Source/Binding/Evidence를 생성했고, 두 번째 RPC는 같은 Source/Binding을 재사용해 Evidence만 추가했다.

강제 rollback 후:

- Source = 0
- Binding = 0
- Evidence = 0
- Review Event = 0
- Audit = 0
- Fact Instance = 0
- Current Fact = 0

전체 Production 수치도 사전 상태와 동일했다.

## 권위 경계

R13D가 승인하는 것은 **다음 R13E에서 정확히 두 Evidence를 materialize하는 것뿐**이다.

R13D/R13E 경계에서 계속 금지:

- Fact Instance 생성
- Product Fact Current 변경
- Review Preparation
- Confirmation
- Recommendation 변경
- Public activation

즉 `Evidence != Fact`, `Fact adoption != Recommendation activation` 경계를 유지한다.

## 다음 단계

`V2.1-8H-R13E_ATOPALM_CONTROLLED_EVIDENCE_INGEST`

허용 범위:

- Source 최대 1
- Binding 최대 1
- Evidence 최대 2
- 허용 task는 위 2개만
- 허용 RPC는 `admin_ingest_product_fact_evidence_v1`만

Review Preparation과 Confirmation은 여전히 승인하지 않는다.
