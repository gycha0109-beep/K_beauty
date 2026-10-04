# V2.1-8H-R11A — Legacy Backfill Controlled Subject Registration Path

## 종료 판정

`LEGACY_BACKFILL_CONTROLLED_SUBJECT_PATH_READY`

R10 READY 3개는 legacy-backfill intake라 `source_candidate_id=null`이다. 기존 Phase 5B 등록 경로는 source candidate가 없으면 `trust_subject_registration_identity_source_missing`으로 차단되어 R11을 실행할 수 없었다.

R11A는 새 writer를 만들지 않고 기존 Phase 5B의 **정체성 소스 정규화 단계만 확장**한다.

## 허용 정체성 소스

1. 기존 경로
   - promoted source candidate
   - resolved identity
   - `product_fact_write_allowed=false`
2. legacy-backfill 경로
   - `source_candidate_id=null`
   - intake에 보존된 `admin_identity_authority`
   - intake market과 authority market 정확히 일치
   - HTTPS official locator
   - SHA-256 source digest
   - authority resolution version 존재
   - Product lineage 일치
   - 강제 `product_fact_write_allowed=false`

legacy 경로는 가짜 source candidate UUID를 만들지 않는다. proposal의 `sourceCandidateId`는 계속 null이며 `identitySourceKind=admin_identity_authority`로만 구분한다.

## 변경하지 않는 것

- Subject semantic identity 7필드
- `product-fact-subject-identity-v1` serializer
- reviewer가 직접 입력하는 variant/formulation/market
- stale-preflight 검증
- competing current Subject 검증
- governed Subject writer `admin_register_product_fact_subject_v1`
- Registry v1 pinned `process_catalog_trust_product_v3`
- explicit confirmation
- Evidence 자동 채택 금지
- Product Fact 자동 confirmation 금지
- Recommendation 변경 금지

## Production 현재 상태

READY 3개 모두 공식 identity authority는 intake에 선반영되어 있다. Subject는 아직 0개다.

- Product Fact Subject 총계: 47
- READY3 Subject: 0
- Product Fact Current: 101
- Fact Instance: 102
- Confirmation: 102

## 다음 단계

`V2.1-8H-R11B — READY3 Controlled Subject Registration`

R11B는 이 경로가 merge/deploy된 뒤 기존 admin Phase 5B preflight/confirm을 사용해 READY 3개를 명시적으로 등록한다. 새 DB writer나 자동 Product Fact 채택은 허용하지 않는다.
