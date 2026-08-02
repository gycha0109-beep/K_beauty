# Synthetic Evaluation Toolkit #T4

# Observation Adapter Implementation v1

## Status

- Track: `#T4`
- Base design: `docs/observation-adapter-v1.md`
- Pre-implementation corrections: ADR 0006
- Production route, DB, UI, Auth, and Payment changes: none
- Actual Provider smoke: not performed by this implementation change

## Implemented flow

```text
BlindCandidateInput
→ exact request validation
→ canonical path and SHA-256 preflight
→ pinned semantic snapshot/profile validation
→ deterministic run identity
→ exclusive execution claim
→ fixture replay or one bounded OpenAI attempt
→ strict normalization
→ content-addressed observation object
→ run manifest last
```

## Review corrections applied before implementation

1. Added an execution claim before Provider dispatch so a crash cannot cause a hidden second call for the same replicate ordinal.
2. Marked fixture replay as `fixture_only` and blocked it from judgment handoff.
3. Added a profile-owned model allowlist instead of accepting arbitrary model strings.
4. Required explicit credential environment-variable naming for Provider execution.

## Storage

```text
.synthetic-local/
├─ objects/observations/by-digest/<prefix>/<digest>.json
└─ observation-runs/<candidateId>/<runId>/
   ├─ claim.json
   └─ manifest.json
```

The claim is an attempt marker, not a registered observation. The manifest remains the registration boundary.

## Authority

- `fixture_replay` → `fixture_only`; contract/storage testing only
- `provider_bounded` + valid normalized bundle → `observed_image`; eligible for blind judgment handoff
- Provider or contract failure → no observation object

## Privacy and isolation

The implementation stores no raw Provider body, authorization material, base64 image artifact, additional imae copy, or absolute local path. It imports no production `lib/**`, Next.js route, Supabase module, or user-session code.

## Verification boundary

Provider-free tests cover snapshot integrity, strict normalization, valid ineligible handling, blindness, path/hash verification, zero-write preflight, execution claims, idempotency, replicate identity, fixture authority, one-call transport behavior, sanitized failure classification, CLI containment, and architecture boundaries.

A real one-image synthetic Provider smoke remains separately approval-gated.
