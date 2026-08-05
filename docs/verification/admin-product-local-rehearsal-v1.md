# Admin Product AHR-3L Local Docker Rehearsal

## Purpose

Run the Admin Product hosted-activation runtime checks without creating a paid Supabase branch or touching the hosted project.

## Requirements

- Docker Desktop running with Linux containers
- Node.js 20 or newer
- Repository checked out at the Admin Product integration head or this review branch
- No Supabase login, project link, cloud API key, or payment method is required

## Run

From the repository root:

```powershell
npm run verify:admin-product-local-rehearsal
```

The runner installs crawler dependencies only when they are missing, downloads the pinned Supabase CLI through `npx`, starts an isolated local stack, replays the required migrations and fixtures, runs the runtime matrix, and deletes the containers and temporary files.

To keep the isolated stack and files for debugging:

```powershell
npm run verify:admin-product-local-rehearsal -- --keep
```

The retained runtime directory is printed in the output. Stop it afterward with the matching work directory:

```powershell
npx --yes supabase@2.109.1 stop --workdir <printed-runtime-directory> --no-backup
```

## What passes

The command verifies:

- ordered migration replay in a clean database
- owner and viewer capability separation
- reviewed-file dry-run
- stale candidate rejection
- atomic five-row confirmation
- one new product creation and one existing product merge
- defer and block decisions
- exact idempotent retry
- request ID conflict rejection
- export batch replay rejection
- audit row creation
- cleanup without hosted writes

Expected final line:

```text
[AHR-3L] PASS: Production 변경 없이 AHR-3L 로컬 검증 완료
```

## Failure handling

- If Docker Desktop is not running, the command stops before creating any workspace.
- If migration replay or a runtime assertion fails, the command exits non-zero.
- Unless `--keep` is supplied, the local Supabase stack and generated batch files are removed in `finally` cleanup.
- Supabase status output is captured and keys, JWTs, bearer tokens, and database passwords are redacted from failure logs.

## Scope boundary

This proves the migration and runtime behavior in a local Supabase stack. It does not apply hosted migrations, create the production `admin_owner`, confirm real product candidates, deploy the application, or merge PR #166.
