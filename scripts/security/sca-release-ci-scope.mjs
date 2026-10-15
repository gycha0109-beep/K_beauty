/** Reuse actual runtime evidence only when its inputs and runner proof match. */
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

export function runtimePath(p){
  if(/^(app|components|lib|apps|packages|public|styles|patches|security\/vendor)\//.test(p))return true;
  if(/(^|\/)(package(?:-lock)?\.json|npm-shrinkwrap\.json|\.npmrc|\.nvmrc|\.node-version)$/.test(p))return true;
  if(/^(next|metro|babel|postcss|tailwind)\.config\.|^tsconfig.*\.json$/.test(p))return true;
  if(/^security\/release\/sca-b6-(validated-source|browser-provenance)\.json$/.test(p))return true;
  return /^scripts\/security\/(materialize-private-|verify-private-|run-sca-b[123]-)/.test(p);
}
export function releaseOnlyPath(p){
  return p==='.codex/AI_WORK_LOG.md'||p.startsWith('docs/')||
    ['.github/workflows/sca-release-readiness.yml','.github/workflows/pie-prospective.yml'].includes(p)||
    p.startsWith('security/release/')||/^scripts\/security\/(sca-release-|verify-sca-release-|prepare-sca-release-|publish-approved-sca-|stage-approved-sca-|run-sca-b6-)/.test(p);
}
export async function runtimeReferenceVerified(ref,token,fetcher=fetch){
  if(!token)return false;
  try{
    const base='https://api.github.com/repos/gycha0109-beep/K_beauty/actions/runs/'+ref.run;
    const get=async u=>{const r=await fetcher(u,{headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json'},redirect:'error',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('reference unavailable');return r.json();};
    const run=await get(base);if(run.head_sha!==ref.head||run.status!=='completed')return false;
    const {jobs}=await get(base+'/jobs?per_page=100');
    return [ref.producerJob,ref.replayJob].every(id=>jobs.some(j=>j.id===id&&j.head_sha===ref.head&&j.status==='completed'&&j.conclusion==='success'));
  }catch{return false;}
}
export async function determineScaScope({cwd,ref,head='HEAD',nodeVersion=process.versions.node,verifyReference}){
  const full=reason=>({runtimeRequired:true,reason});
  if(ref.schema!=='bejewely.sca-runtime-reference.v1'||!/^[a-f0-9]{40}$/.test(ref.head)||nodeVersion!==ref.nodeVersion)return full('reference/toolchain unavailable or changed');
  const git=a=>spawnSync('git',a,{cwd,encoding:'utf8',timeout:20000});
  if(git(['merge-base','--is-ancestor',ref.head,head]).status!==0)return full('runtime reference is not an available ancestor');
  const diff=git(['diff','--name-only','-z',ref.head,head]);if(diff.status!==0)return full('cannot determine changed inputs');
  const changed=diff.stdout.split('\0').filter(Boolean);
  if(changed.some(runtimePath))return full('runtime inputs changed since verified reference');
  if(changed.some(p=>!releaseOnlyPath(p)))return full('unclassified changed input; require fresh runtime checks');
  // Version/distribution changes in this workflow invalidate the reference too.
  const old=git(['show',ref.head+':.github/workflows/sca-release-readiness.yml']);
  const current=git(['show',head+':.github/workflows/sca-release-readiness.yml']);
  const tools=s=>[...s.matchAll(/^\s*(?:node-version|java-version|distribution):.*$/gm)].map(m=>m[0].trim()).join('\n');
  if(old.status!==0||current.status!==0||tools(old.stdout)!==tools(current.stdout))return full('build toolchain configuration changed');
  if(!await verifyReference(ref))return full('runtime runner proof unavailable or unsuccessful');
  return {runtimeRequired:false,reason:'same runtime inputs; reuse verified web/Expo/Metro/Android evidence',referenceHead:ref.head,referenceRun:ref.run,apkSha256:ref.apkSha256};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const cwd=path.resolve(fileURLToPath(new URL('../..',import.meta.url)));
  const ref=JSON.parse(fs.readFileSync(path.join(cwd,'security/release/sca-b6-runtime-evidence.json')));
  const result=await determineScaScope({cwd,ref,verifyReference:r=>runtimeReferenceVerified(r,process.env.SCA_REFERENCE_TOKEN)});
  if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,'runtime_required='+result.runtimeRequired+'\n');
  console.log('SCA_CI_RUNTIME_SCOPE='+JSON.stringify(result));
}
