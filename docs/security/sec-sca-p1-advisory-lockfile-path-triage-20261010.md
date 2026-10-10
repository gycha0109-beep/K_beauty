# SEC-SCA-P1 — 만료된 의존성 보안 예외 원인 경로 추적 (2026-10-10)

**상태:** `LOCKFILE_REACHABILITY_TRIAGE_ONLY` — **취약점 해결 아님, 보안 PASS 아님, 운영 승인 아님**.

## 배경

현재 `.github/workflows/supply-chain-security.yml`은 `npm ci --ignore-scripts --no-audit --no-fund` 후 `node scripts/verify-supply-chain-audit.mjs`를 실행하며, 기존 예외 `GHSA-vfj7-8cjw-p6xm`의 만료 `2026-10-10T00:00:00Z`로 **실패**하고 있다. 이 실패는 R16I-D1 상품 변경과 관계없으며 유효한 보안 차단이다.

GitHub Advisory Database의 2026-10-10 조회 결과:

| 보안 권고 | 패키지 | 잠금 버전 | 공식 수정 배포 | 기존 예외 |
|---|---|---|---|---|
| [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) | `braces` | 3.0.3 | 없음 (`<=3.0.3` 취약) | 2026-10-10 UTC **만료** |
| [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv) | `node-forge` | 1.4.0 | 없음 (`<=1.4.0` 취약) | 2026-10-16 UTC **만료 예정** |

**패치가 없으므로** `npm audit fix`만으로 해결된다고 가정하거나, `overrides`로 아무 대체 버전이나 쓰지 않는다. 자체 포크/패치도 공급 출처·무결성·취약 코드 검증 없이 승인되지 않는다.

## 이번 구현

- `lib/supply-chain-lock-path-tracer.mjs`: root/workspace/nested `node_modules`의 `dependencies` / `optionalDependencies` 경로를 해석해 잠금 파일에 실재하는 `braces`, `node-forge` 버전과 해당 설치 경로까지의 대표 의존성 체인을 출력한다. 미해결 edge도 표시한다.
- `scripts/security/verify-supply-chain-lock-path-tracer.mjs`: 가상 lockfile로 중첩 패키지/루트·워크스페이스 경로, 설치됐지만 도달되지 않는 항목, 가정상 향후 신규 버전, 누락된 연결, 불량 lockfile 시나리오 검증.
- `scripts/security/report-supply-chain-lock-paths.mjs`: 실제 `package-lock.json`으로 읽기 전용 보고서를 stdout에 기록한다.
- **기존 보안 workflow에 1단계만 추가**: 취약점 감사 **직전** 해당 테스트 및 진단 실행. `verify-supply-chain-audit.mjs` 원래 스크립트·예외 날짜·허용 버전·취약점 집합·차단 기준은 **변경하지 않음**.

## 출력 해석 주의

- `knownAffectedReachable=true`는 **정적 npm dependency edge를 통해 취약 버전이 설치됨**을 의미할 뿐, 신뢰할 수 없는 요청이 실제 해당 함수까지 도달한다는 동적 익스플로잇 증명은 아니다.
- `knownAffectedReachable=false`, `NOT_INSTALLED_IN_LOCK_REQUIRES_AUDIT`, `NO_KNOWN_AFFECTED_VERSION_DETECTED_REQUIRES_AUDIT`도 **면제/보안 PASS를 뜻하지 않는다**. 최종 판정은 독립된 `npm audit` 및 정책 담당자에게만 있다.
- npm lockfile의 패키지 의존성을 모델링한 것으로, 번들러 런타임 또는 서버 HTTP 요청면을 정적으로 완전히 추론하지 않는다.
- optional/플랫폼/peer/동적 로딩으로 실제 연결이 다를 수 있으므로 **unresolved dependency edge와 전체 빌드 실행/런타임 검증**을 운영자에게 별도로 요구한다.
- 두 보안 예외의 만료일을 뒤로 미루거나 감사 리포트에서 제외하지 않는다.

## 후속 보안 오너 조치

1. CI 로그의 예시 의존 체인과 `npm ls braces node-forge micromatch --all`를 비교해 설치/호출 경로를 확정한다.
2. 설치 경로가 Expo·Metro 번들러/코드서명 처리와 관련된 경우 **Android/웹 빌드 및 Expo 실행**까지 검사한다. 임의 전이 override 금지.
3. upstream 안전 대체 경로, 패치 release 혹은 검증된 자체 패치의 출처·무결성·정확한 기능 경계·코드 변경을 security owner가 검토한다.
4. 실제 문제가 해소될 때까지 **Supply Chain Security FAIL을 유지한다**. 품질 검사에서 녹색인 별도 작업과 보안 검사를 동일시하지 않는다.
5. 보안 해결 후 taxonomy-ai PR #1211, #1214의 정확 HEAD CI 재검증 후 별도 병합을 판단한다.

**Production 쓰기: 0건.** 신규 GitHub workflow: 0건. 기존 공급망 감사 bypass: 0건.

Watchtower-Track: security
