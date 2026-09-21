# Full Report: four-sector presentation

Baseline: fresh `origin/main` `5e607fb26afca3aee5a708e84929d82341dfd713`.

Resumed remote check: `87dd552f8eb19a72f6924634afbfe7309e284e60`; no overlap in the UI, projection, direct authority or package/config files. The unpublished task commit is rebased onto that current main before PR publication.

The user-supplied four-phone composition is the visual authority. Its example products, counts, dates and reactions are not data. Face Lab remains a separate, unchanged experience. The overview remains an entry point, followed by exactly four detail sectors:

| Sector | Interaction | Read authority |
| --- | --- | --- |
| 현재 루틴 점검 | AM/PM ordered list with expandable evidence | `routinePlan`, current selections, saved product verdicts |
| 문제 추적 | Signals and investigation list | answered intake context and saved verdicts |
| 다음 변화 플랜 | 2×2 matrix and conditional sequence | `functionalPlan`, findings, audit, product verdicts |
| 상황별 대응 | Payload scenario selector and routine comparison | `conditionPlan.responses`, legacy `conditionResponses` |

## Boundary

`lib/full-report-view.js` only joins saved records and orders display items. It never invokes a decision engine. Top-level projections retain their existing precedence over the bundle fallback; explicit empty arrays remain authoritative. No changes to persistence, authentication, public field names, recommendation ranking, policy calculations or database contracts are required.

- Product joins support canonical two-part and legacy three-part verdict keys. A stored product ID never falls back to a different product in the same category.
- Routine step guidance is shown separately from a product verdict. Missing product verdicts remain unknown. `not_in_db` means in use with incomplete product evidence; `not_using` and unanswered stay distinct.
- Routine categories are associated with the already-projected step role for display only. Stored `useTime` filters association; absent timing is labeled unrecorded, never replaced with the selected AM/PM tab.
- Investigation ordering is an attention order (hold, information check, adjustment), not a causal ranking. Counts are explicitly verdict-slot counts. AM/PM may contain two verdicts for one product.
- Matrix rows combine the same identified selection and same verdict status across AM/PM. Both original verdicts remain in the disclosure. Different verdicts are never combined.
- Candidate exposure requires saved START and no suppression. HOLD and unknown never expose candidates. The existing legacy display adapter is used only with an actual recognized saved leading decision; missing decisions do not inherit its default START. Legacy decisions remain readable in evidence.
- Conditional plans use saved `routineGuide` and `reviewCondition`; no elapsed-day schedule is synthesized. Canonical review text may itself contain a duration.
- Warnings stay beside routine evidence, plan combinations and scenario recovery/escalation criteria. The standalone caution sector and its now-unused template helpers were removed.

## Additive condition projection

`premium-condition-projection.js` copies `maintainRoles`, `pauseRoles`, and `reduceActions` from the selected canonical scenario without changing values. It copies `reduceRoles` only when present. Current canonical policy uses **reduceActions**, not reduceRoles; these are not aliases. The existing projection version and policy remain unchanged because this is additive view evidence, not a policy revision.

The routine comparison puts stored AM/PM steps beside the canonical role/action changes. It does not mark an individual product as causal or assign a product-specific stop decision. Older saved payloads without role evidence keep their existing action text and explicitly lack a role diff. No saved report is backfilled or re-evaluated by the UI.

`premium-condition-response-contract-v1.md` describes the older response adapter; its topic/rule examples are not substituted for the current canonical policy. This extension is governed by the executable `condition-policy.js` and `premium-condition-projection.js`.

## Theme and navigation

Both themes share one DOM, order and interactions. `ReportUI.module.css` defines the report palette under the existing `html.dark` theme switch. Product imagery uses the existing safe image component; absent imagery is a bottle placeholder, not a fabricated product photo.

The existing overview, Face Lab entry, current-product intake and saved-report route remain. Section buttons, the routine CTA and previous/next actions traverse the four sectors. The last CTA opens My; its label now describes that existing navigation rather than claiming a new save.

Validation and limitations: [verification record](../verification/full-report-four-sector.md).
