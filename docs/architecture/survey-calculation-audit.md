# Skin Match Survey Calculation Audit

Audit date: 2026-06-24  
Branch audited: `main`  
Scope: read-only audit of Skin Match free survey, `/api/analyze`, recommendation calculation, result display, premium session payload, and Face Lab handoff. No app code or DB schema was changed.

## Route Summary

The free Skin Match route is:

`components/onboarding/SurveyFlow.js` -> `app/page.js` `form` state -> `normalizeSurveyAnswers()` -> multipart `FormData` -> `app/api/analyze/route.js` -> `buildSkinMatchDecisionBundle()` in `lib/skin-match-decision-engine.js` -> free result response + premium report session -> `app/result/page.js` free display and `app/result/full-report/page.js` paid display.

Face Lab is separate:

`app/page.js` sends only `image` and `locale` to `/api/face-reading`. Survey fields are not sent to Face Lab. Free and paid Face Lab rendering consumes the separate Face Lab JSON through `buildFaceLabLaunchData()`.

## Survey Question Audit

| 문항 번호 | 화면 문구 | state key | 선택값 | API payload | 실제 사용 파일/함수 | 영향 유형 | 실제 영향 | 미사용/불명 여부 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Which skin type feels closest to you? | `skinType` | `oily`, `dry`, `combination`, `not_sure` | `skinType` | `components/onboarding/SurveyFlow.js` `getAnswerValue`; `app/page.js` `normalizeSurveyAnswers`; `app/api/analyze/route.js` `formData.get("skinType")`; `lib/skin-match-decision-engine.js` `applySurveyWeights`, `getPriority`, `buildDecisionProduct`; `lib/recommendation-scoring.ts` `scoreCanonicalProduct`, `scoreSunscreenProduct`; `app/result/page.js` display builders | `score_weight`, `report_copy_only`, `routine_input` | Skin condition score axes, priority override, product score skin-type match, sunscreen score, result labels and radar-like dashboard metrics. | Used |
| 2 | Does your skin become reactive easily? | `sensitivity` | `low`, `medium`, `high` | `sensitivity` plus API alias accepts `sensitivityLevel` | Same route; `applySurveyWeights`; `scoreCanonicalProduct`; `scoreSunscreenProduct`; `buildWarnings`; `buildSurveyEvidence`; LLM product explanation cue blocks | `score_weight`, `hard_filter`, `report_copy_only`, `routine_input` | Adds barrier/redness score, affects irritation-risk bonus/penalty, can hard-reject high-risk sunscreen through sensitive-user logic, changes copy/warnings. | Used |
| 3 | What skin concerns matter most now? | `mainConcerns`; derived `mainConcern` first item | `oiliness`, `dehydration`, `acne`, `pores`, `redness`, `barrier`, `uneven_tone`; max 4 in UI | `mainConcerns` JSON string and `mainConcern` string | `handleSurveyAnswerChange`; `route.js` `parseJsonArrayField`; `normalizeRecommendationAnswers`; `applySurveyWeights`; `getTopCategorySlot`; `scoreCanonicalProduct`; `buildRoleBasedSupportingProducts`; result builders | `score_weight`, `routine_input`, `report_copy_only` | First concern gets +22 to axis, second and later get +10. Only top 2 concerns feed product concern score. Determines priority, Top Pick target category, supporting concerns, routine modes and copy. | Used, but 3rd/4th concerns affect condition priority more than product scoring |
| 4 | How does your skin feel right after cleansing? | `postWashFeeling` | `tight`, `comfortable`, `still_oily` | `postWashFeeling`; API alias accepts `postCleanseFeel` | `normalizeSurveyAnswers`; `route.js`; `applySurveyWeights`; `scoreCanonicalProduct`; `buildSurveyEvidence`; result dashboard metrics | `score_weight`, `report_copy_only`, `routine_input` | `tight` raises dehydration/barrier/redness; `still_oily` raises oiliness/pores/acne. Product scoring adds post-cleanse adjustment when product concerns match. | Used |
| 5 | What changes by the afternoon? | `afternoonSkinChange` | `more_oily`, `more_dry`, `red_or_irritated`, `mostly_same` | `afternoonSkinChange`; API alias accepts `afternoonState` | Same as Q4 plus result display builders | `score_weight`, `report_copy_only`, `routine_input` | Raises oiliness/pores/acne, dehydration/barrier, or redness/barrier depending on answer; product scoring adds afternoon adjustment. | Used |
| 6 | How often do you cleanse per day? | `cleansingFrequency` | `once`, `twice`, `3_plus` | `cleansingFrequency` | `normalizeSurveyAnswers`; `route.js`; `applySurveyWeights`; `buildStepSurveyCues`; LLM prompt | `score_weight`, `report_copy_only` | Only `3_plus` changes condition score (+barrier, +dehydration). `once` and `twice` are mostly prompt/copy context. | Partially used |
| 7 | Any environment that affects your skin? | `environmentExposure` | `heat`, `humidity`, `mask`, `kitchen`, `outdoor`, `aircon` | `environmentExposure` JSON string; `outdoorExposure` is derived from it if explicit field absent | `applyEnvironmentWeights`; `getEnvironmentAdjustment`; `route.js`; `buildSurveyContextForLlm`; result metrics | `score_weight`, `routine_input`, `report_copy_only` | Adds environment bucket scores. `outdoor` also sets `outdoorExposure`, which affects UV priority, sunscreen target category, sunscreen bonus, routines and warnings. | Used |
| 8 | Which texture do you prefer? | `preferredTexture` | `gel`, `watery`, `lotion`, `cream` | `preferredTexture`; API alias accepts `texturePreference` | `scoreCanonicalProduct`; `scoreSunscreenProduct`; `buildStepSurveyCues`; result display copy | `score_weight`, `report_copy_only` | Exact/near/opposite product texture scoring. Also derives preferred finish set and sunscreen expected finish. | Used |
| 9 | Which finish do you want to avoid most? | `mostDislikedFeel` | `sticky`, `greasy`, `heavy`, `fragranced`, `pilling` | `mostDislikedFeel`; API alias accepts `dislikedFeel` | `getDislikedFeelPenalty`; `computeReviewSignalScore`; `buildStepSurveyCues`; result display copy | `score_weight`, `report_copy_only` | `sticky`, `greasy`, `heavy` affect product penalty through texture/finish. `pilling` affects review-signal score paths. `fragranced` appears in copy/context but no direct product DB field penalty was found. | `fragranced` largely copy/prompt only |
| 10 | What matters when choosing sunscreen? | Stored as booleans: `whiteCastHate`, `toneUpWanted`, `makeupUse`, `eyeSensitive` | UI virtual values: `whiteCastHate`, `toneUpWanted`, `makeupUse`, `eyeSensitive` | Four boolean fields, not a `sunscreenConsiderations` payload | `handleSurveyAnswerChange`; `route.js`; `applySurveyWeights`; `filterSunscreenCandidates`; `scoreSunscreenProduct`; `buildStepSurveyCues`; LLM prompt | `hard_filter`, `score_weight`, `report_copy_only`, `routine_input` | White cast, tone-up, makeup compatibility and eye-sting all connect to sunscreen DB fields and sunscreen scoring. Also lightly affect care axes. | Used |
| 11 | Choose gender preference | `genderPreference` | `female`, `male`, `unspecified` | `genderPreference` | `normalizeSurveyAnswers`; `route.js`; `normalizeRecommendationAnswers`; `getGenderPreferenceAdjustment`; OpenAI photo prompt context | `score_weight`, `report_copy_only` | Only product scoring changes for `product.is_mens === true`: female -3, male +1, unspecified 0. It is also passed to photo-analysis survey context, but `/api/face-reading` does not receive it. | Used narrowly |

## Survey To Skin State Score / Radar Chart Mapping

| Survey field | Score path | Axes affected | Radar/result display path |
| --- | --- | --- | --- |
| `mainConcerns` / `mainConcern` | `applySurveyWeights()` | Selected axes: first +22, later +10 | `priority`, `surveyEvidence`, `buildFreeResultV2Diagnosis()`, management priorities |
| `skinType` | `applySurveyWeights()` | dry -> dehydration/barrier; oily -> oiliness/pores/acne; combination -> oiliness/dehydration/pores | `buildSkinDashboardMetrics()` and diagnosis text |
| `sensitivity` | `applySurveyWeights()` | high/medium -> barrier/redness | Priority override and sensitivity dashboard metric |
| `postWashFeeling` | `applySurveyWeights()` | `tight` -> dehydration/barrier/redness; `still_oily` -> oiliness/pores/acne | Survey evidence, dashboard hydration/barrier |
| `afternoonSkinChange` | `applySurveyWeights()` | oily/dry/reactive branches | Survey evidence, dashboard oil/sensitivity |
| `cleansingFrequency` | `applySurveyWeights()` | only `3_plus` -> barrier/dehydration | Mostly copy/prompt unless `3_plus` |
| `environmentExposure` | `applyEnvironmentWeights()` | heat, humidity, mask, kitchen, outdoor, aircon map to condition axes | Score card environment bucket; outdoor affects tone metric |
| `whiteCastHate`, `toneUpWanted`, `makeupUse`, `eyeSensitive` | `applySurveyWeights()` | UV, uneven_tone, pores, redness, barrier | Skin summary/evidence only lightly |
| Photo analysis | `applyPhotoWeights()` | all concern axes from OpenAI/fallback photo signals | Result evidence and dashboard metrics |

The visible pentagon/radar in `FreeResultV2DiagnosisStep.jsx` is not rendered directly from the API `scoring.concernScores`. It is built in `app/result/page.js` from `result.priority`, `form`, and `photoObservations`. This means the API score card and the displayed radar can drift.

## Survey To Top Pick / SupportingProducts Mapping

| Input | Top Pick path | Supporting products path |
| --- | --- | --- |
| Concern priority | `getPriority()` -> `getTopCategorySlot()` -> highest `engine_score` in target slot | `buildSupportingConcerns()` and `buildRoleBasedSupportingProducts()` |
| Product score inputs | `scoreCanonicalProduct()` for non-sunscreen; `scoreSunscreenProduct()` for sunscreen; then `buildDecisionProduct()` adds environment, review, ingredient and hero/fallback adjustments | Same scored pool plus role selection: same concern alternative, support concern booster, low-irritation option |
| `skinType` | skin type match score; sunscreen score +24 if DB `skin_types` includes it; priority override prevents oil from leading in non-oil-eligible skin | Same scored pool |
| `sensitivity` | irritation-risk scoring; sunscreen high-risk hard reject for sensitive users | Low-irritation support role |
| `mainConcerns` | first/second product concern score; category priority | supporting concerns and role reasons |
| `preferredTexture` | exact/near/opposite texture score and finish preference | ranking only, not a dedicated support role |
| `mostDislikedFeel` | sticky/greasy/heavy direct penalty; pilling via review-signal scoring; fragranced no direct DB field penalty found | ranking only |
| Sunscreen booleans | sunscreen candidate hard filters and sunscreen score | sunscreen may win target slot or supporting role |
| `genderPreference` | only `is_mens` adjustment | same scored pool |

No code path lets OpenAI choose or reorder products. OpenAI only rewrites explanations after deterministic selection.

## Survey To Routine Structure Mapping

| Input | File/function | Actual routine effect |
| --- | --- | --- |
| Priority axis from survey/photo scores | `buildRoutineStructure()` | Always returns `type: "mode_split"` with AM/PM cards. Mode is selected by priority: UV -> protective/recovery, oiliness -> fresh_control/reset, dehydration -> hydration_hold/recovery, barrier -> minimal_barrier/barrier_repair, redness -> low_irritation_protect/calming_repair, acne -> fresh_control/acne_care, pores -> fresh_control/pore_texture_care, uneven_tone -> protective/pore_texture_care. |
| Top Pick category | `getTopCategorySlot()` | Controls whether the Top Pick slot is cleanser, toner/essence, serum, moisturizer, or sunscreen. |
| Top Pick + supporting products | `buildPremiumRoutine()` / `buildFullRoutineSteps()` | Fills AM/PM step product slots using Top Pick first, then supporting products, then scored products. |
| `makeupUse`, `outdoorExposure`, sensitivity, acne, etc. | `buildRoutineVariants()` and `buildAvoidCombinations()` | Paid report situation variants and avoid combinations. |
| `cleansingFrequency` | LLM step cues and score if `3_plus` | Does not directly change AM/PM structure except through priority score/prompt text. |

## Survey To Result Copy Mapping

| Result area | Source |
| --- | --- |
| Free summary | API `summary` from `buildSummary(priority.axis, targetSlot, scoreCard, photoEvidence, surveyEvidence)` |
| Diagnosis text/tags | `app/result/page.js` `buildFreeResultV2Diagnosis()`, `getFreeResultV2CorePatternLine()`, `buildFreeResultV2Priorities()` |
| Evidence step | API `photoEvidence` and `surveyEvidence`, plus local fallback builders |
| Top Pick headline and bullets | `getTopPickHeadline()`, `getTopPickSummary()`, `buildTopPickReasonBullets()`, API product `reason` |
| Routine preview | `buildFreeResultV2RoutinePreview()` currently static canned copy, not API `routineStructure` |
| Paid report copy | Premium session fields from `sanitizePremiumReport()` plus many local fallback display builders in `app/result/full-report/page.js` |
| Product explanation copy | Deterministic reason first, optionally rewritten by OpenAI in `generateProductExplanations()` without changing product identity/order |

## Survey To Face Lab Mapping

| Field | `/api/face-reading` payload | Face Lab result effect |
| --- | --- | --- |
| All survey fields | Not sent | No direct effect |
| `genderPreference` | Not sent | No direct Face Lab effect |
| `image` | Sent | Primary Face Lab input |
| `locale` | Sent | Output language |
| Skin Match result | Free result stores Face Lab teaser beside Skin Match result | UI composition only; Face Lab generation itself remains independent |

Important distinction: `/api/analyze` photo evidence does receive `buildSurveyContextForLlm(formInput)` and includes `genderPreference`, but that is Skin Match photo evidence, not Face Lab.

## Sunscreen Field Verification

| Survey item | State/API field | DB/scoring field connected | Actual behavior |
| --- | --- | --- | --- |
| 백탁 회피 | `whiteCastHate` | `white_cast` | Hard reject `white_cast: high` in strict mode when tone-up is not wanted; score none/low positive, medium/high negative. |
| 톤업 원함 | `toneUpWanted` | `tone_up`, `uv_filter_type` expectation | `tone_up: true` scores +10; if not wanted, `tone_up: true` scores -8 and strong penalty reason. Also changes expected filter type. |
| 메이크업 궁합 | `makeupUse` | `pilling_risk`, review `makeup_safe`, routine avoid copy | Hard reject high pilling in strict mode; pilling score low +8, medium -4, high -16. |
| 눈시림 적음 | `eyeSensitive` | `eye_sting`, `uv_filter_type`, irritation risk | Hard reject high eye sting; eye sting score low +8, medium -6, high -20. |

## Avoid Feel Verification

| Avoid item | State value | Direct DB/scoring connection | Finding |
| --- | --- | --- | --- |
| 강한 향 | `fragranced` | No `fragrance` product field and no direct branch in `getDislikedFeelPenalty()` | Report/prompt copy only unless review-signal text indirectly changes product scoring elsewhere; no direct product DB penalty found. |
| 무거움 | `heavy` | `texture`, indirectly `finish` through review signals | Direct penalty when product texture is `cream`. Review-signal scoring also treats `heavy` as texture-friction context. |
| 끈적임 | `sticky` | `finish`, `texture`, review signals | Direct penalty for `finish: dewy` or `texture: cream`; review-signal scoring also applies non-sticky/sticky context. |
| 번들거림 | `greasy` | `finish`, `texture`, review signals | Same direct penalty as sticky. |
| 밀림 | `pilling` | `review_signals`, sunscreen `pilling_risk` only through `makeupUse` | No direct generic `getDislikedFeelPenalty()` branch. It is used in review-signal scoring and display copy; sunscreen pilling field is connected to `makeupUse`, not `mostDislikedFeel: pilling`. |

## Design Docs Have Intent But Runtime Differs

| 문서 의도 | 문서 위치 | 실제 코드 상태 | Gap |
| --- | --- | --- | --- |
| `/api/analyze` optional inputs include `outdoorExposure` and `verySensitivePeriod` | `docs/architecture/contracts.md` | API accepts both, but current free survey UI does not expose them directly. `outdoorExposure` is derived from `environmentExposure.includes("outdoor")`; `verySensitivePeriod` defaults false. | Optional API contract exceeds free survey UI. |
| Face Lab is part of full report payload/storage | `docs/result-storage-policy.md`, revisit docs | Face Lab is generated by separate `/api/face-reading`, stored separately in sessionStorage, then composed into result/full report. | It is not influenced by survey or `/api/analyze` calculation. |
| Product tags include `eye_sting`, `pilling_risk`, `tone_up`, `white_cast` | `docs/Product_Tagging_SQL_Matching_Rules.md` | Sunscreen scoring does consume these fields. | Implemented for sunscreen path. |
| Current product treatment-family canonicalization | architecture docs | Not central to this audit, but Skin Match recommendation still uses category slot normalizers and treatment-family compatibility. | Known category drift remains documented elsewhere. |

## Runtime Rules Not Clearly Captured In Design Docs

| Runtime rule | File/function | Why it matters |
| --- | --- | --- |
| Free survey optional answers are made required by `normalizeSurveyAnswers()` defaults before API call, and API requires them. | `app/page.js` `normalizeSurveyAnswers`; `app/api/analyze/route.js` required check | UI says optional, but API path always receives defaults for several optional fields. |
| `mainConcerns` UI allows 4 selections, but product scoring uses only top 2. | `getConcernList()` in `lib/recommendation-scoring.ts` | 3rd/4th concerns affect condition score but not canonical product concern scoring. |
| Free routine preview is static canned copy. | `lib/result/free-result-v2-static-builders.js` `buildFreeResultV2RoutinePreview()` | The API `routineStructure` is generated but free Step 4 preview does not display the actual dynamic AM/PM strategy. |
| Display radar/dashboard is rebuilt locally instead of using API `scoring.concernScores`. | `app/result/page.js` `buildSkinDashboardMetrics()` | Possible drift between actual decision score and visible score presentation. |
| Gender affects only men’s product scoring, not skin score or Face Lab. | `getGenderPreferenceAdjustment()` | Important for interpreting gender input impact. |

## Example Simulation

User example:

```json
{
  "skinType": "combination",
  "sensitivity": "medium",
  "genderPreference": "female",
  "mainConcern": "acne",
  "mainConcerns": ["acne", "pores", "redness"],
  "postWashFeeling": "tight",
  "afternoonSkinChange": "more_oily",
  "cleansingFrequency": "twice",
  "environmentExposure": ["mask", "kitchen"],
  "preferredTexture": "watery",
  "mostDislikedFeel": "fragranced",
  "whiteCastHate": false,
  "toneUpWanted": true,
  "makeupUse": true,
  "eyeSensitive": false,
  "locale": "ko"
}
```

Expected multipart payload:

| Payload field | Value |
| --- | --- |
| `image` | uploaded file |
| `skinType` | `combination` |
| `sensitivity` | `medium` |
| `genderPreference` | `female` |
| `mainConcern` | `acne` |
| `mainConcerns` | `["acne","pores","redness"]` as JSON string |
| `cleansingFrequency` | `twice` |
| `preferredTexture` | `watery` |
| `postWashFeeling` | `tight` |
| `afternoonSkinChange` | `more_oily` |
| `environmentExposure` | `["mask","kitchen"]` as JSON string |
| `mostDislikedFeel` | `fragranced` |
| `whiteCastHate` | `false` |
| `toneUpWanted` | `true` |
| `makeupUse` | `true` |
| `eyeSensitive` | `false` |
| `locale` | `ko` |

Expected deterministic score effects before photo:

| Axis | Survey/environment contributions visible from code |
| --- | --- |
| `acne` | main concern first +22; afternoon oil +2; mask +4 |
| `pores` | second concern +10; combination skin +3; afternoon oil +4 |
| `redness` | third concern +10; sensitivity medium +3; post-wash tight +2; mask +4; kitchen +3 |
| `dehydration` | combination skin +3; post-wash tight +8 |
| `barrier` | sensitivity medium +4; post-wash tight +5; mask +2 |
| `oiliness` | combination skin +4; afternoon oil +7; kitchen +3 |
| `uv` | kitchen +1; tone-up +2; makeup +1 |
| `uneven_tone` | tone-up +1 |

Likely priority before photo is `acne` unless photo evidence pushes another axis higher. With sensitivity `medium`, `getTopCategorySlot("acne")` chooses `cleanser`; with sensitivity `high`, it would choose `serum`. Product scoring then favors products matching acne/pores, watery texture, acceptable sensitivity risk, and penalizes women selecting men’s products. `fragranced` does not directly penalize products.

Sunscreen impact for the example: tone-up and makeup-use are connected. Sunscreens with `tone_up: true` gain score, and high `pilling_risk` can be hard-rejected in strict sunscreen mode. Because `whiteCastHate` and `eyeSensitive` are false, white-cast and eye-sting penalties do not activate from this example.

Face Lab impact for the example: none from survey fields. Face Lab receives only image and locale.

## Removal / Consolidation / Connection Review Needed

| 문항 | Current status | Review recommendation |
| --- | --- | --- |
| `mostDislikedFeel: fragranced` | No direct product DB field or penalty | Either add explicit product/review connection or label it copy/context-only. |
| `mostDislikedFeel: pilling` | Not connected to generic product `pilling_risk`; sunscreen pilling uses `makeupUse` | Decide whether pilling avoidance should map directly to sunscreen `pilling_risk` and/or product review signals. |
| `cleansingFrequency` `once`/`twice` | Mostly payload/prompt; only `3_plus` changes scores | Consider marking as low-impact or adding a concrete rule. |
| 3rd/4th `mainConcerns` | Affect priority score but not product concern scoring beyond top 2 | Clarify UI copy or scoring contract. |
| Free routine preview | Static, despite dynamic `routineStructure` existing | Connect the free preview to API routine structure if user-facing accuracy matters. |
| Display radar | Locally derived from form/result, not API score card | Use API `scoring.concernScores` or document that radar is an illustrative display layer. |

## Verification

- Read-only source audit completed across survey UI, home submit path, `/api/analyze`, recommendation scoring, decision bundle, result rendering, Face Lab generation, and architecture docs.
- App code changes: none.
- DB schema changes: none.
- New file only: this audit document.
