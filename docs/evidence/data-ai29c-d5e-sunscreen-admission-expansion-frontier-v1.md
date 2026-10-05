# DATA-AI29C-D5E-0 — Sunscreen Admission Expansion Frontier v1

## 판정

`D5E0_SUNSCREEN_ADMISSION_EXPANSION_FRONTIER_FROZEN_COSRX_WAVE2_SELECTED`

이 단계는 **zero-write 설계 / preflight**다.

현재 SPF Production activation의 exact 3-product allowlist를 유지한 상태에서,
다음 비-legacy sunscreen admission expansion 후보를 Production authority 기준으로 다시 분류한다.

## 현재 Production 경계

현재 authenticated Product Query beta의 SPF runtime switch:

```text
scope            = authenticated_product_query_beta
enabled          = true
authorized_phase = DATA-AI29C-D5D
```

기존 Production legacy sunscreen:

`11`

현재 live governed 신규 sunscreen allowlist:

`3`

- Jojoba Suncream
- Physical Daily Sunmilk
- MIN JUNG GI Physical Sun Block

D5E-0는 이 3종 allowlist, runtime switch, Recommendation ranking을 **변경하지 않는다**.

## 실제 비-legacy sunscreen frontier

`catalog-taxonomy-v1` shadow taxonomy 기준 non-exact sunscreen은 9종이다.

### 현재 live D5D 3종

| Product | 상태 |
| --- | --- |
| Jojoba Suncream | D5D authority complete / live allowlist |
| Physical Daily Sunmilk | D5D authority complete / live allowlist |
| MIN JUNG GI Physical Sun Block | D5D authority complete / live allowlist |

### 잔여 6종

| Product | 현재 병목 | 우선순위 |
| --- | --- | --- |
| COSRX Ultra-Light Invisible Sunscreen SPF50 PA++++ | 3 Product Fact가 READY Evidence Candidate이지만 Current 미확정, semantic 0/12 | **Wave 2** |
| Dr. Troub Zinc Physical | D2 Fact authority 완료, finish 미확정 | semantic watch |
| Bio Repair + Suncream | D2 Fact authority 완료, finish 미확정 | semantic watch |
| BUSHMAN Waterproof Pro Suncream | SPF/UVA Current, UV filter 미확정, semantic 0/12 | 후순위 |
| CellFusionC Aquatica Cooling Sunscreen | admission-critical PF 미확정, semantic 0/12 | 후순위 |
| FULLY Rice Ceramide Moisture Sun Cream | source blocked, semantic 0/12 | 후순위 |

Zinc/Bio는 기존 D3R3에서 finish authority를 임의 확정하지 않기로 이미 HOLD했다.
동일 근거를 반복 해석해 allowlist를 늘리지 않는다.

## Wave 2 선택 — COSRX

대상:

`888eca86-af25-4a12-b9ea-47922d83f520`

현재 exact current Subject:

`994d7edb-7432-40c3-b09f-08cd59f91627`

현재 Product Fact Current에는 admission-critical 세 Fact가 아직 없다.

그러나 research lane에는 세 Fact 모두 READY Evidence Candidate이 존재한다.

| Fact | Candidate | Value | Evidence | Authority / Confidence |
| --- | --- | --- | --- | --- |
| SPF | `d21124ef-f597-492d-9208-f224c544b229` | 50 | product_claim | product_specific_primary / high |
| UVA | `cbf34ff2-b0e2-4ab6-92da-f60d20211abb` | PA++++ | product_claim | product_specific_primary / high |
| UV filter | `0a5c3e77-d92d-4a95-9e92-7e21bcb8ecf1` | organic | composition_identity | product_specific_primary / high |

따라서 잔여 6종 중 **governed D2 authority까지의 거리가 가장 짧다.**

단:

```text
READY Evidence Candidate
!= Evidence adoption
!= reviewed Evidence
!= Product Fact confirmation
!= Product Fact Current
!= SUNSCREEN_INITIAL_ADMISSION_GRANT
!= Production allowlist
```

직접 Current를 만들거나 runtime allowlist를 넓히는 것은 금지한다.

## D5E staged execution

### D5E-A — COSRX Product Fact Adoption Preflight

read-only.

세 READY candidate를 다시 검증한다.

필수 확인:

- exact current Subject 1개
- market / formulation scope
- Registry version/checksum
- proposition serializer/identity
- candidate state = READY
- candidate authority = product_specific_primary
- confidence = high
- normalized values = 50 / PA++++ / organic
- 기존 Current Fact와 충돌/중복 없음
- Evidence adoption / review / confirmation writer가 기존 governed 경로인지

출력은 payload freeze뿐이다.

**STOP before Product Fact write.**

### D5E-B — Controlled Product Fact Confirmation

별도 명시 gate다.

D5E-A가 PASS한 경우에만:

```text
Evidence Candidate
→ Evidence adoption
→ review
→ confirmation preflight
→ explicit Product Fact confirmation
```

을 수행한다.

목표 Current:

- spf_value = 50
- uva_label = PA++++
- uv_filter_type = organic

Recommendation mutation은 0이어야 한다.

### D5E-C — COSRX Semantic Bundle

기존:

`admin_register_sunscreen_recommendation_semantic_field_v1()`

만 사용한다.

12개 field 전부 reviewed 상태가 되어야 D1B envelope가 ready다.

D5D mixed-comparability 후보가 되려면 추가로:

- category_slot established = sunscreen
- uv_filter_type established = organic
- finish established
- tone_up established

가 필요하다.

finish/tone_up 근거가 부족하면 D5E-C에서 정상 HOLD한다.

### D5E-D — Admission + Mixed Shadow

기존 정책을 그대로 재사용한다.

`evaluateSunscreenInitialAdmissionGrant()`

새 admission policy를 만들지 않는다.

COSRX가 grant되고 neutral semantic authority까지 complete인 경우에만:

```text
legacy 11
+ current live new 3
+ COSRX shadow 1
= 15-product mixed shadow
```

를 검증한다.

SPF만 activation candidate다.

UVA / Water는 계속 disabled다.

### D5E-E — Four-product Internal Canary

D5C protected authority reader/RPC/RLS의 exact allowlist는 현재 3개다.

D5E-D까지 PASS한 경우에만 별도 migration/review로:

`3 → 4`

확장을 검토한다.

그 전에는 아래를 변경하지 않는다.

- `D5C_SUNSCREEN_CANARY_PRODUCT_IDS`
- D5C taxonomy RLS allowlist
- `read_data_ai29c_d5c_sunscreen_canary_authority_v1()` allowlist
- D5D production corpus assumptions

### D5E-F — Authenticated Beta Allowlist Expansion

최종 별도 명시 승인 단계다.

허용 범위:

- authenticated Product Query beta
- sunscreen only
- SPF only
- existing runtime kill switch
- exact governed four-product allowlist

계속 금지:

- public search cutover
- UVA ranking
- Water ranking
- Product mutation
- taxonomy global activation
- uncontrolled catalog-wide sunscreen admission

## D5E-0 write boundary

```text
Product Fact write             = 0
Evidence adoption              = 0
semantic review write          = 0
D5C/D5D allowlist change       = 0
runtime switch change          = 0
Recommendation admission       = 0
Production ranking change      = 0
public search cutover          = 0
UVA activation                 = 0
Water activation               = 0
```

## 다음 gate

`DATA-AI29C-D5E-A_COSRX_PRODUCT_FACT_ADOPTION_PREFLIGHT`

D5E-A는 **read-only / payload-freeze** 단계다.
