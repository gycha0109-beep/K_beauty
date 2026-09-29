import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { buildProtectionExpansionWave1 } from "./product-evidence/data-ai29c-protection-expansion-selection-v1.mjs";

const OUT_JSON = "evidence/product-fact-catalog-expansion-v1/data-ai29c-protection-expansion-wave-1-selection-v1.json";
const OUT_MD = "docs/evidence/data-ai29c-protection-expansion-wave-1-selection-v1.md";
const root = process.env.DATA_AI29C_C5_OUTPUT_ROOT ? path.resolve(process.env.DATA_AI29C_C5_OUTPUT_ROOT) : process.cwd();

function sha256(text) { return crypto.createHash("sha256").update(text, "utf8").digest("hex"); }
function write(rel, text) { const absolute = path.join(root, rel); fs.mkdirSync(path.dirname(absolute), { recursive: true }); fs.writeFileSync(absolute, text); }

function renderMarkdown(result) {
  const lines = [];
  const corpus = result.current_protection_corpus;
  const pool = result.candidate_pool_summary;
  lines.push("# DATA-AI29C-C5 — Protection Discrimination Recovery Wave 1 Planning");
  lines.push("");
  lines.push("> Planning-only authority. Candidate crawler/ranking data is a discovery and research-priority lead only. It is not Product Fact evidence, does not promote Products, and does not change Recommendation.");
  lines.push("");
  lines.push("## Authority");
  lines.push("");
  lines.push("- Source main: `" + result.authority.source_main_sha + "`");
  lines.push("- Registry: `" + result.authority.registry_version + "`");
  lines.push("- Taxonomy: `" + result.authority.taxonomy_version + "`");
  lines.push("- Selection policy: `" + result.authority.selection_policy_version + "`");
  lines.push("- Frozen snapshot SHA256: `" + result.authority.snapshot_sha256 + "`");
  lines.push("- Mode: `" + result.mode + "`");
  lines.push("");
  lines.push("## Current governed sunscreen corpus");
  lines.push("");
  lines.push("| Axis | Eligible | Distinct scoring buckets |");
  lines.push("|---|---:|---:|");
  lines.push("| SPF | " + corpus.spfEligibleCount + " / " + corpus.sunscreenCount + " | " + corpus.spfDistinctScoringBuckets + " |");
  lines.push("| UVA | " + corpus.uvaEligibleCount + " / " + corpus.sunscreenCount + " | " + corpus.uvaDistinctScoringBuckets + " |");
  lines.push("| Water duration | " + corpus.waterEligibleCount + " / " + corpus.sunscreenCount + " | " + corpus.waterDistinctScoringBuckets + " |");
  lines.push("");
  lines.push("- Production cutover authorized: **false**");
  lines.push("- Outdoor rankable signal authorized: **false**");
  lines.push("");
  lines.push("## Frozen candidate pool");
  lines.push("");
  lines.push("- Canonical taxonomy sunscreen candidates: " + pool.frozen_candidate_count);
  lines.push("- Planning eligible: " + pool.eligible_candidate_count);
  lines.push("- Excluded: " + pool.excluded_candidate_count);
  lines.push("- Selected Wave 1: " + pool.selected_candidate_count);
  lines.push("- Deferred: " + pool.deferred_candidate_count);
  lines.push("");
  lines.push("### Protection discovery leads");
  lines.push("");
  lines.push("- Exact discrimination leads: " + pool.exact_discrimination_lead_candidates);
  lines.push("- SPF non-50 leads: " + pool.spf_non_50_lead_candidates);
  lines.push("- UVA non-PA++++ leads: " + pool.uva_non_pa4_lead_candidates);
  lines.push("- Numeric water-duration leads: " + pool.water_duration_lead_candidates);
  lines.push("- Durationless water-claim research leads: " + pool.water_claim_research_lead_candidates);
  lines.push("");
  lines.push("The frozen source metadata contains **no exact SPF/UVA/water-duration discrimination lead**. Wave 1 therefore runs in research-readiness fallback mode. A durationless water claim may increase research priority, but it is never converted into a water-resistance duration.");
  lines.push("");
  lines.push("## Exact Wave 1 selection");
  lines.push("");
  lines.push("| Rank | Candidate | Brand | Product | Class | Score | Source rank | Evidence obs. | Leads |");
  lines.push("|---:|---|---|---|---|---:|---:|---:|---|");
  for (const candidate of result.selected_candidates) {
    const leads = Object.entries(candidate.discovery_leads).filter(([, value]) => value).map(([key]) => key).join(", ") || "none";
    lines.push("| " + candidate.selection_rank + " | `" + candidate.candidate_id + "` | " + candidate.brand + " | " + candidate.name + " | " + candidate.priority_class + " | " + candidate.priority_score + " | " + candidate.best_rank_position + " | " + candidate.source_evidence_count + " | " + leads + " |");
  }
  lines.push("");
  lines.push("## Selection semantics");
  lines.push("");
  lines.push("- `spf_non_50`, `uva_non_pa4`, `water_duration`: candidate-source discovery leads only.");
  lines.push("- `water_claim_research`: durationless research lead only; never duration evidence.");
  lines.push("- Hwahae/ranking/crawler data is not Product Fact positive authority.");
  lines.push("- Exact Product/Subject identity and official evidence remain governed by Catalog Review → TRUST → Product Fact.");
  lines.push("- Missing evidence remains unknown, never false and never a ranking penalty.");
  lines.push("");
  lines.push("## Next operational stage");
  lines.push("");
  lines.push("Each selected candidate must pass the existing catalog-only identity preflight/approval and promotion authority before TRUST intake. This planning artifact itself performs no promotion and no Hosted mutation.");
  lines.push("");
  lines.push("## Invariants");
  lines.push("");
  lines.push("- Hosted writes: 0");
  lines.push("- Product promotion intent: 0");
  lines.push("- Product Fact write intent: 0");
  lines.push("- Recommendation write intent: 0");
  lines.push("- Production ranking changed: false");
  lines.push("- Candidate source used as Product Fact authority: false");
  lines.push("- Water claim converted to duration evidence: false");
  lines.push("- Runtime consumption: false");
  lines.push("");
  return lines.join("\n");
}

const result = buildProtectionExpansionWave1(process.cwd());
const json = JSON.stringify(result, null, 2) + "\n";
const md = renderMarkdown(result) + "\n";
write(OUT_JSON, json);
write(OUT_MD, md);
console.log("DATA_AI29C_C5_PROTECTION_EXPANSION_BUILD=PASS");
console.log("selection_json_sha256=" + sha256(json));
console.log("selection_md_sha256=" + sha256(md));
console.log("selected_candidate_ids=" + JSON.stringify(result.selected_candidates.map((item) => item.candidate_id)));
console.log("mode=" + result.mode);
