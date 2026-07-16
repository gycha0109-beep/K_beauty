# Face Lab Hosted Evaluation v1

## Purpose

This workflow evaluates the hosted `/api/face-reading` observation contract against consented local fixtures before archetype scoring is introduced. It measures transport reliability, eligibility behavior, canonical contract usability, repetition stability, locale stability, condition-sensitive degradation, latency, and privacy invariants.

It does not establish scientific facial ground truth, identify people, score appearance, or collect operating-user photos.

## Privacy boundary

- Use only the operator's own adult photos or photos from adults who explicitly consented to this evaluation.
- Never use minors.
- Source images stay under `private/face-lab-fixtures/`, which is ignored by Git.
- Images, crops, base64, absolute paths, raw provider JSON, evidence text, names, emails, and session cookies are never written to evaluation outputs.
- The harness calls the local application route; it does not add a separate direct-provider integration.
- Output stays under `tmp/face-lab-hosted-evaluation/`, which is ignored by Git.

## Manifest

Copy `scripts/fixtures/face-lab-hosted-eval-manifest.example.json` to a local file such as:

```text
private/face-lab-fixtures/manifest.local.json
```

Every fixture requires:

- a safe `fixtureId` and pseudonymous `subjectId`
- a repository-relative image path under `private/face-lab-fixtures/`
- `consentConfirmed: true`
- expected eligibility
- comparison group and variant role
- condition tags and expected degradation
- one or more plans: `smoke`, `stability`, or `full`

Personal metadata keys such as name, age, sex, race, nationality, health, email, phone, and address are rejected by the manifest validator.

## Execution

Start the local application:

```bash
npm run dev
```

Review the call plan without making requests:

```bash
npm run face-lab:eval -- \
  --manifest private/face-lab-fixtures/manifest.local.json \
  --base-url http://localhost:3001 \
  --plan smoke \
  --max-calls 20
```

After checking the planned call count, rerun with explicit confirmation:

```bash
npm run face-lab:eval -- \
  --manifest private/face-lab-fixtures/manifest.local.json \
  --base-url http://localhost:3001 \
  --plan smoke \
  --max-calls 20 \
  --confirm RUN
```

The runner is sequential, limits calls through `--max-calls`, and resumes by skipping case IDs already present in `records.jsonl`. Use the same `--run-id` or `--run-dir` to resume a specific run.

## Output

A run directory contains:

```text
run-manifest.json
records.jsonl
summary.json
report.md
```

Records contain only pseudonymous fixture metadata, response status, eligibility projection, canonical status/value/confidence projection, coverage, warnings, latency, and privacy audit results. Vision evidence sentences are intentionally discarded.

Regenerate a report with:

```bash
npm run face-lab:eval:report -- \
  --run-dir tmp/face-lab-hosted-evaluation/<run-id>
```

## Automated gates

Hard invariant failures include:

- source-image or base64 material in a response
- raw `observation_analysis` exposure
- unknown provider keys escaping the route projection
- canonical analysis for an expected-ineligible fixture
- request or server failure
- `sourceImagePersisted: true`

The current calibration gates also flag:

- eligible baseline usable rate below 80%
- repeat field-status agreement below 95%
- repeat available-value agreement below 90%
- locale field-status agreement below 100%
- locale available-value agreement below 90%

These are contract-calibration gates, not claims of facial-analysis accuracy.

## Static verification

```bash
npm run face-lab:eval:verify
```

The verifier uses synthetic data only. It checks consent enforcement, forbidden metadata, path containment including Windows paths, call caps, resume behavior, privacy projection, evidence removal, Jaccard comparison for array fields, report generation, and runner safeguards.

## Review boundary

Hosted outputs must be reviewed before changing observation enums, prompt rules, confidence weights, or coverage thresholds. Do not tune the contract from intuition alone. The next decision point is based on sanitized `summary.json` and `report.md`; source photos are not transferred.
