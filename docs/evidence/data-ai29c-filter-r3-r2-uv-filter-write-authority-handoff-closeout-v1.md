# DATA-AI29C-FILTER-R3-R2 — UV Filter Registry Write-Authority Handoff Closeout v1

## 판정

`FILTER_R3_R2_UV_FILTER_REGISTRY_WRITE_AUTHORITY_HANDOFF_PASS`

R3-R1에서 고정한 policy handoff를 Production에 controlled RPC로 적용했다.

## Exact-SHA CI prerequisite

`4c1fea94cbb83b1af3f53c2f1375e5d9ce4f45d6` 기준:

- Canonical Static: PASS
- Shadow Runtime: PASS
- Provider Shadow Runtime: PASS
- Protection Shadow Runtime: PASS
- Activation Readiness: PASS
- Current Main Health: PASS
- Supply Chain: PASS

후속 main push로 최초 run 일부가 cancel/fail됐으나 동일 SHA 재실행으로 전부 PASS를 확보했다.

## Rollback dry-run

동일 payload를 transaction 내부에서 먼저 실행 후 ROLLBACK했다.

- v1 new lineage → `NEW_LINEAGE_NOT_ALLOWED`
- v1 existing lineage → `ALLOWED`
- v2 new lineage → `ALLOWED`
- v2 existing lineage → `ALLOWED`
- rollback 후 v1 active / v2 POLICY_MISSING 원상복구 확인

## Production atomic handoff

effective_from:
`2026-10-08T00:33:19.722543+09:00`

동일 transaction에서:

1. v1 `uv_filter_type`
   - `active / new=true / existing=true`
   - → `draining / new=false / existing=true`
2. v2 `uv_filter_type`
   - policy 없음
   - → `active / new=true / existing=true`

policy version:
`data-ai29c-filter-r3-r2-uv-filter-write-authority-handoff-v1`

authorized phase:
`DATA-AI29C-FILTER-R3-R2`

## Audit

- v1 audit: `8889660a-3c92-47fe-86a8-c985b7230a2d`
- v2 audit: `1be4983d-8b99-4eaf-88fb-193c5199eb89`

두 mutation 모두 `admin.operations.execute` capability의 audited setter 경로만 사용했다.

## Production readback

- single new writer count = 1
- single new writer = Registry v2
- v1 Current uv_filter_type = 18
- v2 Current uv_filter_type = 0
- v1 open uv_filter review assignment = 0

BUSHMAN 기존 Fact 불변:

- SPF50 fact/confirmation unchanged
- PA++++ fact/confirmation unchanged
- uv_filter_type Current = 0

즉 이번 단계는 Registry write authority만 이동했고 Product Fact를 만들지 않았다.

## Write boundary

- Registry policy writes: 2
- Source writes: 0
- Binding writes: 0
- Evidence writes: 0
- Review writes: 0
- Product Fact writes: 0
- Recommendation/ranking/beta/public/UVA/Water activation 변화 없음

## 다음 gate

`DATA-AI29C-FILTER-R3-R3_BUSHMAN_GOVERNED_SOURCE_REFRESH_AND_CONFIRMATION`

이제 v2 `uv_filter_type` new lineage authority가 열렸으므로 다음 단계에서만 BUSHMAN exact official source refresh → exact binding → composition evidence → review → confirmation을 수행한다.
