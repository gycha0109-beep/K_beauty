# TRUST-P20 Torriden KR Identity / SPF-PA Source Recovery v1

## Result

`KR_CURRENT_IDENTITY_REVISION_AND_DIRECT_SPF_PA_SOURCE_RECOVERED`

Target: Torriden `다이브인 워터리 모이스처 선크림` (`57e4a5ec-115d-4322-85a1-7976db669700`), 60ml, KR.

## First-party recovery

The prior P6 boundary was `IDENTITY_FORMULATION_REVISION_REVIEW_REQUIRED` because the catalog used the legacy Korean display name while the current Torriden page used `다이브인 모이스처 선크림 60ml`.

Fresh first-party review recovered the missing authority boundary:

- official `goodsNo=173` still exposes the catalog-exact legacy display name `다이브인 워터리 모이스처 선크림 60ml`;
- official current `goodsNo=252` exposes `다이브인 모이스처 선크림 60ml` with the same `DIVE IN Moisture Sun Cream` package identity and the same official `MoistureSunCream` detail-asset namespace;
- the current Torriden suncare category separately lists `다이브인 무기자차 마일드 선크림 60ml`, so the Mild Sun Cream is not the target and no cross-product claim transfer is allowed;
- the current `goodsNo=252` product image directly labels the product `SPF50+ PA++++`;
- current official detail assets mark this Moisture Sun Cream presentation as `NEW` / `UP-GRADE`.

## Formulation boundary

This track resolves only the **current KR upgraded Moisture Sun Cream presentation** for a deterministic adoption plan.

It does **not** assert that every historical pre-upgrade formulation is identical to the current formulation. No historical SPF/PA transfer is needed because the current official product route itself carries the direct `SPF50+ PA++++` claim.

## Recovered facts

- `spf_value`: supported, number `50`, qualifier `{"plus_modifier":"plus"}`, KR, product-specific primary, high confidence.
- `uva_label`: supported, enum `PA++++`, KR, product-specific primary, high confidence.

## Production boundary

Production prestate remained:

`Subjects 22 / Sources 23 / Bindings 23 / Evidence 52 / Fact Instances 52 / Evidence Links 52 / Review Assignments 52 / Confirmations 52 / Current 52`

Torriden target: `Subject 0 / Current 0`.

This research track authorizes **no** Product Fact write. No Subject registration, Evidence ingest, Confirmation, Registry/schema/RPC change, recommendation change, or ranking change is performed here.

Next gate:

`SEPARATE_DETERMINISTIC_HOSTED_ADOPTION_PLAN`

Research content SHA-256: `aa6a050e9a31d97203693460ea76ec64927c247399b68e1b80fe71fe32c81e74`
