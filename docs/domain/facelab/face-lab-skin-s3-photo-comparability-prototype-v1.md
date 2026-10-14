# [Face Lab / Skin] S3 피부 사진 반복 촬영 비교 — 비저장 Preflight 설계

> **상태:** S3 메타데이터 비교 알고리즘 시제품, **S3 DoD 미완료**. 기준선 `main@1a82cf9961f4fbba30d1d59f1ec2de1a3c6dd7e2`. S0 감사 #1308 / S1 평가 인프라 #1310 참조. Skin Track 전용, Style Track 미수정.

## 1. 사용자의 기대와 잘못된 동일시 방지

원하는 흐름: 과거 촬영 → 현재 촬영 → 촬영 조건과 신호별 평가 가능성 비교 → 변화 근거 제시 → 유지/조정/재촬영 필요 여부 판단. 그러나 지금은 **기존 사진 점수 차이가 실제 피부 호전을 증명할 수 없다.**

변인:
- 장비·렌즈·후처리 및 해상도
- 조명 강도·방향·화이트밸런스
- 화장·필터·가림·촬영 각도
- 사용자 설문상 변화·제품/루틴 변경(별도의 증거)
- 실제 피부 표면 변화

서로 다른 차원을 하나의 `improvement` 지표로 합치지 않는다.

## 2. 권한과 데이터 경계

- **허용:** 동일 사용자 가명 그룹(`subjectGroupId`), 촬영 ID, UTC 시각, 품질 조건 범주, 피부 축별 `observed|unassessable|unknown`, Raw signal 0-5, 관찰 confidence 등 **구조화된 테스트 메타데이터** 비교.
- **금지:** 실사진 업로드, 원본 얼굴/crop 지속 저장, DB/RLS/Storage/API 스키마 수정, 얼굴 특징/Style Engine 재사용, 얼굴 인증, Provider 추가 호출, 서비스 행동 승인.
- **현재 시제품:** `scripts/facelab/skin/skin-photo-comparability-core.mjs`. Production runtime에서 호출하지 않으며 별도 상태 DB/사용자 히스토리 테이블을 만들지 않는다.
- **동의 HOLD:** 반복 사진 연동·지속 타임라인·사용자 데이터 보존/철회/삭제 시나리오·교차 계정 분리는 별도 개인정보·DB 오너 승인이 필요하다.

## 3. 비교 결과 계약

함수: `compareSkinPhotoSessions(before, after)`, 결과 version `skin-photo-comparability-v1`.

상태:
- `not_comparable`: 사용자 그룹/촬영 ID 동일/시간 역행, 사진 이용 불가, 화장·필터 존재/미확인, 화이트밸런스/조명 불일치·부적합. **모든 숫자 변화 비노출**.
- `limited`: 다른 기기/각도/해상도 제한 등이 있거나, 해당 축에서 개별 신호가 관찰 불가·불확실. 변화값 숨김.
- `comparable`: 기록된 촬영 메타데이터가 사전 정의된 최소 표준 조건과 일치할 때의 **평가 후보**. 사진 조건이 같다는 메타데이터만 증명하며 진짜 사진학적 동등성이나 피부 변화를 입증하지 않는다.

각 축 `status`는 전역 상태보다 **더 보수적**일 수 있다. 미지 신호/축 누락/낮은 confidence는 해당 축에서 `not_comparable`로 남긴다. 명시적 관찰값 0은 무근거 0으로 보완하지 않는다.

각 축 결과: `beforeEvidenceState`, `afterEvidenceState`, `reasonCodes`, **연구/디버깅 전용** `rawScoreDeltaForAudit`, `improvementClaimAuthorized=false`. 연구용 숫자 차이는 동일 조건·중간 이상 confidence·동일 축에서 관찰한 경우에만 생성되며, UI/의학적 개선 문구·추천 변경 승인 권한 없음.

## 4. 부정 테스트 및 경계

동일 캡처 반복, 시간 역행, 다른 사용자 가명, Provider 실패, 필터, 화장, 색온도/조명, 다른 기기, angle, 저해상도, 축 누락, 관찰 불가능+0값 모순, low-confidence, API 외 사진 URL/이미지 필드 유입 거부 검증.

검증: `node scripts/facelab/skin/verify-face-lab-skin-s3-comparability.mjs`. Pure synthetic fixture; 정량 피부 개선율이나 실사용 성공률을 주장하지 않는다.

## 5. 다음 실행 게이트

1. S1 Human cue 판독 reference set 및 촬영 변인 검증 완료.
2. S2 사진/설문/제품 충돌 및 행동 안전성 기준 도달.
3. 동일 사용자 반복 촬영·기기 조건 통제 및 실제 일치율/오차 범위 수치화.
4. 보관 동의 및 withdrawal/delete/privacy/RLS, Android 카메라 측 실기기.
5. S4/UI: 표시 `변화 확인 가능 / 제한 / 재촬영 권장`를 사용자 이해도 검증 후에만 활성화.
6. S5: 실사용 검증, 별도 release/security 승인(현행 #1208 HOLD).

**S3 상태:** 메모리 기반 비교 계약 및 synthetic negative-case 구축, 사용자 타임라인 저장/실제 변화 검증 **HOLD**.

Watchtower-Track: face-lab-skin
