import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  prepareGptCatalogResearchPayload,
  GptCatalogIntakeError
} from "../lib/trust/gpt-catalog-intake.mjs";
import { processClaimedTask } from "./trust-research-worker.mjs";

function argValue(name) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? null;
}

async function readInput() {
  const file = argValue("file");
  if (file) {
    return JSON.parse(await fs.readFile(file, "utf8"));
  }
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) throw new Error("gpt_catalog_input_required");
  return JSON.parse(raw);
}

async function rpcOrThrow(client, name, args) {
  const { data, error } = await client.rpc(name, args);
  if (error) {
    throw new Error(`${name}:${error.code || "rpc_error"}:${error.message}`);
  }
  return data;
}

function allTasks(status) {
  const intakes = Array.isArray(status?.intakes) ? status.intakes : [];
  const map = new Map();
  for (const intake of intakes) {
    for (const task of Array.isArray(intake?.tasks) ? intake.tasks : []) {
      if (task?.id) map.set(task.id, task);
    }
  }
  return [...map.values()];
}

function summarizeFinalState(status) {
  const tasks = allTasks(status);
  const counts = {};
  for (const task of tasks) {
    const state = String(task?.state || "UNKNOWN");
    counts[state] = (counts[state] || 0) + 1;
  }

  const pending = (counts.RESEARCH_PENDING || 0) + (counts.RESEARCHING || 0);
  const candidates = counts.EVIDENCE_CANDIDATE || 0;
  const review = (counts.REVIEW_REQUIRED || 0) + (counts.BLOCKED || 0);
  const covered = (counts.ALREADY_COVERED || 0) + (counts.CONFIRMED || 0);

  let state = "TRUST_REVIEW_REQUIRED";
  if (pending > 0) state = "TRUST_RESEARCH_PENDING";
  else if (candidates > 0 && review === 0) state = "AWAITING_TRUST_APPROVAL";
  else if (candidates > 0) state = "PARTIAL_AWAITING_TRUST_APPROVAL";
  else if (covered > 0 && review === 0) state = "TRUST_ALREADY_COVERED";

  return {
    state,
    task_counts: counts,
    evidence_candidate_count: candidates,
    blocked_or_review_count: review,
    automatic_confirmation: false
  };
}

export async function runGptCatalogIntake({
  input,
  fetchImpl = fetch,
  researchLimit = 25
}) {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }

  const prepared = await prepareGptCatalogResearchPayload(input, fetchImpl);
  const client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const ingest = await rpcOrThrow(client, "ingest_gpt_catalog_product_v1", {
    p_request_id: prepared.requestId,
    p_payload: prepared.payload
  });

  const productId = ingest?.product_id ?? null;
  if (!productId || ingest?.state !== "TRUST_RESEARCH_READY") {
    return {
      contract: "gpt-catalog-intake-pipeline-v1",
      request_id: prepared.requestId,
      ingest,
      final: {
        state: ingest?.state || "INGEST_BLOCKED",
        automatic_confirmation: false
      }
    };
  }

  const claimed = await rpcOrThrow(client, "claim_gpt_catalog_research_tasks_v1", {
    p_product_id: productId,
    p_limit: researchLimit,
    p_lease_seconds: 300
  });

  const researchResults = [];
  for (const task of Array.isArray(claimed) ? claimed : []) {
    researchResults.push(await processClaimedTask(client, task, fetchImpl));
  }

  const status = await rpcOrThrow(client, "read_catalog_trust_product_status_v1", {
    p_product_id: productId
  });

  return {
    contract: "gpt-catalog-intake-pipeline-v1",
    request_id: prepared.requestId,
    product_id: productId,
    ingest,
    research_processed: researchResults.length,
    research_results: researchResults,
    trust_status: status,
    final: summarizeFinalState(status)
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const input = await readInput();
    const result = await runGptCatalogIntake({ input });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    if (error instanceof GptCatalogIntakeError) {
      console.error(JSON.stringify({
        status: "BLOCKED",
        code: error.code,
        detail: error.detail
      }));
      process.exitCode = 2;
    } else {
      console.error(String(error?.stack || error));
      process.exitCode = 1;
    }
  }
}
