import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { fetchOfficialBytes, sha256Hex } from "../lib/trust/official-source-fetch.mjs";
import { inspectOfficialProductSemanticSurfacesV1, normalizeSemanticTextV1 } from "../lib/trust/official-source-semantic-adapter.mjs";
export { assertSafeOfficialUrl } from "../lib/trust/official-source-fetch.mjs";

const OBSERVATION_VERSION = "trust-research-observation-v1";

function htmlToObservationText(bytes) {
  return bytes.toString("utf8")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function excerpt(text, index, length) {
  const start = Math.max(0, index - 100);
  return text.slice(start, Math.min(text.length, index + length + 100));
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsExpectedEntity(value, expected) {
  const haystack = normalizeSemanticTextV1(value || "").toLowerCase();
  const needle = normalizeSemanticTextV1(expected || "").toLowerCase().replace(/_/g, " ");
  if (!needle) return false;
  const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegex(needle)}(?=$|[^a-z0-9])`, "i");
  return pattern.test(haystack);
}

function extractExpectedContainsActive(currentFactContext, semanticSurfaces) {
  const identifier = String(currentFactContext?.value_entity_identifier || "").trim().toLowerCase();
  const propositionKey = String(currentFactContext?.proposition_key || "").trim().toLowerCase();
  if (!identifier || !/^[0-9a-f]{64}$/.test(propositionKey)) return null;

  const candidates = [
    ["document.title", semanticSurfaces?.document?.title],
    ["document.meta_title", semanticSurfaces?.document?.meta_title],
    ["document.og_title", semanticSurfaces?.document?.og_title],
    ...((semanticSurfaces?.structured_product_names || []).map((value, index) => [`structured_product_names.${index}`, value])),
  ].filter(([, value]) => typeof value === "string" && value.trim());

  const matches = candidates.filter(([, value]) => containsExpectedEntity(value, identifier));
  if (!matches.length) return null;

  const [surface, value] = matches[0];
  return {
    normalizedValue: identifier,
    evidenceClass: "composition_identity",
    qualifier: {},
    observedClaim: {
      matched_text: identifier,
      excerpt: normalizeSemanticTextV1(value),
      extractor: "expected-entity-product-identity-v1",
      identity_surface: surface,
      current_proposition_key: propositionKey,
    },
  };
}

export function extractStrictFactCandidate(factKey, text, parentPropositions = [], context = {}) {
  if (factKey === "contains_active") {
    return extractExpectedContainsActive(context.currentFactContext, context.semanticSurfaces);
  }
  if (factKey === "spf_value") {
    const match = /\bSPF\s*([1-9]\d{0,2}(?:\.\d+)?)\s*(\+)?(?=\s|$|[<,.;/])/i.exec(text);
    if (!match) return null;
    return {
      normalizedValue: Number(match[1]),
      evidenceClass: "product_claim",
      qualifier: { plus_modifier: match[2] ? "plus" : "none" },
      observedClaim: { matched_text: match[0], excerpt: excerpt(text, match.index, match[0].length), extractor: "explicit-spf-label-v1" },
    };
  }
  if (factKey === "uva_label") {
    const match = /\bPA\+{1,4}(?=\s|$|[<,.;/])/i.exec(text);
    if (!match) return null;
    return {
      normalizedValue: match[0].toUpperCase(),
      evidenceClass: "product_claim",
      qualifier: {},
      observedClaim: { matched_text: match[0], excerpt: excerpt(text, match.index, match[0].length), extractor: "explicit-pa-label-v1" },
    };
  }
  if (factKey === "uv_filter_type") {
    const patterns = [
      { value: "hybrid", regex: /\bhybrid sunscreen\b|혼합\s*자차|혼합\s*자외선\s*차단제/i },
      { value: "mineral", regex: /\b(?:100%\s+)?mineral sunscreen\b|\bphysical sunscreen\b|무기\s*자차|무기\s*자외선\s*차단제/i },
      { value: "organic", regex: /\bchemical sunscreen\b|\borganic sunscreen\b|유기\s*자차|유기\s*자외선\s*차단제/i },
    ];
    for (const { value, regex } of patterns) {
      const match = regex.exec(text);
      if (!match) continue;
      return {
        normalizedValue: value,
        evidenceClass: "product_claim",
        qualifier: {},
        observedClaim: { matched_text: match[0], excerpt: excerpt(text, match.index, match[0].length), extractor: "explicit-filter-system-claim-v1" },
      };
    }
  }
  if (factKey === "active_concentration") {
    const matches = [];
    for (const parent of Array.isArray(parentPropositions) ? parentPropositions : []) {
      const identifier = String(parent?.value_entity_identifier || "").trim().toLowerCase();
      const propositionKey = String(parent?.proposition_key || "").trim().toLowerCase();
      if (!identifier || !/^[0-9a-f]{64}$/.test(propositionKey)) continue;
      const label = escapeRegex(identifier.replace(/_/g, " ").replace(/\s+/g, " ").trim());
      if (!label) continue;
      const patterns = [
        { unit: "percent", regex: new RegExp(`\\b(\\d+(?:\\.\\d+)?)\\s*%\\s+${label}\\b`, "i") },
        { unit: "percent", regex: new RegExp(`\\b${label}\\b[^%\\n]{0,24}?(\\d+(?:\\.\\d+)?)\\s*%`, "i") },
        { unit: "ppm", regex: new RegExp(`\\b(\\d+(?:\\.\\d+)?)\\s*ppm\\s+${label}\\b`, "i") },
        { unit: "ppm", regex: new RegExp(`\\b${label}\\b[^\\n]{0,24}?(\\d+(?:\\.\\d+)?)\\s*ppm\\b`, "i") },
        { unit: "mg_per_g", regex: new RegExp(`\\b(\\d+(?:\\.\\d+)?)\\s*mg\\s*\\/\\s*g\\s+${label}\\b`, "i") },
        { unit: "mg_per_g", regex: new RegExp(`\\b${label}\\b[^\\n]{0,24}?(\\d+(?:\\.\\d+)?)\\s*mg\\s*\\/\\s*g\\b`, "i") },
      ];
      for (const { unit, regex } of patterns) {
        const match = regex.exec(text);
        if (!match) continue;
        matches.push({
          normalizedValue: { amount: Number(match[1]), unit },
          parentPropositionKey: propositionKey,
          evidenceClass: "product_claim",
          qualifier: {},
          observedClaim: {
            matched_text: match[0],
            excerpt: excerpt(text, match.index, match[0].length),
            extractor: "explicit-parent-bound-active-concentration-v1",
            parent_value_entity_identifier: identifier,
            parent_proposition_key: propositionKey,
          },
        });
        break;
      }
    }
    return matches.length === 1 ? matches[0] : null;
  }
  return null;
}

function sourceKindForSeed(seed) {
  const governedKinds = new Set([
    "brand_official_product_page",
    "brand_official_faq",
    "brand_official_technical_document",
    "manufacturer_official_document",
    "official_market_sales_page",
  ]);
  if (governedKinds.has(seed.external_type)) return seed.external_type;
  return seed.external_type === "official_product" ? "brand_official_product_page" : "official_market_sales_page";
}

function classifyWorkerError(error) {
  const message = String(error?.message || error || "unknown");
  if (message.startsWith("TRANSIENT_FAILURE:")) {
    return { outcome: "TRANSIENT_FAILURE", detail: message, retry_after_seconds: error?.retryAfterSeconds || 300 };
  }
  return { outcome: "SOURCE_BLOCKED", detail: message };
}

async function rpcOrThrow(client, name, args) {
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(`${name}:${error.code || "rpc_error"}:${error.message}`);
  return data;
}

export async function processClaimedTask(client, task, fetchImpl = fetch) {
  const seeds = Array.isArray(task.official_source_seeds) ? task.official_source_seeds : [];
  if (!seeds.length) {
    return rpcOrThrow(client, "record_trust_research_result_v1", {
      p_task_id: task.task_id,
      p_result: { outcome: "SOURCE_BLOCKED", detail: "No exact-market resolved *_official HTTPS source binding is available." },
    });
  }

  let hadReadableOfficialSource = false;
  let lastTransient = null;
  let lastBlocked = null;

  for (const seed of seeds) {
    let fetched;
    try {
      fetched = await fetchOfficialBytes(seed.canonical_locator, fetchImpl);
      hadReadableOfficialSource = true;
    } catch (error) {
      const classified = classifyWorkerError(error);
      if (classified.outcome === "TRANSIENT_FAILURE") lastTransient = classified;
      else lastBlocked = classified;
      continue;
    }

    const text = htmlToObservationText(fetched.bytes);
    const semanticSurfaces = inspectOfficialProductSemanticSurfacesV1(fetched.bytes);
    const extracted = extractStrictFactCandidate(
      task.fact_key,
      text,
      task.parent_propositions,
      { currentFactContext: task.current_fact_context, semanticSurfaces },
    );
    if (!extracted) continue;

    const observedAt = new Date().toISOString();
    return rpcOrThrow(client, "record_trust_research_result_v1", {
      p_task_id: task.task_id,
      p_result: {
        outcome: "EVIDENCE_CANDIDATE",
        source: {
          source_binding_id: seed.source_binding_id,
          source_kind: sourceKindForSeed(seed),
          digest_basis: "live-page-bytes-v1",
          source_content_digest: sha256Hex(fetched.bytes),
          observation_version: OBSERVATION_VERSION,
          observed_at: observedAt,
          fetched_at: observedAt,
          observed_claim: extracted.observedClaim,
          product_identity_observation: {
            product_id: task.product_id,
            subject_id: task.subject_id,
            source_binding_id: seed.source_binding_id,
            source_name: seed.source_name,
            binding_method: seed.binding_method,
            product_scope_state: seed.product_scope_state,
            exact_catalog_product_binding: true,
          },
        },
        candidate: {
          normalized_value: extracted.normalizedValue,
          ...(extracted.parentPropositionKey ? { parent_proposition_key: extracted.parentPropositionKey } : {}),
          evidence_class: extracted.evidenceClass,
          confidence: "high",
          support_direction: "supports",
          negative_admissibility: "not_applicable",
          qualifier: extracted.qualifier,
        },
      },
    });
  }

  const result = lastTransient || (hadReadableOfficialSource
    ? { outcome: "EVIDENCE_INSUFFICIENT", detail: "Official source was readable but no strict positive claim matched the task fact. Missing is not false." }
    : lastBlocked || { outcome: "SOURCE_BLOCKED", detail: "No official source could be fetched." });
  return rpcOrThrow(client, "record_trust_research_result_v1", { p_task_id: task.task_id, p_result: result });
}

export async function runResearchWorker({ limit = 5, leaseSeconds = 300, fetchImpl = fetch } = {}) {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  const client = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const tasks = await rpcOrThrow(client, "claim_trust_research_tasks_v1", { p_limit: limit, p_lease_seconds: leaseSeconds });
  const results = [];
  for (const task of Array.isArray(tasks) ? tasks : []) {
    try {
      results.push(await processClaimedTask(client, task, fetchImpl));
    } catch (error) {
      try {
        results.push(await rpcOrThrow(client, "record_trust_research_result_v1", {
          p_task_id: task.task_id,
          p_result: classifyWorkerError(error),
        }));
      } catch {
        // The lease remains recoverable by claim_trust_research_tasks_v1; never log credentials or payloads.
      }
    }
  }
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const limitArg = Number(process.argv.find((arg) => arg.startsWith("--limit="))?.split("=")[1] || 5);
  const results = await runResearchWorker({ limit: limitArg });
  console.log(JSON.stringify({ processed: results.length }));
}