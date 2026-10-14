#!/usr/bin/env node
/** B1 isolated child process; enforced timeout by parent verifier. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
const require=createRequire(import.meta.url);
const root=path.resolve(process.cwd());
const stage=process.argv[2];
assert.ok(path.isAbsolute(stage),"absolute disposable candidate path required");
const original=require(path.join(root,"node_modules","braces"));
const patched=require(stage);
const compile=require(path.join(stage,"lib/compile.js"));
const expand=require(path.join(stage,"lib/expand.js"));
const stringify=require(path.join(stage,"lib/stringify.js"));
const parse=require(path.join(stage,"lib/parse.js"));
const deep=(count)=>{
  let n={type:"text",value:"a"};
  for(let i=0;i<count;i++)n={type:"brace",nodes:[n]};
  return {type:"root",nodes:[n]};
};
const depthFail=(fn)=>assert.throws(fn,/exceeds max depth/);
const normal=[
  "a/{b,c}/d","foo/({a,b})","{a,b}/file.txt",
  "src/{a,b}/**/*.js","a{1..3}b","{a,{b,c}}","some/{x,y}/z",
];
for(const s of normal){
  assert.deepEqual(patched(s),original(s),"compile regression: "+s);
  assert.deepEqual(patched.expand(s),original.expand(s),"expand regression: "+s);
}
assert.equal(original.parse("{".repeat(110)+"a,b"+"}".repeat(110)).type,"root");
depthFail(()=>parse("{".repeat(110)+"a,b"+"}".repeat(110)));
depthFail(()=>parse("(".repeat(101)+"a"+")".repeat(101)));
depthFail(()=>parse("{{a,b},c}",{maxDepth:1}));
assert.doesNotThrow(()=>parse("{{a,b},c}",{maxDepth:2}));
for(const f of [compile,expand,stringify]) depthFail(()=>f(deep(101)));
depthFail(()=>parse("((a))",{maxDepth:1.5}));
assert.doesNotThrow(()=>parse("(a)",{maxDepth:1.5}));
const self={type:"paren",nodes:[{type:"text",value:"a"}]};
self.parent=self;
assert.throws(()=>expand(self),/parent chain contains a cycle/);
const parent={type:"paren"};
const multiple={type:"paren",nodes:[{type:"text",value:"a"}],parent};
parent.parent=multiple;
assert.throws(()=>expand(multiple),/parent chain contains a cycle/);
assert.deepEqual(expand(parse("foo/({a,b})")),["foo/(a)","foo/(b)"]);
for(const s of ["{{a}}","{a,{b}}","{{x}y}","{}{a}"]){
  assert.equal(stringify(parse(s),{escapeInvalid:true}),s);
}
console.log("SCA_B1_BRACES_BEHAVIOR=PASS positive-patterns="+normal.length+
  " parse-depth+AST-three-walkers+fractional-bound+parent-cycles");
