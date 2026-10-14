import {args,prepareBundle} from './sca-release-bundle.mjs';
const a=args(process.argv.slice(2),['--braces','--forge','--output']);
if(!a['--braces']||!a['--forge']||!a['--output'])throw Error('Require --braces --forge --output (new isolated folder)');
console.log('SCA_B6_RELEASE_CANDIDATE='+JSON.stringify(prepareBundle({braces:a['--braces'],forge:a['--forge'],output:a['--output']})));
