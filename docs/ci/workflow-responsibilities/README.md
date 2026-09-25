# Workflow Responsibility Registry

This directory is the conflict-resistant workflow inventory for BEJEWELY CI.

For every `.github/workflows/<name>.yml` or `.yaml`, keep exactly one file here named `<workflow-file-name>.json`.

Rules:

1. Add a workflow: add its matching JSON fragment in the same PR.
2. Rename a workflow: rename its fragment and update the `workflow` field.
3. Delete a workflow: delete its fragment in the same PR.
4. Do not add a committed workflow inventory digest.
5. Do not restore the monolithic `workflows` object in `workflow-responsibility-map.json`.
6. The verifier reconstructs the full registry and fails closed on missing, extra, duplicate, or misnamed entries.

The shared policy remains in `docs/ci/workflow-responsibility-map.json`; ordinary workflow additions should not edit that file.
