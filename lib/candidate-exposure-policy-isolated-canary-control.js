export const ISOLATED_CANARY_CONTROL_VERSION =
  "candidate-exposure-policy-isolated-canary-control-v1";

export const ISOLATED_CANARY_CONTROL_STATES = Object.freeze([
  "disabled",
  "eligible",
  "running",
  "stopped",
  "completed",
  "invalid_configuration"
]);

export const ISOLATED_CANARY_STOP_CONDITIONS = Object.freeze([
  "runtimeShaMismatch",
  "defaultOffShadowExecution",
  "unexpectedDivergence",
  "unclassifiedDivergence",
  "shadowException",
  "fallback",
  "invalidContext",
  "responseFingerprintMismatch",
  "snapshotFingerprintMismatch",
  "candidateOrderMismatch",
  "candidateLevelTelemetryDetected",
  "productionOrProjectConfigurationChange"
]);

const TERMINAL_STATES = new Set([
  "stopped",
  "completed",
  "invalid_configuration"
]);

function exactTrueKeyMap(value, expectedKeys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === expectedKeys.length &&
    new Set(keys).size === keys.length &&
    expectedKeys.every((key) => value[key] === true);
}

function uniqueSorted(values) {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right, "en"));
}

function freezeControl(control) {
  return Object.freeze({
    ...control,
    authority: Object.freeze({
      ...control.authority,
      blockers: Object.freeze([...(control.authority?.blockers || [])])
    })
  });
}

export function validateIsolatedCanaryAuthority(input = {}) {
  const blockers = [];
  const requireCondition = (condition, code) => {
    if (!condition) blockers.push(code);
  };

  requireCondition(
    input.designStatus === "design_ready_for_implementation_review",
    "design_not_ready"
  );
  requireCondition(
    typeof input.stage11eDesignBaseSha === "string" && input.stage11eDesignBaseSha.length >= 7,
    "design_base_sha_missing"
  );
  requireCondition(
    input.stage11eDesignBaseSha === input.expectedStage11eDesignBaseSha,
    "design_base_sha_mismatch"
  );
  requireCondition(
    typeof input.runtimeImplementationSha === "string" && input.runtimeImplementationSha.length >= 7,
    "runtime_sha_missing"
  );
  requireCondition(
    input.runtimeImplementationSha === input.expectedRuntimeImplementationSha,
    "runtime_sha_mismatch"
  );
  requireCondition(input.runtimeAttestationMatch === true, "runtime_attestation_failed");
  requireCondition(input.implementationPathsAllowed === true, "implementation_path_violation");
  requireCondition(input.mode === "validate-only", "invalid_execution_mode");
  requireCondition(input.maxAnalyzeRequests === 16, "invalid_request_budget");
  requireCondition(
    Number.isInteger(input.maxDurationMinutes) &&
      input.maxDurationMinutes > 0 &&
      input.maxDurationMinutes <= 60,
    "invalid_duration_budget"
  );
  requireCondition(
    exactTrueKeyMap(input.stopConditions, ISOLATED_CANARY_STOP_CONDITIONS),
    "invalid_stop_conditions"
  );
  requireCondition(input.networkAccessAllowed === false, "network_access_authorized");
  requireCondition(input.hostedExecutionAllowed === false, "hosted_execution_authorized");
  requireCondition(input.productionAllowed === false, "production_authorized");

  const normalizedBlockers = uniqueSorted(blockers);
  return Object.freeze({
    valid: normalizedBlockers.length === 0,
    blockers: Object.freeze(normalizedBlockers)
  });
}

export function createIsolatedCanaryControl(input = {}) {
  const authority = validateIsolatedCanaryAuthority(input);
  return freezeControl({
    version: ISOLATED_CANARY_CONTROL_VERSION,
    state: "disabled",
    authority,
    plannedEntries: input.maxAnalyzeRequests === 16 ? 16 : 0,
    completedEntries: 0,
    stopCondition: null
  });
}

export function transitionIsolatedCanaryControl(control, event = {}) {
  if (!control || control.version !== ISOLATED_CANARY_CONTROL_VERSION) {
    throw new Error("isolated_canary_control_invalid");
  }
  if (TERMINAL_STATES.has(control.state)) return control;

  if (event.type === "authorize" && control.state === "disabled") {
    return freezeControl({
      ...control,
      state: control.authority.valid ? "eligible" : "invalid_configuration"
    });
  }

  if (event.type === "start" && control.state === "eligible") {
    return freezeControl({ ...control, state: "running" });
  }

  if (event.type === "record_entry" && control.state === "running") {
    if (control.completedEntries >= control.plannedEntries) {
      return freezeControl({
        ...control,
        state: "invalid_configuration",
        authority: {
          valid: false,
          blockers: uniqueSorted([
            ...(control.authority?.blockers || []),
            "request_budget_exceeded"
          ])
        }
      });
    }
    return freezeControl({
      ...control,
      completedEntries: control.completedEntries + 1
    });
  }

  if (event.type === "complete" && control.state === "running") {
    if (control.completedEntries !== control.plannedEntries) {
      return freezeControl({
        ...control,
        state: "invalid_configuration",
        authority: {
          valid: false,
          blockers: uniqueSorted([
            ...(control.authority?.blockers || []),
            "incomplete_request_matrix"
          ])
        }
      });
    }
    return freezeControl({ ...control, state: "completed" });
  }

  if (event.type === "invalidate") {
    return freezeControl({
      ...control,
      state: "invalid_configuration",
      authority: {
        valid: false,
        blockers: uniqueSorted([
          ...(control.authority?.blockers || []),
          String(event.code || "runtime_contract_invalid")
        ])
      }
    });
  }

  return control;
}

export function canExecuteIsolatedCanaryEntry(control, entry = {}) {
  if (!control || control.state !== "running") return false;
  if (TERMINAL_STATES.has(control.state)) return false;
  if (control.completedEntries >= control.plannedEntries) return false;
  if (entry.executeAfterStop !== false) return false;
  return entry.sequence === control.completedEntries + 1;
}

export function stopIsolatedCanaryRun(control, stopCondition) {
  if (!ISOLATED_CANARY_STOP_CONDITIONS.includes(stopCondition)) {
    return transitionIsolatedCanaryControl(control, {
      type: "invalidate",
      code: "unknown_stop_condition"
    });
  }
  if (!control || control.state !== "running") return control;
  return freezeControl({
    ...control,
    state: "stopped",
    stopCondition
  });
}
