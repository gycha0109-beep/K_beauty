# DATA-AI29C-UVA-R3E — Broad Spectrum Registry Publish Preflight v1

## 판정

`UVA_R3E_BROAD_SPECTRUM_REGISTRY_PUBLISH_PREFLIGHT_PASS`

R3D coexistence write-authority 구현 위에서 future Registry v2를 **실제 Production에 남기지 않고** transaction rollback으로 publish preflight했다.

## 후보 Registry

```text
source Registry      = product-fact-registry-cross-category-v1
candidate Registry   = product-fact-registry-cross-category-v2
identity serializer  = product-fact-subject-identity-v1

v1 carried definitions = 20
new definitions         = 1
total                   = 21
new fact_key            = broad_spectrum
```

후보 checksum:

```text
broad_spectrum definition
= c888474e8970f787dee3f71bdcc505a779400b0ebf438901bbc5fd7f2dc32dc9

v2 Registry
= 923256ca2468b2af31e1b7026655739408035daf62d3ff40a7132eca22afddd7
```

## v2 derivation

기존 v1 20개 definition을 의미 보존하여 복제하고 각 definition의 registry_version만 v2로 변경한 뒤 checksum을 재계산한다.
마지막으로 R3A에서 고정한 broad_spectrum boolean definition을 21번째 key로 추가한다.
기존 SPF / UVA label / UV filter / Water semantics는 변경하지 않는다.

## Rollback publish preflight

transaction 내부에서 `admin_publish_product_fact_registry_v1`을 실제 호출했다.

- v2 21 definitions publish → PASS
- v2가 global latest가 됨 → PASS
- broad_spectrum definition checksum/semantic → PASS
- broad_spectrum v2 policy active 부여 → PASS
- broad_spectrum new review assignment 생성 → PASS
- v2 spf_value new lineage → POLICY_MISSING으로 차단
- v1 spf_value new lineage → 계속 허용
- 전체 transaction → ROLLBACK

즉 Registry 존재와 write authority가 분리된 R3D 구조가 publish 시나리오에서도 정상 동작한다.

## Production rollback readback

```text
Registry versions     = 1
candidate v2          = 0
write-policy rows     = 20
Current Facts         = 92
broad_spectrum def    = not published
broad_spectrum Fact   = not written
```

Production 오염 없음.

## Controlled publish 정책

R3F 실제 publish 시 원자적으로 수행할 작업:

1. 완전한 21-key v2 Registry snapshot publish
2. v2 broad_spectrum만 active / new=true / existing=true
3. v2로 복제된 기존 20 key는 policy row를 만들지 않음
4. 따라서 v2 기존 key write는 POLICY_MISSING fail-closed
5. 기존 v1 20 policy는 그대로 active 유지
6. Recommendation reader/projection/ranking은 미변경

예상 publish 직후 상태:

```text
Registry versions              = 2
latest Registry                = v2
v1 write-policy rows           = 20
v2 broad_spectrum policy rows  = 1
v2 carried-key policy rows     = 0
```

## Advisor

R3D 신규 policy table에 대해 Supabase advisor는 `rls_enabled_no_policy` INFO 1건을 보고했다.
이 테이블은 anon/authenticated direct grant가 없고 service_role SELECT only이며 mutation은 audited admin setter로만 수행하는 내부 fail-closed 구조다.
R3D 신규 객체 관련 Security WARN / Performance WARN은 없었다.

## 경계

R3E에서는 실제 Production publish를 하지 않았다.

- Product Fact write 없음
- broad_spectrum Recommendation 소비 없음
- sunscreen protection reader/projection 변경 없음
- ranking 변경 없음
- public activation 없음

## 다음 gate

`DATA-AI29C-UVA-R3F — Broad Spectrum Registry Controlled Publish`

R3F에서만 실제 v2 Registry와 broad_spectrum write policy를 한 transaction으로 Production에 남긴다.
