# BEJEWELY — taxonomy-ai / Face Lab 데이터·운영 책임 이관 (2026-10-12)

> 트랙: `taxonomy-ai` · 기준 저장소: `gycha0109-beep/K_beauty`
> 조사 main: `487021eea2b163ccaf01aabb93ae7994dd00c401`
> 작업 범위: 소유권/계약/중복 조사 정리. 운영 DB·배포·GRANT/RLS·보안 예외 변경은 포함하지 않음.
> 본 문서는 **책임 선언과 검토 지침**이다. 미병합 PR의 구현을 main에 이미 존재하는 것으로 간주하지 않는다.

## 1. 실제 파일·기능 수준 책임 매핑

| 자산·함수 | 현재 위치 / PR | 종전 작업 트랙 | 단일 주책임 | 처리 | 확인 근거 및 주의 |
| --- | --- | --- | --- | --- | --- |
| `reconcileMigrationInventory`, SQL 지문·버전/이름 비교, CSV/요약 렌더러 | `scripts/facelab/audit/migration-reconciliation-core.mjs` (main 및 #1209) | face-research | **taxonomy-ai** | **인수·재사용** | 전체 `supabase/migrations` 목록 대조. 현재 경로는 유지, 새 비교기 생성 금지. `HOLD`는 적용 증거가 아님 |
| 엄격 비교 CLI, 검증 fixture | `compare-face-lab-migration-history.mjs`, `verify-face-lab-migration-history.mjs` (#1209에서 확장) | face-research | **taxonomy-ai** | **인수·검증 공동 유지** | 순수 오프라인 입력/검증. 기존 Face Lab Foundation CI 경로를 일단 그대로 활용 |
| 중복 버전 보존·후보 진단 코어, inventory/candidate 검사 CLI | `candidate-migration-differences-core.mjs`, `inspect-face-lab-migration-inventory.mjs`, `inspect-face-lab-migration-candidates.mjs` (#1209, 미병합) | face-research | **taxonomy-ai** | **인수 대기** | 8자리 `20260824` 중복을 수정하지 않고 드러냄. 마이그레이션 이력 전체의 소유권 |
| 범용 `pg_catalog` 메타데이터 **조회 방법·증거 무결성·공통 정합성 해석** | `scripts/facelab/audit/sql/face-lab-v2-catalog-readonly-v1.sql`, `catalog-evidence-evaluator-core.mjs` 중 재사용 가능한 기술 부분 (#1209) | 혼합 | **taxonomy-ai** | **기법 인수, 파일 이동·추출 보류** | 데이터 소유권과 DB 실행권은 다름. 실물 조회 결과는 별도 인가가 필요 |
| Face Lab 고유 필수 객체·컬럼·CHECK·endpoint·함수 서명·미확정 시 보류 | 위 SQL 및 `catalog-evidence-evaluator-core.mjs`, `evaluate-face-lab-catalog-evidence.mjs` (#1209) | face-research | **face-research** | **유지** | `saved_reports.face_lab_revision`, 요청 제한/멱등성 테이블 및 관련 RPC. 공통 모듈로 억지 이전 금지 |
| RLS/GRANT/인증·SECURITY DEFINER 위험 승인 | #1209 객체 메타데이터, 관리자 함수, `scripts/verify-supply-chain-audit.mjs` | 혼합 | **security** | **공동 검토·수정 보류** | 조회 결과 경고 ≠ 취약점 확정. Security의 최종 판단 없이 권한 변경 불가 |
| 서버 Production project identity, 연결 대상·배포 환경 | #1225 `production-identity-readback-core.mjs` 및 admin route | face-research | **platform/DB 운영** | **운영 소유권 이관 제안 / PR 유지** | 공개 번들 ref는 영구 기준이 아님. 승인된 실제 server runtime 확인 필요 |
| `saved_reports.face_lab_revision`에 대한 HEAD 검증, Face Lab 전용 응답 `HOLD` | #1225 route / verifier | face-research | **face-research** | **기능 유지** | 공통 DB 상태 판정이나 운영 identity 확인과 혼동 금지 |
| 공통 상품 Catalog/Subject/Fact/Current/Registry, 출처·증거·후기 신뢰 | `lib/product-intelligence/automatic-product-evidence-db-reader-v1.mjs`, `automatic-product-evidence-evaluator-v1.mjs`, `product_fact_*`, TRUST/관리자 워크벤치 | taxonomy-ai | **taxonomy-ai** | **기존 권위 유지** | current Subject 단일성·`resolved` 검증, Fact→Evidence→Source/Subject binding lineage 재사용. 새 Face Lab Fact DB 금지 |
| Face Lab의 상품 요청·승인된 읽기·Variant/Slot/참조자료 검증 | `lib/face-lab-v2/catalog-product-try-on-read-core.js`, `catalog-product-try-on-binding.js`, `catalog-reference-resolver.js`, #1167 `try-on-catalog-read-bridge.js` | face-research | **face-research** | **소비자 계층 유지** | 허가된 source 주입·매핑·이미지 무결성 검증. 원본 신뢰 판정 새로 만들지 않음 |
| Migration 파일명 수정 제안 | #840 | face-research | **taxonomy-ai** | **보류·재검토** | 파일명을 맞추더라도 실제 SQL 적용·hosted identity는 증명되지 않음. 오래된 merge-base, 자동 병합 금지 |
| 운영 migration 적용/백업/DB role/Preview·Production 환경 | Supabase / Vercel 운영 | 혼합 | **platform/DB 운영** | **별도 승인 필수** | taxonomy-ai는 read-only 진단 규격과 근거만 제공 |

**코드 위치와 책임은 별개입니다.** 이관 단계에서는 `scripts/facelab/audit/`의 구현을 다른 디렉터리로 복제하지 않습니다. #1209는 현재 open PR이므로 해당 구현 전체가 main에 들어온 것으로 표기하지 않습니다.

## 2. 기존 PR·Issue 처리 결정

| 대상 | 현 상태(조사 시점) | 처리 방침 |
| --- | --- | --- |
| [#1209](https://github.com/gycha0109-beep/K_beauty/pull/1209) | open; Face Lab CI 성공, 공급망 CI 실패 | **분리된 소유권으로 유지**. migration 비교기·후보 진단은 taxonomy-ai가 유지보수. Face Lab 객체 expectation은 Face Lab 유지. 기존 PR/fixture/CI 증거 보존, 보안 해결 전 병합 금지 |
| [#1225](https://github.com/gycha0109-beep/K_beauty/pull/1225) | open; Face Lab CI 성공, 공급망 CI 실패 | **유지+운영 인수 제안**. 플랫폼은 연결 식별 절차, Security는 관리자 인가, Face Lab은 HEAD 대상 계약. 유사한 admin endpoint 중복 구축 금지 |
| [#840](https://github.com/gycha0109-beep/K_beauty/pull/840) | open; 최근 main 대비 크게 뒤처짐, 과거 CI 성공 | **HOLD**. migration version rename은 실제 대상 DB 이력/SQL/객체 대조 및 새 main 리베이스 이후에만 판단. 과거 CI 성공은 현재 병합 근거 아님 |
| [#1167](https://github.com/gycha0109-beep/K_beauty/pull/1167) | open; main보다 뒤처짐, 과거 CI 성공 | **Face Lab 소비자 계층으로 유지**. 공급자는 taxonomy-ai canonical 계층. Subject `variant_key`와 별도 승인된 commerce `variantId` 혼용 위험 검토, 신규 권한/RPC 자동 추가 금지 |
| [#1213](https://github.com/gycha0109-beep/K_beauty/issues/1213) | open | 공통 migration reconciliation 주관을 taxonomy-ai로 변경; Face Lab 객체 의존성은 별도 체크 항목; Security·Platform 독립 승인 |
| [#1208](https://github.com/gycha0109-beep/K_beauty/issues/1208) | open | Security가 공급망 gate를 해결할 때까지 관련 PR 병합 보류. 임시 예외 연장/우회 금지 |

## 3. 검증된 사실과 판정 한계

- 2026-10-12 GitHub main 조회 결과: `487021eea2b163ccaf01aabb93ae7994dd00c401`. 인계 기준 `48dfe1f...` 이후 이동함.
- 이 main의 `supabase/migrations` SQL은 **144개**. `20260824` 버전 충돌 그룹 **1개(서로 다른 2개 파일)**. 이 수치는 Git repository 파일 목록 집계이고 hosted DB와 동시 대조한 결과는 아님.
- 조사 시점 모든 4개 PR이 open이며 최신 main과 diverged. #1209·#1225 현재 HEAD의 Face Lab Foundation은 성공, Supply Chain Security는 실패. #840·#1167의 과거 성공 CI를 최신 main 기준 재검증으로 착각하지 않음.
- 인계문에 적힌 후보 hosted 이력 **171개**, 이름만 같은 후보 **37쌍**, 잔여 **5/33**은 **2026-10-10 기준 스냅샷**. 현재 main 144개와 결합해 현재 정합성이라고 주장하지 않음.
- 공개 클라이언트 bundle ref 및 연결된 Supabase 후보 프로젝트가 같다는 관찰은 있었으나 **서버 runtime Production DB identity·실행 SQL 동일성은 미증명: HOLD**.
- 읽기 전용 도구가 경고를 보고하는 것은 보안 취약점, 사용 허가 또는 운영 적용 사실의 최종 판정이 아님.

## 4. 작업 경계와 단일 CI 소유권

1. **migration inventory / version compare / candidate-only reconciliation:** taxonomy-ai가 검증 책임. #1209의 기존 verifier를 재사용하고 Face Lab Foundation의 현재 실행 연결을 보존한다. 후속 통합 검토 없이 `database-integration.yml` 또는 새로운 taxonomy 전용 workflow에 같은 검사를 추가하지 않는다.
2. **Face Lab 객체 expectation / fail-closed 소비:** face-research가 현재 Face Lab verifier를 유지. taxonomy-ai는 필요한 공통 메타데이터 증거 형식만 협의.
3. **공급망·권한 검사:** Security의 `supply-chain-security.yml`·Security Boundary 책임. 다른 트랙에서 예외를 연장하거나 skip하지 않는다.
4. **실 DB 연결과 migration 실행:** Platform/DB 운영의 별도 승인 게이트. GitHub 오프라인 검사 통과만으로 허용하지 않는다.
5. 신규 관리 API, 새로운 상품 진실 저장소, 신규 migration 검사 구현, 신규 CI workflow 생성은 **이 이관에 불필요**.

## 5. 남은 실행 순서 / 종료 조건

- **이번 이관 범위에서 완료:** 파일별 단일 책임 선언, 기존 도구 재사용 결정, PR 처리 방침, 소비자 계약 문서, 중복 구현 금지.
- **미완료 — 코드 통합:** #1209 및 #1167은 미병합. 실제 코드 공통 추출/생산용 supplier adapter 작성은 해당 PR 최신 main 리베이스·안전/보안 검증 후 필요한 경우에만 결정한다.
- **미완료 — 외부 승인:** Production server identity, 실효 권한/RLS, 실제 마이그레이션 적용 증거. 운영 DB 변경 0건 유지.
- **미완료 — CI:** 공급망 차단은 Security의 정식 의존성 수정과 재검증이 필요. 보안 실패를 Face Lab verifier 성공으로 상쇄하지 않는다.

Watchtower-Track: taxonomy-ai
