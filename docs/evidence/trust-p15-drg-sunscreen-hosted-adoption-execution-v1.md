# TRUST-P15 — Dr.G Green Mild Up Sun Plus Hosted Adoption Execution v1

## Status

`PRODUCTION_CONFIRMED`

TRUST-P15 Phase B executed the merged deterministic plan through the controlled Product Fact RPC lifecycle only.

- plan merge: `26407faea37effd2ecb730c35d23ad9808eb6fc8`
- plan blob: `d2fa47268ca8ed796a4015d2034a8676952c2634`
- plan SHA-256: `d515a8172644aa727ef836ed5ec68e69e5d73e73dbe369141d45154a9473e0a4`
- execution capture main: `30500ec5ad4c0e1ccd939e1c78a918a0b7eb27fa`
- Production: `bygrczggxfuisupcevaz`

## Controlled runtime identity

- product: `dc1ef3f3-db1b-4c3f-954a-b18343e3d9f3`
- Subject: `15e25e11-935d-4b04-aa59-68de0531ef39`
- Source: `ceb9056a-b36b-48f9-9558-e5c5ed325e88`
- Binding: `8ea05ae9-cb60-4743-88c1-b8990e8d997a`
- binding: `equivalent_presentation_match / equivalent`
- Source locator: `https://www.dr-g.co.kr/item/4415`

## SPF confirmation

- Evidence: `58b7bfca-acf1-4011-a411-5e010bf9d9ea`
- Assignment: `457ac021-ab22-4e6a-96f8-5a5e145eecde`
- Fact Instance: `78682e94-9f06-4ac6-8b19-edd4f33cc983`
- Confirmation: `1e7e7ba0-cd3d-4509-a6d0-31a3ea47e2f5`
- value: `SPF50+`
- preflight: `ready`
- payload digest: `2eaa18cde458425e3ef34485088e359b5aa451ea95d1b86c9e20500d3251a410`
- prestate digest: `f6ef9da86ade2e05df66cf55f05d2c516c2f27534650acb0cc17f5871c06b961`
- fusion input digest: `ff7d5905cc774ef49ee552a94fe2103843e08b1090aa79b2c142a89723c45192`
- result digest: `5de54c315ecb3aaf22dd55d416e77ce4aaeabc602ab0cd9c865df2b3bebfa7cb`

## UVA confirmation

- Evidence: `3138749e-897d-46f7-8792-21e41049ba6e`
- Assignment: `39d274a5-cf3b-43b9-a6ea-dd7a7a625ee6`
- Fact Instance: `63b9fc15-b8dd-4287-bf3b-68e5945082db`
- Confirmation: `66791e70-ebdf-4ad4-ab9f-b71504e805a1`
- value: `PA++++`
- preflight: `ready`
- payload digest: `19915f3a8ef85ea5a4aa49f11faf5e6f246b7f1a417b1a70285bd9c0b9d6e114`
- prestate digest: `a193ea4adbdca6a57cae0204f7ef3f3939c784ce874a94baaecc914faceec91a`
- fusion input digest: `f2138d826c4530c48d464e144f52349f1160f88f0791e1ab649f75624519f4e6`
- result digest: `a46f7be210d5ad440c7afdb9fbfa49af1464af5edb24c782022f5f9b05eb6a7f`

Both preflights were `ready` before either confirmation. Both confirmation calls then executed in one SQL transaction.

## Production delta

Prestate:

`Subjects 20 / Sources 21 / Bindings 21 / Evidence 49 / Fact Instances 49 / Evidence Links 49 / Review Assignments 49 / Confirmations 49 / Current 49`

Poststate at `2026-09-11T09:31:40.216357+09:00`:

`Subjects 21 / Sources 22 / Bindings 22 / Evidence 51 / Fact Instances 51 / Evidence Links 51 / Review Assignments 51 / Confirmations 51 / Current 51`

Target coverage:

- Subject `1`
- SPF Current `1`
- UVA Current `1`

No direct Product Fact DML, schema/RPC/Registry mutation, or recommendation/ranking change occurred.

Execution content SHA-256:

`bc83563b096695e8b9b4a12c96d608f5763c41062d139e471d58ae69a7c60824`
