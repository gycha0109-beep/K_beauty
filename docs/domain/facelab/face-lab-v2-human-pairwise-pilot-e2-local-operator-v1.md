# Face Lab V2 Human Pairwise Pilot — E2 local-only operator workflow

> Track: face-research
> Status: local offline tool implemented, **no actual Human participant or judgment collected**
> Dependency: Human Pairwise Contract v1; PR D reviewer/manifest builder; E1 seal/reveal gates
> Release: not Production, not a public reviewer UI, not a hosted service

## Purpose

Move beyond only generating a synthetic test of the Human A/B contract. A trusted operator can prepare a frozen blind packet, receive a **separately collected** real reviewer's JSON response, seal it with the local process timestamp and immutable digest, and after independent verification disclose the current/candidate A/B map into a **separate private directory**.

No input is assumed to be genuinely Human merely because it passed structural validation. Operator/reviewer identity, informed consent, authenticity, clock provenance, trusted storage/backup and access-control are **external prerequisites** before any data can enter calibration.

The CLI reads/writes **only** `private/face-lab-human-pairwise-pilot/<campaign>/`, already covered by the repository's `private` gitignore rule. File creation is exclusive (`wx`) and never overwrites earlier evidence; protected filesystem modes are requested on POSIX. It does not use Supabase, a cloud service, LLM, raw images, or any paid provider.

## Offline runbook

Use a unique safe campaign identifier, e.g. `pilot_wave1`.

```bash
node scripts/run-face-lab-v2-human-pairwise-local-pilot.mjs prepare --campaign pilot_wave1
```

The tool prepares:

- `reviewer/packet.json` — the **only** file to provide to an authorized reviewer; no A/B mapping or candidate engine labels.
- `operator/manifest.json` — **strictly operator-only**, never send alongside the reviewer packet.
- `inbox/` — approved operator copy of a submitted reviewer's file.
- `sealed/` — sealed, no-overwrite judgments.

An authorized reviewer fills out an external JSON form bound to a specific `pairId`, `reviewItemDigest`, and `packetId`, with this **field shape** (not a real judgment):

```json
{
  "packetId": "<packetId>",
  "pairId": "<pairId>",
  "reviewItemDigest": "<review item digest>",
  "reviewerId": "reviewer_private_001",
  "assessability": "assessable",
  "assessabilityReasonCodes": [],
  "dimensions": {
    "target_fit": "tie",
    "specificity": "uncertain",
    "evidence_action_linkage": "A"
  },
  "rationale": "<reviewer's actual explanation>"
}
```

The reviewer **must not** submit `submittedAt`; the CLI stamps the locally observed receipt time. This time is **not cryptographically attested** and can be wrong if the operator's computer clock is wrong.

The operator copies that JSON as a new, unique filename under `inbox/`, for example `reviewer01.json`.

```bash
node scripts/run-face-lab-v2-human-pairwise-local-pilot.mjs seal --campaign pilot_wave1 --input reviewer01.json
node scripts/run-face-lab-v2-human-pairwise-local-pilot.mjs status --campaign pilot_wave1
```

Before any private reveal, a responsible operator **must separately** verify that the input came from an authorized independent Human reviewer, that consent and data-handling permissions exist, and that this is not a synthetic/test submission. The CLI **cannot** do any of these checks. If verification cannot be performed, STOP here; do not treat the item as Human evidence.

Only then, for a specific previously sealed pair:

```bash
node scripts/run-face-lab-v2-human-pairwise-local-pilot.mjs reveal --campaign pilot_wave1 --pair flhp_<24 hex characters>
```

This action reads the private manifest and all sealed judgments matching that pair. It enforces E1 integrity, identity-binding and seal/reveal chronology before writing `operator/reveals/<pairId>.json` exclusively. It does not output A/B roles on standard output. **No global overall winner, human-quality score, engine activation or LLM judge is produced.**

## Security boundaries and failure policies

- This CLI is **not** a hardened multiuser review service. Local users with broad disk access may read operator files. Enforce filesystem ACLs and separate reviewer access before a real pilot. Never deploy `private/` as web static assets or copy it into public build artifacts.
- The intake command **never reads the operator manifest**; only the private reveal operation can open it.
- The CLI rejects path traversal through campaign/input names, user-supplied timestamps, symbolic-link input files, unexpected JSON fields (via E1 contract), repeated reviewer/pair seals, tampered digests and premature reveal.
- `prepare`, `seal` and `reveal` use **no-overwrite** exclusive writes; if preparation is partial after an interruption, an operator must inspect it and start a **new campaign**, not silently mutate existing records.
- A digest provides mutation detection; it is not a signature, cannot establish authorship, and does not make storage WORM/append-only across a privileged filesystem administrator. Filenames hash a reviewer pseudonym but the sealed JSON still contains the pseudonym and rationale.
- No real participant data should be placed into test fixtures, source code, public PRs, CI logs or a hosted URL. Keep backups and chain-of-custody externally governed.

## Regression check

```bash
node scripts/verify-face-lab-v2-human-pairwise-local-pilot.mjs
```

The verifier creates a temporary **synthetic** private campaign, executes the actual CLI for preparation, invalid and valid seals, tamper rejection, reveal-before-seal refusal, manifest mismatch, duplicate/no-overwrite, and private A/B disclosure. All files are deleted in `finally`. Synthetic fixture outcomes are **not Human pilot results**.

The Face Lab Foundation workflow runs this verifier in its existing job. No extra workflow, Production database/storage schema, Live API, UI, or provider path is added.

## Next authority gates

1. Reviewed privacy/consent plan, explicit independent reviewer identity and access-controlled intake method.
2. Actual Human ratings and separate operator evidence attestation, stored in governed private evidence.
3. Sealed/revealed valid cases with disagreement and `not_assessable` preserved.
4. A separate **descriptive-only** dimension aggregation and decision memo.
5. Only after sufficient Human calibration: candidate revision decision, followed by bounded LLM judge calibration and Production activation review — never automatically.

Watchtower-Track: face-research
