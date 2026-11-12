# SEC-SCA B2 — node-forge RSA DigestInfo 격리 보수 실행 기록 (2026-10-13)

> Track: security · [B0~B7 B안 로드맵](https://github.com/gycha0109-beep/K_beauty/blob/fix/security/sca-b1-private-braces-candidate-20261013/docs/security/sec-sca-20261013-private-patch-distribution-roadmap.md) · [B1 #1270](https://github.com/gycha0109-beep/K_beauty/pull/1270) · [B2 #1271](https://github.com/gycha0109-beep/K_beauty/pull/1271) · [Issue #1208](https://github.com/gycha0109-beep/K_beauty/issues/1208)
>
> **상태: B2 source patch / Expo consumer / original registry integrity preflight PASS; 전체 B2 승인 HOLD.**

## 1. 경계·출처

- 독립 B2 브랜치 `fix/security/sca-b2-private-forge-candidate-20261013`, main 기점 `812e39d995c0131212b3fb9fbef7dc2e415c0ecc`. B1 보수 브랜치 및 기존 보안 진단 PR #1240과는 독립.
- 기존 root lock의 `node-forge@1.4.0` 및 원본 npm SHA512 `sha512-LarFH0+6VfriEhqMMcLX2F7SwSXeWwnEAJEsYm5QKWchiVYVvJyV9v7UDvUv+w5HO23ZpQTXDv/GxdDdMyOuoQ==` 고정.
- [digitalbazaar/forge PR #1152](https://github.com/digitalbazaar/forge/pull/1152) HEAD `ceba34402e329f0365134f23fe19898756527d65`, **OPEN/UNMERGED**. 적용되는 **정확한 수정 완료** `lib/rsa.js`의 Git blob SHA-1 `43090545115be1b1ffc484a2a27ecf31f840437e` 검증.
- 초기 `lib/rsa.js` 해시가 upstream 파일과 달라 FAIL: 변경 주석 누락이 원인이었으며 주석까지 포함한 전체 diff 적용 후 **원본 upstream SHA와 바이트 일치 PASS**. 검사 강도는 낮추지 않았음.

## 2. 구현

- `security/vendor/node-forge/source-manifest.json`: 원본 registry/lock SHA-512, upstream SHA/파일 blob, 미완료 승격 조건(false) 및 증거.
- `scripts/security/materialize-private-forge-source.mjs`: canonical npm-ci 설치 `lib/` 복제 → 하나의 `lib/rsa.js`만 변경 → 설치 원본 무변경, 다른 파일 변경 없음을 SHA256 비교 → patched file upstream Git blob SHA-1 완전 일치 확인. **브라우저 dist 복사/재빌드 안 함**.
- `scripts/security/verify-private-forge-probe-child.mjs`: 메모리 내 테스트 RSA-2048 키로 정상 SHA-256 RSA 검증, 잘못된 메시지 거부, extra ASN.1 nested DigestAlgorithm child 수용 원본과 거부 수정본 비교. Expo signing 0.0.6 self-signed/PEM/manifest 및 wrong key/expired cert 거부. 운영 키 사용 없음.
- `scripts/security/verify-private-forge-source-candidate.mjs`: 폐쇄된 temp module resolution 환경에서 **실제 Expo code signing 패키지가 수정된 forge를 사용한다는 것**을 검사하고 독립 child 45초 제한.
- `scripts/security/verify-private-forge-registry-origin.mjs`: registry npm pack 원본 tgz가 canonical lock SHA-512와 일치하고 필수 파일과 안전한 아카이브 경로인지 확인. `dist/` 엔트리도 세어 출시 검증 범위에서 누락하지 않음.
- 기존 Supply Chain workflow의 원래 audit 앞에 B2 두 테스트 호출을 추가. **원본 npm audit·lock·원본 설치·보안 예외 변경 없음**.

## 3. 실행 CI 증거

- 최초 CI `#38350563993` 실패: source full blob hash 불일치 → upstream 주석 패치 보수.
- [보수 후 #38350715351](https://github.com/gycha0109-beep/K_beauty/actions/runs/38350715351): `SCA_B2_PRIVATE_FORGE_CANDIDATE=...PASS_NOT_A_RELEASE_OR_VULNERABILITY_REMEDIATION`, upstream Git blob 완전 일치, Expo 정상/비정상 서명 및 RSA 게이트 PASS. **원본 감사 만료 braces 예외 때문에 FAIL 유지**.
- [원본 tarball 확인 #38350884697](https://github.com/gycha0109-beep/K_beauty/actions/runs/38350884697): `npm pack node-forge@1.4.0` 원본 SHA512 일치 PASS, 59개 파일 경로, **dist 6개 항목 존재**. source regression PASS. 같은 HEAD의 Main Health는 **검사 스크립트 41행 trailing whitespace 때문에 FAIL**했으므로 이를 `2f39d96ff5e42cdadebc1850c8244f9745a31f9b`에서 보수 후 재실행.
- 원본 package.json/package-lock.json, npm node_modules 및 기타 protected files 변경 없음.

## 4. 미충족/차단

| 항목 | 상태 |
| --- | --- |
| 수정 RSA source/실제 Expo signing 스모크 | PASS (temp 복사본 한정) |
| 공식 원본 npm tarball SHA512 | PASS |
| 수정 버전 공식 release/서명/라이선스·유지보수 오너 | **HOLD** |
| 원본 `node-forge` 전체 upstream unit suite | **PASS on B2 exact source**: 829 passing / 4 pending / 0 failures, #38356973781 |
| **브라우저 `dist/` 6개 아티팩트 재빌드·취약 구현 검증** | B3 임시 아카이브에서 6개 모두 제외 PASS; 브라우저 소비자·동작 호환 미증명 HOLD |
| B3 두 패키지 재현 배포본 | 격리된 tarball 2종 이중 패킹·내용 해시 PASS (#38495602311); **배포 승인 HOLD** |
| B4 root/nested lock 교체·full/prod HIGH0 감사 | NOT_RUN / FAIL baseline |
| B5 patched Expo Android APK/기기 검증 | NOT_RUN |

**결정:** 취약한 DigestInfo 경계의 source-level 수정과 원본 아티팩트 출처는 재현됐지만, 브라우저용 사전 번들, 전체 테스트, 소유권/배포 출처 검증이 없으므로 **B2 전체 승인·B3 배포 승격 금지**, PR #1271 Draft/HOLD 유지. 단순 패키지 이름 변경이나 원본 감사 예외 연장으로 완료를 표시하지 않는다.

## 5. 2026-10-14 B2 후속 검증 정정 (B3 실험 브랜치 기록)

- B2 전체 upstream Node suite는 이미 정확 소스 HEAD `bcd9d4f6895d463d01e3fcd1ba02a5dd4ed5e509` / [#38356973781](https://github.com/gycha0109-beep/K_beauty/actions/runs/38356973781)에서 **829 PASS / 4 PENDING / 0 FAIL**. 기존 NOT_RUN 문구는 오래된 기록이므로 정정. 격리된 upstream `describe.only`를 테스트 하네스에서만 제거했고 실제 패치 소스 Git blob 비교는 유지.
- 신규 B3 [#1288](https://github.com/gycha0109-beep/K_beauty/pull/1288)에서 원본 6개 `dist` 번들을 모두 임시 후보 아카이브에서 제외한 **실물 2회 `npm pack` 결과**를 검사하여 0개 출력 PASS. 브라우저 번들 **재빌드가 PASS한 것은 아님**. 브라우저 번들 엔트리포인트에 의존하는 소비자가 없는지는 추가 검사 필요.
- 실제 B3 tarball은 임시 runner 종료와 동시에 삭제된다. 비공개 장기 저장·라이선스 권리·오너·보안 리뷰는 HOLD. 기존 application install/lock/raw audit는 변경되지 않아 취약점 해결 완료가 아니다.
