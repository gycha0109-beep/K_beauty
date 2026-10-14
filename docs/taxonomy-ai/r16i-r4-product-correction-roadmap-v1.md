# BEJEWELY / taxonomy-ai — R16I-R4 상품 정정 운영 완결 로드맵 v1

> 수립: 2026-10-13 KST · 트랙: `taxonomy-ai` · 상태: **D8-A~D 구현/배포, 실제 Product/Offer 정정은 HOLD**
> 단일 진입점: `/admin/products/r16i-correction-review`
> 관련 이슈: [#1204](https://github.com/gycha0109-beep/K_beauty/issues/1204) (상품 정정), [#1208](https://github.com/gycha0109-beep/K_beauty/issues/1208) (별도 security 공급망 차단)
> Watchtower-Track: taxonomy-ai

## 0. 목적과 권한

기존 에스네이처 제품의 **단품(제조사 80ml)**과 화해의 **판매 기획세트(크림 80ml×2 + 세럼 10ml)** 정보가 1개의 Product 행 안에서 혼재한 상태를 바로잡는다. 단순히 160→80 또는 29,900원을 다른 용량에 대입하지 않는다. 개발 완료와 실제 운영 데이터 변경을 반드시 구분한다.

- 제품 anchor `products.id=b639c8b4-6a61-440e-b4db-fac7381593ff`를 유지하는 **A안**이 현재 구현된 검토 방향이다. A안도 자동 운영 승인으로 간주하지 않는다.
- [공식몰 #151](https://www.snature.kr/product/detail.html?product_no=151)과 [화해 #45194](https://www.hwahae.co.kr/goods/45194)의 현재 선택 옵션·결제 직전 가격·세럼 정확 SKU·리뷰 모집단은 별도 실증이 필요하다.
- 화해 쇼핑의 **기획세트 가격**은 제조사 **80ml 단품 가격**이 아니다. 리뷰 수·시장 신호의 단품 귀속도 미확정.
- **Face Lab 스타일 카탈로그·출판/철회 운영은 별도 트랙**이다. 공유 DB 정체성/보안/CI 문제만 운영 인프라 오너와 협업하고 상품 도메인 모델을 혼합하지 않는다.
- R16B, R16H, ZEROID 등 다른 보류 사례는 변경하지 않는다.
- `AGENTS.md`, `.codex/README.md`, `.codex/AI_ROUTER.md`, `.codex/PROJECT_SYNC_RULES.md`를 따르고 고위험·Protected Areas는 사용자 명시 승인 없이 임의 변경하지 않는다.

## 1. 2026-10-13 기준 확인된 사실 (완료 ≠ 운영 정정)

| 구간 | 구현된 기능 | 근거 / 범위 |
| --- | --- | --- |
| R4-D4~D7 | exact DB readback, 20개 필드, 관리자 메뉴, 운영형 UI | `lib/product-offer-r16i-r4-d4-db-reader.mjs`; 관리자 검토 화면 |
| R4-D8A | DB 실조회 새로고침, 2개 고정 URL의 접근·HTML 상태 조회 | [#1234](https://github.com/gycha0109-beep/K_beauty/pull/1234); 조회 HTML은 실결제 사실 아님 |
| R4-D8B | private PNG/JPEG/WebP 캡처, 사용자 입력, 검증 전 근거 기록, 60초 서명 열람 | [#1235](https://github.com/gycha0109-beep/K_beauty/pull/1235), 정합화 [#1236](https://github.com/gycha0109-beep/K_beauty/pull/1236) |
| R4-D8C | owner 판정 VERIFIED/REJECTED, 필드 변경안, APPROVE_FOR_D8D_REVIEW/HOLD/REJECT 이력 | [#1243](https://github.com/gycha0109-beep/K_beauty/pull/1243), 정합화 [#1244](https://github.com/gycha0109-beep/K_beauty/pull/1244) |
| R4-D8D | owner-only PREVIEW/APPLY/ROLLBACK, Product+Offer 원자적 PG17 합성 데이터 검증, 감사이력·원복 | [#1250](https://github.com/gycha0109-beep/K_beauty/pull/1250), **릴리스 잠금 유지** |
| 운영 | Vercel `k-beauty-two.vercel.app` READY, 연결된 Supabase 후보 `bygrczggxfuisupcevaz`에 D8D 함수/테이블 존재 | 이 DB가 배포된 Vercel **런타임이 실제 연결한 DB인지 별도 증명 필요** |

**2026-10-13 10:04 KST SELECT (연결된 Supabase 후보)**: Product **160ml / 29,900원**, R16I 캡처·정정안·결정·적용 이벤트 **0건**, 대상 Offer·Subject **0건**. `admin_r16i_correction_release_gate_v1.enabled=false`. D8D RPC는 `anon/authenticated EXECUTE=false`, `service_role=true`, apply=SECURITY INVOKER, rollback=SECURITY DEFINER. **실제 Production 상품 정정은 0건**.

**확인된 드리프트:** 저장소 D8D migration 파일명은 `supabase/migrations/20261012181320_taxonomy_ai_r16i_d8d_transactional_apply_v1.sql`, 위 후보 DB 적용 이력은 `20261012181320 / taxonomy_ai_r16i_d8d_transactional_apply_v1`. 이력을 임의 수정하거나 동일 DDL을 재적용하지 않는다. 추가로 최신 main `5fac6c72a3aa3d60887cb63f76f8b772908c40cd`의 Database Integration Authority #38228827854는 실패, Main Health와 Security Boundary는 통과, Supply Chain Security #38228827799는 실패. 실패의 **정확한 원인과 이번 작업의 관련성은 로그를 새로 읽어 판정**한다. 보안 이슈 [#1208](https://github.com/gycha0109-beep/K_beauty/issues/1208) 미해결.

## 2. 다음 개발 단계 — 순서 고정

### R4-D8D-R1 — 운영 정합성·보안 및 마이그레이션 이력 복구 (가장 먼저)

- 최신 `main`, #1250 및 타 트랙 병합 변경, Vercel alias→배포 SHA, 연결된 Supabase 후보의 migrations ledger를 새로 읽는다.
- **실제 Vercel server DB identity가 해당 Supabase 프로젝트와 일치하는지** 비밀키 노출 없는, 관리자 전용 attestation/기존 신뢰 가능한 배포 readback으로 검증한다. 후보 프로젝트에서 SELECT 성공 ≠ 런타임 DB 동일성.
- D8D migrations 파일 버전과 applied ledger의 불일치를 **콘텐츠 해시·스키마 정의·함수 내용 비교** 후 정리한다. 절대로 ledger 조작/DDL 재적용으로만 외관을 맞추지 않는다. 다른 트랙 migrations 충돌은 소유 트랙으로 이관.
- `BEJEWELY_R16I_D8D_APPLY_ENABLED`가 현재 어떻게 구성되어 있는지는 비밀값 없이 안전하게 상태만 확인한다. 승인 없이 true 설정 금지. DB release gate는 false 유지.
- 현재 Database Integration Authority, Supply Chain CI의 정확한 실패 로그를 특정한다. 이번 트랙 직접 원인만 수정하고 다른 트랙 실패는 별도 이슈/담당으로 이관한다. #1208은 **예외 만료 연장으로 우회하지 않는다**.
- rollback의 SECURITY DEFINER 함수 소유자·`search_path`·RLS·RPC 권한 및 테이블 직접 쓰기 권한을 재감사한다. apply/rollback 모두 idempotency·정합성 검사를 유지한다.
- **완료 조건:** schema/ledger 정합, 런타임 DB 정체성 검증(불가하면 명시적 HOLD), 정확한 실패 원인 기록, 새/해당 범위 CI PASS. Product/Offer/Subject write 0.
- **차단 시:** 운영 적용 기능 추가 또는 release gate 활성화 금지. 검증 가능한 read-only/격리 작업만 계속한다.

### R4-D8E1 — 추천·가격·링크 영향 범위 및 Baseline 고정

- 실제 서비스 흐름에서 `products.size_ml`, `price_min/max`, `unit_price_per_10ml`, `buy_link`, `market_signals`, `product_offers`, `product_source_bindings`, `catalog_trust_intake`, `product_fact_subjects`를 소비하는 지점을 추적한다.
- `lib/product-offer-read-path.js`의 현재 `TRUSTED_LINK_SOURCE_POLICIES`에는 화해 소스가 없음. **신규 hwahae Offer가 생성되어도 구매 링크/가격의 canonical authority로 자동 투영되지 않는다**는 위험을 테스트로 확정한다. 출처 추가는 독립적인 근거·권한 심사 없이 하지 않는다.
- 80ml 단품과 80ml×2 + 세럼 10ml의 단위가격, 배송 구성/옵션, 리뷰 귀속, 구매 CTA/상품명/화면 노출 단위의 의미 불일치를 식별한다. D8D migration의 Offer 필드만으로 구성요소/SKU를 온전히 표현하는지 재검토하고 필요시 **별도 도메인 변경 제안**으로 분리한다.
- **164개 Product × 12개 사용자 시나리오 = 1,968케이스**는 기존 R16I 문서의 목표 회귀 범위다. 실제 repository runner/fixture가 이 1,968개를 실행하는지 확인하고, 없으면 기존 추천 런타임 재사용 기반 harness를 구축한다. 단순 숫자 출력/모의 로직으로 통과 처리 금지.
- **완료 조건:** 실제 소비자 호출 그래프·테스트 baseline·선택한 버전의 before 상태/불변식/변경 영향 표 확정. 어떠한 Production 추천/랭킹/가격·링크 투영 write도 없음.

### R4-D8E2 — Shadow before/after 1,968건 및 구매 경로 회귀

- Production 가격을 건드리지 않고 격리 DB/fixture에서 기존 160ml 행과 정정 후보 80ml Product + 화해 Offer를 **동일한 추천 런타임**으로 재생한다.
- 각 시나리오에 대해 후보 수, 제외·노출, 랭킹 점수, 정렬, Top1/Top3, 카테고리, 공식몰 링크, 신규 세트 Offer 별도 표시, unit price 등의 차이를 구조화한다.
- **허용된 변화만** 명세로 문서화한다. 예컨대 공식 단품 가격/구매처 표시는 승인된 범위에서만 변경 가능하며, 원본 리뷰 모집단의 임의 이전·처방 근거 생성·추천 근거 임의 승격은 금지한다.
- 잘못된 단위가격, 세트 가격의 단품 적용, 화해 URL 신뢰정책 우회, 할인·재고 변동, 404/redirect, stale Product revision, evidence 거부, owner 권한 우회, SQL 트랜잭션 실패·rollback drift 등 부정 경로를 추가한다.
- 신규 대형 CI workflow 금지. 기존 product query canonical, Database Integration Authority, Main Health, 관련 contract 테스트를 재사용한다.
- **완료 조건:** 1,968건 실측 PASS/허용 delta 설명, 비허용 delta 0건, 구매 URL·Offer 주입/모호한 리뷰 연결 회귀 PASS. 실패는 해결 후 재검증; 실패를 무시하거나 기준을 낮추지 않는다.

### R4-D8F — 운영 근거·정정안 충족 및 UI 실사용 검증

- owner가 실제 선택 옵션/현재 결제 직전 금액이 보이는 **공식몰 80ml 단품 / 화해 기획세트** 원본 캡처를 직접 제출한다. 개인정보 마스킹, URL·촬영 시각·구성·사은품 세럼 정확 SKU/불명확 항목을 기록.
- 근거 2건은 `UNVERIFIED` → owner가 실제 캡처 확인 후 별도 verdict `VERIFIED` 기록. 단순 HTTP/HTML/검색 색인/텍스트 메모는 최종 결제사실 아님.
- Product 필드별 before/after, 변경 대상과 미변경 대상(특히 리뷰 시장신호·Binding/Intake/Subject)을 명확히 한 D8C 정정안을 제출하고 owner가 `APPROVE_FOR_D8D_REVIEW` 또는 HOLD/REJECT 결정.
- **현재 증빙 0건이므로 자동 샘플 업로드, 가짜 승인 생성, 가짜 결제가 제출 절대 금지**. 외부 원본/운영자 참여가 없으면 이 단계만 HOLD 하고 다른 read-only 과제를 계속한다.
- **완료 조건:** 각 출처의 실제 검증 가능 원본, 판정자와 적용범위, 필드별 approval, D8D PREVIEW 결과와 합치.

### R4-D8G — Production 1건 반영 허가 준비 (실행과 분리)

- D8D apply/rollback 실제 Production 런타임 DB 연결 identity, Schema/ledger, owner auth, signed evidence access, 보안 및 CI를 최종 확인한다.
- #1208 보안 게이트 및 현재 Database Integration Authority 실패가 해소되었는지 확인. **CI 전체 녹색이라고 추정 금지**, 실패 workflow·run ID를 정확히 기록.
- 등록된 exact before snapshot, D8C owner 결정, D8D PREVIEW(쓰기 0), Rollback playbook, 추천/구매 링크 1,968건 shadow 결과가 동일 기준을 바라보는지 검증한다.
- 별도 운영 승인 티켓에 **실제 수정 필드·두 판매처 가격·Offer 대상·검증 결과·되돌리기 조건·담당자·시각**을 기록한다.
- **완료 조건:** 사용자(운영 소유자)에게 정확한 적용 전후값과 남은 영향 보고 후 명시적인 **Production 정정 승인 요청**. 승인 없으면 Gate false/서버 flag unset 유지. D8C의 `APPROVE_FOR_D8D_REVIEW` 자체는 실반영 승인 아님.

### R4-D8H — 승인된 1회 Production 반영·재조회·안정화 (조건부)

- **별도 명시적 승인 이후에만** 서버 flag·DB release gate를 제한적으로 해제하고 승인된 exact D8D 트랜잭션 1회 적용. 마이그레이션/배포만으로 열리지 않게 한다.
- 같은 연결의 Product+Offer canonical readback, audit application/event, idempotency/동시 실행 및 Product/Offer 가격/링크, 추천 시나리오, 구매 CTA, 리뷰 scope를 즉시 검증한다.
- 정합성 문제 발생 시 **무조건 DELETE가 아니라 D8D CAS-검증 원복**을 시도하며, drift로 거부되면 임의 강제 복구 금지/즉시 incident escalation. 서버·DB 게이트 다시 잠금.
- #1204에는 검증된 before/after, 실제 변경 건수, 회귀·영향, rollback 가능 상태만 기록한다. **Owner 승인/결제 증빙/회귀 없이 '실제 상품 정정 완료' 선언 금지**.

### R4-D8I — 재사용성 확장 검토 (파일럿 완료 후 선택)

- 에스네이처 1건이 종료되면 Product+Offer 정정의 일반화 필요성을 결정한다. 고정 Product ID와 판매처 hardcode를 성급히 범용 관리자 API로 확장하지 않는다.
- 향후 배치/다른 품목은 별도 정책·상품별 출처·상품 정체성·Offer 구성/권한/공급망 검사를 거친 후 독립 승인.
- 일반화가 과설계라면 이번 실무 워크플로를 단일 상품용으로 종료한다.

### D8E2 후보 DB 176건 격리 회귀 체크포인트 (2026-10-13)

- 연결된 후보 DB: 기존 164 ID + 신규 12 ID = 176. 신규 10건 category null 배제, 신규 sunscreen 2건은 구조적 projector만 통과; 실제 추천 admission 권한은 미검증.
- 공식몰 80ml 표기가 35,000원(일반)/24,500원(회원), 화해 80ml 두 개+세럼 세트 표기는 29,900원. 결제 확정 증빙이 없으므로 두 공식몰 표기가격은 격리 비교 **가정값**으로만 사용.
- 176행 snapshot + 격리 실런타임 166×12×2 구조적 회귀 검증기를 기존 Database Integration Authority에 연결. 176건 운영 추천 승인을 의미하지 않으며 D8E2 완료조건, D8F/G/H는 HOLD.
- 신규 추천 권한 RPC를 후보 DB에서 read-only 조회한 결과 이 통합 역할에 PostgreSQL 42501(EXECUTE 권한 없음). 운영 사용자 권한을 우회하지 않으며 신규 2개 상품의 승인 상태는 미검증. 격리 테스트에서는 실제 admission core + 합성 NO_CURRENT_SUBJECT로 신규 12개 FAIL-CLOSED, 별도 164×12×2 회귀를 추가해 총 7,920건 비교하도록 구성(최종 CI 결과 별도 확인).
- 배포 DB identity 미입증, 공식 구매 링크 direct allowlist 미승인, #1208 security 차단. 근거: [D8E2 read-only candidate snapshot](../evidence/r16i-r4-d8e2-live-snapshot-listing-scenarios-20261013.md).

### D8F 운영 전상태 실조회 검증 (2026-10-13, 증빙 승인과 분리)

- 연결된 Supabase **후보 DB**에서 에스네이처 정정 대상 Product + binding 1 + intake 1 및 Offer/Subject 0을 현재 SELECT로 재확인. 상품 revision은 2026-09-10의 기존값, 상품 160ml/29,900원, gate disabled, 적용 기록 0. 배포 Vercel 런타임 DB 동일성은 미확인.
- 현행 D4 검토 엔진의 실제 SELECT 형태 스냅샷을 `fixtures/recommendation-metadata/r16i-d8f-candidate-d4-readonly-prestate-20261013.json`에 날짜·출처·권한 HOLD와 함께 기록하고, `scripts/product-evidence/verify-r16i-r4-d8f-candidate-d4-readonly-prestate.mjs`에서 **읽기 전용**으로 D4 원본 계약 + 15개 수정·드리프트·충돌 부정 경로 검증.
- 예상되는 정상 판단은 `REVIEW_REQUIRED`이고 `release_ready=false`입니다. 이는 **실제 결제 증빙 2건, owner 승인, D8D PREVIEW 및 D8G/D8H 허가를 대체하지 않습니다.** 기존 Database Integration Authority에 검증기만 추가; CI PASS 확인 전 완료 판정 금지.
- 운영 DB 식별·#1208 보안 차단은 변경 없음. 관련 근거: [D8F read-only prestate](../evidence/r16i-r4-d8f-candidate-d4-readonly-prestate-20261013.md).

### D8G 운영 출시 차단요건 재검증 (2026-10-13)

- Vercel READY Production 배포 `dpl_8iYCmxYiynuiTtGftUQWsG3yx5JM`(GitHub main `8f1f0559`)의 소스·별칭만 확인했습니다. 실제 서버 환경 `NEXT_PUBLIC_SUPABASE_URL`은 Vercel 403으로 열람 권한이 없어 **서버 DB 동일성 미입증**. 운영 apply 플래그도 미확인.
- 연결된 Supabase 후보에서 대상 Product 160ml/29,900원, 증빙 0, 정정안 0, 적용 이력 0, DB gate disabled. 공식몰 80ml와 화해 80ml×2+세럼 10ml 공개 표시는 재확인했지만 실제 선택 옵션의 결제 직전 금액은 미확인.
- 보안 이슈 #1208 OPEN, 보안 PR #1240 DRAFT이며 실제 Expo 57.0.28 lock 후보에도 braces/node-forge 취약 버전 잔존. 보안 우회나 다른 트랙 변경 금지. 운영자 실제 증빙 2건·승인, 동일성 증명 및 보안 해결 전 D8F/G/H HOLD.
- 승인된 인증 관리자에서 실행할 정확한 절차·필요 근거·릴리스 차단표: [D8G 운영 근거·오너 이관](../evidence/r16i-r4-d8g-production-readiness-gate-20261013.md). 신규 관리자 기능이나 DB 변경 없음.

## 3. 우선순위와 차단 조건

| 우선순위 | 바로 해야 할 일 | 의존성 | 실패 시 |
| --- | --- | --- | --- |
| P0 | D8D-R1 migration ledger 정합·실제 배포 DB identity·최신 CI 실패원인 조사 | GitHub/Vercel/Supabase read-only | 배포/적용 HOLD, 원인 보고 |
| P1 | D8E1 추천/Offer 구매 링크 영향도·실제 1,968 runner 조사 | 코드/fixture/테스트 | 검증된 범위까지만 작성 |
| P2 | D8E2 before/after shadow 및 부정 경로 | P1 완료 | nonzero delta 해결 전 중단 |
| P3 | D8F 진짜 캡처·소유자 검토 | 실제 판매처·사용자 참여 | D8F HOLD, 자동 증빙 생성 금지 |
| P4 | D8G 운영 출시 심사 | P0~P3, 보안 #1208, 사용자 승인 | 게이트 OFF |
| P5 | D8H 1회 반영/검증/잠금 복원 | P4의 별도 명시 승인 | 무단 Production write 금지 |

**공통 STOP:** 인증/권한/DDL/실데이터/환경변수 변경은 `AGENTS.md` Protected Areas 통제에 따름. 코드·문서·격리 테스트 구현은 계속하되, 사용자 승인 없는 Production 상품 데이터 변경 또는 릴리스 잠금 해제는 절대 하지 않는다. 다른 트랙의 Face Lab, trust, security, CI 소유 범위를 임의 합치거나 병합하지 않는다.

## 4. 작업 기록 및 완료 보고

각 단계의 `docs/evidence/` 기록에는 **목표, 실제 코드/쿼리 변경 파일, before/after 계약, 실행 명령·CI run·PG17 테스트 결과, Product/Offer write 건수, DB identity, 승인 상태, 미해결 리스크, 다음 실행 게이트**를 남긴다. `.codex/AI_WORK_LOG.md`는 그 문서 규칙에 따라 필요한 경우만 갱신한다. 로드맵 체크포인트를 통과할 때만 상태를 수정한다.

새 채팅 이관 시작점은 **D8D-R1 → D8E1**이다. D8F 운영 증빙이 없다고 개발 전체를 멈추지 않되, 그 사실을 보류로 명시한다. 보고는 `완료 / 검증 / 차단·리스크 / 다음 작업`만 간결히 전달한다.

## 5. 근거 자료

- [R16I 운영 이슈 #1204](https://github.com/gycha0109-beep/K_beauty/issues/1204)
- [D8D PR #1250](https://github.com/gycha0109-beep/K_beauty/pull/1250)
- `docs/evidence/v21-8h-r16i-r4-readonly-prestate-and-operator-gate-20261010.md`
- `docs/evidence/r16i-r4-d8a-live-refresh-20261012.md` ~ `docs/evidence/r16i-r4-d8d-transactional-apply-20261012.md`
- `lib/product-offer-read-path.js`, `lib/product-offer-r16i-r4-d4-db-reader.mjs`
- `supabase/migrations/20261012181320_taxonomy_ai_r16i_d8d_transactional_apply_v1.sql` (현재 GitHub 경로; 적용 ledger 버전과 불일치 정합화 필요)
- `scripts/product-evidence/verify-barrier-support-p1-r16i-r4-d8d-transaction-apply-v1.mjs`
- `.github/workflows/database-integration.yml`, `scripts/verify-data-ai3-5-ci-consolidation.mjs`

## 6. D8D-R1 첫 실행 기록 (2026-10-13)

- **완료한 저장소 수정**: Supabase 적용 ledger SQL과 원본 migration SQL 전체가 정확히 일치함을 확인하고 D8D migration 파일의 timestamp만 `20261012181320`으로 정렬. 기존 R16I static verifier 참조 동기화. DB ledger/DDL/상품 쓰기 없음.
- **실패 원인 확정**: Database Integration Authority #38228827854는 기존 TRUST 파일과 D8D 파일의 `20261012190000` 버전 충돌로 실패. Supply Chain Security #38228827799는 #1208 예외 만료(독립 security track). 기존 Main Health #38331616991의 원인은 이 로드맵 첫머리의 trailing whitespace이며, 최신 main #38332070445는 PASS.
- **아직 미완료**: 배포 Vercel runtime→Supabase DB identity 검증(HOLD, 환경변수 메타 조회 403), 현재 서버 APPLY flag 확인, PR CI 확인, D8E1 실제 기준 fixture 조사, D8E2 실런타임 1,968 결과. D8F 원본 캡처/승인 미확보. D8G/D8H 잠금 해제 금지.
- 세부 증거: [D8D-R1 reconciliation](../evidence/r16i-r4-d8d-r1-ledger-reconciliation-20261013.md). 위 2026-10-13 초기 시점 표는 역사적 스냅샷이며, 실제 수정/배포 완료 판정은 이 새 기록과 최신 검증을 우선한다.

### D8E1 구조적 Shadow 검증 결과 (2026-10-13)

- `fixtures/recommendation-metadata/products-v1.json`(164)과 `user-scenarios-v1.json`(12)을 이용해 실제 `buildSkinMatchDecisionBundle` 1,968쌍 전후 비교 **PASS**. 점수, 순서, Top1/Top3, 후보 개수 변화 모두 0. [검증 실행 #38333704396](https://github.com/gycha0109-beep/K_beauty/actions/runs/38333704396).
- 단순 구조 격리 목적으로 **과거 가격을 고정**했으므로, 확인되지 않은 실가격 기반 D8E2 통과로 확대 해석하지 않는다. 후보 운영 DB는 176행이며 최신 전체 2,112쌍 검증은 별도 작업.
- 현재 공식몰 에스네이처 구매 URL은 직접링크 허용 정책에 등록되지 않아 fallback되고, 분리 예정 화해 Offer는 trusted read-path에 노출되지 않는다. D8G 실구매 CTA는 HOLD. No implicit trust promotion.
- D8D-R1 migration/code 테스트는 PASS지만 Production runtime DB identity 확인(403), #1208 security, 판매 옵션·가격·세럼 SKU·리뷰 귀속 및 소유자 승인이 차단 조건. D8F 실증 수집 관련 항목 HOLD, D8G/D8H 실제 운영 반영 금지.

### D8G continuation — 2026-10-13 14:28 KST (read-only / security HOLD)

- Synced latest verified `main@697f4004` into PR #1255 as `b44d9826` with an exact disjoint-file merge; existing TRUST changes preserved and R16I SQL body unchanged. New PR HEAD CI: Database Integration/isolated PG17, Main Health, Security Boundary, PIE, CodeQL all PASS; mandatory Supply Chain vulnerability gate FAIL at the same HEAD.
- Vercel Production alias now at `dpl_D2cMapWhKCFDsjUPy23yPTspm2az` (`main@697f4004`); project environment metadata list still HTTP 403. Candidate Supabase SELECT reconfirms Product 160ml/29,900 and evidence/proposal/application/offer/subject counts 0 with release gate disabled; deployed-server identity **UNATTESTED**.
- Seller public listing 35,000/24,500 KRW (official 80ml single), 29,900 KRW (Hwahae bundle) remains **non-checkout**, and no private capture/VERIFIED decision or owner product/offer field authorization exists. Do not reassign review counts or approve price/CTA.
- Security #1208 OPEN, Draft #1240 still vulnerable; no expiry extensions, no merge or Production apply. See `docs/evidence/r16i-r4-d8g-production-readiness-gate-20261013.md` §6 for exact SHA, CI runs and owner-only unblock actions.

### D8F/D8G continuation — public review-scope drift and guarded replay (2026-10-13)

- Current Production alias now resolves to `dpl_5MztRfqUfLgTYb9J9CWj5sGdCKVX` at `main@5272378c`. Effective Production Supabase DB identity remains **UNATTESTED** (project env metadata list forbidden); candidate database is not a substitute.
- Indexed retailer page shows 43,652 reviews vs the stored source historical 41,475; this is **review population uncertainty**, not an approved live review refresh or single-80ml attribution. Public official list/member and retailer bundle prices remain **non-checkout only**.
- Existing D8F no-write verifier now checks three exact publicly indexed listing promotions and one Offer URL collision fail-closed scenario. Do not count new checks as D8F original evidence, D8G launch or D8H authorized correction.
- PR #1255 remains OPEN/HOLD until independent #1208 security remediation, owner verification and exact current CI. Full details: `docs/evidence/r16i-r4-d8f-candidate-d4-readonly-prestate-20261013.md` and D8G gate §7.

### D8F owner-evidence continuation — 2026-10-14 (read-only / no approval)

- Two originally supplied checkout PNGs were byte-for-byte rechecked against private Storage evidence hashes without copying captures or identifying details to GitHub. Official 80ml single checkout context 24,500 KRW; Hwahae double 80ml + gift serum 10ml checkout context 29,900 KRW; recorded original capture time metadata is not independently attested.
- A user-authorized correction of malformed evidence metadata left **two UNVERIFIED per-seller private records**, zero owner verdicts, proposals, decisions or applications in the connected Supabase candidate. Legacy Product remains 160ml/29,900 with 0 Offer/Subject and release gate false. See [D8F owner capture readiness](../evidence/r16i-r4-d8f-owner-checkout-evidence-readiness-20261014.md).
- D8C proposal creation previously could accept one VERIFIED seller while the D8D owner-decision RPC required two. Added D8C **both-source/URL fail-closed proposal guard** and matching reviewer UI, with offline negative replay called by the existing D8F CI verifier. No owner verdicts were automated.
- Remains HOLD: serum exact SKU, review population, Product/Offer price attribution and CTA, Production runtime DB identity, independent #1208 security, explicit owner field decision and separate Production apply authorization. No Product/Offer/recommendation, DB schema/RLS/policy/env, security or release changes.

### D8F OWNER-VERIFIED / D8C field policy checkpoint (2026-10-14)

- The candidate database now records both human VERIFIED owner verdicts for the official 80ml single (24,500 KRW checkout) and Hwahae bundle (29,900 KRW checkout), with matching source/option, existing private image and valid capture window. The earlier zero-verdict snapshots above are historical.
- Legacy Product still 160ml/29,900, Offer/Subject collisions 0, one expected binding/intake, **0 proposal/decision/application**, release gate disabled. PR #1255 functional CI PASS including isolated PG17 migration replay, mandatory security audit FAIL.
- D8D would assign 24,500 KRW *discounted checkout* to Product min/max and change the Product buy link to the manufacturer URL. These are **candidate values** requiring separate canonical-price and CTA policy authorization, not automatic owner approval. See [field decision preflight](../evidence/r16i-r4-d8f-owner-verified-field-proposal-preflight-20261014.md).
- #1208 security remains OPEN; Draft security PR #1288 is not a completed installed fix. No Production schema, Product/Offer, ranking, release, environment or merge mutations.

### D8H pricing attribution and two Offer candidate shadow — 2026-10-14

- Implemented `r16i-price-scope-review-v1.mjs` as **read-only Product/Offer scope model** with the 35,000 KRW official screenshot display normal price, 24,500 KRW selected single-unit checkout and 29,900 KRW Hwahae 80ml×2 + 10ml serum kit selected checkout **explicitly separated**. No price value automatically approved for `products.price_min/max`.
- Manager section B now compares both seller-scoped Offer **candidates** (no DB insert) and warns that current D8D SQL still forces the 24,500 KRW discounted checkout into Product price. Product 80ml is only an anchor candidate; canonical Product price, unit price and CTA remain **null/HOLD** in the shadow.
- Added 17 negative cases + nominal scope test to the existing D8F offline verifier; protected SQL/RPC/schema/auth/purchase allowlist were **not changed**. R16I is not yet a safe Product/Offer migration: owner must decide canonical pricing, representative CTA and whether manufacturer also needs a persisted Offer before separate D8D revision.
- See [D8H price attribution shadow](../evidence/r16i-r4-d8h-price-scope-shadow-20261014.md). Connected Product remains 160ml/29,900, 0 Offer writes; #1208 mandatory supply chain remains open. No merge or Production deploy.

### D8H consumer-contract and A/B/C pricing-policy checkpoint — 2026-10-14

- Latest inspected pre-work PR HEAD `aecbf10595a7` and main `1a82cf9961f4`. This is a historical start reference; re-read actual PR HEAD and CI before any merge or deployment.
- Existing D8H two-Offer pricing scope Shadow stays read-only with Product price/CTA authority withheld. Added synthetic **actual Offer resolver + CTA runtime** regression via `scripts/product-evidence/verify-r16i-d8h-offer-consumer-runtime-v1.mjs`, invoked by the existing D8F offline verifier. Existing PostgreSQL17 price-null/two-Offer fixture is unchanged.
- Current product consumers expose meaningful **A-policy blockers**: `product-source.mapPriceRange` supplies `"$$"` for unknown numeric price, which the Result page can present as `₩₩`; premium budget-alternative API can coerce `null` price to `0`. Offer-reader failure returns original decision; Product legacy buy-link must be independently cleared before cutover.
- The generic URL resolver allows valid Hwahae goods URLs; it does **not** authorize the 80ml Product↔Hwahae kit mapping. Neither candidate seller has an admitted Offer read-path source policy or price authority.
- Compared **A: Product NULL**, **B: governed offer-derived price**, **C: independently approved Product reference price**. **No option selected.** Existing D8D discounted-checkout Product price + single Offer transaction is **not an authorized replacement**.
- Exact file/consumer ledger and migration/rollback approval scope: [D8H Product/Offer consumer compatibility](../evidence/r16i-r4-d8h-offer-consumer-compatibility-and-pricing-policy-20261014.md).
- No schema/RPC/Auth/RLS/API field-name/allowlist/package/Production or Product/Offer data writes. Production runtime database identity remains unverified, #1208 Supply Chain Security unresolved; no merge or D8D APPLY. New exact-HEAD CI must be observed before declaring the runtime verifier PASS.
- **Next:** settle price semantics with OWNER, scope consumer-safe `null` and price-band projection changes, then request explicit protected changes for a dual-offer D8D contract with rollback. Keep D8G/H production gates OFF.

### D8H 164×12 actual NULL-price consumer replay — 2026-10-14

- Implemented **read-only synthetic A-option replay**, not an approved Product price policy: actual current recommendation source mapper/decision engine ran 164 frozen catalog products × 12 scenarios comparing historical 160ml/29,900 to a hypothetical 80ml/NULL price and NULL CTA with two untrusted seller Offer candidates.
- Exact code HEAD `aea49f54197e6bdc4291421741a0f7c96595fd6b`: existing Database Integration Authority [#38518123678](https://github.com/gycha0109-beep/K_beauty/actions/runs/38518123678) **SUCCESS**, including isolated PG17. Earlier `056a3259` failed on harness JSON line parsing and was corrected; do not treat the earlier failed run as an engine regression.
- **Observed:** 1,968 candidate-score comparisons; score/rank/Top1/Top3/candidate-count deltas **0**; **budget alternatives changed in 1/12 scenario**, with the target Product appearing 1→0 times in this secondary list. UNKNOWN Product price still falsely projects `"$$"`; premium API NULL→0 remains uncorrected.
- Compatibility disposition: **STRUCTURAL PASS / CONSUMER PRICE UX HOLD**. Do not claim entire recommendation or premium UI parity and do not change Production Product price/link. Full investigation and future protected-surface change scope: [D8H price-consumer compatibility and replay](../evidence/r16i-r4-d8h-offer-consumer-compatibility-and-pricing-policy-20261014.md).
- Product / Offer DB writes 0 / 0; no schema/RPC/auth/CTA trust/price policy/ranking changes; Production identity UNATTESTED, #1208 security OPEN, owner price choice and D8G release authorization absent. Next stage requires owner pricing semantics before correcting live consumers or designing the protected two-Offer D8D transaction.

### D8H 176-candidate NULL-price shadow expansion — 2026-10-14

- Added exact current-engine 176-row candidate-snapshot replay: 166 structurally projectable rows ×12 = 1,992 comparisons and synthetic 164 legacy-only negative control ×12 = 1,968 comparisons. **All core scores, rank, Top1/Top3 and candidate counts unchanged.** This is **not** actual Production PF admission.
- **U10 budget alternative changed 1/12** in both projections (target Product 1→0), so price-null transition is **consumer UX HOLD** despite core ranking parity. FALSE `"$$"` null-price fallback and premium API NULL→0 static finding unresolved; A/B/C owner policy still unselected.
- Evidence and exact CI provenance: [D8H 176-candidate budget shadow](../evidence/r16i-r4-d8h-offer-consumer-compatibility-and-pricing-policy-20261014.md) §8. Test script now in D8F CI. Initial `56d1d92d` script PASS but whole CI failed whitespace hygiene; fixed in `63812fde`. Verify final HEAD checks independently.
- No Product/Offer writes, no protected schema/RPC/auth/CTA/score/price/runtime changes; Production DB unattested, #1208 security not resolved, rollout gate remains HOLD.

### D8H nullable-price consumer fix (bounded runtime) — 2026-10-14

- Added pure Product price read-contract and wired actual catalog source, budget cheaper comparison and existing premium API price values: missing Product price → `null`, price band `""`, never `0`/`"$$"`; known valid price thresholds unchanged. Result UI already hides empty price labels.
- Added explicit NULL/invalid/threshold contract regression to existing D8F CI plus prior 164×12 and 166×12 replays. **U10** budget list difference under hypothetical NULL remains declared; no price invented to preserve prior rank/secondary list.
- Code paths: `lib/product-price-read-contract.mjs`, `lib/product-source.js`, `lib/skin-match-decision-engine-core.js`, `app/api/analyze/route.js`, `scripts/product-evidence/verify-r16i-d8h-price-consumer-contract-v1.mjs`. Full rationale in [D8H consumer compatibility §9](../evidence/r16i-r4-d8h-offer-consumer-compatibility-and-pricing-policy-20261014.md).
- Exact HEAD CI recheck required. **No Product/Offer data writes, no schema/RPC/auth/purchase allowlist, API field-name change, ranking policy, pricing-option selection, merge, or deploy.** A/B/C Product price, dual-seller D8D transaction, runtime DB identity and independent supply chain security #1208 remain HOLD.

### D8I — Product 대표가격 후보 A + 두 판매처 Offer 적용/롤백 설계 (2026-10-14)

- **Engineering policy proposal = A: Product 가격/단위가격/직접 CTA `NULL`, 공식몰 80ml 단품과 화해 80ml×2+10ml 세럼 기획세트의 결제금액은 별도 Offer 2건. OWNER price policy is still not approved.** B/C는 동등 단위와 독립 기준가격이 검증될 때 재설계.
- Added pure `buildR16ID8IDualOfferCutoverPreview` and negative-case verifier in existing D8F CI. Candidate after Product `80/null/null/null/null`, exact seller candidates 24,500/29,900; **all approvals/writes/SQL false/null**. Neither seller CTA source is trusted; serum SKU, Product review population and original source-binding scope remain unverified.
- Protected D8D v1 is incompatible: forces 24,500 into Product min/max and records **only one** created Offer. Drafted new-version transaction, **two Offer IDs**, immutable evidence binding, CAS/idempotent apply, exact two-Offer rollback, negative PG17 matrix, authority gates and all stop conditions. **No protected SQL/RPC/schema/RLS change made.**
- Detail: [D8I price and two-Offer cutover design](r16i-r4-d8i-representative-price-dual-offer-cutover-design-20261014.md). Gate remains **DESIGN_READY_OWNER_AND_RELEASE_HOLD**; actual Production DB identity UNATTESTED, #1208 mandatory security unresolved. PR #1255 OPEN; no merge/deploy/Product or Offer DB writes. Final HEAD CI must be checked separately.

### D8D v2 owner-gated two-Offer migration and atomic rollback (dormant, 2026-10-14)

- Added **new versioned**, disabled-by-default D8D v2 SQL: `supabase/migrations/20261014150000_taxonomy_ai_r16i_d8d_v2_owner_gated_dual_offer.sql`; v1 SQL stays untouched. New gate defaults OFF; immutable owner policy/scope attestation table is empty and not writable by `service_role`. Product/Offer payloads contain **two seller-specific Offer IDs and exact audit evidence**; no SKU/CTA/score authority is promoted. No admin API route added.
- Atomicity and CAS rollback isolated PG17 fixture `tests/fixtures/r16i-d8d/50_v2_dual_offer_atomic_pg17.sql` wired into existing Database Integration CI. The scenario includes fictional owner authorizations within a transaction that **rolls back** and validates zero residual Product/Offer changes. Initial simulated stale revision fixed; baseline PG17 proof [#38524568638](https://github.com/gycha0109-beep/K_beauty/actions/runs/38524568638) SUCCESS; verify exact final HEAD after idempotent retry drift hardening.
- **Remain HOLD:** actual OWNER price A consent, 80ml identity/review-source attribution, two seller selected-option real evidence freshness, safe deployed DB identity/privileges, security #1208, manual release gate activation, Production migration/deploy/merge. No runtime Product/Offer writes. Detail [D8I design §6](r16i-r4-d8i-representative-price-dual-offer-cutover-design-20261014.md).
