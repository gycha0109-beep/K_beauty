import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {consumeNeutralFaceObservation, NEUTRAL_FACE_OBSERVATION_VERSION} from "@myeongha/neutral-face-observation";

// Audited immutable Saju source snapshot. The upstream Saju PR stays draft;
// this is a source-vendored, npm-workspace-linked research package, not a
// registry release or an HTTP dependency fetched at build/runtime.
const upstream = Object.freeze({
  repo: "gycha0109-beep/Saju",
  commit: "a00c3e2e1c3be1711068e5d35e696a6c9c7d0b8a",
  files: Object.freeze({
    "index.js": "90a6359da4aea4e9d6a1ff8e7be5c9a60910e3a0",
    "package.json": "cc916dd1ff9e3bb8f5c70ef4c610fc43facd27e0",
    "README.md": "38b0947ada0e8170b2456883fdff71752151eefe",
    "test/contract.check.mjs": "ec90d20ac64a69d9e1a1022eb492ff77299370b8"
  })
});
function gitBlobSha(content) {
  return createHash("sha1").update(`blob ${content.length}\0`).update(content).digest("hex");
}
for(const [file,expected] of Object.entries(upstream.files)) {
  const raw=readFileSync(new URL(`../packages/neutral-face-observation/${file}`,import.meta.url));
  assert.equal(gitBlobSha(raw),expected,`Saju upstream source drift: ${file}`);
}
const pkg=JSON.parse(readFileSync(new URL("../packages/neutral-face-observation/package.json",import.meta.url),"utf8"));
const lock=JSON.parse(readFileSync(new URL("../package-lock.json",import.meta.url),"utf8"));
assert.equal(pkg.name,"@myeongha/neutral-face-observation");
assert.equal(pkg.version,"0.1.0-research.0");
assert.equal(pkg.private,true);
assert.equal(lock.packages["packages/neutral-face-observation"].version,pkg.version);
assert.equal(lock.packages["node_modules/@myeongha/neutral-face-observation"].resolved,"packages/neutral-face-observation");
assert.equal(lock.packages["node_modules/@myeongha/neutral-face-observation"].link,true);
assert.match(NEUTRAL_FACE_OBSERVATION_VERSION,/research/);
assert.equal(typeof consumeNeutralFaceObservation,"function");

console.log(JSON.stringify({
  ok:true,suite:"saju_neutral_face_core_pinned_package_provenance",
  upstreamRepo:upstream.repo,upstreamCommit:upstream.commit,
  sourceFilesVerified:Object.keys(upstream.files).length,
  dependencyMode:"pinned_source_vendored_npm_workspace",
  publishedToRegistry:false,productionActivated:false
}));
