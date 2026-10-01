# Face Lab V2 Simulation Provider Config Contract v1

> Track: Face Lab / Gate G-E2A-1A
> Status: provider runtime authority foundation
> Production activation: unchanged
> Calibration propagation: deferred to G-E2A-1B

## Purpose

This contract gives one deterministic identity to the provider configuration that actually produced a Face Lab simulation image.

The provider-config fingerprint is not a quality score. It is an experiment-control identifier.

## Version

Provider config version:

    face-lab-simulation-provider-config-v1

The version is part of the normalized config and therefore part of the fingerprint.

## Authoritative fields

The normalized config contains exactly:

- configVersion
- provider
- operation
- endpoint
- model
- quality
- size
- outputFormat
- n

For the current OpenAI image-edit runtime the resolved values are:

    provider     = openai
    operation    = images.edit
    endpoint     = https://api.openai.com/v1/images/edits
    model        = gpt-image-2.5-sunburst
    quality      = high
    size         = auto
    outputFormat = png
    n            = 1

## Fingerprint

The fingerprint is SHA-256 over the repository's stable Face Lab authority serialization of the normalized config.

Object key ordering must not affect the fingerprint.

A change to any authoritative field must change the fingerprint.

## Explicitly excluded fields

The following are not provider-config authority:

- API key or Authorization material
- prompt / compiled instruction
- request ID
- source or output image bytes
- source or output image hashes
- usage
- duration
- response byte counts
- timeout
- max input bytes
- max response bytes
- user/account identifiers

Operational safety limits may change without creating a new provider-config fingerprint.

## Request binding

The OpenAI runtime must first resolve the normalized config.

The actual multipart request must then use that same resolved config for:

- fetch endpoint
- model
- quality
- size
- output_format
- n

No parallel hard-coded request value may override the resolved config.

## Runtime result

A successful provider runtime result contains the server-internal normalized providerConfig and providerConfigFingerprint.

The Face Lab simulation service independently normalizes and fingerprints providerConfig again.

If the recomputed fingerprint does not exactly match providerConfigFingerprint, the simulation fails closed with:

    simulation_provider_config_invalid

## Simulation result envelope

The provider-neutral Face Lab simulation result exposes only:

- provider
- model
- providerConfigVersion
- providerConfigFingerprint

The full providerConfig object remains internal to the runtime/service boundary.

Provider and model in the simulation result are derived from the validated provider config, not from an untrusted parallel result field.

## CI mutation contract

The verifier requires a fingerprint change for mutations to:

- provider
- operation
- endpoint
- model
- quality
- size
- outputFormat
- n

The verifier requires no fingerprint change when only non-authority runtime fields are added, including timeout or byte limits.

It also verifies that secret, prompt, image, request-ID, and usage material cannot enter the normalized config.

## Scope boundary

Gate G-E2A-1A ends at the simulation result envelope.

The following propagation is intentionally deferred to G-E2A-1B:

- simulation response headers
- Review Ticket binding
- Review API trace
- G-B evidence packet trace
- G-E calibration case
- campaign-level single-fingerprint enforcement

No real provider call is introduced into CI.
