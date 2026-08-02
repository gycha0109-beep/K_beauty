# @bejewely/synthetic-evaluation

Synthetic Evaluation Toolkit is the non-production workspace for generating, importing, observing, judging, and promoting synthetic evaluation assets for Bejewely Face Lab and Skin Match.

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

Designed; runtime implementation is separate:

- process-level blind judgment assignments
- immutable pseudonymous human-review submissions
- minimum two independent reviewers with explicit blind adjudication
- sealed consensus before generation-intent access
- finalized `GenerationSpec` as the only intent source
- gate, target, and diagnostic axis separation
- no aggregate quality score
- conservative absence/count/region handling
- exact face-feature value alignment with strength left unverifiable
- paired skin target assessment without same-person identity claims
- append-only G2/G3 derivation
- G4/G5 promotion excluded

Design and decisions:

```text
docs/judgment-intent-alignment-v1.md
docs/adr/0007-blind-judgment-sealing-and-intent-join.md
docs/adr/0008-purpose-specific-alignment-and-grade-derivation.md
```

## Not included

- automatic image generation
- batch import, observation, judgment, or alignment
- browser automation
- same-person verification
- archetype scoring
- #T5 runtime judgment, consensus, or alignment implementation
- dataset promotion or lock
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
