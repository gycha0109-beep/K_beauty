# Survey Input Contract Draft

Date: 2026-07-02
Branch: `codex/survey-input-contract-refactor`
Task type: design / read-only audit plus architecture draft

This document audits the current free Skin Match survey input path before any UI refactor. It records the current 11-question inventory, the persisted field/value shape, the free and premium payload flow, and a proposed `SurveyInputContract` for `FunctionalPlanDecision`, `CandidatePolicy`, and the ranking engine.

## Confirmed Files

Current survey and result flow:

- `app/page.js`
- `app/en/page.js`
- `components/onboarding/SurveyFlow.js`
- `components/onboarding/PhotoUploadStep.js`
- `components/onboarding/constants.js`
- `app/api/analyze/route.js`
- `lib/skin-match-decision-engine.js`
- `lib/recommendation-scoring.ts`
- `app/result/page.js`
- `components/result/SaveReportCTA.jsx`
- `app/api/my/save-report/route.js`
- `lib/analysis-results.js`
- `app/result/full-report/page.js`
- `app/api/full-report/route.js`
- `lib/current-products.js`
- `lib/premium-current-products.js`
- `docs/architecture/survey-contract-v1.md`

## Current Survey Inventory

The active home route uses `PhotoUploadStep` first, then `SurveyFlow`. The localized `/en` route re-exports the same page. The current survey has 11 answer questions after the photo step.

| # | Screen | Field | Type | Required in UI | Submitted value shape | Current values |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `skin-basics` | `skinType` | single | yes | string | `oily`, `dry`, `combination`, `not_sure` |
| 2 | `skin-basics` | `sensitivity` | single | yes | string | `low`, `medium`, `high` |
| 3 | `skin-concerns` | `mainConcerns` | multiple, max 4 | yes | JSON stringified array in `FormData`; also derives `mainConcern` | `oiliness`, `dehydration`, `acne`, `pores`, `redness`, `barrier`, `uneven_tone` |
| 4 | `daily-feel` | `postWashFeeling` | single | no | string, normalized default if skipped | `tight`, `comfortable`, `still_oily` |
| 5 | `daily-feel` | `afternoonSkinChange` | single | no | string, normalized default if skipped | `more_oily`, `more_dry`, `red_or_irritated`, `mostly_same` |
| 6 | `routine-habits` | `cleansingFrequency` | single | no | string, normalized default if skipped | `once`, `twice`, `3_plus` |
| 7 | `routine-habits` | `environmentExposure` | multiple | no | JSON stringified array | `heat`, `humidity`, `mask`, `kitchen`, `outdoor`, `aircon` |
| 8 | `texture-preference` | `preferredTexture` | single | no | string, normalized default if skipped | `gel`, `watery`, `lotion`, `cream` |
| 9 | `texture-preference` | `mostDislikedFeel` | single | no | string, normalized default if skipped | `sticky`, `greasy`, `heavy` |
| 10 | `finish-preference` | `sunscreenConsiderations` | multiple | no | not submitted directly; maps to boolean fields | `whiteCastHate`, `toneUpWanted`, `makeupUse`, `eyeSensitive` |
| 11 | `finish-preference` | `genderPreference` | single | no | string, normalized default if skipped | `female`, `male`, `unspecified` |

## First UI Contract Supplement

The first UI refactor keeps the existing 11-question surface and adds contract-only clarification fields. It does not expose `SurveyInputContract` in the API response, change DB schema, change recommendation ranking, or change premium/current-products storage.

Added fields:

- `primaryConcern`: single choice shown after `mainConcerns`; candidates are limited to the selected concerns. This removes the ambiguous "first selected concern" fallback for new submissions while preserving legacy fallback behavior.
- `recentSkinChange`: O/X/unknown block for sudden instability in the last 2 weeks. This feeds safety context and should remove `missingFields.recentSkinChange` when answered, including an explicit `unknown`.
- `recentlyChangedProduct`: O/X/unknown block for new product or routine changes in the last 2 weeks. This feeds safety and candidate caution and should remove `missingFields.recentlyChangedProduct` when answered, including an explicit `unknown`.
- `sunscreenPreferenceState`: `answered`, `skipped`, or `unknown` metadata for the sunscreen block. Existing sunscreen booleans remain unchanged; when state is `answered`, false booleans are treated as explicit false and no longer create `sunscreen_boolean_false_ambiguous`.

Flow after this supplement:

- UI still submits the legacy booleans and `mainConcern` for compatibility.
- `/api/analyze` forwards the new fields into the internal normalized form for parallel contract generation.
- `buildSurveyInputContract()` prefers explicit `primaryConcern` when valid and selected, reads recent-change fields as safety inputs, and uses `sunscreenPreferenceState` to distinguish answered false from skipped/unknown defaults.
- Legacy requests without these fields continue to produce fallback and ambiguity warnings for audit visibility.

Compatibility aliases accepted by `/api/analyze`:

- `sensitivityLevel` -> `sensitivity`
- `texturePreference` -> `preferredTexture`
- `postCleanseFeel` -> `postWashFeeling`
- `afternoonState` -> `afternoonSkinChange`
- `dislikedFeel` -> `mostDislikedFeel`
- single `mainConcern` is accepted when `mainConcerns` is absent.

## Required, Optional, And Skip Behavior

UI-required fields are only `skinType`, `sensitivity`, and `mainConcerns`.

After those required fields are complete, optional questions can be skipped with the `See result now` / `now result` control. Skipping does not currently preserve `unknown`. Instead, `app/page.js` normalizes defaults before submit:

- `cleansingFrequency`: `twice`
- `preferredTexture`: `lotion`
- `postWashFeeling`: `comfortable`
- `afternoonSkinChange`: `mostly_same`
- `environmentExposure`: `[]`
- `mostDislikedFeel`: `sticky`
- `genderPreference`: `unspecified`
- sunscreen booleans: `false`

Important consequence: the API treats many optional answers as required after client normalization. `/api/analyze` rejects missing `image`, `skinType`, `sensitivity`, resolved main concern, `cleansingFrequency`, `preferredTexture`, `postWashFeeling`, `afternoonSkinChange`, and `mostDislikedFeel`.

## Photo And No-Photo State

There is no current no-photo analysis path.

- The photo step requires `imageFile` before moving to survey.
- `/api/analyze` requires `image` and validates it.
- `image_url` stored in `analysis_requests` / `analysis_results` is currently `null`; the browser stores an image preview in `sessionStorage.skinTestSubmission.imagePreviewDataUrl`, and `SaveReportCTA` removes that preview from the saved `surveySnapshot`.
- If photo evidence cannot be generated because the API key is missing or photo analysis fails, the route uses fallback photo evidence and adds `meta.notice`; this is not the same as user-driven photo skip.

Current accuracy/precision guidance for skipping:

- Survey optional skip guidance lives in `components/onboarding/SurveyFlow.js` (`skipConfirm` copy and modal).
- Photo quality guidance lives in `components/onboarding/PhotoUploadStep.js` and `components/onboarding/constants.js`.
- There is no dedicated photo-skip accuracy warning because photo skip is not implemented.

## Current Free Result Payload

`/api/analyze` returns the public free payload from `buildFreeDecisionPayload(decision)`:

```js
{
  summary,
  priority,
  topPick,
  alternative,
  amFocus,
  pmFocus,
  routineStructure,
  morning,
  night,
  warnings,
  photoEvidence,
  photoObservations,
  surveyEvidence,
  scoring,
  meta
}
```

The public free response intentionally does not expose:

- `answers`
- `genderPreference`
- `currentProducts`
- `premiumReport`
- `functionalDecisions`
- `conditionResponses`
- raw survey form
- `surveyInputContract`

As of the `/api/analyze` parallel audit step, `SurveyInputContract` is generated only inside a guarded development path from the normalized form. It is logged as a summary for audit and is not added to the API response, premium session report, saved report payload, or DB payload.

Development runtime audit summaries may also be appended to `tmp/survey-input-contract-runtime-audit/events.jsonl` and summarized into local tmp JSON/MD files. These events intentionally store only contract summary fields and never store raw form values, image data, gender preference, API response fields, DB payloads, or saved-report payloads. Production runtime must no-op and perform no file writes.

Browser session storage after analysis:

- `skinTestSubmission`: `{ form, imageName, imagePreviewDataUrl, locale }`
- `skinTestResult`: free result JSON, with Face Lab preview fields added client-side when available
- `skinTestFaceLabFull`: full Face Lab result when available

Authenticated save flow:

- `SaveReportCTA` sends `freeResult`, `faceLab`, `surveySnapshot`, and `photoAnalysis` to `/api/my/save-report`.
- `surveySnapshot` removes `imagePreviewDataUrl`.
- `skin_profiles.survey_snapshot` receives the survey snapshot.
- `skin_profiles.result_snapshot` receives the free result snapshot.
- `saved_reports.free_result` receives the free result snapshot.
- A private `analysis_results` row is created with `result_json.result` and `result_json.submission`; `analysis_requests.survey_json` receives `submission.form`.

## Current Scoring And Priority

Decision generation in `lib/skin-match-decision-engine.js` uses these axes:

```js
["barrier", "dehydration", "oiliness", "redness", "acne", "pores", "uneven_tone", "uv"]
```

`scoring.concernScores` is created internally as:

```js
{
  [axis]: {
    total,
    survey,
    photo,
    environment
  }
}
```

The public free result sanitizes this to:

```js
{
  concernScores: {
    [axis]: { total }
  }
}
```

Priority generation:

- Survey weights come from `mainConcerns`, `skinType`, `sensitivity`, `postWashFeeling`, `afternoonSkinChange`, `cleansingFrequency`, sunscreen booleans, `outdoorExposure`, and `verySensitivePeriod`.
- Environment weights come from `environmentExposure`.
- Photo weights multiply each photo signal by axis.
- Priority is the highest total axis after tie-breaker order: `uv`, `barrier`, `redness`, `dehydration`, `acne`, `pores`, `oiliness`, `uneven_tone`.
- `oiliness` can be overridden toward barrier/redness/dehydration when skin type or sensitivity guardrails make oiliness unsafe as the lead axis.

## `primaryConcern` vs `priority.axis` Role Separation

`primaryConcern` and `priority.axis` are both valid, but they answer different questions:

- `primaryConcern`: the user's explicit answer to "what do you want to solve first?"
- `priority.axis`: the current free-result/scoring judgment about the skin-state axis that most needs attention after survey, environment, and photo evidence are combined.
- `safety`: caution signals such as `sensitivityRisk`, `drynessRisk`, `rednessRisk`, `recentSkinChange`, and `recentlyChangedProduct`.

The runtime audit after the first UI supplement found `primaryConcern` / `priority.axis` mismatch in 3 of 10 sampled submissions. This is expected. It should be recorded as `tension`, not treated as a bug or hard conflict. Example: a user may choose `pores` as the first goal while scoring detects `oiliness` as the stronger current condition; or a user may choose `acne` while redness/high sensitivity should shape the first routine warning.

Tension definition:

```js
hasTension = Boolean(primaryConcern && priority.axis && primaryConcern !== priority.axis)
```

Tension policy:

- `priority.axis` must not overwrite `primaryConcern`.
- `primaryConcern` must not bypass `safety`.
- The ranking goal starts from `primaryConcern` when present.
- The safety/routine goal starts from `priority.axis` when present, backed by `safety` risk values.
- If either side is missing, the available side may be used as a fallback with an explicit warning or audit note.

Ranking use principles:

- Candidate goal axis should use `SurveyInputContract.goals.primaryConcern` first.
- `secondaryConcerns` can expand alternatives or tie-break adjacent candidates, but must not silently replace the explicit primary goal.
- `priority.axis` and `scoring.concernScores` can be used as guardrails, tie-breakers, or explanation context, not as the default replacement for the user's requested goal.
- High safety risk may hide, collapse, delay, or narrow candidates for the requested goal, but the policy should say that the requested goal is being guarded rather than rewritten.

Routine and safety use principles:

- Routine warnings, `recommendationSuppressed`, "stabilize first" messages, and frequency/caution copy should consider both `priority.axis` and `safety`.
- If `priority.axis` is `redness`, `barrier`, or `dehydration`, routine copy should prefer caution/stabilization language even when the requested ranking goal is `acne`, `pores`, `oiliness`, or `uneven_tone`.
- `recentSkinChange: "yes"` or `recentlyChangedProduct: "yes"` should make the safety layer more conservative because recent instability can explain why the selected goal should be approached slowly.
- Unknown safety values should not be converted into high risk, but copy and policy should avoid confident claims that the user is stable.

CandidatePolicy connection principles:

- CandidatePolicy should receive both `rankingGoal` and `safetyGoal`.
- `rankingGoal` controls which functional candidate family is considered first.
- `safetyGoal` and `recommendationGuard` control visibility: `visible`, `limited`, `collapsed`, or `hidden`.
- A `stabilize_first` guard can collapse or hide aggressive candidates while preserving the requested concern for later expansion.
- Existing current-product findings can still suppress or collapse recommendations, but should state the policy reason separately from the requested goal.

Copy generation principles:

- Lead with the user's requested goal when candidates are shown: "pores-focused options" should come from `primaryConcern: "pores"`, not from scoring.
- Add a separate caution sentence when tension exists: "Current skin-state signals suggest managing oil/redness/barrier stress first."
- Do not say the user selected a priority that came only from scoring.
- Do not say scoring detected a concern from skipped/unknown values unless that concern is supported by survey, environment, or photo evidence.
- When safety hides or collapses candidates, copy should explain the guardrail without implying the user's goal was wrong.

Phase 1 policy helper draft:

```js
resolveFunctionalGoalPolicy({
  surveyContract,
  freeResultPriority,
  safety
})
```

Returns:

```js
{
  requestedConcern,      // explicit primaryConcern
  detectedPriority,      // freeResult.priority.axis
  hasTension,
  tensionType,
  rankingGoal,           // primaryConcern first, priority fallback
  safetyGoal,            // priority first, primary fallback
  copyStrategy,
  recommendationGuard    // "normal" or "stabilize_first"
}
```

Future `FunctionalPlanDecision` should receive `SurveyInputContract.goals`, `SurveyInputContract.safety`, `freeResult.priority`, and optionally top `scoring.concernScores` totals. Ranking Engine Phase 1 should receive `primaryConcern`, `secondaryConcerns`, `safety`, `behavior`, `preferences`, `sunscreen`, `priority.axis`, and the top public concern scores. It should not require raw form fields.

## Current Sunscreen Field Storage

The UI field `sunscreenConsiderations` is a grouped multiple-choice control, but it is stored and submitted as separate booleans:

```js
{
  whiteCastHate: boolean,
  toneUpWanted: boolean,
  makeupUse: boolean,
  eyeSensitive: boolean
}
```

Engine use:

- `whiteCastHate` adds UV survey weight and affects sunscreen white-cast filtering/scoring.
- `toneUpWanted` adds UV and uneven-tone survey weight and affects tone-up/filter-type fit.
- `makeupUse` adds pores and UV survey weight and affects pilling risk.
- `eyeSensitive` adds redness/barrier/UV survey weight and affects eye-sting risk.
- `environmentExposure.includes("outdoor")` becomes `outdoorExposure` and can push UV priority.

## Current Gender Field Storage

`genderPreference` values:

- `female`
- `male`
- `unspecified`

Invalid or missing values normalize to `unspecified`. Engine use is candidate eligibility only:

- `female` excludes products where `product.is_mens === true`.
- `male` and `unspecified` keep men-labeled products eligible.
- There is no positive or negative score adjustment.

## Current Premium And Current Products Link

Premium entry is currently after the free result:

1. Free result page opens `/result/full-report`.
2. `app/result/full-report/page.js` first shows `PremiumEntryStep` unless reading a saved report or test report.
3. `PremiumEntryStep` renders `CurrentProductsSelector`.
4. Continue sends `currentProducts` to `/api/full-report`.
5. `/api/full-report` calls `buildPremiumCurrentProductsSnapshot`.
6. The report is updated with `premiumReport.currentProducts` and `premiumReport.currentProductVerdicts`.
7. The premium report cookie/session is updated, and account users also save the premium report.

Current product input shape:

```js
[
  {
    category,
    status,
    productId,      // selected only
    useTime,        // selected/not_in_db optional
    satisfaction    // selected/not_in_db optional
  }
]
```

Allowed current product categories include `cleanser`, `toner_essence`, `toner_pad`, `serum`, `ampoule`, `essence`, `treatment`, `moisturizer`, and `sunscreen`. Status values are `selected`, `not_in_db`, and `not_using`.

Risk: full-report current product verdicts use `freeResult.priority.axis` and `freeResult.answers || {}`. The current free result does not expose `answers`, so current-products judgments entered at premium entry do not have the full survey answer context unless that context is explicitly added to a premium-safe contract later.

## Engine-Usable Current Values

These values are suitable for ranking or decision policy after normalization:

- `skinType`
- `sensitivity`
- ordered `mainConcerns`, with `mainConcern` as the first selected concern
- `postWashFeeling`
- `afternoonSkinChange`
- `cleansingFrequency`
- `environmentExposure`
- `preferredTexture`
- `mostDislikedFeel`
- sunscreen booleans
- `genderPreference` as eligibility only
- `photoEvidence` / `photoObservations` when source is available or fallback is explicitly marked
- `currentProducts` only in premium context
- `priority.axis` and public `scoring.concernScores[axis].total`

## Values The Engine Should Not Treat As Hard Facts

- Optional defaults should not be interpreted as explicit user answers.
- `mostDislikedFeel: "sticky"` is currently a skipped-answer default; using it as a strong penalty creates false preference.
- `postWashFeeling: "comfortable"` and `afternoonSkinChange: "mostly_same"` can mean skipped, not truly stable.
- `genderPreference` should not be used for score boosts, identity inference, Face Lab, or copy personalization beyond product eligibility.
- `sunscreenConsiderations` false booleans currently mix "not selected" and "skipped"; do not treat `false` as dislike or absence of need.
- `photoEvidence` fallback should not be presented as observed visual proof.
- `currentProducts.not_in_db` should not create ingredient-level judgments.

## Missing Core Inputs

Inputs that should be added or separated before UI refactor:

- `primaryConcern` or `primaryGoal`: single required lead goal. Current first item of `mainConcerns` acts as lead, but the UI allows multi-select without an explicit lead decision.
- `recentSkinChange`: O/X block for recent unstable state, with optional reasons. Current `afternoonSkinChange` is daily pattern, not recent change.
- `recentlyChangedProduct`: whether a product was recently added/replaced. This is needed for functional decisions, candidate safety, and routine caution.
- `answered/skipped source metadata` per field. Current defaults erase skip state.
- `photo.status`: distinguish `provided`, `skipped`, `fallback`, and `failed`.
- `profile.ageRange` is not currently collected and should remain out of scope unless product policy requires it.

## Proposed SurveyInputContract

Draft shape:

```ts
type Unknownable<T extends string> = T | "unknown";

type SurveyInputContract = {
  version: "survey-input-v1";
  skinState: {
    skinType: Unknownable<"oily" | "dry" | "combination" | "not_sure">;
    sensitivity: Unknownable<"low" | "medium" | "high">;
    postWashFeeling: Unknownable<"tight" | "comfortable" | "still_oily">;
    afternoonSkinChange: Unknownable<"more_oily" | "more_dry" | "red_or_irritated" | "mostly_same">;
    recentSkinChange: {
      changed: "yes" | "no" | "unknown";
      types: Array<"breakout" | "redness" | "dryness" | "oiliness" | "stinging" | "texture" | "unknown">;
    };
  };
  goals: {
    primaryConcern: Unknownable<"oiliness" | "dehydration" | "acne" | "pores" | "redness" | "barrier" | "uneven_tone" | "uv">;
    secondaryConcerns: Array<"oiliness" | "dehydration" | "acne" | "pores" | "redness" | "barrier" | "uneven_tone" | "uv">;
    primaryGoal?: Unknownable<"calm" | "hydrate" | "control_oil" | "smooth_texture" | "even_tone" | "protect_uv" | "stabilize_barrier">;
  };
  safety: {
    verySensitivePeriod: "yes" | "no" | "unknown";
    recentlyChangedProduct: "yes" | "no" | "unknown";
    knownIrritationTriggers: Array<"fragrance" | "alcohol" | "strong_actives" | "sunscreen_eye_sting" | "unknown">;
  };
  behavior: {
    cleansingFrequency: Unknownable<"once" | "twice" | "3_plus">;
    environmentExposure: Array<"heat" | "humidity" | "mask" | "kitchen" | "outdoor" | "aircon">;
  };
  preferences: {
    preferredTexture: Unknownable<"gel" | "watery" | "lotion" | "cream">;
    mostDislikedFeel: Unknownable<"sticky" | "greasy" | "heavy">;
  };
  sunscreen: {
    whiteCastPreference: "avoid" | "neutral" | "unknown";
    toneUpPreference: "wanted" | "not_wanted" | "unknown";
    makeupCompatibilityNeeded: "yes" | "no" | "unknown";
    eyeSensitivityConcern: "yes" | "no" | "unknown";
    outdoorExposure: "yes" | "no" | "unknown";
  };
  profile: {
    genderPreference: "female" | "male" | "unspecified" | "unknown";
  };
  metadata: {
    locale: "ko" | "en";
    source: "free_survey" | "premium_entry" | "saved_report";
    photo: {
      status: "provided" | "skipped" | "fallback" | "failed" | "unknown";
      evidenceSource: "openai" | "fallback" | "none" | "unknown";
    };
    answered: Record<string, boolean>;
    submittedAt?: string;
  };
};
```

Use rules:

- Ranking inputs: `skinState`, `goals.primaryConcern`, `goals.secondaryConcerns`, `safety`, `behavior`, `preferences`, `sunscreen`, and `profile.genderPreference` as eligibility only.
- FunctionalPlanDecision inputs: `goals`, `safety.recentSkinChange`, `safety.recentlyChangedProduct`, `skinState.sensitivity`, `behavior`, and `currentProducts` in premium context.
- CandidatePolicy inputs: `safety`, `sunscreen`, `profile.genderPreference`, `behavior.environmentExposure`, and current product status.
- Routine copy-only inputs: preference text and non-decision metadata. Copy should not invent ranking reasons from skipped fields.

## First Refactor Scope

Recommended first implementation step, after this design:

- Add a pure adapter from current form shape to `SurveyInputContract`.
- Preserve existing `/api/analyze` public response shape.
- Keep DB schema and stored payload names unchanged.
- Add `unknown` semantics inside the adapter while still deriving legacy fields for the existing engine.
- Add explicit `primaryConcern` / `primaryGoal` selection.
- Add recent-change O/X block and `recentlyChangedProduct`.
- Add field-level `answered` metadata.
- Keep current UI result and premium UI disconnected until adapter tests are stable.

## Defer

Do not include in the first refactor:

- DB schema or migration changes.
- Recommendation ranking rewrite.
- Functional Plan UI wiring.
- Current-products verdict policy rewrite.
- Premium report saved payload shape changes.
- Photo-skip UI implementation, unless separately scoped.
- New medical/sensitive personal profile fields.
- Product data or category metadata rewrites.

## Implementation Risks Before Refactor

- Current optional defaults are indistinguishable from user answers.
- `mainConcerns[0]` is used as lead concern, but the UI does not explicitly ask for a single lead decision.
- Free result strips `answers`, so premium current-product verdicts entered after free analysis lose survey context.
- Public scoring exposes only `total`, while premium and future policy may need component provenance (`survey`, `photo`, `environment`) without leaking unstable internals.
- Photo skip is not implemented, so any no-photo contract must add both API fallback semantics and UX disclosure.
- Sunscreen booleans currently cannot distinguish skipped from false.
- `uv` is a scoring axis but not selectable as a direct current concern.
