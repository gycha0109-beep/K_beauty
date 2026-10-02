# Face Lab V2 G-E2B Private Review Board v1

> Track: Face Lab / face-research
> Gate: G-E2B Human Review
> Surface: local development only
> Production exposure: prohibited

## Purpose

The board reduces the remaining manual calibration work to visual judgment only.

It opens a locally persisted provider-pilot campaign under the ignored `private/` boundary, displays the exact Before and Simulation pair, and reuses the existing Gate G review panel for:

- Identity Preservation,
- Edit Scope,
- Route Adherence,
- Color Fidelity.

No default PASS responses are supplied.

## Local-only boundary

The page and review API are disabled when `NODE_ENV=production`.

Image bytes are never posted to the review API. The browser reads source/output files from the selected local campaign directory and writes reviewed artifacts back to that same directory.

The API receives structured analysis/state/review responses plus MIME metadata only. It invokes the canonical G-C/G-D builders and the existing Pilot Capture builder.

## Real case ID and Windows filenames

Logical review case IDs may contain a colon, for example:

`face-lab-review:<uuid>`

The logical case ID remains unchanged in evidence. Private artifact filenames encode the colon as `%3A` so the files remain valid on Windows.

## Review output

Submitting one case writes:

- case-scoped source image copy,
- case-scoped simulation output copy,
- G-C Identity/Edit Scope review JSON,
- G-D Route/Color review JSON,
- Pilot Capture evidence-input manifest,
- Pilot Case run spec.

The run spec derives `changeIntensity` from the frozen survey `changeTolerance` and uses `routeSelectionState=user_selected`.

## Campaign closeout

After all eight reviews are complete, run:

`node scripts/run-face-lab-v2-g-e2b-private-campaign.mjs <campaign-folder>`

The batch runner requires exactly:

- four intent groups,
- generations 1 and 2 for each group,
- eight reviewed run specs.

It invokes the existing Pilot Case Runner for every case, then builds the G-E2C campaign aggregate. It performs no provider or network call.

A completed Human Review response of `not_assessable` remains a legitimate Human Review observation. The batch runner does not force a replacement judgment. Instead:

- calibration-admissible cases enter the normal aggregate,
- not-assessable cases remain outside Calibration Case admission,
- their four-axis status summary and review findings are carried into `campaign.closeout.json`,
- any hard failure prevents the not-assessable exception from being used,
- G-E2C decides between failure attribution and protocol freeze from the combined closeout.

This preserves the strict Calibration Case contract without treating `not_assessable` as unfinished Human Review.
