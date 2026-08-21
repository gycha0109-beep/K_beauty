# Face Lab D2D-X Execution Authorization — 2026-08-21 v1

## Status

- Stage: `FACE-EVAL-CX1G-D2D-X`
- Authority state: `AUTHORIZED`
- Human execution: `NOT_STARTED`
- Eligible Human evidence: `0`
- Aggregation: `NO`
- Reveal: `NO`
- Calibration: `NOT_READY`
- W2/W3: `LOCKED`
- Production Archetype: `OFF`

## Entry authority

Coordinator independently verified the preceding deployed browser E2E gate and closed it as:

- `FACE_EVAL_CX1G_D2D_XA = SUCCESS / CLOSED`
- `DEPLOYED_HOSTED_E2E_VERIFIED = YES`
- `FACE_EVAL_CX1G_D2D_X_HOSTED_INTAKE_ACTIVATED = YES`

Accepted repository authority at authorization time:

`e1cdd9a777253f0497ac032573018045bebf5be3`

Verified clean Production deployment:

`dpl_7MNDb7npMcovhAjbwYj5875GUjpU`

Verified Production domain:

`k-beauty-two.vercel.app`

Verified Hosted intake pre-Human state:

```text
total     = 2
test      = 2
submitted = 0
started   = 0
invalid   = 0
```

The only rows are the historical deterministic test row and the D2D-XA deterministic browser-E2E test row. Neither is Human evidence.

## Frozen evaluation authority

- Target-axis definition digest: `8e630605ece0629da6a51e30829297688c27f10a3a92be6a3c8e3413f546bb46`
- Independent Human cue audit protocol digest: `a32dd94dfbd8e090363ae0d662d51174eeab05796ccad5a8b2ad4c303d886b77`
- D2D-P packet authority digest: `1f344a9d1cbd8e8ac6076b06da7780d213ff6ff71df80ea7a9f818617965339c`
- D2D-UI1 distribution authority digest: `23636cf323ac944ae0c283e75e3161ebfaceedee2838bc672789488bcf772a32`
- Hosted single-set authority digest: `b92f221f8c9b3521637b9f1660ddd2f6c287883bb8620f4b8ac02bd786e30491`

## Operator authorization

On 2026-08-21 the operator explicitly instructed the Coordinator to proceed to the next Face Lab evaluation stage. This record freezes that instruction as authorization to begin D2D-X preparation and independent Human execution under the already-frozen blind Human cue protocol.

This authorization does **not** authorize aggregation, reveal, consensus promotion, calibration, W2/W3, weight tuning, threshold selection, or Production Archetype activation.

## Reviewer boundary

The diagnostic panel remains three independent Human reviewers.

The operator, ChatGPT/Coordinator, GPT workers, Codex, and other AI systems are not eligible independent reviewers.

Each valid Human reviewer must complete the hosted blind intake without exposure to generation target, prompt, strength condition, Archetype target, Vision output, shadow score, peer judgments, or consensus, and must satisfy the hosted independence attestations.

The hosted intake uses one shared opaque link and independent random browser session IDs. Reviewer names, email addresses, phone numbers, or slot labels are not stored in the hosted response authority.

Each completed Human submission contains exactly 140 judgments across the 14-image set: 8 primary axes and 2 validation-only axes per image. `featureContrast` remains excluded.

## Secret and distribution boundary

The existing Production access token is sensitive and its plaintext is not recoverable through the Coordinator's remote Vercel surface. No secret value may be committed, pasted into chat, PR text, logs, screenshots, or tracked files.

Therefore the exact reviewer link must be prepared through a local authenticated Vercel execution surface that can safely generate/rotate the reviewer access token and place the resulting opaque reviewer URL only in an untracked local operator handoff file.

Before distribution, all of the following must hold:

1. exact accepted Git SHA deployed to Production;
2. project-level test-submission flag absent;
3. reviewer access token present only as a sensitive Production secret;
4. no deployment-scoped test override;
5. no-token reviewer route returns 404;
6. Hosted DB still has `submitted = 0`;
7. generated reviewer link is not printed or committed;
8. three independent Human reviewers are selected by the operator and receive no hidden target/Vision/scorer information.

## D2D-X completion gate

D2D-X is not complete merely because a link exists or one person submits.

The execution gate requires three eligible independent Human submissions to be present and independently verified as non-test, each with 140 judgments and exact frozen authority digests. Until then:

```text
D2D-X = IN_PROGRESS / HUMAN_EXECUTION_PENDING
D2D-A = NOT_STARTED
D2D-R = NOT_STARTED
AGGREGATED = NO
REVEALED = NO
CALIBRATED = NO
W2/W3 = LOCKED
PRODUCTION_ARCHETYPE = OFF
```
