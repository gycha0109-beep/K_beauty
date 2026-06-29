# Skin Match Survey Contract v1

This document defines how the free Skin Match survey connects to the free recommendation engine, free result, and saved/premium report context. The audit history remains in `docs/architecture/survey-calculation-audit.md`; this file records the active contract.

## Active Survey Fields

| Survey field | UI state key | Recommendation use | Fallback / legacy handling |
| --- | --- | --- | --- |
| Skin type | `skinType` | Product skin type match and condition context | Missing required value rejects new analysis |
| Sensitivity | `sensitivity` | Irritation risk and sensitivity-safe scoring | Legacy `sensitivityLevel` alias accepted |
| Main concerns | `mainConcerns`, `mainConcern` | Concern match, category priority, priority score | Legacy single `mainConcern` accepted |
| Post-wash feel | `postWashFeeling` | Dryness/oiliness context and product fit | Legacy `postCleanseFeel` alias accepted |
| Afternoon change | `afternoonSkinChange` | Oiliness/dryness/reactivity context | Legacy `afternoonState` alias accepted |
| Cleansing frequency | `cleansingFrequency` | `3_plus` keeps existing barrier/dehydration survey signal | Missing optional value defaults to `twice` |
| Environment exposure | `environmentExposure` | Outdoor, heat, mask, aircon, and related environment context | JSON parse failure becomes `[]` |
| Preferred texture | `preferredTexture` | Texture match scoring | Legacy `texturePreference` alias accepted |
| Disliked feel | `mostDislikedFeel` | General product finish penalty for `sticky`, `greasy`, `heavy` | Legacy `dislikedFeel` alias accepted |
| Sunscreen considerations | `sunscreenConsiderations` -> `whiteCastHate`, `toneUpWanted`, `makeupUse`, `eyeSensitive` | Sunscreen hard filter/score rules, including makeup fit and pilling risk | Missing booleans default to `false` |
| Product profile preference | `genderPreference` | Eligibility filter only. `female` excludes `is_mens === true` products before scoring | Missing or invalid values normalize to `unspecified` |

## Gender Preference Contract

- Allowed values are `female`, `male`, and `unspecified`.
- If the value is missing, empty, or invalid, normalize it to `unspecified`.
- When `genderPreference === "female"`, products with `product.is_mens === true` are removed from the candidate pool before score calculation.
- When `genderPreference === "male"` or `unspecified`, `is_mens` products remain eligible.
- `is_mens === false`, `null`, or `undefined` products remain eligible for all values.
- There is no male-product score bonus and no female-product score penalty. This is a candidate eligibility rule, not a ranking formula.
- Product metadata field `is_mens` is preserved. Do not delete or rewrite product data to enforce this rule.
- If the female filter leaves a category with too few or zero products, do not reinsert `is_mens === true` products through fallback. Use the existing null-safe/no-result behavior.

## Removed / Narrowed Inputs

- `mostDislikedFeel: fragranced` is not exposed in the current free UI and must not create a new general product penalty.
- General `mostDislikedFeel: pilling` is not exposed in the current free UI. Sunscreen-specific `makeupUse` and `pilling_risk` behavior remains separate.

## Free / Premium Boundary

- The free `/api/analyze` public response does not need to expose `genderPreference`.
- The submitted survey snapshot can preserve `genderPreference` for traceability.
- `genderPreference` is not a Face Lab input and must not be used to generate or correct Face Lab results.
- Premium report, current products, Face Lab, and My Skin flows must not add new behavior from this rule unless explicitly scoped.
