# TRUST Phase 8G Production Canary Attempts

## Attempt 1 — Round Lab Birch Moisturizing Soothing Gel

- Workflow run: `35905607662`
- Source ID: `7abf5c75-a442-4c55-853b-58685bc99a23`
- Adapter: `live-page-bytes / v1`
- Baseline digest: `5c00773357d2ab2d3cd10d302fb3ec4d05a5b19a09a71ada8ae9d0cb7747f50d`
- Verification digest: `ec0b48268d33d43aba2fdd2ae9959f9a5a71450fbf1047557f781055ed0cf317`
- Baseline bytes: `916587`
- Verification bytes: `916587`
- Result: `stable=false`
- Authority mutation: `false`

The exact live HTML byte representation changed across two fetches approximately 2.5 seconds apart while the byte length remained identical. No COMPARABLE profile was registered. This source is not eligible for a `live-page-bytes-v1` baseline from this attempt.

## Attempt 2 — Dr.G Green Mild Up Sun+

- Workflow run: `35906308635`
- Source ID: `a2803387-44e3-40fa-87c9-a7aec7d745f3`
- Adapter: `live-page-bytes / v1`
- Result: `TRANSIENT_FAILURE:http_429`
- Retry-after policy: `900 seconds`
- Authority mutation: `false`

The official source rate-limited the GitHub-hosted fetch before a baseline observation could be captured. No COMPARABLE profile was registered. Expected source-blocked or transient outcomes remain fail-closed but are represented as structured canary results rather than making the deterministic TRUST CI contract itself red.

## Attempt 3 — Torriden Dive-In Mild Sun Cream (raw bytes)

- Workflow run: `35907173236`
- Source ID: `2d154999-5dff-4496-9b1e-d8cf9c6f31f6`
- Adapter: `live-page-bytes / v1`
- Baseline digest: `eceb46911211f7c523ec90bf51679881aba64294232641ab6b23d2946728c9ca`
- Verification digest: `eefea0e588198983bb5166aea5c1a7fee1a049b54f8c6e8054fc2acf96a1c861`
- Baseline bytes: `176214`
- Verification bytes: `176214`
- Result: `stable=false`
- Authority mutation: `false`

A second independent commerce site also changed raw HTML bytes within approximately three seconds while preserving the exact response length. Together with Attempt 1, this rejects raw page bytes as the default fresh-recovery adapter for dynamic storefront HTML. The next canary keeps the same reviewed Torriden source but switches to `canonical-html-text / v1`.
