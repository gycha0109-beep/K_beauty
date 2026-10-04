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

## 현재 완료 기준 — 2026-10-04

Stage A는 후보 `f70078a4e8e77ccb3ad255a0c671fa862f1177d5`에서 **VERIFIED**다. main 병합/배포 상태가 아니다.

| 실제 실행 | 결과 |
|---|---|
| Android Runtime `37168515289`, attempt 1, pull_request | APK/Smoke/20A/20B 모두 SUCCESS; 컴파일 792초, 374 tasks executed; 새 PID의 cold launch 10회 및 기존 기능 검사 PASS |
| iOS Shell `37168515296` | Xcode26.6 / iOS26.5 / iPhone Air unsigned build/install PASS; PID97701 유지, 한 번의 root URL에서 첫 관찰 프레임 Home PASS; Analyze/My 및 crash scan PASS |
| Native Shell manual `37169831641` | 정확한 위 Android producer/SHA/attempt/event 승인 SUCCESS |
| 20A manual `37169833470` | 같은 producer 승인 SUCCESS |
| 20B manual `37169835267` | 같은 producer 승인 SUCCESS |

원격 PR 검사 모두 SUCCESS이며 Android 고유 산출물 네 개와 iOS 산출물은 현재 SHA의 만료되지 않은 파일이다. PR 자동 실행에서 세 manual-only compatibility workflow의 자동 실행은 없다. Android suite 12개와 iOS observer fixture 5개도 고정 Node22.23.1에서 PASS.

이 iOS 실행은 기다림을 여러 번 시도해 얻은 성공이 아니다. 첫 관찰에서 Home이 확인됐다. 이전 camera Modal 잔류 실패의 원인은 아직 확정되지 않았으며 앱 코드/SDK 수정으로 해결했다고 주장하지 않는다. 향후 같은 실패가 나오면 보강된 frame/OCR/PID/runtime/crash 증거로 진단한다. 실제 기기와 서명된 배포 검증은 수행하지 않았다.

## Stage B1 — 의존성 캐시와 중복 호출 보정

Stage A의 같은-head 검증 뒤 착수했다. 기존 `setup-java@v5`만 Gradle 의존성 캐시 소유자로 사용한다. cache key는 루트 package/lock, mobile package/app 설정, 로컬 native modules, shared package, 고정 JDK/SDK/NDK를 포함하는 실제 Android workflow, Screens guard/manifest/네 native source를 명시적으로 해시한다. lock에 포함된 Expo/Gradle 생성 버전 변경도 키를 바꾼다. 생성 프로젝트, APK, env, keystore, Gradle credential 설정은 캐시 입력이나 추가 캐시 경로로 만들지 않는다.

캐시 hit/miss에 관계없이 clean prebuild/실제 APK build와 세 consumer를 모두 실행한다. ABI/SDK/앱 코드/권한/서명 경계와 output 이름은 그대로다. task build cache와 configuration cache는 아직 활성화하지 않았다. 공개 package alias도 유지한다.

Mobile CI는 동일 architecture-foundation verifier를 다시 호출하던 `mobile:lint` 한 번만 제거한다. Store Readiness는 앞의 `mobile:config`가 이미 실제 workspace를 검증한 뒤 실행하던, 미사용 root Expo config 호출만 제거한다. workspace config/웹 build/직접 client 및 store 검사는 유지한다.

직접 topology guard는 캐시 입력 범위, 단일 캐시 소유자, 전체 APK/consumer 유지와 alias 동일성·남은 config/build를 검증한다. topology/69개 책임/overlap/세 YAML/diff 검사는 PASS다. 실제 cold/warm cache restore/save 및 APK 시간은 원격 결과를 기록하기 전 **IMPLEMENTED_UNVERIFIED**다.

PR 캐시는 PR merge ref에 격리된다. 첫 PR 실행의 cold 결과를 기록하는 후속 문서 커밋으로 같은 PR의 warm 결과를 비교한다. 두 후보의 SHA 차이를 명시하고 build code/lock/tool/cache key 입력이 동일한지 확인한다. branch manual을 PR warm으로 오인하거나 같은 run의 immutable artifact를 덮어쓰지 않는다. cache hit를 컴파일 속도 개선으로 취급하지 않는다. B2는 실측 뒤 결정하고 C는 계속 HOLD다.

### B1 cold APK 및 입력 검증

후보 `47ba067f8182e5196c6c23b48c003fe5c12ec31d`, Android `37171079374` attempt1 / pull_request의 APK job은 SUCCESS다. `gradle cache is not found`에서 시작해 Gradle compile 1106초(실제 build step 1107초), 374 tasks executed / FROM-CACHE 0, Java setup 1초 / post-save 16초 / 전체 APK job 1202초다. 캐시 ID8470598074는 `refs/pull/1081/merge`에 저장됐으며 압축 크기 1,584,830,971 bytes다.

실제 key는 `setup-java-Linux-x64-gradle-68b1efdef66eb3347b92a98f57948d3d3f9812495452e78b7c9b9d7ef9277f97`다. 실제 LF Git blob 16개와 Actions의 파일 digest 집계 방식으로 동일 key를 재현했다. JDK17→18, SDK36→37, NDK 변경 및 lock/app config/local Android build/vendor source의 메모리상 변경 8개가 각자 key를 바꾸는 것도 확인했다. 작업 파일이나 고정 도구 버전을 변경한 실험이 아니다. 이는 입력 fingerprint 증거이며 변경 버전의 native runtime 검증이라고 주장하지 않는다.

같은 후보 iOS `37171079239`는 SUCCESS다. PID68626 유지 / root URL 한 번 / 두 번째 관찰에서 Home / 기존 Analyze/My/crash scan PASS. 첫 frame은 Camera ready Modal, 두 번째 frame은 Home이었다. 이 표본에서는 지연 전환을 관측했으며 이전 실패의 원인 확정과는 구분한다. iOS 입력과 캐시 구성은 변경하지 않았으므로 iOS 시간 차이를 B1 효과로 쓰지 않는다.

기존 cache usage는 35개 / 10,571,502,765 bytes, 새 Gradle 저장 직후는 36개 / 12,156,333,736 bytes다. [실제 설정 한도 조회](https://docs.github.com/en/rest/actions/cache#get-github-actions-cache-storage-limit-for-a-repository)는 HTTP402 및 결제 수단 확인 메시지로 실패했다. 설정된 한도·과금·향후 eviction을 추정하지 않는다. quota/결제/보관 정책 변경이나 기존 cache 삭제는 수행하지 않았다. warm에서 실제 복원과 보관 여부도 확인한다.

Android 네 job은 모두 SUCCESS이며 각 현재 SHA의 고유 nonempty/unexpired 산출물을 확인했다. Smoke의 별도 process cold launch 10회와 기존 기능 검사도 PASS다. Android 네 job의 실제 runner 누적 시간은 2271초이며 배정 대기 시간과 구분한다. 같은 후보의 전체 PR 검사도 SUCCESS다.

다음 warm 비교는 이 cold 결과만 기록하는 문서 커밋으로 같은 PR에서 수행한다. APK/앱/lock/도구/native patch/캐시 key 입력 16개는 변경하지 않는다. warm 측정 전 B1 전체는 IMPLEMENTED_UNVERIFIED다. 과거 compile 표본 792–1151초의 편차도 있으므로 cold 1106초를 회귀나 절감으로 단정하지 않는다.

### B1 warm 완료 및 실측 범위

warm 후보 `1ea015ca14622ed4da60838d8b93b2bdb5f9a702`는 두 기록 문서만 변경했다. 실제 key 입력 16개를 Git diff로 비교해 동일함을 확인했다. 같은 PR ref에서 같은 key/캐시 ID8470598074를 복원했고 새 key 생성/복사나 branch cache 우회는 없다.

| 항목 | cold 47ba067f / run37171079374 | warm 1ea015ca / run37173034175 |
|---|---:|---:|
| Gradle dependency cache | miss / 새 저장 | 동일 key hit / 복원 SUCCESS |
| Java setup (복원 포함) | 1초 | 29초 |
| Gradle banner / 실제 build step | 1106 / 1107초 | 698 / 699초 |
| APK job | 1202초 | 818초 |
| post-save | 16초 | hit이므로 저장 없음, 0초 |
| executed / FROM-CACHE tasks | 374 / 0 | 374 / 0 |
| Android 네 job runner 누적 | 2271초 | 1893초 |
| 네 job / 10회 cold launch / 네 고유 artifact | SUCCESS / PASS / 확인 | SUCCESS / PASS / 확인 |

warm의 iOS `37173034078`도 SUCCESS이며 전체 PR 검사 SUCCESS다. **이 기준 B1은 VERIFIED**다. 이 한 쌍의 표본에서 compile 408초, APK job 384초, Android runner 누적 378초 감소를 관측했다. 캐시 복원 비용은 포함했다. runner 배정/host 부하와 iOS 실행 편차를 통제한 반복 실험은 아니므로 보장된 절감률이나 전체 repository/사용자 대기 시간 절감으로 일반화하지 않는다. task output reuse는 0이며 캐시 hit를 그 증거로 쓰지 않는다.

## Stage B2 — debug task output cache 검증

B1 warm에서도 실제 compiler 작업 374개가 다시 실행되고 compile 698초가 남았다. 승인 설계에 따라 canonical debug build에만 `--build-cache`를 전달하는 최소 변경을 적용한다. root/workspace 공개 alias는 그대로 유지하며 실제 임시 npm workspace에서 `npm run mobile:build:android:debug -- -- --build-cache`가 `:app:assembleDebug --no-daemon --build-cache`를 전달하는 것을 확인했다. generated project/사용자 Gradle 설정이나 configuration cache는 추가하지 않는다. release/signing 두 owner에는 캐시/인자 변경이 없다.

고정 RN0.86.3은 debug variant에 JS bundle task를 생성하지 않으며 실제 Smoke/20A/20B는 각 현재 checkout의 Metro를 새로 시작한다. 이 경로의 JS를 Gradle output cache나 이전 APK에서 가져오지 않는다. source 소비와 모든 실제 화면 검사는 계속 실행한다. 고정 AGP8.12.0의 [공식 source artifact](https://dl.google.com/dl/android/maven2/com/android/tools/build/gradle/8.12.0/gradle-8.12.0-sources.jar)의 ExternalNativeBuildTask는 DisableCachingByDefault다. 네 ABI의 CMake가 제거된다고 주장하지 않으며 managed compiler task의 실제 FROM-CACHE/시간/캐시 크기를 별도로 판정한다.

workflow 자체가 key 입력이므로 B2는 별도 새 key의 cold/warm으로 측정한다. 입력 mutation의 key 변경과 캐시 miss의 현재 source build, warm의 실제 native/UI/고유 artifact 유지가 필요하다. 현재는 **IMPLEMENTED_UNVERIFIED**이며 C는 계속 HOLD다. APK/signing/env 캐시와 동일 Gradle home을 소유하는 두 번째 cache action은 추가하지 않았다.
