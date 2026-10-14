# SEC-SCA B3 — 자체 보안 패치 패키지 재현·재설치 검증 (2026-10-14)

> **판정: 격리 패키징/재설치/취약 입력 테스트 PASS · 정식 배포 승인 HOLD.** Track: security / Watchtower-Track: security.
>
> [전체 B0–B7 로드맵](sec-sca-20261013-private-patch-distribution-roadmap.md) · [B3 Draft PR #1282](https://github.com/gycha0109-beep/K_beauty/pull/1282) · [B1 #1270](https://github.com/gycha0109-beep/K_beauty/pull/1270) · [B2 #1271](https://github.com/gycha0109-beep/K_beauty/pull/1271).

## 1. 구현된 경계

- 기존 npm lock 원본과 B1/B2의 업스트림 소스 SHA·패치 파일 무결성을 확인한 뒤 **운영 코드가 아닌 OS 임시 디렉터리에서만** braces 3.0.3과 node-forge 1.4.0의 수정 소스를 생성.
- 각 패키지를 독립적으로 두 번 npm pack. 파일 경로 목록 및 **전체 tarball SHA-512 바이트가 서로 동일**한지 검사. 원본 라이선스 파일을 보존하고, LICENSE 누락 시 실패.
- 생성된 tarball 2개를 별도 임시 npm 프로젝트에 직접 설치하고 **실제 설치본**의 수정 소스 SHA-256을 검토된 값과 대조.
- 실제 설치본에 대해 정상/과도 중첩 braces parser·AST, forge 정상/비정상 RSA PKCS#1 v1.5 DigestInfo, Expo self-signed code-signing/PEM fixture 재실행.
- node-forge 공식 배포본에는 별도의 브라우저 dist 파일 6개가 있음. 현재는 검증·재빌드되지 않아 테스트용 tarball에서 **의도적으로 제외**. 따라서 패키징 PASS가 곧 브라우저 호환성·릴리스 승인 아님.
- 원본 root package.json/package-lock.json 및 앱의 Expo 의존성, npm audit 정책/CI 감사 예외, 배포·DB·Auth·Payment·Production은 변경하지 않음.

## 2. 실제 검증 증거

[Security CI #38492443214](https://github.com/gycha0109-beep/K_beauty/actions/runs/38492443214), 검증 시 코드 HEAD 44a99440d92b5194bc55a9fa206f7cf6956bd410.

| 대상 | 시험 tarball SHA-256 | 파일 수 | 재현성 | 실제 재설치·보안 입력 |
| --- | --- | ---: | --- | --- |
| braces@3.0.3 수정본 | d4f1219db19bfeb4e1c3f0354f9269569393f1b8c9f8c0295b80346926d4fa70 | 10 | PASS | PASS |
| node-forge@1.4.0 수정본 (browser dist 미포함) | f5af92704b318c91f426e5c30aeb833cea443cdbb79145093eb9c6bbead986ed | 51 | PASS | PASS |

- braces 테스트 tarball SHA-512: sha512-VJc9xsVPUMkE4+y8i4KhDtDZx5ypP8nDElPwDH+jhFpCJpkSrFGL78JUMyQfcn5KFoTEK38DluBkFJKvXkZmGw==.
- forge 테스트 tarball SHA-512: sha512-LKwC1DMszVYgnGxofEn2+5aAaGQ3chAusgx1mtTK+lEgCSMon8cSuUWoZckSdLJk12bi7aqncw6LGcjvBtr9ZA==.
- 독립 두 번 npm pack의 tarball 바이트 일치 PASS, installedTarballSecurityFixturePass=true (두 패키지), originalManifestAndLockUnchanged=true.
- 같은 실행의 **필수 canonical npm audit는 GHSA-vfj7-8cjw-p6xm 임시예외 2026-10-10 만료로 FAIL**. 두 원본 취약 버전은 아직 앱 lock에 설치되어 있어 올바른 fail-closed 결과.
- 임시 tarball은 테스트 후 삭제됨. 배포 가능한 아티팩트, 업로드 URL 또는 승인된 자체 릴리스는 없음.

## 3. 다음 단계·차단 조건

| 단계 | 현재 | 다음 실행 조건 |
| --- | --- | --- |
| B1 | 904개 upstream suite PASS, 원본 source integrity PASS | 라이선스/오너/보안 reviewer 승인 |
| B2 | 829 PASS/4 pending suite, RSA+Expo fixture 및 원본 tarball integrity PASS | **브라우저 dist 6개를 패치된 source로 재빌드·검증**, license/notice 및 유지보수 오너 |
| B3 | 임시 패키징 x2 / 재설치 / 보안 회귀 PASS | 완전한 배포본 아티팩트·출처/재현성·라이선스·Security 승인. 현재 **HOLD** |
| B4 | NOT_STARTED | 두 완전한 후보 승인 후에만 임시 root/nested lock 재결의·installed fingerprint·raw npm audit full/prod HIGH 0 |
| B5~7 | BLOCKED | patched Android APK/기기/정확 HEAD CI, 감사 정책 v2, 사용자 병합 승인 |

**불변:** 이름/버전을 바꾸어 npm audit가 GHSA를 인식하지 못하게 하는 것만으로 PASS 처리 금지. 실제 취약 코드 교체, raw audit 전체/production HIGH 0, 설치 출처 검증, Android 수락 모두 별도 AND 게이트이다. #1270/#1271/#1282 Draft/HOLD, #1208 OPEN. 
