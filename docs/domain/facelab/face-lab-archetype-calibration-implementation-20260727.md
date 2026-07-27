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
  → corrected pair metric / suppressed slice privacy
  → governed aggregate report

npm face-lab:archetype:calibrate
  → governed CLI only
```

Ungated CLI는 제거했다.

## 제품 영향

없음.

- API/UI/Premium wiring 없음
- canonical archetype 승격 없음
- Registry threshold·lifecycle 변경 없음
- DB migration·analytics 변경 없음
- Provider call/prompt 변경 없음
- 실제 사진 또는 human label commit 없음
- 자동 정책 선택 없음

## 설계 리뷰 보완

1. hosted projected analysis는 evidence text가 제거돼 재점수화할 수 없었다.
   - sanitized scoring snapshot 입력으로 전환했다.
2. 동일 인물 사진이 split 간 누수될 수 있었다.
   - `subjectId`는 하나의 split에만 존재하도록 validator를 추가했다.
3. label file에 임의 metadata가 추가될 수 있었다.
   - dataset/sample/label/scoring/audit schema를 allowlist로 제한했다.
4. holdout이 일반 validation처럼 반복 실행될 수 있었다.
   - library opt-in과 CLI `--allow-holdout --confirm HOLDOUT` 이중 gate를 추가했다.
5. 소수 demographic slice가 그대로 출력될 수 있었다.
   - pilot/calibration 최소 slice size 5와 suppression을 적용했다.
6. evaluator가 threshold를 추천하거나 Registry를 수정할 위험이 있었다.
   - policy input을 명시적 후보로 제한하고 자동 선택·mutation을 금지했다.

## 구현 리뷰 보완

1. adjacent-pair metric에 ambiguous sample이 섞였다.
   - archetype label만 pair denominator로 사용한다.
2. analysis unusable과 non-positive score가 같은 hold reason으로 합쳐질 수 있었다.
   - `insufficient_quality`와 `low_top_score`를 분리하고 reason을 unique 처리한다.
3. condition tag와 path list가 자유 문자열이었다.
   - safe token 문자와 길이 제한을 적용했다.
4. CLI input이 lexical path만 확인해 symlink escape가 가능했다.
   - root/file realpath boundary를 확인한다.
5. CLI 예외가 stack과 absolute path를 출력할 수 있었다.
   - allowlisted failure code만 출력한다.
6. output 하위 directory가 symlink일 가능성이 있었다.
   - output을 지정 root 바로 아래 신규 JSON으로 제한했다.
7. 민감 audit slice가 일반 이미지 동의만으로 저장될 수 있었다.
   - non-unknown slice에는 별도 `auditSliceConsentConfirmed`를 요구한다.
8. reviewer가 model score를 본 뒤 label을 만들거나 결과 확인 후 policy 후보를 바꿀 수 있었다.
   - blind labeling, label freeze, manual predeclared policy freeze를 강제한다.
9. pair case가 제3유형으로 잘못 release되면 pair 집계에서 빠질 수 있었다.
   - adjacent wrong과 other wrong을 분리하고 total wrong rate를 추가했다.
10. governance field를 core schema에 혼합하면 순수 metric 책임이 비대해졌다.
   - core와 mandatory governance facade를 분리했다.
11. 최초 ungated CLI가 남으면 우회 실행될 수 있었다.
   - 해당 CLI를 삭제하고 npm command를 governed CLI로 교체했다.
12. suppressed slice도 그룹명과 정확한 소수 인원수가 report에 남았다.
   - governed report는 기준 미달 그룹을 제거하고 차원별 suppressed group 수만 남긴다.
13. input/output root 자체가 symlink면 지정 경계 밖을 정상 root처럼 사용할 수 있었다.
   - 두 root 모두 symlink이면 fail-closed 처리한다.
14. CLI 경계가 로컬 수동 검증에만 의존했다.
   - CI verifier에 정상 실행, overwrite, 외부 input, holdout confirmation 검증을 추가했다.

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

- core dataset/policy normalization
- full taxonomy and deterministic ordering
- deterministic report repeatability
- loose/strict policy divergence
- ambiguous forced assignment, expected hold, hold precision
- adjacent 및 제3유형 wrong release 집계
- slice suppression, identity hiding, disparity
- holdout default rejection and explicit access
- subject split leakage rejection
- image/evidence/identifier rejection
- Registry version/candidate order rejection
- blind label/freeze enforcement
- audit slice separate consent
- manual policy freeze enforcement
- aggregate report privacy
- no network call / no Registry mutation
- governed CLI 정상 실행, path, root symlink, overwrite, holdout boundary

## 잔여 위험

- 실제 consented calibration dataset이 없다.
- reviewer training과 adjudication 운영 기준은 실제 pilot 전 검토가 필요하다.
- 실제 threshold 후보는 아직 생성·승인하지 않았다.
- audit slice 동의 문구와 공정성 기준은 별도 검토가 필요하다.
- immutable dataset/policy content digest는 실제 pilot 단계에서 추가해야 한다.
- 현재 report는 policy 비교 도구이며 activation evidence가 아니다.

## 최종 판정

`FACE-EVAL-1`의 계산, governance, privacy, split, holdout, CLI 실행 경계는 구현 가능 상태다. 실제 threshold 확정과 제품 activation은 계속 금지한다.
