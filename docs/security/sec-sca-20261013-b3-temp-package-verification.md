# SEC-SCA B3 — 자체 패치 패키지 임시 재현·설치 검증 (2026-10-13)

> Track: `security` · Watchtower-Track: security · 상태: **B3 격리 패키징/물리 설치 PASS / B3 정식 배포 승인 HOLD**
>
> 관련 PR: [B1 #1270](https://github.com/gycha0109-beep/K_beauty/pull/1270) · [B2 #1271](https://github.com/gycha0109-beep/K_beauty/pull/1271) · [B3 #1281](https://github.com/gycha0109-beep/K_beauty/pull/1281) · [이슈 #1208](https://github.com/gycha0109-beep/K_beauty/issues/1208)
>
> [B안 실행 로드맵](https://github.com/gycha0109-beep/K_beauty/blob/fix/security/sca-b1-private-braces-candidate-20261013/docs/security/sec-sca-20261013-private-patch-distribution-roadmap.md)
>
> 이 문서는 **임시 코드 복제본·npm 설치 실험의 증거**일 뿐, 공식 보안 수정 릴리스·감사 PASS·실제 BEJEWELY 설치 승인·APK 검증이 아니다.

## 1. 실험 경계 및 입력

- 구현 브랜치: `fix/security/sca-b3-temporary-package-integrity-20261013`; main 기점 `753c4739dc169b372de09cb64b6a1b371e03c7c7` (실행 전에 항상 최신 HEAD 재조회).
- `scripts/security/verify-private-patch-package-integrity.mjs`는 기존 루트 `npm ci --ignore-scripts` 설치본에서 이전의 source-pinned materializer 두 개를 호출한다. 실제 루트 `package.json`, `package-lock.json`, `apps/mobile/package.json`, `node_modules`를 교체하지 않는다.
- **braces**: 원본 3.0.3의 정상 npm pack tarball SHA-512 고정; 업스트림 PR #72 (`28d440b5dd449dbf1fe6f3506cf94ecca4d02660`)에서 확인한 파서·walker 5개 소스 변경 + 추가 고정된 quote/comma 동작 일치. [B1 전체 upstream 904 PASS](https://github.com/gycha0109-beep/K_beauty/actions/runs/38356625466).
- **node-forge**: 원본 1.4.0의 npm tarball SHA-512 고정; 업스트림 PR #1152 (`ceba34402e329f0365134f23fe19898756527d65`)에 일치하는 `lib/rsa.js`만 수정. [B2 전체 Node suite 829 PASS·4 pending](https://github.com/gycha0109-beep/K_beauty/actions/runs/38356973781). 메모리 테스트 키만 사용하고 운영 키는 사용하지 않는다.
- `node-forge`는 원본 `LICENSE`를 바이트 그대로 복사한다. **원본 npm 패키지의 `dist/` browser bundle 6개는 수정/재생성하지 않았으므로 실험 패키지에 포함하지 않으며, 모든 브라우저 사용성은 UNKNOWN으로 유지**한다.
- 최초·두 번째 패키징은 독립 OS 임시 소스 디렉터리에서 진행하며, 실행 후 `.tgz`는 모두 삭제된다. Registry 발행, 출처 불명 fork/alias, npm overrides, 배포, credential 변경 없음.

## 2. 실제 CI 증거

[Supply Chain run #38357768269](https://github.com/gycha0109-beep/K_beauty/actions/runs/38357768269) — 코드 HEAD `fc98935e74b4788b3394cdf0db6255cfaf322a0f`:

| 단계 | 검증 결과 |
| --- | --- |
| 원본 npm 잠금 버전·SHA / 업스트림 패치 적용 | PASS |
| `braces` 임시 `npm pack` 2회, archive path 및 소스 파일 검사 | **PASS** — 파일 10개, 수정 라이브러리 5개 SHA256 일치 |
| `node-forge` 임시 `npm pack` 2회, 원본 LICENSE/수정 소스 검증 | **PASS** — 파일 51개, `lib/rsa.js` SHA256 일치, browser dist 0개 포함 |
| 동일 패키지 별도 재생성 후 SHA256/SHA512 동일성 | **PASS** — 두 패키지 모두 byte-exact 일치 |
| 임시 소비자 프로젝트에 두 실제 tarball `npm install` | **PASS** — 실제 설치된 패치 소스 6개와 검토 SHA 일치 |
| 실제 설치본의 braces 정상 expansion / 중첩 depth 차단 | PASS |
| 실제 설치본의 node-forge 정상 RSA-SHA256 서명 검증 | PASS |
| 원본 앱 root manifest/lock 무변경 | PASS |
| 정식 `npm audit` 원본 HIGH 0 | **FAIL (기존 취약 원본 lock 및 만료 예외)** |
| patched `node-forge` browser dist 재빌드·검증 | NOT_RUN |
| 실제 비주얼리 lock 교체·Expo/Android APK·실기기 검사 | NOT_RUN |

**SHA-256 (실험에서 실제 얻은 바이트)**

| 독립 임시 아티팩트 | SHA-256 |
| --- | --- |
| `braces-3.0.3.tgz` (수정 코드, **출시 불가**) | `d4f1219db19bfeb4e1c3f0354f9269569393f1b8c9f8c0295b80346926d4fa70` |
| `node-forge-1.4.0.tgz` (source-only, **출시 불가**) | `f5af92704b318c91f426e5c30aeb833cea443cdbb79145093eb9c6bbead986ed` |

이 이름은 **실험상 원본 이름과 버전을 유지한 임시 tarball**을 가리키며 공식 수정 버전·안전한 npm registry 배포를 뜻하지 않는다. 해당 파일은 GitHub Actions artifact로 업로드·공유하지 않았고 종료 시 삭제했다.

## 3. 승인 차단과 다음 개발 계약

1. **B3 출시 경계:** 현재 `node-forge` 원본 6개 browser dist 파일이 누락되어 있으므로 보안 패치가 된 범용 `node-forge` 패키지로 채택할 수 없다. 최소 재현 빌드/실제 브라우저 소비자 호환성 확인 또는 검증된 Node-only 대체 경로에 대한 명시적 소유 승인 필요.
2. **출처/라이선스/책임:** 원본 LICENSE 파일을 복제한 사실과 법적 배포 허가 검토/소유자 승인·registry 인증·정식 release provenance는 별개다. 현재 security owner approval UNKNOWN.
3. **B4 진입 전제:** 두 패키지의 실제 배포 승인, 명시적 설치 출처·무결성 고정, 정상 npm resolver로 전체 root/nested lock 교체, 설치 파일 fingerprint, **원본 full+production audit HIGH/CRITICAL 0** 및 scanner blind spot 별도 검사.
4. **B5~B7:** Expo·Metro/Android 실제 APK·기기, 보안 정책 v2 + CI·CodeQL·Main Health·병합 승인 없이는 해결 선언 불가.
5. **배포/롤백:** 진단용 tarball은 실제 운영 의존성으로 배포하지 않는다. 승인되지 않은 포크/alias로 npm audit에서 Advisory가 사라진 것만으로 완료 처리하지 않는다.

**최종 판정:** B1·B2 전체 단위 테스트와 B3 격리 포장·실제 소비자 설치는 **검증 PASS**. 하지만 **B3 RELEASE HOLD / B4~B7 NOT_STARTED / GHSA 두 건 미해결 / #1281 Draft**를 유지한다.
