# Functional Shadow Audit

Date: 2026-07-03
Branch: `codex/survey-input-contract-refactor`
Phase: Ranking Engine Phase 3

Functional Shadow Audit compares the existing recommendation result snapshot with the new functional candidate audit output. It is read-only and audit-only.

## 1. Purpose

The goal is to measure how differently the new functional ranking contract behaves compared with the current free-result recommendation flow. The audit records overlap, divergence, candidate status changes, and top-candidate differences. It does not decide which engine is correct.

## 2. Non-Replacement Principle

Shadow audit does not:

- change UI
- change API response fields
- change DB schema or migrations
- add Supabase queries
- replace `recommendation-scoring.ts`
- change `topPick`, `supportingProducts`, or `budgetAlternatives`
- overwrite existing scores with functional scores
- connect to Functional Plan UI
- save new data into premium/currentProducts payloads
- run automatically for production requests

## 3. Existing Snapshot Adapter

`buildExistingRecommendationSnapshot(existingResult)` reads an already-built result object and extracts only product-id comparison data:

- top pick id/category/source
- supporting product ids/categories/sources
- budget alternative ids/categories/sources
- ordered and unique product id lists
- source-by-id map
- category distribution
- notes for incomplete or ID-less legacy results

It does not fuzzy match product names or infer missing product IDs.

## 4. Candidate Source Adapter

`resolveShadowAuditCandidateSource()` accepts a candidate array already available to the caller. It never fetches products or calls Supabase.

If a full candidate source is provided, it returns that source. If only the final existing result snapshot is available, it builds a narrow product-id/category-only source and records that the comparison is incomplete.

## 5. Functional Candidate Audit Connection

The shadow runner calls:

```js
buildFunctionalCandidateAudit({
  products,
  surveyContract,
  goalPolicy,
  currentProductFindings,
  options: {
    includeBlocked: true,
    includeInsufficientData: true
  }
})
```

The functional audit result is compared as-is. Shadow audit does not modify candidate scores, filters, or category rules.

## 6. Comparison Contract

`compareFunctionalShadowResults({ existingSnapshot, functionalAudit })` returns:

- `comparisonSummary`
- `overlap`
- `divergences`
- `categoryComparison`
- `topPickComparison`
- `candidateStatusComparison`
- `policyNotes`

## 7. overlap and divergence

Overlap is product-ID based only.

Stable divergence types:

- `existing_selected_but_blocked`
- `existing_selected_but_insufficient_data`
- `existing_selected_ranked_lower`
- `functional_top_candidate_missing_from_existing`
- `top_pick_mismatch`
- `candidate_source_incomplete`
- `no_comparable_product_ids`

Divergence is not an error. It only marks where the current engine and functional audit behave differently.

## 8. comparisonConfidence

`comparisonConfidence` means source comparability, not recommendation quality.

- `high`: existing candidate source and functional input are complete enough for product-ID comparison.
- `medium`: partial source exists or some result/candidate data is missing.
- `low`: only final selected products are available, or product IDs are mostly unavailable.

## 9. tmp Output Security

The local runner may write:

- `tmp/functional-shadow-audit/summary.json`
- `tmp/functional-shadow-audit/summary.md`

These files store only product IDs, categories, ranks, status, score summaries, and aggregate comparison data. They must not store raw user form data, image/file data, PII, full API responses, or raw product copy.

## 10. Limits

This phase relies on a provided candidate source. If only final existing result products are available, the comparison is narrower and should be treated as low confidence. The audit also does not explain the existing engine's internal reasoning beyond what already exists in the result snapshot.

## 11. Next Phase

Next candidates:

- dev-only shadow mode using real existing free-result fixtures
- accumulated comparison reports
- divergence review by type
- CandidatePolicy integration with shadow audit findings
- only later, separately approved UI/API experiments
