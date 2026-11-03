# D8K-13 — 가정용 Windows 독립 PostgreSQL17 보안 합성 테스트 수락 근거

> 2026-10-17 KST · **SEC-05 / ranking ACL 로컬 합성 PG17 PASS** · **운영 전체 릴리스 HOLD**
>
> 시험 원본은 사용자 로컬 Windows PowerShell 로그이며, 시스템명/사용자명/절대 사용자 경로와 전체 원문은 공개 저장소에 게시하지 않는다. 개인 데이터·운영 DB 데이터/credential은 시험에 제공하지 않았다.

## 1. 확인된 실행 조건

- 실행 일자: **2026-10-17 16:52:52–16:53:01 KST**.
- 사용한 집 PC용 실행 도구: `D8K13_HOME_TEST.ps1` / `RUN_TEST.cmd`.
- GitHub 코드 고정 커밋: `0832a7f964cb68aa7fb057eba654343f46214cfa`.
- 고정된 **6개 원본 코드/픽스처 Git blob SHA 검증 통과**, PostgreSQL17 Docker 이미지 준비 완료. Git repo clone이나 학원 worktree는 필요 없었다.
- 사용자 제출 로그의 **SHA256**: `72ad32e76230dc0859ed4ce446269fa9d0fd7cf123d540a443094d0fa99c52fe` (공개 식별자/경로가 아닌 증거 자체의 고정 지문).
- 검증 결과 마커가 로그에 실제 포함되어 있음을 로그 전문에서 확인함.

## 2. 실제 수집된 결과 마커

| 테스트 | 로컬 Windows 로그 결과 |
| --- | --- |
| 소스 6개 Git blob 무결성 | `D8K13_HOME_SOURCE_SIX_GIT_BLOB_CHECKSUMS_PASS` |
| Docker postgres:17 이미지 준비 | `D8K13_HOME_POSTGRES17_IMAGE_READY` |
| SQL fixture 준비 및 source check | `D8K13_SEC05_ACL_SYNTHETIC_CHECK_FILES_PASS` |
| SEC-05 6개 NULL 입력·정상 claim/retry | `D8K13_SEC05_HARDENED_NULL_MATRIX_AND_RETRY_PASS` |
| anon/authenticated RPC 직접 호출 거부 | `D8K13_SEC05_PUBLIC_RPC_DIRECT_EXECUTE_DENIED_PASS` |
| ranking 잔여 REFERENCES/TRIGGER/MAINTAIN 회수·rollback·재적용 | `D8K13_SEC05_RANKING_MINIMAL_ACL_ROLLBACK_PASS` |
| 합성 Docker PG17 러너 종료 | `D8K13_SEC05_ACL_LOCAL_DOCKER_PG17_PASS` |
| 집 PC 래퍼 정상 종료 | `D8K13_HOME_PG17_TEST_PASS` |

**증거의 경계:** 제출한 PowerShell Transcript에 `D8K13_SEC05_LOCAL_PG17_READY`와 `D8K13_SEC05_LEGACY_NULL_REPRODUCED_AND_ROLLBACK_PASS` 두 개의 중간 표시가 **직접 기록되지 않았다**. 그러나 고정된 commit `0832a7f9`의 실제 러너는 legacy 테스트와 rollback을 통과하고 해당 결과를 assert한 **이후에만** hardened NULL matrix와 최종 `D8K13_SEC05_ACL_LOCAL_DOCKER_PG17_PASS`를 출력한다. 따라서 이 로그는 **고정된 러너를 정상 완료했다는 간접 제어 흐름 증거**를 제공한다. 별도 SQL statement-by-statement 출력, psql transcript 또는 디버그-level 원본 로그까지 검증했다고 주장하지 않는다.

## 3. 판정 구분

- **PASS:** PR에서 고정된 SEC-05 synthetic legacy-vs-hardening SQL 계약과 ranking ACL 로컬 Docker PG17 테스트의 **이번 가정용 Windows 단발 실행**. 기존 D8K-13 핵심 PG17 부분 체인 검증과는 별개이며 두 결과를 합산해 전체 체인 인증으로 표시하지 않는다.
- **NOT TESTED:** 전체 **178개** 운영 마이그레이션의 clean PG17 replay/rollback, DB 백업/PITR 실제 복원, 독립 OWNER reviewer, security issue #1208 해결, hosted migration 적용.
- **HOLD:** 과거 Taxonomy8 사전조건 증빙, Crawler 함수 parser 차이, 남은 운영 migration provenance, 잔여 보안 취약점의 운영 보강 승인. 실제 운영 DB의 함수/권한은 **이번 시험으로 변경되지 않았다**.
- 새 runner가 포함된 **GitHub 고정 커밋의 소스 계약**만 이 로그가 증명한다. PR HEAD 이후 문서/진단기 변경만으로 운영 함수가 고쳐지거나 자동 배포되는 것이 아니다.

## 4. 개발 기록

실행 원본 스크립트: `scripts/product-evidence/run-d8k13-sec05-acl-synthetic-pg17.mjs`와 `tests/fixtures/r16i-d8k13/30…33`. 릴리스 차단 검사 `verify-d8k13-release-sequence-v1.mjs`는 합성 네이티브 테스트 PASS 여부와 관계없이 전체 178건 migration 이력의 검증 부족으로 `--enforce-release`에서 exit code 3을 반환해야 한다.

**최종 결과: `D8K13_SEC05_ACL_LOCAL_DOCKER_PG17_PASS` / `D8K13_HOSTED_RELEASE_HOLD`.**

## 5. 2026-10-17 21:16 KST 후속 Windows PG17 확장 PASS — 8개 소스

앞선 16:52 **6개 소스** 시험과 별도로, 사용자가 21:16:50–21:17:02 KST에 제공한 `D8K13_HOME_RESULT_20261017_211649.log` 결과에서는 고정 커밋 `303a94af096f6b4b8fa0784e8920bc39843a4edd` 및 **8개 Git blob checksum PASS**가 보고됐다. 전달된 로그 SHA256 `1dadd3a9ba3fcde39e03dbf0c94b3b824a8014ccee445f2334c54db7dce52006`은 *사용자 보고 지문*이며, 이 이관 세션은 원본 로그 바이트를 전달받지 않았으므로 재해시했다고 주장하지 않는다.

사용자가 제공한 직접 표시 마커:

- `D8K13_HOME_SOURCE_EIGHT_GIT_BLOB_CHECKSUMS_PASS`
- `D8K13_HOME_POSTGRES17_IMAGE_READY`
- `D8K13_SEC05_ACL_SYNTHETIC_CHECK_FILES_PASS`
- `D8K13_SEC05_ACL_LOCAL_DOCKER_PG17_PASS`
- `D8K13_HOME_PG17_TEST_PASS`
- `D8K13_SEC05_EXTENDED_HOME_PG17_TEST_PASS`

고정 러너는 이전 claim·ranking 검증에 더하여 `34_sec05_legacy_completion_failure_null_pg17.sql` 및 `35_sec05_hardened_completion_failure_pg17.sql`을 차례로 실행하고 legacy NULL 상태 변경·rollback, hardened complete/fail의 인자 NULL 거부 및 정상·실패·재시도·역할 차단을 assert한 뒤 `D8K13_SEC05_ACL_LOCAL_DOCKER_PG17_PASS`를 출력한다. 따라서 이 결과는 **고정 러너의 확장 합성 Docker PostgreSQL17 성공**으로 수락한다. 개별 complete/fail 중간 마커나 원시 SQL statement별 출력은 제시된 요약에 직접 표시되지 않았으며 독립적으로 확인했다고 주장하지 않는다.

새 증거 매니페스트: `scripts/product-evidence/baselines/d8k13-sec05-extended-home-pg17-acceptance-20261017.json`. 관련 오프라인 검증기는 현재 코드에서 8개 소스 Git blob checksum 및 러너 종료 조건을 fail-closed로 검사한다. 예전 `NOT_RUN` 기록은 그 **이전 시점**의 사실로 유지되지만 **현재 후속 판정은 scoped extended PG17 PASS**이다.

**운영 DB의 세 SEC-05 RPC는 여전히 보강 전 상태**이며, 전체 178건 migration replay, Crawler native parser 검증, 역사적 ACL 출처, Taxonomy8 단일 상품 점검, 백업/PITR 실제 복원, 독립 보안 오너, #1208 및 명시적 배포 승인이 미완료다. **Draft / RELEASE HOLD.**
