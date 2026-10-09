# DATA-AI29C-FILTER-R4-C-R3 — BUSHMAN 격리 PostgreSQL 실행 검증

- 판정: `ISOLATED_RUNTIME_PASS / PRODUCTION_HOLD / PR_UNMERGED`
- 저장소: `gycha0109-beep/K_beauty`
- R2 병합 SHA: `5f153f350b2766928d1e0eb4d6b3bb6887c0bcc2`
- R3 최초 격리 DB PASS SHA: `f3e93d31c27357200115c2cfd6513be1c1c2b5bd`
- R3 추가 동시성·COSRX 공존 PASS SHA: `ead6101e318d26ce9f4138476592c8e48da5daff` (실행 당시 테스트 파일과 migration blob은 이후 clean squash에서도 동일; 최종 PR HEAD는 CI 재확인 대상)
- 추가 실행: [GitHub Actions 37834813478](https://github.com/gycha0109-beep/K_beauty/actions/runs/37834813478), 실제 성공 단계 및 로그 확인
- 실행: [GitHub Actions 37831377946](https://github.com/gycha0109-beep/K_beauty/actions/runs/37831377946) / PostgreSQL 17.6 disposable service / loopback `127.0.0.1:54329`
- Production Supabase: `bygrczggxfuisupcevaz` (여기에는 R2/R3 migration 및 테스트 fixture 적용 금지)
- R3 PR: [#1174](https://github.com/gycha0109-beep/K_beauty/pull/1174) (검증 중, 미병합)

## 재현된 보안 결함과 조치

최초 실제 실행에서 R2 Confirmation은 동일 actor / request ID에 대한 idempotent replay 시 **전달된 payload 자체를 재해시하지 않고** 기존 payload digest와 인자로 전달된 expected digest만 비교했습니다. 원본 payload를 변경하면서 이전 digest를 함께 전달하면 다른 payload로도 idempotent success가 반환되는 결함을 격리 PostgreSQL에서 재현했습니다.

R3 보수 migration `20261009043000_data_ai29c_filter_r4_c_r3_bushman_replay_digest_guard_v1.sql`은 기존 BUSHMAN Confirmation 본체를 내부 함수로 이동시킨 뒤, 권한을 회수하고 외부 RPC에서 canonical SHA256(JSONB)를 재계산한 후 본체를 호출합니다. R2의 기존 SQL 파일은 변경하지 않습니다. COSRX RPC, Admission, 추천 scorer, Beta allowlist 변경은 없습니다.

## 실제 SQL 실행 결과

| 항목 | 격리 DB 실행 결과 |
|---|---|
| R2 + R3 migration DDL 및 함수 생성 | PASS |
| Pg17 role grant / RLS + FORCE RLS | PASS |
| anon/authenticated RPC 거부, service_role 내부 plan 직접 실행 거부 | PASS |
| service_role의 Subject 직접 UPDATE 거부 | PASS |
| 관리자 capability 없는 preflight 거부 | PASS |
| Attestation 부재·pending 상태 HOLD | PASS |
| 50g/50ml reconciliation 미완료 HOLD | PASS |
| 다른 Subject / 잘못된 C5 lineage / semantic key 거부 | PASS |
| 공식 Product Binding / Official Review 불일치 거부 | PASS |
| Source 4건 누락·변경 / digest 변경 / 비공식 URL 거부 | PASS |
| Preflight read-only·deterministic digest | PASS |
| stale prestate Confirmation 거부 | PASS |
| 격리 fixture 정상 Confirmation: 정확한 Subject 1 / review event 1 / audit log 1 변경 | PASS |
| Subject 비권한 필드 및 Fact Current / Source 무변경 | PASS |
| 같은 요청 재시도: 추가 감사·이벤트 0 | PASS |
| 같은 request ID + 다른 payload: 거부 | PASS (R3 보수 후) |
| Confirmation 트랜잭션 ROLLBACK 후 기존 Subject·테이블 복구 | PASS |
| 사전조건 없는 DB에서 R2 migration 실패와 부분 스키마 미잔존 | PASS |
| 독립 Postgres 2세션 동시 Confirmation: 1건 최초 승인 + 1건 멱등 재시도 | PASS (추가 실행) |
| 동일 요청 동시성에서 review event·audit 각각 1건만 기록 | PASS (추가 실행) |
| 기존 COSRX migration 병행 적용, 권한·비인가 요청 거부 smoke | PASS (추가 실행) |
| 동시성 테스트 DB 명시적 폐기 | PASS (추가 실행) |
| GitGuardian commit-history secret scan | PASS (clean squash HEAD) |

테스트는 `00_schema_fixture.sql`의 **합성 schema/row**를 사용합니다. Product ID/Subject ID는 고정 계약 확인 목적이고, 가상의 attestation 승인은 격리 DB 안에서만 생성된 것입니다. 실제 관리자 승인 또는 제조사 동일성 증거로 사용할 수 없습니다.

## 범위와 잔여 리스크

1. 실제 Production 데이터베이스의 17.6 계열과 같은 PostgreSQL major 버전으로 실행했지만, **전체 Production schema/모든 제약·트리거를 복제한 시험은 아닙니다.** 필요한 public schema 컬럼/함수 중 핵심 계약을 격리 재현했습니다. 특히 admin audit helper는 테스트 fixture의 제한된 구현을 사용합니다.
2. 기존 COSRX RPC는 파일 및 함수 정의 변경 대상이 아닙니다. 동일 격리 DB에서 COSRX migration과 RPC를 함께 설치하고 비인가·없는 Subject 요청에 대한 거부 동작을 실행했습니다. **COSRX 실제 승인 성공 경로·멱등성 전체 회귀는 미검증**입니다.
3. 실제 독립된 두 PostgreSQL 세션으로 동일 요청을 경쟁 실행했고 advisory/row lock 이후 최초 승인 1건·멱등 재시도 1건 및 감사·이벤트 중복 없음이 PASS했습니다. **서로 다른 요청 ID의 경합·장시간 데드락/장애 회복은 추가 검증 대상**입니다.
4. 관리자 승인 없는 실사용 Attestation writer는 미구현입니다. `50g` Subject vs 공식 URL `50ml`의 동일성은 미확인 상태입니다.
5. R2 migration과 R3 보수 migration은 운영 적용 시 반드시 하나의 승인된 배포 게이트에서 연속 적용해야 합니다. 두 migration 모두 현재 Production 적용 **미승인**입니다.

## Production 단계

- Production migration: **NOT APPLIED / NOT AUTHORIZED**
- Actual BUSHMAN Subject Confirmation: **NOT AUTHORIZED**
- Actual Admin Identity Attestation: **NOT ISSUED**
- Semantic Review 12/12: **NOT APPROVED**
- Admission, Ranking, Beta, Recommendation: **UNCHANGED / NOT ACTIVATED**

**판정 원칙:** 이번 PASS는 '격리 SQL 런타임'만 의미합니다. R4-C-R4의 실세계 Subject authority 확인이나 R4-F의 추천 활성화를 허가하지 않습니다.
