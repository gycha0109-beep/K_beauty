# FACE-EVAL-1 Calibration Harness Implementation — 2026-07-27

## 완료 범위

- PR #72 exact head에서 stacked branch를 생성했다.
- calibration dataset/policy core validator를 구현했다.
- human label과 sanitized scoring snapshot 계약을 구현했다.
- subject-level split leakage guard를 구현했다.
- explicit policy candidate evaluator를 구현했다.
- aggregate accuracy, hold, ambiguity, adjacent-pair metric을 구현했다.
- sex/age/skin-tone/makeup slice와 disparity 계산을 구현했다.
- minimum slice size suppression을 구현했다.
- holdout explicit gate를 구현했다.
- blind label, audit consent, policy freeze를 강제하는 governance facade를 추가했다.
- governance 전용 local CLI와 sanitized aggregate report writer를 구현했다.
- synthetic examples와 core/governance verifier를 추가했다.
- Unified Vision Static Guard 실행 경로를 추가했다.

## 구조

```text
face-lab-archetype-calibration.js
  → pure normalization and metric core

face-lab-archetype-calibration-governance.js
  → blind label / consent / freeze / allowlist
  → corrected pair metric
  → governed aggregate report

npm face-lab:archetype:calibrate
  → governed CLI only
```

Ungated CLI는 제거했다.

## 제품 영향

없음.

- API wiring 없음
- UI wiring 없음
- canonical archetype 승격 없음
- Registry threshold 변경 없음
- DB migration 없음
- Provider call/prompt 변경 없음
- 실제 사진 또는 human label commit 없음
- 자동 정책 선택 없음

## 설계 리뷰 보완

1. hosted record projected analysis를 직접 재점수화할 수 없었다.
   - evidence text가 제거된 상태이므로 sanitized scoring snapshot 입력으로 전환했다.
2. 동일 인물 사진이 split 간 누수될 수 있었다.
   - `subjectId`는 하나의 split에만 존재하도록 validator를 추가했다.
3. label file에 임의 metadata가 추가될 수 있었다.
   - dataset/sample/label/scoring/audit schema를 allowlist로 제한했다.
4. holdout이 일반 validation처럼 반복 실행될 수 있었다.
   - library opt-in과 CLI `--allow-holdout --confirm HOLDOUT` 이중 gate를 추가했다.
5. 소수 demographic slice가 그대로 출력될 수 있었다.
   - pilot/calibration 최소 slice size 5와 suppression을 적용했다.
6. evaluator가 threshold를 추천하거나 Registry를 수정할 위험이 있었다.
   - policy input을 명시적 후보로 제한하고 자동 선택·mutation flag를 항상 false로 고정했다.

## 구현 리뷰 보완

1. adjacent-pair metric에 ambiguous sample이 섞였다.
   - `disposition === archetype` sample만 pair separation denominator로 사용하도록 수정했다.
2. analysis unusable과 non-positive score가 같은 hold reason으로 합쳐질 수 있었다.
   - governance 계산에서 `insufficient_quality`와 `low_top_score`를 분리하고 중복 reason을 제거했다.
3. condition tag와 path list가 자유 문자열이었다.
   - core validator에 safe token 문자와 길이 제한을 적용했다.
4. CLI input이 lexical path만 확인해 symlink escape가 가능했다.
   - input root와 file의 realpath boundary를 확인하도록 수정했다.
5. CLI 예외가 stack과 absolute path를 출력할 수 있었다.
   - allowlisted failure code만 출력하도록 변경했다.
6. output 하위 directory가 symlink일 가능성이 있었다.
   - output을 realpath가 확인된 root 바로 아래 신규 JSON 파일로 제한했다.
7. 민감 audit slice가 일반 이미지 동의만으로 저장될 수 있었다.
   - non-unknown slice에는 별도 `auditSliceConsentConfirmed`를 요구했다.
8. reviewer가 model score를 본 뒤 label을 만들거나 결과 확인 후 policy 후보를 바꿀 수 있었다.
   - blind labeling, label freeze, manual predeclared policy freeze 선언을 governance facade에서 필수화했다.
9. adjacent pair case가 제3유형으로 잘못 release되면 pair 오분류 집계에서 빠질 수 있었다.
   - adjacent wrong과 other wrong을 분리하고 total wrong rate를 추가했다.
10. governance field를 core schema에 혼합하면 순수 metric module의 책임이 비대해졌다.
   - core와 governance facade를 분리하고 운영 CLI는 facade만 통과하도록 정리했다.
11. 최초 ungated CLI가 저장소에 남으면 우회 실행될 수 있었다.
   - 해당 CLI를 삭제하고 governed CLI로 npm command를 교체했다.

## 변경 파일

- `docs/domain/facelab/face-lab-archetype-calibration-contract-v1.md`
- `docs/domain/facelab/face-lab-archetype-calibration-governance-v1.md`
- `docs/domain/facelab/face-lab-archetype-calibration-implementation-20260727.md`
- `lib/face-lab-archetype-calibration.js`
- `lib/face-lab-archetype-calibration-governance.js`
- `scripts/evaluate-face-lab-archetype-calibration-governed.mjs`
- `scripts/verify-face-lab-archetype-calibration.mjs`
- `scripts/verify-face-lab-archetype-calibration-governance.mjs`
- `scripts/fixtures/face-lab-archetype-calibration-dataset.example.json`
- `scripts/fixtures/face-lab-archetype-calibration-policies.example.json`
- `package.json`
- `.github/workflows/unified-vision-static-guard.yml`

## 검증 범위

- valid core dataset/policy normalization
- full taxonomy and deterministic ordering
- deterministic report repeatability
- loose/strict policy metric divergence
- ambiguous forced assignment
- expected hold and hold precision
- adjacent-pair separation
- 제3유형 wrong release 집계
- slice suppression and disparity
- holdout default rejection and explicit access
- subject split leakage rejection
- image/evidence/identifier payload rejection
- Registry version mismatch rejection
- candidate order rejection
- blind label/freeze enforcement
- audit slice separate consent
- manual policy freeze enforcement
- aggregate report privacy
- no network call
- no Registry mutation
- governed CLI path and overwrite boundary

## 잔여 위험

- 실제 consented calibration dataset이 없다.
- human label protocol의 reviewer training과 adjudication 기준은 실제 운영 전 검토가 필요하다.
- 실제 threshold 후보는 아직 생성·승인하지 않았다.
- audit slice 수집 방식과 동의 문구는 별도 공정성·법적 검토가 필요하다.
- dataset/policy immutable content digest는 실제 pilot 운영 단계에서 추가해야 한다.
- 현재 report는 policy 비교 도구이며 activation evidence가 아니다.

## 최종 판정

`FACE-EVAL-1`의 dataset, policy comparison, privacy, split, holdout, governance 실행 경계는 구현 가능 상태다. 실제 threshold 확정과 제품 activation은 계속 금지한다.
