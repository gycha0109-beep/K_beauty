# Face Lab / Skin — S1-D Private real-photo v1/v2 research runner (2026-10-16)

> **Draft research infrastructure, NOT evidence of a successful real-photo Provider call.**
> S1-D source/subject/external-OpenAI-transfer authorization was **affirmed by the user in chat** on 2026-10-16. This is a user attestation, not independently inspected consent documentation. Production eligibility, performance, separate independent Human reference and owner security/privacy signoff are not thereby established.

## Environment and actual execution state

- Five user-provided JPEGs (TC-01…TC-05) exist only in the private conversation runtime. Image sizes 582×894, 539×371, 273×366, 484×413, 452×678. TC-03 is small; TC-04 partial face; TC-05 dark exposure. These are quality **flags**, not skin diagnoses or independent ground truth.
- The private local cohort manifest is **NOT committed**: `skin-private-v1v2-cohort-v1` with five opaque case IDs, local basenames/expected dimensions, all three forms of `user_attested` authorization, and restrictive execution policy. No copy of the private manifest or any actual photo may enter GitHub/CI/PR artifacts/logs.
- The ChatGPT/container process does **not** have `OPENAI_API_KEY2` or `OPENAI_API_KEY` injected. KEY2 was previously shown to work only inside GitHub Actions **Repository Secrets** using a **nonhuman** mock/grid; GitHub Secrets are intentionally not readable or exported to this private runner.
- Therefore **live real-photo Provider calls from this development environment = 0**. Do not claim actual v1/v2 face parity, observation accuracy, total costs or 10 executed calls until the private runner obtains an approved credential by a separate safe channel.
- **NEVER** build a GitHub Actions workflow or GitHub Secret containing the human JPEGs, even as base64, URLs, or encrypted attachments. GitHub Actions is not an acceptable delivery channel for the real human photo cohort.

## Implemented private runner

- `skin-private-v1v2-runner.mjs`: accepts strict five-case local manifest; verifies user attestation, fixed KEY2-only credential, private-only policy, 10-call bound and CI/GITHUB_ACTIONS refusal **before reading photos**. Validates all five JPEG bytes, frame dimensions, file size, symlinks, and private directory containment **before the first billable call**.
- `run-skin-private-v1v2.mjs` has explicit `--validate-private-cohort` (no key, no Provider) and `--live-private-cohort` (requires injected `OPENAI_API_KEY2`; private runner only) modes. No dotenv, production API key fallback, automatic trigger, Vercel deployment or webhook.
- `--live-private-cohort` performs exactly one **v1** and one **research-only v2** OpenAI Vision request for the SAME in-memory photo bytes per case, at most **10** calls total, no retry. Body uses existing pinned `OPENAI_RUNTIME_MODEL`, `OPENAI_RUNTIME_REASONING_EFFORT`, `OPENAI_RUNTIME_IMAGE_DETAIL` and **2,200-token completion cap**, through the existing `executeOpenAiChatJson` transport; no new production API.
- Only sanitized metadata is returned: opaque case ID, output completion and token counts, elapsed ms, eligibility, v2 actual axis count and structural status, Face status/available field counts, pairing status and HOLD reasons. **Never** return filenames, filenames in output, raw Provider JSON/evidence text, image base64, image URLs, secret, EXIF or identity. No source or raw result is written by the runner to disk.
- The existing `inspectSkinVisionTrial` and `summarizeSkinVisionTrials` gate logic enforces structural completeness, 2,200 completion cap, Face status/count degradation. Eligible v2 Skin output requires seven valid axis rows; ineligible Skin expected output is zero rows (separate status from eligible-photo failure). Low resolution/lighting/crops are only flagged; **human judgement and actual references are needed** to determine appropriate abstention.
- Failure to open ANY of five files prevents all billable calls. A Provider failure stops the run and produces sanitized HOLD metadata, not an unobserved success. Local prefix or mocked private test cases are never sent by CI.

## Exact operator interfaces (not run here)

```sh
# In an approved private host with the repository code available.
node scripts/facelab/skin/run-skin-private-v1v2.mjs --validate-private-cohort \
  --manifest /PRIVATE/skin_private_v1v2_cohort_20261016.json --photo-dir /PRIVATE/PHOTOS

# This SECOND command, only on that private host and with a securely
# injected OPENAI_API_KEY2, makes up to 10 billed API requests.
node scripts/facelab/skin/run-skin-private-v1v2.mjs --live-private-cohort \
  --manifest /PRIVATE/skin_private_v1v2_cohort_20261016.json --photo-dir /PRIVATE/PHOTOS
```

Do not place secret contents into chat, code, GitHub, Vercel or a CI script. Explicit command examples are for a **separately authorized private host**, not an instruction to bypass the runtime's missing-key gate.

## Automated verification

`verify-skin-private-v1v2-runner.mjs` uses *fabricated JPEG headers* inside a disposable temporary directory, and a **mock Provider transport only**. It verifies: five cases/call budget, identical image bytes across v1/v2, key2-only credential, production-key-only rejection, GITHUB_ACTIONS/CI rejection, cohort-wide file-check before traffic, symlink/path/metadata rejection, sanitized error reporting and zero actual Provider calls. This verifier is the only part wired to `verify-current-main-health.mjs`.

Success means **research infrastructure mock PASS**, not real-human accuracy/Face parity or ability to retrieve GitHub Secrets. Until the actual live private Provider outputs and two independent Human assessments are acquired, S1-D remains **EXECUTION_BLOCKED_PENDING_PRIVATE_KEY_PROVISIONING**, S2-E scoring activation/S5 Product Ready/Release Ready remain **HOLD**. Security #1208 and any currently expired advisory exceptions remain an independent blocker. No merge/deploy without approval.

Watchtower-Track: face-lab-skin
