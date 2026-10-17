import fs from 'node:fs';
import path from 'node:path';
export function npmCli(){
  const node=path.dirname(process.execPath);
  const choices=[process.env.npm_execpath,path.join(node,'node_modules/npm/bin/npm-cli.js'),path.resolve(node,'../lib/node_modules/npm/bin/npm-cli.js')];
  const found=choices.find(p=>p&&path.basename(p)==='npm-cli.js'&&fs.existsSync(p));
  if(!found)throw new Error('NPM_CLI_UNAVAILABLE');
  return found;
}
