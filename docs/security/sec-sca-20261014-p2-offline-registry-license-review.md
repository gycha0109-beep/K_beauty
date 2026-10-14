# SEC-SCA P2 — 비공개 레지스트리·BSD-3-Clause 오프라인 준비 (2026-10-14)

Watchtower-Track: security

## 1. 실제 승인 범위와 의사결정

**단일 소유자:** 프로젝트 기획, 개발, 검수, 보안·라이선스 검토, 패치 유지보수, 배포 책임은 사용자 1명에게 귀속됩니다. 같은 사람에게 2명 이상으로 나뉜 허위 승인을 요구하지 않습니다.

**이번에 승인됨:** 비공개 패치 배포 경로 **구축 준비**, BSD-3-Clause **조건 검토**, 관련 테스트 및 문서 작업.

**이번에 승인되지 않음:** 유료 인프라 결제, 실제 패치 라이브러리 게시/업로드, 앱 product lock 승격, main 병합·운영 배포, 실사용자 데이터 사용, 만료된 보안 예외 연장 또는 필수 npm 감사 우회. 서명 없는 대화 속 승인을 실제 공개 가능한 패키지의 암호화된 release signature로 대체하지 않습니다. 이후 사용자가 실제 게재를 별도 승인한다면 단일 소유자 키 하나로 증명할 수 있습니다.

승인 기록: `security/release/sca-p2-preparation-authorization.json`. 계획 계약: `security/release/sca-p2-registry-plan.json`.

## 2. 저장소 경로 결정

| 후보 | 적합성 | 이유 |
| --- | --- | --- |
| GitHub Packages npm | **현재 제약에 부적합** | GitHub npm Packages는 `@NAMESPACE/name` 스코프를 요구합니다. 기존 검증된 unscoped `braces`, `node-forge` 원본 식별자를 유지할 수 없어 패키지명만 바꾸는 우회가 됩니다 |
| 직접 관리 npm 호환 비공개 레지스트리 | **설계 후보** | 예: Verdaccio를 TLS·인증 계층 뒤에 두는 방식. 기존 unscoped 이름 유지가 가능하도록 구축할 수 있지만, 실제 서비스·비공개 ACL·불변 버전 정책·토큰 분리·인프라 비용은 **검증 전**입니다 |
| npm public registry에 원본 이름 재게시 | **금지** | upstream identity/shadowing 위험 및 발행 권한 없음 |
| 임의 `file:`/별도 테스트 APK | **배포 경로로 부적합** | 원격 승인된 아티팩트 readback과 실제 canonical product lock 재현성을 보장하지 않습니다. B4 격리 테스트 근거로만 허용 |

참고:
- GitHub Packages npm 범위: https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry
- Verdaccio 비공개 npm 레지스트리: https://www.verdaccio.org/docs/cli-registry/
- npm package identity/dependency confusion: https://github.com/ossf/package-manager-best-practices/blob/main/published/npm.md

**현재 provider=UNSELECTED, endpoint=null, credential=false, cost=false, publication=false.** 무료/무과금이라는 사실도 인프라를 실제로 선택·검증하지 않았으므로 보증하지 않습니다.

레지스트리 활성화 전 실제 증거가 필요한 조건: unscoped 2종만 격리 처리; 검토된 tarball 바이트/불변성; npmjs로의 외부 shadowing 차단; 공개 GET 거절(401/403/404); 인증된 원본 바이트 readback; HTTPS 인증서/호스트; 짧은 수명의 publish/read 분리 토큰; 토큰 로그/리다이렉트 전파 방지; 등록되지 않은 버전·무승인 overwrite 실패; 원본 npmjs 감사 FAIL 유지. 코드가 이러한 조건을 **요구한다는 것과 실제 서버에서 검증했다는 것은 다릅니다.**

## 3. node-forge BSD-3-Clause 검토

`node-forge` 1.4.0은 원본 LICENSE에 BSD와 GPL v2의 이중 선택 문구가 있으며 BSD-3-Clause 조건을 검토할 수 있습니다. 이번 작업은 **법적 배포 허가 확정이 아니라 라이선스 증거 및 의무 검토**입니다.

BSD-3-Clause의 필수 검토 항목:

1. **소스 형태 재배포:** 원본 저작권 고지, 조건 목록, 면책조항을 보존합니다.
2. **바이너리/번들 형태 재배포:** 저작권 고지, 조건 목록, 면책조항을 배포 문서 또는 함께 제공되는 자료에 재현합니다.
3. **추천·보증 금지:** Digital Bazaar와 기여자의 이름을 별도 서면 허락 없이 파생 제품의 추천·보증에 쓰지 않습니다.
4. **원본 LICENSE 무결성:** 현재 B4 고정 소스 SHA와 후보 tarball 내의 LICENSE 전체 바이트를 일치 검증합니다. `NOTICE.md`의 SHA 표기는 원본 LICENSE 전문을 대신하지 않습니다.
5. **수정본 출처:** upstream SHA와 실제 변경 파일/재빌드된 `dist` 6종·검증 자료를 유지합니다. 사용자가 실제 바이너리나 애플리케이션을 외부 배포할 경우 함께 제공할 저작권·라이선스 문서 위치를 추가 확인해야 합니다.

원본 권위 자료: https://github.com/digitalbazaar/forge/blob/main/LICENSE

`scripts/security/sca-p2-offline-readiness.mjs`는 검증된 원본 tarball의 LICENSE 해시/핵심 BSD 문구 및 계획의 미게시 경계를 검사합니다. 별도의 P2 승인서를 생성하거나 배포 정책을 자동으로 통과시키지 않습니다. B6 `run-sca-b6-candidate-probe.mjs`에서 기존 후보를 생성하는 동안 메모리로 검사 후 결과 `SCA_P2_BSD_LICENSE_AND_REGISTRY_PREPARATION`에 남깁니다. tarball/후보 digest에는 추가 파일을 넣지 않습니다.

## 4. 다음 단계 및 중단 조건

- **지금 완료 목표:** 오프라인 계획/검사 및 부정 테스트/정확 HEAD CI, CodeQL, B6 독립 후보 동일 해시. P2 결과는 `PREPARATION_ONLY_HOLD_ACTUAL_PUBLISH`.
- **실제 배포소 구축·연결 시:** 무과금 여부와 자원 사용 범위를 확인하고, 외부로 공개되지 않는 테스트 보안 정책을 먼저 검증합니다. 유료 리소스가 필요하면 승인받기 전 중단합니다.
- **실제 패키지 게시 시:** 사용자에게 해당 게재를 별도 승인받아 정확 SHA/배포소 URL/신뢰 키로 서명된 release candidate만 게시합니다. 명령 `--execute-approved-upload`는 별도 승인 전 금지합니다.
- **실제 앱 반영 시:** 정식 보안 감사 FAIL 및 버전/의존성 provenance를 해결하고, 승인 패키지의 lock으로 **기존** Android 빌드 파이프라인에서 APK를 생성합니다. 별도 APK를 SCA 완료로 간주하지 않습니다.

**변하지 않은 차단:** HIGH 22건(프로덕션 19건)은 현 npm 감사 원시 결과이며, 자체 패치 출처·라이선스 검증 PASS만으로 해제되지 않습니다. B7 main/운영 배포는 HOLD.
