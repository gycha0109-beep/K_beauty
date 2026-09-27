# TRUST Phase 8I-2A — Official Source Transport Foundation

## Purpose

Phase 8I-2A introduces a transport-only monitoring layer for official Evidence Sources that currently support Product Fact Current. It is deliberately separate from semantic verification, Product Fact adjudication, and governed source relocation.

## Live fleet authority

The fleet is computed dynamically from:

`product_fact_current -> product_evidence_records (support_direction='supports') -> product_evidence_sources`

and the official-source kind allowlist.

At the Production dry-run boundary this resolves to 35 source identities and 25 unique effective transport targets.

The resolver does not depend on `catalog_trust_intake` or subject-binding state. This is required so the two Torriden sources with zero intake rows and the Dr.G `equivalent_presentation_match` source remain monitored.

## Historical versus effective locator

Historical Evidence Source identity remains immutable.

- no confirmed relocation: effective locator = historical canonical locator
- confirmed relocation: effective locator = latest confirmed replacement locator
- inconsistent relocation/replacement binding: `DB_INVARIANT_BLOCKED`

The Derma regression fixture must retain the historical `www.dermafactory.net` locator while probing the confirmed replacement `dermafactory.net` locator.

## Transport states

The transport probe returns only:

- `HEALTHY`
- `REDIRECTED`
- `MISSING`
- `TRANSIENT`
- `BLOCKED`

Transport state never means semantic sameness or Product Fact validity.

## Observation and incident authority

Transport observations and incidents are append-only operational evidence.

A confirmed incident may be created only for:

- repeated `REDIRECTED` observations with the same final locator
- repeated `MISSING` observations (404/410)

The anomaly must persist for at least 30 minutes across independent probe groups. One continuous anomaly episode creates at most one incident. A non-matching observation ends the episode, allowing a later recurrence to create a new incident.

`TRANSIENT` and `BLOCKED` never create relocation incidents.

## Network boundary

The worker deduplicates by effective target key:

`35 source identities -> 25 current effective network targets -> source-level observation fan-out`

Same-host probes run sequentially; up to three host groups may run concurrently.

The transport probe reuses the existing SSRF protections, performs GET with manual redirects, re-validates every redirect target, and does not consume response bodies. Content type is metadata only; a 2xx PDF or other non-HTML resource is transport-healthy.

## Non-negotiable invariants

- no historical Evidence Source locator or digest mutation
- no Product Fact Current mutation
- no Product Fact confirmation creation
- no automatic 8G verification profile creation
- no semantic SAME/CHANGED result
- no replacement binding creation
- no old binding retirement
- no automatic relocation confirmation
- no intake requirement for fleet membership
- no external-network dependency in required PR CI

Phase 8I-3, not this foundation, owns any future handoff from confirmed transport incidents into identity qualification and the existing Phase 8H relocation lifecycle.
