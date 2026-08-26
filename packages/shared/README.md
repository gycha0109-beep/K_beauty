# @bejewely/shared

This package is the platform-neutral contract boundary for BEJEWELY Web + Native Mobile.

## Allowed here

- domain types and DTO contracts
- enums and schemas
- normalization and validation contracts
- locale-independent business constants
- shared face-capture state contracts

## Forbidden here

- Next.js components or Router APIs
- React DOM
- `window`, `document`, `localStorage`, or `sessionStorage`
- server-only modules and secrets
- React Native `View` / `Text` / native camera implementations
- Recommendation Engine, Product Fact runtime, Face Lab server pipeline, Premium generation, crawler, or admin implementation

The rule is **share domain; do not share platform implementation**. Existing `packages/face-contracts` remains authoritative for its current face contracts; this package must not duplicate those contracts without a later explicit extraction/adoption task.
