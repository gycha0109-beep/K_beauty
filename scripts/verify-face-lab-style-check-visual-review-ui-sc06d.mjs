import assert from "node:assert/strict";
import {mkdtempSync,readFileSync,existsSync,rmSync} from "node:fs";
import {join,resolve} from "node:path";
import {tmpdir} from "node:os";
import {spawnSync} from "node:child_process";
import {Script} from "node:vm";
import {
  FACE_LAB_SC06D_VISUAL_UI_VERSION,
  buildFaceLabSC06DVisualReviewHtml
} from "./build-face-lab-style-check-visual-review-ui-sc06d.mjs";
import {buildStyleCheckStructuralHumanReviewPacket} from "../lib/face-lab-v2/evaluation/style-check-structural-human-pairwise-builder.js";
import {verifyFaceLabV2HumanPairwisePacketDigest} from "../lib/face-lab-v2/evaluation/human-pairwise-builder.js";

const html=buildFaceLabSC06DVisualReviewHtml();
const duplicate=buildFaceLabSC06DVisualReviewHtml();
assert.equal(html,duplicate,"reviewer file must be deterministic");
assert.ok(html.includes("Content-Security-Policy"));
assert.ok(html.includes("connect-src 'none'"));
assert.ok(html.includes("img-src blob:"));
assert.ok(!html.includes("localStorage"));
assert.ok(!html.includes("fetch("));
assert.ok(!html.includes("XMLHttpRequest"));
assert.ok(!html.includes('"candidateRelationIds"'));
assert.ok(!html.includes('"operatorManifest"'));
assert.ok(!html.includes('"mapping":'));
assert.ok(html.includes("동일 인물"));
assert.ok(html.includes('id="input-face"'));
assert.ok(html.includes('id="input-A"'));
assert.ok(html.includes('id="input-B"'));
assert.ok(html.includes('id="confirm"'));
assert.ok(html.includes("visualReferencesWereLocallyDisplayed:true"));
assert.ok(html.includes("unsealed_human_review_draft_not_a_validation_result"));
assert.ok(html.includes("photoDataSaved:false"));
assert.ok(html.includes("Boolean(x.files[k]?.valid)"),"completion requires decoded images");
assert.ok(html.includes("img.onerror="),"invalid image data must fail closed");
assert.ok(html.includes("img.naturalWidth>0 && img.naturalHeight>0"),"image must decode");
assert.ok(html.includes("el(\"export\").disabled=!memory.some(ready)"));
const jsonPart=html.match(/<script type="application\/json" id="review-data">([\s\S]*?)<\/script>/);
assert.ok(jsonPart,"embedded reviewer-only packet required");
const payload=JSON.parse(jsonPart[1]);
assert.deepEqual(payload,buildStyleCheckStructuralHumanReviewPacket());
assert.equal(payload.reviewItems.length,7);
assert.equal(verifyFaceLabV2HumanPairwisePacketDigest(payload),true);
const runtime=html.match(/<script>\s*([\s\S]*?)<\/script>/);
assert.ok(runtime);
new Script(runtime[1],{filename:"facelab-sc06d-visual-ui.js"});
const file=mkdtempSync(join(tmpdir(),"facelab-sc06d-test-"));
try {
  const output=join(file,"review.html");
  const cmd=resolve("scripts/build-face-lab-style-check-visual-review-ui-sc06d.mjs");
  const run=(filepath)=>spawnSync(process.execPath,[cmd,"--output-file="+filepath],{
    encoding:"utf8",cwd:process.cwd()
  });
  const first=run(output);
  assert.equal(first.status,0,first.stderr);
  assert.equal(readFileSync(output,"utf8"),html);
  assert.equal(run(output).status===0,false,"write-once guard");
  const inside=resolve("scripts/visual-review.html");
  assert.notEqual(run(inside).status,0,"repository write forbidden");
  assert.equal(existsSync(inside),false);
}finally{rmSync(file,{recursive:true,force:true});}
console.log(JSON.stringify({
  ok:true,version:FACE_LAB_SC06D_VISUAL_UI_VERSION,
  reviewPairs:payload.reviewItems.length,
  visualInputsPerPair:3,judgmentDimensions:4,
  browserRuntimeSyntaxValid:true,
  proofOfActualBrowserInteraction:false,
  sourceImagesAvailable:0,renderedAlternativesAvailable:0,
  actualHumanJudgments:0,productionEnabled:false
}));
