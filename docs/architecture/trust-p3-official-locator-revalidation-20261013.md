# TRUST P3 official locator freshness – bounded verification (2026-10-13)

## Observed public brand evidence versus executable source evidence

This branch freezes **existing official-bound URL plus one independently observed official candidate URL for each of three products**. Publicly indexed brand-page text and the earlier GitHub runner response are **separate observation channels**. A publicly indexed title is neither a recent robots authorization nor an exact-variant or formulation guarantee.

1. **Torriden KR 60 ml** — governed `goodsNo=252` indexed first-party title **다이브인 모이스처 선크림 60ml**; alternate `goodsNo=173` indexed first-party title **다이브인 워터리 모이스처 선크림 60ml**, equal to the catalog label. Both remain **separate product locators**, not a proven shared formulation or redirect. Recorded index sources are their corresponding `https://www.torriden.com/goods/goods_view.php?goodsNo=...` pages.
2. **Beauty of Joseon 50 ml** — existing `/products/relief-sun-rice-probiotics` may be inaccessible to the live worker; indexed brand page and an alternate `/products/relief-sun-rice-probiotics-spf50-pa-uk` show renamed **Relief Sun: Rice + Niacinamide**. Its brand-authored FAQ says old Rice + Probiotics and new Rice + Niacinamide have unchanged formula, ingredients and size; this is direct brand **rename evidence**, not permission to extrapolate UK variant and market to global/KR. A fresh blocked original URL stays HOLD.
3. **Aestura 40 ml** — governed KR `/web/product/view.do?prdSeq=1108` is publicly indexed as **더마UV365 레드진정 톤업 선크림**. Its separately governed international `https://int.aestura.com/products/derma-uv365-red-calming-tone-up-sunscreen` displays **DERMA UV365 Red Calming Tone-up Sunscreen** with a 40 ml choice **and a 25 ml alternative**. Do not merge localized names or markets/formulations solely from this correspondence.

The frozen observation file `evidence/trust/p3-official-locator-revalidation-cohort-v1.json` documents specific page URLs, indexed displayed titles, size, interpretation and source. Original evidence remains in [P3 real run #38341012942](https://github.com/gycha0109-beep/K_beauty/actions/runs/38341012942) and metadata artifact `11786831368`.

## Guarded actual live acceptance

`scripts/trust-p3-official-locator-revalidation.mjs` only runs real requests when both `TRUST_P3_LOCATOR_LIVE_ENABLED=true` and `--execute` are supplied. A single-use `P3-LOCATOR-LIVE-TRIAL` marker on **merged main** activates a job in the **existing** TRUST static owner (not a new workflow). The fixed cohort permits three products, exactly six HTTPS URLs and four official origins; at most one robots GET per origin and two product GETs per origin, obeying robots/crawl-delay and strict origin/SSRF checks. Failed or changed locators become HOLD. Reports store only bounded semantic diagnostics, source URL and SHA-256 digest, **no HTML, no full ingredient list, no credentials**.

Decision contract: a candidate pass means **human review**, never exact SKU confirmation; every page has zero authority to create/change Source Binding, Subject, Fact Current, Recommendation or production catalog. Automatic success rate or zero false-positive claims cannot be made from a crawler name match. Run tests within canonical TRUST and store metadata artifact for line-by-line review. If the results are blocked, do not retry by bypassing robots.

Follow-up gate: independently verify exact product label, quantity/package configuration, region and formulation revision for every proposed canonical locator. Only after review may a separate governed transaction modify source binding or linked Product Fact.
