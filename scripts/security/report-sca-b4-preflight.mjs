#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {assessScaB4Preflight} from "../../lib/supply-chain-b4-preflight.mjs";

const lock=JSON.parse(fs.readFileSync("package-lock.json","utf8"));
const root=fs.realpathSync(process.cwd());
const targets=[
 {name:"braces",source:"lib/parse.js"},
 {name:"node-forge",source:"lib/rsa.js"},
];
const installed=Object.create(null);
const sourceDigests=Object.create(null);
for(const target of targets){
 const copies=Object.entries(lock.packages??{})
  .filter(([p,pkg])=>(
    p==="node_modules/"+target.name||
    p.endsWith("/node_modules/"+target.name)||
    pkg?.name===target.name
  )&&p.includes("node_modules/"));
 installed[target.name]=[];
 sourceDigests[target.name]=[];
 for(const [lockPath,entry] of copies){
   // Fail closed on malformed paths and symlink escapes.
   const valid=lockPath.split("/").every(seg=>seg!==".."&&seg!==".")&&
     /^(?:(?:apps|packages|tools)\/[^/]+\/)?node_modules\//.test(lockPath);
   let present=false;
   let digest=null;
   if(valid){
     try{
       const folder=fs.realpathSync(path.resolve(root,lockPath));
       if(folder.startsWith(root+path.sep)&&
           fs.lstatSync(folder).isDirectory()){
         const declared=JSON.parse(fs.readFileSync(path.join(folder,"package.json"),"utf8"));
         present=declared.version===entry.version&&
           (declared.name===target.name||entry.name===target.name);
         const file=fs.realpathSync(path.join(folder,target.source));
         if(present&&file.startsWith(folder+path.sep)&&fs.statSync(file).isFile())
           digest=crypto.createHash("sha256")
             .update(fs.readFileSync(file)).digest("hex");
       }
     }catch{present=false;digest=null;}
   }
   installed[target.name].push({path:lockPath,present});
   if(digest)sourceDigests[target.name].push({sourceDigestSha256:digest});
 }
}
const result=assessScaB4Preflight({lock,installed});
const report={...result,originalInstalledSourceDigests:sourceDigests,
  scope:"READ_ONLY_INSTALLED_BASELINE_NOT_A_REMEDIATION",
  patchedSourceAttested:false,approvedRemediation:false};
if(report.status!=="B4_PREFLIGHT_HOLD"||report.securityGatePassed!==false||
  report.rawAuditHighZeroAttested!==false||report.patchedCodeAttested!==false)
 throw Error("SEC_SCA_B4_UNEXPECTED_AUTHORITY_CHANGE");
console.log("SEC_SCA_B4_BASELINE="+JSON.stringify(report));
