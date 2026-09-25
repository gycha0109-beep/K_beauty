import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {
  REDISCOVERY_CONTRACT,
  discoverOfficialSourceCandidates,
  extractOfficialHtmlLinks,
  extractSitemapLocators,
} from "../lib/trust/official-source-rediscovery.mjs";
import {
  REDISCOVERY_BATCH_CONTRACT,
  runRediscoveryQualificationBatch,
} from "./trust-source-rediscovery.mjs";

const sitemapRoot = Buffer.from(`<?xml version="1.0"?>
<sitemapindex>
  <sitemap><loc>https://example.com/sitemap_products_1.xml</loc></sitemap>
  <sitemap><loc>https://example.com/sitemap_pages_1.xml</loc></sitemap>
</sitemapindex>`);
const sitemapProducts = Buffer.from(`<?xml version="1.0"?>
<urlset>
  <url><loc>https://example.com/products/relief-sun-rice-probiotics</loc></url>
  <url><loc>https://example.com/products/relief-sun-rice-probiotics-spf50-pa-uk</loc></url>
  <url><loc>https://example.com/products/relief-sun-aqua-fresh</loc></url>
  <url><loc>https://example.com/products/other-product</loc></url>
</urlset>`);
const sitemapPages = Buffer.from(`<?xml version="1.0"?><urlset><url><loc>https://example.com/pages/about</loc></url></urlset>`);
const htmlIndex = Buffer.from(`<html><body>
<a href="/products/relief-sun-rice-probiotics">Relief</a>
<a href="https://example.com/products/relief-sun-aqua-fresh">Aqua</a>
<a href="https://other.example/products/relief-sun-rice-probiotics">Wrong host</a>
</body></html>`);

assert.deepEqual(extractSitemapLocators(sitemapRoot), [
  "https://example.com/sitemap_products_1.xml",
  "https://example.com/sitemap_pages_1.xml",
]);
assert.deepEqual(extractOfficialHtmlLinks(htmlIndex, "https://example.com/products"), [
  "https://example.com/products/relief-sun-rice-probiotics",
  "https://example.com/products/relief-sun-aqua-fresh",
  "https://other.example/products/relief-sun-rice-probiotics",
]);

const baseDiscovery = {
  contract: REDISCOVERY_CONTRACT,
  case_id: "generic-relief",
  historical_source_id: "source-1",
  historical_source_ids: ["source-1", "source-2"],
  product_id: "product-1",
  subject_id: "subject-1",
  allowed_hosts: ["example.com"],
  product_path_prefixes: ["/products/"],
  exclude_path_substrings: ["-uk"],
  query_terms: ["relief sun", "rice probiotics"],
  candidate_limit: 4,
  discovery_surfaces: [
    { kind: "sitemap", url: "https://example.com/sitemap.xml" },
    { kind: "html_index", url: "https://example.com/products" }
  ],
  external_search_seeds: ["https://example.com/products/relief-sun-rice-probiotics"]
};

const fetchSitemap = async (url) => {
  if (url.endsWith("/sitemap.xml")) return { bytes: sitemapRoot, finalUrl: url, contentType: "application/xml" };
  if (url.includes("sitemap_products")) return { bytes: sitemapProducts, finalUrl: url, contentType: "application/xml" };
  if (url.includes("sitemap_pages")) return { bytes: sitemapPages, finalUrl: url, contentType: "application/xml" };
  throw new Error("SOURCE_BLOCKED:sitemap_http_404");
};
const fetchHtml = async (url) => ({ bytes: htmlIndex, finalUrl: url, contentType: "text/html" });

const discovered = await discoverOfficialSourceCandidates(baseDiscovery, { fetchHtml, fetchSitemap });
assert.equal(discovered.disposition, "CANDIDATES_DISCOVERED");
assert.deepEqual(discovered.historical_source_ids, ["source-1", "source-2"]);
assert.equal(discovered.candidates.some((row) => row.candidate_locator.includes("-uk")), false);
assert.equal(discovered.candidates[0].candidate_locator, "https://example.com/products/relief-sun-rice-probiotics");
assert.equal(discovered.candidates[0].discovery_method, "official_sitemap");
assert.equal(discovered.mutation_policy, "READ_ONLY_NO_PRODUCTION_WRITE");

const externalOnly = await discoverOfficialSourceCandidates({
  ...baseDiscovery,
  discovery_surfaces: [{ kind: "sitemap", url: "https://example.com/other-only.xml" }],
  external_search_seeds: ["https://example.com/products/relief-sun-rice-probiotics"]
}, {
  fetchHtml,
  fetchSitemap: async (url) => ({
    bytes: Buffer.from(`<?xml version="1.0"?><urlset><url><loc>https://example.com/products/other-product</loc></url></urlset>`),
    finalUrl: url,
    contentType: "application/xml"
  })
});
assert.equal(externalOnly.disposition, "EXTERNAL_SEEDS_ONLY");
assert.equal(externalOnly.official_candidate_count, 0);
assert.equal(externalOnly.external_seed_count, 1);
assert.equal(externalOnly.candidates.length, 1);

const exactTemplate = {
  contract: "trust-phase8h-source-identity-qualification-v1",
  historical_source: {
    source_id: "source-1",
    canonical_locator: "https://example.com/products/relief-sun-rice-probiotics",
    publisher: "Example",
    source_kind: "official_product_page",
    market: "GLOBAL"
  },
  governed_subject: {
    product_id: "product-1",
    subject_id: "subject-1",
    variant_key: "RELIEF",
    formulation_revision_key: "FORMULA-1",
    market: "GLOBAL"
  },
  candidate_defaults: {
    publisher: "Example",
    market: "GLOBAL",
    source_kind: "official_product_page"
  },
  reviewed_binding: {
    binding_id: "binding-1",
    product_id: "product-1",
    subject_id: "subject-1",
    binding_state: "resolved",
    source_url: "https://example.com/products/relief-sun-rice-probiotics",
    source_market: "GLOBAL",
    variant_key: "RELIEF",
    formulation_revision_key: "FORMULA-1",
    review_version: "trust-official-source-review-v1"
  },
  requirements: {
    allowed_hosts: ["example.com"],
    product_anchors_all: ["Relief Sun"],
    product_anchors_any: ["Rice + Probiotics", "Rice + Niacinamide"],
    market_anchors_all: [],
    variant_anchors_all: [],
    formulation_anchors_all: ["same formula", "Rice + Probiotics", "Rice + Niacinamide"],
    claim_anchors_all: ["SPF50+"],
    allow_anchor_only_formulation_proof: true
  },
  observation: {}
};

const unsupportedTemplate = {
  ...exactTemplate,
  historical_source: {
    ...exactTemplate.historical_source,
    source_id: "source-aqua",
    canonical_locator: "https://example.com/products/relief-sun-aqua-fresh"
  },
  governed_subject: {
    product_id: "product-aqua",
    subject_id: "subject-aqua",
    variant_key: "AQUA_50ML",
    formulation_revision_key: "AQUA-FORMULA",
    market: null
  },
  candidate_defaults: {
    publisher: "Example",
    market: null,
    source_kind: "official_product_page"
  },
  reviewed_binding: null,
  requirements: {
    allowed_hosts: ["example.com"],
    product_anchors_all: ["Relief Sun Aqua-Fresh", "Rice + B5"],
    market_anchors_all: [],
    variant_anchors_all: ["50 mL"],
    formulation_anchors_all: ["rice seed water", "panthenol"],
    claim_anchors_all: ["SPF50+"],
    allow_anchor_only_subject_proof: false,
    allow_anchor_only_formulation_proof: false
  }
};

const batch = {
  contract: REDISCOVERY_BATCH_CONTRACT,
  case_count: 2,
  cases: [
    {
      ...baseDiscovery,
      qualification_candidate_limit: 1,
      qualification_template: exactTemplate
    },
    {
      ...baseDiscovery,
      case_id: "generic-aqua",
      historical_source_id: "source-aqua",
      historical_source_ids: ["source-aqua"],
      product_id: "product-aqua",
      subject_id: "subject-aqua",
      query_terms: ["relief sun aqua fresh"],
      qualification_candidate_limit: 2,
      qualification_template: unsupportedTemplate
    }
  ]
};

const observeCandidate = async (url) => {
  if (url.includes("aqua-fresh")) {
    return {
      ok: true,
      final_url: url,
      title: "Relief Sun Aqua-Fresh : Rice + B5 (SPF50+ PA++++)",
      canonical_url: url,
      content_digest: "b".repeat(64),
      text: "Relief Sun Aqua-Fresh : Rice + B5 (SPF50+ PA++++) 50 mL rice seed water panthenol"
    };
  }
  return {
    ok: true,
    final_url: url,
    title: "Relief Sun : Rice + Niacinamide (SPF50+ PA++++)",
    canonical_url: url,
    content_digest: "a".repeat(64),
    text: "Relief Sun Rice + Niacinamide SPF50+ same formula renamed from Rice + Probiotics to Rice + Niacinamide"
  };
};

const batchResult = await runRediscoveryQualificationBatch(batch, {
  fetchHtml,
  fetchSitemap,
  observeCandidate,
  observedAt: () => "2026-09-25T00:00:00.000Z"
});
assert.equal(batchResult.case_count, 2);
assert.equal(batchResult.results[0].disposition, "QUALIFIED_EXACT_CANDIDATE_FOUND");
assert.equal(batchResult.results[0].qualifications[0].qualification.disposition, "QUALIFIED_EXACT");
assert.equal(batchResult.results[1].disposition, "CANDIDATES_HELD_AFTER_QUALIFICATION");
assert.ok(batchResult.results[1].qualifications.some((row) => row.qualification.disposition === "UNSUPPORTED_SEMANTICS"));
assert.equal(batchResult.mutation_policy, "READ_ONLY_NO_PRODUCTION_WRITE");

for (const path of [
  "lib/trust/official-source-rediscovery.mjs",
  "scripts/trust-source-rediscovery.mjs"
]) {
  const implementation = await fs.readFile(path, "utf8");
  for (const forbidden of ["createClient(", ".rpc(", ".insert(", ".upsert(", ".delete(", "apply_migration"]) {
    assert.equal(implementation.includes(forbidden), false, `${path} must stay read-only: ${forbidden}`);
  }
  assert.equal(["@supabase/", "supabase-js", "SUPABASE_"].some((token) => implementation.includes(token)), false);
}

const engine = await fs.readFile("lib/trust/official-source-rediscovery.mjs", "utf8");
for (const forbidden of [
  "Beauty of Joseon",
  "beautyofjoseon.com",
  "4f74de41-9515-495c-8c93-19ab1cd3cf6d",
  "5752312a-3109-4da7-a796-9b3de1765112"
]) {
  assert.equal(engine.includes(forbidden), false, `rediscovery engine must not branch on canary data: ${forbidden}`);
}

const liveSummary = JSON.parse(
  await fs.readFile("docs/evidence/trust-phase8h-boj-rediscovery-live-summary-v1.json", "utf8")
);
assert.equal(liveSummary.contract, "trust-phase8h-boj-rediscovery-live-summary-v1");
assert.equal(liveSummary.rediscovery_contract, REDISCOVERY_CONTRACT);
assert.equal(liveSummary.case_count, 2);
assert.equal(liveSummary.counts.NO_SAFE_OFFICIAL_CANDIDATE, 2);
assert.equal(liveSummary.mutation_policy, "READ_ONLY_NO_PRODUCTION_WRITE");
assert.equal(liveSummary.relocation_authority_created, false);
assert.match(liveSummary.github_evidence.head_sha, /^[a-f0-9]{40}$/);
assert.match(liveSummary.github_evidence.artifact_digest, /^sha256:[a-f0-9]{64}$/);
assert.equal(liveSummary.cases.length, 2);
assert.ok(liveSummary.cases.every((row) => row.official_candidate_count === 0));
assert.ok(liveSummary.cases.every((row) => row.rediscovery_disposition === "EXTERNAL_SEEDS_ONLY"));
assert.ok(liveSummary.cases.every((row) => row.case_disposition === "NO_SAFE_OFFICIAL_CANDIDATE"));
assert.ok(liveSummary.cases.every((row) => row.external_seed_qualification === "AMBIGUOUS_IDENTITY"));

console.log("TRUST_PHASE8H_OFFICIAL_SOURCE_REDISCOVERY_VERIFIED");
