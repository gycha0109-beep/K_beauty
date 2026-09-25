import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import {
  fetchOfficialBytes,
  fetchOfficialSitemapBytes,
} from "../lib/trust/official-source-fetch.mjs";
import {
  REDISCOVERY_CONTRACT,
  discoverOfficialSourceCandidates,
} from "../lib/trust/official-source-rediscovery.mjs";
import { qualifyOfficialSourceIdentity } from "../lib/trust/official-source-identity-qualification.mjs";
import { observeQualificationCandidate } from "./trust-source-identity-qualification.mjs";

export const REDISCOVERY_BATCH_CONTRACT = "trust-phase8h-official-source-rediscovery-batch-v1";

function memoizeAsync(fn) {
  const cache = new Map();
  return async (key) => {
    if (!cache.has(key)) cache.set(key, Promise.resolve().then(() => fn(key)));
    return cache.get(key);
  };
}

function validateBatch(batch) {
  if (!batch || batch.contract !== REDISCOVERY_BATCH_CONTRACT || !Array.isArray(batch.cases)) {
    throw new Error("TRUST_PHASE8H_REDISCOVERY_BATCH_INVALID");
  }
  if (batch.case_count !== batch.cases.length) {
    throw new Error("TRUST_PHASE8H_REDISCOVERY_BATCH_COUNT_MISMATCH");
  }
  for (const row of batch.cases) {
    if (row?.contract !== REDISCOVERY_CONTRACT || !row?.qualification_template) {
      throw new Error("TRUST_PHASE8H_REDISCOVERY_CASE_INVALID");
    }
  }
}

export async function runRediscoveryQualificationBatch(batch, {
  fetchHtml = fetchOfficialBytes,
  fetchSitemap = fetchOfficialSitemapBytes,
  observeCandidate = observeQualificationCandidate,
  observedAt = () => new Date().toISOString(),
} = {}) {
  validateBatch(batch);

  const cachedHtml = memoizeAsync(fetchHtml);
  const cachedSitemap = memoizeAsync(fetchSitemap);
  const cachedObserve = memoizeAsync(observeCandidate);
  const results = [];

  for (const input of batch.cases) {
    const rediscovery = await discoverOfficialSourceCandidates(input, {
      fetchHtml: cachedHtml,
      fetchSitemap: cachedSitemap,
    });

    const qualificationLimit = Math.min(
      Math.max(Number(input.qualification_candidate_limit || 4), 1),
      8
    );
    const qualifications = [];

    for (const candidate of rediscovery.candidates.slice(0, qualificationLimit)) {
      const observation = await cachedObserve(candidate.candidate_locator);
      const template = input.qualification_template;
      const qualificationInput = {
        ...template,
        case_id: `${input.case_id}::${candidate.candidate_locator}`,
        candidate: {
          candidate_locator: candidate.candidate_locator,
          discovery_method: candidate.discovery_method,
          publisher: template.candidate_defaults.publisher,
          market: template.candidate_defaults.market ?? null,
          source_kind: template.candidate_defaults.source_kind,
        },
        observation,
      };
      const qualification = qualifyOfficialSourceIdentity(qualificationInput);
      qualifications.push({
        candidate,
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
        qualification,
      });
    }

    const exact = qualifications.filter((row) => row.qualification.disposition === "QUALIFIED_EXACT");
    results.push({
      case_id: input.case_id,
      rediscovery,
      qualifications,
      exact_candidate_count: exact.length,
      disposition: exact.length > 0
        ? "QUALIFIED_EXACT_CANDIDATE_FOUND"
        : rediscovery.disposition === "CANDIDATES_DISCOVERED"
          ? "CANDIDATES_HELD_AFTER_QUALIFICATION"
          : rediscovery.disposition === "EXTERNAL_SEEDS_ONLY"
            ? "NO_SAFE_OFFICIAL_CANDIDATE"
            : rediscovery.disposition,
    });
  }

  const counts = Object.create(null);
  for (const row of results) counts[row.disposition] = (counts[row.disposition] || 0) + 1;

  return {
    contract: REDISCOVERY_BATCH_CONTRACT,
    observed_at: observedAt(),
    case_count: results.length,
    counts,
    results,
    mutation_policy: "READ_ONLY_NO_PRODUCTION_WRITE",
    authority: "DISCOVERY_AND_QUALIFICATION_EVIDENCE_ONLY_NOT_RELOCATION_AUTHORITY",
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
  if (!input) {
    throw new Error("Usage: node scripts/trust-source-rediscovery.mjs --input=<batch.json> [--output=<result.json>]");
  }
  const batch = JSON.parse(await fs.readFile(input, "utf8"));
  const result = await runRediscoveryQualificationBatch(batch);
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
