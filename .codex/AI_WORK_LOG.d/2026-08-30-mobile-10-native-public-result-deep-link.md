# MOBILE-10 — Native Public Result Custom-Scheme Reentry

- Task type: design → bounded execution → verification
- Base exact main: `93faf9828518521fd1065e50bd77a643de522aac`
- Scope: `bejewely://r/{shareId}` custom-scheme reentry to the existing anonymous `GET /api/results/{shareId}` public-read authority and native read-only presentation.
- Protected routing: DB/Auth/RLS/Storage/Provider/Payment/Secret mutation = N. Production/deployment association = excluded; no Android HTTPS App Links, iOS Universal Links, domain association, hosted redirect or store configuration is changed.
- Preserved authority: server controls publication visibility, share-id canonical parsing, anonymous/user rate limits, public DTO projection, analysis/recommendation/Premium policy.
- Runtime target: Android `ACTION_VIEW` with `bejewely://r/invalid` proves installed-app routing without manufacturing or reading production public data. Real valid-public-result runtime remains `NOT OBSERVED` unless a safe fixture is explicitly available.
- Verification set: MOBILE-5/7/8/9 regressions, MOBILE-10 verifier, mobile typecheck/config/prebuild/native contract, full Native Shell APK/emulator smoke, PR review/readback, exact-main replay, artifact/logcat inspection.
