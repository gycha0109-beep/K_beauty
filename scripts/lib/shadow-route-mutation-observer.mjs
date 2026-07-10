export const SHADOW_ROUTE_MUTATION_OBSERVER_VERSION = "2026-07-10.phase43";

export const ROUTE_MUTATION_SURFACES = Object.freeze([
  {
    surfaceId: "analysis_guard_rate_limit_rpc",
    kind: "database_rpc",
    operation: "consume_analysis_rate_limits",
    alwaysPossible: true
  },
  {
    surfaceId: "analysis_guard_idempotency_claim_rpc",
    kind: "database_rpc",
    operation: "claim_analysis_idempotency",
    alwaysPossible: false
  },
  {
    surfaceId: "analysis_guard_idempotency_complete_rpc",
    kind: "database_rpc",
    operation: "complete_analysis_idempotency",
    alwaysPossible: false
  },
  {
    surfaceId: "analysis_guard_idempotency_fail_rpc",
    kind: "database_rpc",
    operation: "fail_analysis_idempotency",
    alwaysPossible: false
  },
  {
    surfaceId: "premium_report_session_prune",
    kind: "database_table",
    operation: "delete_expired_premium_report_sessions",
    alwaysPossible: true
  },
  {
    surfaceId: "premium_report_session_insert",
    kind: "database_table",
    operation: "insert_premium_report_session",
    alwaysPossible: true
  },
  {
    surfaceId: "supabase_storage_mutation",
    kind: "storage",
    operation: "none_found_in_route_call_graph",
    alwaysPossible: false
  },
  {
    surfaceId: "survey_contract_dev_audit",
    kind: "local_filesystem",
    operation: "append_dev_audit_event",
    alwaysPossible: true
  },
  {
    surfaceId: "shadow_boundary_artifact",
    kind: "local_filesystem",
    operation: "write_sanitized_shadow_artifact",
    alwaysPossible: false
  }
]);

export function buildShadowRouteMutationObserverPlan({ localDatabaseReady = false } = {}) {
  const databaseSurfaces = ROUTE_MUTATION_SURFACES.filter((surface) =>
    surface.kind.startsWith("database")
  );
  const storageSurfaces = ROUTE_MUTATION_SURFACES.filter((surface) => surface.kind === "storage");

  return {
    observerVersion: SHADOW_ROUTE_MUTATION_OBSERVER_VERSION,
    mode: "ephemeral_local_audit_required",
    databaseSurfaces: databaseSurfaces.map((surface) => ({
      ...surface,
      observationStatus: localDatabaseReady ? "ready_for_ephemeral_audit" : "not_observed"
    })),
    storageSurfaces: storageSurfaces.map((surface) => ({
      ...surface,
      observationStatus: localDatabaseReady ? "ready_for_storage_counter" : "not_observed"
    })),
    localFilesystemSurfaces: ROUTE_MUTATION_SURFACES.filter(
      (surface) => surface.kind === "local_filesystem"
    ),
    comparisonMethod: "identical_seed_reset_then_normalized_operation_count_diff",
    normalizedFields: ["surfaceId", "kind", "operation", "normalizedRowIdentity", "count"],
    excludedNondeterministicFields: ["timestamp", "generatedUuid", "sessionToken"],
    separatesExistingRouteMutationsFromShadowAddedMutations: true,
    observerInstalled: false,
    mutationObserverCoverage: localDatabaseReady ? "planned_not_installed" : "incomplete",
    unobservedMutationSurface: localDatabaseReady
      ? databaseSurfaces.map((surface) => surface.surfaceId)
      : [...databaseSurfaces, ...storageSurfaces].map((surface) => surface.surfaceId),
    measured: false
  };
}

export function compareShadowRouteMutationSummaries(baseline, flagOn) {
  if (!baseline?.measured || !flagOn?.measured) {
    return {
      comparable: false,
      shadowAddedDbMutationDelta: null,
      shadowAddedStorageMutationDelta: null,
      reasonCode: "mutation_summaries_not_measured"
    };
  }

  const baselineDb = Number(baseline.databaseMutationCount || 0);
  const flagOnDb = Number(flagOn.databaseMutationCount || 0);
  const baselineStorage = Number(baseline.storageMutationCount || 0);
  const flagOnStorage = Number(flagOn.storageMutationCount || 0);

  return {
    comparable: true,
    shadowAddedDbMutationDelta: flagOnDb - baselineDb,
    shadowAddedStorageMutationDelta: flagOnStorage - baselineStorage,
    reasonCode: "measured_from_identical_initial_state"
  };
}
