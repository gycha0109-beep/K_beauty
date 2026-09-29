import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

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

export async function enqueueTransportDriftCases({ client, limit = 100 } = {}) {
  if (!client) throw new Error("client is required");
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
    throw new Error("limit must be an integer between 1 and 1000");
  }

  return rpcOrThrow(
    client,
    "enqueue_trust_official_source_transport_drift_cases_v1",
    { p_limit: limit },
  );
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }

  const limit = Number(argValue("limit") || "100");
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const result = await enqueueTransportDriftCases({ client, limit });
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
