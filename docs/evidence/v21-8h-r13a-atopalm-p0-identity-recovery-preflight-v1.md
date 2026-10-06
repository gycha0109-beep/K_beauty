# V2.1-8H-R13A — 아토팜 P0 식별 권위 회복 Preflight

## 종료 판정

`BARRIER_SUPPORT_ATOPALM_P0_IDENTITY_RECOVERY_PREFLIGHT_PASS`

R9에서 `BUNDLE_PRESENTATION_SCOPE_UNRESOLVED`로 HOLD됐던 아토팜 릴렉싱 나이트 밤의 공식 KR presentation authority를 다시 확인했다.

R13A에서는 Production 쓰기를 수행하지 않았다.

## 기존 HOLD 원인

Catalog row:

- Product: `418e2bc1-7d6c-4334-9058-7af7ce159c6c`
- 이름: 릴렉싱 나이트 밤
- size: 200ml
- 원천: 화해 goods `74373`
- 기존 buy link: 아토팜 공식몰 `product_no=3323`

R9 당시 공식몰에서는:

- 100ml 단품
- 100ml ×2 세트

가 함께 관찰됐지만 catalog 이름에 세트 표기가 없고 buy link가 단품을 가리켜 정확한 presentation을 닫지 못했다.

## 공식 presentation 재확인

현재 아토팜 공식몰은 두 presentation을 명시적으로 분리한다.

단품:

```text
아토팜 릴렉싱 나이트 밤 100ml
product_no = 3323
```

세트:

```text
아토팜 릴렉싱 나이트 밤 100ml ×2개 세트
product_no = 3324
total = 200ml
```

Catalog의 `size_ml=200`과 화해 goods `74373`의 100ml+100ml presentation은 세트와 일치한다.

따라서 기존 bundle-vs-unit ambiguity는 해소됐다.

## Catalog buy link drift

현재 catalog `buy_link`는 여전히 공식 100ml 단품 페이지를 가리킨다.

이것은 별도 catalog-link drift로 분리했다.

```text
canonical catalog presentation = 100ml ×2 / total 200ml
current buy_link                = 100ml single unit
correct official bundle        = product_no=3324
```

현재 Production에는 범용 `products.buy_link` 교정용 governed RPC가 없다.

따라서 R13A에서는 직접 SQL UPDATE로 우회하지 않았다.

Subject identity authority는 이 잘못된 buy link가 아니라 새로 확인한 공식 bundle 페이지에서 가져온다.

## Canonical identity

Capture digest:

`50d690c76745f352907a9c1e22e47346de6bc95c5ad933871fc22c33c1dec4ac`

Formulation revision key:

`v21-8h-r13a:50d690c76745f352907a9c1e22e47346de6bc95c5ad933871fc22c33c1dec4ac`

Subject semantic key:

`f6665f595558d93a4887f63ae5574db014020602e67c59097699d2a40402850b`

Subject label:

`KR official identity — 릴렉싱 나이트 밤 100ml ×2개 세트`

시장:

`KR`

variant:

`null`

## Production prestate

```text
Product Fact Subjects = 50
Current Facts         = 105
Fact Instances        = 106
Confirmations         = 106
Evidence Records      = 108
```

아토팜:

```text
Subject                  = 0
Current Fact             = 0
Fact Instance            = 0
source candidate         = 0
intake                   = 1
Registry v1 tasks        = 2
semantic collision       = 0
formulation collision    = 0
competing current KR     = 0
```

Intake:

```text
identity_state = SUBJECT_CREATION_REQUIRED
trust_state    = REVIEW_REQUIRED
market         = null
subject_id     = null
```

두 연구 Task 모두:

```text
state         = REVIEW_REQUIRED
blocker       = SUBJECT_CREATION_REQUIRED
attempt_count = 0
subject_id    = null
```

## Governed 경로

R11B에서 검증된 legacy-backfill 경로를 재사용한다.

1. `admin_resolve_catalog_trust_intake_identity_v1`
2. `process_catalog_trust_product_v3`
3. controlled Subject registration preflight
4. `admin_register_product_fact_subject_v1`
5. `process_catalog_trust_product_v3`
6. Production readback

세 함수 모두 현재:

- anon 실행 불가
- authenticated 실행 불가
- service_role 실행 가능

이다.

`process_catalog_trust_product_v3`는 R11B authority-preservation fix가 반영되어 nested `identity_authority`를 보존한다.

## 제로이드

제로이드 인텐시브 SOS 플러스 밤은 HOLD를 유지한다.

```text
reason = FIRST_PARTY_PRESENTATION_SIZE_UNCONFIRMED
```

공식 제품 identity와 formulation text는 현재지만, first-party reviewable text에서 40ml presentation을 아직 닫지 못했다.

Secondary 40ml 근거는 이 요구사항을 대체하지 않는다.

## 권위 경계

R13A Production writes:

```text
intake      = 0
Subject     = 0
task        = 0
Evidence    = 0
Fact        = 0
Confirmation = 0
Recommendation = 0
```

Recommendation admission / activation, public activation, production cutover도 모두 미승인 상태다.

## 다음 단계

`V2.1-8H-R13B — ATOPALM Controlled Identity and Subject Registration`

R13B는 위 frozen payload와 최신 prestate가 일치할 때만 실행한다.

Subject 등록 후에야 아토팜의 `barrier_support_claim` / `primary_use_role` 공식근거 연구를 별도 단계로 시작할 수 있다.
