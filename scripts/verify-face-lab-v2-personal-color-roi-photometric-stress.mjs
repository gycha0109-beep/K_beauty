import assert from "node:assert/strict";
import { buildFaceLabObservationAnalysis } from "../lib/face-lab-observation-contract.js";
import { buildPersonalColorObservation } from "../lib/face-lab-v2/personal-color/observation.js";
import { proposePersonalColorCheekRegions } from "../lib/face-lab-v2/personal-color/cheek-landmark-proposal.js";
import { buildPersonalColorCheekMasks } from "../lib/face-lab-v2/personal-color/cheek-mask-geometry.js";
import { comparePersonalColorPhotoMeasurements } from "../lib/face-lab-v2/personal-color/photo-capture-comparison.js";
import { evaluatePersonalColorCapturePair } from "../lib/face-lab-v2/personal-color/capture-repeatability-audit.js";
import { measurePersonalColorReviewedCheekRoi } from "../lib/face-lab-v2/personal-color/reviewed-roi-sampling.js";

const WIDTH = 128;
const HEIGHT = 128;
const PIXELS = WIDTH * HEIGHT;
const REGION = ["leftCheek", "rightCheek"];
const quad = (x1,y1,x2,y2) => [
  {x:x1,y:y1}, {x:x2,y:y1}, {x:x2,y:y2}, {x:x1,y:y2}
];
const landmarks = Array.from({length:478}, () => ({x:0.5,y:0.5,z:0}));
const anchors = {
  234:[0.20,0.50], 454:[0.80,0.50], 1:[0.5,0.48],
  33:[0.35,0.32], 263:[0.65,0.32], 61:[0.40,0.68], 291:[0.60,0.68]
};
for (const [key,[x,y]] of Object.entries(anchors)) {
  landmarks[Number(key)] = {x,y,z:0};
}
function observation(q={}) {
  const field = (value) => ({
    value, visibility:"clear", evidence:["synthetic:visible"],
    unavailableReason:null
  });
  const analysis = buildFaceLabObservationAnalysis({
    quality: {
      faceVisibility:"clear", faceScale:"adequate",
      pose:{yaw:"frontal",pitch:"level",roll:"level"},
      occlusion:{forehead:"none",brows:"none",eyes:"none",cheeks:"none",jawline:"none"},
      sharpness:"clear", exposure:"balanced", lightingUniformity:"even",
      whiteBalance:"stable", filterOrEditing:"none_detected", makeupCoverage:"none_or_light",
      structureSuitability:"suitable", colorSuitability:"suitable",
      evidence:["synthetic:quality"], ...q
    },
    observations: {
      colorAppearance: {
        apparentTemperature: field("neutral"),
        apparentBrightness: field("medium"),
        apparentSaturation: field("balanced")
      }
    }
  },{eligibility:{faceLabEligible:true},provider:"fixture",model:"synthetic"});
  return buildPersonalColorObservation(analysis);
}

// Synthetic oracle: independently specified larger true-skin patches.
// Constructed without deriving coordinates from the proposal under test.
const independentlyReviewedSkinMasks = {
  leftCheek:new Uint8Array(PIXELS),
  rightCheek:new Uint8Array(PIXELS)
};
for (let row=0;row<HEIGHT;row++) {
  for (let col=0;col<WIDTH;col++) {
    const x=(col+0.5)/WIDTH, y=(row+0.5)/HEIGHT, pos=row*WIDTH+col;
    if (y>=0.43 && y<0.61 && x>=0.29 && x<0.44) {
      independentlyReviewedSkinMasks.leftCheek[pos]=1;
    }
    if (y>=0.43 && y<0.61 && x>=0.56 && x<0.71) {
      independentlyReviewedSkinMasks.rightCheek[pos]=1;
    }
  }
}

const additionalExclusionPolygons=[quad(0.345,0.50,0.375,0.53)];
const independentReview = {
  skinRoi:"independently_approved",
  exclusions:"independently_approved",
  illumination:"independently_verified_stable",
  orientation:"original_image_verified"
};
const roiInput = {
  width:WIDTH, height:HEIGHT, faceLandmarks:landmarks, faceCount:1,
  coordinateSpace:"original_image",
  additionalExclusionPolygons,
  independentlyReviewedSkinMasks,
  independentReview
};

const proposal=proposePersonalColorCheekRegions(roiInput);
assert.equal(proposal.status,"proposal_only");
assert.equal(proposal.mayMeasureSkin,false);
assert.equal(proposal.requiresIndependentRoiReview,true);
const geometry=buildPersonalColorCheekMasks({
  width:WIDTH,height:HEIGHT,
  cheekPolygons:proposal.cheekPolygons,
  exclusionPolygons:[...proposal.exclusionPolygons,...additionalExclusionPolygons]
});
assert.equal(geometry.status,"masks_ready");
assert.ok(geometry.sampleCount.leftCheek>=16 && geometry.sampleCount.rightCheek>=16);
assert.ok(geometry.exclusionMask.some(v=>v===1));

const baselineImage=new Uint8ClampedArray(PIXELS*4);
for(let i=0;i<PIXELS;i++){
  const isCheek=independentlyReviewedSkinMasks.leftCheek[i]||
    independentlyReviewedSkinMasks.rightCheek[i];
  const rgb=isCheek?[176,129,112]:[25,85,205];
  baselineImage.set([...rgb,255],i*4);
}
function sample(rgba, extras={}) {
  return measurePersonalColorReviewedCheekRoi({
    ...roiInput, observation:observation(), rgba, ...extras
  });
}
const base=sample(baselineImage);
assert.equal(base.status,"measurement_only",JSON.stringify(base));
assert.equal(base.geometryStatus,"reviewed_geometry_from_landmark_proposal");
assert.equal(base.measurement.regions.leftCheek.sampleCount,
  geometry.sampleCount.leftCheek);
assert.equal(base.measurement.regions.rightCheek.sampleCount,
  geometry.sampleCount.rightCheek);
assert.equal(base.measurement.undertone,null);
assert.equal(base.measurement.seasonCandidate,null);
assert.equal(base.suitability,null);
assert.equal(base.sourceImagePersisted,false);
assert.deepEqual(sample(baselineImage),base);
assert.ok(base.measurement.combined.lab.a>0);
assert.ok(base.measurement.combined.lab.b>0);
assert.ok(!JSON.stringify(base).includes("faceLandmarks"));
assert.ok(!JSON.stringify(base).includes("rgba"));
assert.ok(!JSON.stringify(base).includes("independentlyReviewedSkinMasks"));

function mustHold(overrides,reason) {
  const result=sample(baselineImage,overrides);
  assert.equal(result.status,"insufficient_evidence",JSON.stringify(result));
  assert.equal(result.reason,reason);
  assert.equal(result.measurement,null);
  assert.equal(result.sourceImagePersisted,false);
}
mustHold({independentReview:null},"independent_photo_review_required");
mustHold({independentReview:{...independentReview,illumination:"unknown"}},
  "independent_photo_review_required");
mustHold({independentReview:{...independentReview,orientation:"mirrored_preview"}},
  "independent_photo_review_required");
mustHold({independentReview:{...independentReview,skinRoi:"automatically_approved"}},
  "independent_photo_review_required");
mustHold({independentReview:{...independentReview,faceId:"forbidden"}},
  "independent_photo_review_required");
mustHold({additionalExclusionPolygons:[]},"independent_exclusion_geometry_required");
mustHold({faceCount:2},"single_face_landmarks_unavailable");
mustHold({coordinateSpace:"mirrored_preview"},"image_orientation_unknown");
mustHold({faceLandmarks:landmarks.slice(0,20)},"single_face_landmarks_unavailable");
mustHold({independentlyReviewedSkinMasks:null},
  "independently_reviewed_skin_masks_required");
const offMask={
  leftCheek:Uint8Array.from(independentlyReviewedSkinMasks.leftCheek),
  rightCheek:Uint8Array.from(independentlyReviewedSkinMasks.rightCheek)
};
offMask.leftCheek.fill(0);
mustHold({independentlyReviewedSkinMasks:offMask},
  "roi_outside_independently_reviewed_skin");
const shiftedLandmarks=structuredClone(landmarks);
for(const index of [234,454,1,33,263,61,291]) {
  shiftedLandmarks[index].x += 0.08;
}
mustHold({faceLandmarks:shiftedLandmarks},
  "roi_outside_independently_reviewed_skin");
const nonBinary={
  leftCheek:Uint8Array.from(independentlyReviewedSkinMasks.leftCheek),
  rightCheek:Uint8Array.from(independentlyReviewedSkinMasks.rightCheek)
};
nonBinary.rightCheek[0]=255;
mustHold({independentlyReviewedSkinMasks:nonBinary},
  "independently_reviewed_skin_masks_required");
mustHold({observation:observation({whiteBalance:"warm_cast"})},
  "observation_not_eligible");
mustHold({observation:observation({sharpness:"blurred"})},
  "observation_not_eligible");
mustHold({observation:observation({exposure:"underexposed"})},
  "observation_not_eligible");
mustHold({observation:observation({filterOrEditing:"possible"})},
  "observation_not_eligible");
mustHold({observation:observation({lightingUniformity:"uneven"})},
  "observation_not_eligible");
mustHold({observation:observation({makeupCoverage:"heavy"})},
  "observation_not_eligible");

function perturb(name) {
  const values={
    identical:[1,1,1],
    warm_cast:[1.25,1.01,0.78],
    cool_cast:[0.78,1.00,1.25],
    bright:[1.19,1.19,1.19],
    dark:[0.76,0.76,0.76],
    saturation_up:[1,1,1],
    saturation_down:[1,1,1],
    uneven_left_right:[1,1,1]
  };
  const rgb=values[name];
  if(!rgb) throw Error("unrecognized deterministic fixture");
  const out=Uint8ClampedArray.from(baselineImage);
  for(let i=0;i<PIXELS;i++) {
    for(let channel=0;channel<3;channel++) {
      const r=baselineImage[i*4], g=baselineImage[i*4+1], b=baselineImage[i*4+2];
      const gray=0.2126*r+0.7152*g+0.0722*b;
      const factor=name==="saturation_up" ? 1.5 :
        name==="saturation_down" ? 0.55 : 1;
      const lateralGain=name==="uneven_left_right"
        ? (i % WIDTH < WIDTH / 2 ? 0.78 : 1.17) : 1;
      const transformed=(gray+(baselineImage[i*4+channel]-gray)*factor)*
        rgb[channel]*lateralGain;
      out[i*4+channel]=Math.min(255,Math.max(0,Math.round(transformed)));
    }
  }
  return out;
}
const results={};
for(const scenario of ["identical","warm_cast","cool_cast","bright","dark","saturation_up","saturation_down","uneven_left_right"]) {
  const image=perturb(scenario);
  const measurement=sample(image);
  assert.equal(measurement.status,"measurement_only");
  const comparison=comparePersonalColorPhotoMeasurements(
    base.measurement,measurement.measurement
  );
  assert.equal(comparison.status,"evaluation_only");
  results[scenario]={
    lab:measurement.measurement.combined.lab,
    deltaE76:comparison.comparison.combined.deltaE76
  };
  assert.deepEqual(perturb(scenario),image);
}
assert.equal(results.identical.deltaE76,0);
for(const name of ["warm_cast","cool_cast","bright","dark","saturation_up","saturation_down","uneven_left_right"]) {
  assert.ok(results[name].deltaE76>0);
}
assert.ok(results.warm_cast.lab.b>results.identical.lab.b);
assert.ok(results.cool_cast.lab.b<results.identical.lab.b);
assert.ok(results.bright.lab.L>results.identical.lab.L);
assert.ok(results.dark.lab.L<results.identical.lab.L);
const baseChroma=Math.hypot(results.identical.lab.a,results.identical.lab.b);
assert.ok(Math.hypot(results.saturation_up.lab.a,results.saturation_up.lab.b)>baseChroma);
assert.ok(Math.hypot(results.saturation_down.lab.a,results.saturation_down.lab.b)<baseChroma);
const uneven=sample(perturb("uneven_left_right"));
assert.ok(uneven.measurement.regions.leftCheek.lab.L < base.measurement.regions.leftCheek.lab.L);
assert.ok(uneven.measurement.regions.rightCheek.lab.L > base.measurement.regions.rightCheek.lab.L);
const baselinePair = { observation: observation(), measurement: base.measurement };
const reviewContext = {
  subjectReview:"independently_reviewed_same_subject",
  roiReview:"both_independently_approved",
  orientation:"both_original_image",
  lightingRelation:"changed_controlled_light",
  deviceRelation:"same_device"
};
const uniformAudit=evaluatePersonalColorCapturePair({
  baseline:baselinePair,
  followup:{observation:observation(),measurement:sample(perturb("warm_cast")).measurement},
  context:reviewContext
});
assert.equal(uniformAudit.status,"evaluation_only");
const spatialAudit=evaluatePersonalColorCapturePair({
  baseline:baselinePair,
  followup:{observation:observation(),measurement:uneven.measurement},
  context:reviewContext
});
assert.equal(spatialAudit.status,"insufficient_evidence");
assert.equal(spatialAudit.reason,"opposing_cheek_lightness_drift");
assert.equal(spatialAudit.colorDifference,null);
assert.equal(spatialAudit.repeatabilityVerdict,null);
assert.equal(spatialAudit.calibratedColorAccuracy,null);

// The original M2 observation/measurement cannot *infer* a digital color cast
// if the upstream quality observer falsely marks white balance as stable.
// When an independent reviewer flags the condition, the wrapper must HOLD.
// Do not equate this test with automatic lighting detection.
for(const name of ["warm_cast","cool_cast"]) {
  mustHold({
    rgba:perturb(name),
    independentReview:{...independentReview,illumination:"unverified_or_color_cast"}
  },"independent_photo_review_required");
}

// Independent exclusion masks must keep a strongly contaminated patch out.
const contaminated=Uint8ClampedArray.from(baselineImage);
for(let row=64;row<68;row++) for(let col=45;col<47;col++) {
  contaminated.set([0,255,0,255],(row*WIDTH+col)*4);
}
const excludes=sample(contaminated);
assert.equal(excludes.status,"measurement_only");
// All valid cheek samples are uniform, even if the excluded decoration was
// present in pixels; sampling may not turn it into color advice.
assert.deepEqual(excludes.measurement.combined,base.measurement.combined);

console.log(JSON.stringify({
  ok:true, suite:"m2_roi_and_photometric_stress",
  roi:"landmark_proposal_plus_independent_mask_research_only",
  syntheticCases:Object.keys(results),
  deltas: Object.fromEntries(Object.entries(results).map(([k,v])=>[k,v.deltaE76])),
  opposingCheekLightnessDriftHeld:true,
  sourceImagePersisted:false,
  realFaceDetectorIntegrated:false,
  automaticColorCastDetectionValidated:false,
  calibratedAccuracyValidated:false,
  productionPaletteActivated:false
},null,2));
