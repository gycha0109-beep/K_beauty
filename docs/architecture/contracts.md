# Contracts

This file records the current payload contracts that are most likely to drift.
It is not a full API specification.

## Current-Products Contract

### Input Selection

Accepted shape:

```json
{
  "category": "treatment",
  "status": "selected",
  "productId": "product-id",
  "useTime": "both",
  "satisfaction": "okay"
}
```

Fields:

| Field | Required | Notes |
| --- | --- | --- |
| `category` | Yes | Must normalize to an accepted current-products category. |
| `status` | Yes | `selected`, `not_in_db`, or `not_using`. |
| `productId` | Only for `selected` | May also arrive as `product_id`. |
| `useTime` | No | `morning`, `evening`, `both`, or `occasional`. |
| `satisfaction` | No | `good`, `okay`, `unknown`, or `bad`. |

Treatment-family rule:

- `treatment` is preferred.
- `serum` and `ampoule` are accepted current-products compatibility categories
  today.
- `essence` is accepted by current-products today, but it is known category
  drift: DB direction maps it to `treatment + product_form`, while current app
  behavior still routes it through prep/toner behavior.
- `serum_ampoule` is a result/display or DB import/legacy mapping term. It is
  not in `CURRENT_PRODUCT_CATEGORIES` and is not accepted by
  `sanitizeCurrentProducts()` today.
- Do not treat `serum`, `ampoule`, `essence`, or `serum_ampoule` as new
  canonical DB categories.

### Product Snapshot

Safe current-product snapshot fields:

```json
{
  "id": "product-id",
  "brand": "Brand",
  "name": "Product Name",
  "category": "treatment",
  "product_form": "serum",
  "image_url": "https://example.com/image.jpg"
}
```

Rules:

- Snapshot fields are display/context fields, not a full product record.
- `not_in_db` selections must not include detailed fit claims.
- `not_using` selections are empty routine-slot markers.

## `/api/current-products/products`

Method:

- `GET`

Optional query:

- `category`

Success response:

```json
{
  "success": true,
  "fields": ["id", "brand", "name", "category", "product_form", "image_url"],
  "categories": ["cleanser", "toner_essence", "toner_pad", "serum", "ampoule", "essence", "treatment", "moisturizer", "sunscreen"],
  "products": []
}
```

Rules:

- Unsupported requested categories return `400`.
- Product rows are limited to the safe snapshot fields listed above.
- Today the endpoint returns `CURRENT_PRODUCT_CATEGORIES`, including `serum`,
  `ampoule`, `essence`, and `treatment`.
- `serum_ampoule` is not returned in the category list.

## `/api/analyze`

Method:

- `POST`

Input transport:

- `multipart/form-data`

High-level required inputs:

- `image`
- `skinType`
- `sensitivityLevel` or `sensitivity`
- `mainConcern` or first item in `mainConcerns`
- `cleansingFrequency`
- `texturePreference` or `preferredTexture`
- `postCleanseFeel` or `postWashFeeling`
- `afternoonState` or `afternoonSkinChange`
- `dislikedFeel` or `mostDislikedFeel`

Optional inputs:

- `mainConcerns`
- `environmentExposure`
- `whiteCastHate`
- `toneUpWanted`
- `makeupUse`
- `eyeSensitive`
- `outdoorExposure`
- `verySensitivePeriod`
- `currentProducts`
- `locale`

Representative high-level response shape:

```json
{
  "summary": "",
  "priority": {},
  "topPick": {},
  "alternative": {},
  "amFocus": "",
  "pmFocus": "",
  "routineStructure": {},
  "morning": [],
  "night": [],
  "warnings": [],
  "photoEvidence": [],
  "photoObservations": {},
  "surveyEvidence": [],
  "meta": {
    "schemaVersion": 1,
    "source": "skin-match-v2",
    "locale": "ko",
    "generatedAt": "ISO timestamp",
    "notice": "",
    "explanationSource": "openai",
    "photoEvidenceSource": "openai",
    "photoObservationsSource": "openai"
  }
}
```

Side effects:

- May create a premium report session.
- May set the premium report cookie.
- May set the write-access header.

Compatibility rules:

- Do not rename response fields without a schema-version plan.
- Do not let OpenAI choose, replace, reorder, rename, or invent products.
- Deterministic product selection remains the source of truth.
- Free result payload and premium report payload may differ in detail level, but
  treatment-family category meaning must stay consistent.
