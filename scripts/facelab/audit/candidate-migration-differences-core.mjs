/* Candidate-only offline migration comparison: never proves DB execution. */
const FILENAME=/^(\d{14}|\d{8})_([A-Za-z0-9][A-Za-z0-9._-]{0,239})\.sql$/;
const VERSION=/^(?:\d{14}|\d{8})$/;
const NAME=/^[A-Za-z0-9][A-Za-z0-9._-]{0,239}$/;
const SHA=/^[a-f0-9]{64}$/;
const RISK=/(?:^|[_-])(?:face[_-]?lab|admin|auth|rls|grant|policy|privilege|storage|security|revoke|secret|identity|quota)(?:[_-]|$)/i;
const fail=(code)=>{throw new Error("migration_candidates_"+code);};
const object=(x)=>!!x&&typeof x==="object"&&!Array.isArray(x);
const cmp=(a,b)=>a<b?-1:a>b?1:0;
const key=(s)=>s.toLowerCase().replace(/[-.]+/g,"_").replace(/_+/g,"_");
const add=(map,k,v)=>map.set(k,[...(map.get(k)??[]),v]);
const risk=(n)=>RISK.test(n)?"priority_manual_review":"manual_review";

export function inspectCandidateMigrationDifferences(input) {
  if(!object(input)||!Array.isArray(input.repository)||!Array.isArray(input.hosted)||
    !input.repository.length||!input.hosted.length||
    input.repository.length>10000||input.hosted.length>10000)fail("invalid_inventory");
  const rv=new Map(),hv=new Map(),seen=new Set();
  const repository=input.repository.map(x=>{
    if(!object(x)||typeof x.filename!=="string"||x.filename.length>260||
       seen.has(x.filename))fail("invalid_repository_entry");
    const m=FILENAME.exec(x.filename);
    if(!m||(x.sha256!==undefined&&(typeof x.sha256!=="string"||!SHA.test(x.sha256))))
      fail("invalid_repository_entry");
    seen.add(x.filename);
    const v={version:m[1],name:m[2],filename:x.filename,sha256:x.sha256??null};
    add(rv,v.version,v);
    return v;
  });
  const hosted=input.hosted.map(x=>{
    if(!object(x)||typeof x.version!=="string"||typeof x.name!=="string"||
       !VERSION.test(x.version)||!NAME.test(x.name))fail("invalid_hosted_entry");
    const v={version:x.version,name:x.name};add(hv,v.version,v);return v;
  });
  if([...hv.values()].some(v=>v.length!==1))fail("hosted_duplicate_version");
  const collisions=[...rv.entries()].filter(([,a])=>a.length>1)
    .sort(([a],[b])=>cmp(a,b))
    .map(([version,a])=>({version,files:a.map(v=>v.filename).sort(cmp)}));
  const paired=(v)=>rv.get(v)?.length===1&&hv.has(v);
  const unmatchedRepo=repository.filter(v=>!paired(v.version));
  const unmatchedHosted=hosted.filter(v=>!paired(v.version));
  const byRepoName=new Map(),byHostedName=new Map();
  unmatchedRepo.forEach(v=>add(byRepoName,key(v.name),v));
  unmatchedHosted.forEach(v=>add(byHostedName,key(v.name),v));
  const candidates=[];let ambiguousNameGroups=0;
  for(const [n,rr] of byRepoName) {
    const hh=byHostedName.get(n)??[];
    if(!hh.length)continue;
    if(rr.length!==1||hh.length!==1){ambiguousNameGroups++;continue;}
    candidates.push({repositoryVersion:rr[0].version,repositoryFile:rr[0].filename,
      hostedVersion:hh[0].version,name:rr[0].name,
      evidence:"name_only",appliedStatus:"unverified",risk:risk(rr[0].name)});
  }
  candidates.sort((a,b)=>cmp(a.repositoryVersion,b.repositoryVersion)||cmp(a.repositoryFile,b.repositoryFile));
  const repoCandidate=new Map(candidates.map(x=>[x.repositoryFile,x]));
  const hostedCandidate=new Map(candidates.map(x=>[x.hostedVersion,x]));
  const rows=[
    ...repository.map(v=>{
      const candidate=repoCandidate.get(v.filename);
      const duplicate=rv.get(v.version).length>1;
      return {source:"repository",version:v.version,name:v.name,
        filename:v.filename,contentSha256:v.sha256,
        classification:duplicate?"duplicate_repository_version":
          paired(v.version)?"version_record_candidate":
          candidate?"name_only_candidate":
          byHostedName.has(key(v.name))?"ambiguous_name_candidate":"repository_only",
        counterpartVersion:paired(v.version)?v.version:candidate?.hostedVersion??null,
        risk:risk(v.name),executionVerified:false};
    }),
    ...unmatchedHosted.map(v=>{
      const candidate=hostedCandidate.get(v.version);
      return {source:"hosted_candidate",version:v.version,name:v.name,
        filename:null,contentSha256:null,
        classification:candidate?"name_only_candidate":
          byRepoName.has(key(v.name))?"ambiguous_name_candidate":"hosted_only",
        counterpartVersion:candidate?.repositoryVersion??null,
        risk:risk(v.name),executionVerified:false};
    })
  ].sort((a,b)=>cmp(a.version,b.version)||cmp(a.source,b.source)||cmp(a.name,b.name));
  const directPairs=repository.length-unmatchedRepo.length;
  const counts={
    repositoryFiles:repository.length,repositoryUniqueVersions:rv.size,
    hostedHistoryRecords:hosted.length,hostedUniqueVersions:hv.size,
    directVersionCandidates:directPairs,
    repositoryWithoutDirectVersion:unmatchedRepo.length,
    hostedWithoutDirectVersion:unmatchedHosted.length,
    uniqueNameOnlyCandidates:candidates.length,
    remainingRepoWithoutUniqueName:unmatchedRepo.length-candidates.length,
    remainingHostedWithoutUniqueName:unmatchedHosted.length-candidates.length,
    ambiguousNameGroups,duplicateRepositoryVersionGroups:collisions.length,
    outputRows:rows.length
  };
  if(directPairs+unmatchedRepo.length!==repository.length||
     directPairs+unmatchedHosted.length!==hosted.length||
     rows.length!==repository.length+unmatchedHosted.length||
     candidates.length>unmatchedRepo.length||candidates.length>unmatchedHosted.length)
    fail("conservation_violation");
  return {
    status:"HOLD",diagnosticCompleted:true,scope:"hosted_candidate_unverified",
    projectIdentityConfirmed:false,productionReconciliationComplete:false,
    appliedSqlVerified:false,sqlExecuted:false,databaseCalls:0,
    databaseWrites:0,networkCalls:0,
    counts,collisionGroups:collisions,uniqueNameOnlyCandidates:candidates,rows,
    decision:"Do not rename, replay, repair, or mark a migration as applied."
  };
}

export function candidateMigrationDiagnosticMarkdown(report) {
  if(!object(report)||!object(report.counts)||
     !Array.isArray(report.uniqueNameOnlyCandidates))fail("invalid_report");
  const c=report.counts;
  const measures=[
    ["Repository SQL files",c.repositoryFiles],
    ["Candidate-hosted migration records",c.hostedHistoryRecords],
    ["Direct version candidates",c.directVersionCandidates],
    ["Repository files without direct version",c.repositoryWithoutDirectVersion],
    ["Hosted records without direct version",c.hostedWithoutDirectVersion],
    ["Name-only candidates, not execution evidence",c.uniqueNameOnlyCandidates],
    ["Repository files remaining after name review",c.remainingRepoWithoutUniqueName],
    ["Hosted records remaining after name review",c.remainingHostedWithoutUniqueName],
    ["Duplicate repository-version groups",c.duplicateRepositoryVersionGroups]
  ];
  return [
    "# Face Lab: candidate-only offline migration diagnostic","",
    "**Decision: HOLD.** This hosted list belongs to an unverified candidate.",
    "Production identity, SQL equivalence, and execution were not verified.",
    "","| Measure | Count |","| --- | ---: |",
    ...measures.map(([k,v])=>"| "+k+" | "+v+" |"),
    "","## Duplicate repository versions",
    ...report.collisionGroups.flatMap(x=>["- "+x.version,
      ...x.files.map(f=>"  - "+f)]),
    ...(report.collisionGroups.length?[]:["- None"]),
    "","## Name-only candidates (never execution proofs)",
    ...report.uniqueNameOnlyCandidates.map(x=>"- "+x.repositoryFile+
      " -> "+x.hostedVersion+" ("+x.risk+")"),
    ...(report.uniqueNameOnlyCandidates.length?[]:["- None"]),
    "","All records are preserved. Automatic collision repair, DB access,",
    "migration replay, and permission changes are prohibited.",""
  ].join("\n");
}
