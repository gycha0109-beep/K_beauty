# CRAWLER-CONTROLLED-OPERATIONAL-ACTIVATION v1

Status: `PRE_RUN_FROZEN`

## Controlled run manifest

- stage_version: `crawler-controlled-operational-activation-v1`
- starting_main_sha: `4b6dfaf6d90826728f8029bcaa3be3fcde77c3f5`
- starting_production_sha: `4b6dfaf6d90826728f8029bcaa3be3fcde77c3f5`
- starting_production_deployment: `dpl_EqbP54AMPdFPF3jta71Lcvd5CHCC`
- source: `hwahae`
- crawler_job_id: `hwahae-skincare-toner-category-all`
- source_category/theme: `toner / category_all / theme_id=5106`
- service_category: `toner_essence`
- target_url: `https://www.hwahae.com/en/rankings?english_name=category&theme_id=5106`
- source_scope: existing enabled toner category-all job, narrowed from Top20 to the first 10 rows for this proof only
- expected_rank_ceiling: `10`
- crawl_execution_ceiling: `1`
- logical_ranking_document_navigation_ceiling: `2` including one bounded retry
- gateway_api_request_ceiling: `0` because requested_limit <= 20
- delay_ms: `1500`
- retries: `2`
- observation_write_ceiling: `10`
- candidate_write_ceiling: `10` inserted + reobserved + pending collision outcomes
- review_ceiling: `5`
- canonical_adoption_ceiling: `1`
- scheduler: `OFF`
- auto_adoption: `OFF`
- started_at: `2026-08-22T15:03:02+09:00`

## Frozen pre-run Hosted state

- ranking_snapshots: `27`
- source_rankings: `780`
- product_candidates: `164`
- candidate_promotion_reviews: `50`
- crawler_canonical_adoption_requests: `0`
- products: `164`
- legacy: `164`
- non_legacy: `0`
- registry_versions: `1`
- definition_snapshots: `20`
- subjects: `16`
- fact_instances: `41`
- evidence_links: `41`
- review_assignments: `41`
- review_events: `180`
- confirmations: `41`
- current_facts: `41`
- legacy_uuid_sha256: `b6577d95353c4151152cf82e1705131516d5a2558cb68241a8f9fd48d9047a05`

## Frozen live review authority

- rule_version: `ranking-review-v2`
- KST distinct-date semantics: `(coalesce(snapshot.collected_at, source_ranking.collected_at) at time zone 'Asia/Seoul')::date`
- immediate: latest concern rank <= 15
- persistent: latest concern rank 16-30 and same concern on >= 2 distinct KST dates
- reinforced: latest concern rank 31-50 and same concern on >= 3 distinct KST dates and reinforcement
- popularity-only observation does not itself create queue eligibility

## Stop conditions

Stop before any review/promotion if any of the following occurs:

- current main or Production no longer contains accepted remediation authority
- selected source contract materially drifts or source request fails after bounded retry
- more than one crawler execution or more than one source job is selected
- observed rows exceed 10
- candidate inserted + reobserved + pending collision outcomes exceed 10
- review rule version differs from `ranking-review-v2`
- crawler or review path writes Product Fact / PDA / G2 / Recommendation authority
- structural promotion would assert any Recommendation semantic denylist field
- duplicate or uncertain identity would have to be coerced to `resolved`
- more than one canonical structural product would be promoted
- crawler scheduler, cron, or auto-adoption becomes enabled
- unauthorized Hosted delta is detected

## Containment / rollback

- No cron/scheduler or auto-adoption is enabled.
- The real crawler run is a one-shot exact job-id invocation.
- Observation/candidate rows are durable operational evidence and are not rolled back when valid.
- No product promotion is attempted until post-crawl ceilings and identity checks pass.
- If a structural product is promoted, it is retained only as the explicitly reviewed canonical proof; no Product Fact is auto-created.
- Any unexpected authority or scope delta terminates the Stage before further mutation.

## Planned invocation

`npm run crawl -- --config=config/controlled-operational-activation-v1.json --job-ids=hwahae-skincare-toner-category-all --delay-ms=1500 --retries=2`

This invocation intentionally does **not** use `--all` and, because it is filtered by `--job-ids`, the crawler itself will not refresh the review queue or perform promotion.
