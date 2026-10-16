# Face Lab Skin — S1-D private v2-only correction research follow-up (2026-10-16)

> Research-only, Draft, **NOT a provider real-photo rerun or proof of correction**.
> 2026-10-16 prior actual user-attested five-photo data: **10 KEY2 calls**, v1 5/5 structurally valid; v2 has three eligible Skin contracts partially invalid, one fully valid eligible Skin photo, one intentionally Skin-ineligible empty-axis abstention; eight raw `not_seen` in eligible cases normalized into `unknown`. See the metadata-only aggregated audit in this research branch. Original cue/area/reason strings were not retained and **cannot** be inferred.

## What is implemented (no new paid calls)

- `skin-private-axis-contract-diagnostics.mjs`: offline validator for a **transient future v2 Provider response**, with only canonical Skin axis IDs and **closed-field failure codes** for `row_shape_invalid`, `value_state_mismatch`, `target_cue_missing_or_invalid`, `inspected_area_missing_or_invalid`, `reason_state_mismatch`, `confidence_state_mismatch` etc. It does **not** save or echo any `cue`, `area`, `reason`, free-text evidence, filename, face features, person, image or Provider JSON. It compares diagnostic validity with the existing unchanged strict S1-A validator and fails closed on any disagreement. The model's confidence enum is not a calibrated probability. All tests use **fabricated synthetic objects**.
- `runPrivatePhotoCohort` now has an allowlisted `studyMode="v2_only"` in addition to the original default `paired`; the second mode makes **at most FIVE** requests total, one corrected research-only v2 per photo, **never re-runs v1**, never retries, and is not invoked during CI. The local source bytes get the same metadata sanitization, exact dimensions/duplicate checks, CI-process hard ban, KEY2-only authorization and 2,200 completion token cap before any billable call.
- Explicit `--live-private-v2-only` CLI switch. Preflight-only `--validate-private-cohort` is still zero-cost and keyless; no production route, shared Vision/Face/Style prompt, live scoring, DB, PR CI workflow or existing safety limit changes.
- **Separate historical comparison:** `compare-skin-private-v2-correction.mjs` takes two private metadata-only reports, original 10-call paired baseline and newly generated 5-call v2-only correction. It rejects different study IDs, wrong/missing cases, incorrect request counts, non-private-storage flags or altered short-side dimensions. Output contains **aggregates only**: Skin eligible structural pass/hold counts, raw vs validated `not_seen` counts, expected ineligible zero-axis abstention count, near cap, Skin-eligibility transitions, Face status/count loss versus original v1/v2. It cannot prove physical image identity between trials; a retained short side is not a unique image fingerprint.
- The comparison's exact face-value parity, Skin truth and independent Human reviewer consensus are always explicitly `false` or `unverified` regardless of passing structural metrics. Historical v1 data is only used **locally** to compare bounded statistics; no source photos, raw text, hashes or person IDs are placed into GitHub.

## How future authorization should work

1. A future **user-initiated** Windows opt-in (not CI) reuses the already-downloaded private photo/manifest and existing private result file; validates the untouched five-photo set and original same-study 10-call metadata before prompting for a KEY2.
2. Confirmation must explicitly state **five additional billable OpenAI Vision requests**, not 10, and show that **v1 is not called again**. The Windows launcher should show a secure key prompt on the local machine, never send the key in ChatGPT, and stop without uploads or fees if validation fails.
3. After five v2 calls, save a private metadata-only JSON locally. Compare it to the original private 10-call report, output only bounded aggregate diagnostic JSON, and review Skin contract failure codes. Any deficits, unexpected ineligibility, near-cap, Face count reductions or incomplete calls remain research **HOLD**.
4. Ask for additional owner/user action **only once private code and CI validations are complete**, and no human face photo is ever submitted to GitHub/Actions. The user's existing consent is only their attestation; actual photographic rights documentation and permission for separate independent human reviewers remain unverified.

## Permanent boundaries

- A passing v2-only structural result would **NOT** establish accurate Skin observations, patient health condition, Face *value* parity, Style parity or eligibility for personalized score/ranking. The independent two-blinded-rater Human cue reference must be collected and adjudicated separately under appropriate person-specific permission; the existing S1 cue accuracy/evaluation and S2-E score admission gates cannot be bypassed.
- The production shared Vision model/prompt, Face/Style, recommendation engine, Top Pick, database/API, security advisories and releases remain unchanged. The expired `node-forge` `GHSA-86w9-cpqp-85rv` security exception remains its own blocker. No merge/deploy without owner authorization.
- **Exact number of new real-photo Provider calls caused by this implementation and CI: zero.** All automated checks are mock/synthetic only.

Watchtower-Track: face-lab-skin
