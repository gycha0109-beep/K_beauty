# FACE-ENGINE-1 Archetype Shadow Implementation — 2026-07-27

## 완료 범위

- obsolete PR #41을 미병합 종료했다.
- `codex/survey-input-contract-refactor`에서 전용 브랜치를 생성했다.
- 7개 archetype의 versioned rubric Registry를 추가했다.
- Registry validator를 추가했다.
- pure deterministic scorer를 추가했다.
- contribution ledger와 evidence coverage를 추가했다.
- fail-closed shadow decision adapter를 추가했다.
- 합성 verifier와 CI 실행 단계를 추가했다.

## 변경 파일

- `docs/domain/facelab/face-lab-archetype-scoring-contract-v1.md`
- `docs/domain/facelab/face-lab-archetype-shadow-implementation-20260727.md`
- `lib/face-lab-archetype-registry.js`
- `lib/face-lab-archetype-scoring.js`
- `lib/face-lab-archetype-decision.js`
- `scripts/verify-face-lab-archetype-scoring.mjs`
- `package.json`
- `.github/workflows/unified-vision-static-guard.yml`

## 제품 영향

없음.

- API wiring 없음
- UI wiring 없음
- canonical archetype 승격 없음
- DB migration 없음
- `saved_reports` 변경 없음
- Provider prompt/call 변경 없음
- analytics 변경 없음

## 리뷰 중 보완

1. 초기 evidence coverage가 expected value match 비율로 계산돼 있었다.
   - 근거 존재 여부와 archetype 일치도를 분리했다.
   - coverage는 evidence가 있는 positive indicator weight 비율로 수정했다.
2. required axis가 status만 available이고 evidence가 비어 있는 경우 누락으로 잡히지 않았다.
   - `evidenceAvailable` 기준으로 수정했다.
3. `unavailable` 상태 전체를 eligibility 실패로 분류할 수 있었다.
   - `failureReason === eligibility_failed`만 `ineligible`로 처리하도록 수정했다.
4. Registry-level lifecycle만 확인하면 일부 archetype이 미검증이어도 taxonomy ready가 될 수 있었다.
   - 모든 archetype lifecycle/calibration status 검사를 추가했다.
5. ledger가 evidence 문자열을 복사할 가능성을 제거했다.
   - path와 evidence count만 남겼다.

## 검증

실행 명령:

```bash
npm run verify:face-lab-archetype-scoring
```

검증 범위:

- positive / negative fixture
- tie / low score / insufficient
- malformed Registry
- deterministic repeatability
- ledger 합계
- required evidence
- fail-closed
- forbidden evidence regex

## 잔여 위험

- 현재 weight와 taxonomy는 calibration 전 가설이다.
- 실제 사진 기반 threshold, top-margin, hold precision은 미검증이다.
- bias evaluation dataset이 없다.
- 제품 activation은 의도적으로 차단돼 있다.
- PR #41의 provider image-budget 요구는 별도 현재 구조 설계가 필요하며 이번 범위에 포함하지 않았다.

## 최종 판정

`FACE-ENGINE-1`의 계약 및 shadow 계산 경계는 구현 가능 상태다. 제품 판정과 사용자 노출은 계속 금지한다. 다음 단계는 `FACE-EVAL-1 Calibration`이다.
