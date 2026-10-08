# DATA-AI29C-FILTER-R4-C — BUSHMAN Subject Identity Authority Recovery Preflight v1

## 판정

`FILTER_R4_C_HOLD_UNSUPPORTED_SUBJECT_LINEAGE_AND_OFFICIAL_CATALOG_SOURCE`

R4-B mixed Registry compatibility는 완료했지만 BUSHMAN Subject authority를 기존 COSRX용 승격 RPC로 바로 복구할 수 없다.
이번 R4-C는 Production read-only 검증만 수행했다. Subject/Source/Fact/Recommendation write는 0이다.

## 고정된 Subject

- Product: `4608b3b4-8b51-4464-b46e-380b05c1a3d7`
- Subject: `0b5963bb-67d6-4738-a620-32ec86c1e3d0`
- Semantic key: `33696edfb47c47672930e0d398b0cd67fb966c355ec474ea9ec4ffa72400a584`
- Formulation revision: `data-ai29c-c5-bushman-waterproof-pro-current`
- Label: `BUSHMAN Waterproof Pro Suncream 50g`
- Variant=null, market=KR, region=null, validity=[null,null]
- 현재 Subject = resolved / current / exact current applicability 1건
- **저장 semantic key와 DB 동일 필드로 재계산한 semantic key 일치**

제품/처방/시장 정체성은 보존 가능하므로, 새 Subject를 만들거나 Fact를 재바인딩하지 않는다.

## 차단 1 — 기존 Subject authority writer가 C5 lineage를 허용하지 않음

현재:
`data-ai29c-c5-presentation-identity-correction-v1`

기존 `product_fact_subject_identity_authority_upgrade_plan_v1`은 출발 authority를
`gpt-catalog-machine-subject-v1` 또는 이미 성공한 `trust-phase5-admin-subject-review-v1`으로 제한한다.
현재 C5는 어느 쪽도 아니다. DB의 배포 함수 정의에도 C5 허용 transition은 없다.

Admission이 요구하는 것은 `trust-phase5-admin-subject-review-v1`이다.
문자열만 바꾸는 direct UPDATE, COSRX RPC 범용 허용 확대, 이미 승인된 것처럼 허위 lineage를 입력하는 행위는 금지한다.

DB에서 실제 호출 가능한 preflight 함수명은
`admin_preflight_product_fact_subject_identity_authority_upgrade`이며,
저장소의 선언형 긴 이름 `..._v1`이 Postgres 식별자 길이 제한으로 축약되어 있다.
그러나 이 함수는 지금 C5 Subject에 사용해도 validation에서 실패한다.
승격 RPC 실행 또는 관리자 actor/confirmation 수행은 하지 않았다.

## 차단 2 — Catalog identity candidate에 공식 출처 권위 부족

BUSHMAN의 연결된 `product_candidates` 1건:

- candidate ID: `77856d50-a033-4646-ae23-2a1162138319`
- promoted / resolved / exact product match
- source locator: `https://www.hwahae.com/en/products/1884027`
- BUSHMAN first-party source = false
- official content SHA256 digest = null

기존 RPC는 Catalog identity source candidate가 official HTTPS locator 및 official content digest를 보유해야 한다.
화해 product URL이 HTTPS라는 사실은 제조사 공식 authority를 의미하지 않는다.

R3-R3의 BUSHMAN 공식 제품 페이지 Source/Binding은 Product Fact composition authority이다.
이를 곧바로 Catalog identity candidate 또는 Subject authority attestation으로 치환하지 않는다.

## Production cardinality

| 항목 | 현재 |
| --- | ---: |
| Exact current Subject | 1 |
| Current Product Fact | 3 |
| Fact Instance | 3 |
| Research Task | 4 |
| Source Binding | 4 |
| Evidence Record | 3 |
| Current Sunscreen Semantic Review | 0 |
| Subject authority upgrade audit | 0 |

COSRX의 기존 dependent authority cardinality를 BUSHMAN에 그대로 적용해서는 안 된다.
R3-R3 당시보다 늘어난 Research Task/Source Binding도 현재 Production 값 그대로 보존한다.

## 결론 및 후속 gate

`R4-C-R1_BUSHMAN_SUBJECT_AUTHORITY_RECOVERY_CONTRACT`를 새로 정의한다.

1. BUSHMAN first-party Catalog identity source candidate를 existing governed intake 경로로 조사/검토. 공식 source digest, exact formulation equivalence, reviewed catalog identity를 확보한다.
2. 기존 COSRX RPC의 출발 lineage 조건을 무작정 완화하지 않고,
   `data-ai29c-c5-presentation-identity-correction-v1 → trust-phase5-admin-subject-review-v1`를 위한 별도 관리 계약을 설계한다.
3. Actor capability, exact reviewed identity/semantic key, stale-prestate, Audit, no-dependent-mutation을 요구한다.
4. 디자인/정적 검증을 통과한 뒤, Production **read-only preflight**를 별도 수행한다.
5. explicit confirmation은 preflight PASS 후에도 별도 승인 필요. R4-D semantic 및 Admission 역시 독립 gate다.

**R4-C는 Subject 업그레이드 실행을 승인하지 않는다.**

## 불변조건

Production DB, Subject, Catalog source, Fact, Evidence, Semantic Review, Recommendation, Beta allowlist,
SPF/UVA/Water ranking, public activation: 변경 0.

END
