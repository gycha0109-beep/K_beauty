# DATA-AI29C-D5D-R1 — SPF Production Activation Recovery v1

## Trigger

D5D Production probe passed 4/4 after merge, but the immediately following D5C regression sequence returned one HTTP 422 on the sixth canary probe. SPF Production activation was rolled back before further rollout.

Current recovery stance:

```text
authenticated_product_query_beta SPF switch = OFF
publicSearchCutover = false
UVA = OFF
Water = OFF
```

## Recovery changes

### 1. Transport-only bounded retry

D5C target authority read and legacy sunscreen protection authority read may retry exactly once after 75 ms only for transport failures:

- timeout
- read failure

No retry is allowed for semantic, registry, subject, taxonomy, admission, or other governance failures.

Maximum attempts per read operation: 2.

### 2. Operational kill switch

Production DB now has an admin-only audited setter:

```text
admin_set_data_ai29c_d5d_spf_runtime_activation_v1(boolean, text)
```

Runtime role cannot:

- execute the setter
- update the activation table
- read the audit table

DB admin can switch SPF activation without redeploy and each change is recorded in `sunscreen_spf_runtime_activation_audit_v1`.

### 3. Switch-aware deployed probe

The existing GitHub Actions OIDC runtime workflow first calls:

```text
caseId = switch_state
```

If the SPF switch is OFF:

- D5D activation probe is skipped
- D5C 6/6 still runs
- DATA-AI5 activation-readiness 24/24 still runs

If the SPF switch is ON:

- D5D 4/4 runs
- D5C 6/6 runs
- DATA-AI5 24/24 runs

`workflow_dispatch(run_deployed_probe=true)` permits repeating the same deployed checks against the current main SHA after an admin switch change.

## Recovery sequence

1. Keep switch OFF.
2. Merge D5D-R1.
3. Verify new main deployment.
4. Require D5C 6/6 and DATA-AI5 24/24 with switch OFF.
5. Use audited admin setter to turn SPF switch ON.
6. Trigger deployed probe against the same main SHA.
7. Require D5D 4/4 + D5C 6/6 + DATA-AI5 24/24.
8. Only then close D5D-R1 and leave SPF Production activation ON.

## Boundaries

D5D-R1 does not authorize:

- Product Query GA/public search cutover
- UVA ranking
- water-resistance ranking
- profile/history merge
- Product mutation
- recommendation persistence

The authenticated beta remains the only user-facing activation scope.
