# Shadow Dry-run Snapshot Contract

이 문서는 shadow dry-run snapshot contract 문서이며, runtime 정책 변경 또는 CandidatePolicy 연결 승인이 아니다.

## Phase 33 Summary

Phase 33 recommended a future `route_outside_helper_dev_only_artifact_writer` approach. The dry-run must stay disabled by default, use sanitized snapshots, write only local `tmp` artifacts, and prove no API response, recommendation result, or DB write change.

Phase 34 turns that plan into a pure snapshot contract helper and a static route insertion guard review. This still does not connect runtime code.

## Why The Snapshot Contract Is Needed

A future route dry-run needs structured inputs that cannot leak product display data, raw request data, image payloads, PII, or env values. The snapshot contract defines what can be observed and what must be rejected before any route integration is considered.

## Snapshot Types

The helper defines five snapshot types:

- `baselineResponseShapeSnapshot`
- `baselineRecommendationSnapshot`
- `shadowBoundaryHintSnapshot`
- `shadowReceiverSnapshot`
- `comparisonSnapshot`

Every snapshot records:

- contract version
- runtimeConnected false
- routeInvoked false
- supabaseWriteExecuted false
- runtimeMutation false

## Baseline Response Shape Snapshot

Purpose: detect API response shape changes without storing the API response body.

Allowed:

- top-level key list
- response shape hash
- valueDumped false

Forbidden:

- full API response body
- response values
- raw form data
- image/base64 payloads
- PII

## Baseline Recommendation Snapshot

Purpose: detect recommendation result changes without storing product display data.

Allowed:

- topPick id
- supportingProducts ids in order
- budgetAlternatives ids in order

Forbidden:

- product name
- brand
- purchase URL
- review text
- full product object dump

Order is part of the contract. A reordered supporting or budget list is a recommendation change.

## Shadow Boundary Hint Snapshot

Purpose: record future evaluator boundary hint outputs in sanitized form.

Allowed:

- productId
- category
- sourceHardFilterReason
- boundaryDecision
- futureEvaluatorAction
- candidatePolicyHint
- safety metadata class
- reason keys

## Shadow Receiver Snapshot

Purpose: record future CandidatePolicy hint receiver interpretation in sanitized form.

Allowed:

- productId
- category
- receivedHint
- receiverDecision
- futureExposureGroup
- visibilityPriority
- userMessageType
- reason keys
- aggregate collapsed receiver counts for high-risk, metadata-incomplete, and strong-caution cases

## Comparison Snapshot

Purpose: record whether the shadow dry-run changed anything it must not change.

Required fields:

- responseShapeChanged
- recommendationChanged
- topPickChanged
- supportingProductsChanged
- budgetAlternativesChanged
- hiddenToCollapsedDelta
- collapsedToHiddenRegression
- highRiskCollapsedReceiverCount
- sensitivityUnsafeCollapsedReceiverCount
- metadataIncompleteCollapsedReceiverCount
- strongCautionCollapsedReceiverCount
- dbWriteCount
- forbiddenFieldDetected
- killConditionTriggered
- killConditionReasons

## Allowed Fields

Allowed fields are limited to:

- ids
- category
- enum decisions
- reason keys
- shape summaries
- aggregate counts
- boolean comparison results

## Forbidden Fields

Snapshots must reject:

- product name or brand
- purchase URL or buy link
- review text
- raw form data
- image or base64 payloads
- PII
- env/secret/token/API key values
- full API response body dump

## Kill Condition Fields

The following comparison fields are kill-condition inputs:

- highRiskCollapsedReceiverCount
- sensitivityUnsafeCollapsedReceiverCount
- metadataIncompleteCollapsedReceiverCount
- strongCautionCollapsedReceiverCount
- dbWriteCount
- forbiddenFieldDetected
- responseShapeChanged
- recommendationChanged

Any nonzero or true violation blocks runtime connection or dry-run expansion.

## API Response Non-change

The contract stores shape only, not response values. Future dry-run must compare baseline and shadow response shape snapshots and keep the dry-run artifact out of the API response.

## Recommendation Result Non-change

The contract stores recommendation ids and order only. Future dry-run must prove `topPick`, `supportingProducts`, and `budgetAlternatives` are unchanged.

## DB Write Prohibition

The contract includes `dbWriteCount`. It must remain zero. Supabase write execution must remain false.

## Phase 35 Allowed Scope

Phase 35 may proceed as:

- disabled-by-default dry-run helper implementation skeleton
- final pre-runtime integration checklist
- snapshot-contract-backed verifier refinement

## Still Prohibited

The following remain prohibited:

- `/api/analyze` route change
- shadow flag added to route
- evaluator runtime connection
- CandidatePolicy runtime connection
- API response change
- recommendation result change
- DB/Supabase write or schema change
- product data change

## Runtime Non-application

This helper is a pure contract helper. It is not imported by `/api/analyze`, evaluator runtime, CandidatePolicy runtime, UI, or DB code.
