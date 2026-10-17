# B6 비공개 게시·검증 완료 — 2026-10-17

상태: **VERIFIED — PRIVATE_UNLINKED_ONLY**. 승인된 후보17119/검토 패킷8594의 실제 게시·파일·권한 검증까지 완료했다. [기계 판독 실행 증거](sec-sca-20261017-private-publication-verification.json).

| 패키지 | 실제 작업 | 검증 |
| --- | --- | --- |
| @gycha0109-beep/braces@3.0.3 | 기존 게시 유지, 재게시 없음 | 승인된 전체 파일·고지, 소유자 읽기, 익명·유효한 보조 계정 차단 PASS |
| @gycha0109-beep/node-forge@1.4.0 | 승인된 동일 파일 신규 비공개 게시 | 승인된 전체 파일·고지, 소유자 읽기, 익명·유효한 보조 계정 차단 PASS |

두 패키지 모두 저장소 미연결, 소유자 gycha0109-beep 한 명만 Admin, Actions/Codespaces 저장소 접근 없음. API 검증과 실제 설정 화면을 확인했고 기존 ACL은 변경하지 않았다. 게시 후 주 계정 Packages 화면은 지출$0/예산$0/Usage blocked를 유지한다. 정확한 실시간 공유 잔여 용량은 보장하지 않는다.

## 실제 실행 스냅샷의 변경과 검증

아래 코드 검증은 실제 게시에 사용한 고정 로컬 실행 스냅샷에 대한 과거 실행 증거다. 이번 PR 반영 커밋은 문서·공개 증거 및 해당 증거 파일의 바이트 보존 메타데이터만 포함하며, 미커밋 실행 코드/도우미·테스트를 반영하거나 새 CI에서81개 테스트를 실행했다고 주장하지 않는다. [공개 증거 인덱스](sec-sca-20261017-publication-evidence-index.json)는 승인·서명·실행 스냅샷·운영 증거의 정확한 파일 해시를 연결한다. 실행 스냅샷 JSON은 상대 파일명과 해시만 포함하며 패키지 원본이나 로컬 절대 경로는 포함하지 않는다.

선택한 공개 JSON18개에만 `.gitattributes`의 `-text`를 적용했다. Windows Git의 자동 줄바꿈 변환으로 원래 CRLF 서명 문서가 LF로 바뀌어 서명·해시가 깨지는 것을 막는다. 원래 서명/해시를 다시 만들거나 증거 내용을 바꾸지 않았으며, 스테이징된 실제 Git blob에서 두 승인 문서의 공개 서명8개와 전체 증거 해시 연결을 재검증했다.

- 실제 GitHub REST의 소유자/패키지 이름 분리를 반영했다. npm registry의 scoped identity 검증은 유지했다.
- 명시적 scoped 승인 v4에서만 부분 복구와 단일 서비스 다운로드 리다이렉트를 허용한다. v1/v2/v3가 새 권한을 암묵적으로 얻지 못한다. 동일 후보·두 archive hash·기존 실제 서명/실행 이력·새 소스 핀·운영 증거·사용자 복구 승인을 새 서명에 결합했다.
- 기존 braces의 실제 private/unlinked 파일·고지·두 접근 차단 검증 후 forge 부재를 확인하고 forge만 한 번 게시했다. 추가 실패 시 자동 재시도/삭제/덮어쓰기하지 않는다.
- 리다이렉트는 정확한 HTTPS GitHub npm blob 호스트의 기대 패키지/버전 경로 한 번만 허용한다. PAT·쿠키를 다음 요청에 전달하지 않고, 추가 리다이렉트·임의 호스트·경로 치환·응답 크기 초과를 거부하며 서명된 최종 파일 해시를 확인한다. SAS query는 로그/결과에 저장하지 않는다. 메타데이터·익명/보조 계정 검사는 계속 리다이렉트를 거부한다.
- 격리 Linux Node22 직접 테스트81개 PASS, 공개 실행 증거 변조7건 거부 PASS. 실제 새 소유자 네 역할 서명, 고정 신뢰 정책, 새 소스 핀, 서명된 Linux dry-run, 실제 게시 도구의 전체 읽기/차단 검증 PASS. 새 개인키/PAT 발급이나 불필요한 원본 CI/build/repack은 하지 않았다.

복구 승인 SHA `b1fe35d0f2206053e638830f45d0e2fc0745273ba8e0086becf48a7620d6cd4e`, 새 실제 서명 SHA `bc276cbfa10b9b4aac92b10c6185ae4fad69a9895563fcb8ce3222779417df9e`, 실행 소스 핀 `feb5d46e16ea2354eab3f65419b82887f93519fe2a706c5da1a7040fc195a2f4`. 공개키 지문8d09... 및 기존 신뢰 정책 SHA57aa...는 그대로다. 원래 승인·서명·실패 스냅샷은 보존했다.

## 경계와 다음 작업

원본 audit full HIGH22 / production HIGH19 / CRITICAL0의 **FAIL_NOT_WAIVED**를 유지한다. scoped 패키지의 탐지 누락을 해결로 취급하지 않는다. 제품 적용, 저장소 연결/권한 상속, Actions 권한 부여, main 병합, production 배포, 상류 Forge 연락은 실행하지 않았다. 비공개 게시 완료가 보안 감사 PASS나 제품 배포 완료를 뜻하지 않는다.

브랜치 `fix/security/sca-b6-release-readiness-20261014`, [PR1299](https://github.com/gycha0109-beep/K_beauty/pull/1299). 게시 당시 소스 기준점은 `e280fe67865ad69529480ff4f2edd124d67b303d`다. 사용자가 이번 문서·공개 증거의 선택적 커밋·푸시와 PR 갱신을 별도로 승인했다. 실행 코드·도우미·테스트 및 로컬 전용 준비 자료는 이번 문서 커밋에서 제외한다. 정확한 문서 커밋과 새 CI 상태는 PR에서 확인하며, 과거 소스 검증 CI를 새 HEAD의 실행 결과로 표시하지 않는다.

기존 소스 CI38869911393은 테스트86개/CodeQL/독립 재현/전체 그래프/웹·Expo·Metro·Android 검증 PASS, 원본 audit gate/overall FAIL이다. 최근 기준점 CI38876092162 역시 기술 준비 검증 PASS와 원본 gate/overall FAIL을 구분한다. 이번 커밋의 변경 파일은 문서뿐이지만 PR 누적 diff 경로 조건에 따라 SCA 워크플로가 자동 생성될 수 있다. 자동 생성되는 체크만 실제 확인하고, 불필요한 후보 재생성·게시·APK·수동 CI 재실행을 하지 않는다.

다음 단계의 차단 조건: 원본 보안 감사 FAIL 및 제품 적용 승인 부재로 제품 적용·main 병합·production 배포를 진행할 수 없다. 미커밋 실행 코드 반영도 이번 문서 커밋과 별개다. 유효기간이 지난 서명이나 기존 실행 증거만으로 미래 재게시/권한 변경을 승인하지 않는다.

Architecture Check:

* Docs updated: yes
* Ghost-code risk: passed
* Notes: 이번 커밋은 문서·공개 증거만 반영하므로 런타임/API/DB 구조 영향이 없다. 기록된 로컬 실행의 REST identity 및 명시적 v4 계약 변경은 실행 스냅샷 해시로 구분하며, 그 미커밋 코드를 이번 PR 변경으로 표시하지 않는다.
