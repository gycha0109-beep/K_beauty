# Current Products Verdict Contract v1

## Scope

This contract defines how paid Skin Match full reports explain products the user already uses. It does not change product recommendation ranking, Top Pick, supporting products, sunscreen scoring, current product input, or free result output.

## Input Status vs Verdict Status

`selected`, `not_in_db`, and `not_using` describe what the user entered for a current product slot.

`keep`, `adjust`, `hold`, and `check_needed` describe the paid report's usage judgment for a visible current product in the routine consult section.

These concepts must stay separate:

| Input status | Meaning | Verdict behavior |
| --- | --- | --- |
| `selected` | The user selected a registered product id. | If a product snapshot exists, generate `keep`, `adjust`, or conservative `hold`; if not, use `check_needed`. |
| `not_in_db` | The user uses a product that is not registered in the product DB. | Generate `check_needed`. Do not judge it as unsuitable. |
| `not_using` | The user is not using a product for that slot. | Do not generate a verdict badge. Keep the existing empty slot UI. |

## Verdict Definitions

| Verdict | Definition | UI tone |
| --- | --- | --- |
| `keep` | The product role has no clear conflict with the current skin priority and routine step. | Keep using in the current routine. |
| `adjust` | The product does not need to be removed, but amount, frequency, timing, or pairing should be lighter. | Adjust usage first before changing products. |
| `hold` | Current barrier, sensitivity, or irritation context clearly conflicts with active or exfoliating product information. | Pause temporarily until the skin is calmer. |
| `check_needed` | DB information, product snapshot, or usage context is insufficient for a fit judgment. | Keep the slot context, but do not claim detailed suitability. |

## Verdict Inputs

The premium verdict engine may read:

- `currentProducts.selections`
- current product `status`, `category`, `productId`, `useTime`, `satisfaction`
- selected product snapshot display fields already stored in the premium report path: `id`, `brand`, `name`, `category`, `product_form`, `image_url`
- structured active fields, when present: `active_ingredients`, `ingredients`, `key_ingredients`, `hero_ingredients`, `active_signals`, `ingredient_signals`, `functional_signals`, and camelCase aliases
- normalized survey answers already used by the decision bundle
- premium priority axis
- routine slot mapping for display alignment

The verdict engine must not modify recommendation scoring or product ranking. It can read existing product and survey context, but it must not create new Top Pick, supporting product, category, or sunscreen scoring rules.

## Conservative Hold Rule

`hold` is reserved for a clear current-context conflict. The default should be `keep`, `adjust`, or `check_needed` unless structured product information gives a strong active or exfoliating signal and the current priority is barrier, redness, or acne related.

Product name and brand are display fields only. They must not trigger `hold` by themselves.

The UI must not label a product as bad or unsafe in absolute terms. It should frame `hold` as a temporary routine decision.

## Fallback and Legacy Reports

If a saved premium report does not include `currentProductVerdicts`, the routine consult section must continue rendering the existing current product slot notes without verdict badges.

If a selected product has no `productSnapshot`, the verdict is `check_needed` and the existing selected-product fallback label remains valid.

If `currentProducts` is absent, no verdict is rendered.

## Sunscreen Exception

`sunscreen` with `not_in_db` is still treated as a used protection step and receives only a `check_needed` verdict.

`sunscreen` with `not_using` keeps the existing empty protection step UI and receives no verdict badge.

This contract does not change sunscreen hard filters or sunscreen scoring.

## Exposure Boundary

Current product verdicts are paid-report-only data. They are stored under `premiumReport.currentProductVerdicts` and may be returned by the full report session path.

Free result screens and the public `/api/analyze` free response must not expose verdict badges, verdict summaries, or verdict details.

## Responsibility Split

The recommendation engine ranks products and selects Top Pick/supporting products.

The current product verdict engine explains how to treat already-owned products inside the paid routine consult section. It does not recommend replacements, change shopping CTAs, or alter ranking.
