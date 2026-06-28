# Premium Condition Response Contract v1

## Purpose

The paid full report condition response section explains temporary routine adjustments for days when skin condition feels unstable. It is not a diagnosis, treatment instruction, prescription, medication guide, product recommendation, or purchase flow.

The unit of judgment is a routine response topic, not an individual product.

## Statuses

| Status | Meaning | UI label |
| --- | --- | --- |
| `maintain` | A routine behavior that can stay in place during unstable days. | 유지하기 |
| `reduce` | A behavior where amount, frequency, friction, or step count should be lowered first. | 강도 줄이기 |
| `avoid_for_now` | A behavior that should not be actively expanded until the current condition is steadier. This is not a permanent stop. | 당분간 확장 보류 |

When evidence is incomplete, `maintain` or `reduce` is preferred. `avoid_for_now` is used conservatively.

## Response Topics

At most five responses are stored and displayed. Stable keys:

- `cleansing_load`
- `hydration_barrier`
- `active_load`
- `sun_protection`
- `texture_routine`
- `environment_recovery`

## Input Evidence

The premium helper reads existing report inputs only:

- survey answers such as `sensitivity`, `postWashFeeling`, `cleansingFrequency`, `environmentExposure`, and `outdoorExposure`
- premium priority axis and concern scores
- existing `routineStructure`
- existing `currentProductVerdicts`
- existing `functionalDecisions`

The helper does not change recommendation scoring, product ranking, Top Pick, supporting products, sunscreen scoring, current product input, or slot building.

## Judgment Rules

- `hydration_barrier` stays `maintain` as the safe base response.
- `cleansing_load` becomes `reduce` when `cleansingFrequency === "3_plus"` or `postWashFeeling === "tight"`.
- `active_load` becomes `reduce` when barrier, redness, acne, or dehydration burden is high.
- `active_load` becomes `avoid_for_now` only when sensitive priority or high sensitive concern score overlaps with existing active-burden evidence from `currentProductVerdicts: hold` or `functionalDecisions: pause`.
- `texture_routine` is `maintain` for oiliness or pores priority when sensitive burden is low, and `reduce` when sensitive burden is high.
- `environment_recovery` becomes `reduce` when heat, humidity, mask, outdoor, aircon, indoor dry, or dry air exposure is present.
- `sun_protection` stays `maintain`; the action may reduce layers before sunscreen, not sunscreen itself.

The helper does not parse product names, brand names, verdict titles, summaries, or reasons to infer active burden.

## Relationship To Other Premium Decisions

`currentProductVerdicts` answers how to handle a product the user already uses.

`functionalDecisions` answers which skin goals are appropriate now, later, or paused.

`conditionResponses` answers how to temporarily adjust the routine on unstable days.

`hold` and `pause` are supporting signals only. They do not automatically turn every response into `avoid_for_now`.

## Medical Safety Copy

The optional safety sentence is short and non-diagnostic:

> 불편감이 오래 지속되거나 일상에 지장을 줄 정도라면 전문적인 상담을 고려해 보세요.

It is only attached when sensitivity is high and the priority axis is `redness`, `barrier`, or `acne`. Disease names, treatment claims, prescriptions, medication advice, and emergency triage are out of scope.

## Payload And Sanitizer

`premiumReport.conditionResponses` is premium-only. Each item has this shape:

```js
{
  responseKey: string,
  status: "maintain" | "reduce" | "avoid_for_now",
  title: string,
  summary: string,
  reasons: string[],
  action: string | null
}
```

Sanitizer rules:

- `responseKey`, `title`, and `summary` must be non-empty strings.
- `status` must be one of the three allowed statuses.
- `reasons` must be an array; only non-empty strings are kept.
- `action` must be `null` or a non-empty string.
- unknown fields, invalid statuses, object text values, `undefined`, and `NaN` do not pass.
- at most five items are stored.

## Storage, Requery, And Legacy Fallback

The sanitized field is stored inside the existing premium report payload and returned through the existing full report requery path. No DB schema change is required.

If a saved legacy premium report does not include `conditionResponses`, the UI shows a quiet fallback for this section only. Routine consultation, current products, functional decisions, and Face Lab remain unaffected.

## Free/Premium Boundary

`conditionResponses` must not be included in the free `/api/analyze` public response or free result UI. It belongs only to the premium report and premium session payload.

## Out Of Scope

- product recommendation or replacement
- purchase CTA
- medical diagnosis
- treatment or prescription guidance
- score formula changes
- sunscreen hard filter or score changes
- current product verdict rule changes
- functional decision rule changes
