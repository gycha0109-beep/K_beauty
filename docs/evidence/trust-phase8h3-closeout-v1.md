# TRUST Phase 8H-3 Closeout

## Status

**CLOSED.** Production lifecycle authority was sealed by PR #843 at merge commit `219909a4fa54d8e88478cff4e556b68e7022cfb1`.

The final Production evidence is `docs/evidence/trust-phase8h3-derma-production-canary-closure-v1.json`.

## Problem

A confirmed relocation of Derma Factory's official product page had to be revalidated without rewriting the historical Evidence Source. The governed lifecycle therefore had to separate historical evidence identity from current official-source navigation, establish a comparable fresh recovery profile, verify the replacement independently, research the affected Product Facts, and adjudicate semantic sameness before restoring confirmed review state.

## Regressions found and repaired

1. A later relocation-aware research recorder replacement had regressed the Phase 7D relational contract by dropping `parent_proposition_key` from `active_concentration` candidates.
2. Phase 8E relational comparison treated source/evidence locale as Product Fact semantic applicability, so evidence locale `en` could disagree with a locale-null Current fact even when the proposition was semantically unchanged.
3. `record_trust_research_result_v1` retained an unsafe SECURITY DEFINER search path until the Phase 8H-3 hardening.
4. The malformed concentration candidate was repaired append-only: the historical candidate remains preserved with zero resolution references, while a corrected parent-aware candidate carries the governed resolution.

## Final Production result

- Historical Evidence Source locator, content digest, and source metadata remain unchanged.
- Official-source relocation is confirmed; old binding is retired; replacement binding is resolved and independently reviewed as equivalent.
- Fresh recovery profile and independent verification are comparable and `unchanged`.
- `contains_active` and `active_concentration` both resolved as `SAME_SEMANTIC_REAFFIRMATION`.
- Neither Product Fact Current pointer changed; no fact instance or confirmation was created by reaffirmation.
- The corrected concentration candidate preserves the `contains_active` proposition as its parent.
- BOJ / Dr.G / Torriden full-brand blast-radius audit found no Phase 8H-3 mutations.
- The privileged Phase 8H-3 function set has empty SECURITY DEFINER `search_path` and service-role-only EXECUTE authority.

## Permanent rules

- Official-source relocation does **not** authorize mutation of the historical Evidence Source.
- Source/evidence locale is provenance and must not, by itself, become Product Fact semantic applicability.
- Relational evidence must carry the governed parent proposition identity.
- Historical malformed evidence is repaired append-only; it is not rewritten to hide the regression.
- Product Fact Current is changed only by the governed semantic replacement path, never by relocation or network success alone.

## Canary policy after closure

PR and push verification remains deterministic. External live relocation/research canaries are retained as diagnostic assets but run only through manual `workflow_dispatch`; routine PR CI does not perform those live network fetches.
