# Recommendation Metadata Transport Shadow v1

## Status

```text
transport: implemented
activation: shadow-only
production ranking authority: unchanged
public response: unchanged
persistence contract: unchanged
Admin v1 contract: unchanged
migration: none
Provider call: none
```

## Baseline

- Repository: `gycha0109-beep/K_beauty`
- Current-main baseline: `4202bd2c9a83f276436e226aee9d9bbc9ace2a8f`
- Branch: `feature/recommendation-metadata-transport-shadow`
- Existing Recommendation Feature V1 PR #74 is closed and is not reused.
- PR #133 changes `app/api/analyze/route.js` and `lib/skin-match-decision-engine.js`; this implementation avoids both files.
- PR #166 owns Admin Product Review v1; this implementation reads that contract but does not modify it.

## Runtime call graph

```text
Supabase public.products
→ lib/product-source-core.js (unchanged current-main source implementation)
→ lib/product-source.js (metadata transport wrapper)
→ recommendation product objects / current-product snapshots
→ lib/skin-match-decision-engine.js (unchanged scoring and ranking)
→ internal candidate source diagnostics
→ lib/candidate-exposure-policy-shadow.js
→ lib/recommendation-metadata-transport-shadow.js
```

The wrapper preserves the existing source implementation byte-for-byte as
`lib/product-source-core.js`. It adds one cached, fail-open, read-only metadata
projection. Metadata is attached through a non-enumerable internal envelope and
an ID registry. Product spreading during scoring therefore does not add fields
to JSON output, while shadow consumers can recover the envelope by product ID.

## Transported metadata

### Cleanser

- `cleansing_profile`: `low_ph | balanced | deep_clean | null`

No semantic conversion is permitted. In particular:

- `low_ph` is not converted to gentle or low irritation.
- `balanced` is not converted to moderate.
- `deep_clean` is not converted to strong.
- missing values remain `null`.

### Moisturizer balm

- `balm_functional_tags`
- `balm_usage_scope`
- `balm_type`
- `is_primary_moisturizer`
- `balm_caution_tags`
- `balm_research_confidence`

Arrays preserve the distinction between `null` and `[]`. Strings are never
parsed into arrays. Invalid shapes fail closed to `null` and are listed in
`metadataInvalid`.

### Sunscreen

- `spf_value`
- `uva_label`
- `water_resistant_minutes`
- `uv_filter_type`
- `tone_up`
- `white_cast`
- `eye_sting`
- `pilling_risk`

Existing ranking behavior for the latter five fields is unchanged. SPF, UVA,
and water resistance are transport-only.

## Internal envelope

```text
version
productMetadataVersion
role
metadata
metadataMissing
metadataInvalid
metadataFallbacksApplied
```

The envelope is non-enumerable. It is not added to:

- the free analyze response;
- Premium report public products;
- `analysis_results.result_json`;
- public or owner saved-report serializers;
- CandidatePolicy telemetry.

## Fabricated fallback observation

Existing current-main fallbacks are not changed in this phase. Their use is
made observable as `metadataFallbacksApplied`:

- `skin_types → combination`
- `concerns → dehydration`
- `texture → watery`
- `finish → natural`
- `irritation_risk → medium` or `low_from_sensitivity_safe`
- `sensitivity_safe → false`

New metadata fields never use these fallbacks.

## Shadow comparisons

### Cleansing profile

Production continues to use the existing string heuristic for
`redness-deep-clean`. Shadow evaluation substitutes only the detection source:

```text
legacy: heuristicDeepClean → existing -18 rule
candidate: cleansing_profile=deep_clean → same existing -18 rule
```

No new barrier, sensitivity, dryness, or instability penalty is introduced.
Those scenario labels are measured with the same current redness threshold.

Read-only hosted audit baseline on 2026-08-05:

```text
cleanser total: 26
metadata deep_clean: 9
legacy heuristic true: 0
metadata false negative: 9
false positive: 0
```

### Balm primary role

- Legacy: every `moisturizer_balm` keeps primary-slot eligibility.
- Candidate A: `is_primary_moisturizer=false` is excluded from primary Top Pick eligibility only.
- Candidate B: `local_area` and `eye_lip` are excluded from primary moisturizer eligibility only.

Unknown metadata remains eligible and is classified `metadata_unknown` or
`review_required`. Products are not hidden or penalized.

Read-only baseline:

```text
balm total: 20
primary=true: 7
primary=false: 13
full_face: 9
local_area: 6
eye_lip: 1
multi_area: 1
body_possible: 3
```

### Sunscreen protection completeness

```text
spfPresent = non-empty spf_value
uvaPresent = non-empty uva_label
waterResistanceKnown = water_resistant_minutes is not null
protectionMetadataComplete = spfPresent && uvaPresent
```

Water resistance is intentionally not required for protection completeness,
because the current survey has no water-exposure intent and the field is
optional in the current product contract. Missing values stay unknown.

Read-only baseline:

```text
sunscreen total: 11
SPF present: 11
UVA present: 11
water resistance known: 1
```

## Diagnostic contract

Every product diagnostic includes:

- `version`
- `engineVersion`
- `productMetadataVersion`
- `evaluatedAt`
- `category`
- `scenario`
- `legacyRank`
- `candidateRank`
- `scoreDelta`
- `topPickChanged`
- `top3Changed`
- `hardGateChanged`
- `explanationChanged`
- `unknownMetadataCount`
- `metadataUsed`
- `metadataMissing`
- `metadataInvalid`
- `metadataFallbacksApplied`

Category-specific fields are included as required by the cleanser, balm, and
sunscreen contracts. Diagnostics contain product IDs only; no image, free-text
survey answer, Provider response, credential, URL, review text, or ingredient
text is retained.

## Production invariance

The shadow evaluator is called only inside the existing
`runCandidateExposurePolicyShadow()` boundary. That boundary is already:

- explicit opt-in in Preview/development;
- hard-disabled in Production;
- fingerprinted for response, snapshot, and candidate order invariance.

The metadata result is returned only to the internal caller and is not added to
existing telemetry. Scoring, hard penalties, ranking, explanations, candidate
exposure, public response, Premium payload, saved result, and reentry
projection remain unchanged.

## Persistence and reentry

Transported metadata survives in memory for recommendation products and
current-product snapshots. Current persistence sanitizers intentionally cut it
before storage. Public and owner reentry therefore remain unchanged.

Adding durable diagnostic persistence would require a private versioned
diagnostic envelope. It is not part of this phase.

## Admin Product Review v1

PR #166 exact-header v1 does not accept the transported metadata fields. The
implementation exports the unsupported field list for verification but does
not alter Admin files, headers, parser keys, hashes, dry-run payloads, confirm
RPC, create/merge behavior, or audit payloads.

Admin v2 is required before newly imported products can achieve metadata parity
with the current 164 rows. Until then, existing complete rows and future v1
imports can diverge silently.

## Conflict and follow-up

- #133 must receive a semantic rebase review after it merges because it changes
the analyze route and decision engine, although neither is changed here.
- #92 SharedSkinDecisionContext and CandidatePolicy versions are not activated
or reimplemented.
- A later activation decision requires fixed regression corpus results and an
Admin v2/persistence decision. This phase provides evidence only.
