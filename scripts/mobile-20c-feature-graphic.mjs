import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require('sharp');

const root = process.cwd();
const assetRel = 'apps/mobile/assets/store/bejewely-google-play-feature-graphic-1024x500.png';
const listingRel = 'docs/store/mobile-store-listing-final.json';
const readinessRel = 'apps/mobile/store-readiness.json';
const artifactDirRel = '.mobile-20c-feature-graphic-artifacts';
const assetPath = path.join(root, assetRel);
const listingPath = path.join(root, listingRel);
const readinessPath = path.join(root, readinessRel);
const artifactDir = path.join(root, artifactDirRel);
const WIDTH = 1024;
const HEIGHT = 500;

const glyphs = {
  B: ['11110','10001','10001','11110','10001','10001','11110'],
  E: ['11111','10000','10000','11110','10000','10000','11111'],
  J: ['00111','00010','00010','00010','00010','10010','01100'],
  W: ['10001','10001','10001','10101','10101','10101','01010'],
  L: ['10000','10000','10000','10000','10000','10000','11111'],
  Y: ['10001','10001','01010','00100','00100','00100','00100'],
};

function wordmarkSvg(text, x, y, pixel = 4) {
  let cursor = x;
  const parts = [];
  for (const ch of text) {
    const glyph = glyphs[ch];
    if (!glyph) { cursor += pixel * 4; continue; }
    glyph.forEach((row, ry) => [...row].forEach((bit, rx) => {
      if (bit === '1') parts.push(`<rect x="${cursor + rx*pixel}" y="${y + ry*pixel}" width="${pixel}" height="${pixel}" rx="0.7" fill="#4a3070"/>`);
    }));
    cursor += pixel * 6;
  }
  return parts.join('');
}

function featureSvg() {
  const wordmark = wordmarkSvg('BEJEWELY', 92, 17, 4);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbfafd"/><stop offset="1" stop-color="#f5f1fc"/></linearGradient>
    <filter id="shadow" x="-15%" y="-15%" width="130%" height="130%"><feDropShadow dx="7" dy="8" stdDeviation="5" flood-color="#d9d0e9" flood-opacity="0.42"/></filter>
  </defs>
  <rect width="1024" height="500" fill="url(#bg)"/>
  <circle cx="930" cy="58" r="252" fill="#e1d5f7" opacity="0.67"/>
  <circle cx="885" cy="470" r="198" fill="#efe7fc" opacity="0.82"/>
  <circle cx="45" cy="470" r="140" fill="#f7effa" opacity="0.76"/>
  <path d="M72 24 L78 30 L72 36 L66 30 Z" fill="#704eae" opacity="0.92"/>
  ${wordmark}

  <g filter="url(#shadow)"><rect x="68" y="64" width="402" height="356" rx="42" fill="#fffefe"/></g>
  <circle cx="180" cy="171" r="74" fill="#eee7fb"/>
  <circle cx="180" cy="171" r="58" fill="#fcf9ff"/>
  <circle cx="180" cy="171" r="37" fill="#e5d9f8"/>
  <circle cx="165" cy="166" r="5" fill="#704eae"/><circle cx="195" cy="166" r="5" fill="#704eae"/>
  <rect x="161" y="191" width="38" height="6" rx="3" fill="#704eae" opacity="0.9"/>
  <circle cx="143" cy="190" r="7" fill="#f4e0ee"/><circle cx="217" cy="190" r="7" fill="#f4e0ee"/>
  <rect x="111" y="282" width="236" height="19" rx="10" fill="#dfd4f3"/>
  <rect x="111" y="318" width="302" height="19" rx="10" fill="#ebe4f8"/>
  <rect x="111" y="354" width="190" height="19" rx="10" fill="#e5d9f7"/>
  <circle cx="379" cy="291" r="10" fill="#704eae" opacity="0.82"/>
  <circle cx="379" cy="327" r="10" fill="#9777c9" opacity="0.82"/>
  <circle cx="379" cy="363" r="10" fill="#c2a0d8" opacity="0.82"/>

  <g filter="url(#shadow)"><rect x="524" y="54" width="408" height="182" rx="38" fill="#fffefe"/></g>
  <g><rect x="580" y="109" width="58" height="92" rx="12" fill="#704eae"/><rect x="593" y="89" width="32" height="30" rx="7" fill="#231c30"/><rect x="590" y="137" width="38" height="11" rx="6" fill="#c7b5e4"/></g>
  <g><rect x="666" y="120" width="52" height="81" rx="11" fill="#9d7bd0"/><rect x="677" y="102" width="30" height="26" rx="7" fill="#573e80"/><rect x="676" y="145" width="32" height="10" rx="5" fill="#d3c3ec"/></g>
  <g><rect x="744" y="104" width="64" height="97" rx="14" fill="#decdf2"/><rect x="758" y="82" width="36" height="31" rx="8" fill="#704eae"/><rect x="756" y="133" width="40" height="11" rx="6" fill="#f6efff"/></g>
  <path d="M858 89 L872 103 L858 117 L844 103 Z" fill="#704eae" opacity="0.9"/><path d="M881 130 L890 139 L881 148 L872 139 Z" fill="#a984d1"/>
  <rect x="834" y="183" width="62" height="13" rx="7" fill="#e1d6f4"/>

  <g filter="url(#shadow)"><rect x="552" y="276" width="388" height="154" rx="36" fill="#fffefe"/></g>
  <circle cx="617" cy="331" r="20" fill="#f6d58e"/>
  <g stroke="#e2b361" stroke-width="5" stroke-linecap="round"><path d="M617 293v11"/><path d="M617 358v11"/><path d="M579 331h11"/><path d="M644 331h11"/><path d="M590 304l8 8"/><path d="M636 350l8 8"/><path d="M590 358l8-8"/><path d="M636 312l8-8"/></g>
  <circle cx="617" cy="389" r="24" fill="#704eae"/><circle cx="628" cy="380" r="21" fill="#fffefe"/>
  <polyline points="704,376 740,365 776,371 812,350 848,356 884,338" fill="none" stroke="#b295d8" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="704" cy="376" r="9" fill="#e5d8f8"/><circle cx="740" cy="365" r="9" fill="#e5d8f8"/><circle cx="776" cy="371" r="9" fill="#e5d8f8"/><circle cx="812" cy="350" r="9" fill="#e5d8f8"/><circle cx="848" cy="356" r="9" fill="#e5d8f8"/><circle cx="884" cy="338" r="9" fill="#704eae"/>
  <rect x="695" y="404" width="184" height="12" rx="6" fill="#e8e1f7"/>

  <path d="M495 102 L505 112 L495 122 L485 112 Z" fill="#b68fd6" opacity="0.65"/><path d="M510 137 L515 142 L510 147 L505 142 Z" fill="#704eae" opacity="0.65"/>
  <path d="M493 396 L502 405 L493 414 L484 405 Z" fill="#d0b0df" opacity="0.7"/>
  <circle cx="977" cy="252" r="14" fill="#d8c5f0" opacity="0.7"/><circle cx="34" cy="104" r="10" fill="#e8d4eb" opacity="0.75"/>
</svg>`;
}

async function renderPng() {
  return sharp(Buffer.from(featureSvg()))
    .resize(WIDTH, HEIGHT, { fit: 'fill' })
    .flatten({ background: '#faf9fd' })
    .removeAlpha()
    .png({ compressionLevel: 9, palette: false })
    .toBuffer();
}

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function writeJson(p, value) { fs.writeFileSync(p, `${JSON.stringify(value, null, 2)}\n`); }

function patchAuthority() {
  const listing = readJson(listingPath);
  listing.googlePlay.featureGraphic = {
    status: 'repository_asset_visual_approved',
    owner: 'MOBILE-20C',
    path: assetRel,
    requiredSize: '1024x500',
    format: '24-bit PNG',
    alpha: false,
    languageStrategy: 'language_neutral_visual_with_bejewely_wordmark',
    reason: 'Repository-qualified feature graphic extends the BEJEWELY visual language with skin-profile, product-pick, AM/PM routine and diary-continuity motifs without medical or guaranteed-outcome claims.',
  };
  listing.repositoryPending = listing.repositoryPending.filter((x) => x !== 'google_play_feature_graphic');
  writeJson(listingPath, listing);

  const readiness = readJson(readinessPath);
  readiness.mobile20CFeatureGraphicContract = {
    owner: 'MOBILE-20C',
    assetPath: assetRel,
    requiredSize: '1024x500',
    format: '24-bit PNG',
    alpha: false,
    renderer: 'scripts/mobile-20c-feature-graphic.mjs',
    workflow: '.github/workflows/mobile-20c-feature-graphic.yml',
    repositoryStatus: 'repository_asset_visual_approved',
    validationPolicy: 'Any asset pixel change requires fresh exact-head CI artifact and direct visual review; merged-main requires a fresh artifact and direct visual review again.',
  };
  const contract = readiness.mobile20StoreCaptureContract;
  if (contract?.remainingRepositoryAssetBlockers) {
    contract.remainingRepositoryAssetBlockers = contract.remainingRepositoryAssetBlockers.filter((x) => x !== 'google_play_feature_graphic');
  }
  writeJson(readinessPath, readiness);
}

function checkedOutSha() {
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error(`invalid checked-out SHA: ${sha}`);
  const expected = process.env.MOBILE_20C_EXPECTED_SHA;
  if (expected && sha !== expected) throw new Error(`checked-out SHA mismatch: expected ${expected}, got ${sha}`);
  return sha;
}

async function verify() {
  if (!fs.existsSync(assetPath)) throw new Error(`missing feature graphic: ${assetRel}`);
  const meta = await sharp(assetPath).metadata();
  if (meta.format !== 'png' || meta.width !== WIDTH || meta.height !== HEIGHT || meta.hasAlpha || meta.channels !== 3 || meta.depth !== 'uchar') {
    throw new Error(`invalid feature graphic metadata: ${JSON.stringify(meta)}`);
  }
  const actual = await sharp(assetPath).removeAlpha().raw().toBuffer();
  const expected = await sharp(await renderPng()).removeAlpha().raw().toBuffer();
  if (!actual.equals(expected)) throw new Error('feature graphic pixels differ from deterministic renderer');

  const listing = readJson(listingPath);
  const fg = listing.googlePlay?.featureGraphic;
  if (fg?.status !== 'repository_asset_visual_approved' || fg?.owner !== 'MOBILE-20C' || fg?.path !== assetRel || fg?.requiredSize !== '1024x500' || fg?.alpha !== false) {
    throw new Error('listing feature graphic authority is not MOBILE-20C approved');
  }
  if (listing.repositoryPending?.includes('google_play_feature_graphic')) throw new Error('listing still reports google_play_feature_graphic pending');
  if (!listing.repositoryPending?.includes('app_store_screenshot_submission_packaging')) throw new Error('App Store screenshot packaging blocker must remain explicit');

  const readiness = readJson(readinessPath);
  const c = readiness.mobile20CFeatureGraphicContract;
  if (c?.repositoryStatus !== 'repository_asset_visual_approved' || c?.assetPath !== assetRel || c?.alpha !== false) throw new Error('store readiness MOBILE-20C authority mismatch');
  if (readiness.mobile20StoreCaptureContract?.remainingRepositoryAssetBlockers?.includes('google_play_feature_graphic')) throw new Error('store readiness still reports feature graphic pending');
  if (!readiness.mobile20StoreCaptureContract?.remainingRepositoryAssetBlockers?.includes('app_store_screenshot_submission_packaging')) throw new Error('App Store packaging blocker must remain explicit');

  fs.mkdirSync(artifactDir, { recursive: true });
  const png = fs.readFileSync(assetPath);
  const manifest = {
    exactSha: checkedOutSha(),
    owner: 'MOBILE-20C',
    asset: assetRel,
    width: WIDTH,
    height: HEIGHT,
    format: 'png',
    colorType: '24-bit RGB',
    alpha: false,
    sha256: crypto.createHash('sha256').update(png).digest('hex'),
    technicalPass: true,
    visualReviewRequired: true,
  };
  fs.copyFileSync(assetPath, path.join(artifactDir, path.basename(assetPath)));
  writeJson(path.join(artifactDir, 'feature-graphic-manifest.json'), manifest);
  console.log(`MOBILE-20C feature graphic PASS ${manifest.exactSha} ${manifest.sha256}`);
  return manifest;
}

async function materialize() {
  fs.mkdirSync(path.dirname(assetPath), { recursive: true });
  fs.writeFileSync(assetPath, await renderPng());
  patchAuthority();
  console.log(`MOBILE-20C materialized ${assetRel}`);
}

const mode = process.argv[2];
if (mode === '--materialize') await materialize();
else if (mode === '--verify') await verify();
else if (mode === '--render-only') {
  const out = path.resolve(process.argv[3] || 'bejewely-google-play-feature-graphic-1024x500.png');
  fs.writeFileSync(out, await renderPng());
  console.log(out);
} else {
  throw new Error('usage: node scripts/mobile-20c-feature-graphic.mjs --materialize|--verify|--render-only [path]');
}
