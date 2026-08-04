# CandidateExposurePolicy Hosted Diagnostic Route Cleanup Review

## Scope

Stage 11M removes the temporary Preview-only synthetic CandidateExposurePolicy diagnostic route introduced by Stage 11K and restores the pre-route Stage 11I fail-closed Hosted boundary.

```text
implementation branch: codex/candidate-exposure-policy-synthetic-diagnostic-route-cleanup
design branch: codex/candidate-exposure-policy-synthetic-diagnostic-route-cleanup-design
design PR: #141
implementation base: 9b0ab2ac01d8df840f13fd89a0a1283182b97d3b
```

The implementation is limited to the fixed twelve-file boundary defined by Stage 11L. `/api/analyze`, package manifests, lockfiles, workflows, Vercel configuration, middleware, migrations, UI, database, Auth, Payment, Storage, and recommendation assembly are unchanged.

## Cleanup implementation

Deleted completely:

```text
app/api/internal/candidate-exposure-policy-diagnostic/route.js
lib/candidate-exposure-policy-hosted-diagnostic-auth.js
lib/candidate-exposure-policy-hosted-diagnostic-contract.js
lib/candidate-exposure-policy-hosted-diagnostic-execution.js
scripts/check-candidate-exposure-policy-hosted-diagnostic-route.mjs
```

Restored from exact Stage 11J-base Git blobs:

```text
lib/candidate-exposure-policy-hosted-execution-v2.js
blob 3220b96a1e81e6c85eb12f05b3ce96b085cecb0b

lib/candidate-exposure-policy-read-only-hosted-adapter.js
blob 12494938e141e2f74676444b8cbdf2f29edb812b

scripts/check-candidate-exposure-policy-hosted-execution.mjs
blob 24baea33e998a9285ddbc65ffda54500a9d4c061
```

Added a durable absence verifier and registered it in the security-closeout suite, increasing the expected verifier count from 60 to 61.

## Independent review findings

### Important — documentation exclusion could conceal an executable file in a documentation directory

The absence verifier excludes documentation paths from token scanning because Stage 11K historical evidence intentionally retains route strings. It still checks the exact five temporary paths, exact restored blobs, the route directory, runtime/script/config source extensions, and the Stage 11I blocked contract.

Resolution: executable application and verifier paths remain covered by explicit path checks and repository-wide source/config scanning. Documentation is retained only as evidence and is not imported by production code.

Status: resolved.

### Important — semantic restoration alone would not prove byte identity

Resolution: the verifier computes Git blob SHA-1 from file bytes and compares all three restored files to the approved Stage 11J blobs. `/api/analyze` is checked against its Stage 11K cleanup-base blob by the same mechanism.

Status: resolved.

### Minor — deleting the route checker could reduce future reintroduction protection

Resolution: replace the implementation checker with a durable route-absence verifier in the security-closeout suite. The historical Stage 11K checker result remains in the implementation evidence documents.

Status: resolved.

## Review result before exact-head validation

```text
Critical unresolved: 0
Important unresolved: 0
Minor unresolved: 0
implementation status: IMPLEMENTED_UNVERIFIED
```

## Prohibited claims before validation

- cleanup verification PASS;
- security-closeout 61/61 PASS;
- production build PASS;
- Vercel Preview READY;
- route-table absence PASS;
- integration readiness toward `main`.

## Boundaries

- Hosted diagnostic requests: 0
- `/api/analyze` diagnostic requests: 0
- Provider calls: 0
- Production changes: 0
- dependency or lockfile changes: 0
- merge: not performed
