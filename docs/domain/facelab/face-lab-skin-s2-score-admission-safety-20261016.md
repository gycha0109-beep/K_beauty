# Face Lab / Skin — S2-E adverse photo-evidence scoring safety preflight (2026-10-16)

> **Research-only Draft; no provider calls, no human photos, no production policy or recommendation changes.** This work extends #1322 on branch `face-lab/research-skin-photo-counterfactual-20261015`; the existing S1-A explicit axis contract (#1319) remains an unmerged prerequisite.

## Question and method

Before allowing v2 Skin evidence into actual recommendation scoring: does the **unchanged existing** `buildSkinMatchDecisionBundle` retain its survey/environment contributions, product candidate set and deterministic recommendation policy if a hypothetical **in-memory, conservative** photo evidence admission filter rejects untrusted Skin cues?

The verifier calls the real engine on frozen `fixtures/recommendation-metadata/products-v1.json` **164 products**, frozen `user-scenarios-v1.json` **12 questionnaires**, and **10 synthetic capture/evidence edge cases**. It runs **120 paired comparisons** (240 in-memory engine calls) and asserts, for each case, that the shadow photo score **never increases**, survey/environment and total-score conservation hold, the candidate product set stays identical, and unaffected cases preserve priority/Top Pick/ordering. Existing `compareSkinPhotoDecisions` applies these invariants and **does not modify the scoring engine**.

The capture/evidence cases are:

| Case | Condition | Hypothetical conservative filter |
| --- | --- | --- |
| Low-resolution redness | legacy numeric 5; redness `unassessable:low_resolution` | hold redness photo credit |
| Strong shadows | legacy redness 5/oiliness 4; both `unassessable:lighting` | hold both |
| Partial face | pores `unknown:unsupported`, redness 3 valid | hold pores; preserve supported redness |
| Filter | acne numeric 5; `unassessable:filter` | hold acne |
| Face can be examined, Skin ineligible | person-photo Skin eligibility false | no extra photo points on either path |
| Contradiction | legacy acne 5, scoped evidence acne 2 | hold acne |
| Supported evidence | redness 4/acne 3 with high-confidence matching cue | preserve photo credit and full recommendation |
| Scoped explicit negative | legacy redness 5, scoped `not_seen=0` | do not infer absence from legacy number; hold positive |
| Low confidence | redness 5 but model reports low | hold |
| Unknown photo status | numeric redness 5 but photo state unknown | hold photo credit |

The labels are **invented synthetic scenarios**, not dermatological interpretations of the user-supplied pictures TC-01…TC-05, not independently human-labeled reference truth and not evidence that a real user photo has a given condition. 10 cases ×12 scenarios = 120 pairs; counts describe **risk sensitivity**, not population accuracy or expected conversion/revenue changes. No person identifiers, original photos, Provider raw JSON, or face images enter GitHub or CI.

## Expected controls and outstanding authority

- The existing `skin-photo-counterfactual-core.mjs` allows a Skin axis photo bonus only if it has explicitly validated `present`, medium/high model confidence and consistent v1 numeric score. The shadow uses zero as **no hypothetical photo contribution**, not as a claim of clinical normality.
- Existing `uv` photo contribution is held because it has no validated photographic cue. Routine/functional/condition policies and sunscreen facts are unchanged.
- Even when the suite passes, the filter is **not approved for production**; no accuracy, fairness, calibrated confidence, Human truth or personalized safety conclusion can be drawn without an authorized real-photo v1/v2 cohort and independent reviewer agreement.
- Real-photo rights, depicted-person authorization, OpenAI transfer permission, retention/deletion and private-runner approvals are **not yet established** for the five local image files. The metadata-only rights gate on Draft #1332 remains fail-closed. Do not upload faces to GitHub Actions, GitHub Secrets, Git commits or raw Provider logs.
- Candidate v2 Vision prompt #1336 is experimental, model testing uses only temporary `OPENAI_API_KEY2`, and the 2,200 completion-token production bound is unchanged. S2-E score activation requires explicit owner signoff and separate rollout, security, actual product/Face parity and S5 acceptance.
- The #1208 Supply Chain advisory is an independent release blocker.

## Run

```sh
node scripts/facelab/skin/verify-face-lab-s2-photo-counterfactual.mjs
node scripts/facelab/skin/verify-face-lab-s2-score-admission-safety.mjs
```

Actual pass/fail and aggregated Top Pick/priority deltas must come from **exact-head CI logs**; no estimates are presented as measured results.

Watchtower-Track: face-lab-skin
