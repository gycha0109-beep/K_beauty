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

Not included:

- GenerationSpec
- Gemini prompt compiler
- image import
- hashing or duplicate detection
- Vision observation adapter
- archetype scoring
- Gold promotion
- human review UI
- database or Provider API integration

`#T1`, `#T2`, and later identifiers are internal Toolkit Track IDs. They are not GitHub pull request numbers.

## Local data boundary

Future local synthetic assets and outputs belong under:

```text
.synthetic-local/
```

A later track may support `BEJEWELY_SYNTHETIC_DATA_ROOT`. Track #T1 does not create or read that environment variable.
