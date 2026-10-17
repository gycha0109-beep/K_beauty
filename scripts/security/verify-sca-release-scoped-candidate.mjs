/** Offline scoped admission CLI. This command never uploads or installs the product. */
import fs from 'node:fs';
import path from 'node:path';
import {args,verifyBundle,requirePinnedTrust} from './sca-release-bundle.mjs';
import {verifyScopedCandidate,verifyScopedApproval} from './sca-release-scoped.mjs';
const a=args(process.argv.slice(2),['--original-bundle','--candidate','--approval','--signatures','--trust']);
if(!a['--original-bundle']||!a['--candidate'])throw Error('Require original B6 bundle and scoped candidate');
verifyBundle(a['--original-bundle']);
const originals={braces:path.join(a['--original-bundle'],'braces-3.0.3.tgz'),'node-forge':path.join(a['--original-bundle'],'node-forge-1.4.0.tgz')};
const receipt=verifyScopedCandidate({originals,output:a['--candidate']});
const approvalOptions=['--approval','--signatures','--trust'];
if(approvalOptions.some(k=>a[k])){
  if(!approvalOptions.every(k=>a[k]))throw Error('All organizational approval/signature/trust inputs required');
  requirePinnedTrust(a['--trust']);
  const admitted=verifyScopedApproval({candidateSha256:receipt.candidateSha256,approvalBytes:fs.readFileSync(a['--approval']),
    signatures:JSON.parse(fs.readFileSync(a['--signatures'])),trust:JSON.parse(fs.readFileSync(a['--trust']))});
  console.log('SCA_SCOPED_SIGNED_ADMISSION='+JSON.stringify(admitted));
}
console.log('SCA_SCOPED_VERIFIED_CANDIDATE='+JSON.stringify(receipt));
