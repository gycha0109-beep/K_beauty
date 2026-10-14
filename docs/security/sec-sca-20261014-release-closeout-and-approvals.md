# BEJEWELY 공급망 보안 최종 검수 — 2026-10-14

최종 재조회 16:39 KST. 실제 제품 보안은 **부분 해결**이다. 공식 Next.js/crawler 수정과 B6 기술 준비는 PR에 구현·검증됐다. main 병합과 제품 private patch 적용은 수행하지 않았다. main HEAD: `1a82cf9961f4fbba30d1d59f1ec2de1a3c6dd7e2`.

## PR 및 정확한 검증 HEAD

| PR | HEAD | 결과 |
|---|---|---|
| [#1288](https://github.com/gycha0109-beep/K_beauty/pull/1288) | c8153c359c545141c9176254feb638f3844ba5f1 | B1~B5 보존; 제품 감사 FAIL |
| [#1294](https://github.com/gycha0109-beep/K_beauty/pull/1294) | d937ddc82b27b00bd01a858ffa8813ce94aa55d7 | 공식 Next15.5.27, clean install/build/public smoke/CodeQL 및 일반 CI PASS; 기존 HIGH 게이트 FAIL |
| [#1299](https://github.com/gycha0109-beep/K_beauty/pull/1299) | 8eae7f36601b0db3d1bed7f9835d551ecd1aabac | #1288에 stacked; B6 기술 준비 PASS, 릴리스 HOLD |
| [#1303](https://github.com/gycha0109-beep/K_beauty/pull/1303) | 366e2012391d033d122ebd8b8c3599dd805be5bd | 별도 crawler 공식 ws8.22.0/tsx4.23.15/esbuild0.28.2 수정; crawler 감사 0; 제품 게이트 FAIL |

모두 Draft이며 GitHub mergeable=true는 충돌 없음만 의미한다. 보안 필수 게이트를 충족한 병합 가능 상태로 선언하지 않는다. 강제 push/이력 재작성/다른 작업 변경 덮어쓰기 없음.

## 완료된 증거와 CI

- [B1~B5 Supply Chain](https://github.com/gycha0109-beep/K_beauty/actions/runs/38514455251): 패치 생성, 독립 tarball 재현, six browser distributions, 실제 전체 root/4-workspace 그래프, nested/alias 경로와 69 파일 바이트, Expo signing/소비자, Next/public smoke 및 Expo/Metro/Android debug APK PASS. 원본 감사 FAIL은 유지.
- [Next 최종 HEAD CI](https://github.com/gycha0109-beep/K_beauty/actions/runs/38520333119): production build 42 pages와 localhost 공개 페이지 smoke, CodeQL PASS. 원본 보안 게이트 FAIL.
- [B6 최종 HEAD CI](https://github.com/gycha0109-beep/K_beauty/actions/runs/38523696429): 17개 승인/crypto/archive/tamper negative controls, 실제 release 구조·LICENSE/NOTICE/SBOM/provenance, Main Health, 독립 clean-runner digest replay와 CodeQL PASS. 원본 게이트 FAIL. [PIE](https://github.com/gycha0109-beep/K_beauty/actions/runs/38523696787) PASS.
- [Crawler 최종 HEAD CI](https://github.com/gycha0109-beep/K_beauty/actions/runs/38527175672): clean install, 실제 realtime→ws 해석, 정상 echo와 과도한 작은 fragment 거부, 원본 full/prod 감사 0 및 CodeQL PASS. 앱 게이트 FAIL. [Main Health](https://github.com/gycha0109-beep/K_beauty/actions/runs/38527175707), [Admin](https://github.com/gycha0109-beep/K_beauty/actions/runs/38527175678), [PIE](https://github.com/gycha0109-beep/K_beauty/actions/runs/38527176059) PASS.
- 세 PR combined offline merge tree `a750b48dea8d2231244e4207e6192d1af20e3f8b`: 128 Next/admin assertions, 71-workflow 책임 map, R16D source verifier, 17 admission tests PASS. 실제 병합이나 combined production/mobile runtime 검증은 아니다.

## 감사 및 미해결

| 범위 | HIGH | CRITICAL | 판정 |
|---|---:|---:|---|
| 앱 전체 기존/candidate 그래프 | 22 | 0 | FAIL |
| 앱 production 기존/candidate 그래프 | 19 | 0 | FAIL |
| 별도 crawler 수정 그래프 전체/production | 0 | 0 | 모든 severity 0, exit0 |

앱 HIGH의 두 주요 원인은 braces GHSA-vfj7-8cjw-p6xm 및 node-forge GHSA-86w9-cpqp-85rv이다. 최신 확인 공식 릴리스 braces3.0.3/node-forge1.4.0에는 해당 수정 버전이 없다. 상위 공식 업그레이드만으로 모든 Expo/Metro/micromatch/Tailwind 경로를 제거하지 못한다. 원본 패치 바이트는 검증됐지만 제품 lockfile에는 정식 적용되지 않았다. 동일 이름·버전 patch는 원본 npm advisory에 계속 탐지된다. **private registry 승인만으로 HIGH0이나 필수 보안 게이트 PASS가 되지 않는다.**

Next 공식 수정은 두 moderate advisory를 제거한다. 원본 B6 full/prod moderate13/11과 Next 적용 full/prod moderate12/10을 구분한다. crawler 결과를 앱 HIGH0으로 보고하지 않는다.

원본 JSON 보존: b6-ready-audit-full.json SHA256 `a9153a20e1998e22c60ad063aee09a9798884849cc51d178e2b47021f9c4ee76`; production `c55817a769347015a549836e4d94ffc46fa12aa0fd5ab147a3f1ea228b5e6ad6`. Next full `e8f287819b456def9ee545d2464350d7af429a9b3a901042c4955348aade318e`; production `44dcfee183addb7d51f6691d526c6763360d7fbefb25652a93d59ad46e684580`. 필수 감사 정책/기간/allowlist 변경 없음.

## B0~B7 및 Android

| 단계 | 상태 |
|---|---|
| B0 | 기술 배포 인터페이스 준비; registry/법적/책임자 결정 HOLD |
| B1~B3 | 기존 패치·회귀·browser·독립 아티팩트 재현 PASS |
| B4 | 기존 실제 전체 그래프 격리 설치 PASS; 정식 private URL staging NOT_RUN |
| B5 | 해당 B4 그래프 Expo TS/lint/config/Metro/export/prebuild/Android debug APK PASS |
| B6 | 기술 구현·negative controls·독립 replay PASS; 정식 릴리스/보안 수용 HOLD |
| B7 | PR 충돌 검수 PASS; 필수 게이트 FAIL, 병합 HOLD |

검증 APK SHA256 `ad016fd9faa6b717a25a662a12e6185d60403544b6ec33a2eb1ab4f00c3f75e6`. B4/B5는 c8153c의 실제 임시 그래프 증거이며, 모든 후속 PR과 private URLs를 합친 그래프의 APK 증거는 아니다. 실기기/에뮬레이터 및 인증/API smoke **NOT_RUN**. 현재 로컬 SDK/JDK/ADB/기기와 승인된 격리 API/Auth 환경이 없다.

## 실제 승인 대상과 승인 후 최소 실행

1. 조직 전용 durable private npm 저장소 및 불변 버전/private ACL/정확한 readback URL 선택: 기존 Nexus/Artifactory compatible endpoint 또는 조직 관리 Verdaccio 등. public npm 업로드 금지. scoped identity를 강제하는 경로는 현재 원본 identity 후보에 맞지 않는다.
2. braces MIT 및 forge BSD-3-Clause OR GPL-2.0 재배포 법적 검토와 forge license 선택. security/license-redistribution/maintenance/distribution 네 역할, 최소 두 명의 실제 책임자 지정.
3. 조직 Ed25519 trusted key policy·SHA256를 보호 설정에 pin하고, 7일 이하 exact-candidate approval 서명 발급. publish/read credential을 분리해 최소 권한으로 승인·주입. 테스트 키/템플릿 boolean은 승인 효력이 없다.
4. 정확한 bundle 검증·signed dry-run 이후 별도 업로드 승인. private readback/anonymous deny 증명 후 full graph staging, 독립 runner와 actual candidate Android/device/API/Auth 검증. 제품 graph 원본 audit FAIL은 계속 기록한다.
5. 공식 fixed release/완전 제거/advisory 수정에 따른 보안 게이트 해결 또는 별도 조직 보안 수용 결정이 필요하다. 본 작업은 예외를 적용하지 않았다. 제품/main 병합과 production 변경은 각각 별도 승인.

완전한 생성·서명·업로드·staging·유지보수·키 복구·rollback 명령은 [B6 runbook](sec-sca-20261014-b6-release-readiness.md)에 있다. 검증된 manifest SHA256 `ec607c669b4242ee163b9b23d67c323750646efe4989f324ed544dd4c1eb4deb`. 두 tarball의 identity/version·69 파일·LICENSE hash를 유지해야 한다. 현재 패키지는 업로드하지 않았으며 CI는 후보를 삭제한다.

승인 후 격리 Linux의 reviewed B6 checkout에서:

```sh
npm ci --ignore-scripts --no-audit --no-fund
SCA_B6_VERIFY_CANDIDATE=1 SCA_B6_CANDIDATE_OUTPUT=/private/scratch/release-candidate node scripts/security/run-sca-b3-forge-browser-dist-rebuild-probe.mjs
node scripts/security/verify-sca-release-candidate.mjs --bundle /private/scratch/release-candidate --approval /private/approvals/approval.json --signatures /private/approvals/signatures.json --trust /private/approvals/trust.json
node scripts/security/publish-approved-sca-candidate.mjs --bundle /private/scratch/release-candidate --approval /private/approvals/approval.json --signatures /private/approvals/signatures.json --trust /private/approvals/trust.json
# 실제 업로드 승인 후에만 위 명령에 --execute-approved-upload 추가.
node scripts/security/stage-approved-sca-product-graph.mjs --source /private/checkouts/product-candidate --bundle /private/scratch/release-candidate --approval /private/approvals/approval.json --signatures /private/approvals/signatures.json --trust /private/approvals/trust.json --output /private/scratch/installed-candidate
```

SCA_TRUST_POLICY_SHA256는 조직 보호 설정으로 제공하고 NODE_AUTH_TOKEN은 승인된 secret manager에서 주입한다. source는 해당 PR 조합이 승인된 committed candidate checkout이어야 한다. 개인/임시 경로 lockfile 제품 커밋 금지. 원본 audit가 FAIL이면 마지막 staging 명령도 FAIL이어야 하며 성공으로 바꾸지 않는다.

기존 기술 closeout는 승인 없는 범위의 구현·검증 완료를 뜻하며 실제 제품 해결 완료를 뜻하지 않는다. 아래 재개 기록은 최신 승인 요청 기준이다.

## 승인 연동 재개 기록 — 2026-10-14 17:10 KST

Watchtower-Track: security

실제 존재하는 로컬 `outputs/security-release-closeout.md`를 확인하고 이 버전 관리 문서로 수용했다. 원본 로컬 파일은 보존한다. 위 CI/HEAD는 직전 구현 검증 snapshot이며, 이 문서 추가 커밋에 대한 CI PASS를 의미하지 않는다. 실행형 문서 closeout; DB/Auth/RLS/Storage/Provider/Payment/Secret/Production 수정·실행 N. 실제 credential 발급·사용이나 배포 설정 적용 없음.

최신 main과 네 PR HEAD는 위 표와 동일하다. 각 check-run을 재조회하여 #1294/#1303 일반 기술 검증 PASS 및 원본 `Package integrity and vulnerability gate` FAIL을 확인했다. #1299의 original gate도 FAIL이다. 최신 메타데이터 PIE 추가 실행은 동일 HEAD에서 PASS. GitHub PR mergeable=true, mergeable_state=unstable. rulesets API는 []를 반환했으나 classic main branch protection 조회는 403 Resource not accessible by integration이다. **required check 목록과 관리자 우회 규칙은 확인되지 않았다.** rulesets=[]를 보호 규칙 없음으로 해석하지 않으며, 아직 병합 승인을 요청하거나 병합하지 않는다. 관리자 읽기 권한을 가진 사용자의 보호 규칙 확인이 필요하고 보안 게이트를 변경하는 권한으로 확대하지 않는다.

npm 공식 registry와 공식 advisory를 재조회했다: braces latest3.0.3, forge latest1.4.0, 두 advisory fixed None. Expo CLI57.0.29→forge^1.3.3/signing^0.0.6; signing0.0.7→forge^1.4.0; micromatch4.0.8→braces^3.0.3; metro-file-map0.87.1→micromatch^4.0.4. 현시점 정식 upstream 업그레이드로 전체 경로가 해결됐다는 증거는 없다. [braces 공식 advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), [forge 공식 advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv).

### 첫 사용자 결정: private registry

| 선택 | 비용 | 운영 복잡도 및 보안 요건 |
|---|---|---|
| 전용 Verdaccio | 소프트웨어 무료, 실제 서버/저장/백업 비용은 환경 선택 후 산정 | self-host 운영 필요; TLS, private ACL, 등록 제한, 독립 read/publish 계정, 불변 버전, 백업/복구 검증 필수 |
| 기존 조직 Nexus/Artifactory npm 저장소 | 기존 계약/인프라 있으면 추가 비용 확인 필요 | 기존 운영 체계 재사용 가능; 전용 hosted repository와 원본 upstream mirror 분리 필수 |
| 신규 JFrog Artifactory SaaS | 공식 페이지 Pro $150/month, 현재 한시 $50/month 표시; 최종 견적/약관 확인 필요 | 호스팅 부담 감소, 유료 계약·계정·ACL/backup 검토 필요 |

[Verdaccio 공식 설명](https://www.verdaccio.org/), [공식 접근 제어](https://www.verdaccio.org/docs/packages/), [JFrog 공식 가격](https://jfrog.com/pricing/). 현재 확인된 기존 조직 저장소가 없으므로 **전용 Verdaccio 방식 선택**을 첫 추천으로 제시한다. 이것은 registry 방식 결정만 요청하며 서버 구매/프로비저닝, 자격증명 발급, 법적 수용, 패키지 업로드, 보안 예외, main/prod 변경 승인을 포함하지 않는다.

선택 후 준비할 설정은 두 원본 unscoped 패키지만 허용하고 해당 패키지에 npmjs uplink/proxy를 두지 않는 전용 저장소이다. default `$all`/공개 등록/일반 publish 권한을 그대로 쓰지 않는다. 명시적인 reader/publisher ACL, self-registration 금지, 빈 unpublish 권한, backup 복구 검사 및 해당 버전 기존 존재 시 업로드 거부를 유지한다. CI는 별도 read-only 자격증명으로 exact private readback URL에만 접근한다. pin된 조직 trust policy와 signed exact manifest 검증은 기존 스크립트를 재사용한다. 전체 사용자 공개 ACL이나 미검증 local server를 제품 배포 endpoint로 채택하지 않는다.

### 다음 승인은 순서대로 별도 요청

현재 모든 항목은 **PENDING**, 승인자·승인 시각·승인 ID 없음. 일반 개발 허가나 이 문서 내용은 승인 증거가 아니다.

1. Registry 방식/대상 선택 (현재 요청 대상).
2. 실제 서버/비용/운영 접근이 필요하면 별도 환경 결정. 법적 reviewer가 braces MIT 및 forge BSD/GPL 선택/수정 재배포 의무를 검토; 사용자 동의만으로 법적 완료 처리 금지.
3. 1인 프로젝트 최소 역할: 사용자에게 maintenance/distribution, 별도의 실제 reviewer에게 security/license-redistribution 역할을 제안한다. 최소 두 named owners/네 signed roles를 유지하며 Codex는 독립 법적/조직 승인자 역할을 수행하지 않는다.
4. 전용 registry의 publisher와 CI reader 권한 발급, 보호된 secret manager/CI Secrets에 저장. 비밀값을 채팅·git·로그에 요구하거나 출력하지 않는다. 실제 CI credential 사용도 승인된 대상에서만 수행한다.
5. exact braces3.0.3 SHA d4f1219db19bfeb4e1c3f0354f9269569393f1b8c9f8c0295b80346926d4fa70 및 forge1.4.0 SHA 67a51b864d9e483417ff34425a5a09012d333a5184dcc39f966731935463db50, 최종 registry/readback URL/rollback을 보여주고 upload 명시 승인 요청.
6. 승인된 remote bytes와 실제 candidate graph 검증 후 감사 FAIL이면 원인/실제 코드 상태를 별도 제시. 보안 수용이나 예외는 자동 적용하지 않고 별도 결정 요청. 보호 규칙을 무시하지 않는다.
7. 안전한 merge 조건과 보호 규칙 확인 후 PR별 병합 승인, production 배포 별도 승인, 최종 이슈 종료 별도 승인. #1294/#1303은 독립 유지하고 #1299는 #1288 이후 종속된다. 어느 병합 순서도 현재 FAIL을 자체 해결하지 않는다.

승인 원문/정확한 범위/결정자/시각/실행 대상 SHA/실행 결과/취소·보류를 후속 append-only 기록으로 보존한다. 승인 전 upload/private install/main merge/production/issue close는 모두 NOT_RUN이다. 실기기 또는 승인된 API/Auth 환경이 필요한 시점에도 한 번에 한 결정으로 사용자에게 요청한다.
