import {existsSync,realpathSync,writeFileSync,unlinkSync} from "node:fs";
import {isAbsolute,dirname,extname,relative,resolve,sep} from "node:path";
import {
  buildStyleCheckStructuralHumanReviewPacket,
  buildStyleCheckStructuralHumanOperatorManifest
} from "../lib/face-lab-v2/evaluation/style-check-structural-human-pairwise-builder.js";
import {
  verifyFaceLabV2HumanPairwisePacketDigest,
  verifyFaceLabV2HumanPairwiseOperatorManifestDigest
} from "../lib/face-lab-v2/evaluation/human-pairwise-builder.js";

/**
 * SC-06C: explicit, separated, write-once exports for synthetic packets.
 * Do not write sensitive operator mappings into Git working trees, stdout,
 * reviewer directories, or an existing file.
 */
const parse=(prefix)=>process.argv.find(x=>x.startsWith(prefix))?.slice(prefix.length);
const requestedReview=parse("--review-file=");
const requestedOperator=parse("--operator-file=");
if(!requestedReview||!requestedOperator||
   !isAbsolute(requestedReview)||!isAbsolute(requestedOperator))
  throw Error("Specify both --review-file=/absolute/path.json and --operator-file=/other/absolute/path.json");

const check=(filepath)=>{
  if(extname(filepath).toLowerCase()!==".json")
    throw Error("Output must have .json extension");
  const folder=realpathSync(dirname(filepath));
  const full=resolve(folder,filepath.split(/[\\/]/).at(-1));
  if(existsSync(full))throw Error("Output already exists (write-once only)");
  const repoRoot=realpathSync(process.cwd());
  const withinRepo=relative(repoRoot,full);
  if(withinRepo===""||(!withinRepo.startsWith(".."+sep)&&withinRepo!==".."))
    throw Error("Refusing to export study artifacts into current repository");
  return {folder,full};
};
const review=check(requestedReview);
const operator=check(requestedOperator);
if(review.full===operator.full||review.folder===operator.folder)
  throw Error("Review and confidential operator outputs must be in separate directories");
const packet=buildStyleCheckStructuralHumanReviewPacket();
const manifest=buildStyleCheckStructuralHumanOperatorManifest();
if(!verifyFaceLabV2HumanPairwisePacketDigest(packet) ||
   !verifyFaceLabV2HumanPairwiseOperatorManifestDigest(manifest) ||
   packet.packetDigest!==manifest.reviewPacketDigest ||
   packet.packetId!==manifest.packetId)
  throw Error("Refusing invalid or mismatched packet/manifest");

let savedReview=false;
try{
  writeFileSync(review.full,JSON.stringify(packet,null,2)+"\n",{flag:"wx",mode:0o600});
  savedReview=true;
  writeFileSync(operator.full,JSON.stringify(manifest,null,2)+"\n",{flag:"wx",mode:0o600});
}catch(error){
  if(savedReview)unlinkSync(review.full);
  throw error;
}
console.log(JSON.stringify({
  ok:true,syntheticOnly:true,
  pairCount:packet.reviewItems.length,
  reviewPacketCreated:true,confidentialOperatorManifestCreated:true,
  roleMappingPrinted:false,realPhotosCollected:0,humanJudgmentsCollected:0
}));
