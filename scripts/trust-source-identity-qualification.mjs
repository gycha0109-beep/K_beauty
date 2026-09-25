import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { fetchOfficialBytes, sha256Hex } from "../lib/trust/official-source-fetch.mjs";
import {
  IDENTITY_QUALIFICATION_CONTRACT,
  qualifyOfficialSourceIdentity,
} from "../lib/trust/official-source-identity-qualification.mjs";

export const QUALIFICATION_BATCH_CONTRACT = "trust-phase8h-source-identity-qualification-batch-v1";

function decodeEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripHtml(html) {
  return decodeEntities(
    String(html || "")
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  ).replace(/\s+/g, " ").trim();
}

function firstMatch(html, regex) {
  const match = regex.exec(html);
  return match ? decodeEntities(match[1]).replace(/\s+/g, " ").trim() : null;
}

export function buildQualificationObservation(bytes, finalUrl, contentType) {
  const html = Buffer.from(bytes).toString("utf8");
  const title = firstMatch(html, /<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const canonicalUrl =
    firstMatch(html, /<link\b[^>]*rel=["'][^"']*canonical[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>/i) ||
    firstMatch(html, /<link\b[^>]*href=["']([^"']+)["'][^>]*rel=["'][^"']*canonical[^"']*["'][^>]*>/i);
  return {
    ok: true,
    final_url: finalUrl,
    content_type: contentType,
    title,
    canonical_url: canonicalUrl,
    content_digest: sha256Hex(bytes),
    text: stripHtml(html),
  };
}

export async function observeQualificationCandidate(candidateLocator, fetchImpl = fetch) {
  try {
    const fetched = await fetchOfficialBytes(candidateLocator, fetchImpl);
    return buildQualificationObservation(fetched.bytes, fetched.finalUrl, fetched.contentType);
  } catch (error) {
    return { ok: false, error: String(error?.message || error || "SOURCE_BLOCKED:unknown") };
  }
}

function validateBatch(batch) {
  if (!batch || batch.contract !== QUALIFICATION_BATCH_CONTRACT || !Array.isArray(batch.cases)) {
    throw new Error("TRUST_PHASE8H_IDENTITY_QUALIFICATION_BATCH_INVALID");
  }
  if (batch.case_count !== batch.cases.length) {
    throw new Error("TRUST_PHASE8H_IDENTITY_QUALIFICATION_BATCH_COUNT_MISMATCH");
  }
  const seen = new Set();
  for (const row of batch.cases) {
    if (row?.contract !== IDENTITY_QUALIFICATION_CONTRACT || !row?.case_id) {
      throw new Error("TRUST_PHASE8H_IDENTITY_QUALIFICATION_CASE_INVALID");
    }
    if (seen.has(row.case_id)) throw new Error("TRUST_PHASE8H_IDENTITY_QUALIFICATION_CASE_DUPLICATE");
    seen.add(row.case_id);
  }
}

export async function runQualificationBatch(batch, {
  observe = observeQualificationCandidate,
  concurrency = 3,
  observedAt = () => new Date().toISOString(),
} = {}) {
  validateBatch(batch);
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 6) {
    throw new Error("TRUST_PHASE8H_IDENTITY_QUALIFICATION_CONCURRENCY_INVALID");
  }

  const results = new Array(batch.cases.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= batch.cases.length) return;
      const input = batch.cases[index];
      let observation;
      try {
        observation = await observe(input.candidate.candidate_locator);
      } catch (error) {
        observation = { ok: false, error: String(error?.message || error || "SOURCE_BLOCKED:unknown") };
      }
      const qualification = qualifyOfficialSourceIdentity({ ...input, observation });
      results[index] = {
        case_id: input.case_id,
        qualification,
        observation: observation.ok === true
          ? {
              ok: true,
              final_url: observation.final_url,
              content_type: observation.content_type,
              title: observation.title,
              canonical_url: observation.canonical_url,
              content_digest: observation.content_digest,
            }
          : { ok: false, error: observation.error },
      };
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, batch.cases.length || 1) }, () => worker()));

  const counts = Object.create(null);
  for (const row of results) {
    counts[row.qualification.disposition] = (counts[row.qualification.disposition] || 0) + 1;
  }

  return {
    contract: QUALIFICATION_BATCH_CONTRACT,
    observed_at: observedAt(),
    case_count: results.length,
    counts,
    results,
    mutation_policy: "READ_ONLY_NO_PRODUCTION_WRITE",
    authority: "QUALIFICATION_EVIDENCE_ONLY_NOT_RELOCATION_AUTHORITY",
  };
}

function argValue(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.slice(2).find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

async function main() {
  const input = argValue("input");
  const output = argValue("output");
  const concurrency = Number(argValue("concurrency") || "3");
  if (!input) {
    throw new Error("Usage: node scripts/trust-source-identity-qualification.mjs --input=<batch.json> [--output=<result.json>] [--concurrency=3]");
  }
  const batch = JSON.parse(await fs.readFile(input, "utf8"));
  const result = await runQualificationBatch(batch, { concurrency });
  const serialized = JSON.stringify(result, null, 2) + "\n";
  if (output) await fs.writeFile(output, serialized, "utf8");
  else process.stdout.write(serialized);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
