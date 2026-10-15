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

## Valid and invalid interpretations

- `NONFACE_PROVIDER_RESPONSE_CAPTURED_REVIEW_ONLY` means both transport calls returned JSON and `finish_reason=stop`. It is **not** structural/Face parity PASS unless each sub-evaluation supports that finding.
- Contract/response truncation is visible in `finishReason`, `problems`, `outputTokens` when the transport returns parsed JSON. A malformed/truncated JSON response can cause the shared transport to reject the payload; report that conservatively as an incomplete request, **do not fabricate a token count**.
- Non-face eligibility should be ineligible; v1/v2 structural/facial comparison requires human faces and must be **HOLD** on this test regardless of result. Actual photography/Independent Human reference/Score validation follow the S1-D and S2-E gates.
- Only operator-approved private images may be used for future real Human testing. No biometric images to GitHub, CI, logs, artifacts or provider until image rights and privacy boundaries are cleared.
- The KEY2 textual connectivity trial already succeeded separately on [Actions #38702440175](https://github.com/gycha0109-beep/K_beauty/actions/runs/38702440175) and [#38702819285](https://github.com/gycha0109-beep/K_beauty/actions/runs/38702819285). This experiment adds genuine **nonhuman image input** and full prompt/cap evidence that connectivity-only trials did not supply.
- PR branch ancestry starts at **#1328** and contains dependencies **#1326 → #1323 → #1319**. Do **not** merge independently before integration review; all remain Draft. Security #1208 remains a separate RELEASE_READY block.

Watchtower-Track: face-lab-skin
