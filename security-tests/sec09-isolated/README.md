# SEC-09 isolated result-read guard harness

This harness starts a project-scoped local Supabase stack in OS TEMP, applies the repository SEC-01 and SEC-09 production migrations, reapplies the SEC-09 corrective migration, and verifies the durable public-read contract without touching the repository root stack or any remote project.

Run from the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File security-tests/sec09-isolated/run.ps1
```

Expected success markers include `SEC09_ISOLATED_TAP=24/24`, `SEC09_ISOLATED_CONCURRENCY=5_ALLOWED_7_DENIED`, `SEC09_ISOLATED_RESIDUE=0`, and `SEC09_ISOLATED_CLEANUP=PASS`. The harness checks endpoint compatibility, ACL/RLS, SECURITY INVOKER/search_path, all-bucket atomic rejection, concurrent threshold enforcement, migration reapplication, and cleanup. It does not access hosted Supabase or production data.
