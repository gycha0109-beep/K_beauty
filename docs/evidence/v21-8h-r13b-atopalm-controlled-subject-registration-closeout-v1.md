# V2.1-8H-R13B — ATOPALM Controlled Identity + Subject Registration Closeout

## 종료 판정

`BARRIER_SUPPORT_ATOPALM_P0_CONTROLLED_SUBJECT_REGISTRATION_PASS`

R13A에서 복구한 아토팜 `릴렉싱 나이트 밤`의 공식 KR 식별 권위를 기존 통제 경로로 Production에 반영하고, Product Fact Subject 등록과 재처리를 완료했다.

## Production 실행 결과

- 대상 Product: `418e2bc1-7d6c-4334-9058-7af7ce159c6c`
- 신규 Subject: `c7e19978-5678-466b-ba69-f5936aeca5cc`
- 의미 키: `f6665f595558d93a4887f63ae5574db014020602e67c59097699d2a40402850b`
- 처방 버전 키: `v21-8h-r13a:50d690c76745f352907a9c1e22e47346de6bc95c5ad933871fc22c33c1dec4ac`
- 공식 식별: `릴렉싱 나이트 밤 100ml ×2개 세트`
- 시장: `KR`
- Intake: `EXACT_SUBJECT_FOUND / RESEARCH_PENDING`

실행 순서는 R13A에서 동결한 그대로 유지했다.

1. 식별 권위 해결
2. trust 재처리
3. Subject 등록 전 충돌/계보 재검증
4. Subject 통제 등록
5. trust 재처리
6. Production readback

## 연구 작업 전환

기존 작업 ID는 새로 만들지 않고 그대로 유지했다.

- `b1430a7d-79bb-43a5-bfea-a19599441811` — `barrier_support_claim`
- `cbdad075-35a1-476e-b3ac-6279b676e73e` — `primary_use_role`

두 작업 모두:

- `REVIEW_REQUIRED → RESEARCH_PENDING`
- `SUBJECT_CREATION_REQUIRED → null`
- `attempt_count=0`
- 신규 Subject에 결합

## 권위 보존

재처리 후에도 R13A 공식 식별 권위가 보존됐다.

- 공식 위치: `product_no=3324`
- 표현: `100ml ×2`
- 총 카탈로그 용량: `200ml`
- 캡처 SHA-256: `50d690c76745f352907a9c1e22e47346de6bc95c5ad933871fc22c33c1dec4ac`
- 권위 버전: `v21-8h-r13a-official-identity-v1`

## Production 불변성

등록 전후:

- Subject: **50 → 51**
- Product Fact Current: **105 → 105**
- Fact Instance: **106 → 106**
- Confirmation: **106 → 106**
- Evidence Record: **108 → 108**

신규 Subject 기준 Fact Instance / Current Fact / Evidence는 모두 **0건**이다.

따라서 이번 단계는 식별 및 Subject 등록만 수행했으며 Evidence 채택, Fact 확정, Recommendation 변경으로 확장되지 않았다.

## 카탈로그 링크 부채

기존 Product의 `buy_link`는 여전히 공식 단품 100ml(`product_no=3323`)를 가리킨다.

이번 R13B에서는 이를 수정하지 않았다.

- 정식 식별 권위는 `product_no=3324` 번들 페이지 사용
- 일반 Product buy_link 수정용 governed RPC 없음
- 직접 SQL 수정 승인 없음
- 별도 카탈로그 링크 보정 부채로 유지

## 제로이드 HOLD

제로이드 Intensive SOS Plus Balm은 이번 실행 대상이 아니다.

- HOLD 유지
- 사유: `FIRST_PARTY_PRESENTATION_SIZE_UNCONFIRMED`
- Product Fact Subject: 0건
- 자동 해제 없음

## 다음 단계

`V2.1-8H-R13C_ATOPALM_OFFICIAL_EVIDENCE_RESEARCH`

이제 아토팜의 두 필수 사실에 대한 공식 근거 조사를 진행할 수 있다.

- `barrier_support_claim`
- `primary_use_role`

다만 다음 경계는 그대로 유지한다.

- Evidence != Fact
- 근거 부족 != false
- 공식 claim != 측정 효능
- Recommendation 자동 활성화 금지
- 제로이드 HOLD 자동 해제 금지
