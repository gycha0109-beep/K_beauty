# 비주얼리 모바일 보완 구현 결과 — 2026-10-03

저장소에서 수정할 수 있는 주요 보완을 반영했다. 계정이 바뀌었는데 이전
응답이 화면에 남거나, 동의 없이 사진을 보내거나, 실패한 요청을 반복하면서
새 분석을 만드는 문제를 방지하는 데 초점을 맞췄다. 앱스토어 배포 준비 완료
판정은 아직 아니다.

- 작업 유형: 승인된 설계의 실행 / 인증·개인정보·배포 설정 포함.
- 브랜치: `codex/mobile-release-hardening`.
- 기준: `origin/main`의 `7fe4c2c229208202947e63c2c6695722712c58c4`.
- 전체 상태: **IMPLEMENTED_UNVERIFIED**. 아래 로컬 검증은 통과했지만 실제
  기기·인증 제공자·서명 배포에 대한 필수 검증이 남아 있다.
- 변경은 로컬 작업 브랜치에 있다. 커밋·푸시·병합·운영 배포는 수행하지 않았다.

## 후속 원격 검증 착수 — 2026-10-03

사용자 승인으로 기존 모바일 보완과 CI 보정 1단계를 함께 `codex/mobile-ci-verification` 브랜치에서 커밋·push·검증용 PR로 전달한다. 브랜치의 시작점은 당시 최신 원격 `11cbffc37ce243a8a27ee05518dff12db3986c6d`다. 위 브랜치/기준/미커밋 설명은 최초 구현 당시 기록이며 현재 전달 상태와 구분한다. 모바일 typecheck, 회귀 20개 및 CI gate 45개, 직접 verifier 14개는 새 기준에서 재통과했다. 원격 native·기기·제공자·서명 검수 완료를 뜻하지 않는다. main 병합과 운영 배포는 수행하지 않는다.

## 무엇이 달라졌나

| 항목 | 반영한 보완 | 확인 범위 |
|---|---|---|
| 계정 혼선 | 로그인 이벤트를 먼저 구독하고, 계정/요청별로 늦은 응답을 폐기. SDK 로그인·로그아웃·삭제 후 정리를 순서대로 처리 | 실제 화면 함수와 SDK 모의 응답 회귀 테스트 |
| 로그인 보안 | URL에서 토큰을 직접 받아 세션을 만드는 경로 제거. 정확한 콜백의 PKCE 코드만 허용. 중복 콜백 차단, Apple nonce 검증 추가 | 파서·콜백·nonce 테스트, 타입·계약 검사 |
| 사진·AI 동의 | 사진과 설문을 서버 및 OpenAI에 보내기 전 명시적 동의. 입력·계정·언어가 바뀌면 재동의 | 동의 전 네트워크 금지, 오래된 버튼 핸들러 무효화 테스트 |
| 느린 통신·재시도 | 응답 본문까지 제한 시간 적용. 동일 입력의 요청 키 유지, 409/429와 대기 시간 표시. 화면 이탈 시 기다림 중단 | 중복 제출·시간 초과·백그라운드·재시도 테스트 |
| 사진 파일 정리 | 재촬영/이탈/완료 시 앱 캐시의 해당 파일만 정리. 실제 업로드가 끝나기 전 삭제하지 않음. 카메라를 닫은 뒤 도착한 사진 폐기 | 캐시 경계·업로드 보호·카메라 지연 응답 테스트 |
| 다이어리 | 토큰 갱신 시 작성 중인 내용 유지. 월 조회 순서 역전 방지. 자정 이후 이전 날짜 초안 자동 저장 금지 | 계정 전환·초안·자정·쓰기 테스트 |
| 공개 공유·삭제 | 공유창 취소가 공개 링크를 비공개로 되돌리지 않는다는 안내. 삭제 응답 이후 다른 계정 세션을 지우지 않음. 불명확한 삭제 결과는 확인하도록 안내 | 공개 처리·공유 취소·계정 삭제 경합 테스트 |
| 사용자 화면 | 게스트 개인정보 링크, 주요 48-point 버튼, 읽기 쉬운 Light/Dark 색상, 사용자용 접근성 이름과 문구 | 계산상 대비 및 소스 검사. 실제 화면/스크린리더는 미검수 |
| 배포 설정 | 기존 GitHub 공개 설정을 Expo 키로 주입하고 서명 빌드 전 검증. 잘못된 서버 주소·HTTP/로컬 주소·비공개 키 거부 | 실제 저장소 공개 변수로 안전성 검사 통과. 설정값은 출력·저장하지 않음 |
| CI 누락 | 루트 의존성 변경과 직접 소비 파일 감지. 새 회귀 테스트 연결. API/스토어 검사의 기존 담당 유지 | YAML·CI 역할/트리거·배포 계약 검사 |

DB·migration·RLS·운영 데이터, 기존 API 응답과 저장 형식, 결제 정책,
추천·Face Lab 판단 로직을 변경하지 않았다. 새 의존성은 Expo SDK의 지정
범위에 맞는 `expo-crypto@57.0.2` 한 개다.

## 실행한 검증

| 검증 | 결과 | 의미와 한계 |
|---|---|---|
| `npm ci --no-fund` | PASS | 깨끗한 설치, lockfile 유지. Expo 57.0.21 / RN 0.86.3 / Crypto 57.0.2 / Reanimated 4.5.1 / Worklets 0.10.1 확인 |
| `npm run mobile:typecheck` | PASS | 현재 모바일 타입 검사 |
| `node --test scripts/test-mobile-release-hardening.mjs` | 20/20 PASS | 실제 TS/TSX 함수와 효과를 모의 SDK·네트워크·파일 시스템으로 실행. native 렌더링 증거는 아님 |
| 모바일 직접 계약 검사 | 17개 PASS | foundation, entry, auth, camera, guidance, diary, analyze, saved report, public share/result, premium, 13(Android), 14, 15, 16A, 17, native shell |
| CI topology / responsibility / 13–15 역할 검사 | PASS | 기존 69개 워크플로와 담당 유지, 중복 APK 빌드 없음, 수동 서명 경계 유지 |
| 변경한 YAML 파싱·diff 검사 | PASS | 구조·중복 키·공백 확인 |
| Android prebuild / Crypto autolink | PASS | Android 생성 프로젝트의 권한·식별자·앱 링크와 Crypto 모듈 연결 확인. APK 컴파일 증거는 아님 |
| Android / iOS JS export | PASS | 각 플랫폼 번들 생성. 서명 APK/AAB/IPA 또는 실제 실행 증거는 아님 |
| 공개 설정 gate | PASS / 정상 차단 | GitHub 기존 공개 변수는 통과. 로컬 설정 누락은 실패하도록 확인. 설치 앱과 서버/Supabase의 실제 연결은 미검증 |
| 공급망 검사 | 기존 기준 비회귀 PASS | 아래 한시 예외가 적용된 결과. 취약점 제거 완료를 뜻하지 않음 |

공급망 원시 집계는 production **High 19 / Moderate 10**, 전체 설치 범위는
**High 22 / Moderate 10**, Critical 0이다. 차이 3개는 개발 의존성 경로다.
기존 `braces`(GHSA-vfj7-8cjw-p6xm, 10월 10일 만료)와 `node-forge`
(GHSA-86w9-cpqp-85rv, 10월 16일 만료)의 범위 제한 예외가 적용된다.
예외 추가·범위 확대·강제 버전 변경은 하지 않았다. 패치 가능성 확인과
예외 만료 전 재검사는 배포 전 남은 보안 조건이다.

Windows의 원본 공급망 실행기는 `spawnSync npm.cmd EINVAL`로 audit 시작 전에
실패했다. 파일을 수정하지 않고 메모리에서 npm 실행 부분만 `cmd.exe`로
호환시켜 동일한 audit·예외·기준 검사를 실행했다. Linux CI 통과로 보고하지 않는다.
번들 재검증의 `--platform all`은 웹까지 포함하여 범위 밖 `react-native-web`
요구로 실패했고, 의존성을 추가하지 않고 Android/iOS 각각으로 재실행하여 통과했다.

## 배포 전에 남은 실제 검수

1. 동일 후보의 Android/iOS 네이티브 빌드와 내부 배포를 실행한다.
   로컬 Android SDK 36은 있지만 NDK가 없고 연결 기기도 없다. Windows에서는
   iOS/Xcode 검증을 수행할 수 없다. GitHub 서명 워크플로 실행·스토어 업로드는 하지 않았다.
2. 내부 테스트 앱에서 두 계정 교대, Google 로그인 취소·복귀, Apple 최초/재로그인,
   삭제 직전 재인증·토큰 해제, 화면 이탈과 앱 재시작을 확인한다.
3. 카메라 거절·설정 복귀·재촬영·기기 발열, 작은 화면·큰 글자·키보드·스크린리더,
   KO/EN·Light/Dark를 실제 화면으로 검수한다. 새 스토어 스크린샷도 이 후보로 촬영한다.
4. 실제 서버 연결과 공개 정책/연락처, 스토어 개인정보·AI 안내의 일치 여부를 확인한다.
   실제 사진 전송·AI 비용 발생·운영 계정 삭제는 이번 검증에 포함하지 않았다.

다음 작업은 **동일 후보의 Android/iOS 내부 배포 검수**다. 위 항목을 통과하기
전에는 VERIFIED·MERGED·DEPLOYED 또는 스토어 제출 가능 상태로 바꾸지 않는다.

## 변경 위치와 재현

- 앱: `apps/mobile/app`, `components`, `features`, `lib`, 모바일 package/루트 lockfile.
- 검사: 새 회귀·공개 설정 검사, 영향받은 모바일 verifier와 CI topology verifier.
- CI: Mobile CI / Android Runtime / Native Shell / iOS Shell / Distribution Authority /
  Store Readiness. API Integration의 검사는 이동하거나 복제하지 않았다.
- 구조 기준: [모바일 아키텍처](../architecture/mobile-foundation.md),
  [CI 역할 문서](../ci/workflow-responsibility-map.md).
- 작업 기록: [AI Work Log](../../.codex/AI_WORK_LOG.md).

```powershell
npm run mobile:typecheck
node --test scripts/test-mobile-release-hardening.mjs
node scripts/verify-mobile-15-distribution-authority.mjs
node scripts/verify-ci-trigger-topology.mjs
node scripts/verify-ci-workflow-responsibility-map.mjs
node scripts/verify-mobile-13-15-ci-responsibility.mjs
```

생성된 Android 프로젝트는 기존 CNG 정책에 따라 gitignored 상태다.
로컬 JS 번들과 audit/autolink 원본 증거는 이 채팅의 외부 `mobile-audit` 산출물
폴더에 보존했다. 값이 들어간 환경 파일이나 서명 파일은 작성하지 않았다.
