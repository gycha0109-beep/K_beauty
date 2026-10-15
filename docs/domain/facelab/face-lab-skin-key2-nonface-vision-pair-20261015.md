# Face Lab / Skin — S1-B KEY2 real-provider v1/v2 NONHUMAN pilot (2026-10-15)

> **Research-only; real Provider billing only if explicitly run.** This evaluation uses a generated RGB geometric PNG in memory; no face, no personal photo, no actual person, no stored sample. No change to user-facing Shared Vision, Style, inference policy, scoring, Top Pick, DB, storage, release or photo permissions.

## Research question

Does the **same permitted test key `OPENAI_API_KEY2`** return parseable responses for two versions of the *existing shared Vision contract* under the **unchanged 2,200 completion-token** cap, on the same **nonhuman test image**?

This is **not** a skin-accuracy test. Nonhuman geometry is chosen specifically to avoid sending the user's five unverified-rights facial photographs to the Provider. A reliable nonhuman-only result cannot prove Face parity on humans, skin axis precision/recall, or whether a full eligible Face+Skin response fits 2,200 tokens. v2 still requires owner review and independent Human evaluation.

## Implementation

- `scripts/facelab/skin/skin-key2-nonface-vision-pair.mjs` generates a 96×96 valid PNG RGB colored block grid; **no disk read/write**.
- Both variants use **identical generated image bytes** and the existing production model, reasoning effort, high image detail, shared JSON transport and strict 2,200-token cap. The v1 prompt is the unchanged `createVisionObservationPrompt`; the v2 candidate prompt comes from the existing unmerged S1-B #1323/#1326/#1328 stack. Neither prompt changes production.
- Fixed synthetic case ID `SYN_GEO_01`; sequence v1 → v2, **one attempt each**, no retries, no other API key fallback. If KEY2 missing, zero calls. If authentication fails on the first attempt, abort the second.
- `inspectSkinVisionTrial()` from #1326 and `summarizeSkinVisionOperationalPairs()` from #1328 evaluate **only in-memory response metadata**; raw Model JSON and PNG are not saved or printed. Only status, token counts, Face availability, v2 axis shape, elapsed time and categorical errors are emitted. Cost estimate remains **unavailable**, not billed cost.
- `verify-skin-key2-nonface-vision-pair.mjs` injects a **mock transport only** to assert two distinct versions on equal image bytes, no fallback, no real-face content, fixed cap, metadata-only output, credential error short-circuit, and safe failure reporting. CI runs **mock-only**; no CI default Provider call.
- `run-skin-key2-nonface-pair.mjs --live-nonface-pair` triggers **two potential billable OpenAI Vision requests** when `OPENAI_API_KEY2` is injected into that process. No dotenv or secret retrieval in source. A transient restricted GitHub Actions runner may be needed because secrets are repository-scoped. Do not place the key in source or GitHub Actions artifacts.

## Actual nonhuman Provider measurement (2026-10-15)

- Exact synthetic-image trigger SHA `f365610fee6de3c947b3ca045deeb44b6e65ea40`: [GitHub Actions #38704168643](https://github.com/gycha0109-beep/K_beauty/actions/runs/38704168643) **SUCCESS**. Mock-only safety test also PASS. **Two separate billed image inputs** (v1 and v2), same generated nonhuman PNG, `OPENAI_API_KEY2` only, production API unchanged.
- **v1**: JSON parsed, `finish_reason=stop`, input 2,769 tokens, output **875** tokens, elapsed **8,251 ms**. Existing inspector: `STRUCTURALLY_VALID`, Face unavailable with 0 assessable fields (expected for nonhuman).
- **v2**: JSON parsed, `finish_reason=stop`, input 3,529 tokens, output **1,615** tokens, elapsed **12,444 ms**. Inspector: `INVALID_OR_INCOMPLETE`, `skinStatus=blocked`, `skin_axis_evidence_incomplete`, Face unavailable/0 fields. Output terminated normally with **585 tokens spare** under 2,200 cap.
- One-pair delta: v2 input **+760 tokens**, output **+740 tokens**, elapsed **+4,193 ms**. A single low-content nonface sample is not a calibrated model performance/cost estimate. Billed dollar costs were **not** established.
- **Interpretation:** `inspectSkinVisionTrial` is a gate intended for eligible face photos. A correct **nonhuman-ineligible** result blocks Skin evidence, making that gate's v2 `skinStatus=ready` requirement inappropriate as a success test for this particular input. However, the captured sanitized metadata **cannot establish whether the model emitted seven complete v2 axis rows**. Therefore **neither actual v2 contract validity nor a v2 regression can be concluded**. A follow-on metadata-only probe now reports explicit eligibility, expected abstention and returned axis-row count for any future authorized trial, without changing the #1326 gate or making another Provider call.
- The one-shot GitHub Actions workflow was **removed immediately after** successful execution (commit `46e8194a54eeee3ba6d736326f43b2e6bf4d19b4`). It is NOT shipped as a persistent paid trigger; this file and the mock-only CI verifier remain. Actual human-photo eligibility and Face/Style parity are still untested, and no images or raw Provider responses are in the repo.
- The connection-only synthetic text runs #38702440175 and #38702819285 are separately recorded in #1334; combined actual-provider trials so far: **two text calls + two nonhuman image calls**, no human facial photo.

## Valid and invalid interpretations

- `NONFACE_PROVIDER_RESPONSE_CAPTURED_REVIEW_ONLY` means both transport calls returned JSON and `finish_reason=stop`. It is **not** structural/Face parity PASS unless each sub-evaluation supports that finding.
- Contract/response truncation is visible in `finishReason`, `problems`, `outputTokens` when the transport returns parsed JSON. A malformed/truncated JSON response can cause the shared transport to reject the payload; report that conservatively as an incomplete request, **do not fabricate a token count**.
- Non-face eligibility should be ineligible; v1/v2 structural/facial comparison requires human faces and must be **HOLD** on this test regardless of result. Actual photography/Independent Human reference/Score validation follow the S1-D and S2-E gates.
- Only operator-approved private images may be used for future real Human testing. No biometric images to GitHub, CI, logs, artifacts or provider until image rights and privacy boundaries are cleared.
- The KEY2 textual connectivity trial already succeeded separately on [Actions #38702440175](https://github.com/gycha0109-beep/K_beauty/actions/runs/38702440175) and [#38702819285](https://github.com/gycha0109-beep/K_beauty/actions/runs/38702819285). This experiment adds genuine **nonhuman image input** and full prompt/cap evidence that connectivity-only trials did not supply.
- PR branch ancestry starts at **#1328** and contains dependencies **#1326 → #1323 → #1319**. Do **not** merge independently before integration review; all remain Draft. Security #1208 remains a separate RELEASE_READY block.

Watchtower-Track: face-lab-skin
