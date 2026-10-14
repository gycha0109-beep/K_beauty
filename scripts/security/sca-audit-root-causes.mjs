/** Resolve canonical npm-audit advisory roots through transitive and cyclic via edges.
 * Diagnostic only. It must never turn a required audit failure into a green gate.
 */
import assert from 'node:assert/strict';

const ADVISORY_URL=/^https:\/\/github\.com\/advisories\/(GHSA-[a-z0-9]+-[a-z0-9]+-[a-z0-9]+)$/i;
const SEVERITIES=new Set(['info','low','moderate','high','critical']);
export const REVIEWED_HIGH_ADVISORIES=Object.freeze({
  'GHSA-vfj7-8cjw-p6xm':Object.freeze({
    package:'braces',affected:'<=3.0.3',
    officialAdvisory:'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm',
    fixedRelease:'NONE_PUBLISHED_AS_OF_2026_10_14',
    disposition:'PATCH_PROVENANCE_VERIFIED_DISTRIBUTION_UNAPPROVED',
    ownerApproval:'REQUIRED'
  }),
  'GHSA-86w9-cpqp-85rv':Object.freeze({
    package:'node-forge',affected:'<=1.4.0',
    officialAdvisory:'https://github.com/advisories/GHSA-86w9-cpqp-85rv',
    fixedRelease:'NONE_PUBLISHED_AS_OF_2026_10_14',
    disposition:'PATCH_PROVENANCE_VERIFIED_DISTRIBUTION_UNAPPROVED',
    ownerApproval:'REQUIRED'
  })
});
const sorted=(values)=>[...values].sort((a,b)=>a.localeCompare(b));
export function analyzeAuditCauses(payload) {
  assert.ok(payload && typeof payload==='object' && !Array.isArray(payload),'npm audit payload required');
  assert.ok(!payload.error,'npm audit service error');
  const vulnerabilities=payload.vulnerabilities;
  assert.ok(vulnerabilities && typeof vulnerabilities==='object'&&!Array.isArray(vulnerabilities),'missing audit vulnerability graph');
  const packages=Object.keys(vulnerabilities).sort();
  const roots=new Map(), edges=new Map(), rootMetadata=new Map();
  for(const name of packages) {
    const item=vulnerabilities[name];
    assert.ok(item && typeof item==='object'&&item.name===name, 'invalid audit package '+name);
    assert.ok(SEVERITIES.has(item.severity),name+' invalid npm audit severity');
    assert.ok(Array.isArray(item.via),name+' missing npm audit via');
    const ownRoots=new Set(),dependencies=[];
    for(const via of item.via){
      if(typeof via==='string') {
        assert.ok(Object.hasOwn(vulnerabilities,via),name+' unknown npm audit dependency '+via);
        dependencies.push(via);
      } else {
        assert.ok(via && typeof via==='object' && !Array.isArray(via),name+' invalid advisory');
        const match=typeof via.url==='string'&&ADVISORY_URL.exec(via.url);
        assert.ok(match,name+' invalid advisory URL');
        assert.ok(SEVERITIES.has(via.severity),name+' invalid advisory severity');
        const id=match[1];
        assert.equal(via.name,name,name+' advisory belongs to other package');
        if(rootMetadata.has(id))assert.deepEqual(rootMetadata.get(id),{id,package:name,severity:via.severity,url:via.url,range:via.range},'conflicting advisory identity');
        else rootMetadata.set(id,{id,package:name,severity:via.severity,url:via.url,range:via.range});
        ownRoots.add(id);
      }
    }
    roots.set(name,ownRoots);
    edges.set(name,sorted(new Set(dependencies)));
  }

  // Monotonic fixed-point closure resolves cycles (e.g., Metro <-> React Native).
  // Recursive memoization is unsafe because the visiting set changes each result.
  let changed=true,rounds=0;
  while(changed){
    assert.ok(rounds++<=packages.length+1,'advisory closure exceeded finite graph');
    changed=false;
    for(const name of packages)for(const dependency of edges.get(name)){
      for(const id of roots.get(dependency))if(!roots.get(name).has(id)){
        roots.get(name).add(id);changed=true;
      }
    }
  }
  for(const name of packages)assert.ok(roots.get(name).size>0,name+' has no reachable concrete advisory root');

  const causes=sorted(rootMetadata.keys()).map(id=>{
    const meta=rootMetadata.get(id);
    const affected=packages.filter(name=>roots.get(name).has(id));
    assert.ok(affected.includes(meta.package),'advisory root not in its package');
    const policy=REVIEWED_HIGH_ADVISORIES[id];
    const reviewed=meta.severity!=='high'?'NON_HIGH_REVIEW_SEPARATE':policy?.package===meta.package && policy.affected===meta.range?'REVIEWED_SOURCE_SNAPSHOT':'HIGH_REVIEW_REQUIRED';
    return {
      ...meta,affectedPackageCount:affected.length,affectedPackages:affected,
      propagatedPackageCount:affected.length-1,
      reviewStatus:reviewed,
      sourceSnapshot:reviewed==='REVIEWED_SOURCE_SNAPSHOT'?policy:null
    };
  });
  const highCauses=causes.filter(x=>x.severity==='high');
  const unreviewedHigh=highCauses.filter(x=>x.reviewStatus!=='REVIEWED_SOURCE_SNAPSHOT');
  const highNodes=packages.filter(n=>vulnerabilities[n].severity==='high');
  for(const name of highNodes)assert.ok([...roots.get(name)].some(id=>rootMetadata.get(id)?.severity==='high'),name+' high severity has no high advisory root');
  return {
    schema:'bejewely.sca-advisory-causal-graph.v1',
    informationalOnly:true,
    counts:{affectedVulnerabilityNodes:packages.length,highSeverityNodes:highNodes.length,concreteAdvisoryLeaves:causes.length,highSeverityLeaves:highCauses.length},
    causes,
    highCauseDisposition:!highCauses.length?'NO_HIGH_ADVISORY':unreviewedHigh.length?'REVIEW_NEW_HIGH_SOURCE':'KNOWN_HIGH_WITHOUT_OFFICIAL_FIX_RELEASE',
    unreviewedHighIds:unreviewedHigh.map(x=>x.id),
    closureRounds:rounds,
    policySnapshotDate:'2026-10-14'
  };
}
