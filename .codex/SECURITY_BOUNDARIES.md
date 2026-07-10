# Security Boundaries

## Purpose and precedence

This is the canonical conditional L1 security-boundaries surface.
Read only the relevant section when the router's protected-surface delta is `Y`.
It complements [AGENTS.md](../AGENTS.md) Protected Areas and current code, schema, config, contract, and verifier evidence; it is not a source of truth or execution approval.

## Y/N routing screen

Before protected work, classify DB, Auth, RLS, Storage, Provider, Payment, Secret, and Production impact or execution as `Y` or `N`.
Direct impact, indirect impact, and uncertainty are `Y`.

| Boundary | Read when `Y` | Minimum rule |
| --- | --- | --- |
| DB/RLS/Storage | current schema, migration/policy contract, and relevant verifier | do not infer live state from prose |
| Auth/Secret | current auth/config boundary and relevant verifier | do not expose or alter credentials casually |
| Provider/Payment | current integration contract and safe execution boundary | do not call external services without authority |
| Production | current deployment/target evidence and approval | do not access hosted targets by default |

For `N`, record the basis in the completion report and do not load unrelated security detail.

## Universal constraints

- Do not print, copy, or persist secret, key, token, or hosted URL values.
- Do not modify `.env.local` or other environment files without explicit approval.
- Do not access production/hosted systems, external providers, databases, or payment surfaces without explicit safe authority.
- Do not change migrations, RLS, Auth, Payment, or security policy before confirming the existing contract and actual relevant state.
- Do not treat an audit, plan, or static document as proof that a protected system is safe.
- Keep protection reads and checks scoped to the affected boundary.

## Stop and escalation

Stop before protected execution when the relevant boundary, target, authority, or rollback path is uncertain.
Use Terra for scoped static/document verification.
Recommend Sol when complex DB/Auth/RLS/Provider/Payment/Runtime/Security risk judgment is required.
Report the boundary decision, evidence consulted, unperformed checks, and remaining risk without inventing a new policy.
