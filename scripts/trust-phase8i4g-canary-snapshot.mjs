import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  buildReadOnlyCanarySnapshot,
} from "../lib/trust/official-source-grouped-relocation-canary.mjs";

function argValue(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.slice(2).find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

async function rpcOrThrow(client, fn, args = {}) {
  const { data, error } = await client.rpc(fn, args);
  if (error) {
    throw new Error(`${fn}:${error.code || "RPC_ERROR"}:${error.message}`);
  }
  return data;
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

function validateReadModel(readModel) {
  if (
    !readModel ||
    readModel.contract !== "trust-phase8i4g-canary-read-model-v1" ||
    readModel.phase !== "8I-4G" ||
    readModel.authority !==
      "READ_ONLY_SERVICE_ROLE_RPC_NO_AUTHORITY_MUTATION" ||
    !Array.isArray(readModel.evaluations) ||
    !Array.isArray(readModel.grouped_relocations) ||
    !readModel.case_lineage ||
    typeof readModel.case_lineage !== "object" ||
    !readModel.counts ||
    typeof readModel.counts !== "object"
  ) {
    throw new Error("TRUST_PHASE8I4G_CANARY_READ_MODEL_INVALID");
  }
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

  const readModel = await rpcOrThrow(
    client,
    "get_trust_phase8i4g_canary_snapshot_v1",
    { p_limit: limit },
  );
  validateReadModel(readModel);

  const latestEvaluations = latestPerCase(readModel.evaluations);
  const counts = { ...readModel.counts };
  counts.ready_for_8i4 = latestEvaluations.filter(
    (row) => row.result_kind === "READY_FOR_8I4",
  ).length;

  return buildReadOnlyCanarySnapshot({
    capturedAt: now().toISOString(),
    evaluations: latestEvaluations,
    groupedRelocations: readModel.grouped_relocations,
    caseLineage: readModel.case_lineage,
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
