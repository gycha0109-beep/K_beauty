# Face Lab Hosted Evaluation single-analysis execution contract — 2026-07-19

## Diagnosis

The production `/api/face-reading` route performs one OpenAI multimodal request per HTTP request. The hosted evaluator was generating separate `ko` and `en` HTTP requests for the same fixture and repetition even though its persisted records retain only locale-neutral eligibility and canonical observation analysis. As a result, the evaluator paid the image-input cost twice without independently preserving or grading the localized `base_data` and `features` output.

The direct defect was therefore in the hosted evaluation execution model. The runtime route remains one provider call per ordinary user request; this change does not introduce response caching, derived-face-data persistence, or a new public API contract.

## Approved execution model

- Logical cases remain `fixture × locale × repetition` so the existing record, expectation, resume, and summary contracts remain compatible.
- Provider calls are grouped by `fixtureId × repetition`.
- One deterministic provider locale is selected per group: `ko` when present, otherwise the first requested locale.
- The resulting locale-neutral eligibility and canonical observation analysis are projected into every pending logical locale case in the group.
- Only the first projected record carries the real provider attempt count and latency. Shared locale records use `attemptCount=0`, `durationMs=null`, and a `shared_provider_result:*` reason code so attempt budgets and latency are not multiplied.
- Rate-limit circuit opening and max-attempt exhaustion apply per provider group and then fan out to its logical cases.
- Resume first resolves pending logical cases, then requests only provider groups that still contain pending cases.

For the current smoke manifest this changes the execution plan from eight provider calls to four while keeping eight logical records.

## Reporting contract

Run manifests now add:

- `executionModel=single_provider_call_per_fixture_repetition_v1`
- `plannedProviderCalls`

Summaries add provider request/attempt accounting. Locale agreement is explicitly marked not independently measured because both locale records share the same canonical provider result; reporting a synthetic 100% locale agreement would be misleading.

Existing run directories created by the prior execution model are rejected on resume because their run manifests do not contain the new execution contract. A new run directory is required after this change.

## Privacy and security boundary

- Source images remain read only from `private/face-lab-fixtures/` and are never written into records or reports.
- No raw provider response, image bytes, data URL, absolute path, full header, provider error body, or evidence text is persisted.
- No cache of face-derived data is introduced.
- Localhost-only endpoint validation, redirect rejection, response-size limits, image signature checks, retry caps, run locking, JSONL integrity checks, and fail-closed confirmation remain in force.

## Verification

`npm run face-lab:eval:verify` now includes `verify-face-lab-single-analysis-evaluation.mjs`, which checks:

- eight KO/EN logical cases collapse to four provider groups;
- provider call caps are enforced after grouping;
- duplicate locales and inconsistent fixture paths fail closed;
- resume grouping includes only pending logical cases;
- shared records do not duplicate provider attempts or latency;
- the runner contains exactly one provider execution site and no per-locale image loop;
- the compatibility entrypoint delegates to the single-analysis runner;
- KO/EN presentation contracts remain present while canonical eligibility and observation keys remain language-neutral.

## Executed validation

Temporary validation commit `50f4aac8e3f84031cfcfacb4fc1c032bd56f5521` changed the Preview build command only for validation. The Vercel Preview completed successfully while executing, in order:

1. `npm run face-lab:eval:verify`
2. `npm run architecture:guard`
3. `next build`

The temporary build-command override and temporary workflow are removed before final delivery. No provider request or fixture image was sent during this validation.

## Review outcome

The implementation preserves the existing logical record schema and runtime API surface while removing the duplicated multimodal provider calls that caused unnecessary token consumption. Remaining locale-copy quality is a presentation concern and must be evaluated separately from canonical image-analysis stability; it is no longer represented as an independent provider-analysis metric in this harness.
