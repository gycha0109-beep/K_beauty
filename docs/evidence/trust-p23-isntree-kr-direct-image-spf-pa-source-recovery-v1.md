# TRUST-P23 Isntree KR Direct Image SPF/PA Source Recovery v1

## Result

`KR_EXACT_PRODUCT_AND_DIRECT_SPF_PA_IMAGE_SOURCE_RECOVERED`

Target: Isntree `히아루론산 워터리 선젤` / official KR `히아루론산 워터리 선 젤 50ml` (`336bb533-0fe4-4380-8b9f-ab16fb24b807`).

## Recovery from the P19 boundary

TRUST-P19 correctly froze the boundary because the machine-readable KR page body did not expose direct SPF/PA text and no Global-to-KR formulation bridge had been established.

Fresh review of the exact KR product page recovered a stronger first-party source path that does not require that bridge: the official page directly links its own product-detail image assets. The linked asset `hyaluronic_acid_sun_gel_4.jpg` depicts the exact `HYALURONIC ACID WATERY SUN GEL` 50ml package and directly shows `SPF50+ PA++++`.

Official KR product page:

`https://isntree.com/product/%ED%9E%88%EC%95%84%EB%A3%A8%EB%A1%A0%EC%82%B0-%EC%9B%8C%ED%84%B0%EB%A6%AC-%EC%84%A0-%EC%A0%A4-50ml/145/`

Direct page-linked detail asset:

`https://isntree01.openhost.cafe24.com/product/hyaluronic_acid_sun_gel/hyaluronic_acid_sun_gel_4.jpg`

Observed direct claim:

`SPF50+ PA++++`

The package also shows `UVA/UVB`.

## Adjudication

- KR exact product identity: resolved for a later deterministic plan.
- SPF value: recovered as `SPF50+` / numeric `50` with `plus_modifier=plus`.
- UVA label: recovered as `PA++++`.
- Evidence authority: `product_specific_primary`, confidence `high`.
- Global formulation bridge: not required for these facts because the claim is directly present on an asset linked from the exact KR product page.
- Cross-market transfer: none.
- Cross-product transfer: none.
- Third-party positive Product Fact support: none.

## Production boundary

Fresh prestate:

`Subjects 24 / Sources 25 / Bindings 25 / Evidence 56 / Fact Instances 56 / Evidence Links 56 / Review Assignments 56 / Confirmations 56 / Current 56`

Target: `Subject 0 / Current 0`; KR page locator rows `0`; direct detail-asset locator rows `0`.

This phase performs **zero Production Product Fact writes**. It only recovers and freezes first-party authority.

Next gate:

`SEPARATE_DETERMINISTIC_HOSTED_ADOPTION_PLAN`

Research content SHA-256: `dd8427421e06ff22a72aec067e066347fde2df9e084ed271c6b19addbaf52508`
