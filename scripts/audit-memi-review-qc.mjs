#!/usr/bin/env node
// Local-only MEMI-DS human review triage; no image or mask bytes are read.
// Private records (including reviewer notes) are written only to an explicit --out path.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const STATUS = new Set(['pass', 'fail', 'unsure']);
const GROUPS = new Set(['Flaky', 'Punctate']);
const POSES = new Set(['F', 'L', 'R']);
const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const emptyCounts = () => ({ pass: 0, fail: 0, unsure: 0, total: 0 });
function increment(c, status) { c[status]++; c.total++; }

export function triage(source, sourceHash = null, expect131 = false) {
  if (!source || source.format !== 'bejeweIy-memi-review-v1' || !Array.isArray(source.reviewed)) {
    throw new Error('Unsupported review schema; no output generated');
  }
  if (expect131 && (source.reviewed.length !== 131 || source.totalImages !== 131)) {
    throw new Error('Expected the reviewed 131-pair partial release');
  }
  const perGroup = Object.fromEntries([...GROUPS].map(g => [g, emptyCounts()]));
  const perPose = Object.fromEntries([...GROUPS].flatMap(g => [...POSES].map(p => [g + '/' + p, emptyCounts()])));
  const tagCounts = { missing: 0, false_positive: 0, forehead_false_positive: 0, explicit_shine: 0, inconsistent_pass: 0, unreasoned_fail: 0 };
  const seen = new Set();
  const records = [];
  for (const row of source.reviewed) {
    if (!row || !STATUS.has(row.status) || !GROUPS.has(row.group) || typeof row.note !== 'string' || typeof row.id !== 'string') {
      throw new Error('Malformed review row; no output generated');
    }
    const match = /^([A-Za-z]+)\/([0-9]+)_([FLR])$/.exec(row.id);
    if (!match || match[1] !== row.group || row.name !== match[2] + '_' + match[3] || seen.has(row.id)) {
      throw new Error('Duplicate or inconsistent image reference; no output generated');
    }
    seen.add(row.id);
    const pose = match[3], note = row.note;
    const omission = /누락/.test(note);
    const falsePositive = /오탐|모탐/.test(note);
    const forehead = /이마/.test(note);
    const shine = /윤기|광택|반사/.test(note);
    if (omission) tagCounts.missing++;
    if (falsePositive) tagCounts.false_positive++;
    if (falsePositive && forehead) tagCounts.forehead_false_positive++;
    if (shine && falsePositive) tagCounts.explicit_shine++;
    const inconsistentPass = row.status === 'pass' && (omission || falsePositive);
    const unreasonedFail = row.status === 'fail' && !note.trim();
    if (inconsistentPass) tagCounts.inconsistent_pass++;
    if (unreasonedFail) tagCounts.unreasoned_fail++;
    let triageBand = 'clean_pass_candidate';
    if (inconsistentPass) triageBand = 'pass_note_conflict_hold';
    else if (row.status === 'unsure') triageBand = 'ambiguous_hold';
    else if (unreasonedFail) triageBand = 'undocumented_failure_hold';
    else if (row.status === 'fail') triageBand = 'annotation_issue_review';
    // Status and note are deliberately not silently corrected, even on conflicts.
    const tags = [];
    if (omission) tags.push('suspected_omission');
    if (falsePositive) tags.push('suspected_false_positive');
    if (falsePositive && forehead) tags.push('forehead_false_positive_review');
    if (shine && falsePositive) tags.push('reflection_hypothesis_from_note');
    if (omission && pose !== 'F') tags.push('side_view_omission_review');
    if (inconsistentPass) tags.push('status_note_conflict');
    if (unreasonedFail) tags.push('fail_without_explanation');
    increment(perGroup[row.group], row.status);
    increment(perPose[row.group + '/' + pose], row.status);
    records.push({
      id: row.id, group: row.group, name: row.name, pose,
      // Candidate family only: numeric IDs are not verified unique human identities.
      tentativeNumericFamily: match[2],
      reviewerOriginal: { status: row.status, note: row.note, updatedAt: row.updatedAt ?? null },
      flags: tags, triageBand,
      explorationCandidate: triageBand === 'clean_pass_candidate',
      commercialTrainingAllowed: false,
      segmentationGold: false,
      pixelNegativeValidity: 'NOT_ESTABLISHED',
      split: null,
      splitReason: 'Unverified subject identity, dataset rights, palette semantics and label quality'
    });
  }
  const checked = emptyCounts();
  for (const r of records) increment(checked, r.reviewerOriginal.status);
  if (source.summary && ['pass','fail','unsure'].some(k => source.summary[k] !== checked[k])) {
    throw new Error('Source summary does not match individual reviews');
  }
  if (source.totalImages !== undefined && source.totalImages !== checked.total) throw new Error('Dataset count mismatch');
  const bands = {};
  for (const r of records) bands[r.triageBand] = (bands[r.triageBand] || 0) + 1;
  const summary = {
    schemaVersion: 'memi-ds-review-qc-v1', sourceReviewSha256: sourceHash,
    evaluationMeaning: 'Human qualitative audit of upstream masks, not model accuracy or segmentation gold',
    datasetRights: 'BLOCKED_PENDING_REVIEW',
    paletteClassMeaning: 'UNVERIFIED',
    subjectGrouping: 'TENTATIVE_NUMERIC_ONLY_NO_SPLITS',
    counts: checked, perGroup, perPose, tagCounts, bands
  };
  return { ...summary, records };
}

function test() {
  const rows = [
    { id:'Flaky/10_L',group:'Flaky',name:'10_L',status:'pass',note:'이마 누락' },
    { id:'Flaky/10_R',group:'Flaky',name:'10_R',status:'fail',note:'' },
    { id:'Punctate/3_F',group:'Punctate',name:'3_F',status:'fail',note:'이마 오탐(윤기 차이)' },
    { id:'Punctate/4_F',group:'Punctate',name:'4_F',status:'pass',note:'' },
    { id:'Flaky/13_R',group:'Flaky',name:'13_R',status:'unsure',note:'' }
  ];
  const fixture = {format:'bejeweIy-memi-review-v1',totalImages:5,reviewed:rows};
  const a = triage(fixture,'test');
  assert.equal(a.records.length,5);
  assert.equal(a.counts.pass,2);
  assert.equal(a.tagCounts.inconsistent_pass,1);
  assert.equal(a.tagCounts.unreasoned_fail,1);
  assert.equal(a.tagCounts.forehead_false_positive,1);
  assert.equal(a.tagCounts.explicit_shine,1);
  assert.equal(a.records[0].reviewerOriginal.status,'pass');
  assert.equal(a.records[0].segmentationGold,false);
  assert.equal(a.records[3].explorationCandidate,true);
  assert.equal(a.records[2].pixelNegativeValidity,'NOT_ESTABLISHED');
  assert.throws(() => triage({...fixture,reviewed:[...rows,rows[0]],totalImages:6}),/Duplicate/);
  assert.throws(() => triage({...fixture,reviewed:rows.map((r,i)=>i? r:{...r,id:'Flaky/10_F'})}),/inconsistent/);
  assert.throws(() => triage({...fixture,summary:{pass:99,fail:2,unsure:1}}),/summary/);
  assert.throws(() => triage(fixture,null,true),/131/);
  console.log('MEMI review QC self-test PASS (13 assertions; synthetic only)');
}
function main(argv) {
  if (argv.includes('--self-test')) { test(); return; }
  const inputAt=argv.indexOf('--input'), outputAt=argv.indexOf('--out');
  if (inputAt<0 || !argv[inputAt+1]) throw new Error('Usage: node scripts/audit-memi-review-qc.mjs --input PRIVATE_REVIEW.json [--out PRIVATE_QC.json] [--expect-131]');
  const srcPath=resolve(argv[inputAt+1]);
  const raw=readFileSync(srcPath);
  const result=triage(JSON.parse(raw.toString('utf8')),sha256(raw),argv.includes('--expect-131'));
  if (outputAt>=0) {
    if (!argv[outputAt+1]) throw new Error('--out needs a private path');
    const dst=resolve(argv[outputAt+1]);
    if (dst===srcPath) throw new Error('Refusing to overwrite original review');
    // Explicit output may include original notes; never put it under the public repo.
    writeFileSync(dst, JSON.stringify(result,null,2)+'\n', { flag:'wx', mode:0o600 });
  }
  // Logs contain only aggregate counts; never print original note text or IDs.
  const {records, ...summary}=result;
  console.log(JSON.stringify(summary,null,2));
}
try { main(process.argv.slice(2)); } catch(err) { console.error('MEMI QC blocked: '+err.message); process.exitCode=1; }
