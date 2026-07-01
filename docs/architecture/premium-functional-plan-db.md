# Premium Functional Plan DB Contract Draft

Status: draft only. Do not apply the SQL in this document without a separate
implementation approval.

## Purpose

Premium Functional Plan needs a stable way to answer two different questions:

1. Based on the free survey and analysis result, which functional goal and
   approach should the report explain?
2. Based on registered product data, which actual products can safely be shown
   as candidates for that goal?

The current premium report can already store goal-level
`premiumReport.functionalDecisions`, current product snapshots, and
`currentProductVerdicts`. That contract is useful for the current report, but it
does not give a durable product-to-functional-prescription map. This draft
introduces two tables:

- `functional_catalog`: the prescription catalog. It can explain a goal even
  when no product candidate is available.
- `product_functional_map`: the reviewed mapping between a real `products` row
  and one catalog item.

This document is architecture-sensitive because it describes future DB schema
and engine contracts. It is not a migration.

## Current Structure Audit

Observed current contracts:

- `products` is the real product table used by recommendation/product source
  code.
- Product category canonical direction is `products.category = treatment` for
  serum/ampoule/essence/booster/peeling-solution products, with
  `products.product_form` carrying the detailed form.
- Current product input supports `selected`, `not_in_db`, and `not_using`.
  Future engine design should also distinguish `unanswered`.
- `selected` requires `productId`. Premium full-report creation can requery
  `products` and stores a selected product snapshot under
  `premiumReport.currentProducts.selections[].productSnapshot`.
- Snapshot sanitization in the free-analysis premium payload keeps only display
  fields, while the premium full-report update path can currently attach richer
  product snapshot fields such as `concerns`, `skin_types`, `texture`, `finish`,
  `irritation_risk`, `sensitivity_safe`, prices, and signal json.
- Existing `premiumReport.functionalDecisions` is goal-level and uses
  `now | later | pause`; it is not a product recommendation engine.
- Existing `currentProductVerdicts` explain how to treat currently owned
  products in the routine consult section; they do not select candidates.
- `premium_report_sessions.premium_report` and `saved_reports.premium_report`
  carry the saved premium report snapshot. Saved re-open should not require
  regenerating unrelated sections.

Important boundary:

- `products.concerns` can remain useful for general filtering/ranking.
- `products.concerns` alone must not mean "this is an active functional product
  for Premium Functional Plan."
- A cleanser or moisturizer with `pores` in `products.concerns` must not be
  treated as a pore functional active unless `product_functional_map` explicitly
  maps it.
- `currentProducts` is a report-time snapshot/input, not the long-term routine
  source of truth. If a future `user_current_routine` table is introduced,
  RoutineAudit should read from that owner source first and keep saved premium
  report snapshots as legacy/reopen context.

## Why Two Tables

`functional_catalog` answers "what direction should the report explain?"

- It is survey-driven.
- It can exist without products.
- It owns display copy, routine slot, start frequency, hold copy, and avoid
  combinations.
- It prevents product inventory gaps from removing the core functional guidance.

`product_functional_map` answers "which registered product is reviewed for this
direction?"

- It is product-data-driven.
- It maps one `products.id` to one catalog item with evidence and confidence.
- It supports multiple products per prescription and multiple prescriptions per
  product when manually reviewed.
- It prevents product names, brand names, or broad `products.concerns` from
  becoming hidden ingredient/functionality inference.

## `functional_catalog` Contract

Recommended first version uses `text` plus check constraints for domain keys.
Reason: the project already has product-category enum drift between historical
and current category directions. Text checks are easier to extend in forward
migrations than Postgres enum values, while still failing closed.

| Column | Draft type | Required | Contract |
| --- | --- | --- | --- |
| `id` | `uuid` | yes | Primary key, default `gen_random_uuid()`. |
| `goal_key` | `text` | yes | Stable goal key used by the engine and UI. |
| `approach_key` | `text` | yes | Stable functional approach key under the goal. |
| `display_goal` | `text` | yes | User-facing Korean goal name first. |
| `display_approach` | `text` | yes | User-facing Korean approach name first. |
| `primary_concern` | `text` | yes | One existing concern enum value. |
| `secondary_concerns` | `text[]` | yes | Existing concern values that can support the goal. |
| `recommended_categories` | `text[]` | yes | Existing product categories where mapped candidates may appear. |
| `plan_intro_copy` | `text` | yes | Short conclusion copy. |
| `why_this_works_copy` | `text` | yes | Why this approach fits the concern. |
| `usage_guidance` | `text` | yes | User-facing usage guidance. |
| `routine_slot` | `text` | yes | Engine/display slot such as `pm_functional`. |
| `default_frequency` | `text` | yes | Human-readable first-use cadence. |
| `avoid_with` | `text[]` | yes | Same-day combinations to avoid or reduce. |
| `hold_guidance` | `text` | yes | What to say when FunctionalPlan mode is `HOLD`. |
| `next_guidance` | `text` | yes | What to say when FunctionalPlan mode is `NEXT`. |
| `caution_level` | `text` | yes | `low`, `normal`, or `high`; copy intensity only. |
| `is_active` | `boolean` | yes | Soft hide from engine. |
| `sort_priority` | `integer` | yes | Lower value appears first within a goal. |
| `created_at` | `timestamptz` | yes | Default `now()`. |
| `updated_at` | `timestamptz` | yes | Updated by trigger. |

Rules:

- `goal_key + approach_key` should be unique.
- One `goal_key` may have multiple approaches, for example
  `pores_texture + exfoliation` and `pores_texture + retinoid_like`.
- `primary_concern` should stay tied to the existing concern set:
  `barrier`, `dehydration`, `oiliness`, `redness`, `acne`, `pores`,
  `uneven_tone`.
- `secondary_concerns` should be `text[]` with a check that every value is in
  the same existing concern set.
- `recommended_categories` should be `text[]` in v1. It should accept the
  current canonical product categories the app can query, including
  `cleanser`, `toner_essence`, `toner_pad`, `treatment`,
  `moisturizer_lotion_emulsion`, `moisturizer_gel`, `moisturizer_cream`,
  `moisturizer_balm`, `moisturizer`, and `sunscreen`. Before migration, verify
  the live `public.product_category` enum inventory because historical
  migrations imply category drift around `toner_pad`.
- `avoid_with` should remain `text[]` copy tags in v1. It is guidance text, not
  a relationship to products.
- Copy fields should start as Korean text columns. If multilingual paid report
  copy becomes a requirement, migrate to either `{ ko, en }` jsonb copy objects
  or separate translation tables. Do not mix ad hoc suffix columns until that is
  decided.
- `hold_guidance` and `next_guidance` belong in this table because they are
  approach-specific. The engine decides `HOLD` or `NEXT`; the catalog supplies
  safe copy for that approach.

## `product_functional_map` Contract

| Column | Draft type | Required | Contract |
| --- | --- | --- | --- |
| `id` | `uuid` | yes | Primary key, default `gen_random_uuid()`. |
| `product_id` | `uuid` | yes | FK to `products.id`. |
| `catalog_id` | `uuid` | yes | FK to `functional_catalog.id`. |
| `goal_key` | derived | no | Derive from `functional_catalog` by join in v1. |
| `approach_key` | derived | no | Derive from `functional_catalog` by join in v1. |
| `strength` | `text` | yes | `intro`, `balanced`, or `intensive`. |
| `confidence` | `text` | yes | `high`, `medium`, or `low`. |
| `evidence_level` | `text` | yes | Source quality label. |
| `evidence_note` | `text` | yes | Short human review note. |
| `source_tags` | `text[]` | yes | Structured source tags, not product-name inference. |
| `recommended_for_skin_types` | `text[]` | yes | Optional skin-type fit hints. Empty means no specific claim. |
| `avoid_for_signals` | `text[]` | yes | Conservative signals where candidate should be downranked/hidden. |
| `routine_slot_override` | `text` | no | Optional override from catalog slot. |
| `frequency_override` | `text` | no | Optional override from catalog default frequency. |
| `sort_priority` | `integer` | yes | Lower value ranks earlier within the catalog item. |
| `is_active` | `boolean` | yes | Soft exclude from candidate queries. |
| `created_at` | `timestamptz` | yes | Default `now()`. |
| `updated_at` | `timestamptz` | yes | Updated by trigger. |

Rules:

- `product_id + catalog_id` should be unique.
- `catalog_id` is authoritative. Do not store `goal_key` and `approach_key` in
  the first migration. Join to `functional_catalog` for candidate queries and
  audit exports.
- Denormalize `goal_key` and `approach_key` only if production query profiling
  proves the join is a bottleneck. If denormalized later, add database-owned
  sync triggers and make catalog key updates immutable after mappings exist.
- `strength` is a user-facing product position source:
  `intro`, `balanced`, `intensive`.
- `confidence` is mapping confidence. Low confidence products should either be
  hidden by default or shown only as "검토 중" in internal tooling, not user
  recommendation.
- `evidence_level` candidates:
  `manual_reviewed`, `db_structured`, `review_supported`, `weak`.
  User-facing candidates should require at least `manual_reviewed` or
  `db_structured` in the first production version.
- `source_tags` should be `text[]` first. Use `jsonb` only if each tag needs
  structured fields such as source, timestamp, and reviewer id.
- `recommended_for_skin_types` and `avoid_for_signals` are mapping-level hints.
  The engine must still combine them with the product fields such as
  `irritation_risk`, `sensitivity_safe`, `texture`, `finish`, and current
  survey signals.
- `recommended_for_skin_types` should use only the currently supported skin type
  keys unless the product-domain contract expands. The current app source uses
  `oily`, `dry`, `combination`, and `sensitive`.
- `routine_slot_override` and `frequency_override` are optional escape hatches.
  They should be rare and require an `evidence_note`; most products should use
  the catalog routine slot and default frequency.
- `is_active = false` should remove the mapping without hiding the product from
  the general product DB.

## Relationship to `products`

`products` remains the product source of truth:

- Brand, name, category, product form, image, price, `buy_link`, source URLs,
  texture, finish, skin types, concerns, irritation risk, sensitivity flag, and
  signal json stay in `products`.
- Premium Functional Plan candidate retrieval starts from
  `functional_catalog`, joins `product_functional_map`, then joins `products`.
  The first implementation should do this in server-side code rather than
  direct browser queries.
- `product_functional_map` should never store fake price, image, brand, or
  product copy.
- Products without a map are not functional candidates for this engine.
- Selected current products without a map for the current catalog item should
  be `UNKNOWN` or `MISMATCH`, depending on whether they have a different mapped
  catalog item.
- `not_in_db` products are never joined and never inferred.

## Engine Responsibility Split

### FunctionalPlan

Inputs:

- Free survey answers already used by free result generation.
- Free result priority, `freeResult.priority.axis`, and scoring such as
  `freeResult.scoring.concernScores` when available.
- Photo/survey analysis signals only where they already participate in the
  decision bundle.

Responsibilities:

- Decide `primaryGoal`.
- Decide optional `secondaryGoal`.
- Select one `functional_catalog` row for the chosen goal/approach.
- Decide plan mode: `START`, `HOLD`, or `NEXT`.
- Produce catalog-backed copy and base routine guidance.
- Produce the catalog id used for candidate queries and RoutineAudit matching.

Non-responsibilities:

- It does not infer selected product functionality.
- It does not rank all products.
- It does not mutate current products or saved reports.

### RoutineAudit

Inputs:

- `currentProducts.selections`.
- Product snapshots or rehydrated products for `selected` product ids.
- `product_functional_map` rows for selected product ids.
- FunctionalPlan selected `catalog_id`, `goal_key`, and `approach_key`.

Responsibilities:

- Keep selected-state semantics separate from functional plan mode.
- Return `findings[]` as the primary output.
- Derive a `summaryStatus` from findings for compact UI.
- Treat `not_in_db` as `UNKNOWN`.
- Treat `not_using` as a real empty category, not unknown product data.
- Treat `unanswered` as missing information.
- Match selected products to functional goals only through
  `product_functional_map`.

Example output:

```json
{
  "summaryStatus": "MISMATCH",
  "findings": [
    {
      "category": "treatment",
      "sourceState": "selected",
      "status": "MISMATCH",
      "productId": "product-id",
      "productName": "Registered Product",
      "catalogId": "other-catalog-id",
      "reason": "진정·장벽 축에는 연결되지만 이번 주요 고민인 모공·피부결과는 직접 연결되지 않음"
    },
    {
      "category": "toner_pad",
      "sourceState": "not_in_db",
      "status": "UNKNOWN",
      "reason": "사용 중인 제품은 있으나 DB에서 기능성 정보 확인 불가"
    }
  ]
}
```

### CandidatePolicy

Inputs:

- FunctionalPlan result.
- RoutineAudit result.
- Product input state summary.

Responsibilities:

- Decide candidate block visibility and CTA tone.
- Never pretend a candidate has been saved to the routine.
- Hide or collapse candidates when current state is unstable.

Draft policy:

| FunctionalPlan + input/audit | Candidate behavior |
| --- | --- |
| `HOLD` | Hide by default. If shown in dev or preview, CTA must be "피부 안정 후 검토". |
| `START + not_using` | Show representative candidates. |
| `START + selected + OPTIMIZE` | Collapse candidates; show only next-purchase candidates if needed. |
| `START + selected + CONSOLIDATE` | Do not show new-add CTAs. Allow compare/organize language only. |
| `START + selected + MISMATCH` | Show main-concern supplement candidates. |
| `START + selected + REPLACE_CANDIDATE` | Show replacement comparison candidates for next replacement timing. |
| `START + not_in_db` | Conservative. Show candidates as references, with audit limited to unknown. |
| `START + unanswered` | Prioritize principles. Candidates may be collapsed. |
| `NEXT` | Collapse candidates as next-step candidates. |
| `HOLD + ADJUST` | Hide candidates. Current usage adjustment comes first. |

## Current Product Input States

| State | Meaning | Functional Plan handling |
| --- | --- | --- |
| `selected` | User selected a registered product id. | Rehydrate product, read `product_functional_map`, and generate product-specific findings only when map evidence exists. |
| `not_using` | User does not use that category/slot. | Treat as empty routine category. This can support START candidate visibility for that category, but is not information loss. |
| `not_in_db` | User uses a product that the DB cannot identify. | Mark audit finding `UNKNOWN`. Do not infer ingredients, functionality, or irritation from name/brand. |
| `unanswered` | User did not answer that slot or skipped current-products input. | Mark missing information. Do not merge with `not_in_db` or `not_using`. |

## RoutineAudit Status Definitions

RoutineAudit is findings-first. `summaryStatus` is derived from the highest
priority visible finding, not the only result.

| Status | Minimum evidence | User-facing meaning |
| --- | --- | --- |
| `NO_ROUTINE_DATA` | No current-products selections, or explicit continue-without-products state. | Product fit and duplication were not checked. |
| `UNKNOWN` | Selection is `not_in_db`, `unanswered`, selected product failed rehydrate, or selected product has no functional map. | Information is insufficient. No functional claim. |
| `OPTIMIZE` | At least one selected product has an active map to the same `catalog_id`, or to the same `goal_key` with a compatible approach. | Already started; optimize frequency, timing, and combinations. |
| `CONSOLIDATE` | Two or more selected products map to the same `goal_key` or same catalog item. | Similar functional goal overlaps; organize around one product or one axis. |
| `MISMATCH` | Selected product maps to a different functional goal and no selected product maps to the current primary goal. | Current product may be useful, but not for this primary goal. |
| `ADJUST` | A selected mapped product has same-day active overlap, high frequency/use-time burden, low satisfaction, an existing current-product `adjust` verdict, or `avoid_for_signals` overlap with current high burden signals. | Adjust frequency, amount, or same-day pairing. |
| `REPLACE_CANDIDATE` | A selected mapped product has high-confidence `avoid_for_signals` overlap, `irritation_risk = high` plus current high sensitivity/redness/barrier burden, repeated `ADJUST` evidence, or a manual review note marking next-replacement comparison. | Do not say stop now; compare alternatives at next replacement. |

Status priority for `summaryStatus`:

1. `CONSOLIDATE`
2. `ADJUST`
3. `REPLACE_CANDIDATE`
4. `OPTIMIZE`
5. `MISMATCH`
6. `UNKNOWN`
7. `NO_ROUTINE_DATA`

The priority can be adjusted, but the engine must keep all findings.

## Primary Goal Taxonomy

| `goal_key` | Related concerns | Representative approaches | Recommended categories | HOLD conditions | Routine slot | Avoid with |
| --- | --- | --- | --- | --- | --- | --- |
| `pores_texture` | `pores`, `oiliness`, `acne`, `uneven_tone` | `exfoliation`, `retinoid_like` | `toner_pad`, `treatment` | High sensitivity plus redness/barrier burden; explicit pause; strong active burden conflict. | `pm_functional` | scrub, strong exfoliation overlap, same-goal active stacking |
| `oil_acne` | `oiliness`, `acne`, `pores` | `sebum_control`, `exfoliation`, `soothing` | `toner_pad`, `treatment`, `moisturizer_gel` | High sensitivity plus redness/barrier burden; active burden conflict. | `pm_functional` or `prep` | drying cleanser overlap, strong exfoliation overlap |
| `barrier_redness` | `barrier`, `redness`, `acne` | `soothing`, `barrier_support` | `toner_essence`, `treatment`, `moisturizer_lotion_emulsion`, `moisturizer_cream`, `moisturizer_balm` | Usually not held as a goal; HOLD means avoid active expansion and use calming copy. | `prep` or `moisturize` | strong exfoliation, retinoid-like expansion |
| `dehydration` | `dehydration`, `barrier` | `hydration`, `barrier_support` | `toner_essence`, `treatment`, `moisturizer_lotion_emulsion`, `moisturizer_gel`, `moisturizer_cream` | Dryness alone is not HOLD. HOLD only when sensitivity plus redness/barrier burden is high. | `prep` or `moisturize` | over-cleansing, strong exfoliation expansion |
| `uneven_tone` | `uneven_tone`, `redness`, `barrier` | `tone_care`, `vitamin_c_like`, `azelaic_like`, `sunscreen_protection` | `treatment`, `sunscreen` | HOLD when tone actives conflict with high sensitivity plus redness/barrier burden. | `am_protect` or `pm_functional` | strong exfoliation overlap, multiple tone actives |
| `protection` | `uneven_tone`, `redness`, `barrier` | `sunscreen_protection` | `sunscreen` | Do not hold sunscreen as a protection goal; adjust product feel only when current sunscreen data supports it. | `am_protect` | none as a blanket rule |

## Approach Taxonomy

| `approach_key` | User-facing name | Description | Categories | Default frequency | Caution | Avoid with |
| --- | --- | --- | --- | --- | --- | --- |
| `exfoliation` | 피지·각질 케어 | Helps with clogged texture and oily/pore concerns when skin is stable. | `toner_pad`, `treatment` | evening 1-2 times/week | Start low; avoid when barrier/redness burden is high. | scrub, peeling pad overlap, other strong texture actives |
| `sebum_control` | 피지·트러블 케어 | Keeps oil and breakout-prone signals in one controlled axis. | `treatment`, `toner_pad`, `moisturizer_gel` | evening 2-3 times/week or light prep | Avoid drying escalation. | drying cleanser overlap, strong exfoliation overlap |
| `retinoid_like` | 결 개선 기능성 | Texture-focused improvement direction for stable skin. | `treatment` | evening 1-2 times/week | Use only when sensitivity/redness/dryness burden is low. | exfoliation, scrub, other retinoid-like actives |
| `soothing` | 진정 케어 | Calming direction for redness and barrier burden. | `toner_essence`, `treatment`, `moisturizer_lotion_emulsion`, `moisturizer_gel` | daily as tolerated | Do not oversell as treatment. | strong active expansion |
| `barrier_support` | 장벽 보조 | Supports a comfortable base routine. | `moisturizer_lotion_emulsion`, `moisturizer_cream`, `moisturizer_balm`, `treatment` | daily as tolerated | Avoid claiming repair/medical treatment. | strong exfoliation expansion |
| `hydration` | 수분 균형 | Adds hydration without making active expansion the priority. | `toner_essence`, `treatment`, `moisturizer_lotion_emulsion`, `moisturizer_gel`, `moisturizer_cream` | daily as tolerated | Dryness alone should not trigger HOLD. | over-cleansing, strong active stacking |
| `tone_care` | 톤 균일 | Conservative tone support when skin is stable. | `treatment`, `sunscreen` | evening 2-3 times/week or morning protection | Avoid expanding during high redness/barrier burden. | exfoliation overlap, multiple tone actives |
| `vitamin_c_like` | 산화 스트레스·톤 케어 | A structured tone approach only when map evidence supports it. | `treatment` | morning or evening 2-3 times/week | Do not infer from product name. | retinoid-like or exfoliation same day for sensitive users |
| `azelaic_like` | 붉음·톤 균형 케어 | A structured approach only when map evidence supports it. | `treatment` | evening 2-3 times/week | Use conservative copy; no disease claims. | strong exfoliation overlap |
| `sunscreen_protection` | 자외선 보호 | Morning protection foundation for tone and redness prevention. | `sunscreen` | every morning | Product comfort can be adjusted; protection goal remains. | none as blanket rule |

## Initial Seed Direction

Initial `functional_catalog` seed should be small enough to review manually.

| Goal + approach | Display goal | Display approach | Intro copy | Why copy | Usage guidance | Frequency | Avoid with | Hold guidance | Categories |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `pores_texture + exfoliation` | 모공·피부결 개선 | 피지·각질 케어 | 모공과 결이 우선이면 피지·각질 축 하나만 낮은 빈도로 시작합니다. | 유분과 각질 정체 신호가 함께 보일 때 같은 축을 정리해 부담을 줄입니다. | 저녁 루틴에서 수분 토너 다음, 보습제 전에 사용합니다. | 주 1-2회 | scrub, peeling overlap, retinoid-like same day | 붉음·장벽 부담이 높을 때는 새 각질 케어를 보류합니다. | `toner_pad`, `treatment` |
| `pores_texture + retinoid_like` | 모공·피부결 개선 | 결 개선 기능성 | 피부가 안정적이면 결 개선 축을 낮은 빈도로 검토합니다. | 결·탄력 체감이 중심이고 민감 신호가 낮을 때 적합합니다. | 저녁에 한 제품만 선택해 천천히 시작합니다. | 주 1-2회 | exfoliation, scrub, active stacking | 민감·붉음·건조 신호가 높으면 다음 단계로 미룹니다. | `treatment` |
| `oil_acne + sebum_control` | 피지·트러블 케어 | 피지 균형 케어 | 유분과 트러블 신호가 우선이면 하나의 피지 축을 먼저 잡습니다. | 건조하게 몰아가기보다 피지 부담을 한 축으로 정리합니다. | 저녁 또는 가벼운 준비 단계에서 낮은 빈도로 시작합니다. | 주 2-3회 | drying cleanser, strong exfoliation overlap | 붉음·장벽 부담이 높으면 피지 케어 확장은 보류합니다. | `toner_pad`, `treatment`, `moisturizer_gel` |
| `barrier_redness + soothing` | 안정화·장벽 | 진정 케어 | 이번 기간은 편안한 기본 루틴을 우선합니다. | 붉음과 장벽 신호가 높을 때는 새 기능성보다 안정감이 먼저입니다. | 토너/보습 단계에서 편안했던 제품 중심으로 유지합니다. | 매일 또는 피부 반응에 맞게 | strong active expansion | HOLD에서도 안정화 방향은 유지하되 새 활성 기능성은 늘리지 않습니다. | `toner_essence`, `treatment`, `moisturizer_lotion_emulsion`, `moisturizer_cream` |
| `dehydration + hydration` | 수분 균형 | 수분 균형 케어 | 속건조가 우선이면 수분과 보습의 균형을 먼저 맞춥니다. | 수분 부족은 다른 개선 기능성보다 기본 루틴 안정성이 중요합니다. | 세안 후 수분 단계와 보습 마무리를 안정적으로 유지합니다. | 매일 | over-cleansing, strong active expansion | 건조만으로 HOLD하지 말고 민감·붉음·장벽 신호와 함께 판단합니다. | `toner_essence`, `treatment`, `moisturizer_lotion_emulsion`, `moisturizer_gel`, `moisturizer_cream` |
| `uneven_tone + tone_care` | 톤 균일 | 톤 균일 케어 | 피부가 안정적이면 톤 균일 목표 하나를 검토합니다. | 톤 관리는 보호 루틴과 낮은 빈도 기능성 조합이 중요합니다. | 아침 보호 루틴을 고정하고 저녁 기능성은 하나만 검토합니다. | 주 2-3회 | active stacking, strong exfoliation overlap | 붉음·건조·장벽 부담이 높으면 안정화 후 재검토합니다. | `treatment`, `sunscreen` |

Do not create `product_functional_map` seed rows by product name. First mapping
seed should be created only after manual review of actual rows and source
evidence.

Candidate review query shape:

```sql
-- Review candidates only. Do not auto-insert from this result.
select
  p.id,
  p.brand,
  p.name,
  p.category::text as category,
  p.product_form::text as product_form,
  p.concerns,
  p.ingredient_signals,
  p.review_signals,
  p.market_signals,
  p.irritation_risk,
  p.sensitivity_safe,
  p.price_min,
  p.price_max,
  p.buy_link
from public.products p
where p.category::text in ('treatment', 'toner_pad', 'sunscreen')
  and p.concerns && array['pores', 'oiliness', 'acne', 'uneven_tone', 'barrier', 'redness', 'dehydration']
order by p.category::text, p.brand, p.name;
```

Before using this query, verify that the live products table has the selected
columns. The current product source contract uses `buy_link`; do not assume an
`external_url` column exists unless the live schema proves it.

## Migration SQL Draft

This SQL is a draft for review only. It should not be placed in
`supabase/migrations` or applied until the next implementation stage is
approved.

```sql
-- DRAFT ONLY - do not run without separate approval.
begin;

create extension if not exists pgcrypto;

create table if not exists public.functional_catalog (
  id uuid primary key default gen_random_uuid(),
  goal_key text not null,
  approach_key text not null,
  display_goal text not null,
  display_approach text not null,
  primary_concern text not null,
  secondary_concerns text[] not null default '{}',
  recommended_categories text[] not null default '{}',
  plan_intro_copy text not null,
  why_this_works_copy text not null,
  usage_guidance text not null,
  routine_slot text not null,
  default_frequency text not null,
  avoid_with text[] not null default '{}',
  hold_guidance text not null,
  next_guidance text not null,
  caution_level text not null default 'normal',
  is_active boolean not null default true,
  sort_priority integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint functional_catalog_goal_approach_key unique (goal_key, approach_key),
  constraint functional_catalog_goal_key_check check (
    goal_key in (
      'pores_texture',
      'oil_acne',
      'barrier_redness',
      'dehydration',
      'uneven_tone',
      'protection'
    )
  ),
  constraint functional_catalog_approach_key_check check (
    approach_key in (
      'exfoliation',
      'sebum_control',
      'retinoid_like',
      'soothing',
      'barrier_support',
      'hydration',
      'tone_care',
      'vitamin_c_like',
      'azelaic_like',
      'sunscreen_protection'
    )
  ),
  constraint functional_catalog_primary_concern_check check (
    primary_concern in (
      'barrier',
      'dehydration',
      'oiliness',
      'redness',
      'acne',
      'pores',
      'uneven_tone'
    )
  ),
  constraint functional_catalog_secondary_concerns_check check (
    secondary_concerns <@ array[
      'barrier',
      'dehydration',
      'oiliness',
      'redness',
      'acne',
      'pores',
      'uneven_tone'
    ]::text[]
  ),
  constraint functional_catalog_recommended_categories_check check (
    recommended_categories <@ array[
      'cleanser',
      'toner_essence',
      'toner_pad',
      'treatment',
      'moisturizer',
      'moisturizer_lotion_emulsion',
      'moisturizer_gel',
      'moisturizer_cream',
      'moisturizer_balm',
      'sunscreen'
    ]::text[]
  ),
  constraint functional_catalog_routine_slot_check check (
    routine_slot in (
      'am_prep',
      'am_protect',
      'pm_prep',
      'pm_functional',
      'pm_moisturize'
    )
  ),
  constraint functional_catalog_caution_level_check check (
    caution_level in ('low', 'normal', 'high')
  )
);

create table if not exists public.product_functional_map (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  catalog_id uuid not null references public.functional_catalog(id) on delete cascade,
  strength text not null default 'balanced',
  confidence text not null default 'medium',
  evidence_level text not null default 'manual_reviewed',
  evidence_note text not null,
  source_tags text[] not null default '{}',
  recommended_for_skin_types text[] not null default '{}',
  avoid_for_signals text[] not null default '{}',
  routine_slot_override text,
  frequency_override text,
  sort_priority integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_functional_map_product_catalog_key unique (product_id, catalog_id),
  constraint product_functional_map_strength_check check (
    strength in ('intro', 'balanced', 'intensive')
  ),
  constraint product_functional_map_confidence_check check (
    confidence in ('high', 'medium', 'low')
  ),
  constraint product_functional_map_evidence_level_check check (
    evidence_level in ('manual_reviewed', 'db_structured', 'review_supported', 'weak')
  ),
  constraint product_functional_map_skin_types_check check (
    recommended_for_skin_types <@ array['oily', 'dry', 'combination', 'sensitive']::text[]
  ),
  constraint product_functional_map_routine_slot_override_check check (
    routine_slot_override is null
    or routine_slot_override in (
      'am_prep',
      'am_protect',
      'pm_prep',
      'pm_functional',
      'pm_moisturize'
    )
  )
);

create index if not exists idx_functional_catalog_active_goal
  on public.functional_catalog (is_active, goal_key, sort_priority);

create index if not exists idx_functional_catalog_goal_approach
  on public.functional_catalog (goal_key, approach_key);

create index if not exists idx_product_functional_map_product
  on public.product_functional_map (product_id)
  where is_active = true;

create index if not exists idx_product_functional_map_catalog
  on public.product_functional_map (catalog_id, sort_priority)
  where is_active = true;

-- Reuse the existing project trigger style if this function is still canonical.
drop trigger if exists functional_catalog_set_updated_at on public.functional_catalog;
create trigger functional_catalog_set_updated_at
  before update on public.functional_catalog
  for each row
  execute function public.set_updated_at();

drop trigger if exists product_functional_map_set_updated_at on public.product_functional_map;
create trigger product_functional_map_set_updated_at
  before update on public.product_functional_map
  for each row
  execute function public.set_updated_at();

alter table public.functional_catalog enable row level security;
alter table public.product_functional_map enable row level security;

-- Policy/grant direction:
-- 1. Server-side premium generation reads these tables in v1.
-- 2. Do not expose direct anon/authenticated Data API access.
-- 3. Existing projects may have permissive default grants, so revoke them.
-- 4. Grant service_role only if the server helper needs direct table reads.
revoke all on public.functional_catalog from anon, authenticated;
revoke all on public.product_functional_map from anon, authenticated;
grant select on public.functional_catalog to service_role;
grant select on public.product_functional_map to service_role;
-- If admin review tooling needs writes, create a separate migration with
-- explicit service/admin write grants and policies.

commit;
```

Enum option:

- Postgres enum types give strict domain control but are harder to update when
  product taxonomy changes.
- Text plus check constraints are recommended for v1 because they fail closed
  and are easier to extend with ordinary migrations.
- If enum types are introduced later, keep them only for stable keys such as
  `functional_goal_key` and `functional_approach_key`, not for copy tags such as
  `avoid_with`.

RLS/API exposure note:

- Tables created in an exposed schema should have RLS enabled before they are
  reachable by client roles.
- Supabase Data API exposure and grants must be reviewed separately from RLS.
  Do not assume RLS alone exposes or hides the table in every project setting.
- First production implementation should query these tables from server-side
  premium generation code, not directly from the browser.
- Product functional mappings are operational curation data. Treat them as
  server-only by default even if the individual product records are public.

## Live Schema Audit Result

Audit date: 2026-07-01. Scope: read-only live Supabase SQL plus local
code/migration inspection. No DB writes were performed. Local Supabase CLI was
not installed in this workspace, so a separate local database schema query was
not performed.

Read-only SQL checked:

- `pg_enum` for `public.product_category`, `public.product_form`,
  `public.product_texture`, and `public.product_finish`.
- `information_schema.columns` for `public.products`.
- `information_schema.tables` for `functional_catalog` and
  `product_functional_map`.
- `pg_proc` and `pg_trigger` for updated-at trigger functions.
- `pg_constraint` and `pg_indexes` for `public.products`.
- `pg_tables`, `information_schema.role_table_grants`, and `pg_policies` for
  products RLS/grants.
- Distinct non-null `products.recommendation_tier` values.

Confirmed live `product_category` labels:

```text
cleanser
toner_essence
toner_pad
serum
ampoule
essence
moisturizer
sunscreen
moisturizer_lotion_emulsion
moisturizer_gel
moisturizer_cream
moisturizer_balm
treatment
```

Audit interpretation:

- `toner_pad` exists in live DB.
- `treatment` exists in live DB.
- Legacy enum labels `serum`, `ampoule`, and `essence` still exist in live DB.
  They remain compatibility/legacy values and should not become new canonical
  functional-plan categories.
- The user prompt examples `moisturizer_lotion` and `balm` do not exist as
  live enum labels. The live values are `moisturizer_lotion_emulsion` and
  `moisturizer_balm`.
- Historical local migrations reference `toner_pad` casts but do not visibly add
  the enum value. Live DB has the value, so migration work can proceed against
  live schema, but a future migration author should not assume the local
  migration history alone explains how it was added.

Confirmed products contract:

| Field | Live type | Nullable | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | no | Default `gen_random_uuid()`. FK target for `product_functional_map.product_id`. |
| `name` | `text` | yes | Display only. Do not infer functionality. |
| `brand` | `text` | yes | Display only. Do not infer functionality. |
| `category` | `public.product_category` | no | Enum. |
| `product_form` | `public.product_form` | yes | `serum`, `ampoule`, `essence`, `booster`, `peeling_solution`, `unknown`. |
| `skin_types` | `text[]` | no | Check allows `oily`, `dry`, `combination`, `sensitive`. |
| `concerns` | `text[]` | no | Live check allows core concerns plus `exfoliation`, `brightening`, `sebum`. |
| `texture` | `public.product_texture` | no | `watery`, `gel`, `lotion`, `cream`. |
| `finish` | `public.product_finish` | no | `fresh`, `natural`, `dewy`, `soft_matte`. |
| `irritation_risk` | `text` | no | Check `low`, `medium`, `high`. |
| `sensitivity_safe` | `boolean` | no | Treat as weak support, not decisive evidence. |
| `recommendation_tier` | `text` | yes | Operational/source tier strings; not the same as functional map `strength`. |
| `price_min` / `price_max` | `integer` | yes | Product display fields. |
| `buy_link` | `text` | yes | Exists. Use this instead of assuming `external_url`. |
| `image_url` | `text` | yes | Product display field. |
| `normalized_brand` / `normalized_name` | `text` | no | Unique index exists on `(normalized_brand, normalized_name)`. |
| `ingredient_signals` / `review_signals` / `market_signals` | `jsonb` | yes | Default `{}`. |
| `cleansing_profile`, `uv_filter_type`, `spf_value`, `uva_label`, `water_resistant_minutes`, `white_cast`, `eye_sting`, `pilling_risk`, `tone_up` | mixed text/int/bool | yes | Existing product-specific signal fields. |
| `balm_functional_tags`, `balm_usage_scope`, `balm_type`, `is_primary_moisturizer`, `balm_caution_tags`, `balm_research_confidence` | mixed text[]/text/bool | yes | Existing balm-specific signal fields. |
| `created_at` | `timestamptz` | yes | Default `now()`. |
| `updated_at` | `timestamptz` | no | Default `now()`. |

Columns explicitly not confirmed:

- `external_url` is not a live `products` column. Use `buy_link`, `source_url`,
  or `hwahae_url` depending on the product-source need.

Confirmed products constraints and indexes:

- `products_pkey` on `id`.
- `products_normalized_brand_name_key` unique index on
  `(normalized_brand, normalized_name)`.
- `products_external_unique` partial unique index on
  `(external_source, external_type, external_id)` when all three are present.
- `products_skin_types_allowed_check` allows only
  `oily`, `dry`, `combination`, `sensitive`.
- `products_concerns_allowed_check` currently allows core concerns plus
  `exfoliation`, `brightening`, and `sebum`.

Updated-at trigger audit:

- Live DB has `public.set_updated_at()`, `public.set_revisit_updated_at()`, and
  `public.set_candidate_promotion_reviews_updated_at()`.
- `products` uses trigger `trg_products_updated_at` with
  `public.set_updated_at()`.
- The migration draft should use `public.set_updated_at()` for the new
  functional tables unless a project-wide convention changes before migration
  writing.

RLS/grant audit:

- `products` has RLS enabled.
- `products` has a public read policy named `Public can read products` for
  `anon` and `authenticated`.
- `products` has `SELECT` grants to `anon` and `authenticated`; `service_role`
  has broad table privileges.
- New `functional_catalog` and `product_functional_map` should not copy the
  public products read model. They are operational curation data and should be
  server-only in v1: enable RLS, revoke `anon`/`authenticated`, and grant only
  the server role needed by backend premium generation.

Current-products snapshot audit:

- `sanitizeCurrentProducts()` stores `selected` as `category`, `status`,
  `productId`, and optional `useTime`/`satisfaction`.
- `buildCurrentProductsReport()` stores a thin selected `productSnapshot`:
  `id`, `brand`, `name`, `category`, `product_form`, and `image_url`.
- `buildPremiumCurrentProductsSnapshot()` can currently requery selected ids
  through `fetchCurrentProductSnapshotsByIds()` and attach richer snapshot fields
  from `products.select("*")`, including concerns, skin types, texture, finish,
  irritation risk, sensitivity flag, prices, and signal json.
- `/api/analyze` premium sanitizer may reduce saved snapshots back to the thin
  display fields. The production functional engine must therefore rehydrate
  selected product ids server-side for map matching instead of trusting saved
  snapshot richness.

Recommendation tier audit:

- Live `products.recommendation_tier` is free-form text with values such as
  `Tier1`, `Tier2`, `candidate`, `popular`, `recommended`, `core_barrier`,
  `pore_elasticity`, and other source/position strings.
- Functional map `strength = intro | balanced | intensive` is a separate
  Premium Functional Plan display/control concept. Do not infer it directly
  from `products.recommendation_tier`.

Functional table naming audit:

- `public.functional_catalog` does not exist.
- `public.product_functional_map` does not exist.
- Draft table names do not collide with live tables.

## Migration Blockers

No hard blocker was found in the read-only live schema audit.

Resolved prior concerns:

- `toner_pad` exists in live `product_category`.
- `products.id` is `uuid` with `gen_random_uuid()`.
- `products.buy_link` exists; `external_url` does not.
- `ingredient_signals`, `review_signals`, and `market_signals` are `jsonb`.
- `public.set_updated_at()` exists and is used by `products`.
- `functional_catalog` and `product_functional_map` table names are free.
- `(normalized_brand, normalized_name)` unique index exists.

Pre-migration checklist:

1. Use `public.set_updated_at()` in the actual migration draft unless the
   project owner chooses a different trigger convention.
2. Keep `recommended_categories` as `text[]` in v1 so legacy enum labels do not
   force canonical functional-plan behavior.
3. Keep `product_functional_map.goal_key` and `approach_key` derived by join in
   v1.
4. Revoke `anon` and `authenticated` on the two new tables unless a separate
   public client-read use case is approved.
5. Do not seed `product_functional_map` until real product evidence is manually
   reviewed.

## Safety Rules

- Never infer ingredients or functionality from product name or brand.
- Never infer `not_in_db` product functionality.
- Never treat `products.concerns` alone as evidence that a selected product is
  already a mapped active functional product.
- If a selected product has no active `product_functional_map`, treat it as
  `UNKNOWN` for current functional audit or as a generic product context only.
- In `HOLD`, do not use purchase-oriented CTAs.
- `ADJUST` and `REPLACE_CANDIDATE` must use wording such as "사용 방식 조절" or
  "다음 교체 시점 검토"; do not say the product is bad or must stop.
- Avoid diagnosis, disease treatment, or fear copy.
- `sensitivity_safe = true` is a weak product attribute unless supported by map
  evidence and current survey context.

## Implementation Stages

1. Approve this contract and decide text+check vs enum.
2. Verify live enum labels and products columns with read-only SQL, especially
   `product_category` values and `buy_link` vs external URL fields.
3. Create a forward-only migration file, but do not seed product mappings yet.
4. Seed the minimal `functional_catalog` rows.
5. Add read-side query helpers for catalog and maps.
6. Build `FunctionalPlan` from free survey/result data and catalog rows.
7. Build `RoutineAudit` as findings-first using selected product ids and active
   map rows.
8. Build `CandidatePolicy` and server-side candidate query.
9. Update Premium Functional Plan UI to consume the new engine output while
   preserving saved-report legacy fallbacks.
10. Manually review real products before inserting `product_functional_map` seed
   rows.
11. Add tests for `selected`, `not_using`, `not_in_db`, and `unanswered` paths.

## Risks and Deferred Items

- Product category enum inventory was verified against live DB on 2026-07-01.
  Re-run the read-only enum check before writing/applying the actual migration
  if the branch has aged.
- Historical migrations call `toner_pad` as `public.product_category`, but the
  visible enum-add migrations in this repository do not show where it was added.
  Live DB has the value, so this is no longer a hard blocker, but it remains a
  migration-history drift note.
- Existing current-products snapshot sanitization is inconsistent between the
  initial premium analysis payload and the full-report update path. The engine
  should prefer server-side rehydration by product id rather than relying on
  saved snapshots for functional matching.
- The current fixture-based UI has FunctionalPlan/RoutineAudit concepts, but it
  is explicitly not a production engine.
- Multilingual catalog copy is deferred.
- Product mapping seed requires manual evidence review and should not be
  generated from names, brands, or unsupported marketing assumptions.
