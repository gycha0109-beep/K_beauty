/**
 * Local-only photograph diagnostics for human ROI research review.
 *
 * These are pixel descriptive signals, NOT qualified skin, shadow or makeup
 * detection, not a proof of focus, and never a photometry authorization.
 * No image/pixel array is included in the return value.
 */
export function describeRoiPhotoEvidence({
  rgba,width,height,leftMask,rightMask,exclusionMask
}={}) {
  const n=width*height;
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||
    width<3||height<3||n>1024*1024||
    !(rgba instanceof Uint8ClampedArray)||rgba.length!==n*4||
    !(leftMask instanceof Uint8Array)||leftMask.length!==n||
    !(rightMask instanceof Uint8Array)||rightMask.length!==n||
    !(exclusionMask instanceof Uint8Array)||exclusionMask.length!==n) {
    return {status:"insufficient_evidence",reason:"photo_diagnostic_inputs_invalid"};
  }
  const luma=new Float32Array(n);
  for(let i=0;i<n;i++){
    const k=i*4;
    luma[i]=.2126*rgba[k]+.7152*rgba[k+1]+.0722*rgba[k+2];
  }
  function one(mask) {
    let count=0,clipped=0,sum=0,textureCount=0,gradientTotal=0;
    for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){
      const i=y*width+x;
      if(mask[i]!==1||exclusionMask[i]===1)continue;
      const value=luma[i];
      count++;sum+=value;
      const k=i*4;
      // Clipping heuristic: near-zero/near-maximum on all three channels.
      if(Math.min(rgba[k],rgba[k+1],rgba[k+2])>=250||
        Math.max(rgba[k],rgba[k+1],rgba[k+2])<=5)clipped++;
      if(mask[i-1]===1&&mask[i+1]===1&&
        mask[i-width]===1&&mask[i+width]===1&&
        exclusionMask[i-1]===0&&exclusionMask[i+1]===0&&
        exclusionMask[i-width]===0&&exclusionMask[i+width]===0){
        const lap=Math.abs(4*value-luma[i-1]-luma[i+1]-
          luma[i-width]-luma[i+width]);
        gradientTotal+=lap;
        textureCount++;
      }
    }
    if(count<16||textureCount<8) {
      return {status:"insufficient_evidence",reason:"insufficient_local_roi_pixels"};
    }
    return {status:"descriptive_only",pixelCount:count,
      clippedFraction:Math.round(10000*clipped/count)/10000,
      meanLuma:Math.round(1000*sum/count)/1000,
      // A descriptive local high-frequency signal, not verified sharpness.
      detailSignal:Math.round(10000*gradientTotal/(255*textureCount))/10000
    };
  }
  const imageLeft=one(leftMask),imageRight=one(rightMask);
  if(imageLeft.status!=="descriptive_only"||
    imageRight.status!=="descriptive_only") {
    return {status:"insufficient_evidence",reason:"insufficient_local_roi_pixels"};
  }
  return {status:"descriptive_only",imageLeft,imageRight,
    meanLumaGap:Math.round(1000*Math.abs(imageLeft.meanLuma-imageRight.meanLuma)/255)/1000,
    bareSkinVerified:false,focusVerified:false,
    photoColorCalibrated:false,measurementAuthorized:false,
    uploaded:false,persisted:false};
}
