# @bejewely/synthetic-evaluation

Synthetic Evaluation Toolkit is the non-production workspace for generating, importing, judging, and promoting synthetic evaluation assets for Bejewely Face Lab and Skin Match.

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

Not included:

- Provider API or browser execution
- image generation
- batch confirm
- face observation or same-person verification
- archetype scoring
- dataset promotion
- database, API route, UI, or production integration

Design and decisions:

```text
docs/candidate-import-provenance-v1.md
docs/adr/0003-import-artifact-retention-and-registration-outcomes.md
docs/adr/0004-import-implementation-resolution.md
```

ADR 0003 removes a committed quarantine state. ADR 0004 distinguishes logical artifact digests from full-envelope bytes, defines manifest-last publication, preserves retry timestamps, keeps mark provenance unverified, and defers batch confirm.

## Toolkit Track #T4 design

Defined:

- blind candidate input as the only observation image boundary
- pinned snapshot of the current canonical Vision/Face Lab observation contract
- direct production runtime import prohibition
- contract, Provider transport, and registration separation
- preflight with zero Provider calls and zero writes
- explicit execute with one image-bearing attempt and no automatic retry
- immutable observation objects and manifest-last run publication
- valid ineligible observation versus Provider/contract failure separation
- replicate ordinal identity and idempotent retry
- raw Provider response and image-copy retention prohibition
- blind judgment handoff without generation intent

Not implemented:

- observation contract snapshot exporter
- Provider transport
- observation CLI
- observation run storage
- judgment, consensus, archetype scoring, or promotion

Design and decision:

```text
docs/observation-adapter-v1.md
docs/adr/0005-observation-contract-snapshot-and-blind-execution.md
```

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
