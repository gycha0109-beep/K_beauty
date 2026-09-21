# Full Report presentation IA (2026-09-21)

Baseline: `origin/main` 2cfcdc0cdaa34ced035dd0f65898e27389ec9baf.

## Scope and authority

UI-only five-sector navigation: Today / Current routine review / Issue tracking /
Next change plan / Situational care. The old standalone caution sector is removed;
stored warnings appear next to routine steps, the change usage guide and condition care.
Face Lab, API fields, persistence, authentication and deterministic policies are unchanged.
Existing route, savedReportId replay and Premium Intake submission are retained.

| View | Stored source | Display boundary |
| --- | --- | --- |
| Today | functionalPlan.routineGuide.weeklyAction, functionalRoutineAudit, currentProductVerdicts | Effective saved action; skin guidance and product evidence are separately labelled. No new risk ranking. |
| Routine | routinePlan morningSteps/nightSteps; legacy buildRoutineConsultSteps fallback; currentProducts and currentProductVerdicts | Step state and product verdict remain separate. Selected products are not replaced by recommended step candidates. |
| Tracking | premiumIntake stepStates/answers, currentProductVerdicts | Recent changes/reactions are answers, not causation. Skipped/unknown preserved. No dates, frequency history, causal ranking or observation period are invented. |
| Change | existing functional display adapter, saved functionalPlan/routineGuide, audit findings | One candidate initially visible; alternatives/evidence collapsed. No new START verdict for legacy snapshots. Missing routine guidance stays missing. |
| Situations | conditionPlan.responses or existing conditionResponses | Every stored response is kept, grouped by maintain/reduce/avoid_for_now. Unrecognised states remain visible separately. Return/escalation criteria retained. |

decisionFocus only highlights an existing sector. No new focus enum is introduced.
Counts denote **saved verdict slots**, not unique products (AM and PM may differ).
Replacement/removal has no dedicated saved verdict: explicitly unavailable, not inferred
from hold. Missing candidate/causal evidence renders an information-needed state.
The presentation does not regenerate old reports.

Completion shows saved only for persistence saved/existing plus savedReportId;
link copy, My navigation and feedback are preserved. The former input summary is
distributed into tracking response states and the hub's focus highlight.

## Visual system

ReportUI.module.css scopes ivory/pink surfaces, serif headings, rounded cards,
timeline/decision flow, mint/orange/pink/purple semantic tones and rose/burgundy CTA.
Existing theme preference is honored: dark mode has separate plum surfaces and
contrast tokens, including toned-down decorative imagery. No forced light root.
Mobile widths 390/430 and desktop 1448 are exercised by the browser verifier.
The existing shared authentication/menu remains; no fake search action is added.

`public/images/full-report/rose-serum.webp` is decorative, never product evidence.
Generated with imagegen from this brief: unbranded pale blush glass dropper bottle,
tilted right, three bubbles, pearlescent pink cap, ivory/pink studio light, no text,
logo, UI or frame; fade ivory edges. Optimized to 480px WebP. Actual candidates
use SafeProductImage or an explicit missing-image placeholder.

## Verification and limitations

`scripts/verify-full-report-final-ui.mjs` uses local-only intercepted saved-report
fixtures. It checks all five pages, AM/PM, keyboard candidate expansion, all condition
entries, replay without regeneration, persistence controls, unknown/hold/empty/legacy,
KO/EN and light/dark at three widths; screenshots are in ignored
`_local_data/full-report-final`. This is not authenticated hosted end-to-end evidence.
One pre-existing development root-layout nonce hydration warning is narrowly allowed;
other runtime errors fail the verifier.

Local `npm run lint` cannot run unattended: the repository has no configured root
ESLint setup. Node 24 rejects the health script's experimental-default-type flag;
Node 22 reaches Windows spawnSync npm.cmd EINVAL. CI's Node 22/Linux health check
remains the canonical whole-repository gate. Frozen corpus CRLF checkout bytes were
normalized locally to the exact expected LF hash; no engine/hash contract changed.

Ghost-code review: new sector components have real route callers. Existing unused
legacy helper definitions in the large route are not newly exposed or used as fallback;
their broader cleanup is deliberately outside this presentation change.
