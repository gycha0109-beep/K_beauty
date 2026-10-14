import {args,verifyBundle,loadApprovedBundle} from './sca-release-bundle.mjs';
const a=args(process.argv.slice(2),['--bundle','--approval','--signatures','--trust']);
if(!a['--bundle'])throw Error('--bundle required');
if(Object.keys(a).length===1)console.log('SCA_B6_CODE_PROVENANCE_ONLY='+JSON.stringify(verifyBundle(a['--bundle'])));
else {
  if(!a['--approval']||!a['--signatures']||!a['--trust'])throw Error('All approval/signature/trust inputs required');
  const r=loadApprovedBundle({bundle:a['--bundle'],approval:a['--approval'],signatures:a['--signatures'],trust:a['--trust']});
  console.log('SCA_B6_UPLOAD_ADMISSION='+JSON.stringify({candidateSha256:r.receipt.candidateSha256,scope:r.scope,officialAudit:r.officialAudit,mergeApproved:r.mergeApproved,productionApproved:r.productionApproved}));
}
