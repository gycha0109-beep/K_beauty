# 모바일 CI 보정 단계 A — 구현 및 검증 기록

## 현재 상태

2026-10-03, **IMPLEMENTED_UNVERIFIED**. 승인된 설계의 첫 단계인 자동 호환 대기 중단을 로컬 후보에 구현했다. 현재 변경분의 원격 네이티브 실행은 아직 확인하지 않았다. 단계 B의 캐시·중복 제거와 단계 C의 선택 실행은 **HOLD**다.

- 작업 브랜치: `codex/mobile-ci-compatibility`
- 구현 기준 HEAD: `3af30370546a58e8d8e086c2cf92c5c59cfefa62`
- 시작 당시 로컬 HEAD: `f822511c5e1c8efc1cef520cc7674bfc72a27ada`
- 마지막 원격 조회 main: `4cf58a6290d1ec0fd5c9074b89fd5b4c0b72fc4d`
- 마지막 원격 증가분은 TRUST formulation evidence와 직접 verifier 4개 파일로, 이번 수정 파일과 겹치지 않았다. 원격 후보 생성 전에 기준을 다시 맞추고 검증해야 한다.
- 기존 미커밋/미추적 변경 57개를 유지했다. SHA-256 비교로 이번 단계와 겹친 Native Shell workflow, topology verifier, 책임 문서 및 추가 기록하는 Work Log 이외의 기존 파일이 변경되지 않았음을 확인했다.
- 커밋·스테이징·push·병합·배포와 GitHub 정책 변경은 수행하지 않았다.

## 변경과 보존 계약

`mobile-native-shell.yml`, `mobile-20a-store-capture.yml`, `mobile-20b-store-capture.yml`의 자동 PR/push 진입을 제거했다. 파일·workflow/job 이름·Watchtower 연결은 유지하고 수동 `workflow_dispatch`만 남겼다. 수동 실행은 완료한 생산자의 run ID, 최신 attempt, 원래 이벤트를 필수 입력으로 받는다.

`await-mobile-android-runtime.mjs`는 기존 파일명을 유지하며 대기를 제거했다. GitHub Actions 읽기 요청 5회로 workflow 식별, repository, 현재 checkout SHA, 이벤트, 최신 attempt, 완료 성공, 실제 4개 job 및 4개 산출물을 확인하고 마지막에 재실행 경합을 확인한다. 진행 중·실패·취소·오래된 attempt·불완전한 응답은 즉시 실패한다. 요청당 최대 10초이며 retry/polling은 없다. workflow 제한은 5분이고 `actions: read`, `contents: read` 권한을 유지한다. 임의 API origin이나 redirect로 토큰을 전달하지 않는다.

실제 `mobile-android-runtime.yml`은 작업 시작 스냅샷과 **바이트 단위로 동일**하다. APK 생산 1회, Native Shell Smoke, 20A, 20B job ID/name/needs, 캡처 화면·언어·fixture·산출물 계약을 바꾸지 않았다. iOS runtime, MOBILE-13/15의 unsigned/signed 경계, 앱 코드·의존성·배포 설정도 이번 단계에서 바꾸지 않았다.

책임 map/registry와 직접 verifier는 자동 보호 shim 3개가 아닌 수동 확인 역할을 기록한다. 과거 PR #749 동등성 증거는 그대로 보존했다. 워크플로 파일 수는 69개, 자동 모바일 root dependency 감시 소유자는 5개에서 4개다. 새 primary responsibility/Watchtower track/권한/패키지는 추가하지 않았다. 기존 overlap 분류 `MANUAL_ONLY_REVIEW`와 preservation policy `preserve-until-equivalence-proven`을 재사용한다. 현재 consolidation 상태 문구는 수동 역할을 명시하도록 갱신했다.

수동 실행 시 선택한 ref의 SHA와 생산자 SHA가 정확히 같아야 한다. PR merge SHA의 생산자 기록을 선택한 branch tip SHA와 혼용하면 실패하는 것이 정상이다. 부분 재실행은 최신 attempt에 네 job이 모두 성공했다는 증거가 없으면 실패한다. 필요한 경우 전체 job을 재실행한다. 산출물이 만료된 과거 실행도 통과하지 않는다.

## 보호 설정 재조회

최종 읽기 전용 조회: **2026-10-03 06:06:56 UTC / 15:06:56 KST**.

| 조회 | 실제 응답 |
|---|---|
| main branch | `protected=false` |
| classic required_status_checks | HTTP 404, `Branch not protected` |
| repository rulesets | `[]` |
| main effective rules | `[]` |

기존 책임 문서의 조회 불가 403 설명을 현재 응답으로 갱신했다. 미래의 보호 설정을 보장하지 않으며 원격 전환 직전 같은 조회가 필요하다. 보호 설정이 추가되거나 조회할 수 없으면 자동 shim 중단 전환은 HOLD하고 승인 설계의 복구 경로를 따른다.

## 실행한 검증

| 검증 | 결과와 범위 |
|---|---|
| `node --test scripts/test-mobile-runtime-gate.mjs` | PASS, 정상/잘못된 식별자·SHA·event·attempt/실패/취소/누락·중복·만료/HTTP 오류/timeout·토큰 비노출/재실행 경합 45개 |
| `node scripts/verify-ci-trigger-topology.mjs` | PASS, 실제 4개 생산자 job·1회 APK·소비자와 manual-only 경계; 위 gate suite도 실행 |
| `node scripts/verify-ci-workflow-responsibility-map.mjs` | PASS, 69개 workflow 책임/정책/Watchtower 계약 |
| `node scripts/audit-ci-workflow-overlap.mjs --check` | PASS, 69개 workflow, 현재 보호 shim 0개 및 기존 보존 계약 |
| `node scripts/verify-mobile-13-15-ci-responsibility.mjs` | PASS, 수동 unsigned/signed 책임 계약 |
| `node scripts/verify-mobile-20b-store-scenarios.mjs` | PASS, 고유 화면·scenario 계약 |
| `node scripts/verify-mobile-20b-store-capture.mjs` | PASS, 현재 capture source 계약 |
| `node scripts/verify-mobile-native-shell.mjs` | PASS, 기존 로컬 generated Android native-shell 계약. 새 APK 설치·실행 증거는 아님 |
| 3개 수동 workflow YAML 파싱 | PASS, 자동 이벤트 없음, 필수 입력 3개, 읽기 권한, 5분 제한. 기존 로컬 YAML parser를 사용했으며 의존성을 추가하지 않음 |
| 실제 GitHub API helper readback | PASS, 아래 과거 실행의 4개 job/산출물과 재조회까지 검증. 현재 후보의 runtime 증거는 아님 |
| `git diff --check` | PASS, 변경 파일 형식 |

실제 API readback 대상: run `36189655150`, attempt `1`, event `push`, SHA `8e3f312ca58161fcd7e622dbb9c1d12185fa11df`. 토큰은 프로세스 메모리에서만 사용했고 기록하거나 출력하지 않았다. 작업 실행·재실행 API는 호출하지 않았다.

### 기존 Windows 20A 검사 제한

- expected: `foreground-detector-body-present`의 shell 함수 구간 검출.
- observed: `node scripts/verify-mobile-20a-store-capture.mjs`가 해당 assertion에서 실패.
- runtime: Windows/PowerShell, checkout의 `capture-mobile-store-assets.sh`가 CRLF.
- failure stage: 정적 source parsing. verifier의 `\n}\n\n` 검색이 CRLF에서 일치하지 않는다.
- classification: 기존 checkout 줄바꿈/검사 환경 차이. 해당 capture script와 verifier는 이번 단계에서 수정하지 않았다.
- reproduction: `node scripts/verify-mobile-20a-store-capture.mjs`.
- 추가 진단: 별도 Node 프로세스에서 `.sh` 읽기만 메모리상 LF로 정규화하자 20A verifier 전체 PASS. 저장소 파일을 정규화하거나 수정하지 않았다. 이 결과를 원본 Windows 명령 PASS 또는 Linux CI 실행 PASS로 보고하지 않는다.

## 아직 필요한 완료 증거

동일한 새 후보 SHA에서 Linux의 APK/Smoke/20A/20B와 macOS의 iOS 실행, 고유 산출물, 직접 CI verifier를 확인해야 한다. PR/push에서 세 호환 workflow가 자동 실행되지 않는 것과 수동 확인 세 경로가 해당 후보의 완료 생산자를 승인하는 것도 원격에서 확인해야 한다. 그 전에는 Stage A를 VERIFIED/MERGED/DEPLOYED로 보고하거나 Stage B/C를 구현하지 않는다.

네이티브 작업을 생략하지 않았으므로 전체 pipeline 시간이나 비용의 실측 절감은 아직 없다. 자동 polling job 3개의 제거라는 구조 변경만 확인했다. 과거 약 82분 표본을 이번 후보의 절감량으로 쓰지 않는다.

## 원격 검증 착수 — 2026-10-03

사용자가 모바일 보완과 CI 1단계의 커밋·push·검증용 PR을 명시적으로 승인했다. main 병합/운영 배포는 승인 범위 밖이다. 기존 변경을 보존한 채 당시 최신 `origin/main`(`11cbffc37ce243a8a27ee05518dff12db3986c6d`)에서 `codex/mobile-ci-verification` 브랜치를 만들었다. 앞의 브랜치/미커밋 설명은 첫 구현 시점 기록이다.

이 기준에서 모바일 typecheck, 실제 함수 회귀 20개와 runtime gate 45개(합계 65개), 직접 모바일/CI verifier 14개가 통과했다. 원격 결과는 실제 후보 SHA/run/job/artifact로 별도 기록하며, 그 전에는 다음 캐시/선택 실행 구현을 시작하지 않는다. 서명 배포 workflow는 실행하지 않는다.

## 원격 실행 결과와 제한 복구 — 2026-10-03

PR [#1081](https://github.com/gycha0109-beep/K_beauty/pull/1081), 후보 `2318084515f56cccc9f24eb4d7aa515c92e08542`:

- Android run `37105260119` attempt 1: APK PASS(컴파일 793초), 20B PASS, Smoke/20A FAIL.
- iOS run `37105260141`: 빌드·설치·Simulator 화면 확인 PASS.
- Current Main Health 및 모바일 Client/API/Store Readiness PASS. 세 legacy workflow의 PR 자동 실행은 0개였다.
- Smoke failure는 앱의 현재 접근성 label 대신 예전 testID를 text/content-desc로 찾던 selector 불일치였다. Smoke/20A consumer와 직접 verifier를 현재 label에 맞춰 수정하고 label drift 음성 검사로 재발 방지했다. 앱 label이나 언어 전환 동작을 변경하지 않았다.
- 20A 최초 failure는 logcat에서 native SIGSEGV를 확인했다. 단독 재실행(attempt 2)은 시작과 EN capture를 지나 예전 locale selector에서 실패했다. 이 재실행을 전체 통과 또는 native 경합 부재 증거로 쓰지 않는다.
- 검사 실패와 native stack에 근거하여 직접 두 smoke/capture script 및 두 verifier까지 복구 범위를 확장했다. 이 범위 확장 이유를 본 기록에 남겼다. APK/consumer job, 고유 캡처 및 실패 조건은 제거하지 않았다.
- 수정한 20A verifier는 shell 입력만 LF로 읽어 Windows CRLF 검사 문제도 해결했다. 원본 Windows 명령이 현재 PASS이며, 위 최초 CRLF 실패 기록은 역사적 진단이다. 차단 조건을 약화하지 않았다.
- native dependency의 추가 수정은 아직 제안/HOLD다. [제한 복구 제안](mobile-native-runtime-recovery.md)의 공식 수정 4개 source와 현재 고정 package의 수정 전 source가 모두 일치한다. 추가 사용자 범위 승인 뒤 구현·runtime 재검증이 필요하다.

단계 A는 아직 IMPLEMENTED_UNVERIFIED이며 B/C는 native failure 복구 이후 진행한다. 원격의 두 실패를 성공으로 우회하거나 불완전한 attempt를 manual gate로 승인하지 않았다. main 병합·운영 배포·서명 workflow 실행은 수행하지 않았다.

## 복구 및 다음 단계

### 2026-10-04 승인된 native 복구 구현

- selector 수정 후보 `ca5139de8ed029be69b9ff3a636e152e1b51aeb6`는 Android `37107541106` 및 iOS `37107541133`에서 전체 native 검사에 성공했다. 앞서 관측된 간헐 경합의 해결 증거와는 구분한다.
- 사용자 승인으로 공식 Screens PR4413의 네 파일을 기존 SDK에 backport한다. 실제 설치/lock 버전은 **4.26.2**이며 선언은 `~4.26.0`이다. 과거 제안/PR의 4.26.0 설치 버전 표기를 정정한다.
- clean `npm ci` 이후 실제 resolver/원본 fingerprint 일치, guard 적용/재실행, 원본·버전·payload·혼합·경로 이탈 거부, 파일 교체 실패 복구 및 concurrent overwrite 방지 검사 PASS. 실제 cold-launch shell을 정상/충돌/프로세스 종료 fixture로 실행해 실패 즉시 종료를 확인했다. 직접 suite 12개 PASS.
- foundation/typecheck/workspace config, CI topology/69개 책임/overlap, Android preflight 및 signed-source 경계, entry/20A, shell syntax 검사를 수행한다. 로컬 Node는 24.14.0이며 원격 고정 Node22.23.1/Android compile·runtime 결과는 별도 확인한다.
- Android 컴파일 소유자 세 곳의 설치 후 guard를 추가했다. 신규 workflow/의존성/lock/API/저장/권한/서명 진입 변경은 없다. Smoke에 열 번의 새 process 시작과 각각 15초 생존·app crash buffer 검증을 추가하고 기존 앱 기능 검사는 계속 실행한다.
- 현재 원격 main은 `a8c5d666`로 전진했고 작업 브랜치는 원격과 0/0이다. main을 작업 브랜치에 임의 병합하지 않는다.
- 새 native 후보 원격 검증 전 **IMPLEMENTED_UNVERIFIED**. Stage B/C의 순서와 완료 기준을 유지한다.

### 1dd7fbe4 원격 결과 및 iOS 전환 진단

Android `37166436677`의 APK/Smoke/20A/20B 전체 SUCCESS, 열 번의 새 process cold launch와 원래 기능 Smoke PASS. 동일 candidate의 수동 확인 세 경로 `37167887020`/`37167888403`/`37167889877`도 SUCCESS이며 정확한 producer attempt 1 / pull_request / SHA를 승인했다. 각 고유 산출물 네 개를 확인했다. 승인된 Android 복구는 이 runtime에서 VERIFIED다.

iOS `37166436724`는 build/install/initial camera/no-Home-flash PASS 이후 root URL→Home transition에서 FAIL. 실제 캡처는 여전히 camera Modal이다. iOS/app/SDK 입력은 이전 성공 후보와 동일했고 실패 원인을 아직 확정하지 않았다. root URL을 한 번만 보내고 원래 PID가 살아 있는 동안 정확한 Home token을 관찰하는 보강과, 실패 시 누락되던 runtime/crash artifact 수집을 추가한다. direct shell fixture 정상/지연/지속 오화면/프로세스 종료/OCR 이후 종료 5개 및 entry/topology/책임/syntax 검사는 PASS. 원래 필수 화면/초기 프레임 검사와 crash failure는 보존한다.

상세 진단은 [native 복구 기록](mobile-native-runtime-recovery.md)을 참조한다. 전체 A는 iOS 재검증 전 IMPLEMENTED_UNVERIFIED이며 B/C는 HOLD다. 테스트 재시도 성공으로 실패를 덮거나 캐시 작업을 먼저 시작하지 않는다.

필요하면 이번 단계의 일반 후속 커밋으로 세 workflow의 자동 진입과 이전 polling 계약 및 책임/verifier를 함께 복원한다. 기존 57개 모바일 보완 변경까지 되돌리거나 강제 Git 작업을 사용하지 않는다.

다음 필수 작업은 현재 후보를 원격 검증 가능한 상태로 만들고 **동일 SHA CI 동등성 확인**을 수행하는 것이다. 최초 구현 턴은 저장소 규칙에 따라 로컬 검증까지 완료했으며, 후속 사용자 승인으로 검증용 커밋·push·PR 생성이 허용되었다.
