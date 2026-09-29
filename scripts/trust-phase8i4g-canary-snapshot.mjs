import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  buildReadOnlyCanarySnapshot,
  classifyRealCanaryProvenance,
} from "../lib/trust/official-source-grouped-relocation-canary.mjs";

function argValue(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.slice(2).find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

async function selectOrThrow(query, label) {
  const { data, error } = await query;
  if (error) {
    throw new Error(`${label}:${error.code || "QUERY_ERROR"}:${error.message}`);
  }
  return data ?? [];
}

async function countOrThrow(client, table) {
  const { count, error } = await client
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) {
    throw new Error(
      `count:${table}:${error.code || "QUERY_ERROR"}:${error.message}`,
    );
  }
  return count ?? 0;
}

function latestPerCase(rows) {
  const latest = new Map();
  for (const row of rows) {
    const key = String(row.case_id);
    const current = latest.get(key);
    if (
      !current ||
      Date.parse(row.created_at) > Date.parse(current.created_at) ||
      (row.created_at === current.created_at &&
        String(row.evaluation_id).localeCompare(String(current.evaluation_id)) >
          0)
    ) {
      latest.set(key, row);
    }
  }
  return [...latest.values()];
}

export async function capturePhase8i4gCanarySnapshot({
  client,
  limit = 1000,
  now = () => new Date(),
} = {}) {
  if (!client) throw new Error("client is required");
  if (!Number.isInteger(limit) || limit < 1 || limit > 5000) {
    throw new Error("limit must be an integer between 1 and 5000");
  }

  const evaluations = await selectOrThrow(
    client
      .from("trust_official_source_transport_drift_evaluations")
      .select(
        "evaluation_id,case_id,request_id,result_kind,candidate_locator,result_payload,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(limit),
    "load_evaluations",
  );
  const latestEvaluations = latestPerCase(evaluations);

  const groupedRelocations = await selectOrThrow(
    client
      .from("trust_official_source_relocation_groups")
      .select("group_id,case_id,evaluation_id,relocation_id,created_at"),
    "load_grouped_relocations",
  );

  const realReadyCaseIds = latestEvaluations
    .filter(
      (row) =>
        row.result_kind === "READY_FOR_8I4" &&
        classifyRealCanaryProvenance(row).eligible,
    )
    .map((row) => row.case_id);

  const caseLineage = {};
  if (realReadyCaseIds.length > 0) {
    const cases = await selectOrThrow(
      client
        .from("trust_official_source_transport_drift_cases")
        .select("case_id,product_id,subject_id")
        .in("case_id", realReadyCaseIds),
      "load_cases",
    );
    const links = await selectOrThrow(
      client
        .from("trust_official_source_transport_drift_case_incidents")
        .select("case_id,incident_id,source_id")
        .in("case_id", realReadyCaseIds),
      "load_case_lineage",
    );

    for (const row of cases) {
      caseLineage[String(row.case_id)] = {
        product_id: row.product_id,
        subject_id: row.subject_id,
        source_ids: [],
        incident_ids: [],
      };
    }
    for (const link of links) {
      const entry = caseLineage[String(link.case_id)];
      if (!entry) continue;
      entry.source_ids.push(link.source_id);
      entry.incident_ids.push(link.incident_id);
    }
  }

  const countTables = {
    transport_incidents: "trust_official_source_transport_incidents",
    drift_cases: "trust_official_source_transport_drift_cases",
    drift_evaluations: "trust_official_source_transport_drift_evaluations",
    grouped_relocations: "trust_official_source_relocation_groups",
    grouped_sources: "trust_official_source_relocation_group_sources",
    grouped_incidents: "trust_official_source_relocation_group_incidents",
    relocations: "trust_official_source_relocations",
    product_fact_instances: "product_fact_instances",
    product_fact_current: "product_fact_current",
    product_fact_confirmations: "product_fact_confirmations",
    evidence_sources: "product_evidence_sources",
    evidence_subject_bindings: "product_evidence_source_subject_bindings",
    recommendation_logs: "recommendation_logs",
    product_source_bindings: "product_source_bindings",
    official_source_reviews: "trust_official_source_binding_reviews",
  };
  const counts = {};
  for (const [key, table] of Object.entries(countTables)) {
    counts[key] = await countOrThrow(client, table);
  }

  counts.ready_for_8i4 = latestEvaluations.filter(
    (row) => row.result_kind === "READY_FOR_8I4",
  ).length;

  return buildReadOnlyCanarySnapshot({
    capturedAt: now().toISOString(),
    evaluations: latestEvaluations,
    groupedRelocations,
    caseLineage,
    counts,
  });
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }

  const limit = Number(argValue("limit") || "1000");
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const snapshot = await capturePhase8i4gCanarySnapshot({ client, limit });
  process.stdout.write(JSON.stringify(snapshot, null, 2) + "\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
