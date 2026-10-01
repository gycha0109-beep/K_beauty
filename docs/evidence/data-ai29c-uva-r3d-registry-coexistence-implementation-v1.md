# DATA-AI29C-UVA-R3D — Registry Coexistence Implementation v1

## 판정

`UVA_R3D_REGISTRY_COEXISTENCE_IMPLEMENTATION_PASS`

R3C에서 고정한 per-fact Registry write-authority 설계를 Production에 구현했다.

이번 단계는 **coexistence infrastructure 구현**이다.

아직 하지 않은 것:

- Registry v2 publish
- `broad_spectrum` definition publish
- `broad_spectrum` Product Fact write
- Recommendation reader/projection 변경
- ranking/public activation

## 구현

### 1. Per-fact write policy

신규:

`product_fact_registry_fact_write_policy_v1`

핵심 불변조건:

```text
same fact_key
→ at most one registry_version with new_lineage_allowed=true
```

partial unique index:

`product_fact_registry_fact_write_policy_v1_one_new_writer_idx`

현재 v1 active definition 20개를 모두:

```text
policy_state              = active
new_lineage_allowed       = true
existing_lineage_allowed  = true
```

로 seed했다.

### 2. Admissibility helper

`product_fact_controlled_registry_write_admissibility_v2`

입력:

- registry_version
- fact_key
- lineage_kind = new | existing

검증:

- Registry definition 존재
- deprecated 아님
- policy 존재
- effective window
- policy_state
- new/existing lineage 권한

모든 비허용 상태는 fail-closed다.

### 3. Audited admin setter

`admin_set_product_fact_registry_fact_write_policy_v1`

- `admin.operations.execute` capability 필요
- service_role RPC만 허용
- policy mutation audit 기록
- same fact_key dual new-writer를 advisory lock + unique index로 차단

### 4. 기존 write paths

다음 4개에서 global latest Registry를 sole authority로 쓰지 않도록 변경했다.

1. `admin_prepare_product_fact_review_v1`
2. `product_fact_controlled_build_preflight_v1`
3. `trust_phase4_build_adoption_plan_v1`
4. `trust_phase8e_build_revalidation_plan_legacy_v1`

review 생성은 assignment 존재 여부로:

- new lineage
- existing lineage

를 구분한다.

나머지 confirmation/adoption/revalidation 흐름은 pinned lineage이므로 `existing` authority를 요구한다.

preflight는 policy 결과를 prestate digest에 포함한다.
따라서 preflight 이후 policy가 바뀌면 stale confirmation으로 차단된다.

## Production regression

### Fake v2 latest

transaction 내부에서 임시 Registry:

`data-ai29c-uva-r3d-regression-v2`

를 만들어 global latest를 실제로 v2로 바꿨다.

그 상태에서 v1:

- 새 review assignment 생성 → PASS
- 기존 Day Dew SPF confirmation preflight → READY

확인 후 ROLLBACK했다.

즉 새 Registry 존재 자체가 이미 시작된/허용된 v1 lineage를 더 이상 무효화하지 않는다.

### Dual writer guard

transaction 내부에서 동일 `spf_value`를 가진 임시 v2 definition을 만들고
new-lineage authority를 동시에 부여하려 했다.

결과:

`product_fact_registry_write_policy_dual_writer_forbidden`

으로 fail-closed.

전부 ROLLBACK했다.

## Production readback

```text
Registry versions                 = 1
latest Registry                   = product-fact-registry-cross-category-v1

write-policy rows                 = 20
active                            = 20
new lineage allowed               = 20
existing lineage allowed          = 20

Current Product Facts             = 92
Current Water Facts               = 2

active v1 research lineage        = 371
  EVIDENCE_CANDIDATE              = 28
  REVIEW_REQUIRED                 = 343

test Registry residue             = 0
Day Dew SPF assignment            = confirmed

SPF authenticated beta            = ON
SPF authorized phase              = DATA-AI29C-D5D
```

## ACL

Policy table:

- service_role = SELECT only
- authenticated direct write = 없음

Admissibility helper:

- postgres only

Admin policy setter:

- service_role execute
- 내부에서 `admin.operations.execute` 재검증

## Recommendation boundary

변경 없음:

- sunscreen protection reader
- sunscreen protection projection
- SPF/UVA/Water ranking semantics

`broad_spectrum`은 아직 존재하지 않는다.

## 다음 gate

`DATA-AI29C-UVA-R3E — Broad Spectrum Registry Publish Preflight`

다음 단계에서만 future Registry snapshot/definition/checksum/policy seed를 설계한다.

R3E도 바로 Product Fact를 쓰지 않고,
먼저 Registry publish + broad_spectrum write-authority 부여의 원자성/rollback 경계를 검증해야 한다.
