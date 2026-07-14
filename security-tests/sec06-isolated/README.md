# SEC-06 saved_reports isolated role matrix

This local-only harness stages a minimal pre-SEC-06 `saved_reports` contract and the production SEC-06 migration into an OS TEMP Supabase project. It does not replay historical migrations, contact a linked project, or retain credentials or row data.

Run:

```powershell
powershell -ExecutionPolicy Bypass -File security-tests/sec06-isolated/run.ps1
```

The role matrix verifies:

- `anon` has no direct CRUD privilege.
- anonymous Supabase Auth users cannot read or write rows.
- a permanent owner can insert only an owner-bound free share row, update only its title, read own free/premium rows, and delete own rows.
- non-owners cannot read or mutate another user's rows.
- authenticated direct premium/provenance/payload mutation is denied.
- `service_role` can insert and update the authoritative premium payload.

The runner uses project id `kbeauty-sec06-isolated`, dedicated local ports, an OS TEMP workdir, source/staged migration hash equality, and project-scoped cleanup. It must not be used against hosted Supabase.
