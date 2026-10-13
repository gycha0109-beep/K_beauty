# TRUST P2-D catalog variant diagnostics and guarded official discovery

## Independently observed baseline

- Old [live five-brand run](https://github.com/gycha0109-beep/K_beauty/actions/runs/38332070497): 2 fetched pages, 1/5 name candidates, 0 exact-SKU or formulation verifications.
- New [diagnostic live run](https://github.com/gycha0109-beep/K_beauty/actions/runs/38334932657): identical results, now candidate locator/title/digest recovered.
- Atopalm product `bd98f785-15c8-4800-af64-d39c3ad873a0`: catalog `size_ml=600` from read-only Supabase.
- Both previously counted candidate pages are not the catalog size: [new-member 60ml](https://neopharmshop.co.kr/product/%EC%8B%A0%EA%B7%9C%ED%9A%8C%EC%9B%90-%EC%9B%B0%EC%BB%B4-%EC%95%84%ED%86%A0%ED%8C%9C-mle-%EB%A1%9C%EC%85%98-60ml/3606/) and [member-price 300ml](https://neopharmshop.co.kr/product/%EC%8B%A0%EA%B7%9C%ED%9A%8C%EC%9B%90%ED%8A%B9%EA%B0%80-%EC%95%84%ED%86%A0%ED%8C%9C-mle-%EB%A1%9C%EC%85%98-300ml/3453/). Original 20% was candidate yield, **not** correct SKU identification; false-positive rate not estimable without independent labels.

## What changed

- Frozen size-scoped 5-brand cohort v2, original v1 and live evidence retained.
- Positive name signal + explicit wrong title volume becomes `CATALOG_SIZE_MISMATCH` (review-only), including possible 300ml×2 bundle hold.
- Same-origin, robots-approved, bounded homepage index fallback only after sitemap+peer miss; recognize brand-prefixed labels and numeric official detail paths for Beplain/Torriden.
- No Subject, Product Fact, recommendation, schema or AI API writes. No blocked-domain workaround. Existing canonical CI only.

## Gates

Static regression, exact-head CI, live remeasurement and independent page adjudication. It is **not** authorized to create Subject or confirm Facts.

Watchtower-Track: pipeline-reliability
