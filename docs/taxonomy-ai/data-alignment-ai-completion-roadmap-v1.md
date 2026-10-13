# BEJEWELY — 데이터 정렬 & AI 트랙 완결 로드맵 v1

> Track: **taxonomy-ai / Data Alignment & AI** · 작성: 2026-10-13 KST
> 저장소: https://github.com/gycha0109-beep/K_beauty
> 조사 기준: **main b017fd90e9cf9d624e499f787f06949ad5613d9d** (작성 당시 스냅샷)
> 상태: **통합 로드맵 신설 — 본 문서는 설계/실행 순서이지 작업 완료, Production 승인 또는 DB 정합성 증명이 아님**
> Watchtower-Track: taxonomy-ai

## 0. 목적, 범위, 완결의 정의

### 목표

BEJEWELY의 데이터 정렬·AI 계층이 **원본 상품 → 카탈로그/판매 옵션 → taxonomy/Subject/Fact/근거 → 추천 후보 승인 → 스코어/설명 → 자연어 Product Query → 소비 UI**까지 연결되며, 최신 실제 데이터·권한·회귀 결과로 검증되고 안전하게 운영되는 상태에 도달한다.

**완결**은 단순히 코드가 있거나 CI 한 개가 초록색인 상태가 아니다. 서로 다른 데이터 주체와 승인 경계를 유지하면서 아래 산출물이 모두 존재해야 한다.

- 운영 대상 서버와 실제 DB identity, migration/object/permission 정합성의 **독립된 증명**
- Product / Variant-SKU / Offer / Subject / Category / Fact / Evidence / Review의 **정확한 scope·lineage** 및 미해결 HOLD 목록
- 운영에 실제 **승인된 후보 집합**을 사용한 추천·AI 질의 회귀 결과(점수·순위·출처·설명 포함)
- 상품·근거·추천·AI 검색의 오류/불충분/권한 실패 시 **fail-closed** 동작
- Security·Platform·도메인 오너의 별도 승인, Production 스모크/롤백 및 재검증, 재현 가능한 운영 문서

### 포함

1. DB/migration inventory 정렬과 서버 연결 신원 검증.
2. 기존 카탈로그 상품/기획세트 분리, taxonomy·Source Binding·리뷰 귀속과 Product Fact의 정합성.
3. 추천 admission/semantic authority/실제 ranking, SPF·UVA·내수성(해당 경계), Product Query AI 품질·운영 검증.
4. Premium/Face Lab 등 소비자가 **기존 canonical 계약**을 위반하지 않는지 공급 경계 검증.
5. 기존 CI·증거·오너 승인 경로의 통합과 지속 운영.

### 제외 및 책임 분리

- Face Lab 고유의 얼굴 분석·시뮬레이션 품질, UX 재설계, 비즈니스 수익화는 **face-research/제품 트랙의 별도 범위**. taxonomy-ai는 canonical 상품 정보 공급 계약만 담당.
- 권한/인증/RLS/SECURITY DEFINER 및 공급망 취약점의 최종 수정·승인은 **security** 소관.
- 실제 Supabase migration 적용, Vercel 환경·DB 연결·배포는 **platform/DB 운영** 소관.
- 자동 데이터 추론만으로 상품 Fact confirmation, 리뷰 귀속, 신규 candidate admission, Production ranking 활성화를 부여하지 않는다.
- R16I 에스네이처 사례는 **전체 트랙의 한 사례**이지 이 로드맵 자체가 아니다. R16I 세부 절차는 [기존 정정 로드맵](r16i-r4-product-correction-roadmap-v1.md)을 그대로 유지한다.

## 1. 기존 자료 조사와 현재 상태 (스냅샷 / 재확인 필수)

저장소를 재귀적으로 확인한 시점에 로드맵 이름을 가진 파일은 기존 **R16I-R4 특정 상품 정정** 문서 하나였다. DATA-AI/데이터 정렬 전 영역을 포괄하는 단일 완결 로드맵은 확인되지 않았다. 기존 계약·구현·감사 문서는 그대로 유지하고 이 문서가 실행 순서와 종료 판정의 상위 인덱스 역할만 한다.

| 영역 | 실제 기존 기준 또는 구현 | 2026-10-13 현재 판정 |
| --- | --- | --- |
| 운영 절차 | [AGENTS.md](../../AGENTS.md), [.codex README](../../.codex/README.md), [.codex AI_ROUTER](../../.codex/AI_ROUTER.md), [PROJECT_SYNC_RULES](../../.codex/PROJECT_SYNC_RULES.md) | 존재, 반드시 우선 적용 |
| migration 공통 감사·CI | **database-integration.yml**, **scripts/verify-database-integration-authority.mjs**, #1213, [책임 이관](../architecture/taxonomy-ai-face-lab-ownership-20261012.md), #1209 | 구현/역사적 증거 존재; **서버 DB 동일성·현재 full reconciliation 미완료** |
| 카탈로그 / Source·Offer | Products / product_source_bindings / product_offers, 카탈로그 확장·정확동일성/분류 evidence, R16I #1204 | 운영 범위 재측정·상품별 정정 근거 필요 |
| Taxonomy / Fact / Trust | Canonical Taxonomy Assignment, product_fact_* 및 Evidence Source-Subject lineage, admin review | 개별 파이프라인 존재, 미확정/충돌 항목 전수 재평가 필요 |
| 추천 | legacy frozen corpus, 초기 admission/G2, Product Fact semantic projection, sunscreen protection-axis 정책 | 단위 계약·부분 activation 존재; **실제 운영 승인 후보 풀 전체 검증 필요** |
| Product Query / AI | DATA-AI1~29 시리즈, [DATA-AI25 런북](../product-query-data-ai25-post-launch-runbook.md), Product Query provider/semantic/readiness 코드 | 개별 구현·과거 issue closure 존재; 현재 운영 E2E/품질 승인 별도 검증 |
| Face Lab 공급 | [ownership contract](../architecture/taxonomy-ai-face-lab-ownership-20261012.md), [canonical consumption contract](../architecture/taxonomy-ai-face-lab-canonical-consumption-contract-v1.md) | 공급/소비 계약 수립, 모든 Production reader 연결까지 증명한 것은 아님 |
| 보안 | #1208 및 별도 security PR #1240 | **Supply Chain Security RED, 해제 금지** |
| R16I | #1204 / PR #1255 / [세부 R16I 로드맵](r16i-r4-product-correction-roadmap-v1.md) | 회귀·읽기 전용 증빙 일부 통과; checkout/owner 승인 및 Product/Offer 실제 정정 **HOLD** |

**수치의 시점 주의:** 2026-10-13 연결된 Supabase 후보에는 Product **176행**, 기존 frozen 추천 fixture는 **164개**였다. 신규 12행 중 category null **10건**, 구조상 sunscreen으로 project 가능한 **2건**의 실제 운영 admission 승인 여부는 미확인. 역사적 fixture의 164×12 또는 격리 shadow 7,920 비교를 **176개 실서비스 추천 후보에 대한 승인 완료**로 표현하지 않는다. DB 수치/승인 결과는 이후 시점에 재SELECT·재확인한다.

**정리되지 않은 PR은 main이 아님:** 조사 시점 #1209 migration 인수 PR OPEN, #1225 Production identity PR OPEN, #1255 R16I PR OPEN, #1240 보안 PR DRAFT; #1167 Face Lab 소비자 PR은 CLOSED/미병합. 실제 진행 시 각 HEAD/CI/merge 상태를 다시 확인한다.

## 2. 실행 원칙과 단계 진행 방식

- 기준은 **그때의 GitHub origin/main + 실제 PR/CI + 권한 있는 read-only DB**. 문서/과거 채팅/시뮬레이션이 현재 운영 진실을 대체하지 않는다.
- 매 단계는 **조사 → 변경 범위·오너 분리 → 최소 구현 → exact HEAD 검증 → 자기 재검토 → 증거 기록 → 단계 통과/보류 판정** 순서로 수행한다.
- Phase는 의존성을 표현한다. 인증/DB identity 증명이 막혀도 무관한 **오프라인 회귀·문서화**는 병행할 수 있지만 운영 채택/병합/승인 사실로 격상하지 않는다.
- 이미 존재하는 함수·migration/Fact reader·품질 게이트·CI/운영 워크벤치를 재사용한다. 제3의 공통 migration 감사 도구, 새 Face Lab Fact 저장소, 중복 taxonomy scorer/CI workflow를 임의 신설하지 않는다.
- README 또는 AI_ROUTER를 task-specific 장문 문서로 개조하지 않는다. 변경·검증 기록은 **docs/evidence/** 및 필요한 경우 **.codex/AI_WORK_LOG.md**에 남긴다.
- Product, Offer, Subject, Fact, taxonomy assignment, ranking, evidence verdict, 권한·DDL·환경·Production 배포를 수정하려면 **별도 명시적 승인**이 있어야 한다. 탐색 허가 = 쓰기 허가가 아니다.
- 모든 승인 체계에서 **UNKNOWN/HOLD/REJECTED**를 고정. 좋은 평가, 성공적인 모델 호출, 구조적으로 project 가능한 Product라는 이유로 VERIFIED/admitted/ready로 바꾸지 않는다.

## 3. 전체 실행 로드맵

| 순서 | 단계 | 목적·주요 실행 작업 | 통과 조건 / 남은 차단 |
| --- | --- | --- | --- |
| **DA0** | 최신 기준 확정 | origin/main·각 open PR/issue/CI/실제 파일·연결된 후보 DB 관측 재확인. 구현 여부와 증거 상태 매트릭스 작성. 중복/사유 없는 TODO·낡은 문서 구분 | 날짜·HEAD·출처·권한 수준이 적힌 인벤토리, 소유자·우선순위·차단 항목 확정 |
| **DA1** | Production DB·migration 정렬 | #1213 및 기존 migration 비교기/Database Integration CI로 repo↔hosted versions/name/SQL digest/객체 정합성 대조. 공개 bundle ref 아닌 실제 **deployed server** DB 신원 독립 확인. 차이는 정확 원인별로 분류 | 동일 DB identity 증거, 차이 0 또는 각 mismatch별 명시된 HOLD/마이그레이션 계획; 권한없는 DDL 금지 |
| **DA2** | Product / Offer / SKU 정합성 | 176행 후보 카탈로그 재스냅샷, 중복·정체성·category-null·단품/기획세트·seller listing·review scope 분류. #1204 R16I의 80ml 제조사 단품 vs 80ml×2+10ml 판매세트 분리 검토 | 각 대상의 exact Product/Offer 분리 및 증거·소유자 판정. unresolved는 별도 HOLD, 무근거 가격/용량/리뷰 수정 0 |
| **DA3** | Taxonomy / Product Fact / Trust | taxonomy active/canonical vs shadow, Product↔Subject/Variant↔Fact↔Current/Registry↔Source/Evidence lineage 중복·stale·missing 검사. 해당 administrator review/controlled adoption 재사용 | 저장소/후보 DB 각각의 현재 상태 표, conflict별 소유자 결정 또는 HOLD; 원본·현재·근거·리뷰 출처 혼용 0 |
| **DA4** | 추천 후보·Semantic Authority 정렬 | frozen legacy 164, 신규 G2 승인·거부, actual allowed candidates, reviewer authority, 12개 유저 시나리오의 점수·Top 1/3·순위·설명 비교. SPF/UVA/water 축별 분리, hard reject·HOLD 비부활 | 실제 운영 허가된 후보의 cardinality 및 admission 이유 검증, 회귀 golden/parity와 예상 밖 delta 0 또는 근거 있는 별도 승인; 가격/보호축 별도 검증 |
| **DA5** | Product Query / AI 품질·운영 | 기존 자연어 의도/의미 축/제품 설명 계약, provider timeout/retry/schema 오류, 권한 있는 candidate retrieval, 가격·근거 사실성, hallucination/과신, 품질/비용/지연 모니터링 점검. DATA-AI25 이후 이력과 실제 배포/feature gate 구분 | 고정 테스트·adversarial·연동 Preview/허용된 실서비스 cohort 결과와 버전별 품질 지표, failure-path PASS, release 임계값은 근거·오너 승인 후 확정 |
| **DA6** | 소비 UI·교차 제품 계약 | Skin Match Free/Premium, Current Products, 추천 CTA와 Face Lab의 **authorized canonical supplier**만 검증. Fact·추천·시뮬레이션 승인 구분, 실제 Source/Offer URL 보안·대체링크·누락 상태 확인 | 각 UI slot→canonical source 근거 매핑, UNKNOWN/HOLD/REJECTED 보존, 잘못된 가격/링크/Fact 승격 0. Face Lab 고유 모델 품질 수정 금지 |
| **DA7** | 독립 품질·보안·운영 출시 심사 | Database Integration, Main Health, Security Boundary, Supply Chain, 추천·AI E2E/회귀, Preview 관측. #1208 실질 해결 + Production DB 연결·RLS 권한·변경안/백업/롤백·승인 분리. 대상 1개 제한 canary | 모든 owning gate PASS, 권한 있는 오너 signoff, 실제 배포 readback, canary 관찰·롤백 증명; 차단 시 Production 변경 없음 |
| **DA8** | 완료 선언·인수 운영 | 모든 mismatch·HOLD/accepted risk 정리, 새 상품/출처 변경시 재평가 룰, 계측·운영/복구 runbook, 담당자·CI owner·모니터링·후속 backlog 확정 | 아래 Definition of Done 충족하고 문서/CI/DB/실제 Product Query·추천 사용자 흐름에 서로 모순 없는 closure |

### DA0 — 최우선 시작 작업

1. 최신 main HEAD, 다른 트랙 병합 변경, issue #1213/#1204/#1208, PR #1209/#1225/#1255/#1240 상태와 CI를 먼저 읽는다.
2. 실사용 소스가 어디인지 호출 경로로 추적한다. **data/fixture, read-only candidate DB, Production 서버 런타임, 추천 admission 소스**를 각각 명시한다.
3. **DA0 증거 문서**를 docs/evidence/에 기록한다: Product count, category-null, catalog-only 여부, Subject/Fact source, 실제 운영 admission 판정 미입증 목록, Migration 대조 상태, 데이터 질의/AI 활성 상태.
4. 보호된 실행 권한을 확보하지 못한 항목은 **HOLD** 표시하고 안전한 코드/오프라인 검증을 계속한다. 막힌 문제를 피해 우회 시스템을 신설하지 않는다.
5. DA0 종료 시 DA1~DA6의 재현 가능한 착수 목록을 중복 없이 확정한다.

### DA1·DA2 — 중대한 데이터 주체 차이

- migration file version 대응 ≠ 실제 SQL byte equality ≠ DB 객체/권한 equality ≠ 서버 Production 연결 확인. 이 네 가지를 별도로 증명한다.
- category null은 자동 sunscreen 승인 대상이 아니며, taxonomy shadow/canonical 격차와 추천 admission은 별도 판정이다.
- Product(대표 제품), seller Offer(옵션/구성/가격), Subject(정확 처방/실물), Variant·SKU(판매 옵션)는 서로 다른 identity. 리뷰·평점은 seller listing 관찰과 formulation 사실로 구분한다.
- R16I 사례: 기존 Product는 160ml/29,900 KRW의 화해 세트 출처가 혼재. 공식 80ml 단품·기획세트의 **실제 선택 옵션/결제 직전 가격**, 세럼 SKU, 리뷰 모집단 미확인 시 Product/Offer 정정 금지. 현재 세부 구현은 PR #1255에 따로 있으므로 본 완결 로드맵에서 같은 DB 로직을 복제하지 않는다.

### DA3·DA4 — 신뢰와 추천의 권한 구분

- Source index/crawl → Evidence → Fact candidate → Owner confirmation → Current Facts → canonical taxonomy → recommendation admission → semantic ranking은 자동 연결되는 권한 사다리가 아니다. 각 단계의 계약과 승인/기각이 독립적이다.
- Existing approval/reader 관련 기준: **lib/product-intelligence/**, **lib/recommendation-candidate-admission-core.mjs**, **lib/recommendation-admission-authority-reader.js**, **lib/recommendation-product-enumerator.mjs**, **lib/product-source.js**, **lib/skin-match-decision-engine.js**.
- SPF production gating과 UVA / Water axis는 별개. 보호 능력에 대한 근거가 있어도 hard reject/HOLD candidate는 살릴 수 없다.
- Read-only 구조 회귀의 166 projected x 12 x 2 또는 synthetic negative-case 7,920 통과는 **Production admitted candidate count 검증을 대체하지 않는다**. 실허가 판정 RPC 42501과 같은 접근 거부 시 우회·역추론 금지.

### DA5·DA6 — 실제 이용자에게 전달되는 판단

- AI Product Query가 retrieval·근거·추천이 아닌 정보로 추론하는 범위를 구별한다. 모델 출력이 evidence/approval/가격·SPF·피부 안전성의 권위가 되지 않는다.
- 빈 데이터, 출처 충돌, provider 실패, 안전장치 위반, 권한 없는 candidate, 잘못된 직접 구매 URL은 UI에서 소극적으로 대체/보류한다. **“근거없음=안전함” 금지**.
- 허브/리포트/Face Lab의 데이터 읽기 슬롯과 canonical source는 매핑해야 하지만, Face Lab의 자체 로직을 taxonomy-ai 코드로 이동시키지 않는다.
- 직접링크·Offer seller authority는 별도 정책에 의한 승인 대상. URL host가 진짜라고 전 제품·전 판매옵션에 대한 자동 승인으로 확대하지 않는다.

## 4. 오너·CI·보안 경계

| 책임 | 단일 오너 | 기본 검증·산출 |
| --- | --- | --- |
| Product/Offer/taxonomy/Fact/Source lineage, 데이터 정렬 | taxonomy-ai | Product/Source 정합성·증거·차단 레지스터 |
| CI DB/migration 정합성 | 공통 Database Integration | 기존 database-integration.yml 및 공용 verifier, 필요시 #1209 비교기 인수 |
| 사용 권한·RLS·security advisories | security | Security Boundary / Supply Chain Security, #1208 |
| Vercel Production DB identity, DB migration 및 배포 | platform/DB 운영 | 실제 서버·DB readback, migration 검증, 백업·릴리스 |
| Product Query / AI 공급자 안정성·의미 품질 | taxonomy-ai/Data-AI | 기존 DATA-AI 품질 fixture, provider bounded E2E, 현재 활성 범위 |
| Premium UI·Face Lab 소비 및 시뮬레이션 | 각 소비자 트랙(face-research 포함) | 기존 소비자 계약/스모크, supplier canonical 권위 존중 |

CI 성공을 과장하지 않는다. **Current Main Health, Database Integration, Security Boundary, Supply Chain Security, 각 recommendation/Product Query 테스트**는 서로 독립된 증거다. Security #1208 RED이면 관련 코드 PR 병합·릴리스는 HOLD. 만료 예외 날짜 연장, 취약 패키지 감추기, CI skip/강제 병합 금지. DB·RLS·Production 키 접근권도 임의 높이지 않는다.

## 5. 각 Phase 종료 문서 형식

모든 단계가 완료/보류될 때 docs/evidence/의 별도 기록에 아래 내용을 남긴다.

- Phase/목표, 시작·종료 날짜, 정확 branch·HEAD·main SHA, 관련 PR/issue.
- 조회한 source-of-truth(파일, schema, **접근된 DB 프로젝트/권한**, 배포 ref)와 **관측/추정/미검증** 구분.
- 코드/문서 파일별 변경, before/after 데이터 계약, 재현 명령 및 fixture SHA.
- 검증 CI run + exact SHA, positive/negative·failure cases, 예상 외 delta, 실제 runtime readback.
- **Product/Offer/Fact/Subject/approval/권한/환경/Production write 각각 0 또는 검증된 실제 건수.**
- 보류 원인과 소유자, 필요한 외부 증빙, 통과 기준, rollback/후속 단계, 안전 종료 조건.
- 한 단계가 완료되어도 다른 단계의 보류를 제거하지 않는다.

## 6. 전체 완결 Definition of Done (DA8)

모든 항목을 **실제 증거로** 충족해야 한다.

1. [ ] Production 배포와 DB project/role/runtime identity, migration/current object 차이가 독립 확인됨; 미해결 divergence는 해결 또는 승인된 운영 제외 범위로 명시.
2. [ ] 범위 안의 Product/Offer/SKU/Taxonomy/Subject/Fact/Review source 분류와 residual HOLD가 측정·추적되고, 잘못된 제품 표현을 임의로 승인한 건수 0.
3. [ ] 해당 기능에 실제 승인된 추천 후보 집합과 semantic authority가 수치/ID 기준으로 검증됨; ranking/Top1/Top3/설명 회귀에 예상 외 변화가 없음.
4. [ ] Product Query와 추천을 최신 데이터·시나리오로 검증하고, 오류·환각·불확실성·공급자 실패·보안 부정 경로가 fail-closed.
5. [ ] 사용자 소비 경로가 Product/Offer/Fact/추천/시뮬레이션 권한을 분리하고, direct purchase CTA/가격 출처에 오류 없음.
6. [ ] 관련 Main/DB/Security/품질 CI가 **실제 통합 SHA에서 PASS**, #1208 해결 확인. 다른 트랙 실패를 예외 처리하지 않음.
7. [ ] Production 조치가 필요한 경우 별도 사전 승인, 제한된 rollout, 증거 기반 readback, rollback, 장애 관측 및 인수 완료.
8. [ ] 남은 보류/외부 증빙 목록에 Owner·책임자·기한 대신 **다음 승인/관측 조건**이 있고 정식 종료 판정 문서와 복구 runbook 존재.

## 7. 바로 다음 실행 지시

**다음 채팅/개발 세션은 DA0부터 실제 저장소를 조사하고 구현 가능한 가장 작은 안전한 결손 하나를 해결한다.**

1. 본 로드맵, AGENTS → .codex README → AI_ROUTER 순으로 읽되, 관련 세부 파일만 선택한다.
2. 원격 main·PR/issue·CI·연결된 Supabase/Vercel의 최신 상태를 읽고 오래된 숫자/PR 상태를 교체한다.
3. DA0 인벤토리에서 어떤 항목이 이미 충족됐고 무엇이 HOLD인지 근거·권한과 함께 표기한다. 단지 기존 업무를 다시 문서화하기 위해 중복 구현하지 않는다.
4. 승인 없이 진행할 수 있는 코드/오프라인 테스트·문서·정밀 비교부터 진행하고 exact HEAD 검증한다.
5. Protected Area 변경이 필요하면 그 작업만 명확하게 HOLD하고, 수행 가능한 다른 안전 단계로 이동한다.
6. 전체 결과는 **완료 / 검증 / 차단·리스크 / 다음 작업** 네 항목으로 짧게 보고한다. 예상 시간, 백그라운드 수행 또는 확인되지 않은 완료를 약속하지 않는다.

**이 문서의 작성·병합 자체는 DATA & AI 전체 기능의 완료나 Production/owner 승인에 해당하지 않는다.**
