#!/usr/bin/env node
// Accept a manually exported metadata JSON report. No database/network use.
import {readFileSync,writeFileSync,mkdirSync,statSync} from "node:fs";
import {resolve,sep} from "node:path";
import {fileURLToPath} from "node:url";
import {
  assessFaceLabCatalogEvidence,faceLabCatalogEvidenceMarkdown
} from "./catalog-evidence-evaluator-core.mjs";
const fail=c=>{throw new Error("face_lab_catalog_evidence_"+c);};
function parse(argv){
  if(argv.length===1&&argv[0]==="--help")return {help:true};
  if(argv.length!==4)fail("arguments_invalid");
  const options={};
  for(let i=0;i<4;i+=2){
    const key=argv[i],value=argv[i+1];
    if(!["--evidence-json","--out-dir"].includes(key)||
      options[key]||typeof value!=="string"||value.startsWith("--"))
      fail("arguments_invalid");
    options[key]=resolve(value);
  }
  if(!options["--evidence-json"]||!options["--out-dir"])
    fail("arguments_required");
  const input=options["--evidence-json"],out=options["--out-dir"];
  if(input===out||input.startsWith(out+sep))fail("unsafe_output_path");
  return {input,out};
}
export function main(argv=[]){
  const args=parse(argv);
  if(args.help){
    process.stdout.write("Offline catalog triage --evidence-json FILE --out-dir DIR\n");
    return 0;
  }
  const st=statSync(args.input);
  if(!st.isFile()||st.size>1024*1024)fail("evidence_file_invalid");
  const content=JSON.parse(readFileSync(args.input,"utf8"));
  const payload=content?.face_lab_metadata_json??content;
  const report=assessFaceLabCatalogEvidence(payload);
  const json=JSON.stringify(report,null,2)+"\n";
  const markdown=faceLabCatalogEvidenceMarkdown(report);
  mkdirSync(args.out,{recursive:true});
  writeFileSync(resolve(args.out,"face-lab-catalog-evidence-review.json"),json);
  writeFileSync(resolve(args.out,"face-lab-catalog-evidence-review.md"),markdown);
  process.stdout.write(JSON.stringify({status:report.status,counts:report.counts})+"\n");
  return 0;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{process.exitCode=main(process.argv.slice(2));}
  catch(e){
    const msg=String(e?.message??"");
    process.stderr.write((msg.startsWith("face_lab_catalog_evidence_")?
      msg:"face_lab_catalog_evidence_input_or_output_failed")+"\n");
    process.exitCode=2;
  }
}
