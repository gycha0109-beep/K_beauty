# DATA-AI29C-UVA-R3C — Registry Evolution Coexistence Design v1

## 판정

UVA_R3C_REGISTRY_COEXISTENCE_DESIGN_PASS_IMPLEMENTATION_REQUIRED

R3A에서 broad_spectrum 독립 Fact semantics가 PASS했고, R3B에서 새 Registry를 즉시 latest로 만드는 방식은 HOLD됐다.
R3C는 이 문제를 해결하는 설계 고정 단계다.

이번 단계에서도 Production schema 변경, Registry publish, Product Fact write, Recommendation 변경은 없다.

## 문제

현재 write pipeline은 product_fact_controlled_latest_registry_v1()에 의존한다.
동시에 Current cardinality guard는 subject_id + registry_version + fact_key 단위다.

따라서 단순히 v1과 v2를 둘 다 허용하면 오래된 Registry write를 무제한 허용하거나, 같은 cardinality-one fact_key가 v1/v2에서 동시에 Current가 되는 문제가 생길 수 있다.

## 핵심 불변조건

one fact_key -> at most one write-authoritative registry_version -> at one time

Registry snapshot에 definition이 존재하는 것과 그 Registry가 해당 fact_key의 controlled write 권한을 가지는 것은 별개다.

## Proposed write-policy storage

product_fact_registry_fact_write_policy_v1

개념 필드:
- registry_version
- fact_key
- policy_state: active | draining | blocked
- new_lineage_allowed
- existing_lineage_allowed
- effective_from / effective_to
- policy_version
- authorized_phase
- created_at

new lineage는 새 research/review/adoption lineage 생성 권한이고, existing lineage는 이미 시작된 task/assignment/revalidation 완료 권한이다.

## 초기 정책

v1의 기존 20개 Fact key는 계속 v1이 write authority를 가진다.
v2가 생겼다는 이유로 unrelated v1 작업을 중단하지 않는다.

future v2가 full immutable snapshot을 포함하더라도 write authority는 broad_spectrum에만 부여한다.
기존 20개 key는 v2에서 new/existing lineage 모두 false로 시작한다.

## Admissibility helper

product_fact_controlled_registry_write_admissibility_v2

입력: registry_version, fact_key, lineage_kind(new|existing)
검증: Registry/definition 존재, deprecated 아님, write policy 존재, active/draining 상태, new/existing 권한, expiry.
모든 실패는 fail-closed한다.

## 기존 4개 write path 변경

1. admin_prepare_product_fact_review_v1
   - 새 assignment는 new 권한
   - 기존 assignment transition은 existing 권한

2. product_fact_controlled_build_preflight_v1
   - assignment Registry/fact_key의 existing 권한 확인
   - write-policy digest를 prestate digest에 포함

3. trust_phase4_build_adoption_plan_v1
   - research task에 pin된 Registry/fact_key existing 권한 확인

4. trust_phase8e_build_revalidation_plan_legacy_v1
   - 기존 Registry lineage에 pin하고 existing 권한 확인

## Publication semantics

admin_publish_product_fact_registry_v1의 immutable snapshot publish 기능은 유지한다.
하지만 Registry exists != write authority granted 이어야 한다.
effective_at은 snapshot effective metadata이지 controlled write permission switch가 아니다.

## Cardinality

현재 product_fact_current_cardinality_guard_v1은 Registry version 내부에서만 cardinality-one 충돌을 검사한다.
따라서 같은 fact_key를 v1/v2에서 동시에 쓰는 기능은 별도 migration protocol 전까지 금지한다.

R3C의 1차 방어:
1. fact_key write authority를 한 Registry에만 부여
2. 기존 key의 v2 migration 금지

향후 same fact_key migration 시 cross-registry Current replacement guard 또는 동등한 보호를 추가해야 한다.

## Existing fact_key migration protocol

1. old Registry 새 lineage 생성 차단
2. old Registry active lineage drain/disposition
3. cross-version Current ambiguity 0 확인
4. cross-version supersession/replacement semantics 정의
5. consumer registry invariant 검토
6. old existing-lineage write 종료
7. new Registry write authority 활성화

Registry publish 자체는 migration이 아니다.

## Broad Spectrum

broad_spectrum은 새 fact_key이므로 기존 v1 key와 직접 충돌하지 않는다.
coexistence infrastructure가 준비되면 existing 20 keys -> v1, broad_spectrum -> v2 구조로 시작할 수 있다.

## Recommendation boundary

현재 sunscreen protection consumer는 spf_value, uva_label, water_resistance_duration만 읽는다.
R3D에서도 이 contract는 변경하지 않는다.
broad_spectrum은 Fact-only, score 0, bucket null, Recommendation consumption false를 유지한다.

## 구현 순서

1. per-fact Registry write-policy storage
2. admin-controlled policy management boundary
3. v1 20개 key seed
4. 4개 latest-registry write gate 교체
5. confirmation prestate에 policy digest 포함
6. v1 lineage continuation regression
7. unauthorized Registry/fact pair fail-closed test
8. same fact_key dual-writer 차단 test
9. Recommendation reader/projection 불변 검증
10. 이후 broad_spectrum Registry publish 검토

## 다음 gate

DATA-AI29C-UVA-R3D — Registry Coexistence Implementation

R3D에서 위 infrastructure를 실제 migration/function/test로 구현한다. 그 이후에만 Registry v2 publish와 Day Dew broad_spectrum pilot을 검토한다.
