import { sha256Hex } from "./official-source-fetch.mjs";

export const REDISCOVERY_CONTRACT = "trust-phase8h-official-source-rediscovery-v1";

function normalizeHost(value) {
  return String(value || "").trim().toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
}

function decodeEntities(value) {
  return String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function normalizeSearchText(value) {
  return decodeURIComponent(String(value || ""))
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[-_+]+/g, " ")
    .replace(/[^\p{L}\p{N}%]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCandidateUrl(rawUrl) {
  const url = new URL(rawUrl);
  url.hash = "";
  return url.toString();
}

export function extractSitemapLocators(bytes) {
  const xml = Buffer.from(bytes).toString("utf8");
  const locators = [];
  const regex = /<loc\b[^>]*>([\s\S]*?)<\/loc>/gi;
  let match;
  while ((match = regex.exec(xml))) {
    const value = decodeEntities(match[1]).trim();
    if (value) locators.push(value);
  }
  return locators;
}

export function extractOfficialHtmlLinks(bytes, baseUrl) {
  const html = Buffer.from(bytes).toString("utf8");
  const links = [];
  const regex = /<a\b[^>]*href\s*=\s*(["'])(.*?)\1/gi;
  let match;
  while ((match = regex.exec(html))) {
    const href = decodeEntities(match[2]).trim();
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) continue;
    try {
      links.push(new URL(href, baseUrl).toString());
    } catch {
      // Invalid links are discovery noise, not authority.
    }
  }
  return links;
}

function candidateAllowed(rawUrl, input) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const allowedHosts = (input.allowed_hosts || []).map(normalizeHost);
  if (!allowedHosts.includes(normalizeHost(url.hostname))) return false;
  const prefixes = input.product_path_prefixes || ["/products/"];
  if (!prefixes.some((prefix) => url.pathname.startsWith(prefix))) return false;
  const excluded = input.exclude_path_substrings || [];
  if (excluded.some((part) => url.pathname.toLowerCase().includes(String(part).toLowerCase()))) return false;
  return true;
}

function scoreCandidate(rawUrl, terms = []) {
  const url = new URL(rawUrl);
  const haystack = normalizeSearchText(url.pathname + " " + url.search);
  let score = 0;
  const matches = [];
  for (const term of terms) {
    const normalized = normalizeSearchText(term);
    const matched = Boolean(normalized && haystack.includes(normalized));
    if (matched) score += Math.max(1, normalized.split(" ").length);
    matches.push({ term, matched });
  }
  return { score, matches };
}

function discoveryPriority(method) {
  if (method === "official_sitemap") return 3;
  if (method === "official_catalog_index") return 2;
  if (method === "external_search_seed") return 1;
  return 0;
}

function addCandidate(map, rawUrl, method, sourceSurface, input) {
  if (!candidateAllowed(rawUrl, input)) return;
  let locator;
  try {
    locator = normalizeCandidateUrl(rawUrl);
  } catch {
    return;
  }
  const scored = scoreCandidate(locator, input.query_terms || []);
  const minimumScore = Number(input.minimum_candidate_score ?? ((input.query_terms || []).length ? 1 : 0));
  if (scored.score < minimumScore) return;
  const row = {
    candidate_locator: locator,
    discovery_method: method,
    discovery_surface: sourceSurface,
    score: scored.score,
    query_term_matches: scored.matches,
  };
  const existing = map.get(locator);
  if (!existing || discoveryPriority(method) > discoveryPriority(existing.discovery_method)) {
    map.set(locator, row);
  }
}

export async function discoverOfficialSourceCandidates(input, {
  fetchHtml,
  fetchSitemap,
} = {}) {
  if (!input || input.contract !== REDISCOVERY_CONTRACT || !input.case_id) {
    throw new Error("TRUST_PHASE8H_REDISCOVERY_INPUT_INVALID");
  }
  if (typeof fetchHtml !== "function" || typeof fetchSitemap !== "function") {
    throw new Error("TRUST_PHASE8H_REDISCOVERY_FETCH_BOUNDARY_REQUIRED");
  }

  const maxSitemaps = Math.min(Math.max(Number(input.max_sitemaps || 8), 1), 12);
  const candidateLimit = Math.min(Math.max(Number(input.candidate_limit || 6), 1), 12);
  const candidates = new Map();
  const observations = [];
  const sitemapQueue = [];
  const seenSitemaps = new Set();

  for (const surface of input.discovery_surfaces || []) {
    if (surface.kind === "sitemap") sitemapQueue.push(surface.url);
    if (surface.kind === "html_index") {
      try {
        const fetched = await fetchHtml(surface.url);
        const links = extractOfficialHtmlLinks(fetched.bytes, fetched.finalUrl);
        observations.push({
          kind: "html_index",
          requested_url: surface.url,
          final_url: fetched.finalUrl,
          content_digest: sha256Hex(fetched.bytes),
          status: "FETCHED",
          link_count: links.length,
        });
        for (const link of links) addCandidate(candidates, link, "official_catalog_index", fetched.finalUrl, input);
      } catch (error) {
        observations.push({
          kind: "html_index",
          requested_url: surface.url,
          status: String(error?.message || error || "SOURCE_BLOCKED:unknown"),
        });
      }
    }
  }

  while (sitemapQueue.length && seenSitemaps.size < maxSitemaps) {
    const requested = sitemapQueue.shift();
    if (seenSitemaps.has(requested)) continue;
    seenSitemaps.add(requested);
    try {
      const fetched = await fetchSitemap(requested);
      const locators = extractSitemapLocators(fetched.bytes);
      observations.push({
        kind: "sitemap",
        requested_url: requested,
        final_url: fetched.finalUrl,
        content_digest: sha256Hex(fetched.bytes),
        status: "FETCHED",
        locator_count: locators.length,
      });
      for (const locator of locators) {
        let parsed;
        try {
          parsed = new URL(locator);
        } catch {
          continue;
        }
        const sameHost = (input.allowed_hosts || []).map(normalizeHost).includes(normalizeHost(parsed.hostname));
        if (!sameHost || parsed.protocol !== "https:") continue;
        if (/sitemap/i.test(parsed.pathname) && /\.xml(?:$|\?)/i.test(parsed.pathname + parsed.search)) {
          if (!seenSitemaps.has(locator) && sitemapQueue.length + seenSitemaps.size < maxSitemaps * 2) {
            sitemapQueue.push(locator);
          }
          continue;
        }
        addCandidate(candidates, locator, "official_sitemap", fetched.finalUrl, input);
      }
    } catch (error) {
      observations.push({
        kind: "sitemap",
        requested_url: requested,
        status: String(error?.message || error || "SOURCE_BLOCKED:unknown"),
      });
    }
  }

  for (const seed of input.external_search_seeds || []) {
    addCandidate(candidates, seed, "external_search_seed", "external_search_seed", input);
  }

  const ranked = [...candidates.values()]
    .sort((a, b) => b.score - a.score || discoveryPriority(b.discovery_method) - discoveryPriority(a.discovery_method) ||
      a.candidate_locator.localeCompare(b.candidate_locator))
    .slice(0, candidateLimit);

  const fetchedSurfaceCount = observations.filter((row) => row.status === "FETCHED").length;
  const transientOnly = observations.length > 0 && observations.every((row) => String(row.status).startsWith("TRANSIENT_FAILURE:"));
  const officialCandidateCount = ranked.filter((row) => row.discovery_method !== "external_search_seed").length;
  const externalSeedCount = ranked.filter((row) => row.discovery_method === "external_search_seed").length;
  const disposition = officialCandidateCount > 0
    ? "CANDIDATES_DISCOVERED"
    : externalSeedCount > 0
      ? "EXTERNAL_SEEDS_ONLY"
      : transientOnly
        ? "TRANSIENT_FAILURE"
        : fetchedSurfaceCount > 0
          ? "NO_SAFE_CANDIDATE"
          : "SOURCE_BLOCKED";

  return {
    contract: REDISCOVERY_CONTRACT,
    case_id: input.case_id,
    historical_source_id: input.historical_source_id,
    historical_source_ids: input.historical_source_ids || [input.historical_source_id],
    product_id: input.product_id,
    subject_id: input.subject_id,
    disposition,
    candidate_count: ranked.length,
    official_candidate_count: officialCandidateCount,
    external_seed_count: externalSeedCount,
    candidates: ranked,
    surface_observations: observations,
    mutation_policy: "READ_ONLY_NO_PRODUCTION_WRITE",
    authority: "DISCOVERY_CANDIDATES_ONLY_NOT_RELOCATION_AUTHORITY",
  };
}
