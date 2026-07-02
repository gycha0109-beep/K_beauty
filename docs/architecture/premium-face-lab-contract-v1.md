# Premium Face Lab Contract v1

## Responsibility Boundary

Face Lab and Skin Match remain separate systems.

- Face Lab is generated from the uploaded image plus locale through `/api/face-reading`.
- Skin Match is generated from photo evidence, survey answers, current products, and product data through `/api/analyze`.
- Skin Match survey answers, priority axis, skin score, current products, and recommendation results must not create, correct, or infer Face Lab results.
- The paid full report may place Face Lab next to the routine report as a companion section, but only with weak wording such as “use this alongside the skin-care direction.”

## Input Contract

Face Lab input stays limited to:

```js
{
  image: File,
  locale: "ko" | "en"
}
```

No Skin Match survey field, skin score, priority axis, currentProducts field, product recommendation, or routine result is added to `/api/face-reading`.

## Transport Envelope And Field Contract

`/api/face-reading` returns a transport envelope before any free or premium display adapter consumes the result:

```js
{
  status: "available" | "insufficient_evidence" | "unavailable",
  source: "vision" | null,
  failureReason: string | null,
  analyzedAt: string | null,
  data: object | null
}
```

When `status` is `available` or `insufficient_evidence`, `data.structured` may include item-level evidence contracts:

```js
{
  mood: {
    status: "available" | "insufficient_evidence" | "unavailable",
    source: "vision" | "derived_from_vision" | null,
    confidence: number | null,
    evidence: string[],
    unavailableReason: string | null,
    value: {
      primary: string,
      traits: string[],
      animalType: string | null
    } | null
  },
  color: {
    status: "available" | "insufficient_evidence" | "unavailable",
    source: "vision" | "derived_from_vision" | null,
    confidence: number | null,
    evidence: string[],
    unavailableReason: string | null,
    value: {
      palette: string[],
      directions: string[]
    } | null
  },
  style: {
    status: "available" | "insufficient_evidence" | "unavailable",
    source: "vision" | "derived_from_vision" | null,
    confidence: number | null,
    evidence: string[],
    unavailableReason: string | null,
    value: {
      hairDirections: string[],
      stylingDirections: string[]
    } | null
  }
}
```

Field values are available only when `evidence` contains actual Vision response paths and text. Default launch fallback values, including default mood labels, palette keywords, and style keywords, must not be inserted into `structured.*.value`.

## Premium Role

In the paid full report, Face Lab is display-only companion content:

- impression keywords read from the current image
- style expression direction worth emphasizing
- wording that can sit beside skin-care direction
- a bridge to makeup, hair, and styling exploration

It is not a new face analysis algorithm and it is not a product recommendation source.

## Display Shape

The premium-safe display shape is:

```js
{
  status: "available" | "unavailable",
  imageUrl: string | null,
  imageAlt: string | null,
  impressionTitle: string | null,
  impressionSummary: string | null,
  keywords: string[],
  styleDirections: [
    {
      key: string,
      title: string,
      summary: string
    }
  ],
  caution: string | null
}
```

`lib/premium-face-lab.js` adapts an existing Face Lab result into this shape. It does not call the model, does not generate a Face Lab result, and does not read Skin Match survey, score, or priority fields.

For new Face Lab payloads that include `data.structured`, the adapter must prefer structured `available` fields. It must not convert unknown legacy flat values or launch fallback values into a new available structured result.

`available` requires at least one real analysis display signal:

- non-empty impression title
- non-empty impression summary
- at least one non-empty keyword
- at least one valid style direction
- an equivalent non-empty text field from the existing raw Face Lab response shape

Empty raw objects and image-only payloads are not enough. These inputs resolve to `unavailable`:

```js
{}
{ base_data: {} }
{ features: {} }
{ base_data: {}, features: {} }
{ imageUrl: "https://example.com/image.jpg" }
```

## Fallback

If a photo or Face Lab result is missing, or if an older premium report has no Face Lab field, the section uses:

- `status: "unavailable"`
- no impression title, summary, keywords, style directions, or caution
- quiet copy explaining that the photo-based result is not ready

The rest of the paid report continues rendering.

## Sanitizer And Storage

The premium sanitizer allows only the premium-safe shape.

- `status` must be `available` or `unavailable`.
- `imageUrl`, `imageAlt`, `impressionTitle`, `impressionSummary`, and `caution` must be `null` or non-empty strings.
- `keywords` keeps non-empty strings only, up to 4.
- `styleDirections` keeps entries where `key`, `title`, and `summary` are all non-empty strings, up to 3.
- Unknown fields, objects used as text, arrays with invalid entries, numbers, booleans, `NaN`, `undefined`, and empty strings are not stringified into saved display data.

Premium report re-read uses the stored `faceLabSummary` when present, or adapts the current session Face Lab raw result passed to `/api/full-report`. Missing legacy data falls back to `unavailable`.

Read priority:

1. stored `premium_report.faceLabSummary`
2. request body `faceLab` adapted through the premium-safe adapter
3. stored legacy `premium_report.faceLab` adapted through the premium-safe adapter
4. `unavailable` fallback

If the stored `faceLabSummary.status` is already `available`, request body Face Lab data does not overwrite it and no write is needed.

If request body `faceLab` or stored legacy `faceLab` produces a valid `available` summary while stored `faceLabSummary` is missing or unavailable, `/api/full-report` may merge only the sanitized `faceLabSummary` back into the existing `premium_report_sessions.premium_report`. Other premium report fields, including `currentProductVerdicts`, `functionalDecisions`, and `conditionResponses`, are preserved by object merge.

Persisting uses the existing signed premium report session cookie and session row. If the session id cannot be verified through the existing premium session model, `/api/full-report` may still return a response summary but does not persist the derived Face Lab summary.

## Free And Premium Boundary

The free `/api/analyze` public response does not expose premium Face Lab details. Free result UI may continue to show its existing Face Lab teaser from the separate Face Lab flow, but paid-only display shape stays inside the full report path.

## Exclusions

Face Lab paid display must not add:

- physiognomy, fortune, destiny, or personality certainty
- attractiveness scoring or appearance criticism
- health, disease, treatment, prescription, or medical judgment
- product recommendation, product ranking, price, store link, purchase CTA, or payment logic
