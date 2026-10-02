import { createClient } from "@supabase/supabase-js";

function client(key) {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || !key) throw new Error("isolated_supabase_env_missing");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

async function rpcOk(db, name, args) {
  const { data, error } = await db.rpc(name, args);
  if (error) throw new Error(`${name}:${error.code || "rpc_error"}:${error.message}`);
  return data;
}

function payload({
  brand,
  name,
  category,
  market = "KR",
  officialUrl,
  digest
}) {
  const now = new Date().toISOString();
  return {
    contract_version: "gpt-catalog-research-v1",
    brand,
    product_name: name,
    category,
    market,
    locale: "ko-KR",
    official_url: officialUrl,
    identity_evidence: {
      providers: [
        {
          provider: "brand_official",
          locator: officialUrl,
          canonical_brand: brand,
          canonical_name: name
        },
        {
          provider: "independent_reference",
          locator: "https://reference.example.test/catalog/" + encodeURIComponent(name),
          canonical_brand: brand,
          canonical_name: name
        }
      ]
    },
    official_fetch: {
      final_url: officialUrl,
      content_digest: digest,
      content_type: "text/html; charset=utf-8",
      fetched_at: now,
      identity_observation: {
        brandMatched: true,
        productMatched: true,
        productTokenCoverage: 1
      }
    }
  };
}

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !serviceKey || !anonKey) throw new Error("isolated_supabase_env_missing");

const service = client(serviceKey);
const anon = client(anonKey);

const supportedRequest = "gpt-e2e-supported-sunscreen-001";
const supportedPayload = payload({
  brand: "GPT E2E Brand",
  name: "GPT E2E Daily Shield Sunscreen",
  category: "sunscreen",
  officialUrl: "https://official.example.test/products/gpt-e2e-daily-shield",
  digest: "a".repeat(64)
});

const unauthorized = await anon.rpc("ingest_gpt_catalog_product_v1", {
  p_request_id: supportedRequest,
  p_payload: supportedPayload
});
if (!unauthorized.error) throw new Error("anon_ingest_unexpectedly_allowed");

const ingest = await rpcOk(service, "ingest_gpt_catalog_product_v1", {
  p_request_id: supportedRequest,
  p_payload: supportedPayload
});
if (ingest?.state !== "TRUST_RESEARCH_READY") {
  throw new Error(`supported_ingest_not_research_ready:${JSON.stringify(ingest)}`);
}
for (const key of ["candidate_id","product_id","intake_id","subject_id","source_binding_id"]) {
  if (!ingest?.[key]) throw new Error(`supported_ingest_missing_${key}`);
}
if (ingest?.authority?.automatic_confirmation !== false) {
  throw new Error("automatic_confirmation_boundary_broken");
}

const replay = await rpcOk(service, "ingest_gpt_catalog_product_v1", {
  p_request_id: supportedRequest,
  p_payload: supportedPayload
});
if (replay?.idempotent !== true || replay?.product_id !== ingest.product_id) {
  throw new Error("supported_ingest_replay_not_idempotent");
}

const changed = structuredClone(supportedPayload);
changed.product_name = "GPT E2E Different Product";
changed.identity_evidence.providers = changed.identity_evidence.providers.map((provider) => ({
  ...provider,
  canonical_name: changed.product_name
}));
const changedReplay = await service.rpc("ingest_gpt_catalog_product_v1", {
  p_request_id: supportedRequest,
  p_payload: changed
});
if (!changedReplay.error) throw new Error("request_id_payload_conflict_not_rejected");

const statusBeforeClaim = await rpcOk(service, "read_catalog_trust_product_status_v1", {
  p_product_id: ingest.product_id
});
const beforeTasks = (statusBeforeClaim?.intakes || []).flatMap((intake) => intake?.tasks || []);
if (!beforeTasks.length || !beforeTasks.every((task) => ["RESEARCH_PENDING","ALREADY_COVERED"].includes(task.state))) {
  throw new Error(`unexpected_initial_task_states:${JSON.stringify(beforeTasks)}`);
}
if (!beforeTasks.some((task) => task.state === "RESEARCH_PENDING")) {
  throw new Error("no_research_pending_task_created");
}

const claimed = await rpcOk(service, "claim_gpt_catalog_research_tasks_v1", {
  p_product_id: ingest.product_id,
  p_limit: 25,
  p_lease_seconds: 300
});
if (!Array.isArray(claimed) || claimed.length < 1) {
  throw new Error("product_scoped_claim_empty");
}
if (claimed.some((task) => task.product_id !== ingest.product_id)) {
  throw new Error("product_scoped_claim_leaked_other_product");
}
if (claimed.some((task) => !Array.isArray(task.official_source_seeds) || task.official_source_seeds.length !== 1)) {
  throw new Error("official_source_seed_missing");
}
if (claimed.some((task) => task.official_source_seeds[0].source_name !== "gpt_official")) {
  throw new Error("unexpected_official_source_seed");
}

const unsupportedRequest = "gpt-e2e-unsupported-cushion-001";
const unsupportedPayload = payload({
  brand: "GPT E2E Makeup Brand",
  name: "GPT E2E Cushion",
  category: "foundation",
  officialUrl: "https://official.example.test/products/gpt-e2e-cushion",
  digest: "b".repeat(64)
});
const unsupported = await rpcOk(service, "ingest_gpt_catalog_product_v1", {
  p_request_id: unsupportedRequest,
  p_payload: unsupportedPayload
});
if (
  unsupported?.state !== "BLOCKED_UNSUPPORTED_CATEGORY" ||
  unsupported?.blocker_code !== "UNSUPPORTED_TRUST_CATEGORY" ||
  unsupported?.product_id
) {
  throw new Error(`unsupported_category_not_fail_closed:${JSON.stringify(unsupported)}`);
}

const unsupportedReadback = await rpcOk(service, "read_gpt_catalog_intake_run_v1", {
  p_request_id: unsupportedRequest
});
if (unsupportedReadback?.state !== "BLOCKED_UNSUPPORTED_CATEGORY") {
  throw new Error("unsupported_blocker_not_persisted");
}

console.log(JSON.stringify({
  contract: "trust-gpt-catalog-intake-isolated-e2e-v1",
  result: "PASS",
  supported: {
    state: ingest.state,
    task_count: beforeTasks.length,
    claimed_count: claimed.length,
    subject_created: Boolean(ingest.subject_id),
    official_binding_created: Boolean(ingest.source_binding_id),
    automatic_confirmation: false
  },
  unsupported: {
    category: "foundation",
    state: unsupported.state,
    blocker_code: unsupported.blocker_code
  },
  security: {
    anon_ingest_denied: true,
    request_reuse_conflict_denied: true,
    product_scoped_claim: true
  }
}, null, 2));
