# SEC-SCA B0/B1 — 자체 braces 패치 구현 1차 실행 기록 (2026-10-13)

> Track: security · Watchtower-Track: security · B안 [실행 로드맵](sec-sca-20261013-private-patch-distribution-roadmap.md) ·
> [보안 진단 #1240](https://github.com/gycha0109-beep/K_beauty/pull/1240) ·
> [자체 패치 B1 Draft PR #1270](https://github.com/gycha0109-beep/K_beauty/pull/1270) ·
> [보안 이슈 #1208](https://github.com/gycha0109-beep/K_beauty/issues/1208)
>
> **단계 판정: B0 PARTIAL / B1 SOURCE-PATCH PREFLIGHT PASS (전체 B1 완료 아님).** 본 결과는 패키지 자체 배포, 실제 설치, 보안 감사 해결 또는 배포 승인이 아니다.

## 1. B0 재조회 및 기준선

- 작업 당시 main HEAD: 00f92cca3d36c014a816f4db6aacef530ca726f9; security 진단 PR #1240 HEAD: 28fd64bffec378161be1865eae4aedf30444a02a; 별도 실험 브랜치: fix/security/sca-b1-private-braces-candidate-20261013. 실제 실행 시 모두 재조회 필요.
- root npm lockfile v3 Git blob: 37dfa247a664593440667b35d9af96d604d7949b.
- 잠금 라이브러리: braces@3.0.3, registry tarball https://registry.npmjs.org/braces/-/braces-3.0.3.tgz; 원본 lock integrity sha512-yQbXgO/OSZVD2IsiLlro+7Hf6Q18EJrKSEsdoMzKePKXct3gvD8oLcOQdIzGupr5Fj+EDe8gO/lxc1BzfMpxvA==. node-forge@1.4.0 lock integrity sha512-LarFH0+6VfriEhqMMcLX2F7SwSXeWwnEAJEsYm5QKWchiVYVvJyV9v7UDvUv+w5HO23ZpQTXDv/GxdDdMyOuoQ==.
- [braces upstream patch PR #72](https://github.com/micromatch/braces/pull/72): CLOSED/UNMERGED, HEAD 28d440b5dd449dbf1fe6f3506cf94ecca4d02660.
- [node-forge upstream patch PR #1152](https://github.com/digitalbazaar/forge/pull/1152): OPEN/UNMERGED, HEAD ceba34402e329f0365134f23fe19898756527d65.
- 원본 Supply Chain 정책은 high 2개 GHSA 관련 만료 예외 때문에 FAIL 상태. 기존 raw npm audit의 HIGH production 19 / full 22, CRITICAL 0이 이전 [CI #38341377026](https://github.com/gycha0109-beep/K_beauty/actions/runs/38341377026)에서 확인됨. B1 작업은 package.json/lockfile/audit exception을 변경하지 않음.

**B0 미충족:** 모든 소비자 edge별 소유/신뢰 경계 승인표, 독립 배포 라이선스 확인, 실제 패키지 provenance reviewer와 유지보수 담당자/내부 artifact 저장소 결정. 기존 경로 tracer 및 audit 근거는 있으나 **B0 PASS 주장 금지**.

## 2. 구현된 B1 대상

- security/vendor/braces/source-manifest.json: braces 3.0.3의 registry/lock integrity, 업스트림 PR #72 SHA, 검토된 패치의 Git blob SHA, 허용 라이브러리 파일 5개를 명시. 승인 상태 필드는 모두 false/UNKNOWN.
- scripts/security/materialize-private-braces-source.mjs: 기존 npm-ci 설치본을 임시 디렉터리로 복사, manifest/잠금 파일 version·integrity·registry URL 확인, 소스에서 symlink/중첩 node_modules/크기·파일 수 이상 감지, 정해진 upstream patch SHA-1 blob 확인, git apply 변경 파일이 정확 5개인지 검증, 적용 전후 SHA-256을 기록하며 원본 설치본 변경 금지.
- scripts/security/verify-private-braces-probe-child.mjs 및 verify-private-braces-source-candidate.mjs: 원본/수정본 정상 glob 동작 비교, parser의 101 이상 중첩 거부, compile/expand/stringify walker 각각 깊이 차단, 더 낮은 maxDepth 및 소수점 제한, 직접 AST parent chain 순환 거부, 양성 parent 처리를 제한시간 30초 자식 프로세스에서 실행. 검증용 외부 node_modules symlink는 임시 디렉터리에만 위치하며 **tarball에 포함하지 않음**.
- 기존 Supply Chain workflow의 감사 앞 진단 단계에 신규 verifier를 추가했으며, **원본 npm audit·CodeQL·실패 차단은 그대로**이다.
- B1 저장된 패치는 기존 scripts/security/candidates/braces-pr72-library.patch.b64의 동일 source-pinned bytes이며, 실제 node_modules 또는 원본 패키지 lock/버전은 대체되지 않았다.

## 3. 실제 코드 검증

초기 코드 HEAD ff94e5f09af3f7c53a5ecaaace33f038f030150a, [Supply Chain CI #38346042122](https://github.com/gycha0109-beep/K_beauty/actions/runs/38346042122)의 trace 단계:

- SUPPLY_CHAIN_POLICY_INTEGRITY=PASS mutation-cases=9
- SCA_BRACES_PATCH_ISOLATION=ISOLATED_CANDIDATE_BEHAVIOR_PASS (이전 비교 기준선)
- SCA_B1_PRIVATE_BRACES_CANDIDATE: **B1_SOURCE_CANDIDATE_BEHAVIOR_PASS_NOT_RELEASE_OR_REMEDIATION**.
- 패치 Git blob SHA-1 b6aa05571a91ec9c6c4bc80ae7c6a26cb5db31af / SHA-256 151f67f199c0dd13f6c4e99b27b8519bbba4504266223722230ebbf142056190.
- 변경 파일 정확히 lib/compile.js, lib/constants.js, lib/expand.js, lib/parse.js, lib/stringify.js. 각 결과 파일 SHA-256은 CI JSON 로그에 별도 기록.
- bounded child 정상/비정상 검사 **PASS**, 원본 source·manifest·lock 변경 없음.
- 변경 불변식: Security CI의 별도 원본 audit는 GHSA-vfj7-8cjw-p6xm 예외 만료로 FAIL 유지. 이는 보안 결함이 해결되지 않았으므로 올바른 차단이다.

## 4. 단계별 남은 일과 실제 종료 기준

| 단계 | 현재 판정 | 다음 증거 |
| --- | --- | --- |
| B0 | PARTIAL | 원본 tarball 독립 검증, 완전한 소비자·신뢰경계 목록, 패키지 재배포 license/maintainer/security owner 검토 |
| B1 | SOURCE PREFLIGHT PASS / B1 전체 HOLD | 원본 upstream 전체 unit test suite, Node 22 테스트 환경, 독립 원본 tarball SHA, 라이선스 확인, 승인된 B1 source-review |
| B2 | NOT_STARTED | node-forge PKCS#1 v1.5 ASN.1 검증 자체 패치 및 upstream 전체 시험 |
| B3 | NOT_STARTED | source-to-tarball/NOTICE/재현 빌드, 두 자체 패키지 배포 승인 |
| B4 | NOT_STARTED | 실제 안전한 lock 전체 교체 및 raw production/full HIGH0 + 물리 source fingerprint |
| B5 | NOT_STARTED | patched Expo/Metro/Android APK 및 실기기 smoke |
| B6/B7 | BLOCKED | 정책 v2, exact HEAD CI, 리뷰, main 병합·유지보수 |

**최종 결정:** B1의 직접 패치 소스 재현 경로와 검증 fixture는 구현되었지만 아직 B1 전체 승격 조건은 미충족. #1270은 Draft/HOLD. 독립 리뷰 전 배포/의존성 변경 불허.
