# 클렌저 10개 — v1 원본 / v2 격리 검증 (2026-10-23)

> **2026-10-23 후속 정책 방향:** 공식 증거를 모든 *일반 적합성 추천*의 필수 조건으로 삼지 않는 [근거 수준별 제한 추천 로드맵 v2](../architecture/cleanser-evidence-tiered-recommendation-roadmap-v2-20261023.md)를 별도로 채택하여 Shadow 검증 중. 이 문서의 strict v1/v2 비교는 보호된 **확정적 Product Fact 경로**의 진단으로 유지되며 제한 선호 추천의 유일한 게이트가 아니다.

상태: **격리 코드 검증용 / 운영 비교·승인 완료 아님**

## 소스 및 격리
- 원본 v1: Draft PR [#1390](https://github.com/gycha0109-beep/K_beauty/pull/1390)의 `lib/cleanser-initial-admission-preflight-v1.mjs`를 **수정 없이** 가져옴. 양쪽 blob SHA `a8653b9afd2e0d8c19e65f67bc4cb75084dfa838`.
- v2/기존 추천 보호 로직: Draft PR [#1401](https://github.com/gycha0109-beep/K_beauty/pull/1401) 기반. 자체 격리 Draft PR #1403.
- 입력: 2026-10-23 BEJEWELY Supabase에서 SELECT-only 확인한 클렌저 **실제 기존 10개 카탈로그 ID**. `evidence/trust/cleanser-ten-integration-authority-footprint-20261023.json`에는 URL/화해 원본/리뷰·성분 신호·개인정보·구매 거래를 전혀 저장하지 않고, 상품명·표시 용량과 권한 관련 건수만 기록.
- 이 절제된 footprint는 **v1 전체 실서비스 스냅샷이 아니다.** 생략된 필드를 실제 DB 부재로 취급하지 않는다. 따라서 출력된 URL·리뷰 관련 부수 차단 사유를 운영 진단 수치로 인용하면 안 된다.

## 보호된 필수 권한 확인
- 실측: Product 10, intake 10, 연구 Task 20(상품당 2), Subject 0, resolved Source Binding 0, 공식 Trust Observation 0, Offer 0.
- **반드시** v1에서 `CURRENT_EXACT_SUBJECT_REQUIRED`, `RESOLVED_OFFICIAL_SOURCE_BINDING_REQUIRED`, `CURRENT_OFFICIAL_IDENTITY_OBSERVATION_REQUIRED`, `VERIFIED_EXACT_CAPACITY_REQUIRED`, `GOVERNED_CURRENT_FACT_REQUIRED`가 존재한다. 이는 완전 입력에서도 위 필수 근거 부재 때문에 보류되는 안전한 하한선 진단.
- v2에서는 공식·승인된 양쪽 물리 규격과 동일 처방 Subject를 입증할 수 없어 10개 모두 `REVIEW_REQUIRED`, 재사용·추천 승인·운영 쓰기 0.
- 120↔150ml, 170↔220ml 차이는 미승인 리서치 단서일 뿐 공식 단일 제형 재사용 권한이 아니다.

## 단위 테스트와 실제 운영 결과 구분
- 원본 v1의 **합성 완전 입력**이 `VERIFIED_EXACT_CAPACITY_REQUIRED`에서만 HOLD 되도록 만들고, 양쪽 공식 SKU/용량/Subject·digest가 실제로 검토됐다는 **합성 증명**을 제시하면 v2가 `SHADOW_CAPACITY_SCOPE_RECONCILED`를 산출하는지 테스트한다. 이는 운영 승인이나 실세계 처방 동일성 증명이 **아니다**.
- 별도로 서로 다른 처방 Subject 및 미확정 링크는 v2 HOLD, Fact 재사용·G2 승인·DB 쓰기 항상 0.
- 실제 10건의 완전 v1↔v2 심사는 권한 있는 읽기 경로로 URL·공식 원본·화해 권한 관측, 전체 추천 메타데이터를 **저장소 공개 없이** 검증해야 하며 현재 미실행 상태이다.
- R6 활성화 전 공식 근거 채집·검토, TRUST Subject/Fact 관리자 승인, 164×12 회귀, 카나리/롤백 검증을 별도 진행해야 한다.

## 변경 범위
이 브랜치는 격리 검증 코드를 별도로 유지한다. **PR #1390 및 PR #1401 원본 브랜치 변경 0**, `main` 병합 0, 운영 DB/로그/권한/Fact/추천/G2/배포 변경 0.

## 2026-10-23 추가 실제 데이터 점검 — 더 구체적인 작업 순서

읽기 전용 Supabase 조회로 동일한 10개 카탈로그 앵커를 다시 점검했습니다. **상태만 기록하며 원본 URL·리뷰·성분 본문은 저장하지 않습니다.**

| 현 상태 | 건수 | 다음 처리 |
| --- | ---: | --- |
| 저장된 상품 출처 URL이 HTTPS 형식 | 10/10 | URL 존재와 **제조사 근거 승인**은 다름. 정확한 SKU·규격·원본 및 처방 연결 재검토 |
| 화해 상품 페이지/기록된 페이지 문자열 일치 | 7/10 | 기존 리뷰·성분 신호를 다시 보지 않고도 **매핑 일치**만 확인한 것. 과학적 Fact 근거는 아님 |
| 화해 리뷰/시장/성분 신호의 기대 `source` 종류 존재 | 7/10 | 최신성·계수·성분 위험 합계 등은 실제 v1 판단 또는 별도 검사 후 사용 |
| 해당 신호 및 링크가 없는 클렌저 | 3/10 | 마녀공장 퓨어 소이빈, 라곰 셀럽 젤 투 워터, 라곰 셀럽 마이크로 폼 — 정확한 상품/화해 원본 매핑 검토 필요 |
| 저장된 추천 `skin_types`, `concerns` 배열 | 0/10 | 기존 Source·Subject에 연동된 관리형 메타데이터 검토와 매핑이 필요함. 빈 값은 `false`가 아님 |
| Current Subject/공식 binding/Trust observation | 0/10 | **최우선 공통 차단**. SKU·시장·처방이 검토되기 전 Fact 작업·추천 권한 승격 금지 |
| 기존 연구 task | 20/20 | 기존 10개 Product UUID와 과제 ID 보존, 중복 intake 금지 |

위 수치는 2026-10-23 읽기 전용 시점값으로, 추천 권한 또는 v1 전체 통과를 의미하지 않습니다.

### 완전 원본 스냅샷을 저장하지 않는 서버 실행기

`scripts/run-cleanser-ten-live-v1-v2-readonly-v1.mjs`는 연결된 앱의 SQL 조회와 달리 **승인된 서버 환경에서만 직접 실행할 도구**입니다.

- 필수: `--ids=`에 이미 등록된 클렌저 UUID 정확히 10개, 서버 전용 Supabase 환경 변수
- 네트워크: Supabase의 정해진 테이블 9곳에 대한 HTTPS `GET`만 허용. 로그인, 관리자 RPC, 제조사/화해 크롤링, 변경 요청 금지
- 읽는 항목: 기존 클렌저 전체 카탈로그 중복 범위, 실제 리뷰·성분·추천 메타데이터, Subject/official binding/원본 관측, governed Current Fact 관계
- 출력: 상품 이름/UUID와 **원본 v1 차단 코드, v2 보류 코드, 건수만**. 외부 링크·성분 배열·리뷰 본문·서비스 자격증명 저장/표시하지 않음
- 제한: v2의 양쪽 공식 SKU→Subject 관계를 근거 있는 reviewed pair로 만드는 별도 권한 Reader는 아직 연결되지 않음. 따라서 공식 처방 동일성 비교는 `NOT_EVALUATED_NO_INDEPENDENT_EXACT_SKU_PAIR_READER`라고 명시하며 cross-size 재사용 불가
- GitHub CI에서는 권한·비밀번호 없이 **읽기 전용 전송 가드와 실패 차단만 테스트**. 이 코드를 GitHub CI에서 실제 원격 DB에 실행하거나 비밀번호를 저장하지 않음

## 2026-10-23 R5 → R6 읽기 전용 작업표 및 활성화 금지 게이트

- 기존 10개 상품 기준: `evidence/trust/cleanser-authority-next-actions-20261023.json`은 승인된 Supabase **SELECT-only** 출력에서 상품명/ID와 `bool`/건수만 골라 만든 검증 자료다. 원본 URL, 리뷰/성분 신호 전체, 개인 데이터, 크롤링 결과, 사용자 메타데이터, credentials 없음.
- `lib/trust/cleanser-review-worklist-shadow-v1.mjs`: 정확한 기존 10개 상품 UUID를 재검증하여 **무엇부터 확인해야 하는지** 정렬한다. **P1** 공식 SKU/처방/원본 증거 10건, **P2** 정확한 화해 매핑 검토 3건(마녀공장 1 + 라곰 2), **P3** 기존 피부 타입/고민 승인 메타데이터 검토 10건, **P4** 기존 20개 Task의 실제 Current Fact 검토(Subject/official source 승인 후) 10건이다.
- 현재 10건 모두 Current Subject=0, official source binding=0, Trust observation=0, `skin_types` / `concerns` 승인 메타데이터=0. 7건에 기존 화해 신호가 있다고 해서 **상품·처방 또는 구매 SKU 승인된 것은 아니다**. 모든 제품 생성, Fact 권한, 신규 연구 큐, admission, DB writes=0.
- `lib/trust/cleanser-r6-release-review-v1.mjs`: **12개 사전 확인 항목** 중 R0 기존 ID 보호 및 R5 164×12 추천 불변 테스트만 충족된 것으로 보수적으로 표시해 **2/12**, 나머지 **10/12 미검증**. R1 독립 goldset/실제 상품 구성, R2 원본 관측과 권한, R3 Subject/Fact, R4 실데이터 완전 비교, R5 독립 오결합률, R6 보안 심사/제한 Canary/kill switch/rollback/명시적 G2 승인을 요구한다.
- 이 실행기는 어떤 값이 들어오더라도 Production 승인을 **직접 내릴 수 없다**. 모든 검증항목이 충족되었다는 외부 입력을 넣어도 결과는 `INDEPENDENT_PROTECTED_REVIEW_REQUIRED`이고 `deployment_authorized:false`, `production_grant_authorized:false`로 고정된다.
- **로드맵 상태**(검증/운영 구분): R0 읽기 전용 감사 완료. R1 정규화 Shadow와 synthetic tests 구현 (DB 스키마·실제 판매 데이터 미승인). R2 증거 바인딩 검증기 구현 (클렌저 실물 근거 부족). R3 검토 handoff만 구현, 승인 기능 미실행. R4 독립 v1/v2 테스트 구현, 원본 전체 운영 자료 재실행 미완료. R5 164×12와 판매 변화·위험 상황 회귀 통과, 독립 goldset 미승인. R6 활성화/롤백 **미시행 및 차단**.
- 다음 실제 진입점은 기존 10개를 보존하고 **공식 출처/정확한 SKU/처방 정본의 적법한 증거를 관리자 검토로 넘기는 일**이다. 용량 충돌(라곰 120↔150ml, 170↔220ml)이나 휩드 130g을 임의로 수정·환산하거나 dummy Subject/Offer를 INSERT하지 않는다.
