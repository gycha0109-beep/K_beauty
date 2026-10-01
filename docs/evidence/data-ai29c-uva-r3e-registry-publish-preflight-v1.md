# DATA-AI29C-UVA-R3E — Broad Spectrum Registry Publish Preflight v1

## 판정

`UVA_R3E_BROAD_SPECTRUM_REGISTRY_PUBLISH_PREFLIGHT_PASS_NO_PERSISTENT_PUBLISH`

R3D coexistence infrastructure 위에서 future Registry v2의 실제 publish payload와 write-authority 분리를 검증했다.

**R3E에서는 v2를 Production에 남기지 않았다.**

## Prospective Registry

- version: `product-fact-registry-cross-category-v2`
- identity serializer: `product-fact-subject-identity-v1`
- definitions: **21**
  - v1 immutable definitions clone: 20
  - new `broad_spectrum`: 1
- Registry checksum:
  `453b8523bfeae634e0d8467d9eb69dcdc301626d9c6b27c6abd13fa3f974e696`
- broad_spectrum definition checksum:
  `59f6d5e5232f8603f66091f5a1d641ce9f056fec20413370a470fa61dca703d9`

기존 20개 정의는 `registry_version` 외 의미론을 변경하지 않았다.

## broad_spectrum

- value_type: boolean
- cardinality: one
- domain: sunscreen
- required scope: market
- positive authority: exact Subject + exact market + product-specific first-party broad-spectrum claim
- negative: explicit negative only
- evidence class: product_claim

계속 별개다:

- Broad Spectrum != PA
- Broad Spectrum != UVA-PF
- Broad Spectrum != PPD
- Broad Spectrum != quantitative UVA-strength bucket

## Write authority partition

v2 snapshot은 기존 20개 정의까지 포함하지만 **definition 존재가 write authority를 만들지 않는다.**

Preflight 정책:

```text
v1 existing 20 keys
  new lineage      = allowed
  existing lineage = allowed

v2 broad_spectrum
  new lineage      = allowed
  existing lineage = allowed

v2 cloned existing 20 keys
  policy row       = none
  write            = fail-closed / POLICY_MISSING
```

따라서 v2가 global latest가 되어도 SPF/UVA-label/Water는 v1에 계속 pin된다.

## Transaction publish preflight

Production transaction 안에서 실제 admin boundary를 사용했다.

1. 21-definition v2 payload 생성
2. `admin_publish_product_fact_registry_v1` 실행
3. 동일 payload replay → idempotent PASS
4. v2가 실제 global latest가 됨
5. broad_spectrum v2 policy만 active 부여
6. v1 SPF new/existing authority 유지 확인
7. v2 broad_spectrum new authority 확인
8. v2 SPF는 POLICY_MISSING 확인
9. Day Dew에 v2 broad_spectrum review assignment 생성 가능 확인
10. v2 SPF review assignment는 fail-closed 확인
11. Current Facts = 92 / v2 Current = 0 확인
12. 전체 ROLLBACK

## Rollback readback

Rollback 후:

```text
Registry versions        = 1
v2 Registry              = 0
v2 definitions           = 0
v2 policies              = 0
v2 review assignments    = 0
Current Facts            = 92
v2 Current Facts         = 0
v1 policy rows           = 20
```

잔여물은 없다.

## Recommendation boundary

변경 없음:

- protection reader = SPF / uva_label / Water만 소비
- broad_spectrum consumption = false
- protection projection = unchanged
- ranking = unchanged
- production cutover/public activation = false

## R3E가 승인하지 않는 것

- persistent Registry v2 publish
- persistent broad_spectrum write policy
- Evidence write
- Product Fact write
- Day Dew pilot

## 다음 gate

`DATA-AI29C-UVA-R3F — Broad Spectrum Registry Controlled Publish`

R3F에서만 exact checksum payload를 Production에 영구 publish하고,
같은 controlled operation에서 **broad_spectrum v2 write-authority 1개만** 부여한다.

R3F 성공 후에도 Product Fact는 아직 쓰지 않는다.
