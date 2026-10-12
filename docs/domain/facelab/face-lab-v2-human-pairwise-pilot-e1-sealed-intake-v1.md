# Face Lab V2 — Human Pairwise Pilot E1: sealed intake & private reveal

> Track: face-research
> Source: Human Pairwise Contract v1 + Review Builder Contract v1
> Status: implementation of **offline, pure validation gates**; real Human pilot **not yet executed**
> Human responses collected: **0**; LLM judgment calls: **0**; Production behavior changed: **no**

## Why this exists

The existing reviewer packet and operator manifest already freeze a reproducible, blinded vCurrent / vCandidate comparison. The next risk is accidentally revealing the operator A/B roles before a Human response has been independently submitted and sealed, or accepting fabricated/mismatched judgments as real evidence.

This E1 implementation adds **two separate APIs**:

1. `sealFaceLabV2HumanPairwisePilotJudgment({ reviewPacket, submission })` in `human-pairwise-pilot-intake.js`.
2. `buildFaceLabV2HumanPairwisePrivateReveal({ reviewPacket, operatorManifest, pairId, judgments, revealedAt })` in `human-pairwise-pilot-reveal.js`.

The intake module receives **no operator manifest** and has no access to the A/B role map. It requires the exact immutable review-item digest, packet ID, pair ID, named dimension verdicts, assessability, reviewer pseudonym, stated submission timestamp, and rationale. It rejects invalid and out-of-order submissions. It emits a contract-valid `sealState: sealed` judgment with a SHA-256 integrity digest, without writing to DB or storage.

The private reveal module accepts only a separately held operator manifest bound to the same packet and its digest. A non-empty set of sealed judgment artifacts, distinct reviewer pseudonyms, matching review-item digest, and submit-before-reveal ordering are required. It validates mapping roles, engine versions, option recommendation digests, and existing `validateFaceLabV2HumanPairwiseBindings` before creating an integrity-sealed reveal.

### Entry contract: reviewer submission

```json
{
  "packetId": "<from reviewer packet>",
  "pairId": "<from review item>",
  "reviewItemDigest": "<from review item>",
  "reviewerId": "reviewer_private_001",
  "assessability": "assessable",
  "assessabilityReasonCodes": [],
  "dimensions": {
    "target_fit": "tie",
    "specificity": "uncertain",
    "evidence_action_linkage": "A"
  },
  "rationale": "<actual reviewer-supplied words>",
  "submittedAt": "<authoritatively recorded UTC ISO timestamp>"
}
```

Never fabricate a Human response, timestamp, or seal. The JSON is **schema documentation only**, not a recorded observation.

## Trust boundary and limitations

- A SHA-256 digest protects **integrity against later accidental or unauthorized mutation** but does **not authenticate a human**, prove a reviewer was independent, or create an immutable log. The calling operator must separately verify reviewer consent/identity, timestamp provenance, durable append-only storage, authorization, and restricted access.
- The two pure functions do **not** guarantee separate runtime/process permissions. Any UI or server integration must isolate the operator manifest from the reviewer's browser and from unsealed Human responses.
- The caller must not hand the operator manifest to the intake path. Never expose A/B engine roles, prior judgments, LLM/aggregate outcomes, or candidate policy names before seal.
- The module does **not** recruit a reviewer, upload a face/photo, request an AI provider, run SQL, write to storage, synthesize Human votes, perform engine promotion, compute quality thresholds, or activate a Production route.
- Acceptance by these gates is **syntactic/integrity/ordering validation**, not proof that vCandidate recommendations are better.
- Only use separately approved private operational storage when a future Human-review pilot is authorized. Do not store identifying reviewer details or face images in public Git history.

## Verification

```bash
node scripts/verify-face-lab-v2-human-pairwise-pilot.mjs
```

This verifier constructs synthetic contract fixtures only and covers:

- valid sealed `assessable`, `uncertain_assessability`, `not_assessable` submissions;
- rejection of extra properties, wrong packet/item, invalid verdict/reason, and backdated submission;
- **reveal HOLD** for zero sealed Human judgments, wrong operator packet, role tampering, tampered/duplicate/foreign judgments, and reveal before seal;
- deterministic replay, distinct reviewer accounting, exact reviewer-item/operator digest linkage;
- neither paid generation nor real Human input.

The existing Face Lab V2 Foundation workflow executes this fixture next to the builder verifier. No new workflow, security gate exception, Production database migration, or frontend code is created.

## Next work after E1

1. Obtain an authorized, private Human review environment with explicit reviewer identities and secure persistence. Present **only** the reviewer packet.
2. Independently collect real reviewer judgments. Feed actual submitted data into the intake gate; append raw and sealed evidence in a protected journal.
3. After at least one verified real human seal per pair, invoke private reveal and preserve the audit trail. Current test fixture passes are **not** Human calibration.
4. Compute descriptive dimension-by-dimension aggregates, including disagreement and not-assessable rates; do not force overall winners.
5. Only after non-empty, reviewed Human calibration may bounded LLM judge calibration or candidate promotion review be proposed as a separate gated change.

Watchtower-Track: face-research
