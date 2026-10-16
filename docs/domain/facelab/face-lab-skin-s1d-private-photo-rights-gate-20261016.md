# Skin Track S1-D — Private photo rights and processing gate (2026-10-16)

This is a **metadata-only research check**, not consent verification, photo upload, eligibility judgment or Provider execution permission.

The five locally supplied JPEGs are readable and their research case IDs are TC-01 to TC-05. Their smallest image dimensions are 582, 371, 273, 413 and 452 pixels. Whole-frame grayscale values below 45/255 cover about 7.26%, 24.73%, 0.20%, 0.39% and 86.79% respectively. Those metrics include all background regions and cannot independently establish a Skin issue. TC-03 is resolution-limited; TC-04 is partial-face; TC-05 is dramatically underexposed.

The current local manifest marks every case as **rights unverified** and external transfer **blocked**. The files have not been sent to OpenAI or GitHub Actions. Key2's confirmed availability as a GitHub Repository Secret does **not** authorize facial photo transfer and must not be used to load photos through standard CI.

`skin-private-photo-governance-gate.mjs` accepts **only** anonymous case IDs, three operator declarations per case (source rights, depicted-person permission, AI Provider transmission disclosure/permission), and six policy review states (purpose restriction, private access, retention deadline, withdrawal/deletion, independent Human review, privacy-owner review). Missing, malformed, duplicate, URL/photo/file/name-bearing or unexpected fields fail closed. Even if all declarations read `operator_documented`, this module cannot verify the supporting evidence or private processing controls; it **always reports Provider execution unauthorized**.

Run synthetic-only:
`node scripts/facelab/skin/verify-skin-private-photo-governance-gate.mjs`

The independent reference labeling and real human-photo paired v1/v2 evaluation remain pending. No diagnosis, unverified zero-to-negative inference, changes to recommendation scoring/Top Pick/Style, DB/Storage, or production exposure are permitted from this gate. Separate owner's rights/retention approval and a private secret-injected processing route are necessary before any live human-photo evaluation. Product Ready / Release Ready remain HOLD.
