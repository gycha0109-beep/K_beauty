import {readdirSync,readFileSync,lstatSync,realpathSync,writeFileSync,existsSync} from "node:fs";
import {join,resolve,extname} from "node:path";
import {fileURLToPath} from "node:url";
import {compileFaceLabSimulationInstruction} from "../lib/face-lab-v2/simulation-instructions.js";
import {buildStyleCheckStructuralHumanReviewPacket} from "../lib/face-lab-v2/evaluation/style-check-structural-human-pairwise-builder.js";
const VERSION="face-lab-sc06e-local-preflight-v1";
const allowed=new Set([".jpg",".jpeg",".png",".webp"]);
function dimension(buffer){if(buffer.length<24)return null;
 if(buffer.subarray(0,3).toString("hex")==="ffd8ff"){let p=2;while(p+9<buffer.length){if(buffer[p]!==255)break;const marker=buffer[p+1],size=buffer.readUInt16BE(p+2);if([192,193,194,195,198,199,201,202].includes(marker))return {width:buffer.readUInt16BE(p+7),height:buffer.readUInt16BE(p+5)};if(size<2)break;p+=size+2;}}
 if(buffer.subarray(0,8).toString("hex")==="89504e470d0a1a0a")return {width:buffer.readUInt32BE(16),height:buffer.readUInt32BE(20)};
 if(buffer.toString("ascii",0,4)==="RIFF"&&buffer.toString("ascii",8,12)==="WEBP"){if(buffer.toString("ascii",12,16)==="VP8X")return {width:1+buffer.readUIntLE(24,3),height:1+buffer.readUIntLE(27,3)};}
 return null;}
export function buildLocalStyleCheckPreflight({folder,permissionConfirmed=false,observationConfirmed=false}={}){
 if(!folder||!existsSync(folder))throw Error("photo_folder_missing");
 const root=realpathSync(folder);const pairs=buildStyleCheckStructuralHumanReviewPacket().reviewItems;
 const photos=readdirSync(root,{withFileTypes:true}).filter(f=>f.isFile()&&allowed.has(extname(f.name).toLowerCase())).sort((a,b)=>a.name.localeCompare(b.name,"en")).map(f=>{
 const p=join(root,f.name);if(lstatSync(p).isSymbolicLink())throw Error("symlink_not_allowed");
 const bytes=readFileSync(p);const dimensions=dimension(bytes);const decodedHeader=Boolean(dimensions?.width>0&&dimensions?.height>0);
 return {fileName:f.name,byteLength:bytes.length,width:dimensions?.width??null,height:dimensions?.height??null,headerReadable:decodedHeader,observationStatus:"not_verified",rightsStatus:permissionConfirmed?"operator_asserted_not_independently_verified":"not_verified",caseBinding:"unassigned",styleImages:"not_provided"};
 });
 const simulation=compileFaceLabSimulationInstruction(null);
 if(simulation.status!=="invalid")throw Error("render_spec_gate_not_fail_closed");
 return {schemaVersion:VERSION,status:"preflight_only_not_style_validation",photoCount:photos.length,photos,reviewPairCount:pairs.length,observationFieldsDefined:22,observationVerificationPerformed:false,consentVerified:false,rightsVerified:false,caseMatchVerified:false,readyVisualPairs:0,simulation:{existingCompilerWired:true,status:"held",reason:"verified_observation_selected_route_and_render_spec_required",compilerRejectsMissingRenderSpec:true,providerInvoked:false},productionActive:false};
}
const direct=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){const folder=process.argv.find(s=>s.startsWith("--folder="))?.slice(9);const output=process.argv.find(s=>s.startsWith("--output="))?.slice(9);if(!folder||!output||!resolve(output).toLowerCase().endsWith(".json"))throw Error("provide --folder and --output");if(existsSync(output))throw Error("write_once");const result=buildLocalStyleCheckPreflight({folder});writeFileSync(output,JSON.stringify(result,null,2),{flag:"wx"});console.log(JSON.stringify({status:result.status,photoCount:result.photoCount,readyVisualPairs:0,providerInvoked:false,output}));}
