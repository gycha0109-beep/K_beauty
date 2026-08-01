# @bejewely/synthetic-evaluation

Synthetic Evaluation Toolkit is the non-production workspace for generating, importing, judging, and promoting synthetic evaluation assets for Bejewely Face Lab and Skin Match.

## Production boundary

- The production application must not depend on this toolkit.
- The toolkit does not change production routes, UI, database behavior, or Provider runtime.
- Shared contracts may be consumed through `@bejewely/face-contracts`.

## Planned responsibility flow

```text
Generation
→ Candidate Import
→ Observation
→ Judgment
→ Promotion
→ Locked Dataset
```

Generation intent is not an observed label or ground truth. Candidate promotion remains a separate, purpose-specific decision.

## Toolkit Track #T1

Included:

- npm workspace registration
- package dependency boundary
- local data ignore boundary
- workspace smoke test

## Toolkit Track #T2

Implemented:

- exact `DraftGenerationSpecV1` validation
- canonical semantic payload and SHA-256 spec identity
- deeply frozen finalized spec and compiled prompt artifacts
- registry-owned mandatory exclusions
- observation-backed face-feature cue registry
- archetype taxonomy fail-closed boundary
- Gemini and GPT manual prompt profiles
- SDXL reference-only profile
- A/B/C/D skin-control fixtures
- frozen Gemini prompt snapshots
- deterministic prompt digest
- production dependency and no-execution architecture checks

Not included:

- Provider API or browser execution
- image generation
- reference-image transfer
- candidate import
- hashing or duplicate detection
- Vision observation adapter
- archetype taxonomy or scoring
- Gold promotion
- human review UI
- database, API route, UI, or production integration

Design and decisions:

```text
docs/generation-contract-prompt-compiler-v1.md
docs/adr/0001-generation-spec-identity-and-policy-registries.md
docs/adr/0002-generation-compiler-implementation-resolution.md
```

ADR 0001 replaces the initial caller-owned identity and exclusion shapes. ADR 0002 records the implementation review decisions for the observation-backed cue registry, basis-point weights, disabled archetype taxonomy, unverified reference capability, and dynamic subject compilation.

Verification:

```text
npm run synthetic:test
npm run synthetic:verify
npm run architecture:guard
npm run build
```

`#T1`, `#T2`, and later identifiers are internal Toolkit Track IDs. They are not GitHub pull request numbers.

## Local data boundary

Future local synthetic assets and outputs belong under:

```text
.synthetic-local/
```

A later track may support `BEJEWELY_SYNTHETIC_DATA_ROOT`. Track #T1 and #T2 do not create or read that environment variable.
