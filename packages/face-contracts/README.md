# @bejewely/face-contracts

Shared contract boundary for Bejewely production code and non-production evaluation tooling.

## Allowed responsibilities

- types and enums
- JSON Schemas
- version identifiers
- pure validators
- contract invariants

## Forbidden responsibilities

- production business logic
- Provider calls
- database access
- file I/O
- UI rendering
- synthetic generation or evaluation workflows

Toolkit Track `#T1` establishes only the package boundary. Domain contracts are added in later, separately reviewed tracks.
