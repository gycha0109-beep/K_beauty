# V2.1-8H-R13C — ATOPALM Official Evidence Research Closeout

## 종료 판정

`BARRIER_SUPPORT_ATOPALM_P0_OFFICIAL_EVIDENCE_RESEARCH_DIRECT2`

R13B에서 Subject 등록을 끝낸 아토팜 `릴렉싱 나이트 밤 100ml ×2개 세트`의 Registry v1 연구 작업 2건을 공식 KR 출처로 조사했다.

이 단계는 **연구 전용**이다.

- Evidence DB write: 0
- Fact Instance write: 0
- Confirmation write: 0
- Recommendation write: 0
- Public activation: false

## 공식 출처

아토팜 공식쇼핑몰의 정확한 KR 번들 페이지:

`https://www.neopharmshop.co.kr/product/detail.html?cate_no=123&display_group=1&product_no=3324`

페이지는 `릴렉싱 나이트 밤 100ml ×2개 세트`를 직접 식별한다.

R13A/R13B에서 이미 이 번들이 동일한 100ml 단위 제품 2개로 구성된 정확한 Subject presentation임을 확정했으므로, 별도 제품이나 형제 제품의 근거를 전이하지 않았다.

## 판정

### barrier_support_claim

**DIRECT_EVIDENCE_FOUND → true**

공식 제품 상세에는 해당 제품이 피부장벽 강화에 도움을 준다는 직접 제품 주장이 존재한다.

같은 페이지에는 경피수분손실량(피부장벽)을 평가 항목으로 둔 인체적용시험도 기재되어 있다.

다만 Registry 의미론을 보존하기 위해:

- `proposed_value=true`
- `evidence_class=product_claim`
- 측정 결과는 보조 근거로만 보존

했다.

즉 **공식 claim과 측정 효능을 같은 개념으로 합치지 않았다.**

### primary_use_role

**DIRECT_EVIDENCE_FOUND → multi_area**

공식 사용법은 세안 또는 샤워 후:

- 얼굴
- 팔
- 다리
- 그 밖의 필요 부위

에 바르도록 안내한다.

이는 한 제품에 복수 적용 부위를 명시하는 기존 Registry v1 `multi_area` 의미론에 직접 대응한다.

- `proposed_value=multi_area`
- `evidence_class=usage_instruction`

## Production 상태

조사 직전 readback:

- Product Fact Subject: **51**
- Product Fact Current: **105**
- Fact Instance: **106**
- Confirmation: **106**
- Evidence Record: **108**
- 대상 Subject Fact Instance: **0**
- 대상 Subject Current Fact: **0**
- 대상 Subject Evidence: **0**

연구 작업 2건 모두:

- `RESEARCH_PENDING`
- `attempt_count=0`
- `blocker_code=null`
- Evidence 연결 없음

이번 단계에서는 이 상태를 변경하지 않았다.

## 보존 경계

- Evidence != Fact
- Fact != Decision Axis
- Fact adoption != Recommendation activation
- missing != false
- ingredient identity -> barrier claim inference 금지
- moisturizing/soothing -> barrier claim inference 금지
- 측정값만으로 claim 의미를 대체하지 않음
- 형제/라인 제품 근거 전이 금지
- 시장 간 자동 근거 전이 금지

## 다음 단계

`V2.1-8H-R13D_ATOPALM_DIRECT_EVIDENCE_INGEST_PREFLIGHT`

두 직접 근거를 governed Evidence ingest 후보로 검토한다.

현재 단계에서는 Evidence ingest 자체를 승인하거나 실행하지 않는다.
