# TRUST-P27 — BOJ Aqua-Fresh Global UV Filter Type Adoption Plan

## Status
`PHASE_A_FREEZE_ONLY`

No Production Product Fact write is authorized by this artifact.

## Target
- Product: `조선미녀 / 맑은쌀 선크림 아쿠아프레쉬`
- Product ID: `765b3ca1-6927-49b0-bee6-4138d03dd915`
- Subject: `1b735d5e-bc57-4808-9f48-b4bb82f3e8fa`
- Variant: `Relief_Sun_Aqua_Fresh_Rice_B5_50ML`
- Fact: `uv_filter_type=organic`
- Existing legacy projection: `organic`

## First-party authority
Beauty of Joseon's first-party article directly identifies Relief Sun Aqua-Fresh: Rice + B5 as a chemical sunscreen. The Product Fact controlled vocabulary maps `chemical sunscreen → organic`. This is controlled vocabulary normalization only; there is no UV-filter ingredient inference, cross-product inference, or third-party positive support.

Source: `https://beautyofjoseon.com/blogs/news/mastering-relief-sun-and-aqua-fresh`

The old P7/P8 BOJ Source is deliberately not reused because its frozen digest covered SPF/PA claims, not this chemical-sunscreen declaration. P27 creates a new frozen Source observation and a new exact Subject binding while reusing the existing Product Fact Subject.

## Deterministic identity
- Proposition: `3a1e4f93a85a853f61bdbc6786d61c72cda504f1e5019f282d24cdbe0acf796d`
- Frozen Source digest: `947661aa34f992cabeb31bd6dd279149dbe7287a8b4843b2ace932d0c9df66b4`
- Canonical Evidence digest: `0e69a35bb1ff4dced32a8d5b690e7f6faba9281dc06223d36daaf94967bbf2df`
- Plan digest: `be917158b2a6774010e407a88f427e63a30c2c3990ce382845bcdfb1b93273da`

The proposition serializer object shape is the same deterministic shape already verified by TRUST-P26 historical vectors.

## Production prestate
Checked at `2026-09-14T15:35:36.986213+09:00`:
`25 / 26 / 26 / 59 / 59 / 59 / 59 / 59 / 59`
for Subject / Source / Binding / Evidence / Fact Instance / Evidence Link / Review Assignment / Confirmation / Current. Products remain `165`.

All Source/Evidence/Proposition/Current/Open-Review/Request-ID collision gates are `0`.

## Planned Phase B delta
`+0 Subject / +1 Source / +1 Binding / +1 Evidence / +1 Fact Instance / +1 Evidence Link / +1 Review Assignment / +1 Confirmation / +1 Current`

Only governed Product Fact RPCs may perform Phase B.

## Recommendation boundary
`uv_filter_type` is an active Recommendation scoring input, but this plan does not cut Recommendation runtime authority over to Product Fact. It does not alter Product rows, corpus membership, admission policy, scores, ranking code, or sunscreen admission. Sunscreen initial admission remains `INITIAL_ADMISSION_AUTHORITY_INSUFFICIENT`.

## Next gate
Phase B remains blocked until exact-head CI, fresh-main preflight, expected-head merge, merged-main CI, fresh Production prestate, and confirmation preflight `ready` all pass.
