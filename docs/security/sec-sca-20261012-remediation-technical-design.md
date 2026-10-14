# BEJEWELY SEC-SCA — 의존성 취약점 근본 보수 상세 기술 설계

> 기준일 2026-10-12 · 설계 상태: **IMPLEMENTATION PLAN / HOLD** · Watchtower-Track: security
>
> 상위 실행계획: [전체 로드맵](sec-sca-20261012-remediation-roadmap.md) · 기존 경로 분석기: [SEC-SCA-P1](sec-sca-p1-advisory-lockfile-path-triage-20261010.md)
>
> 관리 이슈 [#1208](https://github.com/gycha0109-beep/K_beauty/issues/1208) · 진단/보호 PR [#1240](https://github.com/gycha0109-beep/K_beauty/pull/1240).
> **이 문서의 설계·명령·테스트 사례는 취약점 해결을 수행했다는 증거가 아니다.**

## 1. 구현 목적과 설계 경계

### 1.1 최종 보안 invariant

각 시점의 정확한 repository HEAD에 대해 다음 모두 충족해야 한다.

1. 전체 npm workspace/중첩 `node_modules`/잠금 파일 경로에 확인된 `GHSA-vfj7-8cjw-p6xm` 또는 `GHSA-86w9-cpqp-85rv` 취약 코드가 존재하지 않거나 **공식 수정된 코드/검증된 기능 동등 대체본**으로 실제 교체되어야 한다.
2. 배포 번들에 복사되거나 포크에 재포장된 같은 취약 코드가 남아 있지 않아야 한다. 패키지 이름·버전 숫자만 바꾸는 것으로 해결하지 않는다.
3. `npm audit --json` 및 `npm audit --omit=dev --json` raw evidence에서 신규 HIGH/CRITICAL이 없으며, 현재 `BASELINE`의 HIGH=0, CRITICAL=0, MODERATE<=13을 완화하지 않는다. **HIGH 0은 전체 트리와 production 양쪽 모두의 정책 수락 조건**이다.
4. 정상 lock 재생성·`npm ci`·Expo/Metro/React Native 기능·native/Android 빌드·독립 CI가 정확 HEAD에서 수락돼야 한다.
5. 만료된 예외를 연장하는 대신 취약점 해결이 입증된 후 원인별 exception을 제거하고 **무예외 fail-closed audit 정책**과 그 회귀 테스트를 동시 전환한다.

### 1.2 승인·변경 범위

**Security 트랙 변경 후보:** `apps/mobile/package.json`, 루트 `package.json` / `package-lock.json`, 보안 관련 `scripts/**` 및 기존 `.github/workflows/supply-chain-security.yml`, 증거 문서. 변경 범위는 실제 후보가 확정된 경우에만 최소화한다.

**변경 금지:** `supabase/migrations/**`, 운영 RLS/DB/Storage, 인증·권한, billing, 배포, `#1232`의 DB 검사기/상품 canonical 로직, `#1233`의 Face Lab 상품 매핑. 신규 전용 보안 workflow는 만들지 않는다. 기술적 영향 때문에 관련 소유 파일이 꼭 필요하면 소유 트랙과 별도 변경 합의를 진행한다.

## 2. 실제 의존성·보안 근거 (2026-10-12 기준)

| 레이어 | 관찰 | 위험 판단 |
| --- | --- | --- |
| 루트 workspace | `apps/*`, `packages/*`, `tools/*`를 root `package-lock.json` v3로 관리 | 모바일만 변경해도 root lockfile 영향 |
| 모바일 | `expo ~57.0.20` → lock `57.0.21`, `react-native 0.86.3` | Expo 메이저 전환은 React Native 호환성 점검 필수 |
| Braces | `node_modules/braces@3.0.3`; 직접 부모 `micromatch@4.0.8` (`^3.0.3`) | [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), 고중첩 패턴에 의한 재귀 stack exhaustion |
| Forge | `node_modules/node-forge@1.4.0`, `@expo/cli` 직접 의존 및 `@expo/code-signing-certificates` 관련 경로 | [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv), 특수 ASN.1 DigestAlgorithm 시퀀스를 받아들이는 RSA 서명검증 |
| 감사 집계 | prod high 19, full high 22 | package-level 전파 숫자; 서로 다른 CVE 19/22건 아님 |
| gate | `scripts/verify-supply-chain-audit.mjs`의 예외 만료 검사 | `braces` 2026-10-10 UTC 만료, `node-forge` 2026-10-16 UTC 예정 |
| 대안 상태 | 공식 patched version 둘 다 없음 | 버전 상향만으로 해결 불가; 후보별 실제 설치 그래프 검증 |

출처: `package-lock.json`, `apps/mobile/package.json`, `scripts/verify-supply-chain-audit.mjs`, `.github/workflows/supply-chain-security.yml`, [CI #38219770356](https://github.com/gycha0109-beep/K_beauty/actions/runs/38219770356). 실제 보수 전에 다시 조회할 것.

### 2.1 현재 잠금 파일 대표 경로

```text
apps/mobile (runtime workspace root for dependency analysis)
└─ expo@57.0.21
   ├─ @expo/cli@57.0.23
   │  ├─ @expo/metro-file-map@57.0.3 → micromatch@4.0.8 → braces@3.0.3
   │  ├─ node-forge@1.4.0
   │  └─ @expo/code-signing-certificates@0.0.6 → node-forge@1.4.0
   └─ Metro/React Native tooling (separate file-map/glob paths to braces)

root devDependencies
└─ tailwindcss@3.4.19
   ├─ chokidar@3.6.0 → braces@3.0.3
   ├─ fast-glob@3.3.3 → micromatch@4.0.8 → braces
   └─ micromatch@4.0.8 → braces
```

위 그림은 **선택된 대표 경로**다. 전체 경로는 실제 tracer와 `npm ls`, `npm explain`, nested lock entries로 다시 생성한다. `npm audit --omit=dev`에 보인다는 사실은 설치 범주를 뜻할 뿐 최종 Android APK에 포함된다는 의미가 아니다.

### 2.2 독립성 원칙

두 Advisory는 별도 leaf source다. `braces`만 처리하면 `node-forge`가 남고 반대도 동일하다. Expo CLI가 `node-forge`를 직접 사용하므로 `@expo/code-signing-certificates` 한 경로만 없애도 해결되지 않는다. Root Tailwind의 dev 경로를 없애더라도 Expo/Metro를 통한 prod audit 경로가 남을 수 있다.

## 3. 공격면과 호출 지점 감사 설계

최종 결론을 `unused`, `dev-only`로 추정하지 말고 **패키지 → 실제 import/call → 입력 소유자 → 신뢰 경계 → 번들/실행 조건** 다섯 단계로 기록한다.

### 3.1 `braces` 조사

- 확인 위치: `@expo/metro-file-map`, `metro-file-map`의 watcher 패턴/글로브; `@expo/metro-config`; `micromatch` 호출; dev-only `chokidar`, `fast-glob`, `tailwindcss`.
- 취약 원리: 매우 깊게 중첩된 brace pattern을 재귀 AST 처리에 넣어 Node 프로세스 stack overflow. 경로 이름, file watcher glob, Metro config, 외부 입력이 실제 pattern이 되는지 분리.
- 파일 watcher가 감시하는 **경로 이름**과 라이브러리에 전달하는 **glob pattern**은 서로 다른 입력이다. 파일명이 외부 통제된다고 해서 곧 임의 brace pattern 실행이 증명되는 것은 아니다.
- 설문·사진·제품명·업로드 경로·사용자 입력이 빌드 도구 설정/패턴 생성으로 교차 전달되는지 조사. 검증되지 않으면 `unknown`.
- 격리 테스트는 취약 입력 패턴 fixture와 정상 pattern fixture를 포함한다. 의도하지 않은 프로세스 종료를 막기 위해 자식 프로세스/timeout/자원 제한 하에서 수행하고, **patched/replacement code의 회귀 검증**을 우선한다. 현재 운영 프로세스에 DoS를 직접 재현하지 않는다.
- `braces` 코드가 `micromatch`를 교체한 상위 패키지나 다른 이름의 번들에 복사됐는지도 파일 내용·빌드 산출물 수준에서 확인한다.

### 3.2 `node-forge` 조사

- 확인 위치: `@expo/cli` `codesigning` 유틸·개발 서버 Expo signature 처리, `@expo/code-signing-certificates`의 인증서 생성/검증, Expo iOS signing 경로. 업스트림 파일의 예시는 `packages/@expo/cli/src/utils/codesigning.ts` 및 `packages/@expo/cli/src/run/ios/codeSigning/Security.ts`.
- 취약 원리: RSA PKCS#1 v1.5 서명 검증 중 비정상적으로 추가된 `DigestAlgorithm` 구성요소를 충분히 거부하지 못하는 문제. 일반적인 키 생성/인증서 파싱 코드 사용 여부만으로 이 특정 취약 RSA 검증 호출에 도달한다고 판정하지 않는다.
- 검증 분기: *서명 생성*, *서명 검증*, *X.509/CSR/PKCS#12 파싱*, *개발 서버 인증서*, *Android release signing*을 별개 기능으로 기록한다. 특히 검증 측의 공개키/low exponent/공격자가 제어하는 서명/데이터 경계 조사.
- 허용 테스트는 올바른 서명/잘못된 서명/비정상 구조 ASN.1(검증된 안전 fixture) 모두를 포함. 잘못된 서명 수용이 발생하면 즉시 후보 탈락. 운영 배포 서명키·계정 키는 테스트에 사용하지 않는다.
- Android Debug APK 빌드 성공은 Expo OTA 개발 코드서명과 PKCS#1 v1.5 경계가 안전하다는 증명이 아니다.

### 3.3 Reachability ledger (각 edge별 필수 기록)

| 필드 | 의미 |
| --- | --- |
| `subject` | `braces` 또는 `node-forge` |
| `lock_path` / `version` / `parents` | 정확 설치 경로와 잠긴 버전 |
| `source_file:function` | 코드 import/call 근거 |
| `entrypoint` / `input_owner` | 시작 기능 및 공격자/운영자/빌드 관리 입력 구분 |
| `environment` | CI / local Metro / build / APK / service runtime |
| `reachable_status` | `confirmed`, `not_found_with_scope`, `unknown` |
| `evidence_ref` / `SHA` | 원문 링크·실행 로그·정확 commit |
| `impact` / `notes` | 예상 영향과 한계; 해결 승인과 별도 |

## 4. 대안 선정 프로토콜

후보는 공식 upstream → 호환 상위 교체 → 의존 제거/대체 → 보안 검토된 포크 순서로 평가한다. **완성 후보의 조건은 두 Advisory 동시 해결**이다.

| 옵션 | 이점 | 입증해야 할 사항 | 주요 차단 요인 |
| --- | --- | --- | --- |
| O1 공식 패치 | 공급망 추적·장기 유지 용이 | 원본 source/patched release, 정상 lock, 양쪽 advisory 소거 | 2026-10-12 공식 릴리스 없음 |
| O2 Expo/Metro 업그레이드 | upstream 패턴 처리 교체 가능 | Expo↔RN SDK, Metro bundling, code-signing, 모든 glob 경로, Android | 메이저 호환/동시 forge 잔존 |
| O3 상위 라이브러리에서 glob/forge 제거 | 문제 코드 아예 미설치 가능 | 최소 기능 동등성, dev+prod 모든 경로, 빌드 | 직접 Expo CLI 사용 경로 및 Tailwind 중복 |
| O4 유지보수 대체 구현 | 명시적 패치와 유지보수 가능 | API/ABI/보안 성질·입력에 대한 verifier | 운영 부담·출처 불명 |
| O5 검증된 패치 포크 | upstream이 패치를 내지 않아도 수정 가능 | 리뷰된 patch, 바이트 동일성, 재현 패키징, 서명/해시, advisory와 감사의 정합성 | 등록 패키지 정체성이 같으면 scanner 여전히 FAIL 가능 |
| O6 런타임 도달성 차단 | 위험 축소 | 실제 입력·실행 경계 추적, fail-closed 제한 | **취약 코드 제거 아님 / 완료 인정 불가** |

**업스트림 관찰(2026-10-12):** Expo의 `@expo/metro-file-map@58.0.4` changelog에 `micromatch` 제거로 `braces` 전이 경로가 제거됐다고 명시되어 있다([Expo upstream](https://github.com/expo/expo/blob/main/packages/@expo/metro-file-map/CHANGELOG.md), [PR #51093](https://github.com/expo/expo/pull/51093)). 그러나 프로젝트의 `@expo/metro-file-map@57.0.3`과 API/버전이 같지 않으며, 다른 Metro file-map의 `micromatch`와 `node-forge`는 별도 문제다. `58.0.4`만 강제 override하지 말 것.

### 4.1 대안 승인용 비교표

각 후보 문서/PR에 아래 항목을 `PASS/FAIL/UNKNOWN`으로 채운다.

```text
candidate_id
upstream_release_url / source_commit_sha / tarball_digest
package/API compatibility + Expo SDK compatibility
React Native version and peerDependencies compatibility
root lockfile graph full/prod after change
affected package path occurrences (root + nested)
actual code/patch identity and advisory-specific regression cases
npm ci / integrity, npm ls, raw npm audit full/prod
mobile typecheck, foundation, native, Metro, Android
license, provenance, maintainer security response / rollback source
new vulnerabilities or transitive dependency risk
reviewer/decision, status (ACCEPT / REJECT / HOLD)
```

## 5. 정식 구현/잠금 파일 변경 계약

### 5.1 실험 환경

1. `git fetch origin --prune`, `main` HEAD와 Security 작업 브랜치/dirty 상태 확인; 변동이 있으면 작업 시작 기준을 다시 freeze.
2. 새 패키지 조합은 **격리 작업 트리/보안 작업 브랜치**에서만 시험. `main`·기능 PR에 실험 의존성 적용 금지.
3. `npm view`/upstream release notes/정확 tarball integrity로 후보 확인하고 필요한 패키지 변경만 선언.
4. `npm install --package-lock-only --ignore-scripts --no-audit --no-fund`처럼 **정상 npm resolver**가 만든 lockfile만 채택. lock JSON 수동 버전 치환 금지.
5. `npm ci --ignore-scripts --no-audit --no-fund`를 실행한 다음 패키지/lock tree 확인. 이어서 모바일 빌드 환경에서는 생략된 lifecycle 효과까지 별도 검증.
6. `npm ls braces node-forge micromatch --all`, `npm explain braces`, `npm explain node-forge`, 정적 tracer, node_modules 실제 물리 파일, Metro/Android 결과를 대조.
7. 후보별 원본 audit를 보존. 사전에 허용된 것처럼 보이게 `npm audit --audit-level`을 낮추거나 `--omit=dev`만 검사하지 않는다.

### 5.2 전/후 보존 필드

```text
main_sha, candidate_head_sha, lock_sha256, npm_node_version
package_json_diff, mobile_package_diff, lock_diff
path_count(braces/node-forge) including nested
each locked_version + integrity + provenance
npm_audit_full_metadata + advisory leaf IDs
npm_audit_prod_metadata + advisory leaf IDs
metro_export_artifact / Android build SHA & logs
blocked_reason, reviewer, rollback_commit
```

**특히 패키지 이름이 사라졌더라도** 일부 wrapper·vendor bundle에 취약 AST walker 또는 취약 RSA verifier가 남는지 코드 출처 추적. `braces` 재귀 제한·`forge` strict ASN.1 요소 개수 확인 등 취약 원인 자체에 대한 부정 테스트를 요구한다. 단순 `npm ls` 출력 없음은 충분조건이 아니다.

### 5.3 Safe fork가 최후 선택이면

- 원본 npm tarball SHA512, source tag/commit, 패치 hunk 및 리뷰 근거, license/NOTICE 고정.
- 빌드 시스템과 publish 주체(사내 scoped registry 또는 제어된 git source)·auth/integrity 확인. lifecycle script·CI token 권한·외부 network install 조사.
- 검증된 보안 unit test, 정확 vulnerable/benign fixture, 호환성 회귀, reproducible artifact digest 기록.
- 포크가 원본 취약 버전으로 npm audit에 계속 뜨거나 동일 코드를 재포장한 상태면 FAIL. 단순 package rename으로 advisory를 회피하는 패키지 위장 금지.
- 유지보수 오너, upstream 재동기화, 패치 drift 재검수, 즉시 rollback 절차 없으면 채택 금지.

## 6. Audit 게이트의 **안전한 v2 전환** 상세

### 6.1 현재 코드의 숨은 결합

`scripts/verify-supply-chain-audit.mjs`는 다음 순서로 동작한다.

```text
npm audit --omit=dev --json
npm audit --json
→ parse severity + package graph
→ TEMPORARY_ADVISORY_EXCEPTIONS 검증
     - 날짜/버전/범위/전파 package set
→ 고위험 전파 패키지를 임시 빼고 BASELINE과 비교
→ PASS
```

현재 PR #1240은 **raw audit evidence를 예외 만료 판단 전에 stdout에 출력**하도록 보수했고, `scripts/security/verify-supply-chain-policy-integrity.mjs`가 만료일 연장·baseline 확장·audit/CodeQL 비활성화를 9개 부정변형 테스트로 막는다. **현재 guard는 두 예외의 존재/원래 만료일을 요구하므로, 취약점 제거 후 검사 로직만 지우면 guard도 실패한다.** 이것은 의도된 fail-close이며 보수 완료 때 일관된 정책 v2 교체가 필요하다.

### 6.2 전환 전제 조건

무예외 전환은 아래 두 근거를 확보할 때만 한다.

- **Package evidence**: `braces`·`node-forge` 취약 코드를 정상 provenance로 완전히 제거/교체했고 호환성·회귀가 통과.
- **Audit evidence**: high/critical leaf가 두 Advisory에서 더 이상 존재하지 않고 새로운 high/critical도 없는 raw `npm audit` 결과(전체/production).

한 패키지만 해결된 상태에서는 그 패키지의 기존 exception 검토를 제거하더라도 **다른 미해결 Advisory 때문에 canonical audit를 실패 상태로 유지**한다. 두 개의 해결 조건을 AND로 판단한다. 기한 연장은 없음.

### 6.3 목표 verifier 계약 (설계 의사코드; 미구현)

```text
production = npmAudit(["--omit=dev"])   // JSON + exitCode + raw metadata
all        = npmAudit([])

for each result:
    assert valid raw report/metadata and expected npm exit semantics
    assert result.vulnerabilities.high === 0
    assert result.vulnerabilities.critical === 0
    assert result.vulnerabilities.moderate <= 13
    assert result.vulnerabilities.low === 0
    assert result.vulnerabilities.info === 0
    assert result.vulnerabilities.total <= 13
    assert !raw_advisory_leaves.includes("GHSA-vfj7-8cjw-p6xm")
    assert !raw_advisory_leaves.includes("GHSA-86w9-cpqp-85rv")

assert lockfile and installed graph correspond to approved input
assert no temporary exceptions remain
emit raw + normalized result and exact checked-out SHA
report PASS only after all assertions
```

`npm audit`가 잔존 moderate 때문에 종료 코드 1을 반환할 수 있으므로, **CLI 종료 코드 0만 PASS 조건으로 오인하지 않는다**. 현재와 동일하게 지원 가능한 0/1 종료를 파싱하되 malformed JSON, unexpected exit, unavailable audit registry, 빈 metadata는 FAIL이다. 숫자/서술만 바꿔 `PASS` 출력하는 우회 금지.

### 6.4 정책 v2 부정변형 테스트

동일 보안 PR의 **원자적 변경**으로 guard를 아래로 교체한다. 그 전까지 기존 9개 guard 유지.

| Fixture / mutation | 기대 결과 |
| --- | --- |
| 정상 raw audit, high=0/critical=0, 기존 moderate 범위 | PASS |
| `braces` Advisory leaf를 하나 주입 | FAIL |
| `node-forge` Advisory leaf를 하나 주입 | FAIL |
| 새로운 HIGH 또는 CRITICAL 패키지 추가 | FAIL |
| moderate가 13 초과 또는 기타 baseline 완화 | FAIL |
| `npm audit` 명령 제거, `--omit=dev`만 남기기 | FAIL |
| `continue-on-error`, `if:` 조건으로 job 생략 | FAIL |
| CodeQL step 제거 | FAIL |
| 원본 예외 설정 재도입 또는 만료일만 갱신 | FAIL |
| `package-lock.json` 의존 그래프 누락/무결성 이상 | FAIL |
| audit JSON 오류·registry 응답 실패 | FAIL |
| 승인 없는 lock 변경·새 취약 패키지 전이 | FAIL |

기존 `BASELINE`의 설정 수준(Moderate 13/High 0/Critical 0)을 **완화하지 않는다**. `temporary exceptions` 객체와 고위험 차감 로직을 제거하면서 새로운 allowlist를 만들지 않는다. 필요한 경우 동일한 fail-closed 검증으로 교체하고 **실제 부정 테스트 결과로** 증명한다.

### 6.5 CI wiring

- Canonical owner: `.github/workflows/supply-chain-security.yml`.
- 기존 `package-integrity` 내 설치 → 경로 tracer → policy integrity → 원본 audit 순서를 유지하되, 무예외 v2 전환 순간에는 policy integrity도 함께 v2가 되도록 원자적으로 적용.
- CodeQL JS/TS는 동일 workflow 내 독립 job 유지.
- `continue-on-error`, 조건부 스킵, baseline/timeout을 느슨하게 바꾸지 않는다.
- 관련 보안 회귀를 테스트 명령에 연결할 때 동일 워크플로 안에서 실행한다. 새로운 세대별 CI workflow를 만들지 않는다.
- GitHub Actions `pull_request` paths filter가 문서 전용 변경을 생략할 수 있으므로 **변경된 보안 PR HEAD에서 실제 실행됐는지** 확인한다.
- `docs/ci/workflow-responsibility-map.md`의 현재 canonical Track Key 열거에는 `security`가 빠져 있다. 보안 이관문이 요구하는 `Watchtower-Track: security`와의 차이를 기록하고 Watchtower 정책 오너에게 귀속 여부를 확인한다. **공유 기술 CI를 security 전용으로 영구 재분류하지 않는다.**

## 7. 명령과 검증 매트릭스

### 7.1 로컬/격리 검증

```bash
# Node 22 / npm package-lock v3 기준; 실제 환경·버전 로그 기록
npm ci --ignore-scripts --no-audit --no-fund
npm ls braces node-forge micromatch --all
npm explain braces
npm explain node-forge
node scripts/security/verify-supply-chain-lock-path-tracer.mjs
node scripts/security/report-supply-chain-lock-paths.mjs

npm audit --json
npm audit --omit=dev --json
node scripts/verify-supply-chain-audit.mjs

npm run mobile:typecheck
npm run verify:mobile-foundation
npm run mobile:config
npm run verify:mobile-native
npm run mobile:export:android
```

설치 후 버전/의존성 변경에 따라 `npm explain`은 대상이 없으면 비정상 종료/진단 메시지를 남길 수 있다. 이때 **대상 제거 증거는 lock + tree + raw audit + artifact로 교차검증**하며, 단순 exit-code 무시 금지.

### 7.2 Android/native 검증

- 깨끗한 격리 workspace에서 정상 `npm ci` 후 필요하다면 `npm run mobile:prebuild:android` (명령이 `--clean`을 포함하므로 기존 네이티브 소스가 변경되지 않도록 격리).
- 실제 Android SDK/JDK 확보 후 `npm run mobile:build:android:debug` 및 앱 설치/실행 smoke.
- Metro bundling/asset 로딩, Expo config, router entry, 화면 전환, 카메라 권한/촬영, API 네트워크 상태, 패키지 코드서명 관련 기능 등 영향 가능 범위를 확인.
- 번들 산출물의 의존 코드/패턴 검색과 필요시 SBOM의 실제 패키지 포함 여부를 점검. `npm ci --ignore-scripts`만으로 네이티브 성공 주장 금지.

### 7.3 CI 수락 조건

| 검증 | 합격 조건 |
| --- | --- |
| Supply Chain / `package-integrity` | exact HEAD, `npm ci` PASS, tracer/guard PASS, **무예외 audit PASS** |
| Supply Chain / `codeql` | exact HEAD, JS/TS CodeQL Analyze PASS |
| Current Main Health | exact HEAD, 전체 canonical suite PASS |
| Security Boundary | exact HEAD, application boundary + SEC-12 mutation 검증 PASS |
| Mobile tests | typecheck/foundation/native/export/Android smoke 근거 |
| Diff integrity | `git diff --check`, lock/install 일치, 제한 범위, 승인된 provenance |
| Advisories | 두 GUID 각각 해결 근거, 새 고위험 의존성 유입 없음 |

**어느 한 CI의 PASS도 전체를 대표하지 않는다.** mandatory gate가 실패하거나 미실행이면 PR `HOLD`.

## 8. 실패 처리·rollback

| 상황 | 즉시 반응 | 복구 |
| --- | --- | --- |
| 원인 패키지 버전 그대로 / alias만 변경 | 후보 REJECT | 후보 커밋 별도 폐기, 기존 FAIL 유지 |
| `braces`만 제거 / `node-forge` 잔존 | 부분 결과 기록, HOLD | 별도 forge 경로 후보 조사 |
| `node-forge`만 제거 / `braces` 잔존 | 부분 결과 기록, HOLD | 별도 Metro/Root dev 경로 조사 |
| 설치는 되지만 Metro/Android 깨짐 | 후보 REJECT | 격리 브랜치 revert, main 미변경 |
| 원본 audit HIGH/CRITICAL 존재 | HOLD | 예외 갱신·baseline 변경 없이 원인 분석 |
| 수정 포크의 출처/코드 검증 불명 | HOLD | approved source+digest 확보 |
| 정책 v2 guard와 canonical audit 불일치 | HOLD | 둘을 동일하게 엄격한 판정으로 복원 |
| Registry/GitHub 장애로 audit 불가 | FAIL/UNKNOWN | 정상 외부 서비스에서 재실행; 성공 오인 금지 |
| 나중에 새 upstream 보안 패치 공개 | 기존 후보 재평가 | 공식 릴리스·앱 호환·회귀 새 후보 |

실험 브랜치 변경은 main·Production으로 전파하지 않는다. 상위 버전 롤백도 lock을 임의 수정하지 않고 정확한 prechange package/lock commit으로 복원한다.

## 9. 검증 증거·승인 ledger 템플릿

보안 PR이나 #1208 코멘트에 아래 구조로 남긴다(값 미확인은 `UNKNOWN`, 미실행은 `NOT_RUN`).

```yaml
security_track: security
date_kst: "<actual>"
main_sha: "<exact>"
candidate_pr: "<number>"
candidate_head_sha: "<exact>"
advisories:
  braces: {id: GHSA-vfj7-8cjw-p6xm, outcome: HOLD, remediation_source: null}
  node_forge: {id: GHSA-86w9-cpqp-85rv, outcome: HOLD, remediation_source: null}
candidate:
  strategy: "<O1..O6>"
  upstream_commit: null
  tarball_integrity: null
before_after:
  package_lock_sha: {before: null, after: null}
  braces_paths: {before: null, after: null}
  node_forge_paths: {before: null, after: null}
verification:
  npm_ci: NOT_RUN
  npm_audit_full: NOT_RUN
  npm_audit_production: NOT_RUN
  supply_chain_job: NOT_RUN
  codeql: NOT_RUN
  current_main_health: NOT_RUN
  security_boundary: NOT_RUN
  mobile_typecheck: NOT_RUN
  mobile_foundation: NOT_RUN
  android_build: NOT_RUN
review:
  package_provenance: UNKNOWN
  security_owner_approval: UNKNOWN
  final_merge_authority: UNKNOWN
decision: HOLD
reason: "Both advisory remediation and exact-head green gates not yet demonstrated"
watchtower_track: security
```

로그에는 사용자 토큰, signing private key, 인증서 개인키, 비공개 환경변수·운영 얼굴 이미지/사진을 포함하지 않는다. **증거가 없으면 빈값을 명시**한다.

## 10. 완료·타 트랙 인계

1. Security PR에서 두 취약 원인에 대한 **동시 제거/교체**와 감사 무예외 정책을 정확 HEAD 기준으로 증명.
2. Source → new lock → physical install → actual execution/Android → audit → CodeQL/Security Boundary/Main Health의 증거가 일관되면 리뷰 요청. CI 하나라도 red면 병합 금지.
3. 승인된 보안 수정 main 병합 후 #1208 closeout. 이전 PR #1240은 보호·진단 코드 전용이므로 **그 자체를 취약점 수정 완료로 취급하지 않는다**.
4. taxonomy-ai #1232·face-research #1233은 최신 main에 동기화하고 각각 정확 HEAD의 feature + shared security 검증 재실행. Security 트랙은 해당 기능 코드에 손대지 않는다.
5. 이후 Dependency update/새 릴리스에서 advisory가 재발하면 동일 lock-path·audit 회귀 게이트로 차단.

**금지 원칙 반복:** 취약점 예외 기한 연장·audit 종료 우회·baseline 상향·CI 변경을 통한 착시 PASS·Production DB/권한/Storage/배포 변경은 이 설계에서 승인하지 않는다.
