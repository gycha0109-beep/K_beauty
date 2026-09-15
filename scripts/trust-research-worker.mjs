import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;
const OBSERVATION_VERSION = "trust-research-observation-v1";
const USER_AGENT = "BEJEWELY-Trust-Research/1.0 (+official-source-evidence-worker)";

const TRANSIENT_HTTP = new Set([408, 425, 429]);

function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function normalizeHostname(hostname) {
  return hostname.trim().toLowerCase().replace(/\.$/, "");
}

function isPrivateIpv4(ip) {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224;
}

function isPrivateIpv6(ip) {
  const value = ip.toLowerCase();
  return value === "::" || value === "::1" || value.startsWith("fe8") || value.startsWith("fe9") ||
    value.startsWith("fea") || value.startsWith("feb") || value.startsWith("fc") || value.startsWith("fd") ||
    value.startsWith("::ffff:127.") || value.startsWith("::ffff:10.") || value.startsWith("::ffff:192.168.");
}

function isPrivateAddress(address) {
  const family = isIP(address);
  if (family === 4) return isPrivateIpv4(address);
  if (family === 6) return isPrivateIpv6(address);
  return true;
}

export async function assertSafeOfficialUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("SOURCE_BLOCKED:invalid_url");
  }
  const hostname = normalizeHostname(url.hostname);
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) {
    throw new Error("SOURCE_BLOCKED:https_only");
  }
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new Error("SOURCE_BLOCKED:private_hostname");
  }
  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) throw new Error("SOURCE_BLOCKED:private_ip");
    return url;
  }
  const answers = await lookup(hostname, { all: true, verbatim: true });
  if (!answers.length || answers.some(({ address }) => isPrivateAddress(address))) {
    throw new Error("SOURCE_BLOCKED:private_dns_resolution");
  }
  return url;
}

async function readBoundedBytes(response) {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) {
    throw new Error("SOURCE_BLOCKED:response_too_large");
  }
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error("SOURCE_BLOCKED:response_too_large");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, size);
}

export async function fetchOfficialBytes(rawUrl, fetchImpl = fetch) {
  let url = await assertSafeOfficialUrl(rawUrl);
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let response;
    try {
      response = await fetchImpl(url, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: { "user-agent": USER_AGENT, accept: "text/html,text/plain,application/xhtml+xml;q=0.9,*/*;q=0.1" },
      });
    } catch (error) {
      clearTimeout(timer);
      const wrapped = new Error("TRANSIENT_FAILURE:fetch_error");
      wrapped.cause = error;
      throw wrapped;
    }
    clearTimeout(timer);

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location || redirectCount === MAX_REDIRECTS) throw new Error("SOURCE_BLOCKED:redirect_limit");
      url = await assertSafeOfficialUrl(new URL(location, url).toString());
      continue;
    }
    if (TRANSIENT_HTTP.has(response.status) || response.status >= 500) {
      const error = new Error(`TRANSIENT_FAILURE:http_${response.status}`);
      error.retryAfterSeconds = response.status === 429 ? 900 : 300;
      throw error;
    }
    if (!response.ok) throw new Error(`SOURCE_BLOCKED:http_${response.status}`);

    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (!contentType.includes("text/html") && !contentType.includes("text/plain") && !contentType.includes("application/xhtml+xml")) {
      throw new Error("SOURCE_BLOCKED:unsupported_content_type");
    }
    const bytes = await readBoundedBytes(response);
    return { bytes, finalUrl: url.toString(), contentType };
  }
  throw new Error("SOURCE_BLOCKED:redirect_limit");
}

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

export function extractStrictFactCandidate(factKey, text) {
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
  return null;
}

function sourceKindForSeed(seed) {
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
    const extracted = extractStrictFactCandidate(task.fact_key, text);
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
