/** Read-only unauthenticated smoke against the local built Next app. No hosted APIs. */
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {createHash} from "node:crypto";
import net from "node:net";
import path from "node:path";

const root=process.cwd();
const reserve=net.createServer();
await new Promise((resolve,reject)=>{reserve.once("error",reject);reserve.listen(0,"127.0.0.1",resolve);});
const port=reserve.address().port;
await new Promise(resolve=>reserve.close(resolve));
const server=spawn(process.execPath,[path.join(root,"node_modules/next/dist/bin/next"),"start",
  "--hostname","127.0.0.1","--port",String(port)],{cwd:root,stdio:["ignore","pipe","pipe"],
  env:{...process.env,NEXT_TELEMETRY_DISABLED:"1"}});
let output="",spawnError;
server.on("error",e=>{spawnError=e;});
for(const stream of [server.stdout,server.stderr])stream.on("data",data=>{
  if(output.length<16000)output+=data.toString();
});
try {
  let ready=false;
  for(let i=0;i<100;i++) {
    if(spawnError)throw spawnError;
    assert.equal(server.exitCode,null,"local production server exited: "+output);
    try {const r=await fetch(`http://127.0.0.1:${port}/`,{signal:AbortSignal.timeout(1000)});
      if(r.status===200) {ready=true;break;} }
    catch { /* startup only, bounded; actual route results below must pass */ }
    await new Promise(resolve=>setTimeout(resolve,200));
  }
  assert.ok(ready,"local production server did not become ready: "+output);
  const results=[];
  for(const route of ["/","/privacy","/support"]) {
    const r=await fetch(`http://127.0.0.1:${port}${route}`,{signal:AbortSignal.timeout(10000)});
    const html=await r.text();
    assert.equal(r.status,200,"local route failed: "+route);
    assert.match(html,/<html[\s>]/i,"expected rendered HTML: "+route);
    results.push({route,status:r.status,bodySha256:createHash("sha256").update(html).digest("hex")});
  }
  console.log("SCA_LOCAL_PRODUCTION_SMOKE="+JSON.stringify({status:"PASS",results,
    scope:"UNAUTHENTICATED_LOCAL_HTML_ONLY",providerCalls:"NOT_TESTED",cameraDevice:"NOT_TESTED"}));
} finally {
  server.kill("SIGTERM");
  await Promise.race([new Promise(resolve=>server.once("exit",resolve)),
    new Promise(resolve=>setTimeout(resolve,3000))]);
  if(server.exitCode===null)server.kill("SIGKILL");
}
