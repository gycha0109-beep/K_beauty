import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {buildAuthority, pretty, sha} from './product-evidence/product-fact-source-gap-recovery-wave-1-v1.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = process.env.V21_8D_OUTPUT_ROOT ? path.resolve(process.env.V21_8D_OUTPUT_ROOT) : ROOT;
const O = {
  evidence: path.join(outputRoot, 'evidence/product-evidence-expansion-v1/source-gap-recovery-wave-1-v1.json'),
  materialization: path.join(outputRoot, 'evidence/product-fact-adoption-v1/source-gap-recovery-wave-1-materialization-v1.json'),
  md: path.join(outputRoot, 'docs/evidence/product-fact-source-gap-recovery-wave-1-v1.md')
};

function render(x, evidenceSha, materializationSha) {
  const facts = Object.fromEntries(x.overlay.fact_proposals.map(v => [v.fact_key, v]));
  const h = x.overlay.historical_m1_subject;
  const s = x.overlay.m1_scope_adjudication;
  return `# V2.1-8D — Source Gap Recovery Wave 1\n\n> Repository-only evidence freeze / Fusion re-evaluation / future materialization dry-run. Hosted Product Fact writes = 0.\n\n## Immutable authority\n\n- source main: \`${x.overlay.authority.source_main_sha}\`\n- frozen V2.1-2 materialization: \`${x.overlay.frozen_authority.materialization_sha256}\`\n- frozen corpus/mapping/gap: \`${x.overlay.frozen_authority.corpus_sha256}\` / \`${x.overlay.frozen_authority.mapping_sha256}\` / \`${x.overlay.frozen_authority.gap_sha256}\`\n- M1 subject: \`${h.subject_semantic_key}\`\n- M1 formulation: \`${h.formulation_revision_key}\`\n- M1 selected_market: \`${h.selected_market}\`; subject market_applicability: \`${String(h.market_applicability)}\`\n- R1 incorrect prompt authority: \`RESOLVED_AS_PROMPT_AUTHORITY_ERROR\`\n\n## M1 scope adjudication\n\n- result: \`${s.result}\`\n- recovered fact/evidence market: \`KR\`\n- binding: \`${s.binding_state}\` / \`${s.binding_scope_relation}\`\n- historical Subject identity mutation required: \`${String(s.subject_identity_change_required)}\`\n\nThe controlled-write contract stores fact scope independently and rejects a market mismatch only when the Subject itself has a non-null market applicability. Resolved evidence accepts an exact/equivalent Subject binding with an \`equivalent\` or \`narrower\` scope relation. Therefore the historical M1 Subject remains unchanged while the recovered facts remain KR-scoped.\n\n## Recovery result\n\n- M1 RECOVERED_SUPPORTED: 2 propositions\n- M3 VARIANT_SCOPE_CONFLICT: 0 propositions\n- P1 FORMULATION_SCOPE_CONFLICT: 0 propositions\n- registry gap: \`subjective_soothing_observation\` only; no Registry expansion\n- \`primary_use_role=multi_area\`: \`${facts.primary_use_role.proposition_key}\`\n- \`barrier_support_claim=true\`: \`${facts.barrier_support_claim.proposition_key}\`\n- exact six-slot counts: 2 recovered / 2 variant conflict / 2 formulation conflict\n\n## Future materialization boundary\n\n- candidate: M1 only, 2 propositions / 1 product\n- future Subject: historical M1 identity, +1 only in a separate authorized stage\n- future source/binding: source insert +1 if the R2 read-only prestate remains unchanged; binding \`exact_subject_match/narrower\`\n- actual adopted products / Current facts remain 8 / 23\n- future V2.1-8E projection only: 9 / 25\n- evidence SHA-256: \`${evidenceSha}\`\n- materialization SHA-256: \`${materializationSha}\`\n- Hosted writes: 0\n\nNo V2.1-8E execution, P2 identity work, Registry mutation, production scoring change, or recommendation activation.\n`;
}

export function build() {
  const a = buildAuthority();
  const b = buildAuthority();
  const evidenceText = pretty(a.overlay);
  const materializationText = pretty(a.materialization);
  assert.equal(evidenceText, pretty(b.overlay), 'overlay builder non-deterministic');
  assert.equal(materializationText, pretty(b.materialization), 'materialization builder non-deterministic');
  const md = render(a, sha(evidenceText), sha(materializationText));
  for (const p of Object.values(O)) fs.mkdirSync(path.dirname(p), {recursive: true});
  fs.writeFileSync(O.evidence, evidenceText);
  fs.writeFileSync(O.materialization, materializationText);
  fs.writeFileSync(O.md, md);
  const result = {
    evidence_sha256: sha(evidenceText),
    materialization_sha256: sha(materializationText),
    md_sha256: sha(md),
    proposition_keys: Object.fromEntries(a.overlay.fact_proposals.map(x => [x.fact_key, x.proposition_key]))
  };
  console.log('source_gap_recovery_wave_1_build: PASS');
  for (const [k, v] of Object.entries(result)) console.log(`${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`);
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) build();
