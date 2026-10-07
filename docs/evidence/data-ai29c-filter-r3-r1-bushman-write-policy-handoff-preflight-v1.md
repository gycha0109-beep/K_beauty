# DATA-AI29C-FILTER-R3-R1 — BUSHMAN Write-Policy Handoff Preflight v1

## 판정

`FILTER_R3_R1_POLICY_MISSING_FAIL_CLOSED_HANDOFF_PREFLIGHT_PASS`

R3 preflight 이후 BUSHMAN governed source refresh + Product Fact confirmation을 시작하기 전에 Production write authority를 fresh-read했다.

결과: Registry v2 `uv_filter_type` 신규 lineage는 `POLICY_MISSING`으로 fail-closed다.

따라서 source/evidence를 먼저 적재하거나 confirmation을 강행하지 않았다. Production write = 0.

## Fresh Production prestate

- Current Product Facts: 105
- Sources / Bindings / Evidence: 81 / 81 / 110
- Fact Instances / Confirmations: 106 / 106
- BUSHMAN uv_filter_type Current: 0
- BUSHMAN uv_filter_type open assignment: 0
- 기존 SPF50 Fact/Confirmation 유지
- 기존 PA++++ Fact/Confirmation 유지

## Registry write authority

v1 uv_filter_type:
- state = active
- new lineage = true
- existing lineage = true

v2 uv_filter_type:
- policy row = 없음
- new-lineage admissibility = false / POLICY_MISSING

setter와 unique index는 동일 fact_key에 두 Registry가 동시에 new_lineage_allowed=true가 되는 것을 금지한다.
따라서 v2를 바로 active로 설정하는 방식은 금지된다.

## 현재 v1 영향 범위

- Current uv_filter_type = 18
- v2 Current = 0
- EVIDENCE_CANDIDATE tasks = 12
- BLOCKED tasks = 7
- ALREADY_COVERED tasks = 4
- open review assignment = 0

`draining`은 new lineage만 막고 existing lineage를 계속 허용하므로 기존 진행 중 lineage를 강제 폐기하지 않는다.

## Frozen BUSHMAN composition authority

- exact official product page
- source digest = `3a9fbcb280935133e95a0f7f19bfff20157258b4dc17b8dce4d601e40f6681a9`
- schema-v2 proposition = `717e0e0eb6b8f5575ac20f0189878bd5af4195bda7da19f427670b12ca95200f`
- canonical evidence digest = `e33410c566219ed28795cd3474abcc5752226b3a7cc8b931f5f0302ffab9bb3f`

observed inorganic filters:
- 징크옥사이드
- 티타늄디옥사이드

observed organic filters:
- 디에칠아미노하이드록시벤조일헥실벤조에이트
- 비스-에칠헥실옥시페놀메톡시페닐트리아진
- 에칠헥실트리아존

candidate = `uv_filter_type=hybrid` / `composition_identity` / `product_specific_primary` / `high`

## 다음 gate — atomic write-authority handoff

`DATA-AI29C-FILTER-R3-R2_UV_FILTER_REGISTRY_WRITE_AUTHORITY_HANDOFF`

한 transaction 안에서 audited admin setter만 사용한다.

1. v1 uv_filter_type → `draining / new=false / existing=true`
2. v2 uv_filter_type → `active / new=true / existing=true`

둘 중 하나라도 실패하면 전체 rollback한다.

R3-R2에서는 source/evidence/review/Product Fact write를 하지 않는다.

R3-R2가 PASS한 뒤에만:
`DATA-AI29C-FILTER-R3-R3_BUSHMAN_GOVERNED_SOURCE_REFRESH_AND_CONFIRMATION`
으로 진입한다.

## R3-R1 write boundary

Registry policy, Source, Binding, Evidence, Review, Product Fact, Product, Recommendation, ranking, beta allowlist, public activation 모두 변경 0.
