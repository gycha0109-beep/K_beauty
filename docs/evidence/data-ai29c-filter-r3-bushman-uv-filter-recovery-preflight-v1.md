# DATA-AI29C-FILTER-R3 — BUSHMAN UV Filter Recovery Preflight v1

## 판정

FILTER_R3_BUSHMAN_HYBRID_RECOVERY_PREFLIGHT_PASS_WRITE_NOT_AUTHORIZED

D5E-F closeout 이후 sunscreen frontier를 Production authority 기준으로 read-only 재평가했다.
이번 단계는 zero-write preflight다.

## Frontier 재평가

| 제품 | Admission Fact | Semantic | 현재 blocker | 판정 |
| --- | ---: | ---: | --- | --- |
| SIDMOOL Dr. Troub Zinc Physical | 3/3 | 12/12 | finish 미확정 | HOLD |
| SIDMOOL Bio Repair + Suncream | 3/3 | 12/12 | finish 미확정 | HOLD |
| BUSHMAN Waterproof Pro Suncream | 2/3 | 0/12 | uv_filter_type | SELECTED |
| CellFusionC Aquatica Cooling Sunscreen | 0/3 | 0/12 | admission Fact 전부 부족 | HOLD |
| FULLY Rice Ceramide Moisture Sun Cream | 0/3 | 0/12 | SOURCE_BLOCKED | HOLD |

SIDMOOL 두 제품은 최신 검토에서도 finish를 하나의 enum으로 확정할 authority가 없다. 기존 reviewed_not_established를 뒤집지 않는다.

## 선택 대상 — BUSHMAN Waterproof Pro Suncream

- product_id: 4608b3b4-8b51-4464-b46e-380b05c1a3d7
- subject_id: 0b5963bb-67d6-4738-a620-32ec86c1e3d0
- subject_semantic_key: 33696edfb47c47672930e0d398b0cd67fb966c355ec474ea9ec4ffa72400a584
- formulation_revision_key: data-ai29c-c5-bushman-waterproof-pro-current
- market: KR

현재 Current Fact:
- SPF = 50
- UVA = PA++++
- uv_filter_type = missing

기존 research task:
- task_id: 3aec1254-60e6-42cc-b88d-efb8ed99fd93
- registry: product-fact-registry-cross-category-v1
- state: BLOCKED
- blocker: EVIDENCE_INSUFFICIENT
- attempt: 1

## Registry v2 authority

현재 Registry v2의 uv_filter_type 계약:
- allowed: mineral | organic | hybrid
- semantic: Declared or composition-established UV filter system class.
- evidence: product_claim | composition_identity
- positive requirement: product-specific evidence
- definition checksum: 6dd4e0016889b65dafade9d410692e9ab85b036e0654089950950ceb46f6e917

## 기존 governed source

exact current Subject에 이미 공식 제품 페이지가 binding돼 있다.
- source_id: 9b98d800-66c3-4a40-880c-4c99f415a920
- binding_id: 09650eb5-db97-474b-995c-5f5aeb706467
- binding_state: exact_subject_match
- scope_relation: equivalent
- prior_digest: 696c6ab509c4a0045ef5b408b06a2359e08570cc4d3ece1338a749c3fa2e6460

기존 snapshot은 SPF50+, PA++++, 50ml, 한국콜마, 대한민국까지만 freeze했다. composition authority는 당시 저장하지 않았다.

## 2026-10-07 live official observation

동일 exact 공식 제품 페이지가 현재 화장품법상 전체 성분을 text layer에 직접 공개한다.

무기 필터 marker:
- 징크옥사이드
- 티타늄디옥사이드

유기 필터 marker:
- 디에칠아미노하이드록시벤조일헥실벤조에이트
- 비스-에칠헥실옥시페놀메톡시페닐트리아진
- 에칠헥실트리아존

따라서 current Registry 의미상 composition candidate는 uv_filter_type = hybrid 이다.
단, 이 live 웹 관찰 자체를 Product Fact Current로 직접 쓰지 않는다.

## 다음 gate

DATA-AI29C-FILTER-R3-R1_BUSHMAN_GOVERNED_SOURCE_REFRESH_AND_CONFIRMATION

필수 순서:
1. exact 공식 source를 governed pipeline으로 재관찰
2. current page의 새 content digest 생성
3. 기존 current Subject에 exact binding 확인
4. composition_identity / product_specific_primary / high evidence 생성·검토
5. Registry v2 기준 governed confirmation
6. 기존 SPF/UVA Fact 보존 확인
7. Recommendation mutation 0 검증

## Write boundary

이번 preflight에서 Product Fact, Evidence, research task, source/binding, Registry, semantic review, Recommendation, ranking, beta allowlist, public/UVA/Water activation write는 모두 0이다.
