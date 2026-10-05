# DATA-AI29C-D5E-A — COSRX Product Fact Adoption Preflight v1

## 판정

`D5E_A_COSRX_PRODUCT_FACT_ADOPTION_PREFLIGHT_PASS_READY_FOR_SEPARATE_CONTROLLED_WRITE`

이 단계는 **Production read-only preflight**다.

D5E-0에서 Wave 2 대상으로 선택한 COSRX Ultra-Light Invisible Sunscreen의 admission-critical Product Fact 세 건을 실제 governed adoption path에 넣기 직전까지 검증한다.

Production write는 0건이다.

## 대상

```text
product = 888eca86-af25-4a12-b9ea-47922d83f520
subject = 994d7edb-7432-40c3-b09f-08cd59f91627
market  = KR
```

Subject 상태:

- exact current Subject count = 1
- identity = resolved
- current_state = current
- subject identity serializer = product-fact-subject-identity-v1
- current admission-critical Product Fact = 0

따라서 기존 Current SPF/UVA/UV-filter와의 충돌은 없다.

## Registry coexistence

현재 최신 Registry는:

`product-fact-registry-cross-category-v2`

다.

세 Evidence Candidate는 기존 research lineage에 따라:

`product-fact-registry-cross-category-v1`

을 사용한다.

현재 Production coexistence policy:

`data-ai29c-uva-r3d-registry-coexistence-v1`

에서 v1의 다음 세 Fact는 **new lineage write가 모두 허용**된다.

| Fact | v1 new lineage | policy digest |
| --- | --- | --- |
| SPF | ALLOWED | `b76372394fb927d50b1d7cdaf3e44eb491d6d1b71cedad6472d07d7a9fa568c9` |
| UVA label | ALLOWED | `d5f4353b972c9fb850d92f4a85f7a5be84d5c9e44692f504a639d0e467b9af3c` |
| UV filter | ALLOWED | `904d32a17e7285e0dd414de068b91b371c131839f0ca197a12cbefa47e97638d` |

따라서:

`latest Registry = v2`

라는 사실만으로 기존 v1 research candidate를 v2로 재작성하거나 폐기하지 않는다.

## 실제 Production adoption preflight

기존 read-only RPC:

`admin_preflight_trust_evidence_adoption_v1()`

를 세 candidate에 실행했다.

### SPF

```text
candidate    = d21124ef-f597-492d-9208-f224c544b229
value        = 50
authority    = product_specific_primary
confidence   = high
preflight    = ready
open review  = 0
proposition  = b7fc9e4afd849dad34cc355e4bddebe94e0a44c98d50d7a1b98b64de629c6bbf
```

### UVA

```text
candidate    = cbf34ff2-b0e2-4ab6-92da-f60d20211abb
value        = PA++++
authority    = product_specific_primary
confidence   = high
preflight    = ready
open review  = 0
proposition  = 4dac7dcefa8b39fa6c3e2c62e5b4921322b4ce97e97b53d5b5675f7eb2c5eb1a
```

### UV filter

```text
candidate    = 0a5c3e77-d92d-4a95-9e92-7e21bcb8ecf1
value        = organic
authority    = product_specific_primary
confidence   = high
preflight    = ready
open review  = 0
proposition  = dd203d2b3d0d827312207bb3f3395ea63a746b277a4d4425d8ebdd480049293e
```

세 candidate 모두:

- exact same Product
- exact same current Subject
- market = KR
- Registry v1
- canonical evidence digest stable
- automatic confirmation = false

다.

## Governed write path

다음 D5E-B에서도 새 SQL path를 만들지 않는다.

기존:

`admin_adopt_trust_evidence_candidate_v1()`

만 사용한다.

이 RPC가 수행하는 범위:

1. governed Evidence ingest
2. review assignment 생성/재사용
3. `under_review → ready_for_confirm`
4. Product Fact confirmation preflight

중요:

**Product Fact confirmation은 자동으로 하지 않는다.**

RPC 반환값의:

- confirmation payload
- payload digest
- prestate digest
- fusion input digest

를 검증한 뒤 별도:

`admin_confirm_product_fact_v1()`

호출이 필요하다.

## D5E-B 실행 순서

병렬 confirmation은 금지한다.

순서:

1. SPF
2. UVA label
3. UV filter type

각 Fact마다:

```text
prestate 재확인
→ adoption preflight
→ controlled adoption
→ returned confirmation payload/digest 검증
→ explicit confirmation
→ exact Current readback
→ 다음 Fact
```

으로 진행한다.

한 단계라도 drift/충돌이 발생하면 이후 Fact 실행을 중단한다.

## 고정 request id

다음 단계에서 사용할 adoption request ID:

```text
data-ai29c-d5e-b-cosrx-spf-adopt-v1
data-ai29c-d5e-b-cosrx-uva-adopt-v1
data-ai29c-d5e-b-cosrx-uv-filter-adopt-v1
```

adoption RPC 내부의 ingest/review/confirmation request suffix는 기존 함수가 생성하도록 둔다.

## 금지 범위

D5E-A에서는 다음을 전부 하지 않았다.

```text
Evidence write                  = 0
Review Assignment write         = 0
Product Fact confirmation       = 0
Product Fact Current            = 0
Semantic review write           = 0
Product mutation                = 0
Taxonomy authority mutation     = 0
D5C/D5D allowlist expansion     = 0
SPF runtime switch mutation     = 0
Recommendation admission       = 0
Production ranking change       = 0
UVA activation                  = 0
Water activation                = 0
Public search cutover           = 0
```

## 다음 gate

`DATA-AI29C-D5E-B_COSRX_PRODUCT_FACT_CONTROLLED_CONFIRMATION`

단, **D5E-A merge + CI PASS 이후 별도 단계로만 실행**한다.
