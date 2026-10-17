# [Face Lab / Skin] S1-D blind Human-review bridge — synthetic implementation only

**2026-10-17 · Draft research · no actual reviewer labels, photos, keys, Provider calls or deployments.**

## Why this exists

The 2026-10-16 privately collected **TC-01..TC-04** corrected-v2 cohort achieved **4/4 eligible Skin seven-axis structural contracts**, 28/28 diagnostic axes; historical v2 was 1/4. These are operator-reported **structural** results, not verified visible-cue accuracy. TC-05 is an intentional Skin-ineligible exception, **excluded only from the normal-path denominator**; its attempted provider call truncated and is retained in the historical private log, not described as a success. Partial-face TC-04 returned a conservative Face `unavailable` even though Skin was eligible. Root cause and Face value parity remain unknown.

The repository already has **S1 cue metrics** (`skin-cue-evaluation-core.mjs`) and **independent reviewer agreement** (`skin-human-annotation-agreement.mjs`) in Draft #1310. This additional bridge prevents normal-path model metadata being silently treated as independent truth. **It does not collect Human labels.**

## Private offline inputs

1. Corrected-v2 **model prediction** JSON, locally produced using the existing private diagnostic kit (`skin-track3-s1d-model-predictions-v1`, exactly TC-01..04 × seven explicit axes; `{state,value,confidence}` only). **Do not commit or paste per-person model predictions to GitHub**.
2. Two independently collected, genuinely blinded review JSONs (`skin-s1d-blind-review-v1`, reviewer IDs `A` and `B`, seven human **visible cue** labels per case). Neither reviewer must see model predictions or the other's labels. Individual permissions for reviewer access to faces and deletion/retention controls are separate prerequisites; user attestation for OpenAI Provider is not reviewer-sharing consent.
3. **Verified** capture-tag JSON (`skin-s1d-capture-tags-v1`, exactly four case IDs, one or more allowed existing `SKIN_CAPTURE_TAGS`). The bridge does not guess lighting, angle, baseline session or device. Example *synthetic-only*:

```json
{"schemaVersion":"skin-s1d-capture-tags-v1","cases":[{"caseId":"TC-01","captureTags":["baseline"]},{"caseId":"TC-02","captureTags":["baseline"]},{"caseId":"TC-03","captureTags":["low_resolution"]},{"caseId":"TC-04","captureTags":["skin_occluded"]}]}
```

The example above is **not** actual capture metadata and must not be copied as real-case labels.

## Mapping & failure policy

- Only verified *explicit corrected v2* `present(1..5)` → visual cue prediction `present`, `not_seen(0)` → visual cue prediction `absent`. Legacy v1 `0` is never interpreted as absence. `unassessable/unknown(null)` → `abstain`.
- Two Human labels *exactly agree* → retain as provisional reference. Human disagreement → no auto-adjudication; excluded from model accuracy denominator and included in reviewer agreement/disagreement report. Both agreeing the image is unassessable retains null reference, records an unsupported assertion if model claims `present` or explicit `not_seen`; this is not a negative label.
- No reviewer labels, no valid capture tags, unexpected keys (images/URLs/names/clinical data), missing axes, mislabeled case IDs or malformed states → fail closed. No fabricated Human truth or unverified tags.
- Output remains **aggregate metadata-only** (including opaque `TC-xx:axis` disagreement identifiers) and explicitly marks reviewer independence, Human truth/clinical validity and production authorization as unverified. Existing S1 `evaluateSkinCues` always reports `realPhotoAccuracyCertified:false`.
- The 4-case sample is too small and non-representative for product-level error rates; repeated captures, full Face parity, independent adjudication and S2/S5 owner approval remain separate gates.

## Local-only command (when inputs exist)

```
node scripts/facelab/skin/run-skin-s1d-blind-review.mjs PRIVATE-model.json PRIVATE-review-A.json PRIVATE-review-B.json PRIVATE-tags.json anonymous_s1d
```

No Provider/API key/photo bytes are required by this evaluator. Raw files stay off-repository; only reviewed, safe aggregate findings may appear in public docs. No baseline or TC-05 re-run is authorized.

## Verification

```
node scripts/facelab/skin/verify-face-lab-skin-s1d-blind-bridge.mjs
```

Synthetic negative cases cover missing/duplicate/extra cases, unexpected image/path fields, malformed abstain `null`, conflicting Human labels, TC-05 inclusion, unverified tags, all-disagreement and no observed Human cues. The new script is **not wired to current-main CI or production until this Draft PR receives independent verification**. Existing #1310 tests remain authoritative for rates and agreement formulas; the bridge deliberately does not reimplement them.

**Research gates:** S1 real-photo reliability **HOLD** until true separate raters and relevant permissions; S2-E actual score admission **HOLD**; Provider/Face/Style/recommendation engine/API/DB/Auth/RLS/storage unchanged; merge/release/SCA #1208 **HOLD**. Research PR is stacked on unmerged #1310 and must not merge separately.

Watchtower-Track: face-lab-skin
