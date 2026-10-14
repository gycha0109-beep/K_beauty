# BEJEWELY 공급망 취약점 B안 — 자체 패치 배포본 구현 로드맵

> 작성일: 2026-10-13 KST · Track: security · Watchtower-Track: security
>
> **2026-10-14 현황: B1/B2 소스·회귀 PASS, B3 패치 파일·브라우저 dist·독립 재현성 PASS, B4 임시 전체 설치 그래프·빌드 PASS / 공식 감사 FAIL, B5 Android 컴파일 PASS·실기기/API/Auth NOT_RUN, B6 패키지 배포 준비·승인 거부 테스트 PASS / 외부 승인 HOLD, B7 병합·운영 배포 금지.** 실제 product package-lock/manifest는 변경되지 않았고 필수 Supply Chain 감사 FAIL을 유지한다. 아래 2026-10-14 실행 보정이 현재 기준이며 역사적 B0~B7 설명은 원문대로 보존한다.
>
> [전체 SCA-0~7 로드맵](sec-sca-20261012-remediation-roadmap.md) · [상세 기술 설계](sec-sca-20261012-remediation-technical-design.md) · [업스트림 패치 검토](sec-sca-20261012-upstream-patch-candidate-review.md) · [실행 Ledger](sec-sca-20261012-execution-ledger.md) · [보안 이슈 #1208](https://github.com/gycha0109-beep/K_beauty/issues/1208) · [진단 PR #1240](https://github.com/gycha0109-beep/K_beauty/pull/1240)

## 2026-10-14 실행 보정 — 파이프라인 신뢰도 → 기존 앱 정식 빌드 연결

**방향:** 검증용 별도 APK·별도 배포 수단을 추가하지 않는다. 먼저 승인된 의존성 패키지를 실제 제품 그래프에 연결하고, *기존* Android 빌드 파이프라인에서 생성한 동일 소스/그래프의 앱을 검증한다. 원본 의존성으로 생성했던 [Draft #1297](https://github.com/gycha0109-beep/K_beauty/pull/1297)은 범위 오류로 병합 없이 종료했으며 SCA/B5 증거가 아니다.

**현재 권위 있는 근거 (각기 다른 의미):**

| 증거 | 확인 내용 | 인정하지 않는 것 |
| --- | --- | --- |
| [B3/B4 Draft #1288](https://github.com/gycha0109-beep/K_beauty/pull/1288), [CI #38514455251](https://github.com/gycha0109-beep/K_beauty/actions/runs/38514455251), exact head `c8153c359c545141c9176254feb638f3844ba5f1` | 원본 소스/파일 해시, 패치 2종의 격리 installed graph, 두 install lifecycle, browser dist/RSA, Android debug Gradle 빌드 검증. 독립 브라우저 dist 재현성 PASS | 실제 배포된 patched package, 기기 E2E, 보안 감사 PASS, product lock 반영 |
| [B6 Draft #1299](https://github.com/gycha0109-beep/K_beauty/pull/1299), [CI #38523027022](https://github.com/gycha0109-beep/K_beauty/actions/runs/38523027022), checked head `477aad86fe5e317e239e2cb99fdb6b5be21c3013` | 패키지 후보 구조, 네 역할 서명 정책, 라이선스·SBOM·원본 검증, 독립 clean-runner digest, CodeQL, CI overlap PASS | 실체가 있는 서명자/배포소, 진짜 private readback, 동일 HEAD 후속 커밋의 검증 |
| canonical raw npm audit, 위 두 CI | full HIGH 22 / MODERATE 13 / CRITICAL 0, production HIGH 19 / MODERATE 11 / CRITICAL 0. HIGH가 전파된 여러 npm 패키지 수는 독립 GHSA 건수가 아니며 주요 원인은 `braces`·`node-forge` | 예외 갱신·패키지 이름 바꿈·임의 감사 PASS 처리 |

**불변식:** 정확 HEAD가 달라지면 최신 HEAD CI를 다시 확인한다. 패치 기술 테스트 PASS와 조직 배포 승인, 원시 npm audit PASS를 **별개**로 유지한다. 필수 감사 정책을 삭제하거나 예외를 연장하지 않는다. 검증용 진단 아티팩트의 PASS는 절대로 릴리스 권한이 아니다.

### 실행 순서 P0 → P5

| 우선순위 | 상태 | 구현 단위 | 확인/승인 게이트 | 다음 조치 |
| --- | --- | --- | --- | --- |
| **P0: 진단·승인 구분** | **PASS / CI #38525576549** | `scripts/security/sca-readiness-evidence.mjs`, negative tests, `run-sca-readiness-evidence.mjs`; 현행 B6 워크플로의 필수 audit 실패는 유지하고 `always()`에서 정확 HEAD의 원시 full/production JSON·GHSA 원인·HOLD를 진단 아티팩트로 별도 보존 | 타 HEAD, 감사 응답 오류, 빈 응답, 불일치 카운트/exit, 거짓 release PASS가 fail-closed. **절대** 독립 B6/공식 감사 PASS를 대체하지 않음 | [#1302](https://github.com/gycha0109-beep/K_beauty/pull/1302): 21 tests, CodeQL, independent build, diagnostic artifact PASS; mandatory audit stays FAIL |
| **P1: 해결 루트 분류** | **기술 검증 PASS — 공식 HIGH 해결 HOLD** | [P1 원인·경로 판정 Ledger](sec-sca-20261014-p1-root-cause-disposition.md), `sca-audit-root-causes.mjs` fixed-point 순환 그래프, 고유 HIGH GHSA 2건, 전체 HIGH 노드 22개/production 19개, GHSA 출처·버전 검토, 새로운/변경된 HIGH 자동 REVIEW_REQUIRED | [P1 검증 CI #38526983634](https://github.com/gycha0109-beep/K_beauty/actions/runs/38526983634) @ `d2ba7b30e0aac8c1476f089ad9bb9f22950104ec`: negative tests 25/25 PASS, CodeQL PASS, independent candidate digest `ec607c669b4242ee163b9b23d67c323750646efe4989f324ed544dd4c1eb4deb` PASS, 원시 감사 아티팩트 PASS, **기존 필수 감사 FAIL**; release HOLD | P2 레지스트리/책임자/서명 승인 전에는 실제 패키지 배포·제품 lock 교체 금지 |
| **P2: 승인된 패치 배포** | **외부 승인 HOLD** | [#1299](https://github.com/gycha0109-beep/K_beauty/pull/1299) 기존 4역할 서명, NOTICE/LICENSE/SBOM, 승인된 immutable private npm registry, readback, 관리자·보안·라이선스 책임 배정 | 조직 승인된 key/fingerprint, forge 라이선스 선택, 업로드/조회 scoped token, 권한 없는 조회 차단 증거가 모두 필요. 승인 없이 `--execute-approved-upload` 금지 | 조직 인프라/권한 담당자 결정 후에만 실제 저장소 읽기·쓰기 |
| **P3: canonical product graph** | **NOT_RUN / P2 종속** | 기존 `stage-approved-sca-product-graph.mjs`로 임시 그래프·lock diff·중첩 실물 해시·consumer 경로 확인. 승인된 후보만 실제 PR package-lock에 승격 | 무관한 drift 0, 두 npm-ci 모드+재현성 PASS, raw audit 및 기존 필수 gate 통과 전 main/배포/병합 HOLD | P2 완료 후 전체 의존성 후보 스테이징 |
| **P4: 동일 앱 Android 실기기** | **NOT_RUN / P3 종속** | `mobile-android-runtime.yml`의 기존 Gradle/Expo 경로로 동일 소스+승인된 patched product graph를 빌드; 로그인/카메라/설문/격리 analyze API/결과/프리미엄 경계 회귀 | exact SHA, lock SHA, 설치본 fingerprint, APK SHA, 같은 빌드 구성과 비운영 테스트 환경/기기 기록. apk만 동작하면 B4 승인으로 치지 않음 | 정상 빌드 산출물 1개로 디바이스 검증 |
| **P5: 운영·감시·복귀** | **HOLD** | 상위 패키지 업스트림 관측, 영향 범위 drift/키 회전, 보수 책임자 및 복구 절차, 권한·롤백 검토 | 원래 취약 패키지로 무조건 자동 롤백 금지; 독립 보안 리뷰+정식 배포 승인 | 운영 소유권 확정 후 결정 |

### 실행 중단 조건 (자동 절차가 넘어가면 안 되는 선)

1. **현재 가능:** P0 코드/CI 보수 및 P1 고유 advisory 영향 분석·공식 출처 확인, B3/B4/B6 재현 검증. 정상 앱/프로덕션 데이터에는 접근하지 않는다.
2. **승인 없으면 중단:** P2 비공개 패키지 업로드, P3 조직 레지스트리 사용·lockfile 승격, P4 실제 backend/Auth 기기 테스트, P5 main/운영 배포. 테스트 서명 키를 조직 승인으로 대체하지 않는다.
3. **영구 HOLD:** 공식 audit HIGH/CRITICAL, 만료된 취약점 예외, 설치 파일 출처 불명, registry 익명 읽기 가능, 실제 코드 검증 없는 이름·버전 바꿈, unsigned/일방 승인, 실제 기기·API 테스트 없이 B5 완결 주장.
4. **CI 판정:** 후보 digest 재현성·CodeQL·negative test PASS라 해도 raw audit FAIL이면 **워크플로 전체 FAIL이 정상**이다. 보류 이유와 검사 근거를 읽기 쉬운 별도 결과로 기록하되 실패 신호는 보존한다.

이 실행 보정은 기존 B0~B7의 필수 검증을 축소하지 않고, 그중 **P0 진단/상태 전달**을 먼저 구현한 후 **P1 공식 수정 경로 → P2 실제 조직 승인 → P3 실제 앱 lock → P4 정상 APK → P5 운영** 순서로 순차 추진한다.

## 0. 목표 및 불변식

**목표:** Expo SDK 57 / React Native 0.86.3 및 현행 비주얼리 기능을 유지하면서, braces 3.0.3과 node-forge 1.4.0의 취약한 소스 코드를 직접 보수하고, 소스·라이선스·패키지 무결성이 입증된 자체 배포본 2개로 **모든 설치 경로**를 교체한다.

**종료 정의 (모두 충족):** 두 Advisory 원인 코드가 실제 수정됨 + 정상 기능 보존 + root/nested 설치·번들·Android 산출물에 취약 코드 잔존 없음 + 출처 및 패키징 재현 가능 + 전체/production raw npm audit HIGH=0/CRITICAL=0, MODERATE 각각 13 이하 + Expo/Metro/Android APK 및 기기 회귀 PASS + 정확 HEAD CI와 보안 리뷰 PASS.

**중요:** npm audit는 registry의 패키지명·버전 중심으로 알려진 취약점을 계산한다. 자체 scope/alias/포크로 이름이 달라지면 **실제 취약 코드가 남아 있어도** 원본 GHSA가 빠져 HIGH 0으로 보일 수 있다. 따라서 audit PASS만으로 완료 선언 금지. 실제 설치 파일이 검토된 패치와 일치하고 두 취약 동작을 차단하는지 독립적으로 시험해야 한다. 반대로 원래 취약 버전으로 여전히 감사에 노출된다면 audit 실패를 예외·무시로 지우지 말고 HOLD한다.

**금지 범위:** .env/secret, 운영/Production, DB·migration·RLS, Auth/Storage/Payment/Provider, API 응답/저장 계약, Face Lab·추천 엔진, 기능 PR #1232/#1233 변경. 취약 코드 원형 유지 + 패키지명/버전만 변경, registry 사칭, 수작업 lockfile 값 교체, 무승인 overrides, 감사 예외 연장, audit/codeql skip 또는 continue-on-error, npm audit fix --force, 미검증 운영 배포 모두 금지.

## 1. 기준선 및 확인 사실 — 2026-10-13

| 항목 | 검증된 현 상태 |
| --- | --- |
| 저장소 | gycha0109-beep/K_beauty; 조회 당시 main b017fd90e9cf9d624e499f787f06949ad5613d9d, 진단 PR #1240 HEAD d273f6bfc5177ac1c8fd970c0f7babd8133f3296 (Draft). 구현 시작 시 반드시 재조회 |
| 앱 | 기존 Expo 57.0.21 / CLI 57.0.23, React Native 0.86.3 |
| braces | 3.0.3, GHSA-vfj7-8cjw-p6xm; [micromatch/braces PR #72](https://github.com/micromatch/braces/pull/72), 수정 SHA 28d440b5dd449dbf1fe6f3506cf94ecca4d02660, closed/unmerged |
| node-forge | 1.4.0, GHSA-86w9-cpqp-85rv; [digitalbazaar/forge PR #1152](https://github.com/digitalbazaar/forge/pull/1152), 수정 SHA ceba34402e329f0365134f23fe19898756527d65, open/unmerged |
| 기존 보안 감사 | production HIGH 19 / CRITICAL 0 / MODERATE 11; full HIGH 22 / CRITICAL 0 / MODERATE 13. braces 예외 2026-10-10 만료, canonical gate FAIL |
| 공식 Expo 57 patch 후보 | 실제 격리 npm lock 실험 [CI #38341377026](https://github.com/gycha0109-beep/K_beauty/actions/runs/38341377026): 최신 Expo/CLI가 중첩 설치되고 취약 라이브러리는 모두 잔존, HIGH 19/22 그대로 → REJECT |
| 사전 패치 검증 | 두 upstream PR의 코드 변경을 **임시 복사본에만** 적용: braces glob/AST/파일 감시 이벤트, forge RSA ASN.1·Expo 코드서명 smoke 일부 PASS. 공식 릴리스·패키징·실제 후보 lock/APK는 미검증 |
| Android | 원본 잠금 환경의 Expo prebuild / native shell PASS. Gradle assembleDebug 420초 타임아웃; APK·실기기 검증 NOT_ATTESTED |

여기 기록된 SHA·버전·CI는 **스냅샷**이며, 지속적인 최신 상태나 수정 패키지 승인 근거가 아니다. 실제 진행 시 main / PR / advisory / npm registry / lockfile과 CI를 새로 고정한다.

## 2. 구현 저장소/배포 구조

| 역할 | 예상 대상 | 상태 및 변경 조건 |
| --- | --- | --- |
| 패치 소스 | security/vendor/braces/ · security/vendor/node-forge/ | **신규 구현 후보 경로**. 원본 소스 SHA + diff + license/NOTICE + patch manifest 필요 |
| 보안 검증 스크립트 | scripts/security/ | 기존 patch isolation, consumer integration, watcher/Expo signing fixtures 재사용·확장 |
| 증거 | docs/security/ 및 임시 CI artifacts | source→patch→tarball→lock→install→앱 산출물 digest 연결 |
| 실제 의존성 변경 | 루트 package.json / package-lock.json, 필요 시 apps/mobile/package.json | **별도 Security remediation 실험 브랜치**에서만 수행. 기능 브랜치/진단 PR의 패키지 변경 금지 |
| 감사 정책 | scripts/verify-supply-chain-audit.mjs 및 기존 .github/workflows/supply-chain-security.yml | **취약점 2개가 모두 실제 해결된 이후**에만 임시 예외 제거+fail-closed 정책 v2로 원자적 변경 |
| 배포본 출처 | 최초 격리 tarball → 승인 뒤 통제된 git SHA·사내 registry·file: 중 1개 선택 | 외부 게시/credential/공개 배포는 별도 명시적 승인 |

npm 공식 문서상 루트 package.json overrides는 다른 패키지·포크·file:·고정 Git 소스로 교체할 수 있으나, 직접 의존성에서 EOVERRIDE 제한이 있다. 이는 **후보 설치 연결 방식 중 하나이지 자동 허용된 우회책이 아니다.** 모든 root/nested 소비자가 실제 수정 설치본을 참조하는지 검증한다. 참고: [npm package.json overrides](https://docs.npmjs.com/files/package.json/) / [npm audit](https://docs.npmjs.com/cli/audit.html/).

## 3. B0~B7 구현 단계 및 통과 게이트

### B0 — 현재 입력·소유권 동결 (SCA-2/3 준비)

**작업**
1. 최신 main / 진단 PR / 관련 기능 PR, clean checkout, advisory 및 upstream 상태 조회. Node/npm/lock v3와 Expo 버전 기록.
2. npm ls / npm explain / package-lock 전체 packages 경로로 braces 및 forge 모든 root/nested 복사본, 직접·전이 소비자, 실제 입력 소유자·빌드/런타임 경계 작성. 파일 감시 경로 이름과 glob pattern의 공격 입력을 구분.
3. raw npm audit --json, npm audit --omit=dev --json 및 현재 audit exception/변형 검사 근거 저장.
4. 패키지 출처·라이선스 재배포·장기 유지보수 오너·보안 검토자·내부 artifact 저장 위치 결정. 비밀키 사용 없음.

**산출:** baseline 잠금 경로/소스 SHA/Advisory/감사/owner ledger. **PASS:** 두 라이브러리 전체 설치·소비자 경로와 검증 주체가 식별됨. 불명확하면 **HOLD**.

### B1 — braces 재귀 방어 직접 패치 (SCA-2)

**작업**
1. 공식 braces 3.0.3 소스/배포본 해시를 고정하고 PR #72의 constants, parse, compile, expand, stringify 수정 diff를 리뷰해 최소 수정 반영.
2. parser의 brace·parenthesis 중첩 상한(기본 100 및 사용자 maxDepth 하향), AST 직접 전달 시 compile/expand/stringify 깊이 검사, 순환 parent chain 거부를 검증.
3. 취약 패턴 테스트는 격리 자식 프로세스에서 timeout/입력 크기를 제한. 정상 glob/negation/배열/extglob/중첩 정상 입력과 malformed AST를 함께 시험.
4. micromatch 4.0.8, fast-glob, chokidar(ready/add/change/unlink), Expo/Metro file-map 세 경로, upstream 전체 unit suite, Node 22에서 회귀 테스트.

**산출:** 원본 source SHA, patch diff hash, unit/negative/consumer suite 결과. **PASS:** 공격 경계 거부 + 정상 결과 유지 + 검토 가능 출처. 누락·회귀 시 **B1 FAIL/HOLD**.

### B2 — node-forge 엄격한 RSA/ASN.1 검증 직접 패치 (SCA-2)

**작업**
1. 원본 forge 1.4.0과 PR #1152의 lib/rsa.js 및 테스트 diff를 정확 SHA로 검토.
2. PKCS#1 v1.5 DigestInfo의 외부 구조 및 **중첩 DigestAlgorithm ASN.1 child count/OID/허용 parameter 구조** 검증 보강.
3. 임시 RSA 키만 메모리에서 생성해 정상 서명 수락/다른 메시지 거부/추가 ASN.1 child 거부/잘못된 키·만료 인증서 거부를 검증. 운영 signing private key 사용 금지.
4. @expo/code-signing-certificates와 Expo CLI의 self-signed 인증서 생성, PEM 왕복, manifest 서명 및 정상·비정상 검증, upstream 전체 suite 실행.

**산출:** 소스·패치 해시, 정상/비정상 RSA fixture, Expo consumer suite. **PASS:** 취약 구조 거부와 정상 서명·Expo 기능 호환성. 실패 시 **B2 FAIL/HOLD**.

### B3 — 검증 가능한 패키지 두 개 제작 (첫 중요 승인 게이트)

**작업**
1. 공식 원본 tarball SHA-512 및 tag, 각 patch hunk SHA, 라이선스/NOTICE, 제3자 소스, 변경 file list를 manifest로 고정.
2. 격리 빌드에서 패치 소스로 npm pack 실행, pack 파일 목록/실행 스크립트/credential·.env 혼입 검사. 두 번째 clean 빌드로 재현성 확인. 압축 metadata 차이로 tarball digest가 달라지면 파일별 정규화된 content hash와 압축 차이를 구분하고 별도 승인 전 배포 보류.
3. 설치 아티팩트 SHA-256/512, producer, source-to-tarball mapping, 통제된 다운로드·보관 방법, 오너 및 업스트림 패치 drift 감시 정책 기록.
4. 최초에는 OS 임시 파일과 CI artifact로만 검증. npm 공개 registry 발행·외부 권한·credential 준비는 하지 않음.

**산출:** 검토 가능한 braces/forge **각 1개 이상** 수정 tarball + 재현 빌드/출처·라이선스·hash 증거. **PASS:** 두 개 모두 provenance 및 보안 검토 완료. 불명확한 출처/무단 게시가 필요하면 **B3 HOLD**.

### B4 — 임시 lockfile 실제 교체와 이중 보안 감사 (SCA-3)

**작업**
1. 별도 보안 실험 브랜치·worktree에서만 **승인된** file: tarball, exact Git SHA 또는 통제된 registry와 필요 시 검증된 root overrides 중 방식 선택.
2. npm resolver로만 package-lock 재생성. npm ci --ignore-scripts --no-audit --no-fund, 필요 lifecycle 포함 재설치를 단계별 분리해 검증; npm override EOVERRIDE/peer dependency/Expo 호환성을 검사.
3. npm ls braces node-forge --all, npm explain, lock의 모든 node_modules/nested/alias 경로, 실제 설치된 원본 패키지·vendored copy·bundleDependencies를 확인.
4. **실물 설치 파일**의 AST 깊이 검사와 RSA ASN.1 reject 코드가 B1/B2 검토된 바이트와 일치하는지 해시 및 회귀 테스트.
5. 후보 lock의 raw npm audit --json 및 npm audit --omit=dev --json을 **둘 다 그대로** 실행하고 전체 HIGH/CRITICAL 0, 기존 moderate 기준 비악화, advisory leaf 여부를 기록.
6. 이름만 바꾼 패키지는 registry scanner에서 안 잡힐 수 있으므로 SBOM/원본 코드 fingerprint/installed hash/두 CVE 재현 부정 테스트를 **감사와 별도 AND 게이트**로 강제.

**산출:** before/after lock SHA, 후보 설치본 fingerprint, provenance, npm ls/path tree, full+production raw audit. **PASS:** 두 취약 구현 미잔존 + 전체 경로 패치 bytes 일치 + raw audit HIGH 0/CRITICAL 0. 하나라도 미충족 시 **B4 FAIL/HOLD**, B5/B6로 승격 금지.

### B5 — Expo/Android 실제 실행 및 소비자 회귀 (SCA-3)

**작업**
1. B4의 **패치 적용된 실제 후보 설치본**으로 mobile:typecheck, verify:mobile-foundation, mobile:config, mobile:export:android 및 source map 출처, patched Metro/chokidar 이벤트/코드서명 테스트.
2. 깨끗한 격리 디렉터리에서 mobile:prebuild:android 및 verify:mobile-native. Expo의 apps/mobile/package.json 임시 변경은 byte-exact 복구하고 Git tracked diff 0 확인.
3. Gradle은 기존 420초 timeout을 기계적으로 반복하지 않는다. 캐시/JDK/Android SDK와 실행 한도 마련 후 별도 **opt-in** 1회로 assembleDebug 시도, 종료 코드 및 APK SHA-256 기록.
4. APK 에뮬레이터/실기기 설치: 앱 진입·라우팅, 카메라 권한/촬영, 분석 API 실패 처리, 핵심 결과·Premium 섹터 확인. 실제 운영 API/데이터는 사용하지 않으며 격리 백엔드가 필요하면 별도 승인.
5. JS source map에서 패키지 이름이 안 보이는 사실은 APK/native 전체 취약 코드 부재가 아님. 실제 빌드 산출물 및 의존 manifest를 별도로 검사.

**산출:** 정확 후보 SHA, 모바일 명령/로그, APK checksum, 기기 smoke, 서명/watcher 검증. **PASS:** 패치된 후보로 Android 앱 동작까지 확인. APK/기기가 없으면 **NOT_ATTESTED/HOLD**.

### B6 — 정식 remediation PR·감사 정책 v2·정확 HEAD CI (SCA-4/5/6)

**작업**
1. B0~B5를 충족한 source/patch/tarball/lock만 **별도의 Security remediation PR**로 변경한다. 기존 #1240은 보안 진단 PR로 계속 Draft; 이 문서만으로 원본 패키지 변경/병합하지 않음.
2. 두 취약 원인 제거가 입증된 때에만 scripts/verify-supply-chain-audit.mjs의 만료 exception을 **제거**하고 raw full+production HIGH/CRITICAL=0 검사로 변경. 기존 policy-integrity guard 9건과 함께 새 v2 변형 테스트로 **원자적 교체**.
3. 원본 취약 코드/패치 hash 변경/중첩 경로 누락, 새로운 HIGH, CI skip, continue-on-error, baseline 상승, scanner 사각지대 후보 주입은 모두 FAIL하는 테스트 추가.
4. 정확 PR HEAD에서 Supply Chain(Package Integrity+CodeQL), Main Health, Security Boundary, 모바일 typecheck/foundation/native/Android, diff hygiene 및 보안 reviewer 승인 수집.

**산출:** 별도 remediation PR/원시 감사 + v2 mutation 검사 + CI run matrix. **PASS:** 전원 독립 PASS와 승인. 하나라도 누락/FAIL이면 **Draft/HOLD**.

### B7 — 승인 병합·유지보수/복귀 전략 (SCA-7)

**작업**
1. 명시적인 병합 승인 후 정확 HEAD→main 반영을 재확인하고 #1208 증거 closeout. #1232·#1233은 각 트랙에서 최신 main sync 및 소유 CI 재실행 후 별도 병합 판단.
2. 포크 유지보수 오너, 공식 upstream patch 신규 릴리스 감시, patch drift 검증, 반기/업데이트 주기, 보안 대응·패키지 폐기 정책을 지정.
3. 실패 시 **실험 브랜치는 마지막 승인된 lock/source/artifact 상태로 되돌림**. 운영에서 이미 수정본 사용 시 취약 원본 버전으로 자동 rollback은 금지(배포 보류/사고 대응으로 처리).

**산출:** 병합 SHA, maintainer, release/evidence 기록 및 rollback/runbook. **PASS:** 새 main의 모든 보안 조건 유지 + 유지보수 책임 확정.

## 4. 우선순위, 다음 작업, 완료 기준

| 순서 | 구체적 우선 작업 | 합격 조건 |
| --- | --- | --- |
| 1 · B0 | advisory/upstream 및 모든 소비자 경로 최신 재조사 | root/nested 원인 패키지 경로 인벤토리 완성 |
| 2 · B1 | braces PR #72 source-pin·patch 포팅·안전한 depth/AST/glob 테스트 | 공격 입력 거부, 정상 consumer suite PASS |
| 3 · B2 | forge PR #1152 source-pin·ASN.1 검사·Expo RSA 서명 | 비정상 서명 거부, 정상 Expo 사용 PASS |
| 4 · B3 | 패치된 tarball 2종/라이선스/해시/재현 빌드 | 두 패키지 출처·재현·review PASS |
| 5 · B4 | **실제 두 패키지 동시 교체** + 원시 full/prod audit | 잔여 취약 코드 없음, HIGH 0/CRITICAL 0 |
| 6 · B5 | Expo/Metro/Native/Gradle/APK·기기 smoke | 실제 patched Android PASS |
| 7 · B6 | 취약점 해결 PR + 무예외 감사 및 policy v2 | 정확 HEAD CI + 보안 리뷰 PASS |
| 8 · B7 | 승인된 main 병합·#1208 종료·유지보수 | 병합 재확인 후 closeout |

**현재 진척 (2026-10-13):** B0 원본 경로·암호화 원본 tarball 검증 일부 확보. [B1 PR #1270](https://github.com/gycha0109-beep/K_beauty/pull/1270)에서 braces 3.0.3 원본 npm SHA512, upstream SHA 고정된 5개 수정 소스와 제한적 회귀 PASS ([실행기록](sec-sca-20261013-b0-b1-execution.md)); [B2 PR #1271](https://github.com/gycha0109-beep/K_beauty/pull/1271)에서 node-forge 1.4.0 원본 tarball·lib/rsa.js upstream blob·RSA/Expo 격리 검증 PASS ([실행기록](https://github.com/gycha0109-beep/K_beauty/blob/fix/security/sca-b2-private-forge-candidate-20261013/docs/security/sec-sca-20261013-b2-execution.md)). 두 패키지의 full suite·라이선스/소유자 검증·포크 배포·전체 lock 교체·무예외 audit·Android APK는 **미완료**, B3~B7 HOLD. B2 npm 원본 tarball에는 아직 재빌드하지 않은 browser dist 6개 파일이 포함된다.

## 5. 실패/금지 시나리오와 롤백

| 상황 | 즉시 조치 |
| --- | --- |
| braces 재귀/AST guard 결함 또는 glob·watcher 회귀 | B1 FAIL, 패치 수정 후 fixture 재실행 |
| forge 비정상 서명 수용 또는 정상 Expo 서명 실패 | B2 FAIL, forge 보수 재검토 |
| license/원본 해시/패키지 재현/아티팩트 오너 미확인 | B3 HOLD, 발행/설치 승인 보류 |
| 실제 root/nested 경로 한 곳이라도 취약 원본 남음 | B4 FAIL, 후보 lock 폐기·해결책 재선택 |
| 이름 변경으로 audit만 HIGH0이고 원본 취약 코드 잔존 | **B4 FAIL — scanner blind spot**, 취약점 해결 선언 금지 |
| raw npm audit HIGH/CRITICAL 잔존 | **B4/B6 HOLD** (예외 갱신/CI 우회 금지) |
| Gradle 420초 같은 시간제한 발생 | B5 NOT_ATTESTED, 캐시/환경 보강 후 별도 재실행 |
| APK/기기 오류 | B5 FAIL, 격리 후보 rollback 및 미승인 배포 금지 |
| 원본 취약 버전으로 운영 rollback 요구 | 배포 HOLD/사고 대응 검토, 취약판 자동 복귀 금지 |
| upstream 공식 수정 공개 | 두 코드·출처·호환성 비교, 가능하면 자체 포크를 공식 릴리스로 교체 |

## 6. 단계별 증거 양식

각 단계의 실제 검증 결과는 [기존 실행 ledger](sec-sca-20261012-execution-ledger.md) 또는 별도 remediation PR에 남기며 아래 필드가 없으면 UNKNOWN/NOT_RUN으로 표기한다.

| 필드 | 기록값 |
| --- | --- |
| stage / owner / approval | B0~B7, 작업/보안 리뷰 오너, 승인·미승인 |
| main_sha / candidate_sha / PR | 실제 정확 Git SHA와 연결 링크 |
| originals | 두 패키지 원본 name/version/source SHA/tarball SHA |
| patch_provenance | 업스트림 PR/commit, patch diff SHA, license/NOTICE |
| artifacts | 두 수정 배포본 tarball SHA-256/512, 재현 빌드 입력·파일별 해시 |
| lock/install | 변경 전후 lock SHA, 모든 nested 경로, npm ci, installed code fingerprint |
| audit | production/full raw npm audit 원문·exit·HIGH/CRITICAL/MODERATE/Advisory leaves |
| consumer_compat | brace parse/AST/watcher, RSA/Expo code signing, native/Android/APK/device |
| acceptance | CI URL/SHA, patch security reviewer, decision PASS/FAIL/HOLD |
| rollback | 취약 구현 복귀 없는 격리 rollback 대상 및 사고 대응 |

**최종 종료 조건:** B1/B2 수정 동작 + B3 출처·재현성 + B4 양쪽 취약점·무예외 감사 해결 + B5 patched Android + B6 CI·review + B7 main/운영 책임을 **모두** 통과해야 #1208 종료. 문서·진단 PR의 개별 PASS로 대체 불가.

## 7. 2026-10-14 실물 B3 격리 검증 업데이트

- [B3 Draft PR #1288](https://github.com/gycha0109-beep/K_beauty/pull/1288)는 현재 main에서 출발해 B1/B2 검증된 17개 파일만 선별 수용했다. 이 과정에서 서로 독립적인 B1/B2 PR 전체를 병합하지 않았다.
- [실제 CI #38495602311](https://github.com/gycha0109-beep/K_beauty/actions/runs/38495602311): B3 독립 job **PASS**, 패치된 braces/node-forge 각 2회 `npm pack` 후 tarball SHA512/파일 SHA256 일치. 결과 tarball은 보안 검증용 임시 디렉터리에서만 존재하고 외부 registry/공개 artifact로 전송하지 않음.
- braces: 10개 파일, SHA256 `d4f1219db19bfeb4e1c3f0354f9269569393f1b8c9f8c0295b80346926d4fa70`; forge: 53개 파일, SHA256 `ed30cf67cfa87f097c9f6b9ceadd4187fa3efb9399fd166380fc5ea36f8915e5`, 미패치 dist 6개는 후보에서 제외하여 0개 확인.
- B1 904 passing / B2 829 passing, 4 pending / 0 failures. 단 실제 재배포 권리·소유자·보안 리뷰·브라우저 번들 의존 consumer를 아직 검증하지 않았으므로 **B3 정식 출시/승인 HOLD**, B4~B7 전부 HOLD. 원본 package-lock과 canonical npm audit는 취약한 원본을 그대로 가리키며 감사 FAIL을 유지.
- 첫 실증은 동일 npm-ci 원본을 사용한 두 임시 빌드 디렉터리였으나, 후속 [#38496534583](https://github.com/gycha0109-beep/K_beauty/actions/runs/38496534583)의 **서로 다른 러너 2개**에서 각각 새로운 `npm ci`를 수행하고 두 tarball SHA256을 교차 비교하여 **별도 clean-runner 재현성 PASS**를 확인했다. 원본 라이선스/오너 승인과 영구 비공개 배포본은 여전히 HOLD다.
- 정확한 source→tarball SHA 및 잔여 상태: [B3 증거 기록](sec-sca-20261014-b3-temp-package-evidence.md). 최종 승인 결론을 절대 PASS로 승격하지 않는다.

### B3 별도 clean npm-ci 러너 closeout

- PR #1288 `b02ec8f`: [Actions #38496534583](https://github.com/gycha0109-beep/K_beauty/actions/runs/38496534583) 독립 2개 runner job PASS. 두 독립 `npm ci`와 각 2회 `npm pack`, braces/forge 실제 tarball SHA256 완전 일치. 총 각 패키지 4회 임시 소스 빌드.
- 두 공인 GitHub-hosted 러너 모두 Node 22 / Ubuntu 24.04. 크로스-toolchain, 패치 코드 브라우저 소비자, 보안 오너/법적 재배포 승인과 비공개 artifact 유지 장소는 미검증.
- 이것은 **B3 재현 빌드 기술검증 PASS / B3 배포 및 유지보수 승인 HOLD**를 뜻하며 B4/B5/B6/B7 승인과 다르다.
