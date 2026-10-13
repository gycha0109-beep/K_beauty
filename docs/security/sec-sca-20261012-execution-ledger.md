# SEC-SCA 2026-10-12 — 실행·검증 Ledger

**진행 상태: SCA-0 DONE / SCA-1 IN PROGRESS / SCA-2 TRIAGE / SCA-3~7 NOT_STARTED (HOLD).**

Watchtower-Track: security. Owner: Security Track. [Issue #1208](https://github.com/gycha0109-beep/K_beauty/issues/1208), [Draft PR #1240](https://github.com/gycha0109-beep/K_beauty/pull/1240).

상위 기준: [전체 로드맵](sec-sca-20261012-remediation-roadmap.md), [기술 설계](sec-sca-20261012-remediation-technical-design.md), [기존 경로 추적](sec-sca-p1-advisory-lockfile-path-triage-20261010.md). 이 문서는 근거 출처를 정확한 저장소 관측, 현재 업스트림만 확인한 정보, 미확인의 세 종류로 구분한다.

## 1. SCA-0 기준선 — 확인 완료

| 대상 | 2026-10-12 재검증 | 판단 |
| --- | --- | --- |
| 최신 main (착수 시점) | e2f46e62b7de5e795295f6369524189eacb51ef8 | GitHub main SHA |
| root package-lock blob | 37dfa247a664593440667b35d9af96d604d7949b | v3, installed package entries 725 |
| 모바일 기반 | expo 57.0.21 / @expo/cli 57.0.23 / React Native 0.86.3 | lockfile 직접 확인 |
| High 원인 | braces 3.0.3 / node-forge 1.4.0 | 두 advisory 모두 수정 버전 없음 |
| @expo/code-signing-certificates | 0.0.6, node-forge ^1.3.3 | lockfile 직접 확인 |
| Metro 중복 | metro-file-map 0.84.5, metro-config 하위 0.84.6 | 각자 micromatch ^4.0.4 |
| dev 경로 | chokidar 3.6.0, fast-glob 3.3.3, tailwindcss 3.4.19 | braces 또는 micromatch로 전이 |
| 기존 경로 tracer | reachable 653, unresolved edge 0 | 기존 Security CI |
| raw production audit | low 0 / moderate 11 / high 19 / critical 0 / total 30 | [CI #38221760388](https://github.com/gycha0109-beep/K_beauty/actions/runs/38221760388) |
| raw all audit | low 0 / moderate 13 / high 22 / critical 0 / total 35 | 동일 CI |
| 당시 Security CI | npm ci PASS, guard 9/9 PASS, tracer PASS, CodeQL PASS, canonical audit FAIL | 기존 만료 예외에 의한 의도된 FAIL |
| 당시 Main Health | PASS | [CI #38221760372](https://github.com/gycha0109-beep/K_beauty/actions/runs/38221760372) |
| mobile/native/Android 별도 실행 | NOT_RUN | 통과 주장 금지 |

주요 Advisory: [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) (braces, 2026-10-10 UTC 예외 만료), [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv) (node-forge, 2026-10-16 UTC 예외 만료 예정). 공식 GitHub Advisory 2026-10-12 관찰 시 모두 High / patched versions None. Audit high 집계는 취약한 패키지와 연쇄 전파 수이지 독립 CVE 수가 아니다.

## 2. SCA-1 lockfile 경로 — 확인 완료

- Mobile → Expo → Expo CLI → @expo/metro-file-map 57.0.3 → micromatch 4.0.8 → braces 3.0.3.
- Mobile → Expo/Metro 구성 → metro-file-map 0.84.5 / metro-config 중첩 metro-file-map 0.84.6 → micromatch → braces.
- Root Tailwind 개발 도구 → chokidar / fast-glob / micromatch → braces.
- Mobile → Expo → Expo CLI → node-forge 1.4.0 (직접 전이).
- Mobile → Expo → Expo CLI → @expo/code-signing-certificates 0.0.6 → node-forge 1.4.0.

설치 그래프는 실제 악용 함수 호출, 공격자 통제 입력 전달, 모바일 번들 탑재의 증거가 아니다. 모두 독립적으로 확인한다.

## 3. SCA-1 upstream 실제 소스 관찰 — 설치 버전 대조 대기

| upstream source (현재 main) | 직접 확인한 함수/의존성 | 정확 잠금버전 동일성 |
| --- | --- | --- |
| [expo/code-signing-certificates src/main.ts](https://github.com/expo/code-signing-certificates/blob/main/src/main.ts) | node-forge 런타임 import; line 88 certificateFromPem; lines 205~235 certificate.verify; lines 258~268 signBufferRSASHA256AndVerify 중 certificate.publicKey.verify | UNKNOWN (프로젝트 lock 0.0.6의 실제 설치 소스와 대조 필요) |
| [expo/expo CLI codesigning.ts](https://github.com/expo/expo/blob/main/packages/%40expo/cli/src/utils/codesigning.ts) | code-signing-certificates 런타임 import; line 15 node-forge import는 type-only; lines 335~339 validateSelfSignedCertificate; lines 453~460 signBufferRSASHA256AndVerify | UNKNOWN (프로젝트 @expo/cli 57.0.23 소스와 대조 필요) |
| [expo/expo CLI package](https://github.com/expo/expo/blob/main/packages/%40expo/cli/package.json) | 현재 upstream 58.1.6도 node-forge ^1.4.0 직접 의존 | UNKNOWN for 57; 최신 Expo 업그레이드만으로 forge 제거 불가 |
| [expo/expo metro-file-map changelog](https://github.com/expo/expo/blob/main/packages/%40expo/metro-file-map/CHANGELOG.md) | 58.0.4에서 micromatch를 제거해 특정 braces 경로 제거 (#51093) | 다른 Metro 경로와 Tailwind dev 경로까지 해결한 것이 아님 |
| [forge #1149](https://github.com/digitalbazaar/forge/issues/1149) | 2026-10-12 OPEN, DigestAlgorithm 중첩 ASN.1 element-count 미검증 제보 | 실제 BEJEWELY 노출성 UNKNOWN |
| [braces PR #72](https://github.com/micromatch/braces/pull/72) | 2026-10-12 CLOSED, NOT_MERGED. 최대 nesting depth 및 AST walker 방어 제안 | 공식 패치 아님 |
| [braces issue #84](https://github.com/micromatch/braces/issues/84) | Maintainer는 현 advisory의 타당성에 이의를 제기, issue CLOSED | 현재 GHSA High 판정 유지. 임의 면제 불가 |

**중요 구분:** node-forge의 RSA verify 호출이 현재 upstream 코드에서 실제 확인됐지만, 이 사실만으로 특정 외부 공격자가 BEJEWELY 런타임에 조작 서명을 주입할 수 있다고 입증된 것은 아니다. 모든 노출 조건을 UNKNOWN으로 보존한다.

## 4. 이번 착수의 실제 구현

기존 Supply Chain workflow의 의존성 경로 tracing step에 다음의 읽기 전용 검사와 출력만 연결했다.

- scripts/security/supply-chain-call-site-scanner.mjs — 9개 설치 패키지 경로 내 JS/TS 소스를 한정 탐색. node-forge / micromatch / braces import, RSA verify, 명시적 braces AST API 문자열 패턴을 파일·행 번호로 기록.
- scripts/security/verify-supply-chain-call-site-scanner.mjs — 임시 synthetic fixture로 import/API 탐지, 테스트 파일 제외, missing package, 대형 파일 제한 검증.
- scripts/security/report-supply-chain-call-sites.mjs — SUPPLY_CHAIN_CALL_SITE_OBSERVATION / SUPPLY_CHAIN_CALL_SITE_SUMMARY JSON 로그 출력.
- .github/workflows/supply-chain-security.yml — 기존 step에 위 두 실행 명령만 추가; 새로운 workflow 없음.

스캐너는 패키지 당 최대 3,000개 소스, 파일당 256 KiB, 패키지 당 상세 출력 60개로 제한. 미설치 패키지 또는 scan truncation을 0 exposure로 판정하지 않는다. 이 스크립트는 advisory ignore/제거/CI pass를 위한 정책 검증기로 사용하지 않는다. 기존 원본 npm audit, High/Critical 0 baseline, 두 예외 날짜, policy mutation guard, CodeQL은 변경하지 않았다.

**새 HEAD CI 로그에서 스캐너 자체 PASS와 설치 코드 marker를 확인해야 SCA-1 call-site 관찰을 승격할 수 있다.** CI 미완료 시 이 부분은 NOT_VERIFIED.

## 5. SCA-1 실제 설치 코드 관찰 — CI 근거 확보

Security workflow [run #38223030217](https://github.com/gycha0109-beep/K_beauty/actions/runs/38223030217)의 **정확한 소스 SHA 2583ff489f559c7029f59d983a1b17e53c08550c**에서 다음을 확인했다. 이 run은 원본 보안 audit가 만료된 braces 예외 때문에 여전히 FAIL이며, **call-site scanner PASS는 전체 보안 PASS가 아니다**.

- SUPPLY_CHAIN_CALL_SITE_SCANNER_TEST=PASS cases=5, package count 9, absent 0, incomplete 0, mutation guard 9/9 PASS, npm ci PASS.
- @expo/cli: 402 JS/TS files scanned; build/src/run/ios/codeSigning/Security.js:42에 node-forge import 1건.
- @expo/code-signing-certificates: 2 files scanned; build/main.js:8 node-forge import, line 176 및 line 203 verify-method marker, line 200 signBufferRSASHA256AndVerify marker.
- @expo/metro-file-map: 41 files; build/watchers/common.js:18 micromatch import.
- metro-file-map: 43 files; src/watchers/common.js:14 micromatch import.
- metro-config 중첩 metro-file-map: 43 files; src/watchers/common.js:14 micromatch import.
- micromatch: 1 file; index.js:4 braces import. 다수의 self-reference marker는 문자열 탐지의 false positive 가능성이 있으므로 실제 호출로 단정하지 않음.
- fast-glob: 26 files; out/utils/pattern.js:6 micromatch import, line 137 explicit brace API marker.
- chokidar: 4 files; index.js:11 braces import, line 258 explicit brace API marker.
- braces: 7 files; index.js 자체의 brace AST API marker 다수. 해당 표시는 **취약 함수가 설치됨**을 뜻하지 외부 유입 호출을 뜻하지 않음.

검출 위치는 CI가 실제 설치한 소스의 파일/행 번호이며, 업스트림 main 소스와 혼동하지 않는다. scanner는 node_modules 내부 파일을 읽기만 하고 regex textual marker를 표시한다. line 주변 함수 컨텍스트, 입력 종류, URL/파일 경로에서 glob 패턴으로의 변환, 서명 검증 대상과 키 출처 및 Android 패키징은 **추가 수동·동적 검증 필요**. 관찰한 0건도 부재 증거는 아니다.

원본 CI 결과: canonical audit FAIL, CodeQL PASS, Main Health [run #38223030323](https://github.com/gycha0109-beep/K_beauty/actions/runs/38223030323) PASS. 추후 문서 반영을 포함한 새 HEAD는 별도 검사 결과를 확인해야 한다.

## 6. SCA-2 초기 후보·결정

| 후보 | 확인된 사실 | 결정 |
| --- | --- | --- |
| 공식 braces 패치 | 3.0.3 이후 공식 patched version 없음; PR #72 unmerged; maintainer advisory 이의 제기 | HOLD, 공식 release/GHSA 업데이트 재확인 |
| 공식 node-forge 패치 | <=1.4.0 영향, patched version 없음; issue #1149 open | HOLD, 출처·패치·RSA regression test 확보 |
| @expo/metro-file-map 58.0.4 | micromatch 제거가 upstream changelog에 명시 | 부분 후보만 유지; Expo SDK 57 호환·별도 Metro·dev 경로 검증 필요 |
| 최신 Expo CLI | upstream 58.1.6에도 node-forge 직접 의존 | 단독 해결책 아님 |
| npm audit fix --force | 과거 결과는 Expo 44/React Native 0.72 등 비호환 다운그레이드 제안 | 거부 |
| 보안 포크/기능 교체 | 출처, 고정 digest, negative tests, npm advisory 정합성 미확인 | 지금은 채택 불가 |

### Stage gate 및 미착수 항목

- [x] SCA-0 당시 main/PR/CI/lock/Advisory 정리.
- [x] SCA-1 기존 전이 의존성 경로 분리.
- [x] Upstream 확인: Expo signing RSA verify와 Metro braces 제거 후보, forge/brace issue 상태.
- [x] installed-code의 call-site를 한정 관찰하는 scanner + synthetic tests + 기존 CI 연결.
- [ ] 정확 HEAD의 scanner + CI 결과 검증 및 기록.
- [ ] 정확한 설치 소스 call-site → 입력 소유자 → 실행 컨텍스트 → 번들 존재 여부 재검증.
- [ ] 두 advisory 모두 수정하는 검증 가능한 upstream/대체 조합 확보.
- [ ] 후보 격리 설치 및 Android/Expo/Metro 회귀 테스트.
- [ ] 실제 dependency fix 이후 무예외 감사 정책 v2, final CI, merge, #1232/#1233 handoff.

**최종 현재 판정: VULNERABILITY_REMEDIATION=NOT_ATTESTED / SECURITY_GATE=FAIL(HOLD).** 예외 연장, 신규 허용 목록, overrides, 대규모 SDK 교체, 운영 변경은 수행하지 않았다.

## 7. SCA-1 진단 보수 및 SCA-2 패치 후보 비교 (추가 실행)

- **Lockfile tracer의 범위 판정 오류 보수:** 기존 구현은 `braces@3.0.3` / `node-forge@1.4.0` 버전 완전 일치만 `knownAffectedReachable=true`로 인식해, 공식 Advisory상 여전히 영향받는 더 낮은 버전을 놓칠 수 있었다. 실제 패치에서 기준 버전 **이하의 안정적인 x.y.z 세그먼트 비교**로 전환했으며, 프리릴리스·불명확 버전은 `UNKNOWN_VERSION_REQUIRES_AUDIT` 및 `unknownVersionReachablePaths`로 표시한다. 수정은 읽기 전용 tracer에서만 이루어졌고 canonical `npm audit` 및 예외 정책은 그대로다.
- **부정/경계 fixture 확장:** `braces@3.0.2`와 `node-forge@1.3.9`가 영향받음, `3.0.4-preview.1`·`unparsed`·매우 큰 세그먼트 버전이 UNKNOWN, 임시 정상 상위 버전은 **단지** `NO_KNOWN_AFFECTED_VERSION_DETECTED_REQUIRES_AUDIT`라는 해석 등 총 10개 scenario. `scripts/security/verify-supply-chain-lock-path-tracer.mjs`에서 검증.
- **실제 공개 수정 후보 소스 검토:** [별도 SCA-2 후보 평가](sec-sca-20261012-upstream-patch-candidate-review.md) 작성. `braces` PR [#72](https://github.com/micromatch/braces/pull/72) (head `28d440b5...`, CLOSED/NOT MERGED, AST 재귀 제한), `node-forge` PR [#1152](https://github.com/digitalbazaar/forge/pull/1152) (head `ceba3440...`, OPEN/NOT MERGED, DigestAlgorithm child-count 엄격화). 두 PR의 실제 source patch를 비교했으나 **공식 보안 패치 배포본이 아니고, 프로젝트에 적용하거나 정상 설치/Android를 검증하지 않았다.**
- 정확한 코드 실험은 **해당 HEAD의 CI 로그 검수 이후** PASS로 기록한다. 문서 변경 이후의 재실행/취소는 따로 구분한다.
- **SCA-3 진입 불가:** 두 Advisory의 공급망이 동시에 깨끗해지고 안전한 npm 패키지·무결성·호환성이 입증된 후보 없음. 임의 override/lockfile 수정/expired exception 연장/범위 확대하지 않았다.

## 8. SCA-1 동적 동작 확인 / SCA-2 복사본 패치 검증 (2026-10-12)

**정확한 검사 대상 코드 SHA:** `19ab597ec5ff0d1f8a874c31d7ddda7e696be1ad`. [Supply Chain workflow #38228717035](https://github.com/gycha0109-beep/K_beauty/actions/runs/38228717035).

- **실제 npm 설치본 `node-forge@1.4.0`**: `scripts/security/report-supply-chain-runtime-boundaries.mjs`가 메모리 내 임시 RSA-2048 키와 정상/오류 메시지·비정상 ASN.1 구조의 서명 검증을 수행했다. 정상 서명 수용·다른 메시지 거부·비정상 DigestAlgorithm child **수용**. 따라서 현재 실제 설치된 코드의 ASN.1 구조 검증 결함을 독립 확인했다. 공격자의 원격 입력 도달성·개인키 없는 RSA 위조·실제 Expo APK 포함 여부는 UNKNOWN.
- **실제 npm 설치본 `braces@3.0.3`**: 길이 223바이트/깊이 110의 통제된 brace 입력 수용. 실제 stack overflow 재현/서비스 가용성 영향 증거로 해석 금지.
- **격리 `node-forge` 후보:** `verify-node-forge-upstream-patch-isolation.mjs`가 원본 1.4.0 파일과 upstream PR #1152의 정확 hunk 일치를 검사한 뒤 **OS 임시 복사본에만** 패치. 정상 RSA 수용, 다른 메시지 거부가 유지되고 추가 ASN.1 child만 거부됨. `ISOLATED_CANDIDATE_BEHAVIOR_PASS`.
- **격리 `braces` 후보:** `verify-braces-upstream-patch-isolation.mjs`가 PR #72 HEAD의 라이브러리 5개 파일 diff를 임시 복사본에 적용. 정상 glob 결과 보존, 깊이 110 파서 차단, 깊이 101 AST compile 차단, `maxDepth` 축소 반영. `ISOLATED_CANDIDATE_BEHAVIOR_PASS`.
- Upstream patch는 아직 공식 릴리스가 아니다. 두 후보의 정확 source/변경 파일/테스트 한계는 [SCA-2 patch candidate review](sec-sca-20261012-upstream-patch-candidate-review.md)에서 관리한다.
- **공급망 보안 게이트는 계속 FAIL.** 이 격리 실험은 `node_modules`, `package.json`, `package-lock.json`, npm 감사, 임시 예외, 배포 구성을 전혀 바꾸지 않는다. 감사 통과·Android 호환성·운영 수정으로 취급하지 않는다.

SCA-2 출처 보유 코드 변경의 **제한된 개별 동작 실험은 완료**. SCA-3의 공식/검증된 배포 아티팩트, Expo/Metro 및 Code Signing 통합 회귀, source provenance, lockfile·실제 CI 무예외 PASS는 미충족이라 여전히 HOLD다.

## 9. SCA-3 진입 전 실제 소비자 통합·패치 무결성 검증 (2026-10-13)

**검사 대상 코드 SHA:** `85bceaa09e788e6d507fba8e27380bc0ae18134a` · [Supply Chain run #38330955980](https://github.com/gycha0109-beep/K_beauty/actions/runs/38330955980). 실험은 `npm ci --ignore-scripts`로 재현한 실제 원본 의존성에서 시작하되 **OS 임시 폴더 내부 복사본만 수정**한다.

### 추가된 구현

- `verify-braces-upstream-patch-isolation.mjs`와 `verify-sca-candidate-integration-isolation.mjs`에서 고정된 PR #72 diff를 디코딩한 뒤, Git blob SHA-1 `b6aa05571a91ec9c6c4bc80ae7c6a26cb5db31af`와 **정확한 바이트 동일성**을 검증한다. 검토본이 바뀌면 테스트가 실패하며, SHA-1 식별자 자체는 공식 npm 배포 서명/무결성을 증명하지 않는다.
- 이전 임시 소비자 검사: `@expo/code-signing-certificates@0.0.6`의 self-signed 인증서 생성·PEM 왕복·인증서/키 검증·manifest 서명, `micromatch@4.0.8`의 부정 패턴·brace 확장, `fast-glob@3.3.3` 파일 검색.
- 새로 추가한 실제 소비자 로드: `@expo/metro-file-map@57.0.3`의 watcher helper, `metro-file-map@0.84.5` 및 `metro-config` 하위 `metro-file-map@0.84.6`의 watcher helper. **모두 격리된 patched `micromatch` 경로를 resolve하는지 검사**한다.
- `chokidar@3.6.0`의 CJS 모듈과 `watch` API를 로드하고, 원본 설치본이 아닌 임시 patched `braces` 경로로 resolve하는지 확인한다. 이는 **watch loop나 실제 장기 파일 변경 이벤트 검증은 아니다**.

### 실제 CI 관찰

`SCA_CANDIDATE_DEPENDENT_INTEGRATION`:
- `expoCodeSigning=PASS_SELF_SIGNED_CERT_PEM_VALIDATION_MANIFEST_SIGNATURE`
- `micromatch=PASS_MATCH_NEGATE_BRACE_EXPANSION`
- `fastGlob=PASS_MATCH_AND_NEGATIVE_GLOB`
- `metroFileMaps=PASS_THREE_WATCHER_HELPERS_USING_PATCHED_MICROMATCH`
- `chokidar=PASS_INSTALLED_WATCHER_LIBRARY_LOAD_AND_PATCHED_BRACES_RESOLUTION`

두 업스트림 패치의 자체 격리 행동 테스트도 통과했다. **Supply Chain은 만료된 braces 예외에 대한 원본 production `npm audit`가 계속 실패해야 한다.** CodeQL·Main Health·PIE는 이 코드 SHA의 개별 결과로만 결론을 기록한다.

### 단계 판정 및 남은 차단

**SCA-3 사전 통합 테스트는 부분 완료**, 로드맵상의 **정식 SCA-3(실제 후보 `package-lock` 재생성·전체 통합/Android 검증)는 HOLD**. 상위 PR 두 건은 여전히 공식 병합/배포가 확인되지 않아, 기존 lockfile 취약 버전 `braces@3.0.3`, `node-forge@1.4.0`를 제거하거나 대체하지 않았다. 미완료:

1. 승인 가능한 패치 배포본 또는 동등 안전 대체와 해당 artifact의 정확한 출처·SHA512 integrity·license·오너 결정.
2. 별도 worktree 후보 lock 설치 및 전체/production raw audit high/critical 0.
3. Expo/Metro watcher 실제 이벤트, 정상·변형 인증서의 폭넓은 회귀, 모바일 typecheck/Metro export/native/Android build 및 실제 번들 포함 경계.
4. 원인 제거 후 예외 없는 fail-closed audit v2 → 최종 HEAD CI → Security 리뷰·병합·타 트랙 인계.

금지: `npm overrides`로 패키지 출처 속이기, advisory 허용 목록 확대, 예외 만료 연장, 원래 감사를 성공 처리, Production 의존성 패치의 검증 전 적용. **#1240 Draft/HOLD와 #1208 OPEN 유지.**

## 10. SCA-3 실제 감시 이벤트·Expo 인증서 거부 조건 검증 (2026-10-13)

**검증 코드 SHA:** `65b03d5137c0ea5e521256dffd5a3dcde2c4ca21` · [Supply Chain CI #38331934597](https://github.com/gycha0109-beep/K_beauty/actions/runs/38331934597). 이 로그의 `Trace vulnerable dependency paths without changing audit policy` 단계는 PASS. **정식 취약점 감사 단계는 만료된 GHSA-vfj7-8cjw-p6xm 예외로 의도대로 FAIL**.

- `scripts/security/verify-sca-candidate-integration-isolation.mjs`의 **실제 chokidar 파일 이벤트**: OS 임시 폴더의 `{a,b}.js` 중괄호 glob을 격리된 `chokidar@3.6.0`로 감시하고 `ready` → `a.js` 생성(`add`) → 변경(`change`) → 삭제(`unlink`) 순서대로 이벤트와 정확한 파일 경로를 확인. 파일 감시는 테스트용 polling을 사용하고 이벤트마다 10초 제한을 두며 `finally`에서 watcher를 닫는다. 결과 `chokidarFileEvents=PASS_READY_ADD_CHANGE_UNLINK_PATCHED_BRACE_GLOB`.
- `@expo/code-signing-certificates@0.0.6`와 임시 patched `node-forge` 경로에서 기존 self-signed/PEM/서명 **정상 시나리오**에 더해, 서로 다른 테스트용 RSA 키쌍을 전달하면 인증서 검증 거부, 만료된 유효기간이면 검증 거부를 확인. 결과 `expoCodeSigning=PASS_SELF_SIGNED_CERT_PEM_SIGNATURE_WRONG_KEY_AND_EXPIRY_REJECTION`.
- 기존 `braces`와 `node-forge` 원본-패치 동작 비교, patch identity pin, 세 종류의 Metro file-map consumer resolve/load, micromatch 및 fast-glob 검사는 같은 진단 단계에서 재통과. 모든 인증서·키·감시 파일은 격리 테스트 전용이며 원본 `node_modules`, 잠금 파일, 설정, 운영 인증서에 접근하거나 변경하지 않는다.
- **범위 한계:** 정상 glob의 실제 watcher 동작 및 일부 인증서 거부 조건만 확인. Metro 자체 watch loop, 실제 Android 번들·네이티브 실행, signed production manifest, 정식 배포 후보 패키지/npm tarball integrity 및 원본 감사 HIGH=0은 **미검증**. 따라서 로드맵상 정식 SCA-3 HOLD 유지.

## 11. SCA-3 Android JS export 기준선·소스맵 경계 관찰 (2026-10-13)

### 변하지 않은 릴리스 전제

- 정확한 검증 코드 HEAD: `45db48626fdf110858c524f9fa271f422d3c4fd7`. [Supply Chain Security #38333569911](https://github.com/gycha0109-beep/K_beauty/actions/runs/38333569911), [Main Health #38333569865](https://github.com/gycha0109-beep/K_beauty/actions/runs/38333569865), [PIE #38333570547](https://github.com/gycha0109-beep/K_beauty/actions/runs/38333570547).
- 작업 시 조회한 main `f49aa65cb7d83d58784bf149b409f7e20108ef9d`, Security PR은 Draft/HOLD. Root `package-lock.json` blob `37dfa247a664593440667b35d9af96d604d7949b` 동일. `braces@3.0.3`, `node-forge@1.4.0`이 계속 설치됨. 2026-10-13 기준 두 GitHub 공식 Advisory는 HIGH, 수정된 npm 배포 버전은 없음.

### 관찰 코드와 정확한 CI 결과

- `scripts/security/run-sca-mobile-baseline-observation.mjs`에서 **실제 잠금된 원본 패키지**를 사용해 `verify:mobile-foundation`, `mobile:typecheck`, `npm run export:android --workspace @bejewely/mobile -- --source-maps`를 순차적으로 실행. 호출별 PASS/FAIL/시간 초과를 구조화해 기록한다. npm 명령 출력은 보안 로그에 재출력하지 않는다.
- `scripts/security/report-sca-android-bundle-boundary.mjs`는 Android JS export의 생성된 외부 source maps만 읽는다. indexed sourcemap `sections` 포함, 파일/깊이/크기 제한과 symlink 거부를 적용한다. 소스 코드·소스맵 원문·환경 값은 로그에 출력하지 않고 패키지별 source path 참조만 집계한다.
- `SCA_MOBILE_BASELINE_OBSERVATION`: foundation **PASS**, typecheck **PASS**, androidJsExport **PASS**, bundleSourceMapInventory **PASS**. 생성된 `.expo-ci-dist`는 CI 종료 전에 삭제한다.
- `SCA_ANDROID_BUNDLE_BOUNDARY`: **source maps 1개, sourceEntries 1,307개**. `braces` 참조 **0건**, `node-forge` 참조 **0건**. 출력 의미는 **해당 Android JavaScript export의 source map에서 경로가 관측되지 않았다**는 것에 한정된다. 설치/빌드 툴에서의 사용이나 네이티브/다른 환경/전체 APK 내 부재, 공격자 접근 불가를 입증하지 않는다.
- 패치 후보의 기존 임시 라이브러리·Expo signing·micromatch·fast-glob·Metro x3·chokidar 실제 이벤트 테스트 및 정책 mutation guard도 PASS. 별도 CodeQL 및 Main Health/PIE PASS. **Canonical `npm audit`는 만료된 `GHSA-vfj7-8cjw-p6xm` 예외로 FAIL 유지**. 수정 없는 생산/전체 감사 HIGH=0 주장 없음.

### 검증 중 장애와 수정

첫 CI [#38333193023](https://github.com/gycha0109-beep/K_beauty/actions/runs/38333193023)는 신규 workflow `always()` 조건문을 기존 보안 정책 보호기가 차단했고, Android prebuild 전 `verify:mobile-native`를 호출해 실패했다. 이 상태에서는 canonical audit가 실행되지 않아 **수용 불가**.

조건부 보안 단계와 추가 install ID를 완전히 제거하고, 원래 trace 단계 안에 **비게이팅·명시적 PASS/FAIL 관측 스크립트**를 넣는 방식으로 교체했다. Native/Gradle은 `NOT_RUN_REQUIRES_SEPARATE_PREBUILD_ISOLATION`로 표시한다. 다음 CI [#38333383928](https://github.com/gycha0109-beep/K_beauty/actions/runs/38333383928)는 기초 검사·typecheck·Android export PASS였으나 중첩 npm 인수 전달로 source-map 인벤토리가 실패하여, 작업 공간의 `export:android` 스크립트를 직접 호출해 `--source-maps` 전달을 고쳤다. 최종 [#38333569911](https://github.com/gycha0109-beep/K_beauty/actions/runs/38333569911)에서 source map inventory까지 PASS했고, 원래 audit 실패가 다시 독립적으로 관측되었다.

### 판정

**SCA-3 Android JS 번들 기준선 관찰만 완료.** 수정된 의존성 기반 Android export가 아니며, Android native prebuild·Gradle assembleDebug·APK 설치/실행·전체 아티팩트 검사·공식 패치/npm integrity·잠금 그래프 수정/원본 감사 HIGH=0은 **NOT_RUN/UNKNOWN**. 유지 가능하고 감사 정합성 있는 두 패키지 해결책이 없으므로 **SCA-3 정식 교체/빌드 및 SCA-4~7 HOLD**, PR #1240 Draft, 이슈 #1208 OPEN.
