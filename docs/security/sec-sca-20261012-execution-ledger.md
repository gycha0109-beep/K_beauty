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
