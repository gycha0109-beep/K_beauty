# Functional Safety Review Packet

## Purpose

Safety divergence needs a separate manual review because it is the only divergence class where the functional audit blocks a product that the existing engine selected. The packet makes those cases reviewable without changing policy.

It does not decide that the existing engine is wrong or that the functional hard filter is correct.

## Relationship To Phase 6

Phase 6 classifies high-confidence `existing_selected_but_blocked` divergence as `safety_review_required`. Phase 7 turns those cases into a packet with user safety context, product/profile context, hard-filter reasons, and manual review questions.

## Target Cases

Included:

- `comparisonConfidence === "high"`
- divergence type is `existing_selected_but_blocked`
- hard-filter reasons are present
- replay/capture context can be read

Excluded:

- low-confidence cases
- `existing_selected_but_insufficient_data`
- candidate-source-incomplete cases
- malformed captures

## Packet Contract

`buildFunctionalSafetyReviewPacket({ replaySummary, divergencePolicyReview, options })` returns:

- `reviewScope`
- `cases`
- `aggregate`
- `reviewQuestions`
- `decisionFramework`
- `allowedReviewOutcomes`
- `limitations`

Each case contains audit trace IDs, divergence status, user safety context, sanitized product/profile context, filter decision details, existing result membership, review questions, and allowed manual outcomes.

## Data Not Stored

The packet must not include:

- raw form
- image/base64/file/path
- email/session/cookie/user-agent
- product name
- brand
- purchase URL
- raw review text
- PII

Product ID and capture ID are internal audit trace fields only.

## Allowed Outcomes

Manual reviewers may choose only:

- `guard_appears_appropriate`
- `possible_overblocking`
- `insufficient_product_metadata`
- `goal_function_difference`
- `insufficient_sample`
- `needs_domain_review`

Initial outcome is always `null`. The script does not choose an outcome.

## Decision Framework

`guard_appears_appropriate`

Use when comparison is high-confidence, product-level risk metadata exists, safety context directly connects to product risk, and the block is not only category generalization.

`possible_overblocking`

Use when the block appears to rely on a broad category/axis rule, or when low-risk product metadata exists but the product is still fully blocked.

`insufficient_product_metadata`

Use when key fields such as `irritation_risk`, `sensitivity_safe`, `functionalAxes`, or `cautionTags` are missing.

`goal_function_difference`

Use when the core issue is the different objective of the existing and functional engines rather than a direct safety conflict.

`insufficient_sample`

Use when there are not enough matching high-confidence cases.

`needs_domain_review`

Use when metadata-only judgment is not enough for the skin-risk question.

## Non-Change Rule

This packet is evidence for people. It does not change hard filters, scores, candidate policy, UI, API responses, stored payloads, products, or existing recommendation output.

## Limitations

- Current evidence is development-only.
- Current captures use a fixed test image.
- Sample size is small.
- Product metadata may still be incomplete.
- Existing engine selection rationale must not be inferred beyond recorded membership/source.

## Next Conditions

People must assign outcomes case by case. Only repeated `possible_overblocking` or `insufficient_product_metadata` outcomes should create a separate policy-change task. `guard_appears_appropriate` can support keeping the current guard. `needs_domain_review` must not trigger automatic tuning.
