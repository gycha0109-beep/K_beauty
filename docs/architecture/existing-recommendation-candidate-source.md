# Existing Recommendation Candidate Source Boundary

## Why This Exists

Functional shadow comparison needs more than final `topPick`, `supportingProducts`, and `budgetAlternatives`. To compare the existing recommendation engine against the functional ranking audit, replay needs the candidate product array the existing engine actually ranked.

Phase 4 captures only final results when no candidate boundary is available. That produces `final_results_only` fixtures and low comparison confidence.

## Boundary Responsibility

The boundary exposes an already-existing candidate array as read-only diagnostics. It does not fetch products, score products differently, filter products differently, or change the legacy result.

The current boundary is:

```js
buildExistingRecommendationCandidateSource({
  products,
  sourceStage,
  sourceNotes,
  completeness,
  candidateIdentityMode
})
```

It returns:

```js
{
  products,
  completeness,
  sourceStage,
  sourceCount,
  sourceNotes,
  candidateIdentityMode
}
```

## Source Location

In `buildSkinMatchDecisionBundle()`, the existing engine builds:

1. `products`: loaded recommendation product rows or caller-supplied rows
2. `eligibleProducts`: gender preference eligible rows
3. `scoredProducts`: valid rows scored by the existing engine and sorted by `engine_score`
4. `topPick`, alternatives, supporting products, and budget alternatives from `scoredProducts`

The Phase 5 diagnostic boundary uses `scoredProducts` with `sourceStage: "post_score_candidate_pool"` because it is the actual sorted pool used to select the existing result.

## Completeness

- `complete`: the candidate array used by the existing ranking/filtering stage is available.
- `partial`: a wider-than-final source is available, but it is known to be filtered or limited.
- `final_results_only`: only selected output products are available.
- `unavailable`: no useful product source is available.

Completeness describes coverage of the existing ranking path, not product quality.

## Source Stage

- `pre_rank_candidate_pool`: rows before final ranking score is applied
- `post_filter_candidate_pool`: rows after some existing filter but before final score/sort
- `post_score_candidate_pool`: rows scored and sorted by the existing engine
- `final_results_only`: selected result products only
- `unavailable`: no source

## Candidate Identity Mode

- `product_row`: product snapshots include enough structured fields for functional audit evaluation
- `product_id_only`: IDs are present but structured product data is not
- `mixed`: both row-like and ID-only entries exist
- `unavailable`: no candidate identity

`product_id_only` must not be treated as high-confidence comparison evidence.

## Non-Replacement Rule

The boundary is diagnostic-only. It must not:

- change legacy scores
- change sort order
- change `topPick`
- change `supportingProducts`
- change `budgetAlternatives`
- change API responses
- add DB queries
- expose new ranking output to users

## Shadow Capture Connection

`/api/analyze` enables candidate source diagnostics only when:

```text
NODE_ENV === "development"
FUNCTIONAL_SHADOW_CAPTURE === "1"
```

When disabled, the existing decision bundle is built without diagnostics.

When enabled, the capture helper receives `decision.diagnostics.candidateSource`, sanitizes product snapshots, and writes the source metadata into the fixture:

```js
candidateSource: {
  completeness,
  sourceStage,
  sourceCount,
  sourceNotes,
  candidateIdentityMode,
  products
}
```

## Comparison Confidence

- `complete + product_row`: can support high-confidence comparison
- `partial + product_row`: can support medium-confidence comparison
- `final_results_only`: low confidence
- `unavailable`: low confidence
- `product_id_only`: low confidence unless future evaluators can safely enrich without new fetches

## Sanitizer Rules

Capture stores only evaluator-relevant fields such as product ID, category, product form, skin types, concerns, texture, finish, irritation risk, sensitive-safe flag, sunscreen metadata, functional ingredient signals, and minimal market signals.

It does not store product name, brand, purchase URL, raw review text, raw form, image, base64, filename/path, session/account identifiers, email, cookies, user agent, or PII.

## Limits

The boundary exposes the current existing engine’s `post_score_candidate_pool`. It is a strong source for shadow comparison, but it is still filtered by the existing engine’s gender and required-field checks. It should not be mistaken for the full database product universe.

## Next-Step Conditions

Only after actual dev captures produce enough high/medium-confidence comparisons should divergence be promoted to policy review. Until then, hard filters, score weights, and user-facing ranking replacement should remain unchanged.
