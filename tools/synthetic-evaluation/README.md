# @bejewely/synthetic-evaluation

Synthetic Evaluation Toolkit is the non-production workspace for generating, importing, observing, judging, promoting, orchestrating, reviewing, and reporting synthetic evaluation assets for Bejewely Face Lab and Skin Match.

## Production boundary

- The production application must not depend on this toolkit.
- The toolkit does not change production routes, UI, database behavior, or Provider runtime.
- Shared contracts are consumed through `@bejewely/face-contracts`.

## Responsibility flow

```text
Generation
→ Candidate Import
→ Observation
→ Judgment
→ Promotion
→ Pilot Campaign
→ Review / Export / Report
→ Locked Dataset
```

Generation intent is not an observed label or ground truth.

## Toolkit Track #T2

Implemented:

- exact `DraftGenerationSpecV1` validation
- deterministic spec and prompt digests
- Gemini and GPT manual prompt profiles
- SDXL reference-only profile
- A/B/C/D skin-control fixtures
- Provider execution disabled

Design and decisions:

```text
docs/generation-contract-prompt-compiler-v1.md
docs/adr/0001-generation-spec-identity-and-policy-registries.md
docs/adr/0002-generation-compiler-implementation-resolution.md
```

## Toolkit Track #T3

Implemented:

- exact candidate import request validation
- synthetic-only and rights-review attestation
- safe relative paths and symbolic-link rejection
- PNG, JPEG, and static WebP inspection
- immutable raw object and lossless canonical PNG storage
- logical verification and retention of #T2 spec/prompt artifacts
- SHA-256 asset and candidate identities
- dHash64 duplicate-neighbor reporting
- dry-run with zero persistent writes
- single-candidate manifest-last confirm
- idempotent retry preserving the original registration time
- visible external mark warning with unverified provenance
- blinded T4 observation projection

Commands:

```bash
npm run synthetic:import -- --request .synthetic-local/requests/import-0001.json --dry-run
npm run synthetic:import -- --request .synthetic-local/requests/import-0001.json --confirm
```

## Toolkit Track #T4

Implemented:

- source-addressed semantic observation contract snapshot
- Toolkit-owned strict validator and normalizer for the pinned Vision/Face Lab contract
- process-level blind candidate input
- canonical asset path and SHA-256 preflight
- explicit adapter profile and model allowlist
- Provider-free fixture replay
- bounded OpenAI transport with one image attempt and no retry
- immutable execution claim before Provider dispatch
- content-addressed observation object and manifest-last run publication
- explicit replicate ordinals
- valid ineligible observations separated from Provider/contract failures
- fixture-only results blocked from judgment handoff
- raw Provider response, image copy, base64 artifact, and absolute-path retention prohibited

Commands:

```bash
npm run synthetic:observe -- \
  --request .synthetic-local/requests/observe-0001.json \
  --preflight

npm run synthetic:observe -- \
  --request .synthetic-local/requests/observe-0001.json \
  --execute \
  --api-key-env OPENAI_API_KEY
```

`--api-key-env` must be named explicitly for `provider_bounded` execution. The toolkit does not search for credentials automatically. Fixture replay requires no credential and is never authoritative for judgment or promotion.

Design and decisions:

```text
docs/observation-adapter-v1.md
docs/observation-adapter-implementation-v1.md
docs/adr/0005-observation-contract-snapshot-and-blind-execution.md
docs/adr/0006-observation-execution-claim-and-authority.md
```

## Toolkit Track #T5

Implemented:

- authoritative T4 artifact verification before assignment issue
- process-level blind assignment, submission, and consensus modules
- strict pseudonymous human-review contracts with no free-text notes
- immutable claim, content-addressed submission, and manifest-last registration
- minimum two independent reviewers and explicit intent-blind adjudication
- purpose-free per-axis consensus with `sealed_complete` and `sealed_partial`
- finalized `GenerationSpec` and T3 candidate identity verification after sealing
- purpose-required gate/target selection with no aggregate score
- conservative absence, count, and region handling
- exact face-feature value comparison with strength left diagnostic and unverifiable
- paired skin assessment without same-person identity claims
- append-only `G2_OBSERVED` and purpose-scoped `G3_CONSENSUS_VALIDATED`
- G4/G5 creation excluded

Commands:

```bash
npm run synthetic:judge -- \
  --blind-candidate requests/blind-candidate-0001.json \
  --observation-run-id obs_xxxxxxxxxxxxxxxxxxxxxxxx \
  --issue

npm run synthetic:judge -- \
  --assignment requests/judgment-assignment-0001.json \
  --submission requests/judgment-submission-0001.json \
  --preflight

npm run synthetic:judge -- \
  --assignment requests/judgment-assignment-0001.json \
  --submission requests/judgment-submission-0001.json \
  --submit

npm run synthetic:consensus -- \
  --assignment requests/judgment-assignment-0001.json \
  --submission-digests <digest-1>,<digest-2> \
  --preflight

npm run synthetic:consensus -- \
  --assignment requests/judgment-assignment-0001.json \
  --submission-digests <digest-1>,<digest-2> \
  --build

npm run synthetic:align -- \
  --candidate cand_xxxxxxxxxxxxxxxxxxxxxxxx \
  --consensus-digest <consensus-digest> \
  --preflight

npm run synthetic:align -- \
  --candidate cand_xxxxxxxxxxxxxxxxxxxxxxxx \
  --consensus-digest <consensus-digest> \
  --confirm
```

All request paths are relative to `.synthetic-local/requests/`. Judgment and consensus commands cannot read generation intent. Alignment resolves intent only after a sealed consensus artifact exists.

Design and decisions:

```text
docs/judgment-intent-alignment-v1.md
docs/judgment-intent-alignment-implementation-v1.md
docs/adr/0007-blind-judgment-sealing-and-intent-join.md
docs/adr/0008-purpose-specific-alignment-and-grade-derivation.md
docs/adr/0009-axis-level-consensus-and-purpose-scoped-g3.md
```

ADR 0009 supersedes earlier wording that makes blind consensus depend on purpose-specific critical axes.

## Toolkit Track #T6

Implemented:

- stored T3/T4/T5 evidence and canonical-image SHA revalidation
- two-stage source snapshot and final evidence bundle
- full candidate projection snapshot and operator re-attestation
- separate internal-evaluation rights review
- explicit canonical-image visual policy review
- exact duplicate representative policy and manual perceptual leakage review
- purpose- and claim-scoped `G4_SYNTHETIC_GOLD`
- consensus values as the Gold-label source
- `capture_control` and `skin_cue_control` G4 policy
- conditional face-feature enum G4 with strength excluded
- paired and mixed-control G4 prohibition
- non-Gold retention for consensus-valid misaligned controls
- independent promotion reviewer role separation
- append-only decision, activation, and revocation artifacts
- one activation root and one immutable status successor per predecessor
- G5 and dataset split authority reserved for #T9

T5 always leaves promotion eligibility pending. T6 does not treat `aligned` or G3 alone as Gold approval.

Commands:

```bash
npm run synthetic:promote -- \
  --candidate cand_xxxxxxxxxxxxxxxxxxxxxxxx \
  --alignment <alignment-digest> \
  --source-preflight

npm run synthetic:promote -- \
  --candidate cand_xxxxxxxxxxxxxxxxxxxxxxxx \
  --alignment <alignment-digest> \
  --policy-reviews promotion-policy-reviews.json \
  --policy-review-preflight

npm run synthetic:promote -- \
  --candidate cand_xxxxxxxxxxxxxxxxxxxxxxxx \
  --alignment <alignment-digest> \
  --policy-reviews promotion-policy-reviews.json \
  --promotion-review promotion-review.json \
  --confirm

npm run synthetic:promote -- \
  --request promotion-revocation.json \
  --revoke
```

Design and decisions:

```text
docs/promotion-policy-v1.md
docs/promotion-policy-implementation-v1.md
docs/adr/0010-purpose-scoped-g4-and-grade-authority.md
docs/adr/0011-promotion-evidence-snapshot-and-revalidation.md
docs/adr/0012-leakage-coupling-and-append-only-revocation.md
docs/adr/0013-two-stage-promotion-evidence-and-visual-review.md
```

ADR 0013 supersedes the single-bundle ordering in the main T6 design and requires a source snapshot, explicit visual policy review, then a final evidence bundle.

## Toolkit Track #T7

Implemented:

- exact 20-slot A/B/C/D skin-control plan with five slots per condition
- deterministic plan, run, slot, attempt, packet, handoff, event, projection, checkpoint, and closeout identities
- balanced 4/8/8 wave issue with explicit checkpoints
- one active manual generation Provider profile per run
- source freeze covering T2 fixtures/compiler, T3 import, T4 observation, T5 judgment/alignment, and T6 promotion policy
- safe manual generation work packet and handoff boundary
- technical-only generation retry reserve: 20 primary attempts plus 10 retries, two attempts maximum per slot
- explicit T4 Provider authorization and technical recovery accounting
- exact T7 packet/handoff binding before T3 candidate registration
- candidate ID, canonical SHA, T4 run/object, T5 consensus/alignment, and T6 evidence chain binding
- registered-candidate replacement prohibition
- append-only linear run/slot event ledger with branch, cycle, and disconnection rejection
- immutable local artifacts and explicit single-writer claim recovery
- deterministic campaign projection, pause, resume, stop, checkpoint, and closeout
- valid-ineligible, technical failure, misaligned, held, rejected, non-Gold, and G4 outcomes preserved separately
- report/export interpretation reserved for #T8
- split/G5/holdout/regression authority reserved for #T9

The 20 primary slots are an experimental denominator, not a G4 quota. T7 does not generate images, fabricate human reviews, automatically approve promotion, interpret campaign success, or assign dataset splits.

Commands:

```bash
npm run synthetic:campaign -- \
  --plan campaign-plan.json \
  --run-nonce pilot-run-001 \
  --started-by campaign_operator \
  --compile

npm run synthetic:campaign -- \
  --run <campaignRunId> \
  --issue-wave 1

npm run synthetic:campaign -- \
  --run <campaignRunId> \
  --slot <slotId> \
  --generation-handoff generation-handoff.json

npm run synthetic:campaign -- \
  --run <campaignRunId> \
  --slot <slotId> \
  --stage candidate \
  --artifact candidate-stage.json

npm run synthetic:campaign -- \
  --run <campaignRunId> \
  --checkpoint checkpoint.json

npm run synthetic:campaign -- --run <campaignRunId> --status
npm run synthetic:campaign -- --run <campaignRunId> --slot <slotId> --advance
npm run synthetic:campaign -- --run <campaignRunId> --closed-by campaign_operator --close
```

All request files are resolved below `.synthetic-local/requests/`. Wave issue and resume revalidate the current source freeze before writing. Stored historical runs remain intrinsically verifiable even after later code versions change.

Design and decisions:

```text
docs/pilot-campaign-runner-v1.md
docs/pilot-campaign-runner-implementation-v1.md
docs/adr/0014-campaign-orchestration-without-new-judgment-authority.md
docs/adr/0015-fixed-pilot-matrix-waves-and-anti-cherry-picking.md
docs/adr/0016-manual-generation-handoff-and-single-provider-runs.md
docs/adr/0017-frozen-run-versions-and-t8-t9-handoff.md
docs/adr/0018-pilot-source-freeze-checkpoint-and-terminal-corrections.md
```

ADR 0018 tightens the source freeze, makes valid-ineligible/no-asset outcomes explicit, defines wave checkpoint readiness, and requires T9 to revalidate current T6 G4 status.

## Toolkit Track #T8

Implemented:

- stored T7 closeout, projection, event heads, checkpoints, and referenced T2–T6 evidence revalidation
- canonical image SHA-256 verification before review rendering
- exact 20-row slot evidence table with A/B/C/D five-slot denominators
- technical failure, valid-ineligible, incomplete, non-Gold, held, rejected, and cancelled outcomes preserved
- immutable evidence snapshot, metric set, review package, report review, report, revision, and export artifacts
- Provider-only comparison gate with non-Provider drift rejection
- descriptive count, rate, count-delta, and percentage-point-delta metrics only
- blind contact sheet with non-linkable review item IDs and separate blind asset paths
- annotated audit contact sheet with explicit warnings and source metadata
- deterministic resize-only PNG thumbnails with no crop, retouch, recoloring, or mark removal
- explicit human report-review checklist before report confirmation
- source-linked typed report claims with winner, ranking, significance, causal, clinical, identity, and demographic claims prohibited
- deterministic canonical JSON, LF CSV, and accessible HTML internal exports
- append-only report revisions with one immutable successor per predecessor
- staged export publication with manifest last and existing-file rehash
- G4 status reported only as of campaign closeout
- split, holdout, G5, public publishing, and production authority reserved for later tracks

Commands:

```bash
npm run synthetic:report -- \
  --campaign-run <campaignRunId> \
  --source-preflight

npm run synthetic:report -- \
  --campaign-run <campaignRunId> \
  --build-review-package

npm run synthetic:report -- \
  --campaign-run <campaignRunId> \
  --review report-review.json \
  --confirm

npm run synthetic:report -- \
  --compare <campaignRunIdA>,<campaignRunIdB> \
  --source-preflight

npm run synthetic:export -- \
  --report <report-digest> \
  --internal-review
```

The report-review request must provide a pseudonymous reviewer ID and explicitly confirm source integrity, denominator, claims, hold visibility, and contact-sheet review. T8 does not auto-approve these checks.

Design and decisions:

```text
docs/review-export-report-v1.md
docs/review-export-report-implementation-v1.md
docs/adr/0019-report-source-snapshot-and-derived-metric-authority.md
docs/adr/0020-fixed-denominator-and-non-causal-provider-comparison.md
docs/adr/0021-blind-annotated-review-and-immutable-report-revisions.md
docs/adr/0022-evidence-metric-render-layering-and-g4-time-boundaries.md
```

ADR 0022 separates frozen evidence identity from metric, review, renderer, report, and export identities. Historical G4 references remain an as-of-closeout snapshot; T9 must revalidate current T6 status before dataset placement.

## Not included

- automatic image generation
- actual pilot campaign or report execution
- browser automation
- same-person verification
- archetype scoring
- actual human review execution or reviewed dataset
- automatic legal or rights judgment
- automatic T4 Provider execution
- automatic T5/T6/T8 review or approval
- public report upload or publishing
- G5 holdout lock or dataset split
- database, API route, UI, or production integration

## Verification

```text
npm run synthetic:test
npm run synthetic:verify
npm run architecture:guard
npm run build
```

`#T1`, `#T2`, and later identifiers are internal Toolkit Track IDs. They are not GitHub pull request numbers.

## Local data boundary

Synthetic assets and outputs belong under:

```text
.synthetic-local/
```

The root may be changed with `BEJEWELY_SYNTHETIC_DATA_ROOT`.
