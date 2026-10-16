# S1-D TC-01 probe reuse / TC-02..05 four-case continuation (2026-10-16)

> Research-only, private real-human photo runner; **Draft PR only**. No human photo, local report, KEY2 or raw Provider response is committed or sent to CI. This document records user-supplied, redacted evidence separately from synthetic verifier results. No new live API call was performed by this code change.

## Operator-reported empirical boundary (never substitute for independent truth)

Local probe metadata name: `face_lab_s1d_v2probe_metadata_20261016_154640.json`. The operator supplied the following **metadata values in the handoff**; the actual file is intentionally not included in the repository or CI.

- `studyMode=v2_probe_one`, `providerCallsAttempted=1`, `outcome=PRIVATE_V2_PROBE_ONE_DIAGNOSTIC_ONLY`.
- `TC-01`: complete `stop`, **4,426** input / **1,972** output tokens, **14,695 ms**.
- `skinAnalysisEligible=true`, `v2AxisCount=7`, `v2ContractStatus=ELIGIBLE_SEVEN_VALIDATED`.
- All seven private axis diagnostics `valid=true, issues=[]`: three `present` and four `not_seen` states. The prior strict `not_seen` rejection did **not** recur in this single case.
- Face `status=available`, `faceAvailableFieldCount=19`; only availability and count were observed, not Face value equality.
- `nearTokenCap=false` at 1,972; hard cap 2,200, just **228 remaining output tokens**, **8 below** the 1,980-token (90%) warning threshold. This is not margin for reliable scaling.

**Correct conclusion:** TC-01 corrected v2 **structural preflight PASS**, **not** clinical/visible-cue accuracy, independent Human agreement, Face semantic parity or production approval. TC-02..TC-05 corrected live Provider evidence remains **PENDING**.

## Implementation / safety envelope

1. A new `v2_resume_four` runner mode requires a successful **one-call TC-01 probe report**, with matching study ID, case ID, seven validated axes, strict diagnostic PASS and independent Face metadata. Before the first paid call, the existing manifest verifier still loads and checks **all five** local photos, dimensions, duplicate image content, symlinks, path traversal, unwanted EXIF, consent attestation and KEY2-only execution conditions. This is a validation of current private photo input, **not evidence that the photo matches an earlier run**.
2. Calls exactly TC-02, TC-03, TC-04 and TC-05, in ID order, with one v2 request per case. At most **four new API attempts**, **zero v1 attempts**, **zero TC-01 requests**, **no retries**, no arbitrary per-caller variant or token-cap change. On any provider exception, fail closed immediately and preserve only whitelisted metadata of the partial run.
3. A private Windows PowerShell 5.1+ launcher first runs a zero-cost preflight, explicitly asks the operator to type `YES4`, receives KEY2 locally through a hidden prompt, and writes a one-time **attempt-lock** with atomic exclusive creation before the paid sequence. The lock is retained after errors, crashes, or partial runs. Never automatically remove or retry. Photos/metadata/key must live **outside** the repository.
4. A **local-only** merger validates both report versions, study IDs, fixed case set, privacy flags, TC-01 proof, four new complete cases, bounded categorical/numeric observations, safe state-specific null/zero contract, strict diagnostic consistency and duplication/missing-case resistance. Unknown Provider/source keys are deliberately discarded. A merged five-case metadata report reports **4 new calls + 1 reused call** separately rather than pretending to execute five new requests.
5. The historical v1/v2 comparison script accepts the new merged report and original 10-call report; comparative output is **aggregate counters only**. Cross-run image identity cannot be proved by unchanged size or dimensions. The historical failed single-call v2-only result is never imported.
6. CI tests are **fabricated JPEG headers and synthetic JSON**; they never use the operator's photos, keys or real Provider. This track does not alter production Unified Vision, prompt, Face/Style, score/Top Pick, DB, eligibility thresholds, API or web app runtime.

## Private Windows execution after verified CI

Use an extracted **PR #1340 branch workspace** with Node dependencies available as in the previous private test. Keep all operator artifacts outside this workspace. A PowerShell example (use actual private paths only locally):

```powershell
powershell -NoProfile -File .\scripts\facelab\skin\Invoke-PrivateV2ResumeFour.ps1 `
  -Manifest "C:\PRIVATE\cohort.json" `
  -PhotoDir "C:\PRIVATE\photos" `
  -ProbeReport "C:\PRIVATE\face_lab_s1d_v2probe_metadata_20261016_154640.json" `
  -BaselineReport "C:\PRIVATE\face_lab_s1d_metadata_20261016_134425.json" `
  -PrivateOutDir "C:\PRIVATE\results"
```

The launch must remain local and interactive. Successful output files: `face_lab_s1d_v2_resume4_metadata_*.json`, `face_lab_s1d_v2_merged5_metadata_*.json`, and `face_lab_s1d_v2_comparison_*.json`. Do not upload those files or any photographs to GitHub, a PR comment or Actions. Share only a deliberately redacted **aggregate** if needed. A lock or nonzero exit means **stop**, not rerun.

## Next gates

- **Contract:** validate seven unique visible axes, strict `not_seen` cue/area/reason, `unknown`/`unassessable` as abstentions, Skin-ineligible zero axes, and agreement between strict and private diagnostic. Do not interpret legacy v1 zero as absent.
- **Face parity:** compare historical v1, historical v2 and corrected v2 status/count. Face value equality and true Skin accuracy remain **UNVERIFIED/HOLD** even when those counts do not decrease.
- **Token budget:** present evidence shows 1,972/2,200 for TC-01 and historical 1,991/2,200 for one previous case. Review prompt duplication and JSON verbosity **offline only** before any candidate refactor. Modifying candidate prompt before the remaining same-version photo cohort would confound interpretation; token cap remains 2,200.
- **Human reference:** require at least two independent blinded raters per consented photo, each axis labeled present/not_seen/unassessable/unknown with assessability/evidence and confidence. Seal individual ratings before adjudication, retain disagreements/abstentions and define reviewer eligibility, access, withdrawal, deletion and privacy handling. Explicit consent for sharing with new raters is separate. No Human "gold" has been collected by this work.
- **Release:** accuracy, Style parity, production scoring, merge and deployment all **HOLD**. Security `node-forge` exception expiration is not waived.

Watchtower-Track: face-lab-skin
