# [Face Lab / Skin] S5 Product-Ready / Release-Ready 증거 게이트 v1

> 2026-10-14 KST / **EVIDENCE_PENDING** / S5 제품·릴리스 승인 아님. 기준 `main@1a82cf9961f4fbba30d1d59f1ec2de1a3c6dd7e2`. Skin Track 독립. Style Track 출시 상태를 이 문서에서 추론하지 않는다.

## 1. 현재 확인된 개발 증거

| Gate | 현재 증거 | 상태 |
| --- | --- | --- |
| S0 코드/관찰 점수 감사 | 소스→판단→정책→Premium 매핑 및 부정 재현 #1308 | **AUDIT EVIDENCE** (Draft, 미병합) |
| S0→S2 photo status consistency | fallback available 및 `mixed` 처리 좁은 수정 #1309 | **DRAFT / CI Current Main Health PASS**, 운영 적용 전 |
| S1 관찰 신뢰성 | 합성 축별 오탐/미탐/보류 평가 기반 #1310 | **Human·실사진 accuracy HOLD** |
| S2 결정 타당성 | 기존 정책을 변경하지 않는 증거 불일치 탐지기 #1312 | **Human/실제 제품 안전성 HOLD** |
| S3 반복 촬영 비교 | 메타데이터-only `comparable/limited/not_comparable` #1311 | **동일인 실기기·시간축 참값·보관 정책 HOLD** |
| S4 Premium UX | Native 저장 리포트 사진 근거/unknown 표시 #1313 | **Android/브라우저/4섹터 동등성 HOLD** |
| S5 CI/보안 | 2026-10-14 PR들에서 Current Main Health와 PIE 대체로 PASS, SCA 별도 FAIL | **RELEASE BLOCKED — #1208** |
| 운영 개인정보·전문가·승인 | 원본 얼굴 사용 동의·수집/폐기·실사용 Human 판단·Owner 서명 없음 | **HOLD** |

이 표는 개별 PR 결과를 기록한 과거 시점 증거이며 **main 반영 완료를 뜻하지 않는다**. 정식 출시 판정 시 각 PR의 exact HEAD와 재확인된 병합 main, 배포 commit, 개인 사진 처리 계약을 다시 조회한다.

## 2. 2개의 독립 gate

### PRODUCT_READY 선행 증거

- S0 current-code audit `repository` evidence
- S1 independent Human cue observation accuracy `human` evidence
- S2 independent Human decision safety `human` evidence
- S3 real controlled capture repeatability `device` evidence
- S4 mobile + web acceptance `device` evidence

### RELEASE_READY 선행 증거

PRODUCT_READY 선행 충족 후 독립적으로:

- `sca_security`: 종속성/보안 취약점 완전 해소, 예외기간 임의 연장 금지
- `privacy_consent_retention`: 사진 보유/동의/철회/파기/privacy 고지
- `auth_rls_storage_review`: 이미지 접근권한, 인증, 유출 경계
- `production_ci_regression`: 실제 merged main 및 배포 revision의 전체 회귀
- `rollback_and_monitoring`: Provider 실패/비용/로그/중단/rollback
- `responsible_owner_approval`: 승인권자 최종 결정

**증거 있음 ≠ 사실 검증됨 ≠ 승인됨**. 한 단계도 자동 도약하지 않는다.

## 3. 읽기 전용 평가 도구

- `scripts/facelab/skin/skin-s5-readiness-gate.mjs`
- `scripts/facelab/skin/verify-face-lab-skin-s5-readiness.mjs`
- 기존 `scripts/verify-current-main-health.mjs` 단일 synthetic fixture hook, 새 CI workflow 없음.

오프라인 입력: `{schemaVersion: "face-lab-skin-readiness-v1", gateEvidence: { gateKey: {status: "pass"|"hold"|"fail", family, reference }}}`.
- Evidence family 불일치(예: synthetic로 S1 Human 만족) 거절.
- Missing evidence는 `hold`, explicit `fail`은 `BLOCKED`, 전부 보고됐어도 `EXTERNAL_REVIEW_REQUIRED`.
- `productReadyAuthorized=false`, `releaseReadyAuthorized=false` **항상 false**. Evidence reference의 진위/서명도 자동 확인하지 않는다.
- 외부 시스템 조회/사진 저장/Provider 호출/배포/Production DB 접근 없음.

## 4. 현재 S5 판정

**PRODUCT_READY = NO — EVIDENCE_PENDING.**
S1 피부 사진 신호의 실제 판독 정확성 및 S2 실제 판단 안전성, S3 반복 촬영 재현성, S4 기기 UX 승인이 없다.

**RELEASE_READY = NO — BLOCKED.**
독립 공급망 보안 [#1208](https://github.com/gycha0109-beep/K_beauty/issues/1208)의 `braces@3.0.3` / `GHSA-vfj7-8cjw-p6xm` 예외 만료가 현재 차단 중이며, 개인정보·운영·회귀·오너 승인도 미충족.

S4의 Mobile CI 최초 실패는 `verify-mobile-camera-foundation.mjs`의 카메라 emulator 문자열 계약과 현재 main workflow 간 불일치로 추가 조사 필요. UI 신규 테스트 typo는 좁게 수정했으나 정확 HEAD 재검증 필요.

## 5. 다음 외부 개입과 우선순위

1. 보안 Owner: #1208 patched dependency, lockfile, exception removal, SCA exact-head 검증. Skin 트랙에서 우회 금지.
2. 개인정보/DB/Auth Owner: 사진 저장·철회/삭제 및 cross-account isolation, 실사용 동의.
3. Human evaluator/평가 Owner: 조명·피부톤·화장·기기·뷰별 독립 주석/모호성 및 재촬영 비교.
4. 모바일 QA: 촬영 깜빡임/네트워크 실패/Android 스크린리더/재진입 + 기존 camera smoke CI mismatch.
5. Product Owner: 합성·실사진·인수/비용/보안/rollback 근거를 서로 혼합하지 않고 PRODUCT_READY와 RELEASE_READY 별도 서명.

**S5 상태:** gate tool 구현 / 제품·릴리스 **명시적 HOLD**. 사용자 승인 없는 main merge/배포/유료 Provider/사진 저장 없음.

Watchtower-Track: face-lab-skin

## 2026-10-17 current evidence snapshot / exact-gate boundary

- Added privacy-safe historical snapshot `docs/domain/facelab/skin-s5-readiness-snapshot-20261017.json` with all **11 independently defined gates** explicitly recorded: **product 5 HOLD**, **release 1 FAIL (`sca_security`) + 5 HOLD**. The existing `evaluateSkinReadiness` must return **product HOLD, release BLOCKED**. No gate is assigned a PASS based on research-only synthetic CI or Skin-v2 structural success.
- [S1-D study](https://github.com/gycha0109-beep/K_beauty/pull/1340): private corrected-v2 normal path TC-01..TC-04 produced **4/4 structurally valid Skin contracts and 28/28 valid axes**. TC-05 was intentionally ineligible and excluded from normal-path accuracy denominator. This is a completed scoped *structural experiment*, **not** independent Human skin accuracy evidence; the S1 product-level human gate remains HOLD.
- [S3 Draft #1311](https://github.com/gycha0109-beep/K_beauty/pull/1311) exact-head `0768fd995ebe357b1a89bf306d42a86d6d5dae8a`: [Main Health](https://github.com/gycha0109-beep/K_beauty/actions/runs/39025459401) PASS; [PIE](https://github.com/gycha0109-beep/K_beauty/actions/runs/39025459734) PASS, CodeQL PASS; [Supply Chain](https://github.com/gycha0109-beep/K_beauty/actions/runs/39025459422) FAIL. S3 v2 explicit-state adapter prevents v1 0 → absent inference but **does not establish real repeated-capture conditions or skin changes**.
- [S4 Draft #1313](https://github.com/gycha0109-beep/K_beauty/pull/1313) now adds mobile saved-report **async account-switch/retry/logout race protection** on top of photo-state display. No client test is equivalent to actual Android two-account acceptance, server RLS proof or camera/network UAT; retain `s4_mobile_web_uat=hold`. Exact-head CI must be recorded separately.
- The prior S5 ledger's **2026-10-14 braces advisory** is historical. The confirmed latest S3 Supply Chain job `117375453688` failed `production: temporary advisory exception GHSA-86w9-cpqp-85rv expired at 2026-10-16T00:00:00.000Z` (node-forge). The patch/lockfile, exception removal and security owner review are an independent #1208 task; **no exemption extension or bypass** is authorized. Until that security check passes and independent operational/privacy/UAT approvals are supplied, RELEASE_READY remains blocked.
- New `verify-face-lab-skin-s5-current-snapshot.mjs` asserts all mandatory gate families/statuses, product HOLD and release BLOCKED in existing Main Health using *synthetic and dated public metadata only*. It makes no Provider call, network request, image load, DB write, deploy or merge.
- Scope note: both Human accuracy and operational product acceptance are still unverified even though the user closed the four-case research sub-study. Do not request a new study or reopen that sub-study without explicit instruction. Future actual Android/UAT work requires a test device and permitted test account; do not pretend emulator-only/static CI substitutes for that.
