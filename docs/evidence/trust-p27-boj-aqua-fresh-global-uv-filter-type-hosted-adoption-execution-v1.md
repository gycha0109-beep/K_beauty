# TRUST-P27 — BOJ Aqua-Fresh Global UV Filter Type Hosted Adoption Execution

## Status

`TRUST_P27_PRODUCTION_ADOPTION_CONFIRMED`

TRUST-P27 adopted one governed Product Fact for Beauty of Joseon `맑은쌀 선크림 아쿠아프레쉬`.

- Product: `765b3ca1-6927-49b0-bee6-4138d03dd915`
- Subject: `1b735d5e-bc57-4808-9f48-b4bb82f3e8fa`
- Fact: `uv_filter_type=organic`
- Market: `GLOBAL`
- Authority: `product_specific_primary`
- Confidence: `high`

The first-party frozen observation directly declares the exact product a `chemical sunscreen`; the registry value is the controlled-vocabulary normalization `organic`. No ingredient-class or cross-product inference was used.

## Controlled execution

Only governed Product Fact RPCs were used.

1. Existing resolved/current Subject reused.
2. New frozen first-party Source and exact-subject Binding inserted because the historical BOJ SPF/PA Source digest did not freeze the chemical-sunscreen declaration.
3. Evidence ingested.
4. Review assignment moved `under_review → ready_for_confirm`.
5. Confirmation preflight returned `ready`.
6. Confirmation used the exact preflight payload/prestate digests.
7. A duplicate exact-retry request was blocked by the connector safety preflight before reaching Production. No second write occurred; database request uniqueness and one-row Confirmation/Current readback were verified directly.

No direct Product Fact DML, Product mutation, Registry/schema/RPC mutation, Recommendation authority cutover, or admission-policy change occurred.

## Runtime lineage

- Source: `a9d3f7fa-a44d-4e43-ba64-9c68acf6628e`
- Binding: `ca3df22e-6239-4572-b21d-148f44053a56`
- Evidence: `eba42d10-5769-421e-912e-879688190691`
- Assignment: `f815e8a6-8c31-4763-afe0-b87ae5f23e48`
- Fact Instance: `fb75353a-1915-41c0-bd63-e251b99c0acd`
- Confirmation: `53e40483-62be-45ca-9730-0aa1fc92d319`
- Proposition: `3a1e4f93a85a853f61bdbc6786d61c72cda504f1e5019f282d24cdbe0acf796d`
- Source content digest: `947661aa34f992cabeb31bd6dd279149dbe7287a8b4843b2ace932d0c9df66b4`
- Canonical evidence digest: `0e69a35bb1ff4dced32a8d5b690e7f6faba9281dc06223d36daaf94967bbf2df`
- Fusion input digest: `7f29581a20013c44d32613b057f259d265c1ae43a6970b2bcf4483fc37aa5dbe`
- Payload digest: `8ca2324ff621dc65675726c8487727abbc5c2ce3b8b350fc9f95a9839fa0ec02`
- Prestate digest: `9aabf9c6f8b999831490d6bc9aecdacea8a62e05e9f024ab46b4dd6f9756ce69`
- Result digest: `bbbef5d8368f1ac6c9288030c47bc36e9786650b9b5fa960a11c19cd0c3d8806`

## Production delta

Prestate:

`25 / 26 / 26 / 59 / 59 / 59 / 59 / 59 / 59`

Poststate:

`25 / 27 / 27 / 60 / 60 / 60 / 60 / 60 / 60`

Actual delta:

`+0 Subject / +1 Source / +1 Binding / +1 Evidence / +1 Fact Instance / +1 Evidence Link / +1 Review Assignment / +1 Confirmation / +1 Current`

The planned delta matched exactly.

Products remain `165`; the legacy target row remains `uv_filter_type=organic` and was not mutated. Exactly one Confirmation row exists for the controlled confirmation request and exactly one Current row exists for the proposition.

## Historical Current invariance

TRUST-P24 Isntree KR SPF/UVA, TRUST-P25 SKIN1004 US SPF, and TRUST-P26 AESTURA SPF/UVA/UV-filter Current pointers remain on the same Fact Instance / Confirmation IDs. No historical Current was superseded.

## Post-write deployed runtime verification

The exact merged Phase-A deployment SHA `d5413c606e2f245fa357c3bbd802bc42f85922ae` was probed again **after** the Product Fact write.

GitHub Actions:

- workflow run: `34814556228`
- rerun deployed-runtime job: `103886826748`

Runtime authority probe:

- result: `PASS`
- raw Product Fact select denied: `true`
- authority status: `AUTHORITY_RESOLVED`
- secret exposed: `false`

Recommendation parity replay:

- Products / overlay: `165 / 165`
- admitted Recommendation: `164 / 164`
- overlay-only: `1`
- missing legacy / unexpected live: `0 / 0`
- scenario count: `8`
- score delta: `0`
- slot delta: `0`
- full-order delta: `0`
- Top1 delta: `0`
- Top3 delta: `0`
- every scenario full-order / Top1 / Top3 equal: `true`
- `recommendationRuntimeCutover=false`

Therefore the new governed `uv_filter_type=organic` Current exists without changing Recommendation behavior or admission authority.

Execution content SHA-256: `8e00fb14232a6dda9ed63a781789770d533e57400f94ef00846e6777ac2b8ed9`
