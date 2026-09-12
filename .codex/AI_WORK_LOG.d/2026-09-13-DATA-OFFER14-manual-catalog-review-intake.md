# DATA-OFFER14 — governed manual catalog-admission ingress

## Fresh authority

DATA-OFFER14 starts from fresh repository and Production reads rather than the DATA-OFFER13 historical main SHA.

Fresh Production read-only observation at `2026-09-13T03:13:23.592502+09:00` confirms candidate `ccf23119-b067-4076-bb9e-01a83cf88fa0` remains:

- `review_status = new`
- `identity_resolution_state = unresolved`
- `identity_resolution_version = crawler-identity-resolution-v1`
- canonical brand/name/category/form = null
- matched/duplicate Product = null
- `candidate_promotion_reviews` row count = 0
- popularity observations = 6 / best rank 2 / latest rank 8 / 3 distinct dates
- concern observations = 0
- `queue_eligible = false`
- equivalent manual catalog admission/enqueue function count = 0

No Production write was performed.

## Structural gap

`admin_confirm_product_candidate_structural_adoption_v1` already owns the later explicit structural-adoption authority. It requires an actionable review row (`queued`, `reviewing`, or `deferred`) and then resolves identity and invokes Product promotion.

The only current queue producer, `refresh_candidate_promotion_reviews('ranking-review-v2')`, derives admission from recommendation concern-ranking policy. The Torriden/Hwahae candidate has only popularity evidence and therefore cannot enter that queue.

The existing refresh function also updates/deferes every `queued|reviewing` row regardless of the row's `rule_version`. A new manual catalog queue row would therefore be vulnerable to ranking refresh unless ranking ownership is narrowed.

## DATA-OFFER14 change

Add `admin_enqueue_product_candidate_structural_review_v1` as a narrow admin-only catalog-admission ingress.

Inputs:

```text
actor_user_id
candidate_id
request_id
reason
identity_evidence
```

The function:

- reuses `admin.products.review` through `admin_require_product_review_actor`,
- requires a non-promoted `new + unresolved` candidate with complete raw source provenance,
- requires explicit independent identity evidence from at least two distinct providers,
- requires downstream authority flags to remain false,
- rejects recommendation/scoring semantic keys and JSON nulls in submitted evidence,
- bounds reason and evidence payload size,
- creates only a `queued`, priority-0 manual catalog review row when none exists,
- protects existing `queued` and `reviewing` reviews from a second intake,
- protects `approved` and `rejected` terminal reviews,
- permits a new request to requeue only a `deferred` review with no approved Product,
- makes exact `request_id + payload` replay idempotent with zero second mutation,
- rejects ambiguous reuse of the same `request_id` with a different actor/candidate/reason/evidence payload,
- records a standard Admin audit event only when a queue write actually occurs,
- grants no Product identity resolution, Product creation/merge, source binding, Offer, Product Fact, or recommendation semantic authority.

The existing ranking refresh is narrowed so its update and defer paths mutate only rows already owned by `ranking-review-v2`.

## Isolated runtime proof

The dedicated isolated Supabase verifier covers:

- unauthorized actor rejection,
- short reason rejection,
- malformed evidence rejection,
- duplicate-provider evidence rejection,
- forbidden recommendation/scoring semantic key rejection,
- nested JSON-null rejection,
- oversized evidence rejection,
- missing candidate rejection,
- promoted/resolved candidate rejection,
- existing `queued` protection,
- existing `reviewing` protection,
- `approved` terminal protection,
- `rejected` terminal protection,
- valid fresh manual queue insertion,
- exact request idempotent replay,
- same request ID / different payload conflict rejection,
- governed `deferred` requeue with prior evidence preservation,
- exact requeue replay idempotency,
- one audit row per actual queue mutation and no audit duplication on replay,
- ranking refresh preservation of manual queue rows,
- continued normal `ranking-review-v2` queue behavior,
- candidate identity snapshots unchanged,
- Product row count unchanged,
- source-binding row count unchanged,
- Offer row count unchanged,
- Product Fact Current row count unchanged,
- recommendation semantic row count unchanged.

## Production boundary

This repository migration is not applied to Production by DATA-OFFER14 merge.

Until a separate explicit Production migration authorization is given:

```text
Production migration write = 0
Production manual queue write = 0
Production candidate identity write = 0
Production Product write = 0
Production source binding write = 0
Production Offer write = 0
Production Product Fact write = 0
Production recommendation semantic write = 0
```

The next authority gate after merged-main validation is explicit Production migration authorization. Only after that gate may the target candidate be manually admitted to review; structural adoption remains a later, separate explicit confirmation.
