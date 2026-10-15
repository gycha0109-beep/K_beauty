# D8K-7 — 로컬 Docker PostgreSQL 17 격리 검증 실행 안내

> 작성: 2026-10-15 · Track: taxonomy-ai
> 상태: **LOCAL_RUNNER_READY / STATIC_CHECK_PASS / REAL_PG17_RUN_BY_OWNER_PENDING**
> 연결: D8K-6 Draft PR #1329 기준 신규 stacked Draft PR
>
> 대상은 **사용자 본인 로컬 Docker Desktop의 일회용 컨테이너**다.
> 운영/스테이징 Supabase, 호스팅 DB, 현재 실행 중인 Docker DB에는 접속하지 않는다.

## 1. Windows PowerShell에서 실행

필요: Docker Desktop이 켜져 있고 **Linux containers** 모드이며, Node.js 22 이상, Git이 설치되어 있어야 한다.

저장소 루트에서 실행:

```powershell
git fetch origin feat/taxonomy-ai/d8k7-local-docker-pg17-acceptance-20261015
git switch --detach FETCH_HEAD
docker pull postgres:17
node scripts/product-evidence/run-d8k7-local-pg17.mjs --check-files
node scripts/product-evidence/run-d8k7-local-pg17.mjs
```

`git switch --detach FETCH_HEAD`는 현재 작업 브랜치를 덮어쓰지 않기 위한 명령이다. 작업 트리에 미커밋 변경이 있다면 Git이 전환을 거부할 수 있으며, **강제 전환·reset은 하지 않는다**. 필요하면 별도 worktree를 사용한다.

성공하면 출력에 다음 두 행이 포함되어야 한다.

```text
D8K7_PG17_SQL_ACCEPTANCE_PASS
D8K7_LOCAL_DOCKER_PG17_PASS
```

실패하면 `D8K7_LOCAL_DOCKER_PG17_FAIL` 메시지와 어떤 SQL fixture 단계에서 중단되었는지 함께 전달한다. **성공 마커가 두 개 모두 나오지 않으면 완료 판정 금지**.

## 2. 도커 안전 경계

`scripts/product-evidence/run-d8k7-local-pg17.mjs`

- `postgres:17` 이미지를 **사전 다운로드**해야 한다. 실행기는 임의로 원격 이미지를 pull하지 않는다.
- 로컬 Docker context만 허용(`unix://`, Windows `npipe://`). `DOCKER_HOST`가 TCP/SSH 원격이면 중단한다.
- `docker run --network=none --pull=never`로 일회용 `bejewely-d8k7-<PID>-<random>` 컨테이너를 생성한다.
- **호스트 port 매핑 없음, bind mount/volume 없음**. DB data는 컨테이너 tmpfs에만 존재한다.
- `.env.local`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` 등 애플리케이션 환경설정을 읽지 않는다. 네트워크가 막혀 있으므로 Supabase 연결 통로도 없다.
- 7개 정확한 저장소 파일만 `docker exec ... psql -f -` 표준 입력으로 전달한다.
- 정상 종료/실패 시 그 실행기가 만든 컨테이너만 `docker rm --force` 한다. 기존 Docker DB·이미지·볼륨은 제거하지 않는다.
- `docker pull postgres:17`은 이미지 확보를 위한 별도 수동 명령이며 컨테이너 네트워크 격리와 무관하다.

## 3. 시험 자료

실행 순서:

1. `tests/fixtures/product-offers/20260910102500_product_offers_runtime_seed.sql`: 가상 Product 2개
2. `supabase/migrations/20260910103000_product_offers_shadow_v1.sql`: 부모 seller/listing 테이블
3. `tests/fixtures/product-offers/20260913050000_product_offer_read_runtime_role_seed.sql`: 전용 실행 역할
4. `supabase/migrations/20260913052338_data_offer16_offer_presentation_authority_read_v1.sql`: 기존 제한적 reader owner·column grants
5. `docs/taxonomy-ai/sql/d8k5-selected-option-evidence-schema-review-only.sql`: **이번 PR에서 복구한 스키마 후보**. 실제 프로젝트 마이그레이션 아님
6. `docs/taxonomy-ai/sql/d8k5-selected-option-private-read-review-only.sql`: 읽기 전용 RPC 후보, 직전 결과 범위 256개
7. `tests/fixtures/product-offers/d8k7-selected-option-local-pg17.sql`: 가상 선택옵션·검토·취소·범위·RLS assertions

별도로 순수 `postgres:17` 이미지에는 Supabase의 `anon`, `authenticated`, `service_role` 역할이 없어 runner가 임시 NOLOGIN 역할을 만든다. 역할을 호스팅된 Supabase와 동일하게 전부 재현한다는 뜻이 아니다. 실제 hosted 정책·JWT·권한 검증은 별도로 필요하다.

## 4. 반드시 확인하는 시나리오

| 영역 | 통과 조건 |
| --- | --- |
| SQL 구조 | 깨진 스키마 파일 재발 없음, 2개 자식 테이블·제약·정책 실제 생성 |
| 리스팅 | 한 Offer listing 아래 여러 selected-option observation을 저장 |
| 정상 값 | 단품/기획세트, 배송비 unknown(NULL), 무료배송 0, 유료배송 3,000원 |
| 철회 | 나중에 `rejected`로 바뀐 관측은 이전 `verified`로 되돌아가지 않음 |
| 미검토 갱신 | 새로 관측한 미검토 선택옵션이 기존 승인 가격을 차단 |
| 근거 독립성 | 동일 수집자/검토자, 원본 SHA-256 불일치는 쿼리에서 제외 |
| SQL CHECK | 배송비 `unknown`인데 0원 저장하려 하면 PostgreSQL check_violation |
| 읽기 제한 | 65개 Product ID, 257개 적격 옵션은 전체 NO_AUTHORITY. 부분 가격 반환 금지 |
| 실제 역할 | `anon`, `authenticated`, `service_role` child SELECT·RPC EXECUTE 거부. `recommendation_admission_runtime` child 직접 SELECT 거부 / RPC 내부 실행은 성공 |
| 개인정보·링크 | 결과 DTO에 `listing_url` 및 외부 구매 링크 없음 |

**중요:** 이 검증은 실제 PG17 SQL/RLS/role 동작을 확인하지만 **판매처 가격의 진실성, 증거의 진짜 발행자, 실제 서버 인증/사용자 접근권, 상품 admission, 구매 CTA, 브라우저 렌더링, 호스팅 Supabase 안전성**을 보증하지 않는다.

## 5. 발견했던 결함과 수정 내용

기존 D8K-6 Draft PR의 schema SQL이 약 19KB로 비정상 중복됐고 `collector_actor_key`/리뷰 digest CHECK 도중 문자열이 끊겨 **실제 PG에서 실행 불가능한 상태**임을 발견했다. 이전 정적 verifiers는 존재하는 키워드만 확인하므로 감지하지 못했다.

D8K-7에서는 해당 파일을 원래 의도대로 2개 테이블/제약/권한만 포함하도록 재구성했고, 무분별한 반복을 방지하는 정적 길이/테이블/COMMIT 횟수 검사도 추가했다.

- `scripts/product-evidence/verify-d8k7-local-pg17-harness-v1.mjs`: Node만으로 실행 가능한 정적 안전 검사 (44 assertions PASS)
- 기존 `scripts/product-evidence/verify-r16i-price-scope-review-v1.mjs`에서 이 정적 검사를 로드
- **실제 PG17 PASS는 사용자 로컬 Docker 실행 결과가 돌아오기 전까지 미확인**

## 6. 다음 실행 단계와 중단 규칙

1. 사용자가 로컬 Docker에서 성공 마커/실패 로그를 공유
2. 실패 시 해당 정확한 SQL/권한 결함을 새 PR 내에서 보수하고 **같은 로컬 재검증**
3. 실제 PG17 통과 시에도 별도 승인 없이 스키마를 운영 migration으로 승격하지 않음
4. 인증된 옵션 수집자·검토자와 리뷰 원본 저장/해시 검증, 서버-only read 및 Product admission을 별도 구현
5. 무료·프리미엄 UI는 하드 OFF 유지. 실제 가격·구매 CTA·공유 페이지 변경 금지
6. 보안 이슈 #1208 해결 및 별도 병합·배포 승인까지 HOLD

**DO NOT:** `supabase db push`, `supabase db reset`을 기존 프로젝트에서 수행하거나, 개발/운영 DB를 대상으로 SQL 후보를 붙여넣지 않는다. 이 명령은 Docker 컨테이너를 스스로 생성하고 소멸시키는 실행기에서만 허용한다.

## 7. 사용자 로컬 Docker 실행 결과 접수 — 2026-10-15

**판정: USER_REPORTED_LOCAL_PG17_ACCEPTANCE_PASS / PRODUCTION_HOLD**

사용자가 Windows PowerShell `D:\\cha\\K_beauty`에서 실행 후 콘솔 출력을 제공했다.

- `docker pull postgres:17`: 다운로드 완료.
- `node scripts/product-evidence/run-d8k7-local-pg17.mjs --check-files`: `D8K7_CHECK_FILES_PASS (7 repository SQL files, 2 schema tables)`.
- `node scripts/product-evidence/run-d8k7-local-pg17.mjs`: fixture 1/7부터 7/7까지 실제 Docker PG17에 적용.
- 성공 마커: `D8K7_PG17_SQL_ACCEPTANCE_PASS` 및 `D8K7_LOCAL_DOCKER_PG17_PASS`.
- 접근권한 거절 출력: `PG17_DENIED_AS_EXPECTED` 7회 — anon(2), authenticated(2), service_role(2), recommendation_admission_runtime(1).
- 최종 정리: `Removed disposable local PG17 container.`

해석: 사용자 제출 콘솔 로그로 **격리 PG17에서 실제 SQL fixture 실행 및 assertion 통과**가 뒷받침된다. Assistant가 Docker를 직접 실행한 것이 아니며, 콘솔 출력만으로 로컬 `git rev-parse HEAD`나 DB 버전/이미지 digest 전체 로그의 독립 진본 검증은 할 수 없다. 이 결과는 원래 D8K-7 실행 명령의 관측이며 **별도 호스팅 DB/RLS/서버 권한/실물 판매처 수집·검토/Next UI E2E의 통과가 아니다**.

**검증 상태 변경:** `LOCAL_RUNNER_READY` → `LOCAL_PG17_RUNTIME_ACCEPTED_BY_OWNER_LOG`. DB 스키마/role의 생산 환경 마이그레이션, 구매 링크·가격 공개, 병합 및 배포는 계속 HOLD. 다음 실질 단계는 판매처별 실제 선택옵션 수집·검토 evidence provenance와 인증된 서버 경계 설계·검증이며, 기존 R16I 운영 증거 검토 경로와 중복 구현하지 않는다.
