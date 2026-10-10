#!/usr/bin/env node
/**
 * Offline-only, candidate-history comparison. Input is a nonsecret exported
 * migration list, NEVER a DB connection string or Vercel/Supabase credential.
 */
import {createHash} from "node:crypto";
import {readdirSync,readFileSync,mkdirSync,writeFileSync,statSync} from "node:fs";
import {resolve,sep} from "node:path";
import {fileURLToPath} from "node:url";
import {
  inspectCandidateMigrationDifferences,
  candidateMigrationDiagnosticMarkdown
} from "./candidate-migration-differences-core.mjs";

function fail(code){throw new Error("migration_candidates_"+code);}
function argsOf(argv){
  if(argv.length===1&&argv[0]==="--help")return {help:true};
  const arg={};
  if(argv.length!==6)fail("arguments_invalid");
  for(let i=0;i<argv.length;i+=2){
    const name=argv[i],value=argv[i+1];
    if(!["--repo-dir","--hosted-list","--out-dir"].includes(name)||
      arg[name]||typeof value!=="string"||value.startsWith("--"))fail("arguments_invalid");
    arg[name]=resolve(value);
  }
  if(!arg["--repo-dir"]||!arg["--hosted-list"]||!arg["--out-dir"])fail("arguments_required");
  const r=arg["--repo-dir"],o=arg["--out-dir"];
  if(o===r||o.startsWith(r+sep)||arg["--hosted-list"]===o||
    arg["--hosted-list"].startsWith(o+sep))fail("unsafe_output_path");
  return {repoDir:r,hostedPath:arg["--hosted-list"],outDir:o};
}
export function main(argv=[]){
  const opts=argsOf(argv);
  if(opts.help){
    process.stdout.write("Offline candidate migration comparison --repo-dir DIR --hosted-list FILE --out-dir DIR\n");
    return 0;
  }
  const paths=readdirSync(opts.repoDir,{withFileTypes:true});
  if(!paths.length||paths.length>10000)fail("invalid_inventory");
  const repository=paths.map(entry=>{
    if(!entry.isFile()||!entry.name.endsWith(".sql"))fail("invalid_repository_entry");
    const p=resolve(opts.repoDir,entry.name),size=statSync(p).size;
    if(size>20*1024*1024)fail("source_file_too_large");
    return {
      filename:entry.name,
      sha256:createHash("sha256").update(readFileSync(p)).digest("hex")
    };
  });
  const hostedFile=readFileSync(opts.hostedPath);
  if(hostedFile.length>4*1024*1024)fail("hosted_file_too_large");
  const json=JSON.parse(hostedFile.toString("utf8"));
  const hosted=Array.isArray(json)?json:json?.migrations;
  const report=inspectCandidateMigrationDifferences({repository,hosted});
  const markdown=candidateMigrationDiagnosticMarkdown(report);
  const output=JSON.stringify(report,null,2)+"\n";
  mkdirSync(opts.outDir,{recursive:true});
  writeFileSync(resolve(opts.outDir,"candidate-migration-diagnostic.json"),output);
  writeFileSync(resolve(opts.outDir,"candidate-migration-diagnostic.md"),markdown);
  process.stdout.write(JSON.stringify({status:report.status,scope:report.scope,
    counts:report.counts})+"\n");
  return 0;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try {process.exitCode=main(process.argv.slice(2));}
  catch(e){
    // Never print SQL bodies, error stacktraces, input values, file paths or keys.
    const message=String(e?.message??"");
    process.stderr.write((message.startsWith("migration_candidates_")?
      message:"migration_candidates_input_or_output_failed")+"\n");
    process.exitCode=2;
  }
}
