# BEJEWELY 공급망 보안 차단 — 전체 해결 로드맵

> 기준일: 2026-10-12 (KST) · Track: `security` · Watchtower-Track: security
>
> **현재 결정: HOLD / 미해결. 이 문서는 실행·검증 계획이며 취약점 해결 승인서가 아니다.**
>
> 관련 이슈: [#1208](https://github.com/gycha0109-beep/K_beauty/issues/1208) ·
> Security 진단/보호 PR: [#1240](https://github.com/gycha0109-beep/K_beauty/pull/1240) (Draft/HOLD) ·
> 영향 PR: [#1232](https://github.com/gycha0109-beep/K_beauty/pull/1232), [#1233](https://github.com/gycha0109-beep/K_beauty/pull/1233) ·
> Dependabot 후보: [#1224](https://github.com/gycha0109-beep/K_beauty/pull/1224)
>
> 상세 구현 계약: [SEC-SCA 기술 설계](sec-sca-20261012-remediation-technical-design.md) ·
> 기존 정적 경로 추적: [SEC-SCA-P1](sec-sca-p1-advisory-lockfile-path-triage-20261010.md) ·
> **B안 자체 패치 전용 구현:** [B0~B7 자체 보안 패치 배포본 로드맵 (2026-10-13)](sec-sca-20261013-private-patch-distribution-roadmap.md)

## 0. 문서 권위와 변경 통제

- 실제 구현 판단은 **작업 시작 시 조회한 `origin/main`, 해당 보안 PR의 정확한 HEAD, 현재 `package.json` / `package-lock.json`, 현재 CI 정의·로그**를 우선한다. 이 문서의 SHA/버전/개수는 2026-10-12 증거 스냅샷이며 영구 상수가 아니다.
- 출처 분류: **확인 사실(F)** = 실제 저장소/CI/공식 Advisory에서 확인, **설계 결정(D)** = Security 트랙이 다음 작업에 적용할 제약, **검증 필요(H)** = 조사 가설. 검증 전 H를 F로 승격하지 않는다.
- `AGENTS.md`와 `.codex/AI_ROUTER.md`의 변경 통제 적용. DB/Auth/RLS/Storage/Payment/Provider/Production 구성 변경 없음. 패키지 대규모 변경이나 실제 배포는 별도 승인·검증 경계가 필요하다.
- 진단/문서 커밋은 해결 커밋이 아니다. 보안 PR을 Draft 상태로 유지하며, 정확한 취약점 제거와 CI 증명이 없으면 병합 금지.
- CI Watchtower용 브랜치·PR·커밋 메타데이터는 `security`. 기능 담당 트랙의 코드는 수정하지 않는다.

## 1. 현재 증거 기준선 (F)

| 항목 | 2026-10-12 확인 사실 | 해석 |
| --- | --- | --- |
| 작업 시작 최신 main | `396c4564da6de6180ffd99e75e280dfffd6a30c6` | 향후 실행 시 재조회 |
| 진단/보호 PR #1240 | `7316ce33997ef53d6bb6e701c3916d28ebcc6a10` 당시 HEAD, Draft | 취약점 수정 PR 아님 |
| 모바일 프레임워크 | `expo@57.0.21`, `@expo/cli@57.0.23`, `react-native@0.86.3` | 임의 메이저 다운그레이드 금지 |
| 잠긴 원인 패키지 | `braces@3.0.3`, `node-forge@1.4.0` | 둘 다 root lockfile 설치 경로 존재 |
| braces | `GHSA-vfj7-8cjw-p6xm`, 영향 `<=3.0.3`, 공식 patched versions: None | 스택 고갈 DoS; 예외 2026-10-10 UTC 만료 |
| node-forge | `GHSA-86w9-cpqp-85rv`, 영향 `<=1.4.0`, 공식 patched versions: None | RSA PKCS#1 v1.5 서명 검증 결함; 예외 2026-10-16 UTC 만료 예정 |
| 잠금 그래프 | 653개 reachable package, unresolved edge 0 | **설치 그래프** 증거; 공격 입력 도달성/번들 포함 증거가 아님 |
| production audit | moderate 11, high **19**, critical 0, total 30 | 전이 전파된 package-level 집계; 19개의 별개 CVE 아님 |
| full audit | moderate 13, high **22**, critical 0, total 35 | `--omit=dev`와 별도 보존 |
| #1224 | 업데이트 후보 lock에도 두 취약 버전 존재 | 보안 해결책 아님 |
| #1240 보안 CI | `npm ci`, 정적 tracer, 9개 policy mutation, CodeQL PASS / canonical audit FAIL | 실패는 만료 예외에 따른 정당한 차단 |
| #1240 기타 CI | Current Main Health, PIE PASS | Security Boundary·mobile typecheck·Android는 이 HEAD에서 독립 확인하지 않음 |

증거: [Supply Chain CI #38219770356](https://github.com/gycha0109-beep/K_beauty/actions/runs/38219770356),
[Main Health #38219770333](https://github.com/gycha0109-beep/K_beauty/actions/runs/38219770333),
[PIE #38219770988](https://github.com/gycha0109-beep/K_beauty/actions/runs/38219770988),
[Advisory braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm),
[Advisory node-forge](https://github.com/advisories/GHSA-86w9-cpqp-85rv).

대표 경로:

```text
apps/mobile
└─ expo@57.0.21
   └─ @expo/cli@57.0.23
      ├─ @expo/metro-file-map@57.0.3
      │  └─ micromatch@4.0.8
      │     └─ braces@3.0.3
      └─ node-forge@1.4.0
```

또한 Metro의 별도 `metro-file-map` / 중첩 설치 경로, 개발 도구 `chokidar` / `fast-glob` / `tailwindcss` 경로도 조사 대상이다. 하나의 `@expo/metro-file-map` edge 제거만으로 전체 `braces` 해결을 선언하지 않는다.

## 2. 목표와 비목표 (D)

**유일한 종료 목표:** 두 Advisory의 실제 취약 코드를 검증된 방식으로 제거/교체하고, 잠금 파일·설치 파일·필요한 번들/Android 경로와 공급망 검사를 모두 통과한 **정확한 보안 PR HEAD**의 증거로 #1208을 종료한다.

비목표: Expo 전면 현대화 자체, 기능 변경, taxonomy/Face Lab 수정, 운영 DB/스토리지/권한/배포 변경, 사전 승인 없는 npm 정책 예외의 갱신. 개발 전용/런타임 비노출 판단은 **위험도 보조 자료**이며 보안 패치 완료 증거가 아니다.

### 변경 불변식

1. **보안 강도 유지:** `npm audit` 전체와 `--omit=dev` 둘 다 실행, 고위험/치명적 기준은 원칙적으로 0, 기존 moderate baseline을 높이지 않음.
2. **예외는 연장하지 않음:** 만료일 연장, 새 allowlist, `continue-on-error`, workflow 비활성화, 임의 `npm overrides`, 패키지 이름/감사만 속이는 변경 금지.
3. **근거 분리:** 설치 그래프 ≠ 함수 호출 ≠ 공격자 입력 도달 ≠ APK 포함 ≠ 취약 코드 제거 ≠ CI 통과.
4. **출처 무결성:** 제3자 포크는 소스·패치·라이선스·재현 빌드·해시·유지보수 소유권 확인 전 채택하지 않음.
5. **검증 정확성:** 모든 PASS는 저장소, SHA, 실행 명령, 로그 링크, 날짜를 가져야 함. 개별 PASS로 전체 보안 PASS를 주장하지 않음.
6. **분리 소유:** Security만 의존성/보안 검사 담당; #1232 taxonomy-ai와 #1233 face-research의 기능 파일 침범 금지.

## 3. 실행 단계 로드맵

| 단계 | 주요 작업 | 증거/산출물 | 통과 및 다음 단계 조건 |
| --- | --- | --- | --- |
| SCA-0 현황 고정 | 최신 main·관련 PR HEAD·CI·lock·Advisory·외부 패키지 스냅샷 | source/SHA/Advisory 기록, 전체/production 감사 원본 | 현재 입력이 동결되고 원본 오류 재현; **현 단계 기본 HOLD** |
| SCA-1 공격면/의존성 지도 | 모든 `braces`·`node-forge` 경로, 호출 지점, 입력 소유자, 도구/번들 경계 조사 | package path + 코드 호출표 + reachability ledger | 두 패키지 각각의 경로가 누락 없이 설명됨; 추측은 unknown 유지 |
| SCA-2 후보 발굴 | 공식 패치 → 호환 상위 패키지 → 안전한 제거/대체 → 검증된 포크 순차 검토 | 후보별 패키지 버전·release·dependency diff·신뢰도 | **두 Advisory를 동시에 제거할 가능성이 있는** 실험 후보 선택, 없으면 HOLD |
| SCA-3 격리 호환성 실험 | 독립 worktree/브랜치에만 의존성 변경, 정상 `npm install --package-lock-only` / `npm ci` 및 Expo/RN 검증 | candidate lockfile, `npm ls`, 전체·prod audit, Metro/Android 결과 | 취약 버전·동등 취약 코드 제거가 증명되고 모바일 기능 보존; 아니면 롤백·HOLD |
| SCA-4 정식 보수 PR | 최소 의존성·잠금 변경, 원인 패키지 제거/교체, 필요 시 패치 provenance와 테스트 | security 브랜치 diff/commit/실행 증거 | 새 high/critical 0, lock 정합성·번들·구동 검증; 미달 시 Draft |
| SCA-5 감사 정책 전환 | **해결 후에만** 임시 예외 의존 검사를 무예외 강제 검사로 교체; mutation guard도 v2로 전환 | 제거된 예외, baseline 유지 증거, fail-closed 테스트 | 실제 취약점 없음 + 원시 감사 PASS + 새 취약점 주입 시 FAIL 증명 |
| SCA-6 정확 HEAD CI | Supply Chain, CodeQL, Main Health, Security Boundary, 모바일 Typecheck/Foundation/Native/Android | 각 CI run, checked-out SHA, regression matrix | 필수 검사 모두 정상. 하나라도 실패/미실행이면 보안 종료 금지 |
| SCA-7 종료·다른 트랙 인계 | 보안 PR 리뷰·승인, 별도 merge 결정, #1208 closeout, #1232/#1233 동기화 순서 안내 | 전/후 lock ledger, PR/Issue, downstream CI | **정확한 main 반영 확인 후** 종료. 기능 트랙 병합은 각 트랙의 별도 결정 |

위 단계는 수행 순서를 뜻하며 달력 일정이나 성공을 약속하지 않는다. SCA-1/2에서 안전한 후보가 없으면 SCA-3~7을 강행하지 않는다.

## 4. 분기/결정 게이트

```text
최신 HEAD·Advisory 재조회
  │
  ├─ 공식 패치(두 패키지 각각)? ── YES ─┐
  │                                     │
  └─ NO → 호환 상위 그래프에서 제거? ─ YES ┤
           │                             │
           └─ NO → 안전 대체/포크 검토? ─ YES ┤
                    │                     ▼
                    └─ NO → HOLD    격리 lockfile + 호출/번들/빌드 검증
                                             │
                                    ┌────────┴────────┐
                                    │                 │
                                  PASS              FAIL/UNKNOWN
                                    │                 │
                            실제 보수 + audit v2     HOLD
                                    │
                              정확 HEAD CI
                                    │
                              전체 PASS만 리뷰
```

**후보 A — 공식 업그레이드:** 가장 낮은 유지보수 비용. 버전 범위/호환성/lock 전후 그래프와 실제 빌드를 확인한다.

**후보 B — `micromatch` 의존 제거:** Expo upstream `@expo/metro-file-map@58.0.4`는 자기 경로의 `micromatch → braces` 제거를 changelog에 명시한다. 그러나 현재 Expo 57/RN 0.86.3과 호환되거나 다른 Metro/Root dev 경로까지 해결한다는 보장은 없음. **부분 후보**로만 취급한다.

**후보 C — `node-forge` 사용 지점 제거/교체:** Expo CLI 서명/인증서 처리의 호출 지점을 검토한다. 단순히 개발 CLI니까 안전하다고 가정하지 않는다. RSA 검증 및 인증서 파싱 관련 회귀·기능 손실 확인 필수.

**후보 D — 보안 검토된 수정 배포본:** upstream 소스와 patch diff, 취약 입력에 대한 negative proof, 검증된 아카이브 및 무결성, CI/실사용 호환성 확보가 필요. **원본 취약 버전이 여전히 `npm audit`에 노출되면 통과로 처리하지 않으며**, 스캐너 우회로 해결을 가장하지 않는다.

**불허 후보:** `npm audit fix --force` 제시 downgrade(예: Expo 44/RN 0.72), 검증 없는 `overrides`, 만료일 연장, advisory 숨김 또는 baseline 확대.

## 5. CI·품질 검증 의무

### 기본 재현 순서

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm ls braces node-forge micromatch --all
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

명령은 현재 `package.json`/모바일 package scripts에서 재확인한다. `npm audit --json`은 취약점이 있으면 비영(非零) 종료 가능하므로 **출력·종료 코드 둘 다 기록하고 오류를 성공으로 변환하지 않는다**. `npm ci --ignore-scripts`는 안전한 잠금 파일 검사이고, 네이티브 후속 빌드용 lifecycle/scripts 검증을 대신하지 않는다.

Android 네이티브 빌드는 격리된 작업 환경에서 적절한 SDK/JDK와 정상 설치를 갖춘 뒤 `npm run mobile:prebuild:android` 및 `npm run mobile:build:android:debug`를 실행한다. `prebuild --clean`은 생성된 네이티브 작업물을 바꾸므로 **깨끗한 격리 workspace에서만** 수행한다. APK 생성만으로 취약점 제거가 검증되지는 않는다.

### GitHub Actions 정확 HEAD 수락 매트릭스

| 독립 검사 | 수락 근거 | 현재 판정 |
| --- | --- | --- |
| `BEJEWELY Supply Chain Security` / Package integrity | 잠금 설치 + 경로 검증 + 전체/production 원본 audit 및 fail-closed | FAIL / HOLD |
| 동일 workflow / CodeQL JS/TS | 정확 HEAD 분석 성공, 신규 blocker 없음 | #1240 시점 PASS (향후 재실행) |
| `BEJEWELY Current Main Health` | 정확 HEAD canonical runtime 검증 | #1240 시점 PASS (향후 재실행) |
| `BEJEWELY Security Boundary` | 권한/데이터·API 경계 회귀 | #1240 최종 HEAD 별도 미검증 |
| 모바일 관련 CI / scripts | Typecheck, foundation, native/Android, Expo bundling | #1240 최종 HEAD 별도 미검증 |
| Git diff / lock consistency | `git diff --check`, `npm ci`, 불필요한 의존성 증분 없음 | 최종 보수 diff 필요 |

`workflow_dispatch`를 사용할 경우 사용 가능한 `watchtower_track=security`를 전달하고, **수동 실행 SHA가 실제 후보 SHA인지** 확인한다. 문서 파일만 추가했거나 paths filter가 skip한 실행을 CI PASS로 간주하지 않는다.

## 6. 트랙·병합 책임

- **security:** #1208 보안 사실과 의존성 대안, lock/CI 보수, 감사 정책 v2, SCA 검증, 보안 PR 리뷰.
- **taxonomy-ai:** #1232 DB 마이그레이션 진단 및 관련 own CI. Security 오너가 기능 코드를 손대지 않음.
- **face-research:** #1233 Face Lab 상품 연결 및 own CI. Security 오너가 기능 코드를 손대지 않음.
- **Watchtower:** CI 귀속 메타데이터 기록만. `PASS`를 재판정하거나 실패 gate를 중복·대체하지 않음.
- **기존 CI 책임 맵과의 차이:** `docs/ci/workflow-responsibility-map.md`의 2026-10-12 canonical Track Key 열거에는 `security`가 없다. 이 이관문의 명시적 `Watchtower-Track: security` 요구와 불일치하므로, Watchtower 운영 오너에게 **별도의 귀속 정책 확인/키 등록 판단**이 필요하다. 이 보수 작업에서 공유 CI 책임 맵·워크플로를 임의로 재분류하거나 신규 CI를 만들지 않는다.
- **병합 순서:** Security PR의 실제 취약점 해결 + 전체 승인 → main 반영 확인 → #1232/#1233 각각 최신 main 동기화 → 각 PR 최종 HEAD의 소유 검증과 공용 Security CI 재실행 → 각각 별도 병합 판단. #1240의 진단 보호 PASS는 선행 Security fix가 아님.

## 7. HOLD 및 에스컬레이션

즉시 HOLD 조건: 공식 수정 없음, 업스트림 호환 불명, 공격 경로 unknown, 설치·번들 내 취약 코드 잔존, npm audit HIGH/CRITICAL 존재, 신규 high/critical 유입, 체크 건너뜀, Android 핵심 동작 회귀, 서명 검증 경계 불명, code signing 동작 영향, 근거 없는 fork/override.

HOLD 보고/Issue에는 **(1) 당시 main/PR HEAD, (2) advisory/locked versions, (3) 후보/실패 이유, (4) 실행 명령/로그, (5) 미확인 사실, (6) 필요한 결정권자·승인, (7) 다음 안전 실험**을 기록한다. 위험 수용은 보안 검사의 통과를 대체하지 않는다. 새 취약점을 숨겨 정상 CI인 척 만들지 않는다.

## 8. 종료 체크리스트

- [ ] 두 Advisory 각각의 실제 코드 수정/제거·공급망 출처·해시 증거
- [ ] 모든 lockfile 경로/중첩 복제/번들 복제 및 공격 입력 도달성 검증 기록
- [ ] Full + production raw `npm audit`: 원인 Advisory 고위험 판정 제거, high/critical 0, moderate baseline 악화 없음
- [ ] 예외 제거 **이후** 정책 테스트를 무예외 불변식으로 전환 (마감된 예외 연장 없음)
- [ ] `npm ci` / lock 정합성 / npm tree / 무결성 증거
- [ ] Expo/React Native 호환성 + 모바일 Typecheck/Foundation/Native/Android 회귀
- [ ] Supply Chain + CodeQL + Current Main Health + Security Boundary 정확 HEAD 검증
- [ ] 보안 PR 승인·병합과 최신 main 확인
- [ ] #1208 evidence closeout 및 #1232/#1233 재검증·인계

**위 전체 항목이 확인될 때만 `RESOLVED`를 쓴다. 그 전에는 `HOLD`다.**
