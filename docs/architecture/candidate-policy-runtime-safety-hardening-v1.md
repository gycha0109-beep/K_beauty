# CandidatePolicy runtime safety hardening v1

## Scope and baseline

This change is stacked on verifier-baseline recovery commit
`f0505b804313ee5ffbe1fbb84971487f5c81c5f1`. It changes only the
CandidatePolicy runtime safety boundary, its canonical caller projection,
aggregate observability, deterministic verification, and the recommendation
transport fields needed to evaluate sunscreen protection evidence.

It does not enable the runtime, change its kill switch or production canary
scope, connect `currentProductFindings`, modify current-product snapshots,
resolve FunctionalPolicy/GoalPolicy ranking divergence, change product data, or
call a database, network, Preview, Hosted, or Production endpoint.

## Reproduced failures

A fresh ignored runner imported the exact baseline production modules and read
the preserved 164-row catalog export without DB or network access.

- One sunscreen had source SPF and UV filter evidence but no UVA label. Its
  pre-change runtime result was visible `1/1`, hidden `0`, insufficient `0`,
  with no stop reason.
- The canonical SharedSkinDecisionContext reported `stabilize_first` and
  `activeExpansionAllowed=false`, but all 164 candidates remained visible and
  86 candidates with an active functional axis remained eligible for every
  downstream pool.

The same runner also proved that the recommendation product mapper retained
`uv_filter_type` but dropped `spf_value` and `uva_label`, so the runtime lacked
the source evidence needed to distinguish complete and incomplete protection.

## Canonical safety contract

`candidate-policy-runtime-safety-context-v1` is an immutable, versioned,
JSON-safe projection of canonical SharedSkinDecisionContext and
FunctionalPolicy. It contains no product or user identity. The engine builds
the canonical context once, only when CandidatePolicy runtime is enabled or
shadow diagnostics are explicitly requested, then reuses the projection for
runtime and shadow.

The projection records the canonical policy version, stabilization state,
recommendation suppression, active-expansion permission, protection
requirement, bounded reason codes, and source provenance. Missing or invalid
context fails closed when the runtime function is executed. The default runtime
flag remains disabled.

## Shared safety gates

Runtime and shadow use the same production gate.

- A sunscreen-category, protection-role, or `sunscreen_protection` candidate
  requires present SPF evidence, present UVA label evidence, and an allowed UV
  filter type. Incomplete protection is routed to the existing
  `insufficient_evidence_candidate` state with
  `sunscreen_protection_metadata_incomplete`.
- When canonical safety prohibits active expansion, any candidate carrying an
  exfoliation, acne-care, tone-care, or wrinkle-care functional axis is routed
  to the existing `hidden_candidate` state with
  `stabilization_active_expansion_blocked`.
- Preference evidence is independent. Missing `pilling_risk` does not hide a
  sunscreen whose three protection fields are complete.

The mapper now preserves source `spf_value` and `uva_label` without defaulting
or inference. Existing `uv_filter_type` normalization remains authoritative.
No current-product snapshot field was changed.

The runtime still creates one `visibleCandidateIds` set, and
`skin-match-decision-engine.js` derives Top Pick, alternatives, supporting
products, routine products, and budget alternatives from the filtered
`exposureProducts`. A blocked candidate therefore has no downstream bypass.

## Observability and verification

Aggregate telemetry records only bounded safety-block and fail-open counts,
policy/context versions, and stop reasons. It does not add product IDs, names,
brands, URLs, survey text, or credentials. Expected safety blocks do not stop a
canary; a fail-open, missing canonical context, unexpected receiver result, or
existing safety violation does.

`verify-candidate-policy-runtime-safety-hardening.mjs` materializes anonymous
fixtures in memory and isolated OS temporary directories. It covers complete
protection, missing UVA/SPF/filter, preference-only absence, stabilization
active blocking, maintenance allowance, missing context, downstream exactness,
runtime/shadow parity, observability privacy, non-sunscreen behavior,
non-stabilized active behavior, deterministic hashes, and eight negative
controls. It uses no ignored prerequisite, production row, DB, network, or
runtime environment mutation.

The security closeout exact manifest grows from 52 to 53 entries. The existing
unrelated SEC-06 negative-control failure remains an explicit baseline failure
and is neither skipped nor weakened.

## Actual-data post-change replay

The preserved catalog replay changed the UVA-missing sunscreen from visible
`1/1` to visible `0/1` and insufficient `1/1`; every downstream eligibility
count became zero. The protection-complete sunscreen remained visible, and the
protection-complete/pilling-missing sunscreen remained visible.

Under canonical stabilization, source active-axis candidates remained 86 but
active candidates visible after the gate became zero. The five downstream
active eligibility counts all became zero. In the stable full pool, only
protection-incomplete sunscreen candidates were safety-blocked; unexpected
general-product blocks were zero.

## Remaining findings

The 108/128 non-safety FunctionalPolicy/GoalPolicy divergence,
`currentProductFindings` caller omission, 104 current-product snapshot field
drops, source UVA/pilling remediation, Production canary behavior, and actual
Production runtime activation remain out of scope and unverified.
