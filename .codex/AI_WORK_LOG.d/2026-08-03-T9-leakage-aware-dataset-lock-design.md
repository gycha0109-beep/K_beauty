# 2026-08-03 — #T9 Leakage-aware Dataset Lock Design

## 작업 식별자

- Toolkit Track: `#T9`
- Branch: `design/T9-leakage-aware-dataset-lock`
- Base branch: `feature/T8-review-export-report`
- Base SHA: `9dc45deff9570d7d0a514019a92e00f57e339fb1`
- 작업 유형: documentation-only design

## 목적

현재 active T6 G4를 직접 재검증하고, T6 leakage coupling과 prior split exposure를 보존하면서 train/development/validation/test/holdout을 component 단위로 잠그는 T9 계약을 설계한다.

```text
current active G4
→ source snapshot
→ leakage graph
→ exposure registry
→ deterministic component split
→ explicit human lock review
→ immutable dataset version
→ holdout-scoped G5
→ optional regression baseline activation
```

## 추가 문서

- `tools/synthetic-evaluation/docs/leakage-aware-dataset-lock-v1.md`
- `tools/synthetic-evaluation/docs/adr/0023-current-g4-authority-and-dataset-source-snapshot.md`
- `tools/synthetic-evaluation/docs/adr/0024-leakage-components-sticky-splits-and-exposure-monotonicity.md`
- `tools/synthetic-evaluation/docs/adr/0025-deterministic-component-splitting-and-immutable-dataset-versions.md`
- `tools/synthetic-evaluation/docs/adr/0026-g5-holdout-lock-and-regression-baseline-boundaries.md`
- `tools/synthetic-evaluation/docs/adr/0027-source-universe-lock-basis-and-two-stage-dataset-activation.md`

ADR 0027은 독립 자체 리뷰에서 발견한 source cherry-picking과 content-addressed identity cycle을 해결하며, 주 설계 문서의 충돌하는 초기 ordering을 supersede한다.

## 핵심 결정

1. T7/T8의 as-of-closeout G4 수를 현재 authority로 신뢰하지 않고 T6 status chain을 다시 검증한다.
2. candidate가 아니라 leakage connected component를 split unit으로 사용한다.
3. canonical SHA, campaign series, reference/edit lineage, reviewed visual similarity, representative/alias 관계를 coupling input으로 사용한다.
4. unreviewed dHash/embedding distance는 authoritative edge가 아니다.
5. split exposure를 append-only로 기록하고 동일 lineage에서 sticky exact split을 유지한다.
6. train/development/validation/test 노출 component를 더 엄격한 split로 승격하지 않는다.
7. 새 edge가 prior cross-split components를 연결하면 자동 재배치하지 않고 dataset/baseline authority를 invalidation한다.
8. caller seed를 금지하고 source/graph/plan digest 기반 deterministic assignment entropy를 사용한다.
9. infeasible quota를 component 분리로 해결하지 않는다.
10. human dataset-lock review가 완료된 뒤에만 locked version을 발행한다.
11. G5는 `G5_LEAKAGE_LOCKED_HOLDOUT` usage lock이며 label-quality 승급이 아니다.
12. dataset version, G5, regression baseline identity를 분리한다.
13. default export에서 holdout identity와 asset reference를 제외한다.
14. T9 v1은 model training/inference/scoring을 실행하지 않는다.
15. v1 source request는 arbitrary candidate/G4 allowlist를 받지 않고 closed-run universe 전체의 current active G4를 검토한다.
16. dataset member record, version manifest, exposure claim, G5 사이의 digest cycle을 `DatasetLockBasisV1`로 분리한다.
17. locked version 이후 exposure/G5/status를 작성하고 `DatasetActivationManifestV1`을 최종 active-authority commit point로 발행한다.

## 자체 리뷰 수정

- G5 의미를 holdout usage lock으로 제한
- current T6 재검증과 post-lock revoke cascade 추가
- version 간 exposure monotonicity/sticky split 추가
- retroactive leakage conflict와 baseline invalidation 추가
- caller seed 제거 및 deterministic objective 고정
- source exclusions/quarantine을 dataset denominator에서 분리
- holdout materialization을 별도 explicit authorization으로 분리
- dataset lock과 model-specific baseline identity 분리
- candidate-level source allowlist 제거 및 source-universe selection 추가
- pre-manifest member/exposure/G5의 future dataset digest 참조 cycle 제거
- locked version과 active dataset authority를 두 단계로 분리
- partial G5/exposure publication이 active dataset으로 오인되지 않도록 activation manifest-last boundary 추가

## 비대상

- source/package/runtime/test/workflow 구현
- 실제 split 또는 dataset version 생성
- 실제 G5 생성
- 실제 holdout materialization
- 실제 model training/inference/benchmark execution
- 실제 regression baseline activation
- public dataset upload/publish
- production route/UI/DB/Auth/Payment/Storage 변경
- merge

## 검증

Documentation-only design이므로 runtime test/build는 실행하지 않는다.

설계 검토 결과:

- Critical: 0 open
- Important: 0 open
- Minor: 0 open
- Status: `READY_FOR_IMPLEMENTATION_REVIEW`
