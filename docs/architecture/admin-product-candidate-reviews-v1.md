# Bejewely Admin Product Candidate Reviews v1

## 1. 목적

이 단계는 관리자 권한 기반 위에 첫 실제 운영 업무를 연결한다.

```text
검토 큐 목록
→ 후보·랭킹·중복 근거 상세
→ approve / defer / block 선택
→ dry-run preflight
→ 동일 스냅샷 confirm
→ products 반영 또는 보류·차단
→ 관리자 감사 로그
```

관리자 UI는 기존 크롤링·후보·승격 계약을 대체하지 않는다. `products` 변경은 검증된 confirm 경로에서만 허용한다.

## 2. 기존 authoritative source

- 후보 우선순위와 랭킹 근거: `candidate_promotion_reviews`
- 후보 식별·정규화·승격 payload: `product_candidates`
- 기존 카탈로그: `products`
- 최종 승격: service-role 전용 `promote_product_candidate(uuid, text)`
- 관리자 권한: `admin_memberships`와 capability
- 관리자 감사: `record_admin_audit_event(...)`

크롤러는 `products`를 직접 수정하지 않는다. UI도 동일 원칙을 유지한다.

## 3. 결정 매핑

| UI 결정 | 검토 큐 상태 | 후보 상태 | products write |
| --- | --- | --- | --- |
| `approve` | `approved` | confirm 중 `approved` 후 기존 RPC가 `promoted`로 전환 | 0 또는 1 |
| `defer` | `deferred` | `needs_review` | 0 |
| `block` | `rejected` | `rejected` | 0 |

`approve`는 필수 사실값과 안전 게이트가 승격 가능하다는 의미다. 불확실한 선택 필드는 `null`을 유지할 수 있다.

## 4. 접근 경계

```text
/admin/products/reviews page
→ admin.products.read 재검증
→ service-role server query

preflight route
→ admin.products.review 재검증
→ service-role-only DB preflight RPC

confirm route
→ admin.products.review 재검증
→ service-role-only DB confirm RPC
→ DB에서 actor 활성 멤버십·capability 재검증
```

브라우저에는 service-role key를 전달하지 않는다. `candidate_promotion_reviews`, `product_candidates`, confirm 기록 테이블의 직접 쓰기 권한을 authenticated에 부여하지 않는다.

## 5. 목록 계약

기본 필터는 `queued`, `reviewing`이다. 허용 필터:

```text
queued
reviewing
approved
rejected
deferred
```

목록 필드:

- candidate id
- 브랜드·제품명
- queue status
- priority score
- selection reason
- rule version
- 최신 큐 갱신 시각
- candidate review status
- service category / product form
- review flags
- match confidence

서버에서 최대 100건만 조회한다. 전체 행을 브라우저로 전달하지 않는다.

## 6. 상세 계약

상세는 다음을 순서대로 표시한다.

1. 후보 식별
   - 원본·정규화·canonical 브랜드/제품명
   - source external identity
   - category / product form
2. 검토 큐 근거
   - concern 관측
   - popularity 관측
   - priority score와 selection reason
   - rule version
3. 기존 제품 비교
   - matched 또는 duplicate product
   - normalized identity
   - category / product form
4. 승격 payload
   - skin types
   - concerns
   - texture / finish
   - irritation risk / sensitivity safe
   - price / buy link / image URL 존재 여부
5. 변경 작업
   - decision
   - 필수 reason
   - dry-run 결과
   - confirm

원본 JSON은 기본 접힘 상태의 진단용 details에서만 표시한다.

## 7. Preflight 계약

`admin_preflight_product_candidate_review`는 products와 후보 상태를 변경하지 않는다.

입력:

```text
actor_user_id
candidate_id
decision
reason
```

출력:

```text
status: ready | blocked
decision
candidate_id
candidate_updated_at
review_updated_at
evidence_hash
preflight_hash
issues
planned.products_write_count
planned.promotion_action
planned.target_product_id
before
after
```

검증:

- actor가 활성 관리자이며 `admin.products.review` 보유
- candidate와 queue row 존재
- queue status가 queued 또는 reviewing
- candidate가 이미 promoted가 아님
- decision 허용값
- reason 길이
- approve 시 canonical identity
- category / treatment product_form
- promotion payload 필수 enum·배열·boolean
- 기존 products 중복 대상 예측

preflight hash는 신뢰 토큰이 아니라 optimistic concurrency fingerprint다. confirm은 모든 값을 다시 계산한다.

## 8. Confirm 계약

`admin_confirm_product_candidate_review`는 한 트랜잭션에서 다음을 수행한다.

```text
request idempotency 조회
→ actor capability 재검증
→ candidate / queue FOR UPDATE
→ preflight 재계산
→ expected timestamps / evidence hash / preflight hash 비교
→ decision 적용
→ approve면 기존 promote_product_candidate 호출
→ queue 결과 저장
→ admin audit 기록
→ confirmation result 저장
```

### approve

- preflight가 `ready`여야 한다.
- candidate를 `approved`로 전환한 뒤 기존 승격 RPC를 호출한다.
- 기존 RPC가 `inserted`, `merged`, `already_promoted` 이외 결과를 반환하면 전체 트랜잭션을 실패시킨다.
- queue에는 `approved_product_id`를 저장한다.

### defer

- queue를 `deferred`로 전환한다.
- candidate를 `needs_review`로 전환한다.
- products write는 0이다.

### block

- queue를 `rejected`로 전환한다.
- candidate를 `rejected`로 전환한다.
- products write는 0이다.

## 9. 동시성·중복 실행

confirm 입력은 다음 expected 값을 포함한다.

- candidate updated_at
- review updated_at
- evidence hash
- preflight hash
- request id

하나라도 현재 값과 다르면 fail-closed 한다.

`admin_product_review_confirmations`는 request id별 최종 결과를 저장한다. 동일 actor/candidate/decision/hash 재시도는 같은 결과를 반환한다. 같은 request id를 다른 작업에 재사용하면 거절한다.

## 10. 감사 계약

감사 action:

```text
admin.product_candidate.review_confirmed
```

감사 metadata:

- decision
- preflight hash
- promotion action
- product id
- queue status

감사 로그에는 token, cookie, secret, 원본 얼굴 이미지, 대형 evidence snapshot을 넣지 않는다. before/after는 후보·큐 상태와 최종 product id 수준으로 제한한다.

감사 기록 실패 시 confirm 전체를 rollback 한다.

## 11. UI 상태

```text
idle
→ preflighting
→ ready | blocked
→ confirming
→ confirmed | failed
```

후보·decision·reason이 바뀌면 기존 preflight를 즉시 폐기한다. confirm 버튼은 `ready` 상태에서만 활성화한다.

## 12. 비대상

- crawler review queue B 정책 변경
- review export CSV / JSONL 구현
- 외부 웹 검수 자동화
- bulk approve
- 관리자 임의 product field 편집
- hosted Supabase migration 적용
- Production 배포
- 일반 사용자에게 관리자 화면 노출

## 13. 검증 매트릭스

- viewer는 목록 읽기 가능, preflight·confirm 불가
- operator와 owner는 preflight·confirm 가능
- Premium `admin_override`만 가진 사용자는 접근 불가
- authenticated가 DB RPC를 직접 호출하면 거절
- dry-run products write = 0
- missing product form approve preflight 차단
- wrong hash / stale timestamp confirm 차단
- approve 신규 제품 insert
- approve 기존 제품 merge
- defer products write = 0
- block products write = 0
- 동일 request retry 결과 동일
- direct table escalation 차단
- audit 1건 기록
- architecture guard, production build, diff check 통과

## 14. 완료 조건

- 실제 queue 데이터가 목록과 상세에 표시된다.
- 근거 없이 approve할 수 없다.
- dry-run과 confirm 사이 상태 변경을 감지한다.
- approve만 기존 승격 RPC를 통해 products를 변경한다.
- defer와 block은 products를 변경하지 않는다.
- 모든 confirm은 capability 검증과 감사 기록을 거친다.
- 중요·보안 문제 없이 격리 Supabase role-matrix 검증을 통과한다.
