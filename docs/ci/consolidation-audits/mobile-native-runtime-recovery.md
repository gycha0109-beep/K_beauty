# Android native 종료 복구 제안 — 2026-10-03

## 확인한 문제

PR #1081의 후보 `2318084515f56cccc9f24eb4d7aa515c92e08542`에서 Android APK와 20B 캡처, iOS 빌드·설치·화면 확인 및 기본 검사가 통과했다. Android Smoke는 이전 접근성 이름으로 언어 버튼을 찾다가 실패했다. 해당 selector와 같은 selector를 쓰는 20A consumer는 현재 접근성 이름에 맞춰 수정했고 직접 검사 및 의도적인 이름 불일치 음성 검증을 통과했다.

그러나 20A의 최초 실패는 selector 이전의 **실제 native process 종료**다. run `37105260119`, attempt `1`, 2026-10-03 07:25:41 UTC의 logcat에 `SIGSEGV`, `mqt_v_js`, `MountingCoordinator::pullTransaction(bool) const+706`가 기록되었다. process가 종료되어 최종 UI는 Android 런처였다. 검사 성공으로 처리하거나 무조건 다시 실행해 숨기지 않는다. attempt `2`의 20A 단독 재실행은 재현성 진단이며 전체 후보 통과 증거가 아니다.

## 좁힌 원인 후보와 근거

[react-native-screens 공식 PR #4413](https://github.com/software-mansion/react-native-screens/pull/4413)은 동일한 native 함수/JS thread의 시작 시점 종료에 대해 초기화 경합과 listener 수명 문제를 수정했다. 현재 설치된 `react-native-screens@4.26.2`의 아래 네 파일은 해당 PR의 수정 전 파일과 LF 기준으로 모두 일치한다. 현재 source에도 보호되지 않은 `screenRemovalListener_` 초기화와 raw `this` capture가 남아 있다.

이는 강한 복구 후보이며 이번 종료의 원인을 바이너리 수준에서 완전히 확정했다는 의미는 아니다. 단독 재시도 통과도 이 경합의 부재를 증명하지 않는다. 상세 source fingerprint 및 제안한 수정 후 네 파일은 이 채팅의 외부 `ci-audit/native-recovery-proposal` 산출물에 보관했다. 원본 및 수정 후 fingerprint는 저장소의 `scripts/patches/react-native-screens-4.26.2/manifest.json`에도 보존한다.

- upstream 수정 기준: `b3badd012f83679b12f4e29f2e28eceaa4830efd`
- 비교한 upstream 수정 전 기준: `244e348c6a2c9568515371b849960cd5da2a08ec`
- 대상: `android/src/main/cpp/NativeProxy.cpp`, `NativeProxy.h`, `cpp/RNSScreenRemovalListener.cpp`, `RNSScreenRemovalListener.h`
- upstream의 `cpp/legacy/` 파일은 현재 설치 패키지의 `cpp/` 파일과 동일했다.

## 제안한 제한 수정

Expo 57 / React Native 0.86.3 / Screens 4.26.2의 고정 버전과 lockfile을 유지하며, 공식 수정 네 파일만 설치 직후 적용하는 guard를 추가한다. 새 package patch 도구나 의존성을 추가하지 않는다. guard는 실제 모바일 resolver가 선택한 package version/path와 각 수정 전/후 fingerprint를 검증한다. 이미 정확히 수정된 상태는 재실행 가능하고, 다른 버전·알 수 없는 source·혼합 상태에서는 명확히 실패한다. 원격 source를 빌드 중 동적으로 다운로드하지 않는다.

Android를 실제 컴파일하는 기존 unsigned/debug/signed 소유자의 설치 직후 단계에만 동일 guard를 연결한다. 서명 자격증명·권한·공개 변수·서명 workflow의 수동 진입은 변경하지 않고 서명 배포를 실행하지 않는다. 필요한 직접 verifier와 문서만 갱신한다. 새 자동 workflow 또는 retry 성공 우회는 추가하지 않는다.

공식 수정은 process 수명의 thread-safe listener와 mutex로 보호된 callback 교체/해제를 사용한다. 앱의 여러 ReactHost 사이에서 이전 proxy 해제가 새 callback을 지우지 않도록 ownership token을 확인한다. 인증·저장·API·개인정보 정책 및 앱 기능은 변경하지 않는다.

## 완료 기준

1. 정확한 source 적용/이미 적용/잘못된 버전/source drift/불완전한 파일 상태를 직접 테스트한다.
2. 깨끗한 설치 후 동일 source patch가 적용되고 원래 SDK/lockfile 계약이 유지되는지 확인한다.
3. 새 후보 SHA의 실제 APK 빌드, Smoke, 20A/20B와 고유 산출물을 확인한다. 정상 startup 외에 반복 cold launch에서 이번 종료와 같은 native crash가 다시 관측되는지 확인한다. 반복 통과 횟수와 한계를 기록하며 0회 관측을 완전한 부재 보장으로 표현하지 않는다.
4. 실제 앱 및 JSX 동작을 변경하지 않은 source fingerprint를 비교한다. native compile/runtime 검증 전에는 IMPLEMENTED_UNVERIFIED다.
5. 복구가 확인된 뒤 CI 단계 A의 세 manual gate를 확인하고, 그다음 캐시/선택 실행 단계로 돌아간다.

## 승인 경계와 복구

이 수정은 최초 CI 보정 설계의 실제 native dependency 보존 범위를 확장한다. 2026-10-04 사용자 “승인. 계속 진행”에 따라 네 파일의 공식 수정과 직접 검증 구현을 승인받았다. 현재 native 원격 검증 전 상태는 **IMPLEMENTED_UNVERIFIED**다. main 병합·운영 배포·서명 실행은 계속 범위 밖이다. 실패하면 guard/연결을 일반 후속 커밋으로 되돌리고 원래 고정 package source를 clean install로 복원한다. 위험을 숨기기 위한 검사 제거나 버전의 임의 승격은 하지 않는다.

## 구현과 검증 — 2026-10-04

- 실제 모바일 resolver와 lockfile에서 Screens 4.26.2를 확인했다. 앞선 4.26.0 표기는 선언 범위와 설치 버전을 혼동한 기록으로 정정한다. 의존성 선언/lockfile은 변경하지 않는다.
- 네 upstream source와 MIT 라이선스/전후 SHA-256을 저장소에 보존한다. 원본 fixture는 guard 테스트에서만 사용한다.
- 실제 Android 컴파일 소유자 세 곳의 설치 후/prebuild 전 guard를 연결한다. 잘못된 버전·source·payload·혼합 상태·경로 이탈을 거부하고 교체 실패 시 이전 byte를 복원한다. 프로세스 강제 종료 시 혼합 상태를 거부하므로 clean install로 복구한다.
- 기존 Smoke에서 초기 실행 후 열 번 force-stop/start를 수행하고 각 시작 UI 및 15초 process 생존/누적 app crash buffer를 확인한다. 실패한 launch를 재시도하지 않고 최초 실패에서 종료한다. 결과는 기존 Smoke artifact에 보존한다. 실제 emulator 결과 전에는 반복 검증 PASS로 보고하지 않는다.
- 같은 SDK/JSX/UI source를 유지한다. 적용된 package의 native source가 추가 빌드 입력이 되므로 후속 Gradle 캐시 key에도 guard/vendor 입력을 포함한다.

## 실제 Android 결과와 iOS 추가 진단

후보 `1dd7fbe4bc18d6f2ab74373ef9c9aaf8dad71531`, Android run `37166436677` attempt 1 / pull_request:

- 네 job 모두 SUCCESS, 고유 SHA 산출물 네 개 모두 nonempty/unexpired.
- 고정 Node22.23.1에서 직접 suite 12/12와 source guard PASS. 실제 APK 컴파일 876초, 374 tasks executed; cache 효과 측정은 아니다.
- 최초 시작 뒤 열 번의 별도 process cold launch 모두 PASS. 각 15초 생존과 누적 app crash buffer 검사 성공. PID 열 개가 서로 다름을 로그에서 확인했고 원래 기능 Smoke도 PASS. 이 표본에서 충돌 0회 관측이며 낮은 빈도의 경합 완전 부재를 보장하지 않는다.
- 세 수동 확인도 동일 SHA/producer/attempt/event로 PASS: `37167887020`, `37167888403`, `37167889877`. APK/에뮬레이터를 다시 만들지 않았다.

따라서 승인된 **Android 복구는 해당 runtime에서 VERIFIED**다. 전체 CI 단계 A는 아래 iOS 문제 때문에 아직 완료하지 않는다.

iOS run `37166436724`는 unsigned build/install/initial camera/16-frame no-Home-flash까지 PASS였으나 같은 runtime의 root URL 이동 후 Home OCR 검사에 실패했다. 실패 캡처는 `Preparing camera...`가 표시된 카메라 Modal이다. 이 후보에서 앱/SDK/iOS 실행 코드가 이전 성공 `ca5139de`와 byte 기준 동일함을 확인했다. 원인 분류는 **runtime 화면 전환 실패, 원인 미확정**이며 단순 OCR 오류나 Android backport 회귀로 단정하지 않는다.

직접 실패 consumer인 iOS smoke와 그 테스트/진입 verifier까지 진단 범위를 넓힌다. 한 번 보낸 root URL을 다시 보내거나 앱을 재실행하지 않고, 원래 PID 생존과 정확한 Home 두 token을 최대 열 프레임/45초 관찰 예산으로 확인한다. 진행 중 screenshot/OCR 명령이 종료된 뒤 예산을 판단한다. 모든 프레임/OCR 및 실패 시 runtime log와 새 crash report를 기존 artifact에 보존한다. 원래 최초 진입/flash exclusion/Home 필수 token/crash failure를 유지한다. 동일 프로세스의 지연 전환과 지속 오화면/종료를 구분하는 실제 shell fixture 5개 PASS. 이는 iOS 기능 복구 증거가 아니라 **IMPLEMENTED_UNVERIFIED 진단 보강**이며 실제 재검증에서 판정한다.
