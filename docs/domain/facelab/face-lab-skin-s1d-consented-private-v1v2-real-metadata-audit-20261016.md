# Face Lab / Skin S1-D — Consented private real-photo v1/v2 metadata audit (2026-10-16)

> **Evidence type:** real OpenAI Provider execution against five user-attested human photographs, **aggregated metadata only**. Source is the user's privately supplied `skin-private-v1v2-cohort-v1` local report. No photo, face content, raw Provider response, file pathname, photo SHA/digest, skin numerical score by individual, identity, credential or per-case user profile is published in this GitHub document.
>
> **Research-only verdict:** `BLOCKED_OR_INCOMPLETE` for candidate adoption. The actual shared production Vision/Face/Style and recommendation score/ranking remain **unchanged**. This is **not** evidence of accurate human skin diagnosis, human reference agreement, production readiness or consent-document independent verification.

## Cohort and actual run evidence

- The user expressly attested photograph source rights, depicted-person authorization and external OpenAI transfer consent in chat. Supporting rights documents were not independently inspected.
- Five opaque local cases were each sent once to the **existing v1** and once to the **experimental v2** prompt using a user-entered `OPENAI_API_KEY2` in a private Windows process. **10 of 10 requests attempted**. Exported private runtime metadata reports `humanPhotoSentToProvider=true`, `gitHubActionsUsed=false`, `rawOutputsPersisted=false` and `photosSavedByRunner=false`. These are runner self-reported safeguards, not independently audited network/server retention claims.
- All **10/10** responses report `finishReason=stop`, `responseComplete=true`; **0** `length` truncated, **0** at-or-over 2,200 completion tokens.
- v1 legacy structural gate: **5/5 pass**.
- v2 overall eligible-photo structural gate: **1/5 pass**, 4/5 marked invalid in **legacy gate counting**. However, that aggregate conflates three eligible failures with one *intended Skin ineligibility abstention*. Under the research-only split: **4/5 Skin eligible (1 valid, 3 contract failure), 1/5 Skin ineligible (0 axes as required)**. The ineligible case's Face still eligible and Face analysis preserved; do **not** claim "Skin valid seven axes" for it.
- Four **eligible** v2 images returned exactly seven Skin axes; one **ineligible** v2 image returned **zero Skin axes** as instructed. No axis-count omission is demonstrated on eligible cases.
- The user's raw private metadata `v2Axes` contains **16 `present`**, **8 `not_seen`**, **3 `unassessable`**, **1 `unknown`** across the four eligible images. The validated `skinAxisStates` were **16 `present`**, **0 `not_seen`**, **3 `unassessable`**, **9 `unknown`** across those four (the ineligible photo adds seven blocked unknown placeholders). Thus **all eight raw `not_seen` were invalidated as `unknown`**, leading to the three Skin eligible failure cases. The original safety contract for `not_seen` requires *explicit inspected canonical cue, visible area, value zero, medium/high confidence and reason `none`*. The sanitized metadata omits cue, area and reason, so **the precise failing field cannot be recovered from this report**; a cue/area/reason mismatch is a strong hypothesis, **not verified**.
- Face **status regression 0/5**, **available-field-count regression 0/5**; summary says `faceBaselineUnassessable=0`. Face statuses were matched across pairs, with v2 showing one additional Face available field in one pair; this verifies **status/count parity only**, not equality of Face values, fine-grained quality, human truth or Style independence in production.
- One v2 completion consumed **1,991/2,200 tokens**, exceeding the configured 90% (1,980 tokens) early-warning level. **1/5 near cap**; not truncated. Even if all Skin rows had been valid, this headroom warning would still block full candidate preflight.

## Measured token and latency summary

| Local research traffic only | v1 five calls | v2 five calls |
| --- | ---: | ---: |
| Input tokens | 15,516 | 19,841 |
| Output tokens | 7,073 | 8,924 |
| Elapsed milliseconds (sum) | 59,226 | 68,233 |
| Mean elapsed seconds/request | 11.845 | 13.647 |
| `finishReason=stop` | 5 | 5 |

Observed v2-v1 deltas: input **+4,325 tokens (+27.9%)**, output **+1,851 tokens (+26.2%)**, sum of elapsed times **+9.007 sec (+15.2%)**. This is a **single five-photo convenience cohort** under sequential separate calls, not an independent controlled benchmark. **Do not infer model speed, prompt efficiency, clinical accuracy, or real bill** from these differences. Billed USD requires current actual project pricing and account usage receipt; no pricing assertion here. Total trial token usage is **35,357 input + 15,997 output tokens**.

## Contract / policy defects and research-only fixes

1. **Confounded "invalid" aggregation.** Prior `skin-vision-v2-provider-evidence-gate.mjs` required `skinStatus=ready` even for Skin-ineligible photo, so one intentional empty array appeared among "v2 invalid" reports. A backward-compatible boolean `expectedIneligibleAbstention` and split counters `v2ExpectedIneligibleAbstentions` / `v2EligibleStructuralFailures` now disambiguate without declaring ineligible outputs Skin success or loosening release gates. Private runner adds explicit `EXPECTED_SKIN_INELIGIBLE_ABSTENTION_RESEARCH_ONLY` case verdict. Both `structuralCandidatePass` and production/score release remain **false**.
2. **`not_seen` row instructions may be ambiguous.** Existing strict checker must *not* silently relax `cue`, `area` or `reason`, because numerical `0` cannot mean genuinely inspected negative without evidence. Experimental v2 prompt now explicitly defines canonical `cue` as the **target inspected, NOT evidence of presence**, requires inspected `area` and `reason=none` for `not_seen`; otherwise emits `unknown/unassessable` with null cue and area. Synthetic regression verifies compliant versus invalid negatives, and expected ineligible abstention. **No new billable human-photo v2 run has verified this correction.**
3. **No access to original failure subfields.** The on-device metadata report intentionally saved no cue/area/reason raw text. The prior Provider response cannot be reconstructed. Only a new separately consented **private** observation could verify the field-specific mismatch; do not fabricate it.

## S1-D next requirements, no production activation

- Do not run additional real faces in GitHub Actions, upload individual photos/metadata to GitHub, or modify the production key. Use only the private locally injected KEY2 for any future owner-authorized photo call.
- Independently human-label visible cues with at least two blinded raters, resolve disagreement and evaluate validity of `present`, `not_seen`, `unassessable` decisions, especially shadows/underexposure and limited-face cases. High model confidence is not ground truth.
- Independently confirm operational Face/Style parity beyond status/field count, v2 completion-token headroom and S2-E score impact **before** approving any actual scoring/ranking. Unmerged research stacked PRs must not be deployed.
- Keep independent node-forge advisory `GHSA-86w9-cpqp-85rv` and earlier SCA exception gate as release **HOLD**.

Watchtower-Track: face-lab-skin
