# SEC-SCA-2 — Upstream 패치 후보 검토 (2026-10-12)

> 상태: **HOLD — 공식 패치 릴리스 없음 / 임시 복사본 동작 및 제한적 실제 소비자 스모크 검증 완료, 정식 배포·Android 미검증.**
> Watchtower-Track: security · Issue [#1208](https://github.com/gycha0109-beep/K_beauty/issues/1208) · Security Draft PR [#1240](https://github.com/gycha0109-beep/K_beauty/pull/1240).
>
> [전체 로드맵](sec-sca-20261012-remediation-roadmap.md) · [상세 설계](sec-sca-20261012-remediation-technical-design.md) · [실행 Ledger](sec-sca-20261012-execution-ledger.md)

## 1. 결론 및 증거 범위

2026-10-12 현재 공개 GitHub Advisory의 patched versions는 `braces <=3.0.3`과 `node-forge <=1.4.0` **둘 다 None**이다. 공개 소스 PR의 패치 diff를 검토했으나 **채택한 포크·npm 배포본·대체 의존성은 없다**.

| 취약점 | 실제 후보 | 코드 변경 핵심 | upstream 상태/출처 | 1차 결정 |
| --- | --- | --- | --- | --- |
| [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) | [micromatch/braces PR #72](https://github.com/micromatch/braces/pull/72), head `28d440b5dd449dbf1fe6f3506cf94ecca4d02660` | 재귀 AST walker/파서의 depth 제한, cyclic parent 거부 | **CLOSED / NOT MERGED**; 공식 release 없음 | 참고 패치만, 승인 불가 |
| [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv) | [digitalbazaar/forge PR #1152](https://github.com/digitalbazaar/forge/pull/1152), head `ceba34402e329f0365134f23fe19898756527d65` | `lib/rsa.js`가 외부 DigestInfo 및 내부 DigestAlgorithm 각각의 ASN.1 child count 검사 | **OPEN / NOT MERGED**; 공식 release 없음 | 패치 가능성 높음, 승인 불가 |

**출처:** 두 GitHub PR의 변경 파일별 실제 patch를 검토했다. 작성자가 PR에 기록한 테스트 통과 수는 자체 보고이며 BEJEWELY lock/Android/서명 기능에 대한 독립 시험이 아니다.

## 2. `node-forge` PR #1152 코드 차이

실제 변경 범위는 `CHANGELOG.md`, `lib/rsa.js`, `tests/unit/rsa.js`.

- 기존 `lib/rsa.js`는 `asn1.validate(obj,...)`와 **outer** `obj.value.length === 2` 확인까지만 한다.
- PR은 중첩 `obj.value[0].value.length`를 `('parameters' in capture) ? 2 : 1`과 비교해 **OID + optional NULL 이외의 추가 중첩 ASN.1 child를 거부**한다.
- `tests/unit/rsa.js`에 중첩 DigestAlgorithm의 추가 요소가 포함된 회귀 fixture를 추가한다. 작성자는 해당 테스트 명령에서 `101 passing, 4 pending`을 보고했으나 프로젝트에서 독립 재실행하지 않았다.
- 이 코드 차이는 CVE-2026-85393의 설명 및 [upstream issue #1149](https://github.com/digitalbazaar/forge/issues/1149)와 부합한다. **하지만 patched npm version으로 릴리스되지 않았다.**

### BEJEWELY 적용 전에 반드시 확인할 것

1. `@expo/code-signing-certificates@0.0.6` 설치 코드가 `node-forge@1.4.0`의 `publicKey.verify`를 실제 사용하며, manifest/code-signing/자체 서명 검사에서 어떤 입력이 검증되는지 조사한다. 현재 CI에서 `build/main.js:176,203` marker를 확인했으나 실제 신뢰 경계는 미검증이다.
2. 엄격한 중첩 ASN.1 판정이 **합법적 인증서 및 Expo self-signed/development code-signing**을 깨지 않는지 정상 서명/비정상 구조 fixture 양쪽을 검사한다.
3. 오리지널 `node-forge` 소스 tag와 패치 HEAD를 고정하고 artifact integrity, 공급자, 재현 빌드, 라이선스, 유지보수 오너를 검증한다. 현재 계획은 **포크 배포 승인 계획이 아니다**.
4. 공식 release 혹은 검증된 교체 구현이 없는 한 root lockfile의 취약 node-forge는 그대로다. npm audit HIGH/CI FAIL을 변경하지 않는다.

## 3. `braces` PR #72 코드 차이

실제 보안 관련 변경 파일: `lib/constants.js`, `lib/parse.js`, `lib/compile.js`, `lib/expand.js`, `lib/stringify.js` 및 parser/AST 관련 테스트.

- `MAX_DEPTH=100` 상수를 추가하고 `parse`에서 curly braces와 parentheses 중첩을 계산한다. 명시적인 `maxDepth`는 더 낮은 값을 허용하며 기본 상한은 100이다.
- `compile`, `expand`, `stringify`의 **재귀 AST walker**도 node depth를 확인한다. 문자열 parse만 제한해서는 API로 직접 입력된 AST를 보호할 수 없다는 점을 고려했다.
- `expand`에서 parent chain cycle 확인을 추가한다.
- 작성자는 Node 8.3/26.1 Windows 환경에서 `904 tests passing`을 보고한다. **프로젝트 사용 Node 22, Expo/Metro의 실제 glob/watcher, Tailwind/fast-glob/chokidar 하위 경로에서 확인한 것은 아니다.**
- PR은 **2026-10-05 CLOSED, not merged**. [이슈 #84](https://github.com/micromatch/braces/issues/84)에서 maintainer가 Advisory 자체에 반대했지만, 공식 High 상태는 그대로다. 반대 의견은 면제 근거가 아니다.

### BEJEWELY 적용 전에 반드시 확인할 것

1. Parser의 nested brace·parenthesis, `compile`/`expand`/`stringify` AST depth guard, cycle 회귀 테스트를 Node 22 격리 환경에서 실행한다.
2. 실제 `micromatch@4.0.8`, Expo Metro file-maps 세 경로, root Tailwind/chokidar/fast-glob 경로를 모두 테스트한다.
3. watchers/globs의 정상 패턴, 배열/negative glob/extglob, parse result 호환성 확인.
4. 패키지 파일 일부를 `node_modules`에서 임의 치환하는 방식, 원본 출처를 속이는 package alias/이름 변경, 출처 불명 포크를 사용하지 않는다.
5. 원본 npm `braces`가 여전히 설치되는 경우 audit FAIL은 정당하다. 부분 패치를 감사 우회로 인정하지 않는다.

## 4. 실제 설치 소스와 upstream 후보의 연결

**잠긴 현재 설치본을 CI에서 이미 확인:**

- `@expo/code-signing-certificates/build/main.js` lines 8, 176, 200, 203: forge import와 RSA verification marker.
- `@expo/cli/build/src/run/ios/codeSigning/Security.js:42`: forge import.
- `@expo/metro-file-map/build/watchers/common.js:18` 및 `metro-file-map/src/watchers/common.js:14` (0.84.5/0.84.6): micromatch import.
- `micromatch/index.js:4`: braces import.
- `fast-glob/out/utils/pattern.js:137`, `chokidar/index.js:258`: braces API 관련 marker.

근거: [Security CI #38223030217](https://github.com/gycha0109-beep/K_beauty/actions/runs/38223030217), 스캐너 코드 HEAD `2583ff489f559c7029f59d983a1b17e53c08550c`. 이는 설치 소스의 *문자열/행 수준 관찰*로 실제 공격 입력 경로, 패키징, 동적 함수 호출 빈도는 확인하지 못한다.

## 5. 후보 승인 상태표

| 필수 근거 | forge PR #1152 | braces PR #72 |
| --- | --- | --- |
| 공식 upstream patch 릴리스 | FAIL | FAIL |
| 정확한 upstream 수정 source SHA/diff | 확인 | 확인 |
| 승인 가능한 배포 아티팩트 및 integrity | UNKNOWN | UNKNOWN |
| BEJEWELY lockfile 전체 영향 검증 | NOT_RUN | NOT_RUN |
| 격리 지정 fixture 동작 회귀 | **PASS** (정상 RSA·오류 메시지·ASN.1 추가 요소) | **PASS** (정상 glob·중첩 파서·AST compile·maxDepth) |
| Upstream 전체 단위 테스트/배포 통합 테스트 | NOT_RUN | NOT_RUN |
| Expo 57 코드서명·micromatch/fast-glob·Metro 파일맵 및 chokidar 제한적 스모크 | PASS (Expo 코드서명 경로) | PASS (glob/파일맵 3개 및 chokidar 로딩·패치 경로) |
| Android 전체 번들·실기기/네이티브 및 end-to-end watcher 이벤트 | NOT_RUN | NOT_RUN |
| 설치 artifact와 앱 패키지에 동일 취약 코드 부재 | NOT_RUN | NOT_RUN |
| npm audit full+production HIGH 0 | FAIL (현 상태) | FAIL (현 상태) |
| 최종 조건 | **HOLD** | **HOLD** |

**선행 결정:** 공식 패치 버전이 둘 다 배포되거나, Security 오너가 충분한 소스·무결성·보안 테스트·호환성을 갖춘 전체 경로 교체안을 승인하기 전 **SCA-3 의존성 변경 금지**. 패키지 결함이 실제 존재한다는 조사와 npm audit clean·Android release readiness는 별도 증명이다.

## 6. 이후 실행 게이트

1. Upstream patch release / GHSA metadata를 주기적으로 새로 조회하고 상태 변경 시 각 SHA, 패키지 버전, tarball integrity를 Ledger에 남긴다.
2. 실제 후보를 승인할 수 있으면 **독립 Security 실험 브랜치**에서 lockfile을 npm resolver로 생성하고 `npm ci` 및 설치 코드/원본 audit를 비교한다. `npm audit fix --force`나 타 트랙 파일 수정 금지.
3. 두 Advisory의 원인 코드가 모두 제거된 때에만 무예외 audit v2와 mutation guard 동시 교체. 그 전에 PR #1240 Draft/HOLD 및 #1208 OPEN.

## 7. BEJEWELY 독립 실행 검증 결과 — 2026-10-12

**실행 SHA:** `19ab597ec5ff0d1f8a874c31d7ddda7e696be1ad`. **보안 CI:** [#38228717035](https://github.com/gycha0109-beep/K_beauty/actions/runs/38228717035). 이 기록의 PASS는 **임시 복사본의 제한된 동작 검증**에 한정되며, 원래 Supply Chain 감사는 예외 만료로 의도대로 FAIL이다.

### 기존 설치 패키지의 실제 경계

- `node-forge@1.4.0`: 임시 RSA-2048 키로 정상 서명 수용/다른 메시지 서명 거부. 그러나 DigestAlgorithm 시퀀스의 비정상 추가 ASN.1 요소가 있는 서명은 수용. 실제 설치 코드의 parser gap을 확인한 것이며, 개인키 없는 외부 위조나 공격자 입력 도달을 입증한 것은 아니다.
- `braces@3.0.3`: 최대 500자 미만의 중첩 깊이 110 입력을 수용. stack-exhaustion이 아닌 낮은 부하의 경계 동작 관찰이다.

### 임시 패치 복사본 실험

- `node-forge`: `scripts/security/verify-node-forge-upstream-patch-isolation.mjs`가 설치된 1.4.0의 라이브러리를 OS 임시 폴더에 복사하고 upstream [PR #1152](https://github.com/digitalbazaar/forge/pull/1152) HEAD `ceba34402e329f0365134f23fe19898756527d65`의 검토된 `lib/rsa.js` 조건만 수정했다. 변경 전 비정상 ASN.1 요소 수용 → 변경 후 거부; 정상 RSA 검증과 다른 메시지 거부는 그대로다. 출력: `SCA_FORGE_PATCH_ISOLATION=ISOLATED_CANDIDATE_BEHAVIOR_PASS`.
- `braces`: `scripts/security/candidates/braces-pr72-library.patch.b64`에 upstream [PR #72](https://github.com/micromatch/braces/pull/72) HEAD `28d440b5dd449dbf1fe6f3506cf94ecca4d02660`의 라이브러리 5개 파일 diff를 손실 없이 고정했다. `verify-braces-upstream-patch-isolation.mjs`에서 임시 복사본에만 적용해 정상 glob 결과 동등, depth 110 parser 거부, depth 101 compile AST 거부, caller `maxDepth` 반영을 확인했다. 출력: `SCA_BRACES_PATCH_ISOLATION=ISOLATED_CANDIDATE_BEHAVIOR_PASS`.
- Unified diff의 context lines는 공백 1자 줄을 포함하므로 GitHub `git diff --check`와 충돌하지 않도록 Base64로 저장하고 임시 디렉터리에서만 복원한다. **실제 node_modules, package-lock, 감사 예외, baseline 또는 배포 설정은 변경하지 않았다.**

### 여전히 필요한 SCA-3 선행 조건

1. 공식 패치 release 또는 Security 검토를 마친 provenance/무결성 확보 배포본. 임시 패치 복사본은 배포 가능한 npm 패키지 승인이 아니다.
2. `braces`의 Expo/Metro watcher와 Tailwind/chokidar/fast-glob 경로 호환성·전체 upstream suite. `node-forge`의 Expo code-signing 및 인증서 생성·검증 정상/비정상 입력 호환성·전체 suite.
3. 모든 root/nested lock 경로, 실제 npm 설치·Android 빌드/실행, full/prod 원본 audit HIGH=0 증거.
4. 이후에만 만료 예외 제거 및 무예외 fail-closed 감사 v2/변형 검사 동시 전환. 그 전까지 **#1240 Draft/HOLD, #1208 OPEN**.

**주의:** 이 실험 PASS는 공식 CVE 해결·운영 패치·감사 PASS가 아니며, override/alias/advisory 은폐 또는 만료일 연장은 불허한다.

## 8. SCA-3 사전 통합 및 reviewed patch byte-pin

코드 기준 SHA `85bceaa09e788e6d507fba8e27380bc0ae18134a`; [Supply Chain CI #38330955980](https://github.com/gycha0109-beep/K_beauty/actions/runs/38330955980). 두 upstream 수정본은 **실제 원본 잠금 파일에 설치하지 않고 임시 디렉터리에만 적용**했다.

- Expo `@expo/code-signing-certificates@0.0.6`: 임시 node-forge 수정본을 require하도록 구성한 뒤 테스트용 self-signed 인증서 생성 → PEM 왕복 → 인증서/키 검증 → manifest SHA-256 서명을 수행.
- `micromatch@4.0.8`: 정상 glob·exclude/negation·brace expansion 비교; `fast-glob@3.3.3`: 샘플 파일을 대상으로 정상/부정 glob 비교.
- `@expo/metro-file-map@57.0.3`, `metro-file-map@0.84.5`, `metro-config/node_modules/metro-file-map@0.84.6`: 실제 설치된 파일맵 watcher helper 모듈을 임시 복사하고 patched `micromatch`를 사용하도록 resolve한 뒤 로딩 검증.
- `chokidar@3.6.0`: 실제 모듈을 임시 복사하고 patched `braces`를 resolve하는지 및 `watch` API 로딩 검증. **실제 watcher 파일 변경 이벤트, Android 번들·구동 검증은 아님.**
- 검토된 braces PR #72 라이브러리 diff는 디코딩 뒤 Git blob SHA-1 `b6aa05571a91ec9c6c4bc80ae7c6a26cb5db31af`와 일치해야 하며, 달라지면 검증 실패. 이 source-pinning은 *검토한 bytes에 대한 무결성 검사*이지 upstream 서명이나 배포 tarball의 SHA512 provenance가 아니다.

**결정:** SCA-3 사전 통합 smoke 근거 추가만 인정. 공식 채택 가능한 두 패치의 배포·무결성, Expo/Android 전체 회귀, 취약 코드를 모두 제거한 lock graph, 원본 audit 통과가 없으므로 **SCA-3 정식 설치/보수 HOLD, SCA-4~7 미착수**.
