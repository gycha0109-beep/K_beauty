#!/usr/bin/env node
/**
 * Public-repository acquisition preflight for the BEJEWELY Skin Precision research track.
 * Metadata only by default. Does NOT access AI-Hub, FaceSkin-Q requests or paid vendor assets.
 * No patient/face images, vendor data, tokens, credentials or manifests are uploaded.
 * Run locally only in an environment permitted by the source dataset agreement.
 *
 * node scripts/acquire-skin-open-dataset.mjs --inspect
 * node scripts/acquire-skin-open-dataset.mjs --download --license-reviewed --out "D:\\private\\skin-sourcing\\memi-ds"
 */
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { join, resolve, basename } from 'node:path';
import { pipeline } from 'node:stream/promises';

const FIGSHARE_ARTICLE_ID = '29209229';
const HOST_ALLOWLIST = new Set(['api.figshare.com', 'ndownloader.figshare.com', 'figshare.com', 's3-eu-west-1.amazonaws.com', 's3.amazonaws.com']);
const argv = process.argv.slice(2);
const inspectOnly = argv.includes('--inspect') || !argv.includes('--download');
const download = argv.includes('--download');
const reviewed = argv.includes('--license-reviewed');
const outIndex = argv.indexOf('--out');
const outDir = resolve(outIndex < 0 ? 'data-local/skin-precision/memi-ds' : argv[outIndex + 1] || '');
if (download && (!reviewed || outIndex === -1 || !argv[outIndex + 1])) {
  console.error('Refusing download: pass --license-reviewed and an explicit --out destination after reviewing the original face-image use terms.');
  process.exit(2);
}
if (!inspectOnly && !download) { console.error('Specify --inspect or --download'); process.exit(2); }

function checkUrl(url) {
  const u = new URL(url);
  if (u.protocol !== 'https:' || !HOST_ALLOWLIST.has(u.hostname)) throw new Error('Unexpected download host: ' + u.hostname);
  return u;
}

async function request(url, options = {}) {
  let current = checkUrl(url);
  for (let redirects = 0; redirects <= 5; redirects++) {
    const response = await fetch(current, { ...options, redirect: 'manual' });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const next = response.headers.get('location');
      if (!next) throw new Error('Redirect without Location');
      current = checkUrl(new URL(next, current).toString());
      continue;
    }
    if (!response.ok) throw new Error('HTTP ' + response.status + ': ' + current);
    return response;
  }
  throw new Error('Too many redirects');
}

const response = await request('https://api.figshare.com/v2/articles/' + FIGSHARE_ARTICLE_ID);
const article = await response.json();
if (!String(article.id) || String(article.id) !== FIGSHARE_ARTICLE_ID) throw new Error('Unexpected article');
const files = (article.files || []).map(f => ({
  id: f.id,
  name: f.name,
  size: f.size,
  downloadUrl: f.download_url,
  checksum: f.supplied_md5 || f.computed_md5 || null
}));
const metadata = {
  articleId: article.id,
  sourceUrl: article.url_public_html || 'https://figshare.com/articles/figure/_/29209229',
  title: article.title,
  license: article.license?.name || article.license || null,
  publishedAt: article.published_date || null,
  fetchedAt: new Date().toISOString(),
  files: files.map(({ downloadUrl, ...safe }) => safe)
};
console.log(JSON.stringify(metadata, null, 2));
if (!download) process.exit(0);
if (!files.length) throw new Error('No source files exposed by publisher API');
await mkdir(outDir, { recursive: true });
for (const file of files) {
  if (!file.downloadUrl) throw new Error('Missing download URL: ' + file.name);
  if (file.name !== basename(file.name) || file.name === '.' || file.name === '..') throw new Error('Unsafe filename');
  if (!Number.isFinite(file.size) || file.size < 1) throw new Error('Invalid expected file size');
  const finalPath = join(outDir, file.name);
  const temporaryPath = finalPath + '.partial';
  const hash = createHash('sha256');
  let count = 0;
  try {
    const r = await request(file.downloadUrl);
    const stream = createWriteStream(temporaryPath, { flags: 'wx', mode: 0o600 });
    const { Transform } = await import('node:stream');
    const tap = new Transform({ transform(chunk, enc, callback) { count += chunk.length; hash.update(chunk); callback(null, chunk); } });
    await pipeline(r.body, tap, stream);
    if (count !== file.size) throw new Error('Size mismatch: ' + file.name + ' ' + count + ' vs ' + file.size);
    await rename(temporaryPath, finalPath);
    file.sha256 = hash.digest('hex');
    console.log('saved: ' + file.name + ' (' + count + ' bytes, sha256 ' + file.sha256 + ')');
  } catch (err) {
    await rm(temporaryPath, { force: true });
    throw err;
  }
}
await writeFile(join(outDir, 'manifest.metadata.json'), JSON.stringify({
  ...metadata, acquisitionDate: new Date().toISOString(),
  rights: { commercialFaceRights: 'NOT VERIFIED', faceDataSharingAllowed: 'NOT VERIFIED', userAttestedSourceTermsReview: reviewed },
  downloadedFiles: files.map(({ downloadUrl, ...safe }) => safe)
}, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
console.log('Complete (local only). NO commercial/legal clearance conferred.');
