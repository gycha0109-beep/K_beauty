# [Face Lab / Skin] S4 Premium 모바일 저장 리포트 — 사진 근거 상태 감사·보강

> 상태: 모바일 **부분 UX 보강**, 실기기 인수 및 S4 전체 완료 **HOLD**. 기준 `main@1a82cf9961f4fbba30d1d59f1ec2de1a3c6dd7e2`, Skin Track 전용. Style/Face Lab 추천 영역 별도 소유. 일자 2026-10-14.

## 1. Current-main 진입 경로

| 경로 | 실제 코드 | 감사 판정 |
| --- | --- | --- |
| 웹 Full Report | `app/result/full-report/page.js` + `components/full-report/PremiumRoutineConsultSection.jsx`, `PremiumFunctionalDecisionSection.jsx`, `PremiumConditionResponseSection.jsx` | 루틴·기능성·컨디션 섹터 구분 및 근거 일부 표시. 실제 render, 320px, 다크모드, 이해도 평가 미실시 |
| 모바일 Premium 생성 | `apps/mobile/app/premium.tsx` → `features/premium/premium-client.ts` | 서버 Premium session/entitlement 사용, 결제/권한 수정 없음 |
| 모바일 저장 리포트 | `apps/mobile/app/saved-report.tsx` → `features/reports/NativeSavedReport.tsx` | 현재 `fullRoutine/functionalDecisions/conditionResponses`를 일반 텍스트로 flatten. canonical 상태/HOLD의 의미 보존, 4개 스킨 섹터의 완전한 동등 표현은 미검증 |
| 모바일 촬영 | `apps/mobile/features/camera/NativeFaceCamera.tsx` | CameraView, 로컬 촬영·재촬영·사진 수락 UI 존재. 실기기에서 품질·네트워크·프레임 깜빡임·권한 오류 확인 미실시 |

## 2. 이번 범위 — 저장 Premium 사진 상태 노출만

- `apps/mobile/features/reports/skin-photo-evidence-status.ts`: 저장된 `photoEvidenceState`, `freeResult.photoEvidenceState`, `decisionBundle.context.photo.status`, 관찰 `confidence`를 **읽기만** 한다.
- Explicit `unavailable/ineligible/insufficient_evidence/not_provided`와 canonical `available`가 충돌하면 이를 숨기지 않는다. **보수적인 상태·보류 문구**를 먼저 표시한다.
- `available`을 표기하더라도 사용 가능성을 뒷받침하는 중간/높은 confidence observation이 없으면 **단정할 수 없다는 안내**를 추가한다.
- 과거 리포트에 canonical `available`만 있고 명시적인 사진 근거 상태가 없으면 **unknown**을 유지한다. 부족한 데이터를 안전/관찰 성공으로 승격하지 않는다.
- `NativeSavedReport.tsx`에 한국어/영어 '사진 관찰 근거 / Photo evidence' 문구를 추가한다. 기능성·루틴·제품 추천·컨디션 상태는 수정하지 않는다.

## 3. 새 synthetic 회귀

`scripts/facelab/skin/verify-face-lab-skin-s4-native-photo-evidence.mjs`:

- 명시적 available와 confidence가 있는 관찰
- provider unavailable vs 기존 v4 available 상태 충돌
- ineligible/insufficient/no photo
- 구형 canonical available만 존재하는 snapshot → unknown
- 관찰 confidence low/빈 관찰 배열
- 저장 리포트 원본 필드 mutation 금지
- 상태 불일치 한국어 보류 문구와 컴포넌트 연결

CI: 기존 `scripts/verify-current-main-health.mjs` 내부의 추가 unit verifier. 신규 workflow/Provider/Storage 호출 없음.

## 4. S4 완료 조건 및 별도 QA/HOLD

- 저장 Premium의 원래 4개 Skin 섹터(현재 루틴 점검/문제 추적/다음 변화 플랜/상황별 대응)와 NativeSavedReport flat rendering 간 정보 동등성은 아직 미검증. 이번 PR로 완성되었다고 표현하지 않는다.
- 웹 320px/큰 글자/VoiceOver/TalkBack/스크린리더, 다크모드, 섹터 링크, 제품 미확인/UNKNOWN/HOLD, 재진입/동일성, iOS/Android 실기기 UAT 필요.
- 촬영 중 플래시/반복 노출, 방향/회전, 백엔드 연결 오류, 오프라인 재시도, 권한 취소·회복, 계정별 리포트 격리는 실기기·운영환경 필요.
- S1의 사진 정확도, S2의 실제 Human safety, S3 시간축 데이터/동의/보관 정책, #1208 security block은 S4 UI 구현으로 해소되지 않는다.
- **반영 권한:** 기존 리포트 필드 추가·변경 없음, DB/Auth/RLS/Storage/Payment/Provider/Style/배포 수정 없음, merge/deploy 금지.

**S4 상태:** 사진 실패 및 불확실성의 모바일 표시 계약 구축 / UI·기기 acceptance **HOLD**.

Watchtower-Track: face-lab-skin
