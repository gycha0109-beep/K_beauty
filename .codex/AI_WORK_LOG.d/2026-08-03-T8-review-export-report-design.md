# #T8 Review / Export / Report Design Work Log

## Purpose

종료된 T7 campaign closeout과 참조된 T2–T6 근거를 다시 검증하고, 정확한 20-slot denominator를 유지한 review package, deterministic export, descriptive report 경계를 설계한다.

## Base

- Base branch: `feature/T7-pilot-campaign-runner`
- Exact base SHA: `408a7da1c4d155f239d566d6ba45c47a98f0efed`
- Design branch: `design/T8-review-export-report`

## Files

- `tools/synthetic-evaluation/docs/review-export-report-v1.md`
- `tools/synthetic-evaluation/docs/adr/0019-report-source-snapshot-and-derived-metric-authority.md`
- `tools/synthetic-evaluation/docs/adr/0020-fixed-denominator-and-non-causal-provider-comparison.md`
- `tools/synthetic-evaluation/docs/adr/0021-blind-annotated-review-and-immutable-report-revisions.md`
- `tools/synthetic-evaluation/docs/adr/0022-evidence-metric-render-layering-and-g4-time-boundaries.md`
- `.codex/AI_WORK_LOG.d/2026-08-03-T8-review-export-report-design.md`

## Core design

```text
verified T7 closeout
+ referenced T2–T6 evidence
→ immutable evidence snapshot
→ exact 20-row slot table
→ fixed-denominator metric set
→ blind / annotated review package
→ deterministic JSON / CSV / HTML export
→ typed descriptive report
```

- primary denominator 20 고정
- A/B/C/D 각 denominator 5 고정
- 모든 technical, valid-ineligible, incomplete, non-Gold, held, rejected, cancelled outcome 보존
- caller-supplied count를 신뢰하지 않고 slot evidence에서 재계산
- T8가 observation, judgment, alignment, promotion outcome을 재분류하지 않음
- composite score, winner/ranking, significance, causal claim 금지
- Provider 비교는 Provider field 외 모든 source/policy가 동일할 때만 허용
- blind contact sheet와 annotated analytical sheet 분리
- canonical image 무변경, thumbnail은 resize-only derived display object
- typed source-linked interpretation claim만 authoritative report에 허용
- report/export immutable, predecessor-linked revision
- closeout G4는 as-of-closeout으로만 표현
- current T6 status appendix는 선택적이며 T9 authority가 아님
- split/G5/holdout/public publish/production integration 제외

## Independent self-review corrections

초기 설계 후 다음 정밀도 문제를 수정했다.

1. exporter/renderer version이 source snapshot identity를 바꾸는 문제
2. report policy와 metric engine을 upstream evidence identity와 혼합한 문제
3. later T6 revocation이 historical closeout report를 무효화할 수 있는 모호성
4. timestamp-only retry가 semantic identity를 바꿀 수 있는 문제
5. report review state를 report object 안에 직접 넣어 provenance가 약해지는 문제

ADR 0022로 다음 3단계 identity를 확정했다.

```text
CampaignEvidenceSnapshotV1
→ CampaignMetricSetV1
→ CampaignReportV1 / CampaignExportManifestV1
```

## Verification

Documentation-only design review:

- source/runtime/package/dependency/workflow changes: 0
- actual campaign/report/export execution: 0
- production route/UI/DB/Auth/Payment/Storage changes: 0
- Provider/network/browser execution: 0
- G4/G5/split/holdout operation: 0
- critical design issue after ADR 0022: 0 open
- important design issue: 0 open
- minor design issue: 0 open

Tests and production build are not applicable to this documentation-only branch.

## Next

승인 후 별도 `feature/T8-review-export-report` implementation branch에서 contracts, source resolver, slot table, metric engine, comparison gate, review renderer, immutable storage, CLI, tamper/idempotency tests를 구현한다.
