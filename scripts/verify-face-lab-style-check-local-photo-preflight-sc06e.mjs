import assert from "node:assert/strict";
import {mkdtempSync,writeFileSync,rmSync,mkdirSync,readFileSync} from "node:fs";
import {tmpdir} from "node:os";import {join} from "node:path";
import {buildLocalStyleCheckPreflight} from "./build-face-lab-style-check-local-photo-preflight-sc06e.mjs";
const dir=mkdtempSync(join(tmpdir(),"sc06e-"));
try{
 const png=Buffer.alloc(24);Buffer.from("89504e470d0a1a0a","hex").copy(png);png.writeUInt32BE(240,16);png.writeUInt32BE(320,20);
 writeFileSync(join(dir,"sample.png"),png);writeFileSync(join(dir,"broken.jpg"),Buffer.from("corrupt"));
 const r=buildLocalStyleCheckPreflight({folder:dir});
 assert.equal(r.photoCount,2);assert.equal(r.reviewPairCount,7);
 assert.equal(r.photos.find(x=>x.fileName==="sample.png").width,240);
 assert.equal(r.photos.find(x=>x.fileName==="broken.jpg").headerReadable,false);
 assert.equal(r.simulation.existingCompilerWired,true);
 assert.equal(r.simulation.providerInvoked,false);
 assert.equal(r.readyVisualPairs,0);assert.equal(r.observationVerificationPerformed,false);
 assert.equal(r.productionActive,false);assert.equal(r.rightsVerified,false);
 assert.equal(r.photos.every(x=>x.caseBinding==="unassigned"),true);
 assert.equal(JSON.stringify(r).includes(dir),false);
 console.log(JSON.stringify({ok:true,photoFixtureCount:2,corruptHeaderHeld:true,compilerGateHeld:true,providerCalls:0,productionActive:false}));
}finally{rmSync(dir,{recursive:true,force:true});}
