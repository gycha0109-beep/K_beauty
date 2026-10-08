# DATA-AI29C-FILTER-R4-A — BUSHMAN Mixed Registry Admission Compatibility Preflight v1

## 판정

`FILTER_R4_A_READ_ONLY_COMPATIBILITY_PREFLIGHT_PASS_ADMISSION_HOLD`

Production 데이터를 읽기 전용으로 freeze하고, 기존 `evaluateSunscreenInitialAdmissionGrant()` 함수에서 현재 BUSHMAN이 왜 NO_GRANT인지 단계별로 검증한다. 정책이나 Production 데이터를 변경하지 않는다.

## 정확한 기준

- main: `c35f71854559865a103e73e4aba4e96bdbe405c8`
- R3-R3 merge SHA: `98ab075a7ae7f8b836f0b08a0719c3df15c8a768`; merge SHA CI 7/7 PASS
- Product: `4608b3b4-8b51-4464-b46e-380b05c1a3d7` (BUSHMAN Waterproof Pro Suncream)
- Subject: `0b5963bb-67d6-4738-a620-32ec86c1e3d0`, exact/current 1
- KR, resolved/current, category sunscreen taxonomy shadow
- Legacy frozen recommendation corpus member = false

## Governed current Product Facts

| Fact | Value | Registry | Serializer | Authority |
| --- | --- | --- | --- | --- |
| spf_value | 50 | v1 | pilot-v1 | supported / primary / high |
| uva_label | PA++++ | v1 | pilot-v1 | supported / primary / high |
| uv_filter_type | hybrid | **v2** | **schema-v2** | supported / primary / high |

기존 v1 / v2 Registry checksum은 freeze evidence JSON에 기록했다. v1 Fact와 v2 Fact를 하나의 Registry provenance로 위장해서는 안 된다.

## 차단 분석 및 검증 순서

기존 정책은 첫 번째 실패 guard에서 `NO_GRANT`를 반환한다. 따라서 실제 Production 입력에 대해 발생하는 reason과 잠재적인 후속 blocker를 분리한다.

| 순서 | 입력 | 예상 decision/reason |
| --- | --- | --- |
| 실제 Production | 그대로 | `NO_GRANT:PRODUCT_FACT_SUBJECT_UNRESOLVED_OR_NON_CURRENT` |
| Subject lineage만 가상 승격 | trust-phase5 authority 치환 | `NO_GRANT:REQUIRED_CURRENT_FACT_AUTHORITY_INCOMPLETE:uv_filter_type` |
| 위 + 단일 top-level Registry를 v2로 치환 | v2 checksum/serializer 제출 | `NO_GRANT:PRODUCT_FACT_REGISTRY_MISMATCH` |
| 위 Subject + UV Fact Registry만 v1로 위조 | serializer는 schema-v2 | `NO_GRANT:REQUIRED_CURRENT_FACT_AUTHORITY_INCOMPLETE:uv_filter_type` |
| 위 Subject + UV registry/serializer 둘 다 v1/pilot로 위조 | semantics = 0/12 | `NO_GRANT:SUNSCREEN_RECOMMENDATION_SEMANTIC_ENVELOPE_NOT_READY` |
| 위 + semantic core 2개만 가상 established | 나머지 10개 not_reviewed | `NO_GRANT:SUNSCREEN_RECOMMENDATION_SEMANTIC_ENVELOPE_NOT_READY` |

가상 authority / Fact lineage 치환은 **오직 메모리 내 반사실 실험**이다. 이런 조합의 GRANT는 실제 Production에서 유효하지 않으며, Fact를 v1로 재작성하는 우회 승인도 아니다.

## 실제 필요 작업

1. **R4-B:** 기존 v1 정책을 보존하고 Fact별 Registry checksum + proposition serializer를 검증하는 별도 mixed compatibility contract를 설계한다. 대상 외 arbitrary v2/mixed를 허용하지 않는다.
2. **R4-C:** Subject identity lineage의 별도 governed authority review. 기존 Subject key/formulation/KR identity를 변경하지 않는다.
3. **R4-D:** 12/12 semantic review. core `category_slot=sunscreen` + `uv_filter_type=hybrid` established. 부정확한 default 값은 채우지 않는다.
4. **R4-E:** 위 조건이 실제로 충족된 뒤 기존 15종 + BUSHMAN 1종 mixed **internal shadow**만 검토한다.
5. **R4-F:** 내부 canary/allowlist 확대는 별도 승인 전에는 수행하지 않는다.

## 불변조건

- Production DB write = 0
- 기존 Product Fact, R3-R3 Evidence, historical research task 불변
- Policy/scorer/recommendation/semantic code 변경 = 0
- D5E-F 기존 4개 authenticated beta 대상 및 D5D switch 불변
- Public/UVA/Water activation 없음
- 현재 실제 admission grant = false (HOLD)
- 12개 semantic review 미충족

## 종료

R4-A는 **원인 확정 단계**다. R4-B 이후 후속 단계는 R4-A PR 병합과 exact merge-SHA CI PASS 이전에 진행하지 않는다.
