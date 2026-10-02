# Face Lab V2 G-E2B Local Pilot Launcher v1

> Track: Face Lab / face-research
> Purpose: persist the full 4 x 2 provider pilot under the ignored local private boundary
> Credential source: repository-root `.env.local`
> Provider authority: canonical provider pilot runner

## One-time local setup

The repository-root `.env.local` must define the four previously established Face Lab E2E account variables for account A and account B.

`.env.local` is already ignored by Git and must never be committed.

## Run

```bash
npm run run:face-lab-v2-g-e2b-local-pilot
```

The launcher forces:

- four intents,
- two generations per intent,
- local output persistence,
- the dedicated E2E account aliases,
- the canonical provider runner.

On success it prints the completed campaign directory and the local Review Board URL.

## Review

Start the local app:

```bash
npm run dev
```

Open:

`http://localhost:3001/face-lab-test/pilot-review`

Select the generated campaign directory under:

`private/face-lab-g-e2b/<campaign-id>`

The browser review session does not ask for the account credentials again.
