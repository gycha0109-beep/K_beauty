# DATA-AI29C-FILTER-R4-C-R1 — BUSHMAN Identity Authority Recovery Contract

## 판정
`R4_C_R1_SOURCE_BRIDGE_DESIGN_COMPLETE_IDENTITY_UPGRADE_HOLD`

이번 단계는 **기존 BUSHMAN 공식 출처 계보 read-only 동결과 Subject 권한 승격 계약 설계**다.
Product/Subject/Candidate/Fact/Recommendation DB writes 0; RPC 및 migration 배포 0.

## 실제 Production source chain
- Product: `4608b3b4-8b51-4464-b46e-380b05c1a3d7`; Subject: `0b5963bb-67d6-4738-a620-32ec86c1e3d0` (KR, resolved/current, exact current 1)
- Subject semantic key: `33696edfb47c47672930e0d398b0cd67fb966c355ec474ea9ec4ffa72400a584` — 동일 payload DB 재계산 결과와 일치
- 기존 Subject formulation: `data-ai29c-c5-bushman-waterproof-pro-current` / `BUSHMAN Waterproof Pro Suncream 50g`
- `product_source_bindings`: BUSHMAN 공식 binding `9da03b35-9e00-4c46-8ff0-8f6835382349` / resolved / KR / `trust_official_source_review_v1`
- `trust_official_source_binding_reviews`: `067e861d-2e61-4ec2-a3f7-660d78be468d`; 동일 Product/Subject/revision, scope `equivalent`
- Product Evidence Sources + Subject bindings: **4건** / 모두 공식 URL, KR, `exact_subject_match`, `equivalent`, 각각 별도의 SHA-256 content digest
- 공식 URL: `https://bushmankorea.com/product/%EB%B6%80%EC%89%AC%EB%A7%A8-%EC%9B%8C%ED%84%B0%ED%94%84%EB%A3%A8%ED%94%84-%ED%94%84%EB%A1%9C-%EC%84%A0%ED%81%AC%EB%A6%BC-spf50-pa-50ml/31/`
- 기존 Product Candidate `77856d50-a033-4646-ae23-2a1162138319`는 Hwahae 출처 1건. 신규 Product 생성/기존 Candidate 공식 출처 위조 금지.

**중요:** Official Source Review는 Product source binding을 검토한 것이지 Subject identity authority upgrade를 승인한 기록이 아니다.
4개 Evidence Source digest는 시간/관찰별 별도 기록이며 같다고 조작하지 않는다.
이 계보는 새 Subject identity attestation의 입력으로만 사용한다.

## Identity HOLD: 50g vs 50ml
기존 Subject `formulation_label`의 50g과 공식 URL slug의 50ml가 불일치한다.
이번 작업에서 페이지 본문/패키지를 새로 가져와 검증한 것은 아니다.
g↔ml 환산이나 문자열 기반 치환 없이 SKU·처방·시장 동등성에 대한 **관리자 별도 검토 기록**을 필수 조건으로 한다.
불명확하면 fail-closed하며 Subject label을 수정하지 않는다.

## R4-C-R2 전용 RPC 계약 (이 단계에서는 구현하지 않음)
- Exact Product/Subject, 출발 `data-ai29c-c5-presentation-identity-correction-v1`, 목적지 `trust-phase5-admin-subject-review-v1`만 허용.
- 기존 COSRX 승격 RPC와 기존 immutable Subject registration RPC는 **변경 금지**.
- 제안명: `bushman_identity_auth_plan_v1`, `admin_pf_bushman_identity_auth_v1`, `admin_confirm_bushman_identity_auth_v1`.
- `admin.products.review` capability, 관리자 검토 출처, 기존 semantic key 재계산, exact Subject 1개, 필드 불변성 요구.
- Preflight: official Source receipt·digest + 관리자 identity attestation + 용량/처방 차이 검토, stale-prestate + payload digest, 실제 write 0.
- stale-prestate digest 입력: Subject/updated_at, 공식 binding/review, 4 Evidence Sources 및 bindings, Fact Current/Instances, Research Tasks, Evidence Records, Semantic Reviews, 신규 identity attestation.
- Confirmation: 별도 명시적 승인 후 Subject advisory/row lock, digest 재계산, stale 변경 시 HOLD, request idempotency 검사와 감사 로그 기록.
- 허용 예정 write set: `product_fact_subjects` 1행(업무 필드 `identity_resolution_version` + 시스템 `updated_at`), `product_fact_review_events` 1행, `admin_audit_logs` 1행.
- 다른 모든 Fact/Source/Evidence/Semantic/Taxonomy/Ranking/Allowlist/Public/UVA/Water 변경 0. Service role 직접 Subject UPDATE 및 anon/authenticated privileged RPC 사용 불허.

## 현행 종속 데이터
Product Fact Current 3 / Fact Instance 3 / Research Task 4 / governed Source Binding 4 / Evidence Record 3 / Semantic Review 0. COSRX용 과거 카디널리티 강제 적용 금지.

## 종료조건
A. 정확한 공식 Source 4 + Product Binding 1 + 관리자 검토 1 계보 / checksum·Subject scope 검증 — PASS.
B. C5 한정 승격 계약과 stale/audit/idempotency/negative tests 설계 — PASS.
C. 실제 독립 identity attestation·용량 표기 검토·RPC deployment·Subject authority grant — **HOLD**.

후속은 `DATA-AI29C-FILTER-R4-C-R2`. R4-C-R1 PR merge SHA 모든 CI PASS 이후 별도 bounded RPC 구현 가능.
실제 Subject confirmation은 명시적 추가 승인 전 금지.
