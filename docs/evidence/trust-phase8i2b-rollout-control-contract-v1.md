# TRUST Phase 8I-2B1 — Live Fleet Rollout Controls

## Purpose

Phase 8I-2B1 makes the Phase 8I-2 transport foundation safe to connect to the public network. It does not perform the live rollout itself.

## Explicit execution authority

The transport worker requires all of the following before any network request:

- `scope=canary|full`
- explicit `record=true|false`
- expected source count
- expected target count
- no `DB_INVARIANT_BLOCKED` resolver targets

Canary scope additionally requires the checked-in canary manifest. Full scope may receive the prior independent observation's fleet snapshot digest and fails before network access when the live fleet differs.

## Canary authority

The checked-in canary manifest contains five effective targets representing ten source identities:

1. Derma Factory — confirmed relocation + three-source fan-out
2. Torriden — two zero-intake source identities sharing one target
3. Beauty of Joseon — three source identities sharing one target
4. Dr.G — Current-dependent equivalent-presentation source
5. Anua technical guide — official technical-document transport

Manifest locator/source membership is compared to the live resolver before network access. Any mismatch fails closed.

## Fleet digest

A deterministic SHA-256 is computed over sorted tuples:

`source_id, target_key, effective_locator, target_status`

Full pass #2 can require the fleet digest from pass #1. A mismatch produces `TRANSPORT_FLEET_CHANGED_DURING_ROLLOUT` before any network request.

## Network pacing

- at most three host groups concurrently
- targets sharing a hostname remain sequential
- default one-second delay between successive targets on the same host
- no internal HTTP retry
- existing SSRF and redirect-target protections remain authoritative

## GitHub Actions boundary

Live transport is permitted only through manual `workflow_dispatch` with `transport_mode=canary|full`.

Pull-request and push verification remains deterministic and performs no external transport probes.

Existing manual Phase 8H-3 Derma/research canaries run only when `transport_mode=none`, preventing transport rollout dispatches from triggering unrelated live probes.

Live rollout requires the exact main SHA plus repository secrets `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

## Live result gate

Hard failure:

- resolver DB invariant blocked
- manifest stale
- fleet count mismatch
- expected fleet digest mismatch
- recorder/RPC failure
- unsafe/private/invalid redirect target
- redirect limit exceeded

Degraded but not automatically unsafe:

- TRANSIENT
- DNS resolution unavailable during safe public-host validation (`ENOTFOUND`, `EAI_AGAIN`) is normalized to TRANSIENT; no network fetch proceeds and private/unsafe resolution remains BLOCKED
- HTTP 401/403/451 BLOCKED

Canary holds at two or more degraded targets. Full fleet holds at 20 percent or more degraded targets.

## Mutation boundary

Phase 8I-2B1 introduces no database migration and performs no live network call while being reviewed.

It must not mutate:

- Product Fact Current
- historical Evidence Source identity/digest
- Product Fact confirmations
- reviewed source bindings
- confirmed relocation authority

After this control PR merges, the next authorized operation is the five-target Production live canary.
