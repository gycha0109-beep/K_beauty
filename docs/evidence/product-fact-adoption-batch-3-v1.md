# V2.1-8C — Frozen Pilot Supported-Fact Completion

- Batch: `v21-8c-frozen-pilot-supported-fact-completion`
- Source main: `a13e27e9e3dae0b5a38bab3324c587b99e8495d5`
- Frozen supported confirmation-eligible: **23**
- Hosted initial Current: **13**
- Remaining supported set: **10**
- New subjects: **0**
- Expected final Current: **23**

## Remaining exact set

- M2 / contains_active / `386ee490eb6db1028a882d61fe367d5ad9d44fb381c5a136b2ff92ab9d451446` / "panthenol" / dependency=none
- M2 / active_concentration / `0f99e79e0ac8dea9709408ba2fc30926cdbc1531aecdb64efa1372120a50a7ee` / {"amount":5,"unit":"percent"} / dependency=same_batch_parent
- P3 / contains_active / `1c8be56a7ffca1f92b504e71869bb4837bd6f8dad9a34a99fe0f633d44c15506` / "lactic_acid" / dependency=none
- P3 / contains_active / `b5b242ca1dac5937a17f91e11fceef51553ca90b05549c10f0574ccdf393e348` / "salicylic_acid" / dependency=none
- P3 / pad_surface_texture / `4ab8ddaeb4b84042635fa47846946b09bf202972b87eeaff694049c93752e06a` / "embossed" / dependency=none
- P3 / wipe_off_use / `5a48189d6158fb9bc8f994779e766adba162c3e9d13b5ff73dfccdf1fe4757db` / true / dependency=none
- T2 / active_concentration / `7e3f44c47ef50a94953249bed4ae484b1a8ee7995fd05e1d497d07c6229763b2` / {"amount":10,"unit":"percent"} / dependency=existing_hosted_parent
- T2 / contains_active / `8178abcf346b1779b649fa935b0dec0d5ea874c9394081dc898debe1172d9c18` / "sodium_hyaluronate_crosspolymer" / dependency=none
- T2 / recommended_use_frequency / `f4c8b638c67996c9d20af9b39f71e44512ba47ec649ac89d5f31ea27b2d0834d` / {"min":1,"max":1,"unit":"times_per_day"} / dependency=none
- T3 / recommended_use_frequency / `6a251131fe601a73b41f4112231423346ba6198dfded3cabf09fffd010b23a1b` / {"min":2,"max":2,"unit":"times_per_day"} / dependency=none

## Exclusions

- M1: source_blocked
- M3: source_blocked
- P1: source_blocked
- P2: identity_ambiguous
- T3: reviewed_not_established / active_concentration
- T3: evidence_insufficient / hydration_change
- P3: reviewed_not_established / active_concentration
- P3: reviewed_not_established / active_concentration

## Batch 2 Hosted authority correction

The rows below are read-only authority corrections. Historical Batch 2 artifacts and DB rows are not rewritten.

- `61a9e96f7bc31ce1ed67304a4af2592ca7d27c7b931c57a786bf75807e170913`: FI=`ed8b3bcb-b9b7-41b7-8e62-d2a349f0c45f`, confirmation=`98e23691-98df-41eb-876f-46a17f790eda`, evidence=`77a64faa-51c7-416b-8aa9-2b29d98e4906`, source=`3fa2f78b-d7c4-4355-bbda-79e747a3ea99`, binding=`f1734dc9-8ad2-458d-a976-966bfe6e6ef8`
- `b7b5726258b05371f9486d243e703f165b8fd3ea09d158bbdd60d8248e2c11b9`: FI=`d97b73b3-401b-4fe3-8a28-59a727a8ccc0`, confirmation=`e43940ea-0a52-4edc-aa7f-d08e2770f1ad`, evidence=`edc9bdd1-87c1-42f3-8eeb-5fb0e35d9367`, source=`3fa2f78b-d7c4-4355-bbda-79e747a3ea99`, binding=`f1734dc9-8ad2-458d-a976-966bfe6e6ef8`
- `6b1aecc4a6e4e78e178e68c3310c756b3a87a1b9610938c92e53ac5771eb9c1a`: FI=`8b2e9031-4c88-4fae-9179-2876c5fff110`, confirmation=`88215ded-b038-49b1-8cac-f25c0747c763`, evidence=`2cc344f4-8e48-4b90-8222-6a7ebe61259d`, source=`4f74de41-9515-495c-8c93-19ab1cd3cf6d`, binding=`2fc36710-b0db-4210-afc0-60c4ac488de0`
- `89703d12e70171885f5a0db6edb1920bbd3e1ae3f2dc652c0511d93643bc1c55`: FI=`532138b9-fd99-49a3-b5ae-9ad677162055`, confirmation=`5030d053-6783-499e-b714-613cdcacc7f3`, evidence=`42d8fc22-2348-470b-a89a-6eddac9fe14c`, source=`f5eb21f8-4829-4c9b-b927-ccdfb43cdd1b`, binding=`c674e798-f8bd-40f6-9add-ec5b64a4525f`
- `f13b69729b2a15b9c1a86c4dbaa5a9718ae71e12d21ca5d8950e2e19fc39d00a`: FI=`f1b5f4c9-d099-4594-9b3c-73b13bd3ce00`, confirmation=`56798708-0b7d-42b5-a2ae-2be2ed0e2c5a`, evidence=`9f4e862b-e16a-4858-b67a-72daa09bd1ac`, source=`f5eb21f8-4829-4c9b-b927-ccdfb43cdd1b`, binding=`c674e798-f8bd-40f6-9add-ec5b64a4525f`

## Boundary

- Frozen authority completion only; no new evidence research.
- No Subject registration is planned.
- No production Decision Axis consumption or recommendation activation.
- Source-blocked / ambiguous / RNE / insufficient candidates remain unadopted.
