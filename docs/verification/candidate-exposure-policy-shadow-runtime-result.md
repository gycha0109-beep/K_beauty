# CandidateExposurePolicy Shadow Runtime Integration Result

1. **Branch**: `codex/candidate-exposure-policy-shadow-runtime`
2. **Validation SHA**: `054a9c91c853c51e1285ba12901c51bbe60c00a6`에서 implementation 및 local validation을 완료했다. 문서 commit 이후의 authoritative final SHA는 Draft PR head다.
3. **Final HEAD**: 이 문서는 final documentation commit에 포함되므로 자기 자신의 SHA를 고정하지 않는다. Draft PR의 head SHA와 최종 보고의 `git rev-parse HEAD`를 authoritative 값으로 사용한다.
4. **Draft PR**: [#99](https://github.com/gycha0109-beep/K_beauty/pull/99), base `codex/candidate-policy-runtime-reevaluation`, title `feat(candidate-policy): integrate canonical shadow runtime`, Draft 유지.
5. **Local verifier**: `npm run verify:candidate-exposure-policy-shadow` PASS.
6. **Current-product fixtures**: 12/12 PASS.
7. **Safety fixtures**: 13/13 PASS. 요청된 safety cases와 duplicate ID/cross-lane duplicate fail-closed를 포함한다.
8. **Assertions**: focused verifier 193 assertions PASS.
9. **Actual catalog replay**: 164 rows loaded, 164 scorer-compatible, 4/4 scenarios, 656 candidate rows, high-risk collapsed 0.
10. **Actual/synthetic evidence**: actual catalog에서 `safeLowRiskHidden`, `serumCategory`를 관찰했다. `activeLeaningOnly`, `metadataIncomplete`, `strongCaution`은 synthetic-only다.
11. **Divergence category counts**: local fixture/replay classification은 허용된 고정 vocabulary만 사용하며 unclassified 0. Hosted shadow-on KO와 EN은 각각 164 candidate를 평가했고 모두 `expected_exposure_state_expansion`으로 분류됐다. `unexpected_divergence`와 unclassified divergence는 0이다.
12. **Unexpected divergence**: local focused evidence 0, Hosted KO/EN 모두 0.
13. **Response fingerprint**: local shadow 전후 동일 PASS. Hosted shadow-on의 동일 요청 내부 pre/post fingerprint는 KO/EN 모두 `responseFingerprintMatch=true`다. 별도의 default-off/on HTTP 요청 전체 body hash는 독립 OpenAI 설명 생성 때문에 일치하지 않았으며, 이를 정책 mutation 판정 근거로 사용하지 않았다.
14. **Snapshot fingerprint**: local shadow 전후 동일 PASS. Hosted shadow-on 동일 요청 내부 KO/EN 모두 `snapshotFingerprintMatch=true`다.
15. **Candidate order**: Hosted default-off/on 간 KO/EN candidate-order fingerprint가 동일했고, shadow-on 동일 요청 내부 `candidateOrderMatch=true`다.
16. **Production hard-disable**: `VERCEL_ENV=production`에서 opt-in과 무관하게 disabled, malformed/unknown environment disabled, kill switch 우선 PASS. Production 설정과 deployment는 변경하지 않았다.
17. **Exact Preview deployment**: exact implementation SHA `054a9c91c853c51e1285ba12901c51bbe60c00a6`; default-off `dpl_7Ykf2f72hgo9dW2azeZSK46U3GzC`, deployment-scoped opt-in `dpl_C11LmkjFz1rQctZA8JchKxufyyEp`, 둘 다 READY Preview. 프로젝트 environment key는 0개이고 opt-in은 두 번째 immutable deployment에만 한정했다.
18. **KO/EN probe**: GitHub Actions run `30709349633`에서 canonical PNG와 동일한 multipart survey fixture로 KO default-off, KO shadow-on, EN default-off, EN shadow-on 순서의 authoritative 4회 호출을 수행했다. 네 요청 모두 HTTP 200, runtime commit exact match, Premium diagnostic `S9_cookie_emission` 도달을 확인했다.
19. **Shadow execution**: default-off deployment에는 CandidateExposurePolicy shadow telemetry가 없었다. Shadow-on KO/EN은 `executionStatus=executed`, `errorCategory=none`, `fallbackCount=0`, `shadowExceptionCount=0`, `invalidContextCount=0`이었다.
20. **Cleanup**: raw response body와 cookie jar는 workflow 종료 전에 제거했다. 저장 artifact는 identifier-free aggregate fingerprint/count만 포함하며 retention은 1일이다. 임시 workflow는 closeout 기록 이후 branch에서 제거한다. Preview/Production project environment는 변경되지 않았다.
21. **Final marker**: `CANDIDATE_EXPOSURE_POLICY_SHADOW_INTEGRATION_PASS`.

## Local verification detail

- CandidatePolicy reevaluation verifier: 76 assertions PASS
- security closeout: 59/59 PASS
- architecture guard: PASS
- production build: PASS
- response/snapshot/candidate-order invariance: PASS
- telemetry redaction and exception fallback: PASS

## Initial blocked history

최초 Hosted 시도에서는 잘못된 70-byte placeholder가 shallow upload validation을 통과한 뒤 canonicalization에서 실패해 HTTP 400을 반환했다. 교정 재시도 시 공유 analyze quota가 소진돼 HTTP 429가 발생했다. 이 시점에는 성공한 post-canonical shadow 실행이 없었으므로 `CANDIDATE_EXPOSURE_POLICY_SHADOW_INTEGRATION_BLOCKED_EXTERNAL`로 정확히 기록했다.

후속 사전 검증은 canonical PNG, multipart 자동 boundary, JSON field, locale, MIME, off/on payload equality를 확인했다. 2026-08-02 GitHub Actions 사용 승인을 받은 뒤 quota reset 상태에서 정확히 4회의 authoritative Hosted probe를 실행해 blocker를 종료했다.

## Hosted closeout evidence

- GitHub Actions run: `30709349633`, success
- Analyze calls: 4/4, automatic retry 0
- Default-off deployment: `dpl_7Ykf2f72hgo9dW2azeZSK46U3GzC`
- Shadow-on deployment: `dpl_C11LmkjFz1rQctZA8JchKxufyyEp`
- Implementation SHA: `054a9c91c853c51e1285ba12901c51bbe60c00a6`
- KO off/on: HTTP 200 / 200
- EN off/on: HTTP 200 / 200
- Runtime commit header: 4/4 exact match
- Premium final stage: 4/4 `S9_cookie_emission`
- Cross-deployment candidate order: KO match, EN match
- Shadow-on same-request response fingerprint: KO/EN match
- Shadow-on same-request snapshot fingerprint: KO/EN match
- Shadow-on same-request candidate order: KO/EN match
- Expected divergence: 164 KO + 164 EN, all `expected_exposure_state_expansion`
- Unexpected divergence: 0
- Unclassified divergence: 0
- Shadow exception: 0
- Fallback: 0
- Invalid context: 0
- Default-off shadow execution: 0
- API response field/storage schema/UI/runtime filter changes: 0

독립된 off/on 요청의 전체 response body hash는 일치하지 않았다. 두 요청 모두 OpenAI photo-evidence 및 product-explanation provider 경로를 독립 실행하므로 생성 설명이 달라질 수 있다. 따라서 cross-request 전체 body hash를 shadow mutation 판정으로 사용하지 않고, 정책 함수가 실제로 실행되는 동일 shadow-on 요청 안에서 측정된 pre/post response·snapshot·candidate-order fingerprint와 recommendation candidate-order cross-check를 authoritative evidence로 사용했다.

```text
CANDIDATE_EXPOSURE_POLICY_SHADOW_INTEGRATION_PASS
HOSTED_KO_EN_PROBE_PASS
SHADOW_ONLY
RUNTIME_FILTER_NOT_CONNECTED
RESPONSE_FINGERPRINT_UNCHANGED
SNAPSHOT_FINGERPRINT_UNCHANGED
CANDIDATE_ORDER_UNCHANGED
RECOMMENDATION_OUTPUT_UNCHANGED
UNEXPECTED_DIVERGENCE_ZERO
UNCLASSIFIED_DIVERGENCE_ZERO
SHADOW_EXCEPTION_ZERO
STORAGE_SCHEMA_UNCHANGED
GITHUB_ACTIONS_HOSTED_CLOSEOUT_SUCCESS
PRODUCTION_NOT_CHANGED
PR_REMAINS_DRAFT
```
