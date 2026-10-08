# DATA-AI29C-FILTER-R4-B — BUSHMAN Mixed Registry Compatibility Contract v1

## 판정

`FILTER_R4_B_EXACT_MIXED_REGISTRY_COMPATIBILITY_CONTRACT_IMPLEMENTED_NO_ADMISSION`

R4-A Production freeze와 기존 Admission v1 정책을 토대로 **BUSHMAN 한 제품만** 인정하는
읽기 전용 Fact lineage compatibility 계약을 추가한다. 실제 Admission evaluator 또는 Production reader에는 연결하지 않는다.

## Fact별 정확한 허용 조합

| Field | Value | Registry | Registry checksum | Proposition serializer |
| --- | --- | --- | --- | --- |
| SPF | 50 | v1 | `79d41ac13de8080df5199543e31ad7bbc1c1763836ef776313613b7547b79575` | pilot-v1 |
| UVA | PA++++ | v1 | 위 v1 checksum | pilot-v1 |
| UV filter | hybrid | v2 | `923256ca2468b2af31e1b7026655739408035daf62d3ff40a7132eca22afddd7` | schema-v2 |

모든 Fact는 exact BUSHMAN Subject, 단일 current, 유효 fact instance/confirmation/proposition,
supported/primary/high-or-medium 및 non-stale 조건을 충족해야 한다.
Fact가 3개보다 적거나 많거나 중복되면 HOLD한다.

Registry v1+v2 스냅샷 둘 다 정확히 일치해야 하며, 임의 checksum, v3, 다른 product/market/formulation을 허용하지 않는다.

## 정책 독립

- 변경 없는 정책: `lib/sunscreen-initial-admission-grant-policy.mjs`
- 신규 파일: `lib/sunscreen-mixed-registry-admission-compatibility-contract.mjs`
- 평가: `evaluateBushmanMixedRegistryCompatibility()`
- baseline: `lineageCompatible=true`, `subjectAuthorityReady=false`, `semanticEnvelopeReady=false`
- decision: `MIXED_REGISTRY_LINEAGE_VALID_ADMISSION_HOLD`

이 판정은 제품의 Fact 출처 호환성만 검증한다. 어떤 반사실 입력에서도
`admissionGranted=false`이며, runtime wiring이나 beta allowlist 조작은 없다.

## 독립 후속 게이트

1. R4-C: Subject `data-ai29c-c5-presentation-identity-correction-v1`을 기존 정책의
`trust-phase5-admin-subject-review-v1` 권한으로 정당하게 승격 가능한지 governed preflight.
2. R4-D: 실제 Product-specific evidence로 Semantic 12/12 field review 및 core 2개 established.
3. R4-E: 위 근거가 모두 충족된 후 별도 Admission policy 결정과 mixed internal shadow 검증.
4. R4-F: Canary / beta expansion은 별도 승인.

## 회귀 검증

새 verifier는 위 exact tuple PASS, registry/serializer/checksum/scope/taxonomy/current/authority/value
negative 테스트, Subject와 Semantic 독립 HOLD 및 기존 D2 5종 v1 Admission GRANT를 검사한다.

## 안전 경계

`Product Fact / Subject / Semantic / Registry / Admission / Recommendation / scorer / Beta / public`에 대한
Production write는 **0**. 기존 D5E-F 4-product authenticated beta corpus, UVA/Water HOLD 유지.

R4-B PR merge 후 exact SHA CI PASS 전까지 R4-C 진행 금지.
