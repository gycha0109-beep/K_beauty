# Functional Divergence Policy Review

## Purpose

Functional divergence review turns high-confidence shadow comparison output into a structured review queue. It separates observation from policy-review candidates, safety-review cases, and comparison limits.

This phase does not change ranking policy. It does not change the existing recommendation engine, functional ranking scores, hard filters, UI, API responses, or stored payloads.

## Connection To Phase 5

Phase 5 added a read-only existing candidate source boundary. New development captures can now include the existing engine's `post_score_candidate_pool` as `complete` product-row source. That allows high-confidence comparison between existing selected results and the functional candidate audit.

Phase 6 uses those high-confidence replay results. Low-confidence final-results-only captures are reference data only.

## Included And Excluded Scope

Included by default:

- `comparisonConfidence === "high"`

Tracked separately:

- `comparisonConfidence === "medium"`

Excluded from policy promotion:

- `comparisonConfidence === "low"`
- `candidate_source_incomplete`
- `no_comparable_product_ids`
- malformed or failed captures

High and medium comparisons must not be merged into one evidence bucket. Low-confidence results must not drive policy changes.

## Review Statuses

`observation_only`

The divergence is visible but does not have enough structured, repeated, high-confidence evidence for policy review.

`policy_review_candidate`

The divergence repeats above count and rate thresholds in high-confidence comparisons. It creates a manual review question, not a change recommendation.

`safety_review_required`

The existing selected result collides with functional safety hard filters in high-confidence comparison. One case can require safety review, but it still does not automatically change a filter.

`comparison_limit`

The divergence is mainly caused by source incompleteness, product data gaps, functional profile coverage, or ID comparability limits.

## Divergence Rules

`top_pick_mismatch`

A top-pick mismatch alone is not proof that either engine is wrong. It becomes a policy-review candidate only when repeated in high-confidence comparisons and paired with enough structured context such as ranking goal, safety goal, source completeness, and functional candidate status.

`existing_selected_ranked_lower`

This can happen because the existing engine and functional ranking optimize different objectives. Repeated lower rank may become a policy-review candidate, but only as a manual question about objective differences.

`existing_selected_but_blocked`

This is always a safety-review case in high-confidence comparisons. Hard-filter reasons are grouped by stable reason keys such as high sensitivity, recent instability, eye-sting, white-cast, pilling, and irritation risk.

`existing_selected_but_insufficient_data`

This is a comparison limit by default. It points to evaluator/profile coverage or product metadata gaps, not product quality.

`functional_top_candidate_missing_from_existing`

This is meaningful only when the source is complete or otherwise high confidence. It means the functional audit's top candidate was in the existing source but absent from the existing final result. The existing engine's internal reason must not be inferred.

## Policy Candidate Promotion

An item can enter `policyCandidates` only when all are true:

- high-confidence comparison basis
- enough comparable cases
- repeated count threshold met
- repeated rate threshold met
- structural cause can be grouped
- not only a raw score/tie-break difference
- output is a review question, not an automatic recommendation

`changeRecommendation` must remain `null` or `manual_review_required`.

## Safety Review

Safety review means a human should inspect the conflict before any policy tuning. It does not mean the existing product is bad. It means the current user inputs and functional safety guard disagree with an existing selected result.

## Observation vs Comparison Limit

Observation-only cases need more high-confidence samples or more consistent context.

Comparison-limit cases need better candidate/source/profile coverage before policy can be reviewed.

## Category Review

Category review aggregates ranked, blocked, insufficient-data, top-pick mismatch, lower-rank, selected-blocked, and functional-top-missing counts by category.

Small category samples stay observation-only. Repeated insufficient-data becomes comparison-limit. Repeated selected-blocked or ranking divergence can become a policy-review candidate.

## Limitations

- Sample count is limited.
- Development fixtures do not represent real users.
- The current captures use a fixed test image.
- Existing ranking and functional ranking optimize different objectives.
- Shadow comparison shows differences; it does not decide correctness.
- Product profile and safety metadata may be incomplete.
- Current routine data is limited.
- Photo/vision signals may affect the existing engine differently.
- Complete source currently means post-score candidate pool, not the full database.

## Non-Change Principle

This phase only creates review artifacts. It must not modify scores, weights, hard filters, candidate policies, UI, API responses, stored payloads, product data, or existing recommendation output.

## Next Conditions

- Policy candidates still require separate approval before implementation.
- Safety divergence should be reviewed by a human first.
- Existing engine remains active until enough diverse high/medium-confidence evidence supports a separately approved change.
- Real user data must not be used without a separate privacy and data-handling decision.
