# V2.1-8H-R16D — P1 READY2 공식 페이지 원본 수집 경로

## 현재 판정

**`R16D_CAPTURE_PROTOCOL_IMPLEMENTED_LOCAL_DNS_BLOCKED_HOSTED_PROBE_PENDING`**

R16C 읽기 전용 신원 사전검증을 통과한 **이니스프리 비자 시카 밤 EX 40ml** 및 **에스네이처 아쿠아 오아시스 수분 젤크림 80ml** 두 상품만 대상으로 원본 HTTP 응답 바이트 수집·해시 검증 경로를 구현했다. R16D 시점에는 원본 수집 성공이 확정되지 않았다. 현재 채팅 실행 환경에서 두 공식 도메인 모두 DNS 해석 오류가 재현됐다.

### 원본 수집 방법

- 독립 실행 스크립트: `scripts/product-evidence/capture-barrier-support-p1-r16d-official-sources-v1.mjs`
- 재사용 엔진: `lib/trust/official-source-fetch.mjs:fetchOfficialBytes` — HTTPS 검증, 사설 DNS/IP 차단, 제한된 응답 크기, 10초 타임아웃, 리디렉션 제한.
- 타깃 정확히 2개 고정. 외부 입력 URL이나 임의 호스트 수집 불가.
- 저장소 CI: `.github/workflows/taxonomy-ai-r16d-source-capture.yml` — 새 대형 CI가 아닌 PR 변경경로 전용 경량 작업 1개/최대 5분.
- GitHub Actions 공식 페이지 접근 성공 시 반환받은 *응답 본문 바이트*를 일시적 Actions artifact(`r16d-p1-official-kr-source-bytes`, 7일 보관)에 저장하고, 같은 바이트에서 SHA-256 생성.
- `manifest.json`: 실제 URL, 바이트 길이, SHA-256, 1차 상품명·용량 문구 존재 여부, 누락·네트워크 차단 사유, GitHub HEAD 및 run ID를 기록.
- 실패해도 **`CAPTURE_BLOCKED` 및 null digest**, 상품 신원 부재나 Fact 거짓값으로 전환하지 않는다.
- 원본 HTML은 Production DB나 git 커밋에 저장하지 않음.

### 판정의 한계

`RAW_SOURCE_CAPTURED_IDENTITY_REVIEW_REQUIRED`가 출력되더라도 이는 **HTTP 응답과 텍스트 관측이 실제 있었다는 의미**에 한정된다.

공식 페이지 전체 해시는 `source_content_digest`의 기술적 근거가 될 수 있지만, 사용자 리뷰·가격·재고 등 변동 가능한 영역을 포함할 수 있으므로 **formulation_revision_key와 동일하지 않다**. 따라서 이 단계는 `subject_semantic_key`·`formulation_revision_key`를 자동 발급하지 않는다. 원문을 수동 검토하여 정확한 포장 SKU·변형·리뉴얼을 구분하고, 기존 Subject Identity serializer 및 등록 사전검증 절차를 별도로 통과해야 한다.

#### 증거가 불충분한 경우

- DNS 실패, 403/429/5xx, 비-HTML, 크기 초과, 교차 브랜드 리디렉션: **`CAPTURE_BLOCKED`**.
- 페이지 본문에서 상품명이나 용량을 정확히 함께 확인하지 못한 경우: **`RAW_SOURCE_CAPTURED_IDENTITY_GAP`**.
- 페이지 제목과 용량이 함께 확인된 경우에도: **`RAW_SOURCE_CAPTURED_IDENTITY_REVIEW_REQUIRED`**, *등록 허가 아님*.
- 이니스프리 70ml 대용량/이웃 상품, 에스네이처 다른 크림 SKU는 근거로 전이하지 않음.

### 검증

독립 오프라인 검증기는 다음을 재현한다.
1. 두 제품의 허용된 HTTPS 공식 URL 이외 소스 사용 금지
2. 실제 Buffer 원본과 아카이브 파일 바이트 동일성 및 SHA-256 일치
3. DNS 실패 / 다른 브랜드 리디렉션에서 Digest null
4. 상품명만 나오고 용량이 누락된 경우 `IDENTITY_GAP`
5. 어떠한 결과에서도 Subject 등록과 Production 쓰기 **0건**

### 불변 경계

R16B HOLD 2개(에스네이처 수분크림 160ml 묶음 범위 / 아누아 ‘캡슐’ 명칭) 및 ZEROID HOLD 유지. `barrier_support_claim`, `primary_use_role` Fact는 조사·확정하지 않는다. 비수치 PDA, 164후보 × 12시나리오 = 1,968 평가, 점수·랭킹·후보 정책 불변.

## 다음 실행 조건

Hosted CI 작업의 정확한 HEAD에서 source capture artifact 및 manifest를 회수해 다음 항목을 검사한다.

1. 실제 원본 바이트와 manifest SHA-256 재계산 일치
2. 원본을 돌려본 사람도 동일한 공식 URL·브랜드·제품명·용량 확인 가능
3. 이름이 같아도 서로 다른 포장·포뮬러인지 별도로 판단
4. 실제 신원 serializer에 맞춰 formulation revision과 semantic key를 독립적으로 산출·충돌 검증
5. 그 뒤에도 **별도의 등록 승인 단계** 전까지 Production Subject 쓰기 금지

원본이 확보되지 않았다면 정상적인 기술적 결과는 `EXTERNAL_FIRST_PARTY_CAPTURE_BLOCKED`이며, 근거 없는 Digest 생성 없이 다른 P1 후보 조사로 진행한다.

상태 JSON: `evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p1-r16d-official-source-capture-preflight-v1.json`


## R16D-R1 실수집 감사 결과 (추가)

GitHub Actions #37830938121의 아티팩트 #11572854459를 내려받아 ZIP 안의 HTML 원본을 독립적으로 다시 해시했다.

- **이니스프리:** 553,877바이트, 원본 SHA-256 `f85c16714bf53bb14f29f85bf2766190b8e34f909720a55d64d1b6adc8d391cd` 일치. 공식 HTML 제목 `비자 시카 밤 EX(40mL) | 이니스프리`.
- **에스네이처:** 248,632바이트, 원본 SHA-256 `6a69b5f2c3cf7371ceabe7a41ba65de2dcad1d49858607e110a389bc88472112` 일치. HTML `application/ld+json`의 Product 명칭 `아쿠아 오아시스 수분 젤크림 80ml`, `sku=cafe24_smasteri_1_99`, 공식 판매 링크 `/99/`를 확인했다. 페이지 `title`에는 용량이 없었으므로 기존 Title-only 판단에서 GAP으로 나온 것이며, 이제 exact-SKU 구조화 데이터도 별도로 검사한다.
- **원본 수집 성공 2/2, 최종 등록 허가 0/2.**
- **출처 메타 오류:** 최초 manifest의 `github_head_sha=6da20e5...`는 실제 PR HEAD `eb2192f...`가 아닌 PR synthetic merge SHA였다. 체크아웃 검증은 정확한 HEAD를 사용했지만 기록 필드가 부정확했다. 이를 수정하고 후속 CI에서 manifest와 정확한 체크아웃 SHA의 일치를 강제한다.

원본 HTML 바이트는 git에 추가하지 않았으며 아티팩트 보관 기한은 2026-10-15 UTC이다. 기록은 `barrier-support-p1-r16d-hosted-raw-artifact-audit-v1.json`에 남겼다. **아티팩트 원본 해시가 검증됐다는 사실만으로 포뮬러 리비전이 확인되거나 Subject 등록이 승인되는 것은 아니다.**


## R16D-R2 정확한 HEAD 재수집 종료 (2026-10-09)

이전 manifest에 잘못 기재됐던 synthetic merge SHA 문제를 수정한 커밋 `1be460b108d26c3a962295b4b898901b1729697a`의 GitHub Actions #37835054466에서 원본을 다시 내려받았다. manifest의 `github_head_sha`는 실제 PR HEAD와 **일치**한다. 원본 파일 2개의 SHA-256을 재계산해 manifest와 일치하는지 별도로 검사했다.

- **이니스프리 비자 시카 밤 EX(40mL)** — 553,319바이트, `a4640eea1c5c13800951c129d11839da91876afb7b50f05f15f7ff93fb4e0e9d`, 공식 상품번호 `34622`, 페이지 제목과 JSON-LD에서 정확한 40mL 식별.
- **에스네이처 아쿠아 오아시스 수분 젤크림 80ml** — 248,632바이트, `f051b4e8b395d2957724bbb4cdaba16a3c8e3cb10d04d629147dfbf7fa4e8139`, 공식 Product JSON-LD의 `sku=cafe24_smasteri_1_99`와 80ml 확인. 페이지 제목 자체에는 용량 없음.
- 아티팩트 #11574787645 (보관 만료 예정 2026-10-15 UTC). ZIP 전체 해시와 각 HTML 해시는 서로 다른 증거이므로 혼동 금지.
- 공식 원본·정확 HEAD 출처 확인 **2/2 PASS**, 포뮬러 리비전 식별 **0/2**, 최종 Subject semantic key **0/2**, Production 쓰기 **0**.

R1과 R2는 공식 페이지 URL이 같아도 HTML 전체 해시가 달랐다. 가격·재고·HTML 상태 등 변동 가능한 요소가 포함될 수 있으므로 **페이지 바이트 해시를 포뮬러 리비전 키로 전환 금지**. R16E에서 실제 공식 포뮬러 신원·리뉴얼 근거와 serializer 기준을 분리 검증할 때까지 Subject 등록 HOLD.

별도 CI 결함: R16D 신규 워크플로 1개로 전체 개수가 69→70개가 되면서 Main Health의 Phase B 승인 목록이 누락돼 실패했다. 이 워크플로의 유일 실행 책임(공식 원본 2개에 대한 경량 읽기/아티팩트)을 확인하여 `docs/ci/consolidation-audits/phase-b-policy.json`에 승인 목록과 세부 책임을 명시했다. 기존 CI 감사 자체는 완화하지 않았다.

종료 증적: `evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p1-r16d-exact-head-recapture-audit-v1.json`
