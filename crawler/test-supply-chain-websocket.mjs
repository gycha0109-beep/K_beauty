import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {once} from 'node:events';
import {WebSocket,WebSocketServer} from 'ws';
const require=createRequire(import.meta.url),realtime=require.resolve('@supabase/realtime-js/package.json');
const consumer=createRequire(realtime),meta=JSON.parse(fs.readFileSync(consumer.resolve('ws/package.json')));
assert.equal(meta.version,'8.22.0','actual realtime consumer must resolve the official fixed release');
const wait=p=>Promise.race([p,new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error('bounded localhost websocket test timed out')),5000);t.unref();})]);
async function exercise(limits){
  const server=new WebSocketServer({host:'127.0.0.1',port:0,...limits}),peers=[];
  let errorCode=null,delivered=0;
  server.on('connection',peer=>{peers.push(peer);peer.on('error',e=>{errorCode=e.code;});peer.on('message',b=>{delivered++;peer.send(b);});});
  await wait(once(server,'listening'));
  assert.ok(server.options.maxFragments>0&&server.options.maxBufferedChunks>0,'fixed release must have bounded defaults');
  const client=new WebSocket('ws://127.0.0.1:'+server.address().port);client.on('error',()=>{});
  try{
    await wait(once(client,'open'));
    if(!limits){const message=once(client,'message');client.send('supply-chain-normal-round-trip');const [bytes]=await wait(message);assert.equal(bytes.toString(),'supply-chain-normal-round-trip');assert.equal(delivered,1);}
    else {
      const close=new Promise(resolve=>client.once('close',(code)=>resolve(code)));
      client.send('a',{fin:false});client.send('b',{fin:false});client.send('c',{fin:true});
      assert.equal(await wait(close),1008,'excess fragments must be rejected without exhausting memory');
      assert.equal(errorCode,'WS_ERR_TOO_MANY_BUFFERED_PARTS');assert.equal(delivered,0);
    }
  }finally{client.terminate();for(const p of peers)p.terminate();await new Promise(resolve=>server.close(resolve));}
}
await exercise();await exercise({maxFragments:2,maxBufferedChunks:8,maxPayload:1024});
console.log('CRAWLER_OFFICIAL_WS_CONSUMER=PASS scope=LOCALHOST_ONLY normal_echo=PASS bounded_fragments=REJECTED');
